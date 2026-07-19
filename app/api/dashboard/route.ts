import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { accrueManualAccounts } from '@/lib/accrue'
import {
  RANGE_MONTHS,
  buildDashboardSummary,
  dashboardWindows,
  type CategoryMetaRow,
  type DashboardTxnRow,
  type SnapshotRow,
} from '@/lib/dashboard-math'
import type { DashboardRange } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await accrueManualAccounts(supabase, user.id)

    const { searchParams } = new URL(request.url)
    const rangeParam = searchParams.get('range') ?? '6m'
    const range: DashboardRange = rangeParam in RANGE_MONTHS ? (rangeParam as DashboardRange) : '6m'

    const now = new Date()
    const { cashFlowMonths, txnStart, historyStart } = dashboardWindows(range, now)

    let snapshotQuery = supabase
      .from('balance_snapshots')
      .select('account_id, balance, date')
      .eq('user_id', user.id)
      .order('date')
    if (historyStart) snapshotQuery = snapshotQuery.gte('date', historyStart)

    const [accountsRes, txnsRes, snapshotsRes, categoriesRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('*, plaid_items(institution_name, last_synced_at, status)')
        .eq('user_id', user.id)
        .eq('hidden', false)
        .order('balance', { ascending: false }),
      supabase
        .from('transactions')
        .select('amount, date, category_id')
        .eq('user_id', user.id)
        .gte('date', txnStart),
      snapshotQuery,
      supabase.from('categories').select('id, name, icon, color, is_transfer, is_income'),
    ])

    if (accountsRes.error) throw accountsRes.error
    if (txnsRes.error) throw txnsRes.error
    if (snapshotsRes.error) throw snapshotsRes.error
    if (categoriesRes.error) throw categoriesRes.error

    const accounts = accountsRes.data ?? []

    const summary = buildDashboardSummary({
      accounts,
      transactions: (txnsRes.data ?? []) as DashboardTxnRow[],
      snapshots: (snapshotsRes.data ?? []) as SnapshotRow[],
      categories: (categoriesRes.data ?? []) as CategoryMetaRow[],
      cashFlowMonths,
      now,
    })

    const { data: recentTransactions, error: recentError } = await supabase
      .from('transactions')
      .select('*, accounts(name, mask), categories(name, icon, color, is_income, is_transfer)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8)

    if (recentError) throw recentError

    return NextResponse.json({
      range,
      ...summary,
      recentTransactions: recentTransactions ?? [],
      accounts,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
