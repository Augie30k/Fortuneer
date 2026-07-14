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
    const accountIds = (accounts ?? []).map((a) => a.id)

    let monthlySpending = 0
    let transactionsCount = 0
    let recentTransactions: unknown[] = []

    if (accountIds.length > 0) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const [monthlyResult, countResult, recentResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount')
          .in('account_id', accountIds)
          .eq('type', 'debit')
          .gte('date', startOfMonth.toISOString().slice(0, 10)),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .in('account_id', accountIds),
        supabase
          .from('transactions')
          .select('*')
          .in('account_id', accountIds)
          .order('date', { ascending: false })
          .limit(5),
      ])

      if (monthlyResult.error) throw monthlyResult.error
      if (countResult.error) throw countResult.error
      if (recentResult.error) throw recentResult.error

      monthlySpending = (monthlyResult.data ?? []).reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0
      )
      transactionsCount = countResult.count ?? 0
      recentTransactions = recentResult.data ?? []
    }

    return NextResponse.json({
      accounts: accounts ?? [],
      recentTransactions,
      metrics: {
        totalAssets,
        totalLiabilities,
        netWorth,
        monthlySpending,
        accountsCount: accounts?.length ?? 0,
        transactionsCount,
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
