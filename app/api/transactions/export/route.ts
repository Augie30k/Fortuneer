import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** GET /api/transactions/export — CSV of the user's transactions (honors the list filters) */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const accountId = searchParams.get('accountId')
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('transactions')
      .select('date, description, merchant_name, amount, pending, notes, accounts(name), categories(name)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(10000)

    if (q) query = query.or(`description.ilike.%${q}%,merchant_name.ilike.%${q}%`)
    if (accountId) query = query.eq('account_id', accountId)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query
    if (error) throw error

    const header = 'Date,Description,Vendor,Amount,Category,Account,Pending,Notes'
    const rows = (data ?? []).map((t) => {
      const account = t.accounts as unknown as { name: string } | null
      const category = t.categories as unknown as { name: string } | null
      // Flip sign for export: positive = money in, matching everyday expectations
      return [
        t.date,
        csvEscape(t.description),
        csvEscape(t.merchant_name),
        (-Number(t.amount)).toFixed(2),
        csvEscape(category?.name),
        csvEscape(account?.name),
        t.pending ? 'yes' : 'no',
        csvEscape(t.notes),
      ].join(',')
    })

    const csv = [header, ...rows].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fortuneer-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting transactions:', error)
    return NextResponse.json({ error: 'Failed to export transactions' }, { status: 500 })
  }
}
