import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { applyCategoryEdit } from '@/lib/category-fork'

/**
 * POST /api/categories/groups/rename — body: { from, to }.
 * Renames a budget category group for this user by applying a group_name
 * edit to every category currently in that group (forking built-ins as
 * needed) — a bulk version of the single-category edit.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const from = String(body.from ?? '').trim()
    const to = String(body.to ?? '').trim().slice(0, 30)

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing from/to' }, { status: 400 })
    }
    if (from === to) {
      return NextResponse.json({ renamed: 0 })
    }

    // RLS scopes this to global + the user's own categories automatically
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id')
      .eq('group_name', from)
    if (error) throw error

    let renamed = 0
    for (const c of categories ?? []) {
      const result = await applyCategoryEdit(supabase, user.id, c.id, { group_name: to })
      if (result) renamed++
    }

    return NextResponse.json({ renamed })
  } catch (error) {
    console.error('Error renaming group:', error)
    return NextResponse.json({ error: 'Failed to rename group' }, { status: 500 })
  }
}
