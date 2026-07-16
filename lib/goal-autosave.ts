import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveBudgetsForMonth, nextMonth } from './effective-budget'
import { goalAllocationsForMonth } from './goal-allocation'
import { beforeMonthStart, monthBounds } from './goal-contributions'
import { monthsThrough } from './goal-math'

// Server-side counterpart to lib/goal-math.ts's liveGoalAutoSaveAmounts:
// once a real month fully elapses, whatever a goal was live-claiming from
// that month's Expected Savings gets committed for real (an actual
// contribution, added to saved_amount). There's no background scheduler in
// this app, so this runs lazily — called on every GET /api/goals — and is
// idempotent: each (goal, month) pair is crystallized at most once, tracked
// via goal_contributions.auto_for_month.
//
// Two plan styles both participate, but only one needs explicit shortfall
// bookkeeping:
//  - "by date" (auto-pace): each month's target is recomputed from
//    (target - saved_at_month_start) / months_left. If a month falls short,
//    saved_at_month_start is lower next month and months_left is smaller,
//    so the recomputed pace rises on its own — self-correcting, no extra
//    tracking needed.
//  - "by amount" (fixed plan): the target doesn't move on its own, so a
//    shortfall is carried forward explicitly and added on top of the base
//    plan until it's paid off.

const MAX_MONTHS_PER_RUN = 36

function monthsBetween(startInclusive: string, endExclusive: string): string[] {
  const out: string[] = []
  let cur = startInclusive
  while (cur < endExclusive && out.length < MAX_MONTHS_PER_RUN) {
    out.push(cur)
    cur = nextMonth(cur)
  }
  return out
}

function firstOfMonth(month: string): Date {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Expected income minus budgeted expenses for a historical month — the
 *  same "Expected Savings before goals" basis the Budgets page shows,
 *  computed fresh since it isn't stored anywhere. Planning-based (what was
 *  budgeted), not tied to what was actually earned/spent that month. */
async function expectedSavingsBeforeGoalsForMonth(
  supabase: SupabaseClient,
  userId: string,
  month: string
): Promise<number> {
  const { start } = monthBounds(month)

  const { data: budgetRows, error } = await supabase
    .from('budgets')
    .select('id, category_id, amount, month, auto_revert, categories(is_income)')
    .eq('user_id', userId)
    .lte('month', start)
  if (error) throw error

  const effective = effectiveBudgetsForMonth(budgetRows ?? [], month).filter(
    (b) => Number(b.amount) > 0
  )

  let expectedIncome = 0
  let regularBudgeted = 0
  for (const b of effective) {
    const isIncome = (b.categories as unknown as { is_income?: boolean } | null)?.is_income
    if (isIncome) expectedIncome += Number(b.amount)
    else regularBudgeted += Number(b.amount)
  }

  return expectedIncome - regularBudgeted
}

interface GoalRow {
  id: string
  created_at: string
  target_amount: number
  target_date: string | null
  saved_amount: number
}

/** This month's base target for a goal, before any shortfall top-up —
 *  either its effective explicit allocation, or a freshly recomputed
 *  auto-pace figure using `savedAtStart` (the running balance as of the
 *  start of this specific month, not today). null = not eligible this
 *  month (flexible, no explicit allocation and no date, or already done). */
function baseTargetForMonth(
  goal: GoalRow,
  month: string,
  explicitAllocation: number | undefined,
  savedAtStart: number
): { amount: number; selfCorrecting: boolean } | null {
  if (explicitAllocation != null) return { amount: explicitAllocation, selfCorrecting: false }
  if (!goal.target_date) return null
  const target = Number(goal.target_amount)
  if (savedAtStart >= target) return null
  const monthsLeft = Math.max(1, monthsThrough(goal.target_date, firstOfMonth(month)))
  return { amount: Math.max(0, target - savedAtStart) / monthsLeft, selfCorrecting: true }
}

/**
 * Commits each fully-elapsed real month's dynamically-clamped auto-save
 * amount into an actual contribution, for every goal with a monthly figure
 * (fixed plan or date-derived pace). Safe to call on every request — the
 * common case (nothing pending) costs a couple of queries and returns.
 */
