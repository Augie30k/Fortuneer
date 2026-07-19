import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { detectRecurringStreams, type RecurringTxnRow } from '@/lib/recurring-math'

const DAY = 86_400_000

/**
 * Heuristic recurring-stream detection: group outflows by merchant, then look
 * for a stable interval between charges and reasonably stable amounts.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oneYearAgo = new Date(Date.now() - 370 * DAY).toISOString().slice(0, 10)

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, date, description, merchant_name, logo_url, category_id, pending, categories(name, icon, color, is_transfer)')
      .eq('user_id', user.id)
      .gt('amount', 0)
      .eq('pending', false)
      .gte('date', oneYearAgo)
      .order('date')

    if (error) throw error

    const rows: RecurringTxnRow[] = (transactions ?? []).map((t) => ({
      amount: t.amount,
      date: t.date,
      description: t.description,
      merchant_name: t.merchant_name,
      logo_url: t.logo_url,
      category: t.categories as unknown as RecurringTxnRow['category'],
    }))

    return NextResponse.json(detectRecurringStreams(rows))
  } catch (error) {
    console.error('Error detecting recurring streams:', error)
    return NextResponse.json({ error: 'Failed to detect recurring streams' }, { status: 500 })
  }
}
