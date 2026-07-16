import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { effectiveBudgetsForMonth, nextMonth, reclaimAutoRevertChain } from '@/lib/effective-budget'
import { setBudgetCadence, type BudgetCadence } from '@/lib/budget-write'

const CADENCES: BudgetCadence[] = ['quarterly', 'semiannual', 'annual']

/**
 * PUT /api/budgets/bulk — save the whole budget sheet at once for `month`
 * (default: current month). items: [{ category_id, amount, perpetual?,
 * cadence? }] — amount > 0 upserts; amount 0/null clears the budget from
 * this month on (written as an explicit 0 row rather than deleted, so
 * earlier months keep their history). By default a change only affects
 * `month` — a revert row is written for the following month so later months
 * are unaffected. Mark an item `perpetual: true` to carry that category's
 * change forward indefinitely, or `cadence: 'quarterly' | 'semiannual' |
 * 'annual'` to repeat it on that schedule instead (a body-level
 * `perpetual: true` applies it to every item without its own cadence).
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const items = body.items
    const month = typeof body.month === 'string' ? body.month : new Date().toISOString().slice(0, 7)
    const perpetual = body.perpetual === true
    const following = nextMonth(month)

    if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
      return NextResponse.json({ error: 'Missing or invalid items' }, { status: 400 })
    }

    const { data: allBudgets, error: readError } = await supabase
      .from('budgets')
      .select('id, category_id, amount, month, auto_revert')
      .eq('user_id', user.id)
      .lte('month', `${following}-01`)
    if (readError) throw readError

    const effectiveByCategory = new Map(
      effectiveBudgetsForMonth(allBudgets ?? [], month).map((b) => [b.category_id, b])
    )
    const effectiveByCategoryNext = new Map(
      effectiveBudgetsForMonth(allBudgets ?? [], following).map((b) => [b.category_id, b])
    )
    const explicitNextCategories = new Set(
      (allBudgets ?? []).filter((b) => b.month === `${following}-01` && !b.auto_revert).map((b) => b.category_id)
    )

    const upserts: { user_id: string; category_id: string; amount: number; month: string; auto_revert: boolean }[] = []
    const reverts: { user_id: string; category_id: string; amount: number; month: string; auto_revert: boolean }[] = []
    const perpetualCategories: string[] = []
    const cadenceItems: { category_id: string; amount: number; cadence: BudgetCadence }[] = []
    let removed = 0
    for (const item of items) {
      if (!item.category_id) continue
      const amount = Number(item.amount) || 0
      const itemCadence = CADENCES.includes(item.cadence) ? (item.cadence as BudgetCadence) : null

      // Recurring cadences materialize their own rows out-of-band — they
      // don't fit the single-month batch upsert below
      if (itemCadence && amount > 0) {
        cadenceItems.push({ category_id: item.category_id, amount, cadence: itemCadence })
        continue
      }

      const current = effectiveByCategory.get(item.category_id)
      const currentAmount = current ? Number(current.amount) : 0

      let writeAmount: number | null = null
      if (amount > 0) {
        writeAmount = amount
      } else if (currentAmount > 0) {
        // Was budgeted, now cleared — write an explicit zero row going forward
        writeAmount = 0
        removed++
      }
      if (writeAmount === null) continue // nothing was effective and nothing was entered

      upserts.push({
        user_id: user.id,
        category_id: item.category_id,
        amount: writeAmount,
        month: `${month}-01`,
        auto_revert: false,
      })

      if (writeAmount === currentAmount) continue // unchanged, no forward-bleed to manage

      if (perpetual || item.perpetual === true) {
        perpetualCategories.push(item.category_id)
      } else if (!explicitNextCategories.has(item.category_id)) {
        const nextEffective = effectiveByCategoryNext.get(item.category_id)
        reverts.push({
          user_id: user.id,
          category_id: item.category_id,
          amount: nextEffective ? Number(nextEffective.amount) : 0,
          month: `${following}-01`,
          auto_revert: true,
        })
      }
    }

    if (reverts.length > 0) {
      const { error } = await supabase
        .from('budgets')
        .upsert(reverts, { onConflict: 'user_id,category_id,month' })
      if (error) throw error
    }

    if (upserts.length > 0) {
      const { error } = await supabase
        .from('budgets')
        .upsert(upserts, { onConflict: 'user_id,category_id,month' })
      if (error) throw error
    }

    if (perpetualCategories.length > 0) {
      await Promise.all(
        perpetualCategories.map((categoryId) =>
          reclaimAutoRevertChain(supabase, user.id, categoryId, following)
        )
      )
    }

    if (cadenceItems.length > 0) {
      await Promise.all(
        cadenceItems.map((item) =>
          setBudgetCadence(supabase, user.id, item.category_id, item.amount, month, item.cadence)
        )
      )
    }

    return NextResponse.json({
      saved: upserts.length - removed + cadenceItems.length,
      removed,
    })
  } catch (error) {
    console.error('Error bulk saving budgets:', error)
    return NextResponse.json({ error: 'Failed to save budgets' }, { status: 500 })
  }
}
