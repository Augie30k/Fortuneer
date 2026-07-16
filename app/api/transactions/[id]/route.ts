import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const { data: existing, error: readError } = await supabase
      .from('transactions')
      .select('id, plaid_transaction_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (readError || !existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if ('category_id' in body) updates.category_id = body.category_id
    if ('notes' in body) updates.notes = body.notes
    if ('description' in body && body.description) updates.description = body.description
    if ('merchant_name' in body) {
      updates.merchant_name = String(body.merchant_name ?? '').trim() || null
    }

    // Amount, date, and account come from the bank on synced transactions —
    // only manual entries can change them
    const isManual = existing.plaid_transaction_id === null
    if (isManual) {
      if ('amount' in body && typeof body.amount === 'number' && isFinite(body.amount)) {
        updates.amount = body.amount
      }
      if ('date' in body && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
        updates.date = body.date
      }
      if ('account_id' in body && typeof body.account_id === 'string') {
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('id', body.account_id)
          .eq('user_id', user.id)
          .single()
        if (!account) {
          return NextResponse.json({ error: 'Account not found' }, { status: 400 })
        }
        updates.account_id = body.account_id
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, accounts(name, mask), categories(name, icon, color, is_income, is_transfer)')
      .single()

    if (error) throw error

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}

/** DELETE /api/transactions/[id] */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
