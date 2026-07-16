import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * GET /api/transactions/merchants — distinct merchant/description values
 * with occurrence counts, most frequent first. Powers the rule-builder's
 * "pick from your own history" autocomplete instead of free-typing blind.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('merchant_name, description')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(2000)

    if (error) throw error

    const counts = new Map<string, number>()
    for (const t of transactions ?? []) {
      const name = t.merchant_name ?? t.description
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }

    const merchants = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)

    return NextResponse.json({ merchants })
  } catch (error) {
    console.error('Error fetching merchants:', error)
    return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 })
  }
}
