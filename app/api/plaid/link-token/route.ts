import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from '@/lib/plaid'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data } = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Fortuneer',
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: 'en',
      ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
      // Required for OAuth institutions (Wealthfront, etc.) — must exactly
      // match a redirect URI configured in the Plaid Dashboard so Link can
      // hand the browser back to app/api/plaid/callback after the bank's
      // own auth step.
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    })

    return NextResponse.json({ link_token: data.link_token })
  } catch (error) {
    console.error('Error creating link token:', error)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
