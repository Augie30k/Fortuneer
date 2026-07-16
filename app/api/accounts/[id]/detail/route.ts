import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const RANGE_MONTHS: Record<string, number | null> = {
  '1m': 1, '3m': 3, '6m': 6, '1y': 12, all: null,
}

/** GET /api/accounts/[id]/detail?range=6m — account + balance history for the detail page */
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
    const range = searchParams.get('range') ?? '6m'
    const rangeMonths = range in RANGE_MONTHS ? RANGE_MONTHS[range] : 6

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*, plaid_items(institution_name, last_synced_at, status)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const now = new Date()
    let query = supabase
      .from('balance_snapshots')
      .select('date, balance')
      .eq('account_id', id)
      .order('date')

    if (rangeMonths) {
      const start = new Date(now.getFullYear(), now.getMonth() - rangeMonths, now.getDate())
        .toISOString()
        .slice(0, 10)
      query = query.gte('date', start)
    }

    const { data: history, error } = await query
    if (error) throw error

    return NextResponse.json({
      account,
      history: (history ?? []).map((h) => ({ date: h.date, balance: Number(h.balance) })),
    })
  } catch (error) {
    console.error('Error fetching account detail:', error)
    return NextResponse.json({ error: 'Failed to fetch account detail' }, { status: 500 })
  }
}
