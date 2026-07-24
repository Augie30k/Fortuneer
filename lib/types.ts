// Database types aligned with supabase/migrations/001_core_schema.sql
// Money convention follows Plaid: transaction.amount > 0 is money OUT, < 0 is money IN.

export type Persona = 'debt' | 'saving' | 'budgeting' | 'overview' | 'investing'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  preferred_name: string | null
  currency: string
  status: 'pending' | 'active' | 'blocked'
  persona: Persona | null
  focus_areas: string[]
  onboarded_at: string | null
  terms_accepted_at: string | null
  terms_version: string | null
  created_at: string
}

export interface PlaidItem {
  id: string
  user_id: string
  item_id: string
  institution_id: string | null
  institution_name: string | null
  logo_url: string | null
  status: string
  last_synced_at: string | null
  created_at: string
}

export type AccountType = 'depository' | 'credit' | 'loan' | 'investment' | 'other'

export interface Account {
  id: string
  user_id: string
  plaid_item_id: string | null
  plaid_account_id: string | null
  name: string
  official_name: string | null
  mask: string | null
  type: AccountType
  subtype: string | null
  balance: number
  available_balance: number | null
  currency: string
  is_manual: boolean
  hidden: boolean
  /** Manual accounts only: annual yield %, auto-compounded at compound_frequency */
  apy: number
  compound_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  last_accrued_at: string
  created_at: string
  updated_at: string
}

export interface Holding {
  id: string
  user_id: string
  account_id: string
  security_id: string
  name: string | null
  ticker: string | null
  type: string | null
  quantity: number
  price: number | null
  value: number
  cost_basis: number | null
  currency: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string | null
  color: string | null
  plaid_pfc: string | null
  is_income: boolean
  is_transfer: boolean
  group_name: string
  sort_order: number
  /** Set on personal forks of a shared category; hides the original from lists */
  forked_from: string | null
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  plaid_transaction_id: string | null
  amount: number
  description: string
  merchant_name: string | null
  logo_url: string | null
  date: string
  pending: boolean
  notes: string | null
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  /** First-of-month this amount takes effect; applies forward until a later month overrides it */
  month: string
  /** True if this row was written automatically to stop a single-month edit from bleeding forward */
  auto_revert: boolean
  created_at: string
}

export interface BalanceSnapshot {
  id: string
  user_id: string
  account_id: string
  balance: number
  date: string
}

export interface Rule {
  id: string
  user_id: string
  matcher: string
  match_field: 'merchant' | 'description'
  /** 'contains' matches the text anywhere; 'exact' requires the whole field to equal it */
  match_type: 'contains' | 'exact'
  /** Optional amount window (Plaid sign convention); null bound = unbounded */
  amount_min: number | null
  amount_max: number | null
  category_id: string
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  target_amount: number
  saved_amount: number
  target_date: string | null
  created_at: string
  /** Explicit display/fill order — lower renders first and claims auto-save
   *  room first (see lib/goal-math.ts). Drag-to-reorder in the Budgets
   *  page's "Prioritize" mode; new goals default to the back. */
  priority: number
  /** Sum of goal_contributions for a requested month — only present when GET /api/goals?month= is used */
  contributions_this_month?: number
  /** Explicit monthly "budgeted" figure for the requested month, if one has been
   *  set (perpetual or single-month) — falls back to the auto-computed pace
   *  toward target_date when null. Only present when GET /api/goals?month= is used. */
  monthly_allocation?: number | null
}

// ---- API view models ----

export interface RuleWithCategory extends Rule {
  categories?: Pick<Category, 'name' | 'icon' | 'color'> | null
}

export interface PlaidItemSummary {
  id: string
  institution_name: string | null
  institution_id: string | null
  status: string
  last_synced_at: string | null
  created_at: string
  account_count: number
}

export interface ReportGroup {
  key: string
  name: string
  icon: string | null
  color: string | null
  amount: number
  count: number
}

export interface SankeyNodeData {
  name: string
  color: string | null
  /** Set on category nodes — click-to-filter targets this category's transactions */
  categoryId?: string
  /** Set on merchant-derived income-source nodes with no stable category */
  merchantName?: string
}

export interface SankeyData {
  nodes: SankeyNodeData[]
  links: { source: number; target: number; value: number }[]
}

export interface ReportsData {
  start: string
  end: string
  income: number
  expenses: number
  net: number
  groups: ReportGroup[]
  incomeGroups: ReportGroup[]
  sankey: SankeyData
}

export interface AccountWithItem extends Account {
  plaid_items?: Pick<PlaidItem, 'institution_name' | 'logo_url' | 'last_synced_at' | 'status'> | null
}

export interface TransactionWithRefs extends Transaction {
  accounts?: Pick<Account, 'name' | 'mask'> | null
  categories?: Pick<Category, 'name' | 'icon' | 'color' | 'is_income' | 'is_transfer'> | null
}

export interface BudgetWithSpend extends Budget {
  category: Pick<Category, 'name' | 'icon' | 'color' | 'group_name' | 'sort_order' | 'is_income'>
  spent: number
}

export interface RecurringStream {
  key: string
  name: string
  logo_url: string | null
  category?: Pick<Category, 'name' | 'icon' | 'color'> | null
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  averageAmount: number
  lastAmount: number
  lastDate: string
  nextDate: string
  occurrences: number
}

export interface CashFlowMonth {
  month: string // YYYY-MM
  income: number
  expenses: number
}

export interface CategorySpend {
  categoryId: string
  name: string
  color: string | null
  icon: string | null
  amount: number
}

export interface NetWorthPoint {
  date: string
  assets: number
  liabilities: number
  netWorth: number
}

export type DashboardRange = '1m' | '3m' | '6m' | '1y' | 'all'

export interface DashboardData {
  range: DashboardRange
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  monthlySpending: number
  /** Same metrics for the previous calendar month, for deltas */
  prevMonthIncome: number
  prevMonthSpending: number
  /** Previous month's spending up to the same day-of-month, for fair comparison */
  prevToDateSpending: number
  netWorthHistory: NetWorthPoint[]
  cashFlow: CashFlowMonth[]
  spendingByCategory: CategorySpend[]
  recentTransactions: TransactionWithRefs[]
  accounts: AccountWithItem[]
}
