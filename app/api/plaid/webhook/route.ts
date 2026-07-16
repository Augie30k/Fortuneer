import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyPlaidWebhook } from '@/lib/plaid'
import { syncPlaidItem } from '@/lib/plaid-sync'

interface PlaidWebhookPayload {
  webhook_type?: string
  webhook_code?: string
  item_id?: string
}

/** POST /api/plaid/webhook — receives Plaid item webhooks; syncs on SYNC_UPDATES_AVAILABLE. */
export async function POST(request: Request) {
  const rawBody = await request.text()

  try {
    await verifyPlaidWebhook(rawBody, request.headers.get('plaid-verification'))
  } catch (error) {
    console.warn('Rejected Plaid webhook:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: PlaidWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { webhook_type, webhook_code, item_id } = payload
  if (webhook_type !== 'TRANSACTIONS' || webhook_code !== 'SYNC_UPDATES_AVAILABLE' || !item_id) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  // No user session on a webhook request — look the item up (and sync) with
  // the service-role client, scoped by Plaid's own item_id.
  const supabase = createAdminClient()
  const { data: item, error } = await supabase
    .from('plaid_items')
    .select('id, user_id, item_id, access_token, sync_cursor')
    .eq('item_id', item_id)
    .maybeSingle()

  if (error || !item) {
    console.warn(`Webhook for unknown Plaid item ${item_id}`)
    return NextResponse.json({ ok: true })
  }

  try {
    await syncPlaidItem(supabase, item)
  } catch (e) {
    console.error(`Webhook sync failed for item ${item_id}:`, e)
    await supabase.from('plaid_items').update({ status: 'error' }).eq('id', item.id)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
