import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { beforeMonthStart, contributionsByGoalForMonth, recordGoalContribution } from '@/lib/goal-contributions'
import { goalAllocationsForMonth, setGoalAllocation, setGoalAllocationUntil } from '@/lib/goal-allocation'
import { crystallizeElapsedGoalMonths } from '@/lib/goal-autosave'

/** GET /api/goals?month=YYYY-MM — goals, optionally with each one's
 *  contributions_this_month (used by the Budgets page's dedicated Goals
 *  group to show this month's savings progress). Also lazily catches up
 *  any fixed-plan goal's auto-save for months that have fully elapsed
 *  since it was last checked — see lib/goal-autosave.ts. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')

    await crystallizeElapsedGoalMonths(supabase, user.id)

    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    if (!month) {
      return NextResponse.json({ goals: goals ?? [] })
    }

    const goalIds = (goals ?? []).map((g) => g.id)
    const [contributions, allocations] = await Promise.all([
      contributionsByGoalForMonth(supabase, user.id, goalIds, month),
      goalAllocationsForMonth(supabase, user.id, goalIds, month),
    ])
    const withContributions = (goals ?? []).map((g) => ({
      ...g,
      contributions_this_month: contributions.get(g.id) ?? 0,
      monthly_allocation: allocations.has(g.id) ? allocations.get(g.id) : null,
    }))

    return NextResponse.json({ goals: withContributions })
  } catch (error) {
    console.error('Error fetching goals:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, target_amount, target_date, icon, color, monthly_plan } = body

    if (!name || !target_amount || target_amount <= 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name,
        target_amount,
        target_date: target_date || null,
        icon: icon ?? null,
        color: color ?? null,
      })
      .select()
      .single()

    if (error) throw error

    // A fixed monthly plan chosen at creation becomes a perpetual
    // allocation, so the Budgets page reflects it immediately.
    if (typeof monthly_plan === 'number' && monthly_plan > 0) {
      const month = new Date().toISOString().slice(0, 7)
      await setGoalAllocation(supabase, user.id, goal.id, monthly_plan, month, true)
    }

    return NextResponse.json(goal)
  } catch (error) {
    console.error('Error creating goal:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

/**
 * PUT /api/goals — set a goal's monthly allocation (the fixed "budgeted"
 * figure shown on the Budgets page's Goals group) for the given month, or
 * the current month if none given. By default this only affects that one
 * month — a revert row is written for the following month. Pass
 * `perpetual: true` to carry the amount forward every month indefinitely,
 * mirroring how a regular category's budget amount can be set once and
 * forgotten. Pass `until_target: true` instead to repeat it every month
 * only through the goal's own target_date, then stop automatically —
 * requires the goal to have a target_date set. Pass `clear: true` to
 * remove the plan entirely (falls back to adaptive pace / no figure).
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { goal_id, amount } = body
    const month = typeof body.month === 'string' ? body.month : new Date().toISOString().slice(0, 7)
    const perpetual = body.perpetual === true
    const untilTarget = body.until_target === true

    if (!goal_id) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    // clear: true removes the plan outright — the goal falls back to its
    // adaptive pace (if it has a target date) or to no monthly figure.
    if (body.clear === true) {
      const { error } = await supabase
        .from('goal_allocations')
        .delete()
        .eq('user_id', user.id)
        .eq('goal_id', goal_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (amount === undefined || amount < 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    if (untilTarget) {
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('target_date')
        .eq('id', goal_id)
        .eq('user_id', user.id)
        .single()
      if (goalError) throw goalError
      if (!goal.target_date) {
        return NextResponse.json({ error: 'Goal has no target date' }, { status: 400 })
      }
      const untilMonth = goal.target_date.slice(0, 7)
      const allocation = await setGoalAllocationUntil(supabase, user.id, goal_id, amount, month, untilMonth)
      return NextResponse.json(allocation)
    }

    const allocation = await setGoalAllocation(supabase, user.id, goal_id, amount, month, perpetual)
    return NextResponse.json(allocation)
  } catch (error) {
    console.error('Error saving goal allocation:', error)
    return NextResponse.json({ error: 'Failed to save goal allocation' }, { status: 500 })
  }
}

/** PATCH /api/goals — contribute to (or edit) a goal. Pass
 *  `count_this_month: false` to record the contribution (e.g. a goal's
 *  starting balance) without it counting against the current month's
 *  budget deduction — it still adds to the lifetime saved_amount. */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, contribute, count_this_month, ...rest } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (typeof contribute === 'number' && contribute !== 0) {
      const occurredAt = count_this_month === false ? beforeMonthStart(new Date().toISOString().slice(0, 7)) : undefined
      await recordGoalContribution(supabase, user.id, id, contribute, occurredAt)
      const { data: goal, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (error) throw error
      return NextResponse.json(goal)
    }

    const allowed = ['name', 'target_amount', 'target_date', 'icon', 'color']
    const updates = Object.fromEntries(Object.entries(rest).filter(([k]) => allowed.includes(k)))
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(goal)
  } catch (error) {
    console.error('Error updating goal:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

/** DELETE /api/goals?id=<uuid> */
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

    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting goal:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
