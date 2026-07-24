import {
  accrueManualAccounts,
  buildDashboardSummary,
  buildReportsData,
  computeMonthActuals,
  contributionsByGoalForMonth,
  crystallizeElapsedGoalMonths,
  dashboardWindows,
  detectRecurringStreams,
  effectiveBudgetsForMonth,
  goalAllocationsForMonth,
  monthBounds,
  type AccountWithItem,
  type BudgetTxnRow,
  type BudgetWithSpend,
  type Category,
  type CategoryMetaRow,
  type DashboardAccountRow,
  type DashboardRange,
  type DashboardSummary,
  type DashboardTxnRow,
  type Goal,
  type Holding,
  type LifeEvent,
  type ProjectionAssumptions,
  type ProjectionScenario,
  type RecurringStream,
  type RecurringTxnRow,
  type ReportGroupBy,
  type ReportTxnRow,
  type ReportsData,
  type SnapshotRow,
  type TransactionWithRefs,
} from '@fortuneer/shared'

import { supabase } from './supabase'

// Every loader here mirrors a web /api route: same queries, same shared
// math, so both platforms report identical numbers — mobile just runs it
// client-side over RLS instead of behind a server route.

const TXN_JOIN = '*, accounts(name, mask), categories(name, icon, color, is_income, is_transfer)'

export interface MobileDashboardData extends DashboardSummary {
  range: DashboardRange
  accounts: AccountWithItem[]
  recentTransactions: TransactionWithRefs[]
}

