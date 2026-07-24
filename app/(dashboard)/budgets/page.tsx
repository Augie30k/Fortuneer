'use client'

import type { BudgetWithSpend, Category, Goal } from '@/lib/types'
import type { BudgetCadence } from '@/lib/budget-write'
import {
  goalMonthAmount,
  goalMonthlyBudget,
  liveGoalAutoSaveAmounts,
  monthName,
  projectedFinishMonth,
} from '@/lib/goal-math'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpDown, Calendar, Check, ChevronLeft, ChevronRight, GripVertical, Loader2, Pencil, Plus, Settings2, Target, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import CategoryIcon from '@/components/CategoryIcon'
import CategoryDialog from '@/components/CategoryDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog } from '@/components/ui/dialog'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function monthShort(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

const MONTH_ABBR = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'short' })
)

const CADENCE_LABELS: Record<BudgetCadence, string> = {
  quarterly: 'every 3 months',
  semiannual: 'every 6 months',
  annual: 'every 12 months',
}

/** How long a budget amount applies for, beyond just "this month" */
type BudgetScope = 'monthly' | BudgetCadence

/** Popover month/year grid — faster than repeated chevron clicks, especially
 *  for jumping several months into the future to pre-set upcoming budgets.
 *  `minMonth`, if given, greys out and disables anything before it — there's
 *  no budget history before the account itself existed. */
