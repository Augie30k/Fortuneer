import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { syncPlaidItem } from '@/lib/plaid-sync'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: items, error } = await supabase
      .from('plaid_items')
      .select('id, user_id, item_id, access_token, sync_cursor')
      .eq('user_id', user.id)

    if (error) throw error

    let added = 0
    let modified = 0
    let removed = 0
    const failures: string[] = []

    for (const item of items ?? []) {
      try {
        const counts = await syncPlaidItem(supabase, item)
        added += counts.added
        modified += counts.modified
        removed += counts.removed
      } catch (e) {
        console.error(`Sync failed for item ${item.item_id}:`, e)
        failures.push(item.item_id)
        await supabase.from('plaid_items').update({ status: 'error' }).eq('id', item.id)
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      items: items?.length ?? 0,
      added,
      modified,
      removed,
      failures,
    })
  } catch (error) {
    console.error('Error syncing:', error)
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 })
  }
}
