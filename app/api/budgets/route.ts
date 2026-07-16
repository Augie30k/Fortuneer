import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { effectiveBudgetsForMonth } from '@/lib/effective-budget'
import { setBudgetAmount, setBudgetCadence, type BudgetCadence } from '@/lib/budget-write'

const CADENCES: BudgetCadence[] = ['quarterly', 'semiannual', 'annual']

/**
 * GET /api/budgets?month=YYYY-MM — effective budgets for that month, with
 * actual spend. Budgets are effective-dated: a budget set for month M
 * applies to M and every month after until a later row overrides it, so
 * this resolves each category to whichever row is newest at-or-before M.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
    const [y, m] = month.split('-').map(Number)
    const start = `${month}-01`
    const end = new Date(y, m, 1).toISOString().slice(0, 10)

    const [budgetsResult, txResult] = await Promise.all([
      supabase
        .from('budgets')
        .select('*, categories(name, icon, color, group_name, sort_order, is_income)')
        .eq('user_id', user.id)
        .lte('month', start),
      supabase
        .from('transactions')
        .select('category_id, amount, categories(is_income, is_transfer)')
        .eq('user_id', user.id)
        .gte('date', start)
        .lt('date', end),
    ])

    if (budgetsResult.error) throw budgetsResult.error
    if (txResult.error) throw txResult.error

    // Per-category actual amount for this month. Expense categories track
    // outflows (amount > 0); the Income category tracks inflows (amount < 0)
    // so its budget row can show "received so far" against a monthly target,
    // just like any other category. Transfers never count either way.
    const spendByCategory = new Map<string, number>()
    let income = 0
    for (const t of txResult.data ?? []) {
      const cat = t.categories as unknown as { is_income?: boolean; is_transfer?: boolean } | null
      if (cat?.is_transfer) continue
      const amount = Number(t.amount)
      if (cat?.is_income) {
        if (amount >= 0) continue
        income += -amount
        if (t.category_id) {
          spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + -amount)
        }
      } else if (amount > 0 && t.category_id) {
        spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + amount)
      }
    }

    const effective = effectiveBudgetsForMonth(budgetsResult.data ?? [], month)

    const budgets = effective
      .filter((b) => Number(b.amount) > 0) // amount=0 means "unbudgeted from here on"
      .map((b) => ({
        ...b,
        category: b.categories,
        spent: spendByCategory.get(b.category_id) ?? 0,
      }))

    // Order follows the category's own display order (drag-and-drop in the
    // budgets edit sheet reorders categories, which reorders this list too)
    budgets.sort((a, b) => {
      const ao = a.category?.sort_order ?? 0
      const bo = b.category?.sort_order ?? 0
      if (ao !== bo) return ao - bo
      return Number(b.amount) - Number(a.amount)
    })

    // The Budgets page won't render/navigate to months before this one —
    // there was no user, so no budget, before the account existed.
    const accountCreatedMonth = user.created_at.slice(0, 7)

    return NextResponse.json({ budgets, income, month, account_created_month: accountCreatedMonth })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

/**
 * PUT /api/budgets — set a category's budget for the given month (or the
 * current month, if none given). By default this only affects that one
 * month — a revert row is written for the following month so later months
 * keep whatever was effective before. Pass `perpetual: true` to carry the
 * amount forward every month indefinitely, or `cadence: 'quarterly' |
 * 'semiannual' | 'annual'` to repeat it on that schedule instead.
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { category_id, amount } = body
    const month = typeof body.month === 'string' ? body.month : new Date().toISOString().slice(0, 7)
    const perpetual = body.perpetual === true
    const cadence = CADENCES.includes(body.cadence) ? (body.cadence as BudgetCadence) : null

    if (!category_id || amount === undefined || amount < 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const budget = cadence
      ? await setBudgetCadence(supabase, user.id, category_id, amount, month, cadence)
      : await setBudgetAmount(supabase, user.id, category_id, amount, month, perpetual)

    return NextResponse.json(budget)
  } catch (error) {
    console.error('Error saving budget:', error)
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}

/** DELETE /api/budgets?id=<uuid> — removes one effective-dated row outright (rarely needed; prefer PUT with amount 0) */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting budget:', error)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
