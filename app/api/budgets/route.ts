import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** GET /api/budgets?month=YYYY-MM — budgets with actual spend for that month */
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

    const [budgetsResult, spendResult] = await Promise.all([
      supabase
        .from('budgets')
        .select('*, categories(name, icon, color)')
        .eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('user_id', user.id)
        .gt('amount', 0) // outflows only
        .gte('date', start)
        .lt('date', end),
    ])

    if (budgetsResult.error) throw budgetsResult.error
    if (spendResult.error) throw spendResult.error

    const spendByCategory = new Map<string, number>()
    for (const t of spendResult.data ?? []) {
      if (!t.category_id) continue
      spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + t.amount)
    }

    const budgets = (budgetsResult.data ?? []).map((b) => ({
      ...b,
      category: b.categories,
      spent: spendByCategory.get(b.category_id) ?? 0,
    }))

    return NextResponse.json({ budgets, month })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

/** PUT /api/budgets — upsert a budget amount for a category */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { category_id, amount } = body

    if (!category_id || amount === undefined || amount < 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: budget, error } = await supabase
      .from('budgets')
      .upsert(
        { user_id: user.id, category_id, amount },
        { onConflict: 'user_id,category_id' }
      )
      .select('*, categories(name, icon, color)')
      .single()

    if (error) throw error

    return NextResponse.json(budget)
  } catch (error) {
    console.error('Error saving budget:', error)
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}

/** DELETE /api/budgets?id=<uuid> */
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
