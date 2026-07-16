import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const accountId = searchParams.get('accountId')
    const categoryId = searchParams.get('categoryId')
    const month = searchParams.get('month') // YYYY-MM
    const startDate = searchParams.get('startDate') // YYYY-MM-DD
    const endDate = searchParams.get('endDate')
    const minAmount = searchParams.get('minAmount') // absolute value, dollars
    const maxAmount = searchParams.get('maxAmount')
    const sort = searchParams.get('sort') === 'amount' ? 'amount' : 'date'
    const dir = searchParams.get('dir') === 'asc'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('transactions')
      .select('*, accounts(name, mask), categories(name, icon, color, is_income, is_transfer)', {
        count: 'exact',
      })
      .eq('user_id', user.id)

    if (sort === 'amount') {
      // amount>0 is outflow; sort by magnitude of the movement
      query = query.order('amount', { ascending: dir })
    } else {
      query = query.order('date', { ascending: dir })
    }
    query = query.order('created_at', { ascending: false })

    if (q) query = query.or(`description.ilike.%${q}%,merchant_name.ilike.%${q}%`)
    if (accountId) query = query.eq('account_id', accountId)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const start = `${month}-01`
      const end = new Date(y, m, 1).toISOString().slice(0, 10)
      query = query.gte('date', start).lt('date', end)
    }
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    // Absolute-amount filters need to catch both inflows and outflows
    const min = minAmount ? Math.abs(parseFloat(minAmount)) : null
    const max = maxAmount ? Math.abs(parseFloat(maxAmount)) : null
    if (min != null && !Number.isNaN(min)) {
      query = query.or(`amount.gte.${min},amount.lte.${-min}`)
    }
    if (max != null && !Number.isNaN(max)) {
      query = query.gte('amount', -max).lte('amount', max)
    }

    const { data: transactions, error, count } = await query.range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      transactions: transactions ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
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
    const { account_id, description, amount, date, category_id } = body

    if (!account_id || !description || amount === undefined || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id,
        description,
        amount,
        date,
        category_id: category_id ?? null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
