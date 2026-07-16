import { Banknote, CreditCard, Landmark, TrendingUp, Wallet } from 'lucide-react'
import type { AccountType } from './types'

export const TYPE_META: Record<
  AccountType,
  { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }
> = {
  depository: { label: 'Cash', icon: Banknote, color: '#248A3D' },
  credit: { label: 'Credit cards', icon: CreditCard, color: '#FF9500' },
  investment: { label: 'Investments', icon: TrendingUp, color: '#0071E3' },
  loan: { label: 'Loans', icon: Landmark, color: '#AF52DE' },
  other: { label: 'Other', icon: Wallet, color: '#8E8E93' },
}

export const TYPE_ORDER: AccountType[] = ['depository', 'credit', 'investment', 'loan', 'other']
export const LIABILITY_TYPES = new Set<AccountType>(['credit', 'loan'])

/** Finer-grained labels for the two catch-all types, stored in the existing
 *  free-text `subtype` column — no new AccountType needed. Optional: picking
 *  none just leaves the account as a plain "Other"/"Loan". */
export const SUBTYPE_OPTIONS: Partial<Record<AccountType, string[]>> = {
  other: ['Real estate', 'Vehicle', 'Other asset'],
  loan: ['Mortgage', 'Auto loan', 'Student loan', 'Other liability'],
}

export const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const
