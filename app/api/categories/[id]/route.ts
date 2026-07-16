import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { applyCategoryEdit } from '@/lib/category-fork'

/** PATCH /api/categories/[id] — edit name/icon/color/group. Forks built-in categories. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const fields: { name?: string; icon?: string; color?: string; group_name?: string; is_income?: boolean } = {}
    if (typeof body.name === 'string' && body.name.trim()) fields.name = body.name.trim()
    if (typeof body.icon === 'string' && body.icon) fields.icon = body.icon
    if (typeof body.color === 'string' && body.color) fields.color = body.color
    if (typeof body.group_name === 'string' && body.group_name.trim()) {
      fields.group_name = body.group_name.trim().slice(0, 30)
    }
    if (typeof body.is_income === 'boolean') fields.is_income = body.is_income

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const result = await applyCategoryEdit(supabase, user.id, id, fields)
    if (!result) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const { data: category, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', result.id)
      .single()
    if (error) throw error

    return NextResponse.json({ ...category, forked: result.forked })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

/** DELETE /api/categories/[id] — only categories the user owns can be deleted */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data: category, error: readError } = await supabase
      .from('categories')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (readError || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    if (category.user_id !== user.id) {
      return NextResponse.json(
        { error: "Built-in categories can't be deleted" },
        { status: 400 }
      )
    }

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
