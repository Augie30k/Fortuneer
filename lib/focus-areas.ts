import { ChartPie, PiggyBank, Repeat, Target, Telescope, TrendingUp } from 'lucide-react'

/** Sidebar areas a user can pin to the top of the nav — chosen at onboarding
 *  and editable anytime in Settings. Keys match the routes' path segments;
 *  the array order the user picks is the order they appear in the sidebar. */
export const FOCUS_AREAS = [
  { key: 'budgets', label: 'Budgets', icon: PiggyBank },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'recurring', label: 'Recurring bills', icon: Repeat },
  { key: 'investments', label: 'Investments', icon: TrendingUp },
  { key: 'reports', label: 'Reports', icon: ChartPie },
  { key: 'projections', label: 'Projections', icon: Telescope },
] as const

export const MAX_FOCUS = 3
