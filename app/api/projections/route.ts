import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** GET /api/projections — the user's saved scenarios, newest-updated first. */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('projection_scenarios')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ scenarios: data ?? [] })
  } catch (error) {
    console.error('Error fetching projection scenarios:', error)
    return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 })
  }
}

/** POST /api/projections — create a scenario { name, assumptions, events }. */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, assumptions, events } = body

    if (!assumptions || typeof assumptions !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('projection_scenarios')
      .insert({
        user_id: user.id,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : 'My trajectory',
        assumptions,
        events: Array.isArray(events) ? events : [],
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating projection scenario:', error)
    return NextResponse.json({ error: 'Failed to create scenario' }, { status: 500 })
  }
}

/** PUT /api/projections — update a scenario { id, name?, assumptions?, events? }. */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, assumptions, events } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof name === 'string' && name.trim()) updates.name = name.trim().slice(0, 80)
    if (assumptions && typeof assumptions === 'object') updates.assumptions = assumptions
    if (Array.isArray(events)) updates.events = events

    const { data, error } = await supabase
      .from('projection_scenarios')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating projection scenario:', error)
    return NextResponse.json({ error: 'Failed to update scenario' }, { status: 500 })
  }
}

/** DELETE /api/projections?id=<uuid> */
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

    const { error } = await supabase
      .from('projection_scenarios')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting projection scenario:', error)
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 })
  }
}
