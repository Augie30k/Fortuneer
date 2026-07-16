import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** GET /api/accounts/[id]/balances?days=10 — recent daily balances (gaps forward-filled) */
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
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '10')))

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, balance')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Pull enough history to forward-fill the window's leading gap
    const { data: snapshots, error } = await supabase
      .from('balance_snapshots')
      .select('date, balance')
      .eq('account_id', id)
      .order('date', { ascending: false })
      .limit(days + 60)

    if (error) throw error

    const byDate = new Map((snapshots ?? []).map((s) => [s.date, Number(s.balance)]))
    const sortedAsc = (snapshots ?? []).slice().reverse()

    const entries = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const date = d.toISOString().slice(0, 10)
      let balance = byDate.get(date) ?? null
      const recorded = balance != null
      if (balance == null) {
        // forward-fill from the latest snapshot on/before this date
        for (let j = sortedAsc.length - 1; j >= 0; j--) {
          if (sortedAsc[j].date <= date) {
            balance = Number(sortedAsc[j].balance)
            break
          }
        }
      }
      entries.push({ date, balance: balance ?? Number(account.balance), recorded })
    }

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Error fetching balances:', error)
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 })
  }
}

/**
 * PUT /api/accounts/[id]/balances — upsert balance history entries.
 * Body: { entries: [{ date: YYYY-MM-DD, balance: number }] }.
 * A today entry also updates the account's stored balance for manual accounts.
 */
export async function PUT(
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
    const body = await request.json()
    const entries = body.entries

    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 1000) {
      return NextResponse.json({ error: 'Missing or invalid entries' }, { status: 400 })
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, is_manual')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const valid = entries
      .filter(
        (e: { date?: string; balance?: number }) =>
          typeof e.date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
          typeof e.balance === 'number' &&
          Number.isFinite(e.balance)
      )
      .map((e: { date: string; balance: number }) => ({
        user_id: user.id,
        account_id: id,
        date: e.date,
        balance: Math.round(e.balance * 100) / 100,
      }))

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid entries' }, { status: 400 })
    }

    const { error } = await supabase
      .from('balance_snapshots')
      .upsert(valid, { onConflict: 'account_id,date' })

    if (error) throw error

    const today = new Date().toISOString().slice(0, 10)
    const todayEntry = valid.find((e) => e.date === today)
    if (todayEntry && account.is_manual) {
      await supabase
        .from('accounts')
        .update({ balance: todayEntry.balance, updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    return NextResponse.json({ saved: valid.length })
  } catch (error) {
    console.error('Error saving balances:', error)
    return NextResponse.json({ error: 'Failed to save balances' }, { status: 500 })
  }
}
