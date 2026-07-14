// Database types aligned with supabase/migrations/001_core_schema.sql
// Money convention follows Plaid: transaction.amount > 0 is money OUT, < 0 is money IN.

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  currency: string
  created_at: string
}

export interface PlaidItem {
  id: string
  user_id: string
  item_id: string
  institution_id: string | null
  institution_name: string | null
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
  created_at: string
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
  created_at: string
}

export interface BalanceSnapshot {
  id: string
  user_id: string
  account_id: string
  balance: number
  date: string
}

// ---- API view models ----

export interface AccountWithItem extends Account {
  plaid_items?: Pick<PlaidItem, 'institution_name' | 'last_synced_at' | 'status'> | null
}

export interface TransactionWithRefs extends Transaction {
  accounts?: Pick<Account, 'name' | 'mask'> | null
  categories?: Pick<Category, 'name' | 'icon' | 'color' | 'is_income' | 'is_transfer'> | null
}

export interface BudgetWithSpend extends Budget {
  category: Pick<Category, 'name' | 'icon' | 'color'>
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

export interface DashboardData {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  monthlySpending: number
  netWorthHistory: NetWorthPoint[]
  cashFlow: CashFlowMonth[]
  spendingByCategory: CategorySpend[]
  recentTransactions: TransactionWithRefs[]
  accounts: AccountWithItem[]
}
