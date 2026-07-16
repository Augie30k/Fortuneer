import type { SupabaseClient } from '@supabase/supabase-js'

interface CategoryFields {
  name?: string
  icon?: string
  color?: string
  group_name?: string
  sort_order?: number
  is_income?: boolean
}

/** Income categories always share a single group, regardless of whatever
 *  group_name was submitted — that's what makes "Income" a coherent group
 *  instead of fragmenting into "Paycheck", "Freelance", etc. */
function resolveGroupName(effectiveIsIncome: boolean, requestedGroupName: string): string {
  return effectiveIsIncome ? 'Income' : requestedGroupName
}

/**
 * Applies an edit to a category for a specific user.
 *
 * Global (shared) categories are never mutated in place — that would change
 * them for every user. Instead, editing one forks a personal copy and
 * repoints this user's own transactions, budgets, and rules from the
 * original category onto the fork, so history and spend stay intact and
 * nobody else is affected. Categories the user already owns are updated
 * directly.
 */
export async function applyCategoryEdit(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  fields: CategoryFields
): Promise<{ id: string; forked: boolean } | null> {
  const { data: category, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .maybeSingle()

  if (error || !category) return null
  // RLS already scopes visibility to global + own; guard explicitly too
  if (category.user_id !== null && category.user_id !== userId) return null

  const effectiveIsIncome = fields.is_income ?? category.is_income

  if (category.user_id === userId) {
    const updates: Record<string, unknown> = {}
    if (fields.name !== undefined) updates.name = fields.name
    if (fields.icon !== undefined) updates.icon = fields.icon
    if (fields.color !== undefined) updates.color = fields.color
    if (fields.is_income !== undefined) updates.is_income = fields.is_income
    if (fields.group_name !== undefined || fields.is_income !== undefined) {
      updates.group_name = resolveGroupName(effectiveIsIncome, fields.group_name ?? category.group_name)
    }
    if (fields.sort_order !== undefined) updates.sort_order = fields.sort_order
    if (Object.keys(updates).length === 0) return { id: category.id, forked: false }

    const { error: updateError } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', category.id)
    if (updateError) throw updateError
    return { id: category.id, forked: false }
  }

  // Global category — fork a personal copy instead of mutating the shared row
  const { data: forked, error: insertError } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: fields.name ?? category.name,
      icon: fields.icon ?? category.icon,
      color: fields.color ?? category.color,
      group_name: resolveGroupName(effectiveIsIncome, fields.group_name ?? category.group_name),
      sort_order: fields.sort_order ?? category.sort_order,
      is_income: effectiveIsIncome,
      is_transfer: category.is_transfer,
      plaid_pfc: null,
      forked_from: category.id,
    })
    .select('id')
    .single()

  if (insertError || !forked) throw insertError ?? new Error('fork failed')

  await Promise.all([
    supabase
      .from('transactions')
      .update({ category_id: forked.id })
      .eq('user_id', userId)
      .eq('category_id', category.id),
    supabase
      .from('budgets')
      .update({ category_id: forked.id })
      .eq('user_id', userId)
      .eq('category_id', category.id),
    supabase
      .from('rules')
      .update({ category_id: forked.id })
      .eq('user_id', userId)
      .eq('category_id', category.id),
  ])

  return { id: forked.id, forked: true }
}
