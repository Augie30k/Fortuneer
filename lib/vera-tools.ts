import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveBudgetsForMonth } from './effective-budget'
import { setBudgetAmount } from './budget-write'
import { recordGoalContribution } from './goal-contributions'

/**
 * Vera's tool belt. Safety model:
 * - Every query runs through the caller's RLS-scoped Supabase client, so
 *   Vera can only ever touch the authenticated user's rows.
 * - There are NO delete tools. The only way an agent action removes data is
 *   undoing its own creation.
 * - Every write logs an agent_actions row with a prior-state snapshot, and
 *   /api/vera/undo can revert it.
 * - Amounts are validated to a sane range before touching the database.
 */

const MAX_AMOUNT = 1_000_000

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

async function logAction(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  description: string,
  undo: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('agent_actions')
    .insert({ user_id: userId, tool: toolName, description, undo })
    .select('id')
    .single()
  if (error) {
    console.error('Failed to log agent action:', error)
    return null
  }
  return data.id
}

/** Case-insensitive category match: exact name first, then contains */
async function resolveCategory(supabase: SupabaseClient, name: string) {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, user_id, forked_from, is_income, is_transfer')
    .order('sort_order', { ascending: true })
  const list = (categories ?? []).filter((c) => !c.is_income && !c.is_transfer)
  // Hide globals superseded by a personal fork (same rule as the API)
  const forkedFrom = new Set(list.filter((c) => c.forked_from).map((c) => c.forked_from))
  const visible = list.filter((c) => !(c.user_id === null && forkedFrom.has(c.id)))
  const needle = name.trim().toLowerCase()
  return (
    visible.find((c) => c.name.toLowerCase() === needle) ??
    visible.find((c) => c.name.toLowerCase().includes(needle)) ??
    null
  )
}

