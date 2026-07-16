import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * POST /api/transactions/import — bulk import rows into one account.
 * Body: { account_id, rows: [{ date, description, amount, category? }] }
 * amount follows the export convention: positive = money in (flipped to
 * Plaid's outflow-positive on write).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { account_id, rows } = body

    if (!account_id || !Array.isArray(rows) || rows.length === 0 || rows.length > 2000) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Resolve category names to ids (global + user categories)
    const { data: categories } = await supabase.from('categories').select('id, name')
    const categoryByName = new Map(
      (categories ?? []).map((c) => [c.name.toLowerCase(), c.id])
    )

    const valid = rows
      .filter(
        (r: { date?: string; description?: string; amount?: unknown }) =>
          typeof r.date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
          typeof r.description === 'string' &&
          r.description.trim() &&
          Number.isFinite(Number(r.amount))
      )
      .map((r: { date: string; description: string; amount: unknown; category?: string }) => ({
        user_id: user.id,
        account_id,
        date: r.date,
        description: r.description.trim(),
        amount: -Number(r.amount), // export convention -> Plaid convention
        category_id: r.category
          ? (categoryByName.get(String(r.category).trim().toLowerCase()) ?? null)
          : null,
      }))

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows' }, { status: 400 })
    }

    for (let i = 0; i < valid.length; i += 500) {
      const { error } = await supabase.from('transactions').insert(valid.slice(i, i + 500))
      if (error) throw error
    }

    return NextResponse.json({ imported: valid.length, skipped: rows.length - valid.length })
  } catch (error) {
    console.error('Error importing transactions:', error)
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 })
  }
}
