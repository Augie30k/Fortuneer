import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

function periodEndDate(budget: { period: string; start_date: string; end_date?: string | null }) {
  if (budget.end_date) return new Date(budget.end_date)

  const start = new Date(budget.start_date)
  if (budget.period === 'monthly') {
    return new Date(start.getFullYear(), start.getMonth() + 1, start.getDate())
  }
  if (budget.period === 'yearly') {
    return new Date(start.getFullYear() + 1, start.getMonth(), start.getDate())
  }
  return null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const { data: userAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)

    if (accountsError) throw accountsError

    const accountIds = (userAccounts ?? []).map((a) => a.id)

    let transactions: { category_id: string | null; amount: number; date: string; type: string }[] = []
    if (accountIds.length > 0) {
      const { data: txns, error: txnsError } = await supabase
        .from('transactions')
        .select('category_id, amount, date, type')
        .in('account_id', accountIds)
        .eq('type', 'debit')

      if (txnsError) throw txnsError
      transactions = txns ?? []
    }

    const budgetsWithSpend = (budgets ?? []).map((budget) => {
      const start = new Date(budget.start_date)
      const end = periodEndDate(budget)

      const spent = transactions
        .filter((t) => !budget.category_id || t.category_id === budget.category_id)
        .filter((t) => {
          const d = new Date(t.date)
          return d >= start && (!end || d < end)
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)

      return { ...budget, spent }
    })

    return NextResponse.json({ budgets: budgetsWithSpend })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budgets' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, amount, period, category_id, start_date, end_date } = body

    if (!name || amount === undefined || !period || !start_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: budget, error } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        name,
        amount,
        period,
        category_id,
        start_date,
        end_date,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(budget)
  } catch (error) {
    console.error('Error creating budget:', error)
    return NextResponse.json(
      { error: 'Failed to create budget' },
      { status: 500 }
    )
  }
}
