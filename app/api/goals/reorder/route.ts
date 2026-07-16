import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * POST /api/goals/reorder — persist a drag result from the Budgets page's
 * "Prioritize" mode. Body: { ids: string[] } — this user's goal ids in the
 * new order; each id's array index becomes its priority (lower renders and
 * claims auto-save room first, per lib/goal-math.ts).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const ids = body.ids
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 300) {
      return NextResponse.json({ error: 'Invalid goal list' }, { status: 400 })
    }

    await Promise.all(
      ids.map((id: string, index: number) =>
        supabase.from('goals').update({ priority: index }).eq('id', id).eq('user_id', user.id)
      )
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error reordering goals:', error)
    return NextResponse.json({ error: 'Failed to reorder goals' }, { status: 500 })
  }
}
