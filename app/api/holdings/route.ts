import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** GET /api/holdings — investment positions grouped with account info */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: holdings, error } = await supabase
      .from('holdings')
      .select('*, accounts(name, mask, plaid_items(institution_name))')
      .eq('user_id', user.id)
      .order('value', { ascending: false })

    if (error) throw error

    const totalValue = (holdings ?? []).reduce((s, h) => s + Number(h.value), 0)
    const totalCostBasis = (holdings ?? []).reduce(
      (s, h) => s + (h.cost_basis != null ? Number(h.cost_basis) : 0),
      0
    )

    return NextResponse.json({ holdings: holdings ?? [], totalValue, totalCostBasis })
  } catch (error) {
    console.error('Error fetching holdings:', error)
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 })
  }
}
