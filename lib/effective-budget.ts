import type { SupabaseClient } from '@supabase/supabase-js'

export interface BudgetRow {
  id: string
  category_id: string
  amount: number
  month: string // YYYY-MM-01
  auto_revert?: boolean
  [key: string]: unknown
}

/**
 * Budgets are effective-dated: setting an amount for a month makes it apply
 * to that month and every month after, until a later row for the same
 * category supersedes it. This picks, per category, the row whose `month`
 * is the latest one at or before the target month.
 */
export function effectiveBudgetsForMonth<T extends BudgetRow>(rows: T[], targetMonth: string): T[] {
  const targetStart = `${targetMonth}-01`
  const byCategory = new Map<string, T>()
  for (const row of rows) {
    if (row.month > targetStart) continue
    const current = byCategory.get(row.category_id)
    if (!current || row.month > current.month) {
      byCategory.set(row.category_id, row)
    }
  }
  return [...byCategory.values()]
}

/** "YYYY-MM" for the month after the given "YYYY-MM". */
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1) // m is 1-indexed here, so this lands on next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Deletes a consecutive chain of auto-written stop rows for `categoryId`
 * starting at `fromMonth`, stopping at the first month with no row or an
 * explicit (non-auto) row. Used when a user opts an earlier month into
 * "apply to all upcoming months" — clears the bookkeeping rows that would
 * otherwise block the new amount from carrying forward, without ever
 * touching a month the user set on purpose.
 */
export async function reclaimAutoRevertChain(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  fromMonth: string,
  maxMonths = 36
) {
  let month = fromMonth
  for (let i = 0; i < maxMonths; i++) {
    const { data: row } = await supabase
      .from('budgets')
      .select('id, auto_revert')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('month', `${month}-01`)
      .maybeSingle()
    if (!row || !row.auto_revert) break
    await supabase.from('budgets').delete().eq('id', row.id)
    month = nextMonth(month)
  }
}
