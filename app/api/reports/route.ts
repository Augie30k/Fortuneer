import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { buildReportsData, type ReportGroupBy, type ReportTxnRow } from '@/lib/reports-math'

/**
 * GET /api/reports?start&end&groupBy=category|merchant|account&accountId=
 * Totals, grouped spending breakdown, and Sankey (income sources -> budget -> categories).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const defaultStart = `${now.toISOString().slice(0, 7)}-01`
    const start = searchParams.get('start') ?? defaultStart
    const end = searchParams.get('end') ?? now.toISOString().slice(0, 10)
    const groupByParam = searchParams.get('groupBy')
    const groupBy: ReportGroupBy = ['category', 'merchant', 'account'].includes(groupByParam ?? '')
      ? (groupByParam as ReportGroupBy)
      : 'category'
    const accountId = searchParams.get('accountId')

    let query = supabase
      .from('transactions')
      .select(
        'amount, date, merchant_name, description, category_id, account_id, categories(name, icon, color, is_transfer, is_income), accounts(name)'
      )
      .eq('user_id', user.id)
      .eq('pending', false)
      .gte('date', start)
      .lte('date', end)

    if (accountId) query = query.eq('account_id', accountId)

    const { data: transactions, error } = await query.limit(10000)
    if (error) throw error

    const rows: ReportTxnRow[] = (transactions ?? []).map((t) => ({
      amount: t.amount,
      merchant_name: t.merchant_name,
      description: t.description,
      category_id: t.category_id,
      account_id: t.account_id,
      category: t.categories as unknown as ReportTxnRow['category'],
      account: t.accounts as unknown as ReportTxnRow['account'],
    }))

    return NextResponse.json(buildReportsData(rows, { start, end, groupBy }))
  } catch (error) {
    console.error('Error building report:', error)
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 })
  }
}
