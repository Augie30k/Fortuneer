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

    const { data: userAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)

    if (accountsError) throw accountsError

    const ownedAccountIds = (userAccounts ?? []).map((a) => a.id)
    const accountIds = accountId
      ? ownedAccountIds.filter((id) => id === accountId)
      : ownedAccountIds

    if (accountIds.length === 0) {
      return NextResponse.json({ transactions: [], total: 0, limit, offset })
    }

    const { data: transactions, error, count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .in('account_id', accountIds)
      .order('date', { ascending: false })
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
