import type { ReportsData, SankeyData } from './types'

// Platform-neutral reports aggregation, shared by the web /api/reports route
// and the mobile app so both compute identical breakdowns.

export type ReportGroupBy = 'category' | 'merchant' | 'account'

export interface ReportTxnRow {
  amount: number
  merchant_name: string | null
  description: string | null
  category_id: string | null
  account_id: string
  category?: {
    name: string
    icon: string | null
    color: string | null
    is_transfer: boolean
    is_income: boolean
  } | null
  account?: { name: string } | null
}

export function buildReportsData(
  rows: ReportTxnRow[],
  opts: { start: string; end: string; groupBy: ReportGroupBy }
): ReportsData {
  const { start, end, groupBy } = opts

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

  const groupKey = (t: ReportTxnRow, magnitude: number) => {
    const c = t.category
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
    return { key: t.account_id, name: t.account?.name ?? 'Account', icon: null, color: null }
  }

  for (const t of rows) {
    const c = t.category
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

      const { key, name, icon, color } = groupKey(t, amount)
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

    const { key, name, icon, color } = groupKey(t, amount)
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

  return {
    start,
    end,
    income,
    expenses,
    net: income - expenses,
    groups: sortedGroups,
    incomeGroups: sortedIncomeGroups,
    sankey,
  }
}
