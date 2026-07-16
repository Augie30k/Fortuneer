import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { undoAgentAction } from '@/lib/vera-tools'

/** POST /api/vera/undo { action_id } — revert a change Vera made */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action_id } = await request.json()
    if (!action_id || typeof action_id !== 'string') {
      return NextResponse.json({ error: 'Missing action_id' }, { status: 400 })
    }

    const result = await undoAgentAction(supabase, user.id, action_id)
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, message: result.message })
  } catch (error) {
    console.error('Vera undo error:', error)
    return NextResponse.json({ error: 'Failed to undo' }, { status: 500 })
  }
}
