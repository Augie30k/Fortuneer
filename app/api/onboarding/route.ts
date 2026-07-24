import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const PERSONAS = new Set(['debt', 'saving', 'budgeting', 'overview', 'investing'])
const FOCUS_AREAS = new Set(['budgets', 'goals', 'recurring', 'investments', 'reports', 'projections'])

/** POST /api/onboarding — persist first-login personalization choices and mark
 *  the profile onboarded. Every field is optional (any step can be skipped);
 *  a bare `{}` body simply completes the flow with defaults. */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const updates: Record<string, unknown> = { onboarded_at: new Date().toISOString() }
    if (typeof body.preferred_name === 'string') {
      updates.preferred_name = body.preferred_name.trim().slice(0, 60) || null
    }
    if (typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency)) {
      updates.currency = body.currency
    }
    if (typeof body.persona === 'string' && PERSONAS.has(body.persona)) {
      updates.persona = body.persona
    }
    if (Array.isArray(body.focus_areas)) {
      updates.focus_areas = [
        ...new Set(body.focus_areas.filter((a: unknown): a is string => typeof a === 'string' && FOCUS_AREAS.has(a))),
      ].slice(0, 6)
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error

    // Optional first goal — a real row on the Goals page from day one. A
    // failure here shouldn't strand the user in onboarding, so it only warns.
    let goal = null
    const g = body.goal
    if (
      g &&
      typeof g.name === 'string' &&
      g.name.trim() &&
      typeof g.target_amount === 'number' &&
      g.target_amount > 0
    ) {
      const { data, error: goalError } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          name: g.name.trim().slice(0, 80),
          target_amount: g.target_amount,
          target_date: typeof g.target_date === 'string' && g.target_date ? g.target_date : null,
          icon: typeof g.icon === 'string' ? g.icon : null,
          color: typeof g.color === 'string' ? g.color : null,
        })
        .select()
        .single()
      if (goalError) console.warn('Onboarding goal creation failed (continuing):', goalError)
      else goal = data
    }

    return NextResponse.json({ profile, goal })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }
}