export async function loadDashboard(userId: string, range: DashboardRange): Promise<MobileDashboardData> {
  try {
    await accrueManualAccounts(supabase, userId)
  } catch {
    // Accrual is best-effort on mobile; balances just stay a period behind.
  }

  const now = new Date()
  const { cashFlowMonths, txnStart, historyStart } = dashboardWindows(range, now)

  let snapshotQuery = supabase
    .from('balance_snapshots')
    .select('account_id, balance, date')
    .order('date')
  if (historyStart) snapshotQuery = snapshotQuery.gte('date', historyStart)

  const [accountsRes, txnsRes, snapshotsRes, categoriesRes, recentRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*, plaid_items(institution_name, logo_url, last_synced_at, status)')
      .eq('hidden', false)
      .order('balance', { ascending: false }),
    supabase.from('transactions').select('amount, date, category_id').gte('date', txnStart),
    snapshotQuery,
    supabase.from('categories').select('id, name, icon, color, is_transfer, is_income'),
    supabase
      .from('transactions')
      .select(TXN_JOIN)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  for (const res of [accountsRes, txnsRes, snapshotsRes, categoriesRes, recentRes]) {
    if (res.error) throw res.error
  }

  const accounts = (accountsRes.data ?? []) as AccountWithItem[]
  const summary = buildDashboardSummary({
    accounts,
    transactions: (txnsRes.data ?? []) as DashboardTxnRow[],
    snapshots: (snapshotsRes.data ?? []) as SnapshotRow[],
    categories: (categoriesRes.data ?? []) as CategoryMetaRow[],
    cashFlowMonths,
    now,
  })

  return {
    range,
    ...summary,
    accounts,
    recentTransactions: (recentRes.data ?? []) as TransactionWithRefs[],
  }
}

export async function loadRecurring(): Promise<{ streams: RecurringStream[]; monthlyTotal: number }> {
  const oneYearAgo = new Date(Date.now() - 370 * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, date, description, merchant_name, logo_url, categories(name, icon, color, is_transfer)')
    .gt('amount', 0)
    .eq('pending', false)
    .gte('date', oneYearAgo)
    .order('date')
  if (error) throw error

  const rows: RecurringTxnRow[] = (data ?? []).map((t) => ({
    amount: t.amount,
    date: t.date,
    description: t.description,
    merchant_name: t.merchant_name,
    logo_url: t.logo_url,
    category: t.categories as unknown as RecurringTxnRow['category'],
  }))
  return detectRecurringStreams(rows)
}

export async function loadReports(opts: {
  start: string
  end: string
  groupBy: ReportGroupBy
  accountId?: string | null
}): Promise<ReportsData> {
  let query = supabase
    .from('transactions')
    .select(
      'amount, date, merchant_name, description, category_id, account_id, categories(name, icon, color, is_transfer, is_income), accounts(name)'
    )
    .eq('pending', false)
    .gte('date', opts.start)
    .lte('date', opts.end)
  if (opts.accountId) query = query.eq('account_id', opts.accountId)

  const { data, error } = await query.limit(10000)
  if (error) throw error

  const rows: ReportTxnRow[] = (data ?? []).map((t) => ({
    amount: t.amount,
    merchant_name: t.merchant_name,
    description: t.description,
    category_id: t.category_id,
    account_id: t.account_id,
    category: t.categories as unknown as ReportTxnRow['category'],
    account: t.accounts as unknown as ReportTxnRow['account'],
  }))
  return buildReportsData(rows, { start: opts.start, end: opts.end, groupBy: opts.groupBy })
}

export interface MobileBudgetsData {
  budgets: BudgetWithSpend[]
  income: number
  month: string
  accountCreatedMonth: string
}

export async function loadBudgets(month: string, accountCreatedAt: string): Promise<MobileBudgetsData> {
  const { start, end } = monthBounds(month)

  const [budgetsRes, txRes] = await Promise.all([
    supabase
      .from('budgets')
      .select('*, categories(name, icon, color, group_name, sort_order, is_income)')
      .lte('month', start),
    supabase
      .from('transactions')
      .select('category_id, amount, categories(is_income, is_transfer)')
      .gte('date', start)
      .lt('date', end),
  ])
  if (budgetsRes.error) throw budgetsRes.error
  if (txRes.error) throw txRes.error

  const { spendByCategory, income } = computeMonthActuals(
    (txRes.data ?? []).map((t) => ({
      category_id: t.category_id,
      amount: t.amount,
      category: t.categories as unknown as BudgetTxnRow['category'],
    }))
  )

  const effective = effectiveBudgetsForMonth(budgetsRes.data ?? [], month)
  const budgets = effective
    .filter((b) => Number(b.amount) > 0)
    .map((b) => ({
      ...(b as Record<string, unknown>),
      category: (b as { categories: BudgetWithSpend['category'] }).categories,
      spent: spendByCategory.get(b.category_id) ?? 0,
    })) as unknown as BudgetWithSpend[]

  budgets.sort((a, b) => {
    const ao = a.category?.sort_order ?? 0
    const bo = b.category?.sort_order ?? 0
    if (ao !== bo) return ao - bo
    return Number(b.amount) - Number(a.amount)
  })

  return { budgets, income, month, accountCreatedMonth: accountCreatedAt.slice(0, 7) }
}

export async function loadGoals(userId: string, month?: string): Promise<Goal[]> {
  try {
    await crystallizeElapsedGoalMonths(supabase, userId)
  } catch {
    // Auto-save catch-up is best-effort; the web app will reconcile.
  }

  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!month) return (goals ?? []) as Goal[]

  const goalIds = (goals ?? []).map((g) => g.id)
  const [contributions, allocations] = await Promise.all([
    contributionsByGoalForMonth(supabase, userId, goalIds, month),
    goalAllocationsForMonth(supabase, userId, goalIds, month),
  ])
  return (goals ?? []).map((g) => ({
    ...g,
    contributions_this_month: contributions.get(g.id) ?? 0,
    monthly_allocation: allocations.has(g.id) ? allocations.get(g.id) : null,
  })) as Goal[]
}

export async function loadAccounts(userId: string): Promise<AccountWithItem[]> {
  try {
    await accrueManualAccounts(supabase, userId)
  } catch {
    // Best-effort, same as the dashboard.
  }
  const { data, error } = await supabase
    .from('accounts')
    .select('*, plaid_items(institution_name, logo_url, last_synced_at, status)')
    .order('balance', { ascending: false })
  if (error) throw error
  return (data ?? []) as AccountWithItem[]
}

export interface AccountDetail {
  account: AccountWithItem
  snapshots: SnapshotRow[]
  transactions: TransactionWithRefs[]
}

export async function loadAccountDetail(accountId: string): Promise<AccountDetail> {
  const [accountRes, snapshotsRes, txnsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*, plaid_items(institution_name, logo_url, last_synced_at, status)')
      .eq('id', accountId)
      .single(),
    supabase
      .from('balance_snapshots')
      .select('account_id, balance, date')
      .eq('account_id', accountId)
      .order('date'),
    supabase
      .from('transactions')
      .select(TXN_JOIN)
      .eq('account_id', accountId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(25),
  ])
  if (accountRes.error) throw accountRes.error
  if (snapshotsRes.error) throw snapshotsRes.error
  if (txnsRes.error) throw txnsRes.error
  return {
    account: accountRes.data as AccountWithItem,
    snapshots: (snapshotsRes.data ?? []) as SnapshotRow[],
    transactions: (txnsRes.data ?? []) as TransactionWithRefs[],
  }
}

export interface TransactionFilters {
  q?: string
  accountId?: string | null
  categoryId?: string | null
  startDate?: string
  endDate?: string
}

export const TXN_PAGE_SIZE = 50

/** Same filter semantics as web GET /api/transactions. */
export async function loadTransactions(
  filters: TransactionFilters,
  offset = 0
): Promise<{ transactions: TransactionWithRefs[]; total: number }> {
  let query = supabase
    .from('transactions')
    .select(TXN_JOIN, { count: 'exact' })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.q) {
    const escaped = filters.q.replace(/[%_,()]/g, '')
    query = query.or(`description.ilike.%${escaped}%,merchant_name.ilike.%${escaped}%`)
  }
  if (filters.accountId) query = query.eq('account_id', filters.accountId)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.startDate) query = query.gte('date', filters.startDate)
  if (filters.endDate) query = query.lte('date', filters.endDate)

  const { data, error, count } = await query.range(offset, offset + TXN_PAGE_SIZE - 1)
  if (error) throw error
  return { transactions: (data ?? []) as TransactionWithRefs[], total: count ?? 0 }
}

