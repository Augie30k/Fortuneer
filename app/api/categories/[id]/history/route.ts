import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { effectiveBudgetsForMonth } from '@/lib/effective-budget'
import { monthBounds } from '@/lib/budget-math'

/** Consecutive "YYYY-MM" strings ending at the current month, oldest first */
function monthWindow(count: number): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

/**
 * GET /api/categories/[id]/history?months=12 — the category plus, for each
 * month in the window, actual spend (received, for the income category) and
 * the budget effective that month. Powers the category detail page's chart
 * and summary tiles.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const count = Math.min(Math.max(parseInt(searchParams.get('months') || '12'), 1), 36)

    // Built-in categories have user_id null and are visible to everyone;
    // personal ones must belong to this user.
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .maybeSingle()

    if (categoryError) throw categoryError
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const months = monthWindow(count)
    const start = `${months[0]}-01`
    const { end } = monthBounds(months[months.length - 1])

    const [txResult, budgetsResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, date')
        .eq('user_id', user.id)
        .eq('category_id', id)
        .gte('date', start)
        .lt('date', end),
      supabase
        .from('budgets')
        .select('id, category_id, amount, month')
        .eq('user_id', user.id)
        .eq('category_id', id)
        .lte('month', `${months[months.length - 1]}-01`),
    ])

    if (txResult.error) throw txResult.error
    if (budgetsResult.error) throw budgetsResult.error

    // Same conventions as computeMonthActuals: expense categories track
    // outflows (amount > 0), the income category tracks inflows (< 0).
    const spentByMonth = new Map<string, number>()
    const countByMonth = new Map<string, number>()
    for (const t of txResult.data ?? []) {
      const amount = Number(t.amount)
      const flow = category.is_income ? (amount < 0 ? -amount : 0) : amount > 0 ? amount : 0
      if (flow === 0) continue
      const month = t.date.slice(0, 7)
      spentByMonth.set(month, (spentByMonth.get(month) ?? 0) + flow)
      countByMonth.set(month, (countByMonth.get(month) ?? 0) + 1)
    }

    const budgetRows = budgetsResult.data ?? []
    const history = months.map((month) => {
      const effective = effectiveBudgetsForMonth(budgetRows, month)[0]
      const budget = effective && Number(effective.amount) > 0 ? Number(effective.amount) : null
      return {
        month,
        spent: Math.round((spentByMonth.get(month) ?? 0) * 100) / 100,
        count: countByMonth.get(month) ?? 0,
        budget,
      }
    })

    return NextResponse.json({ category, history })
  } catch (error) {
    console.error('Error fetching category history:', error)
    return NextResponse.json({ error: 'Failed to fetch category history' }, { status: 500 })
  }
}