export function buildVeraTools(supabase: SupabaseClient, userId: string) {
  return {
    get_financial_snapshot: tool({
      description:
        'Current net worth, total assets/liabilities, and every account with its balance and type.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('name, type, balance, is_manual, hidden')
          .eq('user_id', userId)
          .eq('hidden', false)
        const rows = accounts ?? []
        const liabilityTypes = new Set(['credit', 'loan'])
        let assets = 0
        let liabilities = 0
        for (const a of rows) {
          if (liabilityTypes.has(a.type)) liabilities += Number(a.balance)
          else assets += Number(a.balance)
        }
        return {
          netWorth: assets - liabilities,
          totalAssets: assets,
          totalLiabilities: liabilities,
          accounts: rows.map((a) => ({
            name: a.name,
            type: a.type,
            balance: Number(a.balance),
            manual: a.is_manual,
          })),
        }
      },
    }),

    get_budgets: tool({
      description:
        "The user's budget for a month ('YYYY-MM', default current): each category's budgeted amount and actual spend so far.",
      inputSchema: z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      }),
      execute: async ({ month }) => {
        const target = month ?? currentMonth()
        const [y, m] = target.split('-').map(Number)
        const start = `${target}-01`
        const end = new Date(y, m, 1).toISOString().slice(0, 10)
        const [{ data: budgetRows }, { data: txns }] = await Promise.all([
          supabase
            .from('budgets')
            .select('id, category_id, amount, month, categories(name)')
            .eq('user_id', userId)
            .lte('month', start),
          supabase
            .from('transactions')
            .select('category_id, amount')
            .eq('user_id', userId)
            .gt('amount', 0)
            .gte('date', start)
            .lt('date', end),
        ])
        const spent = new Map<string, number>()
        for (const t of txns ?? []) {
          if (t.category_id) spent.set(t.category_id, (spent.get(t.category_id) ?? 0) + t.amount)
        }
        const effective = effectiveBudgetsForMonth(budgetRows ?? [], target).filter(
          (b) => Number(b.amount) > 0
        )
        return {
          month: target,
          budgets: effective.map((b) => ({
            category: (b.categories as unknown as { name: string } | null)?.name ?? 'Unknown',
            budgeted: Number(b.amount),
            spent: spent.get(b.category_id) ?? 0,
          })),
        }
      },
    }),

    get_spending_summary: tool({
      description:
        'Income, expenses, and top spending categories between two dates (defaults to the current month).',
      inputSchema: z.object({
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
      execute: async ({ start_date, end_date }) => {
        const now = new Date()
        const start = start_date ?? `${currentMonth()}-01`
        const end = end_date ?? now.toISOString().slice(0, 10)
        const { data: txns } = await supabase
          .from('transactions')
          .select('amount, category_id, categories(name, is_transfer)')
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end)
        let income = 0
        let expenses = 0
        const byCategory = new Map<string, number>()
        for (const t of txns ?? []) {
          const cat = t.categories as unknown as { name: string; is_transfer: boolean } | null
          if (cat?.is_transfer) continue
          if (t.amount < 0) income += -t.amount
          else {
            expenses += t.amount
            const name = cat?.name ?? 'Uncategorized'
            byCategory.set(name, (byCategory.get(name) ?? 0) + t.amount)
          }
        }
        return {
          start,
          end,
          income,
          expenses,
          net: income - expenses,
          topCategories: [...byCategory.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, amount]) => ({ name, amount })),
        }
      },
    }),

    search_transactions: tool({
      description:
        'Search transactions by vendor text. Amounts > 0 are expenses, < 0 income.',
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(25).optional(),
      }),
      execute: async ({ query, limit }) => {
        const { data: txns } = await supabase
          .from('transactions')
          .select('description, merchant_name, amount, date, categories(name)')
          .eq('user_id', userId)
          .or(`description.ilike.%${query}%,merchant_name.ilike.%${query}%`)
          .order('date', { ascending: false })
          .limit(limit ?? 10)
        return {
          transactions: (txns ?? []).map((t) => ({
            vendor: t.merchant_name ?? t.description,
            amount: Number(t.amount),
            date: t.date,
            category: (t.categories as unknown as { name: string } | null)?.name ?? 'Uncategorized',
          })),
        }
      },
    }),

    get_goals: tool({
      description: "The user's savings goals with progress and target dates.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: goals } = await supabase
          .from('goals')
          .select('name, target_amount, saved_amount, target_date')
          .eq('user_id', userId)
        return {
          goals: (goals ?? []).map((g) => ({
            name: g.name,
            target: Number(g.target_amount),
            saved: Number(g.saved_amount),
            targetDate: g.target_date,
          })),
        }
      },
    }),

    set_budget: tool({
      description:
        "Set a budget category's monthly amount. Applies to the given month only unless apply_to_future_months is true. Confirm with the user before large changes. Cannot delete budgets — setting 0 clears the category from that month on.",
      inputSchema: z.object({
        category_name: z.string().min(1),
        amount: z.number().min(0).max(MAX_AMOUNT),
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        apply_to_future_months: z.boolean().optional(),
      }),
      execute: async ({ category_name, amount, month, apply_to_future_months }) => {
        const category = await resolveCategory(supabase, category_name)
        if (!category) {
          return {
            success: false,
            error: `No budget category matches "${category_name}". Use get_budgets to see available categories.`,
          }
        }
        const targetMonth = month ?? currentMonth()

        // Snapshot every budget row for this category so undo can restore exactly
        const { data: prior } = await supabase
          .from('budgets')
          .select('amount, month, auto_revert')
          .eq('user_id', userId)
          .eq('category_id', category.id)

        await setBudgetAmount(
          supabase,
          userId,
          category.id,
          amount,
          targetMonth,
          apply_to_future_months === true
        )

        const description = `Set ${category.name} budget to $${amount} for ${targetMonth}${apply_to_future_months ? ' and future months' : ''}`
        const actionId = await logAction(supabase, userId, 'set_budget', description, {
          type: 'restore_budget_rows',
          category_id: category.id,
          rows: prior ?? [],
        })
        return { success: true, summary: description, action_id: actionId }
      },
    }),

    create_goal: tool({
      description: 'Create a new savings goal for the user.',
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        target_amount: z.number().positive().max(MAX_AMOUNT * 100),
        target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
      execute: async ({ name, target_amount, target_date }) => {
        const { data: goal, error } = await supabase
          .from('goals')
          .insert({
            user_id: userId,
            name,
            target_amount,
            target_date: target_date ?? null,
          })
          .select('id')
          .single()
        if (error || !goal) return { success: false, error: 'Failed to create goal' }
        const description = `Created goal "${name}" with a $${target_amount} target${target_date ? ` by ${target_date}` : ''}`
        const actionId = await logAction(supabase, userId, 'create_goal', description, {
          type: 'delete_goal',
          goal_id: goal.id,
        })
        return { success: true, summary: description, action_id: actionId }
      },
    }),

    contribute_to_goal: tool({
      description:
        'Record money added toward a savings goal. Positive amounts only — withdrawals must be done in the app.',
      inputSchema: z.object({
        goal_name: z.string().min(1),
        amount: z.number().positive().max(MAX_AMOUNT),
      }),
      execute: async ({ goal_name, amount }) => {
        const needle = goal_name.trim().toLowerCase()
        const { data: goals } = await supabase
          .from('goals')
          .select('id, name, saved_amount')
          .eq('user_id', userId)
        const goal =
          (goals ?? []).find((g) => g.name.toLowerCase() === needle) ??
          (goals ?? []).find((g) => g.name.toLowerCase().includes(needle))
        if (!goal) {
          return { success: false, error: `No goal matches "${goal_name}". Use get_goals to list them.` }
        }
        const priorSaved = Number(goal.saved_amount)
        const { contributionId } = await recordGoalContribution(supabase, userId, goal.id, amount)
        const description = `Added $${amount} to "${goal.name}"`
        const actionId = await logAction(supabase, userId, 'contribute_to_goal', description, {
          type: 'restore_goal_saved',
          goal_id: goal.id,
          saved_amount: priorSaved,
          contribution_id: contributionId,
        })
        return { success: true, summary: description, action_id: actionId }
      },
    }),
  }
}