export async function crystallizeElapsedGoalMonths(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7)

  const { data: goals } = await supabase
    .from('goals')
    .select('id, created_at, target_amount, target_date, saved_amount')
    .eq('user_id', userId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
  if (!goals || goals.length === 0) return

  // The month-range to replay depends only on the oldest goal, regardless
  // of priority order — separate from the per-month pool-sharing order below.
  const earliestMonth = goals.reduce(
    (min, g) => (g.created_at.slice(0, 7) < min ? g.created_at.slice(0, 7) : min),
    goals[0].created_at.slice(0, 7)
  )
  const months = monthsBetween(earliestMonth, currentMonth)
  if (months.length === 0) return

  const goalIds = goals.map((g) => g.id)
  const { data: doneRows } = await supabase
    .from('goal_contributions')
    .select('goal_id, auto_for_month, amount')
    .eq('user_id', userId)
    .in('goal_id', goalIds)
    .not('auto_for_month', 'is', null)
  // auto_for_month comes back as a full date string ('2026-05-01') — key by
  // the 'YYYY-MM' month string used everywhere else in this function
  const doneAmount = new Map<string, number>()
  for (const r of doneRows ?? []) {
    doneAmount.set(`${r.goal_id}:${String(r.auto_for_month).slice(0, 7)}`, Number(r.amount))
  }

  const savedAmount = new Map(goals.map((g) => [g.id, Number(g.saved_amount)]))
  const shortfall = new Map(goals.map((g) => [g.id, 0]))
  const newContributions: { goal_id: string; amount: number; month: string }[] = []

  // Process chronologically — needed both for pool-sharing order (goals
  // claim in priority order, same as the live client-side calculation) and
  // so savedAmount/shortfall reflect prior months correctly.
  // Already-crystallized months are replayed (not re-charged against the
  // pool) purely to keep this running state accurate for the months that
  // still need work.
  for (const month of months) {
    const allocations = await goalAllocationsForMonth(supabase, userId, goalIds, month)

    const bases = new Map<string, { amount: number; selfCorrecting: boolean }>()
    for (const g of goals) {
      const base = baseTargetForMonth(g, month, allocations.get(g.id), savedAmount.get(g.id)!)
      if (base) bases.set(g.id, base)
    }
    if (bases.size === 0) continue

    const anyPending = goals.some(
      (g) => bases.has(g.id) && !doneAmount.has(`${g.id}:${month}`)
    )

    if (!anyPending) {
      // Fully processed already — replay actuals to advance running state
      for (const g of goals) {
        const base = bases.get(g.id)
        if (!base) continue
        const actual = doneAmount.get(`${g.id}:${month}`) ?? 0
        if (!base.selfCorrecting) {
          shortfall.set(g.id, Math.max(0, base.amount + (shortfall.get(g.id) ?? 0) - actual))
        }
        savedAmount.set(g.id, Math.max(0, savedAmount.get(g.id)! + actual))
      }
      continue
    }

    let pool = Math.max(0, await expectedSavingsBeforeGoalsForMonth(supabase, userId, month))
    for (const g of goals) {
      const base = bases.get(g.id)
      if (!base) continue
      const owed = base.selfCorrecting ? 0 : (shortfall.get(g.id) ?? 0)
      const target = base.amount + owed

      const already = doneAmount.get(`${g.id}:${month}`)
      if (already != null) {
        pool -= already
        if (!base.selfCorrecting) shortfall.set(g.id, Math.max(0, target - already))
        savedAmount.set(g.id, Math.max(0, savedAmount.get(g.id)! + already))
        continue
      }

      const amount = Math.max(0, Math.min(pool, target))
      pool -= amount
      if (!base.selfCorrecting) shortfall.set(g.id, Math.max(0, target - amount))
      savedAmount.set(g.id, Math.max(0, savedAmount.get(g.id)! + amount))
      newContributions.push({ goal_id: g.id, amount, month })
    }
  }

  if (newContributions.length === 0) return

  const { error: insertError } = await supabase.from('goal_contributions').insert(
    newContributions.map((c) => ({
      user_id: userId,
      goal_id: c.goal_id,
      amount: c.amount,
      auto_for_month: `${c.month}-01`,
      created_at: beforeMonthStart(nextMonth(c.month)),
    }))
  )
  if (insertError) throw insertError

  for (const g of goals) {
    const finalSaved = savedAmount.get(g.id)!
    if (finalSaved !== Number(g.saved_amount)) {
      const { error } = await supabase
        .from('goals')
        .update({ saved_amount: finalSaved })
        .eq('id', g.id)
        .eq('user_id', userId)
      if (error) throw error
    }
  }
}