function MonthPicker({
  month,
  onSelect,
  minMonth,
}: {
  month: string
  onSelect: (month: string) => void
  minMonth?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(month.split('-')[0]))
  const selectedYear = Number(month.split('-')[0])
  const selectedMonthIdx = Number(month.split('-')[1]) - 1
  const minYear = minMonth ? Number(minMonth.split('-')[0]) : null

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setYear(selectedYear)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Pick month">
          <Calendar />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="flex items-center justify-between pb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setYear((y) => y - 1)}
            disabled={minYear != null && year <= minYear}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_ABBR.map((label, i) => {
            const isSelected = year === selectedYear && i === selectedMonthIdx
            const candidate = `${year}-${String(i + 1).padStart(2, '0')}`
            const isDisabled = minMonth != null && candidate < minMonth
            return (
              <Button
                key={label}
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className="h-8"
                disabled={isDisabled}
                onClick={() => {
                  onSelect(candidate)
                  setOpen(false)
                }}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function groupKey(name: string | undefined | null) {
  return name?.trim() || 'Other'
}

/** Groups + within-group order derived purely from array order — first
 *  appearance of a group name sets its position; item order follows the
 *  subsequence of same-group items as they occur in the array. */
function deriveGroups<T extends { group_name?: string | null }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  const order: string[] = []
  for (const item of items) {
    const key = groupKey(item.group_name)
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(item)
  }
  return order.map((g) => [g, map.get(g)!] as const)
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpend[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [income, setIncome] = useState(0)
  const [month, setMonth] = useState(currentMonth())
  const [loading, setLoading] = useState(true)
  // The account's creation month — the page won't navigate/render further
  // back than this, since there was no user (so no budget) before it.
  const [minMonth, setMinMonth] = useState<string | null>(null)
  const [prioritizingGoals, setPrioritizingGoals] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<Map<string, string>>(new Map())
  const [baseline, setBaseline] = useState<Map<string, string>>(new Map())
  const [scopeByCategory, setScopeByCategory] = useState<Map<string, BudgetScope>>(new Map())
  const [saving, setSaving] = useState(false)

  const [categoryDialog, setCategoryDialog] = useState<
    { mode: 'create' | 'edit'; category?: Category } | null
  >(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const fetchBudgets = useCallback(async () => {
    try {
      const response = await fetch(`/api/budgets?month=${month}`)
      const data = await response.json()
      setBudgets(data.budgets ?? [])
      setIncome(data.income ?? 0)
      if (data.account_created_month) setMinMonth(data.account_created_month)
    } catch (error) {
      console.error('Error fetching budgets:', error)
    } finally {
      setLoading(false)
    }
  }, [month])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      // Income is a default, budgetable category/group here too — its
      // "spent" tracks money received, not spent. Only transfers stay hidden.
      setCategories((data.categories ?? []).filter((c: Category) => !c.is_transfer))
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetch(`/api/goals?month=${month}`)
      .then((r) => r.json())
      .then((d) => setGoals(d.goals ?? []))
      .catch(console.error)
  }, [month])

  // Active goals first; goals reached this cycle sink to the end — same
  // ordering as the Goals page
  const sortedGoals = useMemo(
    () =>
      [...goals].sort((a, b) => {
        const aDone = Number(a.saved_amount) >= Number(a.target_amount) ? 1 : 0
        const bDone = Number(b.saved_amount) >= Number(b.target_amount) ? 1 : 0
        return aDone - bDone
      }),
    [goals]
  )

  const budgetByCategory = useMemo(() => new Map(budgets.map((b) => [b.category_id, b])), [budgets])
  const spentByCategory = useMemo(() => new Map(budgets.map((b) => [b.category_id, b.spent])), [budgets])

  // Income gets its own pinned section at the top — its rows track money
  // received against an expected amount, not spending against a limit
  const incomeBudgets = useMemo(
    () => budgets.filter((b) => b.category?.is_income),
    [budgets]
  )
  const expectedIncome = useMemo(
    () => incomeBudgets.reduce((s, b) => s + Number(b.amount), 0),
    [incomeBudgets]
  )

  // Normal view: group expense budgets, ordered by their category's live position
  const groupedBudgets = useMemo(() => {
    const categoryIndex = new Map(categories.map((c, i) => [c.id, i]))
    const entries = deriveGroups(
      budgets
        .filter((b) => !b.category?.is_income)
        .map((b) => ({ ...b, group_name: b.category?.group_name }))
    )
    return entries
      .map(([g, rows]) => {
        const sorted = [...rows].sort(
          (a, b) => (categoryIndex.get(a.category_id) ?? 0) - (categoryIndex.get(b.category_id) ?? 0)
        )
        return [g, sorted] as const
      })
      .sort((a, b) => {
        const ai = Math.min(...a[1].map((r) => categoryIndex.get(r.category_id) ?? 0))
        const bi = Math.min(...b[1].map((r) => categoryIndex.get(r.category_id) ?? 0))
        return ai - bi
      })
  }, [budgets, categories])

  // Edit sheet: categories array IS the live drag state; income groups
  // surface first so expected income is the first thing you set
  const groupedCategories = useMemo(() => {
    const groups = deriveGroups(categories)
    return [
      ...groups.filter(([, rows]) => rows.some((c) => c.is_income)),
      ...groups.filter(([, rows]) => !rows.some((c) => c.is_income)),
    ]
  }, [categories])

  const allGroupNames = useMemo(
    () => [...new Set(categories.map((c) => groupKey(c.group_name)))],
    [categories]
  )

  const updateBudgetAmount = async (
    categoryId: string,
    amount: number,
    perpetual: boolean,
    cadence?: BudgetCadence
  ) => {
    const previous = budgets
    const categoryName =
      budgets.find((b) => b.category_id === categoryId)?.category?.name ?? 'category'
    setBudgets((prev) => prev.map((b) => (b.category_id === categoryId ? { ...b, amount } : b)))
    try {
      const response = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, amount, month, perpetual, cadence }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success(
        cadence
          ? `${categoryName} set to ${formatCurrency(amount)} ${CADENCE_LABELS[cadence]}, starting ${monthLabel(month)}`
          : perpetual
            ? `${categoryName} set to ${formatCurrency(amount)} from ${monthLabel(month)} onward`
            : `${categoryName} set to ${formatCurrency(amount)} for ${monthLabel(month)}`
      )
    } catch {
      toast.error('Failed to update budget amount')
      setBudgets(previous)
    }
  }

  // A goal's monthly_allocation is a planning figure (like a regular
  // category's budget amount), separate from actual contributions — set once
  // as perpetual (or through its target date) and it just keeps applying,
  // no re-entry needed each month.
  const updateGoalAllocation = async (
    goalId: string,
    amount: number,
    scope: 'once' | 'perpetual' | 'until_target',
    goalName: string,
    targetDate: string | null
  ) => {
    const previous = goals
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, monthly_allocation: amount } : g))
    )
    try {
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_id: goalId,
          amount,
          month,
          perpetual: scope === 'perpetual',
          until_target: scope === 'until_target',
        }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success(
        scope === 'perpetual'
          ? `${goalName} allocation set to ${formatCurrency(amount)} from ${monthLabel(month)} onward`
          : scope === 'until_target'
            ? `${goalName} allocation set to ${formatCurrency(amount)}/mo through ${targetDate ? monthLabel(targetDate.slice(0, 7)) : 'its target date'}`
            : `${goalName} allocation set to ${formatCurrency(amount)} for ${monthLabel(month)}`
      )
    } catch {
      toast.error('Failed to update goal allocation')
      setGoals(previous)
    }
  }

  const startEdit = () => {
    const next = new Map<string, string>()
    for (const c of categories) {
      const existing = budgetByCategory.get(c.id)
      next.set(c.id, existing ? String(Number(existing.amount)) : '')
    }
    setDraft(next)
    setBaseline(new Map(next))
    setScopeByCategory(new Map())
    setEditMode(true)
  }

  const setCategoryScope = (categoryId: string, scope: BudgetScope | null) => {
    setScopeByCategory((prev) => {
      const next = new Map(prev)
      if (scope) next.set(categoryId, scope)
      else next.delete(categoryId)
      return next
    })
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const items = [...draft.entries()].map(([category_id, value]) => {
        const scope = scopeByCategory.get(category_id) ?? null
        return {
          category_id,
          amount: value === '' ? 0 : parseFloat(value) || 0,
          perpetual: scope === 'monthly',
          cadence: scope && scope !== 'monthly' ? scope : undefined,
        }
      })
      const response = await fetch('/api/budgets/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, month }),
      })
      if (!response.ok) throw new Error('failed')
      const { saved, removed } = await response.json()
      const scheduled = items.filter(
        (i) =>
          (i.perpetual || i.cadence) &&
          (baseline.get(i.category_id) ?? '') !== (draft.get(i.category_id) ?? '')
      ).length
      toast.success(
        `Budget saved for ${monthLabel(month)} — ${saved} ${saved === 1 ? 'category' : 'categories'}${scheduled > 0 ? `, ${scheduled} on a schedule beyond this month` : ''}${removed > 0 ? `, ${removed} cleared` : ''}`
      )
      setEditMode(false)
      fetchBudgets()
    } catch {
      toast.error('Failed to save budget')
    } finally {
      setSaving(false)
    }
  }

  const handleCategorySaved = async () => {
    setCategoryDialog(null)
    await Promise.all([fetchCategories(), fetchBudgets()])
  }

  const handleCategoryDeleted = async () => {
    setCategoryDialog(null)
    await Promise.all([fetchCategories(), fetchBudgets()])
  }

  const renameGroup = async (from: string, to: string) => {
    if (!to.trim() || to.trim() === from) return
    try {
      const response = await fetch('/api/categories/groups/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: to.trim() }),
      })
      if (!response.ok) throw new Error('failed')
      const { renamed } = await response.json()
      toast.success(`Renamed “${from}” to “${to.trim()}” (${renamed} categories)`)
      await Promise.all([fetchCategories(), fetchBudgets()])
    } catch {
      toast.error('Failed to rename group')
    }
  }

  // ---- Drag: groups reorder among themselves; categories reorder within and
  // across group boundaries. Any drag result is persisted as the full
  // structure, which forks built-in categories as needed server-side. ----

  const persistCategoryOrder = async (list: Category[]) => {
    const groups = deriveGroups(list).map(([name, rows]) => ({
      name,
      categoryIds: rows.map((r) => r.id),
    }))
    try {
      const response = await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      })
      if (!response.ok) throw new Error('failed')
      const { mapping } = await response.json()
      const forkedMap = new Map<string, string>(
        (mapping ?? []).filter((m: { forked: boolean }) => m.forked).map((m: { old_id: string; id: string }) => [m.old_id, m.id])
      )
      if (forkedMap.size > 0) {
        setCategories((prev) => prev.map((c) => ({ ...c, id: forkedMap.get(c.id) ?? c.id })))
        setDraft((prev) => {
          const next = new Map<string, string>()
          for (const [k, v] of prev) next.set(forkedMap.get(k) ?? k, v)
          return next
        })
        await fetchBudgets()
      }
    } catch {
      toast.error('Failed to save category order')
      fetchCategories()
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const activeCategory = categories.find((c) => c.id === activeId)
    if (!activeCategory) return

    const targetGroup = overId.startsWith('group:')
      ? overId.slice('group:'.length)
      : categories.find((c) => c.id === overId)?.group_name

    if (!targetGroup || groupKey(activeCategory.group_name) === groupKey(targetGroup)) return

    setCategories((prev) => {
      const withoutActive = prev.filter((c) => c.id !== activeId)
      const overIndex = withoutActive.findIndex((c) => c.id === overId)
      const insertAt = overIndex >= 0 ? overIndex : withoutActive.length
      const moved = { ...activeCategory, group_name: targetGroup }
      const next = [...withoutActive]
      next.splice(insertAt, 0, moved)
      return next
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) {
      persistCategoryOrder(categories)
      return
    }
    const activeIndex = categories.findIndex((c) => c.id === activeId)
    const overIndex = categories.findIndex((c) => c.id === overId)
    if (activeIndex < 0 || overIndex < 0) {
      persistCategoryOrder(categories)
      return
    }
    const next = arrayMove(categories, activeIndex, overIndex)
    setCategories(next)
    persistCategoryOrder(next)
  }

  // Goal priority: drag order controls both display order and, via
  // lib/goal-math.ts, which goal claims auto-save room first (top of the
  // list) or gives it up first (bottom of the list). `goals` is fetched
  // already in priority order, so reassigning each `.priority` to its new
  // index keeps every downstream calc in sync immediately, without waiting
  // on a refetch.
  const persistGoalOrder = async (ids: string[]) => {
    try {
      const response = await fetch('/api/goals/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!response.ok) throw new Error('failed')
    } catch {
      toast.error('Failed to save goal order')
      fetch(`/api/goals?month=${month}`)
        .then((r) => r.json())
        .then((d) => setGoals(d.goals ?? []))
        .catch(console.error)
    }
  }

  const handleGoalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeIndex = goals.findIndex((g) => g.id === active.id)
    const overIndex = goals.findIndex((g) => g.id === over.id)
    if (activeIndex < 0 || overIndex < 0) return
    const next = arrayMove(goals, activeIndex, overIndex).map((g, i) => ({ ...g, priority: i }))
    setGoals(next)
    persistGoalOrder(next.map((g) => g.id))
  }

  const isCurrentMonth = month === currentMonth()

  // Income has its own tile/tracking above — keep it out of the expense
  // budgeted/spent totals so the two don't double up.
  const regularBudgets = useMemo(() => budgets.filter((b) => !b.category?.is_income), [budgets])
  const regularBudgeted = useMemo(
    () => regularBudgets.reduce((s, b) => s + Number(b.amount), 0),
    [regularBudgets]
  )
  const regularSpent = useMemo(
    () => regularBudgets.reduce((s, b) => s + b.spent, 0),
    [regularBudgets]
  )

  // Every goal with a monthly figure (fixed plan or date-derived pace)
  // auto-claims room from this month's Expected Savings — income budgeted
  // minus expenses budgeted, *before* any goal — instead of requiring a
  // manual contribution. Only meaningful for the real current month, since
  // the user could still be editing this month's numbers (see
  // lib/goal-math.ts's liveGoalAutoSaveAmounts). Flexible goals never
  // participate; multiple eligible goals share the pool oldest-first.
  const liveAutoSave = useMemo(
    () =>
      isCurrentMonth
        ? liveGoalAutoSaveAmounts(goals, expectedIncome - regularBudgeted)
        : new Map<string, number>(),
    [goals, expectedIncome, regularBudgeted, isCurrentMonth]
  )

  // What's actually been auto-claimed toward goals this month (live for the
  // current month, actual recorded contributions otherwise) — shown on the
  // Goals group header and subtracted from Expected Savings below. Kept
  // entirely separate from the Expenses card: goal money never touches
  // expenses, only savings.
  const goalAmount = useMemo(
    () => goals.reduce((s, g) => s + goalMonthAmount(g, isCurrentMonth, liveAutoSave), 0),
    [goals, isCurrentMonth, liveAutoSave]
  )

  // The full monthly plan across goals (not just what's been claimed so
  // far) — shown as context (e.g. the Goals group header's "of $X planned"),
  // not used in the Expected Savings arithmetic itself.
  const goalPlanTotal = useMemo(
    () => goals.reduce((s, g) => s + (goalMonthlyBudget(g) ?? 0), 0),
    [goals]
  )

  // Expected savings: what's left of your planned income after your
  // planned expenses and whatever goals have actually claimed this month.
  // As the pool above shrinks toward $0, goal claims dynamically shrink
  // with it (floor $0, never negative from a goal's own claim) — so this
  // number and "0" meet exactly instead of going needlessly negative from
  // a goal plan the month can't actually afford; as the pool recovers,
  // claims — and this number — rise again automatically.
  const expectedSavings = expectedIncome - regularBudgeted - goalAmount

  const draftTotals = useMemo(() => {
    const isIncome = new Map(categories.map((c) => [c.id, c.is_income]))
    let income = 0
    let expenses = 0
    for (const [id, v] of draft) {
      const n = parseFloat(v) || 0
      if (isIncome.get(id)) income += n
      else expenses += n
    }
    return { income, expenses }
  }, [draft, categories])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted-foreground">Monthly limits per category</p>
        </div>
        {editMode ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setEditMode(false)} disabled={saving}>
              <X />
              Cancel
            </Button>
            <Button onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check />}
              Save budget
            </Button>
          </div>
        ) : (
          <Button onClick={startEdit} disabled={categories.length === 0}>
            <Pencil />
            Edit budget
          </Button>
        )}
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={editMode || (minMonth != null && month <= minMonth)}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={editMode}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight />
        </Button>
        {!editMode && <MonthPicker month={month} onSelect={setMonth} minMonth={minMonth} />}
        {!isCurrentMonth && !editMode && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
            Today
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : editMode ? (
        /* ---- Edit-all sheet: drag groups and categories, inline amounts ---- */
        <Card>
          <CardContent>
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">All categories</p>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCategoryDialog({ mode: 'create' })}
                  aria-label="New category"
                >
                  <Plus />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">
                Income{' '}
                <span className="font-semibold text-positive">
                  {formatCurrency(draftTotals.income)}
                </span>
                {' · '}Budget{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(draftTotals.expenses)}
                </span>
                /mo
              </p>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {groupedCategories.map(([group, rows]) => (
                <GroupBlock key={group} name={group} onRename={(to) => renameGroup(group, to)}>
                  <SortableContext items={rows.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <GroupDropZone id={'group:' + group} empty={rows.length === 0}>
                      {rows.map((c) => (
                        <SortableCategoryEditRow
                          key={c.id}
                          category={c}
                          spent={spentByCategory.get(c.id) ?? 0}
                          value={draft.get(c.id) ?? ''}
                          changed={(draft.get(c.id) ?? '') !== (baseline.get(c.id) ?? '')}
                          scope={scopeByCategory.get(c.id) ?? null}
                          onScopeChange={(scope) => setCategoryScope(c.id, scope)}
                          month={monthShort(month)}
                          onChange={(value) => {
                            const next = new Map(draft)
                            next.set(c.id, value)
                            setDraft(next)
                          }}
                          onEditCategory={() => setCategoryDialog({ mode: 'edit', category: c })}
                        />
                      ))}
                    </GroupDropZone>
                  </SortableContext>
                </GroupBlock>
              ))}
            </DndContext>

            <p className="pt-2 text-xs text-muted-foreground">
              When you change an amount you’ll be asked how long it applies —{' '}
              {monthLabel(month)} only, every month after, or on a repeating
              schedule (quarterly, semiannual, yearly) for bills that aren’t
              monthly. A highlighted box means it&apos;s set beyond this
              month. Drag the dots to reorder categories or move one into a
              different group. Leave an amount empty (or 0) to remove that
              budget.
            </p>
          </CardContent>
        </Card>
      ) : budgets.length === 0 && goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-medium">No budgets yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Set monthly limits across all your categories in one pass —
              Fortuneer tracks spending against them automatically.
            </p>
            <Button size="sm" onClick={startEdit}>
              Set up your budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary: three self-contained cards instead of one shared tile
              block — Income and Expenses each carry their own progress bar
              and to-date breakdown; Expected Savings is a plan-vs-plan
              number (income budget minus expense budget minus goal plans),
              not tied to how the month has actually gone so far. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">Income · {monthLabel(month)}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(expectedIncome)}
                </p>
                {expectedIncome > 0 ? (
                  <>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--positive) 14%, transparent)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (income / expectedIncome) * 100)}%`,
                          backgroundColor: 'var(--positive)',
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Earned <span className="font-medium text-positive">{formatCurrency(income)}</span>
                      </span>
                      <span>
                        Remaining{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(Math.max(0, expectedIncome - income))}
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {income > 0
                      ? `${formatCurrency(income)} earned — no expected income set`
                      : 'No expected income set'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">Expenses · {monthLabel(month)}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(regularBudgeted)}
                </p>
                {regularBudgeted > 0 ? (
                  (() => {
                    const over = regularSpent > regularBudgeted
                    const ratio = regularSpent / regularBudgeted
                    const fill = over ? 'var(--destructive)' : ratio > 0.85 ? '#FF9500' : 'var(--positive)'
                    return (
                      <>
                        <div
                          className="mt-3 h-1.5 overflow-hidden rounded-full"
                          style={{ backgroundColor: `color-mix(in srgb, ${fill} 14%, transparent)` }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: fill }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Spent{' '}
                            <span className={cn('font-medium', over ? 'text-negative' : 'text-foreground')}>
                              {formatCurrency(regularSpent)}
                            </span>
                          </span>
                          <span>
                            {over ? 'Over by' : 'Remaining'}{' '}
                            <span className="font-medium text-foreground">
                              {formatCurrency(Math.abs(regularBudgeted - regularSpent))}
                            </span>
                          </span>
                        </div>
                      </>
                    )
                  })()
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">No categories budgeted yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">
                  Expected savings · {monthLabel(month)}
                </p>
                <p
                  className={cn(
                    'mt-1 text-2xl font-semibold tabular-nums',
                    expectedSavings >= 0 ? 'text-positive' : 'text-negative'
                  )}
                >
                  {formatCurrency(expectedSavings)}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {goalAmount > 0 && ` − ${formatCurrency(goalAmount)} goals`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Goals — each row is derived straight from a goal, not a real
              budget category: contributions here only ever touch
              goal_contributions, never transactions, so Reports stays
              untouched. */}
          {goals.length > 0 && (
            <div className="space-y-3">
              <GoalsGroupHeader
                claimed={goalAmount}
                planned={goalPlanTotal}
                prioritizing={prioritizingGoals}
                onTogglePrioritize={goals.length > 1 ? () => setPrioritizingGoals((p) => !p) : null}
              />
              {prioritizingGoals ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGoalDragEnd}>
                  <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {goals.map((g) => (
                        <SortableGoalPriorityRow key={g.id} goal={g} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-3">
                  {sortedGoals.map((g) => (
                    <GoalBudgetRow
                      key={g.id}
                      goal={g}
                      month={month}
                      liveAmount={isCurrentMonth && liveAutoSave.has(g.id) ? liveAutoSave.get(g.id)! : null}
                      onSetAllocation={(amount, scope) =>
                        updateGoalAllocation(g.id, amount, scope, g.name, g.target_date)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Income — its rows track money received against what's
              expected, not spending against a limit, but the group header
              itself matches every other group. */}
          <div className="space-y-3">
            <GroupHeader name="Income" spent={income} budgeted={expectedIncome} />
            {incomeBudgets.length > 0 ? (
              <div className="space-y-3">
                {incomeBudgets.map((budget) => (
                  <BudgetRow
                    key={budget.id}
                    budget={budget}
                    income
                    month={month}
                    onAmountChange={(amount, perpetual, cadence) =>
                      updateBudgetAmount(budget.category_id, amount, perpetual, cadence)
                    }
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {income > 0
                      ? `${formatCurrency(income)} received this month. Set what you expect each month to track it here.`
                      : 'Set what you expect to earn each month — received income is tracked against it.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    Set expected income
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {groupedBudgets.map(([group, rows]) => {
            const groupBudgeted = rows.reduce((s, b) => s + Number(b.amount), 0)
            const groupSpent = rows.reduce((s, b) => s + b.spent, 0)
            return (
              <div key={group} className="space-y-3">
                <GroupHeader name={group} spent={groupSpent} budgeted={groupBudgeted} />
                <div className="space-y-3">
                  {rows.map((budget) => (
                    <BudgetRow
                      key={budget.id}
                      budget={budget}
                      month={month}
                      onAmountChange={(amount, perpetual, cadence) =>
                        updateBudgetAmount(budget.category_id, amount, perpetual, cadence)
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      <Dialog open={!!categoryDialog} onOpenChange={(open) => !open && setCategoryDialog(null)}>
        {categoryDialog?.mode === 'create' && (
          <CategoryDialog mode="create" existingGroups={allGroupNames} onSaved={handleCategorySaved} />
        )}
        {categoryDialog?.mode === 'edit' && categoryDialog.category && (
          <CategoryDialog
            mode="edit"
            category={categoryDialog.category}
            existingGroups={allGroupNames}
            onSaved={handleCategorySaved}
            onDeleted={handleCategoryDeleted}
          />
        )}
      </Dialog>
    </div>
  )
}

function GroupHeader({ name, spent, budgeted }: { name: string; spent: number; budgeted: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{name}</h2>
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatCurrency(spent)} of {formatCurrency(budgeted)}
      </p>
    </div>
  )
}

/** Rename-in-place group label — only shown inside the "Edit budget" sheet */
function GroupEditLabel({ name, onRename }: { name: string; onRename: (to: string) => void }) {
  const [renaming, setRenaming] = useState(false)
  const [value, setValue] = useState(name)

  const commit = () => {
    setRenaming(false)
    if (value.trim() && value.trim() !== name) onRename(value)
    else setValue(name)
  }

  if (renaming) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setValue(name)
            setRenaming(false)
          }
        }}
        onBlur={commit}
        className="h-7 max-w-48 text-xs font-semibold uppercase"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setRenaming(true)}
      className="group/glabel flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
    >
      {name}
      <Pencil className="size-3 opacity-0 transition-opacity group-hover/glabel:opacity-100" />
    </button>
  )
}

/** Static group section in the edit sheet — rename in place, but not draggable.
 *  Group order itself is changed from Settings, not here. */
function GroupBlock({
  name,
  onRename,
  children,
}: {
  name: string
  onRename: (to: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="pb-4">
      <div className="pb-1.5">
        <GroupEditLabel name={name} onRename={onRename} />
      </div>
      {children}
    </div>
  )
}

function GroupDropZone({
  id,
  empty,
  children,
}: {
  id: string
  empty: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(empty && 'min-h-10 rounded-lg', empty && isOver && 'bg-accent')}
    >
      {children}
      {empty && <p className="py-3 text-center text-xs text-muted-foreground">Drop a category here</p>}
    </div>
  )
}

/** The 5-way "how long does this apply" choice, shared by both scope popovers */
function ScopeChooser({
  month,
  current,
  onChoose,
}: {
  month: string
  current: BudgetScope | null
  onChoose: (scope: BudgetScope | null) => void
}) {
  const cadence: BudgetCadence | null =
    current === 'quarterly' || current === 'semiannual' || current === 'annual' ? current : null

  return (
    <div className="flex flex-col gap-1.5">
      <Button size="sm" variant={!current ? 'default' : 'outline'} onClick={() => onChoose(null)}>
        Only {month}
      </Button>
      <Button
        size="sm"
        variant={current === 'monthly' ? 'default' : 'outline'}
        onClick={() => onChoose('monthly')}
      >
        {month} and every month after
      </Button>
      <Select value={cadence ?? ''} onValueChange={(v) => onChoose(v as BudgetCadence)}>
        <SelectTrigger
          size="sm"
          className={cn('w-full', cadence ? 'border-primary/60' : 'text-muted-foreground')}
        >
          <SelectValue placeholder="Other schedule…" />
        </SelectTrigger>
        <SelectContent>
          {(['quarterly', 'semiannual', 'annual'] as const).map((c) => (
            <SelectItem key={c} value={c}>
              {CADENCE_LABELS[c].replace(/^every/, 'Every')}, starting {month}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SortableCategoryEditRow({
  category,
  spent,
  value,
  changed,
  scope,
  onScopeChange,
  month,
  onChange,
  onEditCategory,
}: {
  category: Category
  spent: number
  value: string
  changed: boolean
  scope: BudgetScope | null
  onScopeChange: (scope: BudgetScope | null) => void
  month: string
  onChange: (value: string) => void
  onEditCategory: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })

  // Scope popover appears once per committed change — asks how long the new
  // amount applies for
  const [scopeOpen, setScopeOpen] = useState(false)
  const lastPrompted = useRef<string | null>(null)

  const handleBlur = () => {
    if (!changed) {
      // Back to the original value — clear any earlier scope choice
      if (scope) onScopeChange(null)
      lastPrompted.current = null
      return
    }
    if (lastPrompted.current !== value) {
      lastPrompted.current = value
      setScopeOpen(true)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        isDragging && 'z-20 rounded-lg bg-card opacity-95 shadow-md ring-2 ring-primary/50'
      )}
    >
      <div className="group/catrow flex items-center gap-1.5 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${category.name}`}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <CategoryIcon chip icon={category.icon} color={category.color} />
        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <p className="truncate text-sm font-medium">{category.name}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onEditCategory}
              aria-label={`Edit ${category.name} category`}
              className="size-5 shrink-0 opacity-0 transition-opacity group-hover/catrow:opacity-100"
            >
              <Settings2 className="text-muted-foreground" />
            </Button>
          </span>
          <p className="text-xs text-muted-foreground">
            {category.is_income
              ? spent > 0
                ? `${formatCurrency(spent)} received this month`
                : 'Nothing received yet this month'
              : spent > 0
                ? `${formatCurrency(spent)} spent this month`
                : 'No spending this month'}
          </p>
        </div>
        <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
          <PopoverAnchor asChild>
            <div className="relative w-28">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="—"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                className={cn(
                  'h-8 pl-7 text-right tabular-nums',
                  scope && 'border-primary/60 ring-1 ring-primary/40'
                )}
                aria-label={
                  category.is_income
                    ? `${category.name} expected monthly income`
                    : `${category.name} monthly budget`
                }
                title={scope ? `Applies ${CADENCE_LABELS[scope as BudgetCadence] ?? 'every month'} from ${month}` : undefined}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent align="end" className="w-64 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
            <p className="pb-2.5 text-sm font-medium">Apply this amount to:</p>
            <ScopeChooser
              month={month}
              current={scope}
              onChoose={(next) => {
                onScopeChange(next)
                setScopeOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function BudgetRow({
  budget,
  month,
  income = false,
  onAmountChange,
}: {
  budget: BudgetWithSpend
  month: string
  /** Income rows track money received against an expected amount — meeting
   *  the number is good news, so the meter stays green and the copy flips */
  income?: boolean
  onAmountChange: (amount: number, perpetual: boolean, cadence?: BudgetCadence) => void
}) {
  const router = useRouter()
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountDraft, setAmountDraft] = useState('')
  // Amount committed from the input, awaiting a scope choice
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)
  const cancelledRef = useRef(false)

  const amount = Number(budget.amount)
  const ratio = amount > 0 ? budget.spent / amount : 0
  const over = !income && ratio > 1
  const near = !income && ratio > 0.85 && !over
  const incomeMet = income && ratio >= 1

  const startEditAmount = () => {
    cancelledRef.current = false
    setAmountDraft(String(amount))
    setEditingAmount(true)
  }

  const commitAmount = () => {
    setEditingAmount(false)
    if (cancelledRef.current) return
    const parsed = parseFloat(amountDraft)
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : amount
    if (next !== amount) setPendingAmount(next)
  }

  const cancelEditAmount = () => {
    cancelledRef.current = true
    setEditingAmount(false)
  }

  const chooseScope = (scope: BudgetScope | null) => {
    if (pendingAmount != null) {
      onAmountChange(
        pendingAmount,
        scope === 'monthly',
        scope && scope !== 'monthly' ? scope : undefined
      )
    }
    setPendingAmount(null)
  }

  // Meter: fill carries severity; track is a lighter step of the same ramp.
  // Income is always green — more of it is never a problem.
  const fill = income
    ? 'var(--positive)'
    : over
      ? 'var(--destructive)'
      : near
        ? '#FF9500'
        : 'var(--chart-1)'
  const track = income
    ? 'color-mix(in srgb, var(--positive) 14%, transparent)'
    : over
      ? 'color-mix(in srgb, var(--destructive) 15%, transparent)'
      : near
        ? 'color-mix(in srgb, #FF9500 15%, transparent)'
        : 'color-mix(in srgb, var(--chart-1) 12%, transparent)'

  return (
    <Card
      className="group/budgetcard cursor-pointer transition-colors hover:bg-accent/40 has-[[data-amount-editor]:hover]:bg-card"
      onClick={(e) => {
        // The card itself navigates; clicks on the amount editor (button,
        // input) or the name link handle themselves
        if ((e.target as HTMLElement).closest('button, input, a')) return
        router.push(`/budgets/${budget.category_id}`)
      }}
    >
      <CardContent className="flex items-center gap-2">
        <CategoryIcon chip icon={budget.category?.icon} color={budget.category?.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={`/budgets/${budget.category_id}`}
              className="flex min-w-0 items-center gap-1"
              aria-label={`View ${budget.category?.name} details and transactions`}
            >
              <p className="truncate text-sm font-medium">{budget.category?.name}</p>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/budgetcard:opacity-100" />
            </Link>
            <Popover open={pendingAmount != null} onOpenChange={(open) => !open && setPendingAmount(null)}>
              <PopoverAnchor asChild>
                {editingAmount ? (
                  <span data-amount-editor className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
                    <span
                      className={cn(
                        'font-semibold',
                        over && 'text-negative',
                        incomeMet && 'text-positive'
                      )}
                    >
                      {formatCurrency(budget.spent)}
                    </span>
                    <span className="text-muted-foreground">/ $</span>
                    <Input
                      autoFocus
                      type="number"
                      min="0"
                      step="1"
                      value={amountDraft}
                      onChange={(e) => setAmountDraft(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={commitAmount}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') cancelEditAmount()
                      }}
                      className="h-6 w-20 px-1.5 text-right tabular-nums"
                    />
                  </span>
                ) : (
                  // The ::before overlay enlarges the click target well past
                  // the visible chip so a near-miss edits the amount instead
                  // of navigating into the category page; the hover highlight
                  // stays on the chip itself
                  <button
                    type="button"
                    data-amount-editor
                    onClick={startEditAmount}
                    className="relative shrink-0 rounded px-1.5 py-0.5 text-sm tabular-nums transition-colors before:absolute before:-inset-x-4 before:-inset-y-3 before:content-[''] hover:bg-accent"
                    aria-label={
                      income
                        ? `Edit ${budget.category?.name} expected income`
                        : `Edit ${budget.category?.name} budget amount`
                    }
                  >
                    <span
                      className={cn(
                        'font-semibold',
                        over && 'text-negative',
                        incomeMet && 'text-positive'
                      )}
                    >
                      {formatCurrency(budget.spent)}
                    </span>
                    <span className="text-muted-foreground"> / {formatCurrency(amount)}</span>
                  </button>
                )}
              </PopoverAnchor>
              <PopoverContent align="end" className="w-64 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
                <p className="pb-2.5 text-sm font-medium">
                  Set {budget.category?.name} to {pendingAmount != null && formatCurrency(pendingAmount)}
                </p>
                <ScopeChooser month={monthShort(month)} current={null} onChoose={chooseScope} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1.5 w-full text-muted-foreground"
                  onClick={() => setPendingAmount(null)}
                >
                  Cancel
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: track }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: fill }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {income
              ? incomeMet
                ? `Expected income met${budget.spent > amount ? ` — ${formatCurrency(budget.spent - amount)} extra` : ''} 🎉`
                : `${formatCurrency(amount - budget.spent)} more expected`
              : over
                ? `${formatCurrency(budget.spent - amount)} over budget`
                : `${formatCurrency(amount - budget.spent)} left`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/** A goal's row in the Budgets page. A fixed monthly plan auto-claims room
 *  from this month's leftover budget — no manual contribution entry — so
 *  the row surfaces that live amount instead of asking to be clicked to
 *  log spending. The progress bar shows overall saved/target progress. */
function GoalBudgetRow({
  goal,
  month,
  liveAmount,
  onSetAllocation,
}: {
  goal: Goal
  month: string
  /** This month's live auto-save claim — set for the real current month on
   *  any goal with a monthly figure, fixed plan or auto-pace (null
   *  otherwise: past/future month, or a flexible goal with nothing to
   *  auto-claim). */
  liveAmount: number | null
  onSetAllocation: (amount: number, scope: 'once' | 'perpetual' | 'until_target') => void
}) {
  const [editingAllocation, setEditingAllocation] = useState(false)
  const [allocationDraft, setAllocationDraft] = useState('')
  const [pendingAllocation, setPendingAllocation] = useState<number | null>(null)
  const cancelledAllocRef = useRef(false)

  const saved = Number(goal.saved_amount)
  const target = Number(goal.target_amount)
  const overallDone = saved >= target
  const plan = goalMonthlyBudget(goal)
  // The number this row shows and edits. For the real current month on an
  // eligible goal, that's the live auto-save claim, not the abstract plan —
  // when the budget's tight the figure itself drops (down to $0), and
  // recovers the same way, exactly as if the user had retyped it by hand.
  // Editing always starts from this figure, so a manual override picks up
  // right where the dynamic clamp left off instead of jumping back to plan.
  const budgeted = liveAmount ?? plan
  const color = goal.color ?? 'var(--chart-1)'
  const hasFixedPlan = goal.monthly_allocation != null
  const isClamped = liveAmount != null && plan != null && liveAmount < plan

  // Overall goal progress (saved vs target)
  const ratio = overallDone ? 1 : target > 0 ? saved / target : 0

  let statusLine: string
  if (overallDone) {
    statusLine = 'Goal reached 🎉'
  } else if (budgeted == null) {
    statusLine = 'No monthly plan'
  } else if (budgeted === 0) {
    statusLine = isClamped ? 'No budget room left this month' : 'Contributions paused'
  } else {
    const projected = projectedFinishMonth(target, saved, budgeted)
    if (goal.target_date) {
      statusLine = `On track for ${monthName(goal.target_date.slice(0, 7))}`
      if (projected && projected !== goal.target_date.slice(0, 7)) {
        statusLine += ` · done ~${monthName(projected)}`
      }
    } else if (projected) {
      statusLine = `Done ~${monthName(projected)}`
    } else {
      statusLine = 'In progress'
    }
  }

  const startEditAllocation = () => {
    cancelledAllocRef.current = false
    setAllocationDraft(budgeted != null ? String(Math.round(budgeted * 100) / 100) : '')
    setEditingAllocation(true)
  }

  const commitAllocation = () => {
    setEditingAllocation(false)
    if (cancelledAllocRef.current) return
    const parsed = parseFloat(allocationDraft)
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : (budgeted ?? 0)
    if (next !== budgeted) setPendingAllocation(next)
  }

  const cancelEditAllocation = () => {
    cancelledAllocRef.current = true
    setEditingAllocation(false)
  }

  const chooseAllocationScope = (scope: 'once' | 'perpetual' | 'until_target') => {
    if (pendingAllocation != null) onSetAllocation(pendingAllocation, scope)
    setPendingAllocation(null)
  }

  return (
    <Card
      className="border-l-4"
      style={{
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 5%, transparent)`,
      }}
    >
      <CardContent className="flex items-center gap-2">
        <CategoryIcon chip icon={goal.icon ?? 'circle-ellipsis'} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium">{goal.name}</p>
            {!overallDone && (
              <Popover
                open={pendingAllocation != null}
                onOpenChange={(open) => !open && setPendingAllocation(null)}
              >
                <PopoverAnchor asChild>
                  {editingAllocation ? (
                    <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        autoFocus
                        type="number"
                        min="0"
                        step="1"
                        value={allocationDraft}
                        onChange={(e) => setAllocationDraft(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={commitAllocation}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') cancelEditAllocation()
                        }}
                        className="h-6 w-20 px-1.5 text-right tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditAllocation}
                      className="shrink-0 rounded px-1.5 py-0.5 text-sm tabular-nums transition-colors hover:bg-accent"
                      aria-label={`Set ${goal.name}'s monthly allocation`}
                      title={
                        isClamped
                          ? 'Auto-reduced to fit this month’s budget — click to change'
                          : hasFixedPlan
                            ? 'Fixed monthly amount — click to change'
                            : budgeted != null
                              ? 'Auto-paced to hit target date — click to set a fixed amount'
                              : 'Set a monthly amount for this goal'
                      }
                    >
                      <span className="font-semibold" style={{ color }}>
                        {budgeted != null ? formatCurrency(budgeted) : 'Set plan'}
                      </span>
                      {budgeted != null && (
                        <span className="text-xs text-muted-foreground">/mo</span>
                      )}
                    </button>
                  )}
                </PopoverAnchor>
                <PopoverContent align="end" className="w-64 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <p className="pb-2.5 text-sm font-medium">
                    Put {pendingAllocation != null && formatCurrency(pendingAllocation)}/mo
                    toward {goal.name}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Button size="sm" onClick={() => chooseAllocationScope('perpetual')}>
                      Every month
                    </Button>
                    {goal.target_date && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => chooseAllocationScope('until_target')}
                      >
                        Every month until {monthName(goal.target_date.slice(0, 7))}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => chooseAllocationScope('once')}
                    >
                      Just {monthShort(month)}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => setPendingAllocation(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: color }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {statusLine}
            {' · '}
            {formatCurrency(saved)} of {formatCurrency(target)} saved
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function GoalsGroupHeader({
  claimed,
  planned,
  prioritizing,
  onTogglePrioritize,
}: {
  claimed: number
  planned: number
  prioritizing: boolean
  /** null hides the button entirely — not worth offering with 0-1 goals */
  onTogglePrioritize: (() => void) | null
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-2 py-1.5">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
        <Target className="size-3.5" />
        Goals
      </h2>
      <div className="flex items-center gap-2">
        {prioritizing ? (
          <p className="text-xs text-muted-foreground">Drag to reorder — top gets funded first</p>
        ) : (
          planned > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(claimed)} of {formatCurrency(planned)}/mo set aside
            </p>
          )
        )}
        {onTogglePrioritize && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={onTogglePrioritize}
          >
            {prioritizing ? (
              <>
                <Check className="size-3" />
                Done
              </>
            ) : (
              <>
                <ArrowUpDown className="size-3" />
                Prioritize
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Compact drag-only row for the Goals group's "Prioritize" mode — order
 *  here becomes each goal's priority (lib/goal-math.ts): earlier claims
 *  auto-save room first, later gives it up first when the budget's tight. */
function SortableGoalPriorityRow({ goal }: { goal: Goal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: goal.id,
  })
  const color = goal.color ?? 'var(--chart-1)'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm',
        isDragging && 'z-20 opacity-90 shadow-md ring-2 ring-primary/50'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${goal.name}`}
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <CategoryIcon chip icon={goal.icon ?? 'circle-ellipsis'} color={color} />
      <span className="min-w-0 flex-1 truncate font-medium">{goal.name}</span>
    </div>
  )
}
