import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveBudgetsForMonth, nextMonth, reclaimAutoRevertChain } from './effective-budget'

/**
 * Set a category's budget for `month` ('YYYY-MM'). Single-month by default:
 * a revert row is written for the following month so the change doesn't
 * bleed forward. `perpetual` carries the amount forward instead, reclaiming
 * any auto-revert bookkeeping rows in the way. Shared by the budgets API
 * and Vera's set_budget tool so both behave identically.
 */
export async function setBudgetAmount(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  amount: number,
  month: string,
  perpetual: boolean
) {
  if (perpetual) {
    await reclaimAutoRevertChain(supabase, userId, categoryId, nextMonth(month))
  } else {
    const following = nextMonth(month)
    const { data: existingRows, error: readError } = await supabase
      .from('budgets')
      .select('id, category_id, amount, month, auto_revert')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .lte('month', `${following}-01`)
    if (readError) throw readError

    const explicitNext = (existingRows ?? []).find(
      (r) => r.month === `${following}-01` && !r.auto_revert
    )
    if (!explicitNext) {
      const [priorEffective] = effectiveBudgetsForMonth(existingRows ?? [], following)
      const { error } = await supabase.from('budgets').upsert(
        {
          user_id: userId,
          category_id: categoryId,
          amount: priorEffective ? Number(priorEffective.amount) : 0,
          month: `${following}-01`,
          auto_revert: true,
        },
        { onConflict: 'user_id,category_id,month' }
      )
      if (error) throw error
    }
  }

  const { data: budget, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, category_id: categoryId, amount, month: `${month}-01`, auto_revert: false },
      { onConflict: 'user_id,category_id,month' }
    )
    .select('*, categories(name, icon, color, group_name, sort_order)')
    .single()

  if (error) throw error
  return budget
}

export type BudgetCadence = 'quarterly' | 'semiannual' | 'annual'

const CADENCE_INTERVAL_MONTHS: Record<BudgetCadence, number> = {
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

// How far ahead to materialize occurrences. Recurring cadences don't fit the
// "latest row wins, holds until changed" resolution effective-dated monthly
// budgets use (a quarterly budget needs to be $0 in the two months between
// occurrences, not carry forward) — so instead of teaching the resolver a
// second algorithm, we just write the on/off pattern out as explicit rows
// for a bounded window. It runs out after ~3 years unless re-set, which is
// an acceptable tradeoff for the simplicity of reusing the existing
// effective-dating machinery unchanged.
const CADENCE_HORIZON_MONTHS = 36

function monthsAhead(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Set a category's budget on a recurring cadence (quarterly/semiannual/
 * annual) starting at `month`: writes `amount` at each occurrence and $0 in
 * between, as explicit rows, for a bounded horizon — never touching a month
 * where the user already set something on purpose.
 */
export async function setBudgetCadence(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  amount: number,
  month: string,
  cadence: BudgetCadence
) {
  const interval = CADENCE_INTERVAL_MONTHS[cadence]
  const horizonEnd = monthsAhead(month, CADENCE_HORIZON_MONTHS)

  const { data: existingRows, error: readError } = await supabase
    .from('budgets')
    .select('month, auto_revert')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .gte('month', `${month}-01`)
    .lt('month', `${horizonEnd}-01`)
  if (readError) throw readError

  const explicitMonths = new Set(
    (existingRows ?? []).filter((r) => !r.auto_revert).map((r) => r.month as string)
  )

  const upserts: { user_id: string; category_id: string; amount: number; month: string; auto_revert: boolean }[] = []
  for (let i = 0; i < CADENCE_HORIZON_MONTHS; i++) {
    const targetMonth = monthsAhead(month, i)
    const key = `${targetMonth}-01`
    if (i !== 0 && explicitMonths.has(key)) continue // respect a prior deliberate override
    const isOccurrence = i % interval === 0
    upserts.push({
      user_id: userId,
      category_id: categoryId,
      amount: isOccurrence ? amount : 0,
      month: key,
      auto_revert: !isOccurrence,
    })
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('budgets')
      .upsert(upserts, { onConflict: 'user_id,category_id,month' })
    if (error) throw error
  }

  const { data: budget, error } = await supabase
    .from('budgets')
    .select('*, categories(name, icon, color, group_name, sort_order)')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('month', `${month}-01`)
    .single()
  if (error) throw error
  return budget
}
