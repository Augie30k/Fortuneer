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
  const { data: categories } = await supabase
    .from('categories')
    .select('id, plaid_pfc')
    .is('user_id', null)

  const pfcToCategory = new Map<string, string>()
  for (const c of categories ?? []) {
    if (c.plaid_pfc) pfcToCategory.set(c.plaid_pfc, c.id)
  }
  const fallbackCategory = pfcToCategory.get('OTHER') ?? null

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
          pfcToCategory.get(t.personal_finance_category?.primary ?? '') ?? fallbackCategory,
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

  // ---- 6. Persist cursor + sync time ----
  await supabase
    .from('plaid_items')
    .update({ sync_cursor: cursor, last_synced_at: new Date().toISOString(), status: 'good' })
    .eq('id', item.id)

  return { added: added.length, modified: modified.length, removed: removed.length }
}
