import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*, plaid_items(institution_name, last_synced_at, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ accounts: accounts ?? [] })
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
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
    const { name, type, subtype, balance, currency = 'USD' } = body

    const validTypes = ['depository', 'credit', 'loan', 'investment', 'other']
    if (!name || !validTypes.includes(type) || balance === undefined) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name,
        type,
        subtype: subtype ?? null,
        balance,
        currency,
        is_manual: true,
      })
      .select()
      .single()

    if (error) throw error

    // Seed a snapshot so manual accounts show up in net-worth history immediately
    await supabase.from('balance_snapshots').upsert(
      {
        user_id: user.id,
        account_id: account.id,
        balance: account.balance,
        date: new Date().toISOString().slice(0, 10),
      },
      { onConflict: 'account_id,date' }
    )

    return NextResponse.json(account)
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
