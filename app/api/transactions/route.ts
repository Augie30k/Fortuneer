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
    const accountId = searchParams.get('accountId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId || '')
      .order('date', { ascending: false })

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data: transactions, error, count } = await query
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      transactions: transactions ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
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
    const { account_id, description, amount, date, type, category_id } = body

    if (!account_id || !description || amount === undefined || !date || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        account_id,
        description,
        amount,
        date,
        type,
        category_id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}
