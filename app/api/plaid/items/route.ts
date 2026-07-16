import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid'

/** GET /api/plaid/items — connected institutions with account counts */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: items, error } = await supabase
      .from('plaid_items')
      .select('id, institution_name, institution_id, status, last_synced_at, created_at, accounts(id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      items: (items ?? []).map((i) => ({
        ...i,
        account_count: (i.accounts as { id: string }[] | null)?.length ?? 0,
        accounts: undefined,
      })),
    })
  } catch (error) {
    console.error('Error fetching plaid items:', error)
    return NextResponse.json({ error: 'Failed to fetch institutions' }, { status: 500 })
  }
}

/** DELETE /api/plaid/items?id=<uuid> — disconnect an institution and remove its data */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data: item, error: readError } = await supabase
      .from('plaid_items')
      .select('id, access_token')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (readError || !item) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
    }

    // Revoke on Plaid's side first; still remove locally if already revoked
    try {
      await plaidClient.itemRemove({ access_token: item.access_token })
    } catch (e) {
      console.warn('Plaid itemRemove failed (continuing with local delete):', e)
    }

    // Cascades: accounts -> transactions + balance_snapshots
    const { error: deleteError } = await supabase
      .from('plaid_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error disconnecting institution:', error)
    return NextResponse.json({ error: 'Failed to disconnect institution' }, { status: 500 })
  }
}
