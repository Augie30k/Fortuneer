import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { fetchInstitutionLogo, plaidClient } from '@/lib/plaid'
import { syncPlaidItem } from '@/lib/plaid-sync'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { public_token, institution } = body

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 })
    }

    const { data: exchange } = await plaidClient.itemPublicTokenExchange({
      public_token,
    })

    const logoUrl = institution?.institution_id
      ? await fetchInstitutionLogo(institution.institution_id)
      : null

    const { data: item, error } = await supabase
      .from('plaid_items')
      .insert({
        user_id: user.id,
        item_id: exchange.item_id,
        access_token: exchange.access_token,
        institution_id: institution?.institution_id ?? null,
        institution_name: institution?.name ?? null,
        logo_url: logoUrl,
      })
      .select('id, user_id, item_id, access_token, sync_cursor')
      .single()

    if (error) throw error

    // Initial sync so accounts/transactions appear immediately after linking
    const counts = await syncPlaidItem(supabase, item)

    return NextResponse.json({ ok: true, item_id: exchange.item_id, ...counts })
  } catch (error) {
    console.error('Error exchanging public token:', error)
    return NextResponse.json({ error: 'Failed to connect account' }, { status: 500 })
  }
}
