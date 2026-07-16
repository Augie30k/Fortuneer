import type { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction as PlaidTransaction, RemovedTransaction } from 'plaid'
import { plaidClient } from '@/lib/plaid'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface ItemRow {
  id: string
  user_id: string
  item_id: string
  access_token: string
  sync_cursor: string | null
}

/**
 * Full sync for one Plaid item: transactions (cursor-based) + balances + net-worth snapshot.
 * Returns counts for the caller to surface in the UI.
 */
export async function syncPlaidItem(supabase: SupabaseClient, item: ItemRow) {
  // Map Plaid personal_finance_category.primary -> our global category ids
  const [{ data: categories }, { data: rules }, { data: exclusions }] = await Promise.all([
    supabase.from('categories').select('id, plaid_pfc').is('user_id', null),
    supabase
      .from('rules')
      .select('matcher, match_field, match_type, amount_min, amount_max, category_id')
      .eq('user_id', item.user_id),
    supabase
      .from('excluded_plaid_accounts')
      .select('plaid_account_id')
      .eq('user_id', item.user_id),
  ])

  // Accounts the user explicitly removed — never resurrect them on sync
  const excluded = new Set((exclusions ?? []).map((e) => e.plaid_account_id))

  const pfcToCategory = new Map<string, string>()
  for (const c of categories ?? []) {
    if (c.plaid_pfc) pfcToCategory.set(c.plaid_pfc, c.id)
  }
  const fallbackCategory = pfcToCategory.get('OTHER') ?? null

  // User rules take precedence over Plaid's categorization. All of a rule's
  // conditions (text match + optional amount window) must hold.
  const applyRules = (merchant: string | null, description: string, amount: number): string | null => {
    for (const r of rules ?? []) {
      const haystack = ((r.match_field === 'merchant' ? merchant : description) ?? '').toLowerCase()
      const textMatch =
        r.match_type === 'exact' ? haystack === r.matcher : haystack.includes(r.matcher)
      if (!textMatch) continue
      if (r.amount_min != null && amount < Number(r.amount_min)) continue
      if (r.amount_max != null && amount > Number(r.amount_max)) continue
      return r.category_id
    }
    return null
  }

  // ---- 1. Pull transaction updates since cursor ----
  let cursor = item.sync_cursor
  let added: PlaidTransaction[] = []
  let modified: PlaidTransaction[] = []
  let removed: RemovedTransaction[] = []
  let hasMore = true
  let notReadyRetries = 8

  while (hasMore) {
    const { data } = await plaidClient.transactionsSync({
      access_token: item.access_token,
      cursor: cursor ?? undefined,
    })

    // Empty next_cursor on a fresh item means Plaid is still preparing data.
    if (data.next_cursor === '') {
      if (notReadyRetries-- <= 0) break
      await sleep(1500)
      continue
    }

    added = added.concat(data.added)
    modified = modified.concat(data.modified)
    removed = removed.concat(data.removed)
    cursor = data.next_cursor
    hasMore = data.has_more
  }

  // ---- 2. Refresh account balances (also covers newly added accounts) ----
  const { data: balanceData } = await plaidClient.accountsBalanceGet({
    access_token: item.access_token,
  })

  for (const acct of balanceData.accounts) {
    if (excluded.has(acct.account_id)) continue
    await supabase.from('accounts').upsert(
      {
        user_id: item.user_id,
        plaid_item_id: item.id,
        plaid_account_id: acct.account_id,
        name: acct.name,
        official_name: acct.official_name,
        mask: acct.mask,
        type: acct.type,
        subtype: acct.subtype,
        balance: acct.balances.current ?? 0,
        available_balance: acct.balances.available,
        currency: acct.balances.iso_currency_code ?? 'USD',
        is_manual: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plaid_account_id' }
    )
  }

  // Resolve plaid_account_id -> our account uuid for transaction rows
  const { data: accountRows } = await supabase
    .from('accounts')
    .select('id, plaid_account_id')
    .eq('plaid_item_id', item.id)

  const accountIdMap = new Map<string, string>()
  for (const a of accountRows ?? []) {
    if (a.plaid_account_id) accountIdMap.set(a.plaid_account_id, a.id)
  }

  // ---- 3. Upsert added/modified transactions ----
  const upserts = [...added, ...modified]
    .map((t) => {
      const accountId = accountIdMap.get(t.account_id)
      if (!accountId) return null
      return {
        user_id: item.user_id,
        account_id: accountId,
        plaid_transaction_id: t.transaction_id,
        category_id:
          applyRules(t.merchant_name ?? null, t.name, t.amount) ??
          pfcToCategory.get(t.personal_finance_category?.primary ?? '') ??
          fallbackCategory,
        amount: t.amount,
        description: t.name,
        merchant_name: t.merchant_name ?? null,
        logo_url: t.logo_url ?? t.personal_finance_category_icon_url ?? null,
        date: t.date,
        pending: t.pending,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (upserts.length > 0) {
    // Chunk to stay under PostgREST body limits on large initial syncs
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await supabase
        .from('transactions')
        .upsert(upserts.slice(i, i + 500), { onConflict: 'plaid_transaction_id' })
      if (error) throw error
    }
  }

  // ---- 4. Remove deleted transactions ----
  if (removed.length > 0) {
    await supabase
      .from('transactions')
      .delete()
      .in('plaid_transaction_id', removed.map((r) => r.transaction_id))
  }

  // ---- 5. Snapshot today's balances for net-worth history ----
  const today = new Date().toISOString().slice(0, 10)
  const snapshots = (accountRows ?? []).flatMap((a) => {
    const acct = balanceData.accounts.find((b) => b.account_id === a.plaid_account_id)
    if (!acct) return []
    return [{
      user_id: item.user_id,
      account_id: a.id,
      balance: acct.balances.current ?? 0,
      date: today,
    }]
  })
  if (snapshots.length > 0) {
    await supabase.from('balance_snapshots').upsert(snapshots, { onConflict: 'account_id,date' })
  }

  // ---- 5a. Backfill historical snapshots from transaction history ----
  // A newly connected account has months of transactions but only today's
  // snapshot, so the net-worth chart starts flat. Walk the ledger backwards
  // (Plaid: amount > 0 = outflow) to reconstruct weekly balances.
  try {
    for (const acctRow of accountRows ?? []) {
      const acct = balanceData.accounts.find((b) => b.account_id === acctRow.plaid_account_id)
      // Only cash/credit ledgers reconstruct cleanly from transactions
      if (!acct || !['depository', 'credit'].includes(acct.type)) continue

      const [{ data: earliestSnap }, { data: txns }] = await Promise.all([
        supabase
          .from('balance_snapshots')
          .select('date')
          .eq('account_id', acctRow.id)
          .order('date')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('transactions')
          .select('date, amount')
          .eq('account_id', acctRow.id)
          .order('date'),
      ])

      if (!txns?.length || !earliestSnap) continue
      const anchorDate = earliestSnap.date
      const firstTxnDate = txns[0].date
      if (firstTxnDate >= anchorDate) continue

      const currentBalance = acct.balances.current ?? 0
      // depository: past = current + Σ amounts after d; credit: past = current - Σ
      const sign = acct.type === 'credit' ? -1 : 1

      const backfills: { user_id: string; account_id: string; balance: number; date: string }[] = []
      const cursor = new Date(firstTxnDate + 'T00:00:00')
      const anchor = new Date(anchorDate + 'T00:00:00')
      while (cursor < anchor) {
        const d = cursor.toISOString().slice(0, 10)
        const sumAfter = txns
          .filter((t) => t.date > d)
          .reduce((s, t) => s + Number(t.amount), 0)
        backfills.push({
          user_id: item.user_id,
          account_id: acctRow.id,
          balance: Math.round((currentBalance + sign * sumAfter) * 100) / 100,
          date: d,
        })
        cursor.setDate(cursor.getDate() + 7)
      }
      if (backfills.length > 0) {
        await supabase
          .from('balance_snapshots')
          .upsert(backfills, { onConflict: 'account_id,date' })
      }
    }
  } catch (e) {
    console.warn('Snapshot backfill failed (non-fatal):', e)
  }

  // ---- 5b. Investment holdings (optional product; skip quietly if unsupported) ----
  try {
    const { data: holdingsData } = await plaidClient.investmentsHoldingsGet({
      access_token: item.access_token,
    })
    const securityById = new Map(holdingsData.securities.map((s) => [s.security_id, s]))
    const holdingRows = holdingsData.holdings.flatMap((h) => {
      const accountId = accountIdMap.get(h.account_id)
      if (!accountId) return []
      const security = securityById.get(h.security_id)
      return [{
        user_id: item.user_id,
        account_id: accountId,
        security_id: h.security_id,
        name: security?.name ?? null,
        ticker: security?.ticker_symbol ?? null,
        type: security?.type ?? null,
        quantity: h.quantity,
        price: h.institution_price,
        value: h.institution_value ?? 0,
        cost_basis: h.cost_basis,
        currency: h.iso_currency_code ?? 'USD',
        updated_at: new Date().toISOString(),
      }]
    })
    if (holdingRows.length > 0) {
      await supabase
        .from('holdings')
        .upsert(holdingRows, { onConflict: 'account_id,security_id' })
    }
  } catch {
    // Institution/item doesn't support investments — fine
  }

  // ---- 6. Persist cursor + sync time ----
  await supabase
    .from('plaid_items')
    .update({ sync_cursor: cursor, last_synced_at: new Date().toISOString(), status: 'good' })
    .eq('id', item.id)

  return { added: added.length, modified: modified.length, removed: removed.length }
}
