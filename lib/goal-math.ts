import type { Goal } from './types'

// Shared, client-safe math for savings goals — the single source of truth
// for every "how much per month" number in the app, so the Goals page,
// Budgets page, and the goal-creation preview always agree.
//
// A goal's monthly figure comes from one of two plan styles:
//  - "by date"  (goal has target_date, no explicit allocation): the app
//    computes what's needed each month to land on the date — adaptive, it
//    recalculates as months pass or the balance changes.
//  - "by amount" (goal has an explicit monthly_allocation): the user fixed
//    the amount; the app projects the finish date from it instead.
// A goal with neither is "flexible": no monthly figure at all — it never
// inflates the Budgets page totals just because it exists.

/** Calendar months from now through `date`'s month, inclusive — the number
 *  of month-slots still available to contribute in. 0 if the month has
 *  already passed. */
export function monthsThrough(date: string, from = new Date()): number {
  const [y, m] = date.split('-').map(Number)
  return Math.max(0, (y - from.getFullYear()) * 12 + (m - 1 - from.getMonth()) + 1)
}

/** What went toward a goal this month — a net withdrawal never grants
 *  extra budget room back. */
export function goalContributedThisMonth(goal: Goal): number {
  return Math.max(0, Number(goal.contributions_this_month ?? 0))
}

/** This month's needed contribution to stay on track for target_date.
 *  Measured from where the goal stood at the START of the month, so the
 *  number holds still while you contribute during the month instead of
 *  shrinking as you go. null when there's no date or the goal is reached. */
export function goalAutoPace(goal: Goal): number | null {
  const target = Number(goal.target_amount)
  const saved = Number(goal.saved_amount)
  if (saved >= target) return null
  if (!goal.target_date) return null
  const atMonthStart = saved - goalContributedThisMonth(goal)
  const remaining = Math.max(0, target - atMonthStart)
  const months = Math.max(1, monthsThrough(goal.target_date))
  return remaining / months
}

/** The goal's monthly "budgeted" figure: the explicit fixed plan if one is
 *  set, else the adaptive pace, else null (flexible goal or already
 *  reached — contributes nothing to budget totals). */
export function goalMonthlyBudget(goal: Goal): number | null {
  if (Number(goal.saved_amount) >= Number(goal.target_amount)) return null
  if (goal.monthly_allocation != null) return Number(goal.monthly_allocation)
  return goalAutoPace(goal)
}

/** 'YYYY-MM' when the goal is projected to hit its target if `monthly` is
 *  put away each month starting this month; null if it never will (or
 *  already has). */
export function projectedFinishMonth(
  target: number,
  saved: number,
  monthly: number,
  from = new Date()
): string | null {
  const remaining = target - saved
  if (remaining <= 0 || monthly <= 0) return null
  const monthsNeeded = Math.ceil(remaining / monthly)
  const d = new Date(from.getFullYear(), from.getMonth() + monthsNeeded - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' -> 'Jun 2027' */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ---- Auto-save: any goal with a monthly figure (fixed plan OR date-derived
// pace — anything goalMonthlyBudget resolves to) automatically claims room
// from this month's Expected Savings *before* goals, instead of requiring a
// manual contribution — a plan is a commitment, so it reduces what's left
// the same way a category's budgeted amount does. Flexible goals (neither a
// plan nor a date) never participate — nothing to claim against.
//
// If the shared pool can't cover every goal's ask, each goal is capped at
// whatever's left when its turn comes, in priority order (the user's
// drag-to-reorder ranking on the Budgets page — ties broken by whichever
// goal is older) — the pool never goes negative from a goal's own claim.
// The goal earliest in that order is filled first and protected; the one
// latest in order is the first to give ground as the pool shrinks. This
// same eligibility + ordering is mirrored server-side in
// lib/goal-autosave.ts's month-end crystallization, so the live number
// here matches what actually gets committed once the month ends.

/** Sequentially allocates a shared "expected savings before goals" pool
 *  across every goal with a monthly figure, in priority order, each capped
 *  at its own target. What's left after every goal's claim stays
 *  uncommitted (never further eaten). Pass 0 or a negative pool for an
 *  over-committed month — every goal correctly gets 0 rather than going
 *  negative. */
export function liveGoalAutoSaveAmounts(
  goals: Goal[],
  expectedSavingsBeforeGoals: number
): Map<string, number> {
  const amounts = new Map<string, number>()
  let pool = Math.max(0, expectedSavingsBeforeGoals)
  const eligible = goals
    .map((g) => ({ goal: g, plan: goalMonthlyBudget(g) }))
    .filter((x): x is { goal: Goal; plan: number } => x.plan != null)
    .sort((a, b) => a.goal.priority - b.goal.priority || a.goal.created_at.localeCompare(b.goal.created_at))
  for (const { goal, plan } of eligible) {
    const amount = Math.max(0, Math.min(pool, plan))
    pool -= amount
    amounts.set(goal.id, amount)
  }
  return amounts
}

/** What a goal "spent" this month for budget-total purposes: the live
 *  auto-save claim for an eligible goal (fixed plan or date-derived pace)
 *  in the current real month (see liveGoalAutoSaveAmounts), or the actual
 *  recorded contributions for any other goal/month — matching what's
 *  already crystallized or manually added. */
export function goalMonthAmount(
  goal: Goal,
  isCurrentRealMonth: boolean,
  liveAutoSave: Map<string, number>
): number {
  if (isCurrentRealMonth && goalMonthlyBudget(goal) != null) {
    return liveAutoSave.get(goal.id) ?? 0
  }
  return goalContributedThisMonth(goal)
}
