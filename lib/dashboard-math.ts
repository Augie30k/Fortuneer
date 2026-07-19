import type {
  CashFlowMonth,
  CategorySpend,
  DashboardRange,
  NetWorthPoint,
} from './types'

// Platform-neutral dashboard aggregation, shared by the web /api/dashboard
// route and the mobile app (which runs the same math over its own RLS
// queries) so both always report identical numbers.

export const LIABILITY_ACCOUNT_TYPES = new Set(['credit', 'loan'])

export const RANGE_MONTHS: Record<DashboardRange, number | null> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
  all: null,
}

export interface DashboardWindows {
  monthStart: string
  prevMonthStart: string
  cashFlowMonths: number
  /** Earliest transaction date needed (covers cash-flow window + last month for deltas) */
  txnStart: string
  /** Earliest balance-snapshot date needed; null = unbounded ('all' range) */
  historyStart: string | null
}

/** The query windows both platforms must fetch to feed buildDashboardSummary. */
export function dashboardWindows(range: DashboardRange, now = new Date()): DashboardWindows {
  const rangeMonths = RANGE_MONTHS[range]
  const monthStart = `${now.toISOString().slice(0, 7)}-01`
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10)

  // Cash-flow window: the selected range (capped 12 for chart legibility), min 3 bars
  const cashFlowMonths = Math.min(12, Math.max(3, rangeMonths ?? 12))
  const txnWindowStart = new Date(now.getFullYear(), now.getMonth() - (cashFlowMonths - 1), 1)
    .toISOString()
    .slice(0, 10)
  const txnStart = txnWindowStart < prevMonthStart ? txnWindowStart : prevMonthStart

  const historyStart = rangeMonths
    ? new Date(now.getFullYear(), now.getMonth() - rangeMonths, now.getDate())
        .toISOString()
        .slice(0, 10)
    : null

  return { monthStart, prevMonthStart, cashFlowMonths, txnStart, historyStart }
}

export interface DashboardAccountRow {
  id: string
  type: string
  balance: number
}

export interface DashboardTxnRow {
  amount: number
  date: string
  category_id: string | null
}

export interface SnapshotRow {
  account_id: string
  balance: number
  date: string
}

export interface CategoryMetaRow {
  id: string
  name: string
  icon: string | null
  color: string | null
  is_transfer: boolean
  is_income: boolean
}

export interface DashboardSummary {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  monthlySpending: number
  prevMonthIncome: number
  prevMonthSpending: number
  prevToDateSpending: number
  netWorthHistory: NetWorthPoint[]
  cashFlow: CashFlowMonth[]
  spendingByCategory: CategorySpend[]
}

export function buildDashboardSummary(input: {
  accounts: DashboardAccountRow[]
  transactions: DashboardTxnRow[]
  snapshots: SnapshotRow[]
  categories: CategoryMetaRow[]
  cashFlowMonths: number
  now?: Date
}): DashboardSummary {
  const { accounts, transactions, snapshots, categories, cashFlowMonths } = input
  const now = input.now ?? new Date()
  const monthStart = `${now.toISOString().slice(0, 7)}-01`
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10)

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const isTransfer = (categoryId: string | null) =>
    categoryId ? (categoryById.get(categoryId)?.is_transfer ?? false) : false

  // ---- Current totals ----
  let totalAssets = 0
  let totalLiabilities = 0
  for (const a of accounts) {
    if (LIABILITY_ACCOUNT_TYPES.has(a.type)) totalLiabilities += Number(a.balance)
    else totalAssets += Number(a.balance)
  }
  const netWorth = totalAssets - totalLiabilities

  // ---- This month + previous month income/spending (transfers excluded) ----
  // "Same point last month" cutoff for fair spending comparisons
  const dayOfMonth = now.getDate()
  const prevCutoff = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth + 1)
    .toISOString()
    .slice(0, 10)

  let monthlyIncome = 0
  let monthlySpending = 0
  let prevMonthIncome = 0
  let prevMonthSpending = 0
  let prevToDateSpending = 0
  for (const t of transactions) {
    if (isTransfer(t.category_id)) continue
    const amount = Number(t.amount)
    if (t.date >= monthStart) {
      if (amount < 0) monthlyIncome += -amount
      else monthlySpending += amount
    } else if (t.date >= prevMonthStart && t.date < monthStart) {
      if (amount < 0) prevMonthIncome += -amount
      else {
        prevMonthSpending += amount
        if (t.date < prevCutoff) prevToDateSpending += amount
      }
    }
  }

  // ---- Net worth history: forward-fill each account's last known balance ----
  const accountType = new Map(accounts.map((a) => [a.id, a.type]))
  const lastBalance = new Map<string, number>()
  const byDate = new Map<string, SnapshotRow[]>()
  for (const s of snapshots) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date)!.push(s)
  }
  const netWorthHistory = [...byDate.keys()].sort().map((date) => {
    for (const s of byDate.get(date)!) lastBalance.set(s.account_id, Number(s.balance))
    let assets = 0
    let liabilities = 0
    for (const [accountId, balance] of lastBalance) {
      if (LIABILITY_ACCOUNT_TYPES.has(accountType.get(accountId) ?? '')) liabilities += balance
      else assets += balance
    }
    return { date, assets, liabilities, netWorth: assets - liabilities }
  })

  // ---- Cash flow by month over the selected window (transfers excluded) ----
  const cashFlowMap = new Map<string, { income: number; expenses: number }>()
  for (let i = cashFlowMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    cashFlowMap.set(d.toISOString().slice(0, 7), { income: 0, expenses: 0 })
  }
  for (const t of transactions) {
    if (isTransfer(t.category_id)) continue
    const bucket = cashFlowMap.get(t.date.slice(0, 7))
    if (!bucket) continue
    const amount = Number(t.amount)
    if (amount < 0) bucket.income += -amount
    else bucket.expenses += amount
  }
  const cashFlow = [...cashFlowMap.entries()].map(([month, v]) => ({ month, ...v }))

  // ---- Spending by category, current month ----
  const spendMap = new Map<string, number>()
  for (const t of transactions) {
    const amount = Number(t.amount)
    if (t.date < monthStart || amount <= 0 || !t.category_id || isTransfer(t.category_id))
      continue
    spendMap.set(t.category_id, (spendMap.get(t.category_id) ?? 0) + amount)
  }
  const spendingByCategory = [...spendMap.entries()]
    .map(([categoryId, amount]) => {
      const c = categoryById.get(categoryId)
      return {
        categoryId,
        name: c?.name ?? 'Other',
        color: c?.color ?? null,
        icon: c?.icon ?? null,
        amount,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  return {
    netWorth,
    totalAssets,
    totalLiabilities,
    monthlyIncome,
    monthlySpending,
    prevMonthIncome,
    prevMonthSpending,
    prevToDateSpending,
    netWorthHistory,
    cashFlow,
    spendingByCategory,
  }
}
