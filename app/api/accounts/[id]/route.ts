import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** PATCH /api/accounts/[id] — rename, hide/unhide, or (manual only) edit balance */
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

    const { data: account, error: readError } = await supabase
      .from('accounts')
      .select('id, is_manual')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (readError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if (typeof body.hidden === 'boolean') updates.hidden = body.hidden
    if (account.is_manual && typeof body.balance === 'number') updates.balance = body.balance
    if (account.is_manual && typeof body.apy === 'number' && body.apy >= 0 && body.apy <= 100) {
      updates.apy = body.apy
      updates.last_accrued_at = new Date().toISOString()
    }
    if (
      account.is_manual &&
      ['daily', 'weekly', 'monthly', 'yearly'].includes(body.compound_frequency)
    ) {
      updates.compound_frequency = body.compound_frequency
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data: updated, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, plaid_items(institution_name, last_synced_at, status)')
      .single()

    if (error) throw error

    // Balance edits update today's net-worth snapshot too
    if ('balance' in updates) {
      await supabase.from('balance_snapshots').upsert(
        {
          user_id: user.id,
          account_id: id,
          balance: updates.balance as number,
          date: new Date().toISOString().slice(0, 10),
        },
        { onConflict: 'account_id,date' }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

/**
 * DELETE /api/accounts/[id] — remove one account.
 * Manual accounts delete outright. Plaid-linked accounts are also added to an
 * exclusion list so the next sync doesn't resurrect them; the institution's
 * other accounts are untouched.
 */
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

    const { data: account, error: readError } = await supabase
      .from('accounts')
      .select('id, is_manual, plaid_account_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (readError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (!account.is_manual && account.plaid_account_id) {
      const { error: exclusionError } = await supabase
        .from('excluded_plaid_accounts')
        .upsert(
          { user_id: user.id, plaid_account_id: account.plaid_account_id },
          { onConflict: 'user_id,plaid_account_id' }
        )
      if (exclusionError) throw exclusionError
    }

    // Cascades: transactions + balance_snapshots + holdings
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