/** Global + own categories, with personally-forked shared rows hidden —
 *  same visibility rule as web GET /api/categories. */
export async function loadCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name')
  if (error) throw error

  const forkedFromIds = new Set((data ?? []).filter((c) => c.forked_from).map((c) => c.forked_from))
  return ((data ?? []) as Category[]).filter(
    (c) => !(c.user_id === null && forkedFromIds.has(c.id))
  )
}

export interface HoldingWithAccount extends Holding {
  accounts?: { name: string; mask: string | null } | null
}

export async function loadHoldings(): Promise<HoldingWithAccount[]> {
  const { data, error } = await supabase
    .from('holdings')
    .select('*, accounts(name, mask)')
    .order('value', { ascending: false })
  if (error) throw error
  return (data ?? []) as HoldingWithAccount[]
}

export interface ProjectionsData {
  /** Seed inputs for a fresh scenario (same math as web's /api/dashboard) */
  netWorth: number
  cashFlow: { month: string; income: number; expenses: number }[]
  /** Most recently updated saved scenario, if any */
  scenario: ProjectionScenario | null
}

/** Seed data + saved scenario for the Projections screen. Mirrors the web
 *  page, which seeds from /api/dashboard and loads /api/projections. */
export async function loadProjections(): Promise<ProjectionsData> {
  const now = new Date()
  const txnStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10)

  const [accountsRes, txnsRes, categoriesRes, scenarioRes] = await Promise.all([
    supabase.from('accounts').select('id, type, balance').eq('hidden', false),
    supabase.from('transactions').select('amount, date, category_id').gte('date', txnStart),
    supabase.from('categories').select('id, name, icon, color, is_transfer, is_income'),
    supabase
      .from('projection_scenarios')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1),
  ])
  for (const res of [accountsRes, txnsRes, categoriesRes, scenarioRes]) {
    if (res.error) throw res.error
  }

  const summary = buildDashboardSummary({
    accounts: (accountsRes.data ?? []) as DashboardAccountRow[],
    transactions: (txnsRes.data ?? []) as DashboardTxnRow[],
    snapshots: [],
    categories: (categoriesRes.data ?? []) as CategoryMetaRow[],
    cashFlowMonths: 12,
    now,
  })

  return {
    netWorth: summary.netWorth,
    cashFlow: summary.cashFlow,
    scenario: (scenarioRes.data?.[0] as ProjectionScenario | undefined) ?? null,
  }
}

/** Create or update the scenario; returns the saved row. */
export async function saveProjectionScenario(
  userId: string,
  scenario: {
    id: string | null
    name: string
    assumptions: ProjectionAssumptions
    events: LifeEvent[]
  }
): Promise<ProjectionScenario> {
  const payload = {
    name: scenario.name.trim().slice(0, 80) || 'My trajectory',
    assumptions: scenario.assumptions,
    events: scenario.events,
    updated_at: new Date().toISOString(),
  }
  const query = scenario.id
    ? supabase
        .from('projection_scenarios')
        .update(payload)
        .eq('id', scenario.id)
        .eq('user_id', userId)
    : supabase.from('projection_scenarios').insert({ user_id: userId, ...payload })

  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data as ProjectionScenario
}

export interface SupportRequest {
  id: string
  kind: 'support' | 'feature'
  subject: string
  message: string
  status: 'open' | 'closed'
  created_at: string
}

export async function loadSupportRequests(): Promise<SupportRequest[]> {
  const { data, error } = await supabase
    .from('support_requests')
    .select('id, kind, subject, message, status, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SupportRequest[]
}

export async function submitSupportRequest(
  userId: string,
  kind: 'support' | 'feature',
  subject: string,
  message: string
): Promise<SupportRequest> {
  const { data, error } = await supabase
    .from('support_requests')
    .insert({ user_id: userId, kind, subject: subject.slice(0, 200), message: message.slice(0, 5000) })
    .select('id, kind, subject, message, status, created_at')
    .single()
  if (error) throw error
  return data as SupportRequest
}
