import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch accounts from database
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate metrics
    const totalAssets = accounts
      ?.filter(acc => ['checking', 'savings', 'investment'].includes(acc.type))
      .reduce((sum, acc) => sum + acc.balance, 0) ?? 0

    const totalLiabilities = accounts
      ?.filter(acc => ['credit', 'loan'].includes(acc.type))
      .reduce((sum, acc) => sum + acc.balance, 0) ?? 0

    const netWorth = totalAssets - totalLiabilities

    return NextResponse.json({
      accounts: accounts ?? [],
      metrics: {
        totalAssets,
        totalLiabilities,
        netWorth,
        accountsCount: accounts?.length ?? 0,
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
