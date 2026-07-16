import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { applyCategoryEdit } from '@/lib/category-fork'

/**
 * POST /api/categories/reorder — persist a full drag result.
 * Body: { groups: [{ name, categoryIds }] } — group array order is the
 * group order; each categoryIds array is that group's category order.
 * Cross-group drags are expressed simply by a category id appearing under
 * a different group's entry than before.
 *
 * Built-in categories fork (like any other edit) when their position or
 * group changes, so returns an old-id -> new-id mapping for the caller to
 * reconcile local state and in-flight budget-amount drafts.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const groups = body.groups
    if (!Array.isArray(groups) || groups.length === 0) {
      return NextResponse.json({ error: 'Missing groups' }, { status: 400 })
    }

    const flattened: { id: string; group_name: string }[] = []
    for (const g of groups) {
      const name = String(g?.name ?? '').trim()
      const categoryIds = Array.isArray(g?.categoryIds) ? g.categoryIds : []
      if (!name) continue
      for (const id of categoryIds) {
        if (typeof id === 'string') flattened.push({ id, group_name: name })
      }
    }

    if (flattened.length === 0 || flattened.length > 300) {
      return NextResponse.json({ error: 'Invalid category list' }, { status: 400 })
    }

    const results = await Promise.all(
      flattened.map(async ({ id, group_name }, index) => {
        const result = await applyCategoryEdit(supabase, user.id, id, {
          group_name,
          sort_order: index,
        })
        return { old_id: id, id: result?.id ?? id, forked: result?.forked ?? false }
      })
    )

    return NextResponse.json({ ok: true, mapping: results })
  } catch (error) {
    console.error('Error reordering categories:', error)
    return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 })
  }
}
