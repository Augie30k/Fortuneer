import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rules, error } = await supabase
      .from('rules')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ rules: rules ?? [] })
  } catch (error) {
    console.error('Error fetching rules:', error)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

interface RuleFields {
  matcher: string
  match_field: 'merchant' | 'description'
  match_type: 'contains' | 'exact'
  amount_min: number | null
  amount_max: number | null
  category_id: string
}

/** Validate + normalize the rule fields shared by POST and PATCH */
function parseRuleFields(body: Record<string, unknown>): RuleFields | null {
  const matcher = String(body.matcher ?? '').trim().toLowerCase()
  const matchField = body.match_field === 'description' ? 'description' : 'merchant'
  const matchType = body.match_type === 'exact' ? 'exact' : 'contains'
  const amountMin = typeof body.amount_min === 'number' && isFinite(body.amount_min) ? body.amount_min : null
  const amountMax = typeof body.amount_max === 'number' && isFinite(body.amount_max) ? body.amount_max : null
  const categoryId = typeof body.category_id === 'string' ? body.category_id : ''

  if (matcher.length < 2 || !categoryId) return null
  if (amountMin != null && amountMax != null && amountMin > amountMax) return null

  return {
    matcher,
    match_field: matchField,
    match_type: matchType,
    amount_min: amountMin,
    amount_max: amountMax,
    category_id: categoryId,
  }
}

/** Retroactively recategorize the user's existing transactions matching a rule */
async function applyRuleRetroactively(
  supabase: SupabaseClient,
  userId: string,
  fields: RuleFields
): Promise<number> {
  const column = fields.match_field === 'merchant' ? 'merchant_name' : 'description'
  let query = supabase
    .from('transactions')
    .update({ category_id: fields.category_id })
    .eq('user_id', userId)

  // ilike without wildcards = case-insensitive equality
  query =
    fields.match_type === 'exact'
      ? query.ilike(column, fields.matcher)
      : query.ilike(column, `%${fields.matcher}%`)

  if (fields.amount_min != null) query = query.gte('amount', fields.amount_min)
  if (fields.amount_max != null) query = query.lte('amount', fields.amount_max)

  const { data: updated, error } = await query.select('id')
  if (error) throw error
  return updated?.length ?? 0
}

/** POST /api/rules — create a rule; retroactively applies unless `apply: false` */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const fields = parseRuleFields(body)
    if (!fields) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: rule, error } = await supabase
      .from('rules')
      .insert({ user_id: user.id, ...fields })
      .select('*, categories(name, icon, color)')
      .single()

    if (error) throw error

    const applied = body.apply === false ? 0 : await applyRuleRetroactively(supabase, user.id, fields)

    return NextResponse.json({ rule, applied })
  } catch (error) {
    console.error('Error creating rule:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}

/** PATCH /api/rules — edit a rule; retroactively re-applies unless `apply: false` */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const fields = parseRuleFields(body)
    if (!body.id || !fields) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: rule, error } = await supabase
      .from('rules')
      .update(fields)
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select('*, categories(name, icon, color)')
      .single()

    if (error) throw error

    const applied = body.apply === false ? 0 : await applyRuleRetroactively(supabase, user.id, fields)

    return NextResponse.json({ rule, applied })
  } catch (error) {
    console.error('Error updating rule:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

/** DELETE /api/rules?id=<uuid> */
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

    const { error } = await supabase.from('rules').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting rule:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
