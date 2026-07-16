import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const LIABILITY_TYPES = new Set(['credit', 'loan'])
const RANGE_MONTHS: Record<string, number | null> = {
  '1m': 1, '3m': 3, '6m': 6, '1y': 12, all: null,
}
const VALID_TYPES = new Set(['depository', 'credit', 'loan', 'investment', 'other'])

/** GET /api/networth?range=6m&types=depository,credit — filtered net-worth history */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') ?? '6m'
    const rangeMonths = range in RANGE_MONTHS ? RANGE_MONTHS[range] : 6
    const typesParam = searchParams.get('types')
    const types = typesParam
      ? new Set(typesParam.split(',').filter((t) => VALID_TYPES.has(t)))
      : null

    const now = new Date()
    const historyStart = rangeMonths
      ? new Date(now.getFullYear(), now.getMonth() - rangeMonths, now.getDate())
          .toISOString()
          .slice(0, 10)
      : null

    let snapshotQuery = supabase
      .from('balance_snapshots')
      .select('account_id, balance, date')
      .eq('user_id', user.id)
      .order('date')
    if (historyStart) snapshotQuery = snapshotQuery.gte('date', historyStart)

    const [accountsRes, snapshotsRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, type')
        .eq('user_id', user.id)
        .eq('hidden', false),
      snapshotQuery,
    ])

    if (accountsRes.error) throw accountsRes.error
    if (snapshotsRes.error) throw snapshotsRes.error

    const accountType = new Map(
      (accountsRes.data ?? [])
        .filter((a) => !types || types.has(a.type))
        .map((a) => [a.id, a.type])
    )

    const lastBalance = new Map<string, number>()
    const byDate = new Map<string, { account_id: string; balance: number }[]>()
    for (const s of snapshotsRes.data ?? []) {
      if (!accountType.has(s.account_id)) continue
      if (!byDate.has(s.date)) byDate.set(s.date, [])
      byDate.get(s.date)!.push(s)
    }

    const history = [...byDate.keys()].sort().map((date) => {
      for (const s of byDate.get(date)!) lastBalance.set(s.account_id, Number(s.balance))
      let assets = 0
      let liabilities = 0
      for (const [accountId, balance] of lastBalance) {
        if (LIABILITY_TYPES.has(accountType.get(accountId) ?? '')) liabilities += balance
        else assets += balance
      }
      return { date, assets, liabilities, netWorth: assets - liabilities }
    })

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Error fetching net worth history:', error)
    return NextResponse.json({ error: 'Failed to fetch net worth history' }, { status: 500 })
  }
}
