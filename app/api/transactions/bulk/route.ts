import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** POST /api/transactions/bulk — recategorize many transactions at once */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, category_id } = body

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !category_id) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({ category_id })
      .eq('user_id', user.id)
      .in('id', ids)
      .select('id')

    if (error) throw error

    return NextResponse.json({ updated: data?.length ?? 0 })
  } catch (error) {
    console.error('Error bulk updating transactions:', error)
    return NextResponse.json({ error: 'Failed to update transactions' }, { status: 500 })
  }
}
