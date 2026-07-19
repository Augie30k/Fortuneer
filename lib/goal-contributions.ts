import type { SupabaseClient } from '@supabase/supabase-js'
import { monthBounds } from './budget-math'

/**
 * Apply a signed contribution (positive = add, negative = withdraw) to a
 * goal's running saved_amount, and log it to goal_contributions so the
 * Budgets page can later ask "how much went to this goal this month".
 * Shared by the goals API and Vera's contribute_to_goal tool so both stay
 * in sync with the budget-deduction feature.
 *
 * `occurredAt` defaults to now. Pass an earlier timestamp to record money
 * that was already saved before this month (e.g. a goal's starting
 * balance) without it eating into the current month's budget deduction —
 * it still counts toward the lifetime saved_amount either way.
 */
export async function recordGoalContribution(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  amount: number,
  occurredAt?: string
): Promise<{ savedAmount: number; contributionId: string }> {
  const { data: current, error: readError } = await supabase
    .from('goals')
    .select('saved_amount')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single()
  if (readError) throw readError

  const savedAmount = Math.max(0, Number(current.saved_amount) + amount)
  const { error: updateError } = await supabase
    .from('goals')
    .update({ saved_amount: savedAmount })
    .eq('id', goalId)
    .eq('user_id', userId)
  if (updateError) throw updateError

  const { data: row, error: insertError } = await supabase
    .from('goal_contributions')
    .insert({
      user_id: userId,
      goal_id: goalId,
      amount,
      ...(occurredAt ? { created_at: occurredAt } : {}),
    })
    .select('id')
    .single()
  if (insertError) throw insertError

  return { savedAmount, contributionId: row.id }
}

/** ISO timestamp for the last instant of the month before `month` ('YYYY-MM') */
export function beforeMonthStart(month: string): string {
  const { start } = monthBounds(month)
  return new Date(new Date(`${start}T00:00:00Z`).getTime() - 1000).toISOString()
}

/** Sum of contributions per goal within `month` ('YYYY-MM') */
export async function contributionsByGoalForMonth(
  supabase: SupabaseClient,
  userId: string,
  goalIds: string[],
  month: string
): Promise<Map<string, number>> {
  const sums = new Map<string, number>()
  if (goalIds.length === 0) return sums

  const { start, end } = monthBounds(month)
  const { data: rows, error } = await supabase
    .from('goal_contributions')
    .select('goal_id, amount')
    .eq('user_id', userId)
    .in('goal_id', goalIds)
    .gte('created_at', `${start}T00:00:00Z`)
    .lt('created_at', `${end}T00:00:00Z`)
  if (error) throw error

  for (const row of rows ?? []) {
    sums.set(row.goal_id, (sums.get(row.goal_id) ?? 0) + Number(row.amount))
  }
  return sums
}
