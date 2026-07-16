import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { plaidClient } from '@/lib/plaid'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

/** PATCH /api/profile — update display name / currency preference */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (typeof body.full_name === 'string') updates.full_name = body.full_name.trim() || null
    if (typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency)) {
      updates.currency = body.currency
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

/** DELETE /api/profile — permanently delete the account and all of its data.
 *  Every user-owned table cascades from auth.users(id) on delete, so removing
 *  the auth user is enough to clean up accounts/transactions/budgets/etc. */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: items } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('user_id', user.id)

    await Promise.all(
      (items ?? []).map((item) =>
        plaidClient.itemRemove({ access_token: item.access_token }).catch((e) =>
          console.warn('Plaid itemRemove failed during account deletion (continuing):', e)
        )
      )
    )

    const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
