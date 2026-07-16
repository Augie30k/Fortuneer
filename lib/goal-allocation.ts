import type { SupabaseClient } from '@supabase/supabase-js'
import { nextMonth } from './effective-budget'

interface GoalAllocationRow {
  id: string
  goal_id: string
  amount: number
  month: string // YYYY-MM-01
  auto_revert?: boolean
  [key: string]: unknown
}

/**
 * Goal allocations are effective-dated exactly like budgets: setting an
 * amount for a month makes it apply to that month and every month after,
 * until a later row for the same goal supersedes it.
 */
function effectiveGoalAllocationsForMonth<T extends GoalAllocationRow>(
  rows: T[],
  targetMonth: string
): T[] {
  const targetStart = `${targetMonth}-01`
  const byGoal = new Map<string, T>()
  for (const row of rows) {
    if (row.month > targetStart) continue
    const current = byGoal.get(row.goal_id)
    if (!current || row.month > current.month) {
      byGoal.set(row.goal_id, row)
    }
  }
  return [...byGoal.values()]
}

/** Effective monthly_allocation per goal_id for `month` ('YYYY-MM') */
export async function goalAllocationsForMonth(
  supabase: SupabaseClient,
  userId: string,
  goalIds: string[],
  month: string
): Promise<Map<string, number>> {
  const amounts = new Map<string, number>()
  if (goalIds.length === 0) return amounts

  const { data: rows, error } = await supabase
    .from('goal_allocations')
    .select('id, goal_id, amount, month, auto_revert')
    .eq('user_id', userId)
    .in('goal_id', goalIds)
    .lte('month', `${month}-01`)
  if (error) throw error

  for (const row of effectiveGoalAllocationsForMonth((rows ?? []) as GoalAllocationRow[], month)) {
    if (!row.auto_revert) amounts.set(row.goal_id, Number(row.amount))
  }
  return amounts
}

async function reclaimAutoRevertChain(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  fromMonth: string,
  maxMonths = 36
) {
  let month = fromMonth
  for (let i = 0; i < maxMonths; i++) {
    const { data: row } = await supabase
      .from('goal_allocations')
      .select('id, auto_revert')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .eq('month', `${month}-01`)
      .maybeSingle()
    if (!row || !row.auto_revert) break
    await supabase.from('goal_allocations').delete().eq('id', row.id)
    month = nextMonth(month)
  }
}

/**
 * Set a goal's monthly allocation for `month` ('YYYY-MM') — the fixed
 * "budgeted" figure shown on the Budgets page's Goals group, replacing the
 * auto-computed pace-to-target-date. Single-month by default (writes a
 * revert row for the following month); `perpetual` carries it forward
 * instead, mirroring setBudgetAmount for regular categories exactly.
 */
export async function setGoalAllocation(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  amount: number,
  month: string,
  perpetual: boolean
) {
  if (perpetual) {
    await reclaimAutoRevertChain(supabase, userId, goalId, nextMonth(month))
  } else {
    const following = nextMonth(month)
    const { data: existingRows, error: readError } = await supabase
      .from('goal_allocations')
      .select('id, goal_id, amount, month, auto_revert')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .lte('month', `${following}-01`)
    if (readError) throw readError

    const explicitNext = (existingRows ?? []).find(
      (r) => r.month === `${following}-01` && !r.auto_revert
    )
    if (!explicitNext) {
      const [priorEffective] = effectiveGoalAllocationsForMonth(
        (existingRows ?? []) as GoalAllocationRow[],
        following
      )
      const { error } = await supabase.from('goal_allocations').upsert(
        {
          user_id: userId,
          goal_id: goalId,
          amount: priorEffective ? Number(priorEffective.amount) : 0,
          month: `${following}-01`,
          auto_revert: true,
        },
        { onConflict: 'user_id,goal_id,month' }
      )
      if (error) throw error
    }
  }

  const { data: allocation, error } = await supabase
    .from('goal_allocations')
    .upsert(
      { user_id: userId, goal_id: goalId, amount, month: `${month}-01`, auto_revert: false },
      { onConflict: 'user_id,goal_id,month' }
    )
    .select('*')
    .single()

  if (error) throw error
  return allocation
}

// Safety cap on how many months "until target date" will materialize —
// mirrors CADENCE_HORIZON_MONTHS in budget-write.ts. A goal set many years
// out just won't fully stop at its target date beyond this window; the
// tradeoff is worth the simplicity of reusing the existing effective-dating
// resolver unchanged instead of teaching it a bounded-range concept.
const ALLOCATION_UNTIL_HORIZON_MONTHS = 36

/**
 * Set a goal's monthly allocation to repeat every month from `month`
 * through `untilMonth` inclusive, then stop (falls back to the auto pace
 * calculation afterward) — for "I'm setting aside $X/mo until my goal's
 * target date" instead of forever.
 */
export async function setGoalAllocationUntil(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  amount: number,
  month: string,
  untilMonth: string
) {
  const stopMonth = nextMonth(untilMonth)
  const { data: existingRows, error: readError } = await supabase
    .from('goal_allocations')
    .select('month, auto_revert')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .gte('month', `${month}-01`)
    .lte('month', `${stopMonth}-01`)
  if (readError) throw readError

  const explicitMonths = new Set(
    (existingRows ?? []).filter((r) => !r.auto_revert).map((r) => r.month as string)
  )

  const upserts: { user_id: string; goal_id: string; amount: number; month: string; auto_revert: boolean }[] = []
  let cur = month
  let covered = 0
  while (cur <= untilMonth && covered < ALLOCATION_UNTIL_HORIZON_MONTHS) {
    const key = `${cur}-01`
    if (cur === month || !explicitMonths.has(key)) {
      upserts.push({ user_id: userId, goal_id: goalId, amount, month: key, auto_revert: false })
    }
    cur = nextMonth(cur)
    covered++
  }
  if (cur > untilMonth && !explicitMonths.has(`${cur}-01`)) {
    upserts.push({ user_id: userId, goal_id: goalId, amount: 0, month: `${cur}-01`, auto_revert: true })
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('goal_allocations')
      .upsert(upserts, { onConflict: 'user_id,goal_id,month' })
    if (error) throw error
  }

  const { data: allocation, error } = await supabase
    .from('goal_allocations')
    .select('*')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .eq('month', `${month}-01`)
    .single()
  if (error) throw error
  return allocation
}
