// Database types for Fortuneer v1
// These align with the Supabase schema

export interface User {
  id: string
  email: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'other'
  balance: number
  currency: string
  plaid_account_id?: string
  plaid_access_token?: string
  is_connected: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  created_at: string
}

export interface Transaction {
  id: string
  account_id: string
  category_id?: string
  amount: number
  description: string
  date: string
  type: 'debit' | 'credit'
  plaid_transaction_id?: string
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id?: string
  name: string
  amount: number
  period: 'monthly' | 'yearly' | 'custom'
  start_date: string
  end_date?: string
  created_at: string
  spent?: number
}

export interface DashboardMetrics {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  monthlySpending: number
  accountsCount: number
  transactionsCount: number
}
