import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { SankeyData } from '@/lib/types'

/**
 * GET /api/reports?start&end&groupBy=category|merchant|account&accountId=
 * Totals, grouped spending breakdown, and Sankey (income sources -> budget -> categories).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const defaultStart = `${now.toISOString().slice(0, 7)}-01`
    const start = searchParams.get('start') ?? defaultStart
    const end = searchParams.get('end') ?? now.toISOString().slice(0, 10)
    const groupByParam = searchParams.get('groupBy')
    const groupBy = ['category', 'merchant', 'account'].includes(groupByParam ?? '')
      ? (groupByParam as 'category' | 'merchant' | 'account')
      : 'category'
    const accountId = searchParams.get('accountId')

    let query = supabase
      .from('transactions')
      .select(
        'amount, date, merchant_name, description, category_id, account_id, categories(name, icon, color, is_transfer, is_income), accounts(name)'
      )
      .eq('user_id', user.id)
      .eq('pending', false)
      .gte('date', start)
      .lte('date', end)

    if (accountId) query = query.eq('account_id', accountId)

    const { data: transactions, error } = await query.limit(10000)
    if (error) throw error

    type Row = NonNullable<typeof transactions>[number]
    const cat = (t: Row) =>
      t.categories as unknown as {
        name: string
        icon: string | null
        color: string | null
        is_transfer: boolean
        is_income: boolean
      } | null
    const acct = (t: Row) => t.accounts as unknown as { name: string } | null

    let income = 0
    let expenses = 0
    type GroupAgg = {
      name: string
      icon: string | null
      color: string | null
      amount: number
      count: number
    }
    const groups = new Map<string, GroupAgg>()
    const incomeGroups = new Map<string, GroupAgg>()
    const incomeSources = new Map<
      string,
      { amount: number; color: string | null; categoryId?: string; merchantName?: string }
    >()
    const expenseCats = new Map<
      string,
      { name: string; color: string | null; amount: number; categoryId?: string }
    >()

    const groupKey = (t: Row, c: ReturnType<typeof cat>, magnitude: number) => {
      if (groupBy === 'category') {
        return {
          key: t.category_id ?? 'uncategorized',
          name: c?.name ?? (magnitude < 0 ? 'Income' : 'Uncategorized'),
          icon: c?.icon ?? null,
          color: c?.color ?? null,
        }
      }
      if (groupBy === 'merchant') {
        const name = t.merchant_name ?? t.description ?? 'Unknown'
        return { key: name.toLowerCase(), name, icon: c?.icon ?? null, color: c?.color ?? null }
      }
      return { key: t.account_id, name: acct(t)?.name ?? 'Account', icon: null, color: null }
    }

    for (const t of transactions ?? []) {
      const c = cat(t)
      if (c?.is_transfer) continue
      const amount = Number(t.amount)

      if (amount < 0) {
        income += -amount
        const isMerchantDerived = !!c?.is_income
        const source = isMerchantDerived
          ? (t.merchant_name ?? t.description ?? 'Income')
          : (c?.name ?? 'Income')
        const existingSource = incomeSources.get(source)
        incomeSources.set(source, {
          amount: (existingSource?.amount ?? 0) + -amount,
          color: existingSource?.color ?? c?.color ?? null,
          categoryId: isMerchantDerived ? undefined : (t.category_id ?? undefined),
          merchantName: isMerchantDerived ? source : undefined,
        })

        const { key, name, icon, color } = groupKey(t, c, amount)
        const existing = incomeGroups.get(key)
        if (existing) {
          existing.amount += -amount
          existing.count += 1
        } else {
          incomeGroups.set(key, { name, icon, color, amount: -amount, count: 1 })
        }
        continue
      }

      expenses += amount
      const catName = c?.name ?? 'Uncategorized'
      const catKey = t.category_id ?? `uncat:${catName}`
      expenseCats.set(catKey, {
        name: catName,
        color: c?.color ?? null,
        categoryId: t.category_id ?? undefined,
        amount: (expenseCats.get(catKey)?.amount ?? 0) + amount,
      })

      const { key, name, icon, color } = groupKey(t, c, amount)
      const existing = groups.get(key)
      if (existing) {
        existing.amount += amount
        existing.count += 1
      } else {
        groups.set(key, { name, icon, color, amount, count: 1 })
      }
    }

    const sortedGroups = [...groups.entries()]
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50)

    const sortedIncomeGroups = [...incomeGroups.entries()]
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50)

    // ---- Sankey: income sources -> Budget -> expense categories (+ Saved) ----
    const sankey: SankeyData = { nodes: [], links: [] }
    const nodeIndex = new Map<string, number>()
    // Nodes dedupe by a side-scoped key, not display name: a category with both
    // spending and a refund in the period would otherwise collapse into one node
    // linked both into and out of the hub — a cycle, which recharts' depth
    // recursion has no guard against (stack overflow).
    const addNode = (
      key: string,
      name: string,
      color: string | null,
      extra?: { categoryId?: string; merchantName?: string }
    ) => {
      if (nodeIndex.has(key)) return nodeIndex.get(key)!
      nodeIndex.set(key, sankey.nodes.length)
      sankey.nodes.push({ name, color, ...extra })
      return sankey.nodes.length - 1
    }

    if (income > 0 || expenses > 0) {
      // Colored (bluish-violet, not neutral gray) so every ribbon stays
      // colorful edge-to-edge and the hub reads as a distinct pass-through point
      const hub = addNode('hub', 'Budget', 'var(--chart-hub)')

      const topSources = [...incomeSources.entries()].sort((a, b) => b[1].amount - a[1].amount)
      const shownSources = topSources.slice(0, 5)
      const otherIncome = topSources.slice(5).reduce((s, [, v]) => s + v.amount, 0)
      for (const [name, { amount, color, categoryId, merchantName }] of shownSources) {
        sankey.links.push({
          source: addNode(`in:${name}`, name, color ?? '#248A3D', { categoryId, merchantName }),
          target: hub,
          value: amount,
        })
      }
      if (otherIncome > 0) {
        sankey.links.push({ source: addNode('other-income', 'Other income', '#248A3D'), target: hub, value: otherIncome })
      }

      // The DB's category colors happen to cluster heavily in the blue/indigo/
      // teal family (Transportation, Travel, Services, Rent, Loan Payments all
      // read blue-ish), which flattens the right side of the diagram. Override
      // with a diverse, CVD-validated 7-hue set assigned by rank instead —
      // "Other" and "Saved" keep their own fixed colors outside this rotation.
      const EXPENSE_PALETTE = [
        '#FF9500', // orange
        '#FF375F', // pink/red
        '#AF52DE', // purple
        '#E8A200', // amber
        '#30B0C7', // teal
        '#0A84FF', // blue (appears once, not forced)
        '#C2703D', // terracotta
      ]

      const topCats = [...expenseCats.entries()].sort((a, b) => b[1].amount - a[1].amount)
      const shownCats = topCats.slice(0, EXPENSE_PALETTE.length)
      const otherExpense = topCats.slice(EXPENSE_PALETTE.length).reduce((s, [, v]) => s + v.amount, 0)
      shownCats.forEach(([, { name, amount, categoryId }], i) => {
        sankey.links.push({
          source: hub,
          target: addNode(`out:${name}`, name, EXPENSE_PALETTE[i % EXPENSE_PALETTE.length], { categoryId }),
          value: amount,
        })
      })
      if (otherExpense > 0) {
        sankey.links.push({ source: hub, target: addNode('other-expense', 'Other', '#8E8E93'), value: otherExpense })
      }
      const saved = income - expenses
      if (saved > 0.005) {
        sankey.links.push({ source: hub, target: addNode('saved', 'Saved', '#0071E3'), value: saved })
      }
    }

    return NextResponse.json({
      start,
      end,
      income,
      expenses,
      net: income - expenses,
      groups: sortedGroups,
      incomeGroups: sortedIncomeGroups,
      sankey,
    })
  } catch (error) {
    console.error('Error building report:', error)
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 })
  }
}
