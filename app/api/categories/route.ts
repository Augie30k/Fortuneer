import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS returns global (user_id null) + the user's own categories
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name')

    if (error) throw error

    // Once a global category has been personally forked, hide the now-
    // superseded shared row so the user sees only their own copy.
    const forkedFromIds = new Set(
      (categories ?? []).filter((c) => c.forked_from).map((c) => c.forked_from)
    )
    const visible = (categories ?? []).filter(
      (c) => !(c.user_id === null && forkedFromIds.has(c.id))
    )

    return NextResponse.json({ categories: visible })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

/** POST /api/categories — create a custom category */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body.name ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }
    const isIncome = body.is_income === true
    // Income categories always share one group — "Income" — regardless of
    // what's submitted, so the group never fragments into several.
    const groupName = isIncome
      ? 'Income'
      : String(body.group_name ?? 'Other').trim().slice(0, 30) || 'Other'

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        icon: body.icon ?? 'circle-ellipsis',
        color: body.color ?? '#8E8E93',
        group_name: groupName,
        is_income: isIncome,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

/** DELETE /api/categories?id=<uuid> — delete a custom category (transactions keep data, category unset) */
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

    // RLS restricts deletes to the user's own categories; global ones are untouchable
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