/** Revert a logged agent action. Returns a human-readable outcome. */
export async function undoAgentAction(
  supabase: SupabaseClient,
  userId: string,
  actionId: string
): Promise<{ ok: boolean; message: string }> {
  const { data: action } = await supabase
    .from('agent_actions')
    .select('id, description, undo, undone')
    .eq('id', actionId)
    .eq('user_id', userId)
    .single()
  if (!action) return { ok: false, message: 'Action not found' }
  if (action.undone) return { ok: false, message: 'Already undone' }

  const undo = action.undo as Record<string, unknown>

  if (undo.type === 'restore_budget_rows') {
    const categoryId = undo.category_id as string
    const rows = undo.rows as { amount: number; month: string; auto_revert: boolean }[]
    const { error: delError } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('category_id', categoryId)
    if (delError) return { ok: false, message: 'Undo failed' }
    if (rows.length > 0) {
      const { error: insError } = await supabase.from('budgets').insert(
        rows.map((r) => ({
          user_id: userId,
          category_id: categoryId,
          amount: r.amount,
          month: r.month,
          auto_revert: r.auto_revert,
        }))
      )
      if (insError) return { ok: false, message: 'Undo failed' }
    }
  } else if (undo.type === 'delete_goal') {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', undo.goal_id as string)
      .eq('user_id', userId)
    if (error) return { ok: false, message: 'Undo failed' }
  } else if (undo.type === 'restore_goal_saved') {
    const { error } = await supabase
      .from('goals')
      .update({ saved_amount: undo.saved_amount as number })
      .eq('id', undo.goal_id as string)
      .eq('user_id', userId)
    if (error) return { ok: false, message: 'Undo failed' }
    // Also remove the logged contribution so it stops counting against this
    // month's budget deduction — otherwise it would outlive the reverted amount
    if (undo.contribution_id) {
      await supabase
        .from('goal_contributions')
        .delete()
        .eq('id', undo.contribution_id as string)
        .eq('user_id', userId)
    }
  } else {
    return { ok: false, message: 'Unknown action type' }
  }

  await supabase.from('agent_actions').update({ undone: true }).eq('id', actionId).eq('user_id', userId)
  return { ok: true, message: `Undone: ${action.description}` }
}
