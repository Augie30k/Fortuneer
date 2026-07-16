'use client'

import type { Goal } from '@/lib/types'
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Minus, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  goalContributedThisMonth,
  goalMonthlyBudget,
  monthName,
  monthsThrough,
  projectedFinishMonth,
} from '@/lib/goal-math'
import { cn } from '@/lib/utils'
import CategoryIcon from '@/components/CategoryIcon'
import DatePicker from '@/components/DatePicker'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const GOAL_COLORS = ['#0071E3', '#248A3D', '#FF9500', '#AF52DE', '#FF375F', '#30B0C7']
const QUICK_AMOUNTS = [25, 50, 100, 250]

/** Starting points for the create flow — icon keys map through CategoryIcon */
const GOAL_TEMPLATES = [
  { key: 'emergency', label: 'Emergency fund', icon: 'piggy-bank', color: '#248A3D', name: 'Emergency fund', amount: 5000 },
  { key: 'trip', label: 'Trip', icon: 'plane', color: '#0071E3', name: 'Trip', amount: 2500 },
  { key: 'home', label: 'Down payment', icon: 'house', color: '#AF52DE', name: 'Down payment', amount: 40000 },
  { key: 'car', label: 'New car', icon: 'car-front', color: '#30B0C7', name: 'New car', amount: 15000 },
  { key: 'debt', label: 'Pay off debt', icon: 'banknote', color: '#FF375F', name: 'Pay off debt', amount: 3000 },
  { key: 'education', label: 'Education', icon: 'graduation-cap', color: '#FF9500', name: 'Education', amount: 10000 },
  { key: 'custom', label: 'Something else', icon: null, color: GOAL_COLORS[0], name: '', amount: 0 },
] as const

/** Circular progress ring with the percentage centered inside */
function ProgressRing({ ratio, color }: { ratio: number; color: string }) {
  const r = 26
  const circumference = 2 * Math.PI * r
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          strokeWidth={6}
          stroke={`color-mix(in srgb, ${color} 15%, transparent)`}
        />
        <circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, ratio))}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {Math.round(Math.min(1, ratio) * 100)}%
      </span>
    </div>
  )
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [contributing, setContributing] = useState<Goal | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      // month param pulls in this month's contributions + the monthly plan,
      // so cards can show "this month" progress consistent with Budgets
      const month = new Date().toISOString().slice(0, 7)
      const response = await fetch(`/api/goals?month=${month}`)
      const data = await response.json()
      setGoals(data.goals ?? [])
    } catch (error) {
      console.error('Error fetching goals:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const removeGoal = async (id: string) => {
    try {
      const response = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      setGoals((prev) => prev.filter((g) => g.id !== id))
      toast.success('Goal deleted')
    } catch {
      toast.error('Failed to delete goal')
    }
  }

  // Active goals first; reached goals sink to the end
  const sorted = useMemo(
    () =>
      [...goals].sort((a, b) => {
        const aDone = Number(a.saved_amount) >= Number(a.target_amount) ? 1 : 0
        const bDone = Number(b.saved_amount) >= Number(b.target_amount) ? 1 : 0
        return aDone - bDone
      }),
    [goals]
  )

  const totals = useMemo(() => {
    const saved = goals.reduce((s, g) => s + Number(g.saved_amount), 0)
    const target = goals.reduce((s, g) => s + Number(g.target_amount), 0)
    const reached = goals.filter((g) => Number(g.saved_amount) >= Number(g.target_amount)).length
    return { saved, target, reached }
  }, [goals])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Save toward what matters, one contribution at a time
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              New goal
            </Button>
          </DialogTrigger>
          <GoalFormDialog
            onSuccess={() => {
              setDialogOpen(false)
              fetchGoals()
            }}
          />
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <Target className="size-6 text-primary" />
            </span>
            <div>
              <p className="font-medium">No goals yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                An emergency fund, a trip, a down payment — set a target and track
                your progress toward it.
              </p>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Create your first goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overall progress */}
          <Card>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Saved</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(totals.saved)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Target</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(totals.target)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Reached</p>
                <p className="mt-1 text-lg font-semibold">
                  {totals.reached}
                  <span className="text-sm font-normal text-muted-foreground"> of {goals.length}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sorted.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={() => setContributing(goal)}
                onEdit={() => setEditing(goal)}
                onRemove={() => removeGoal(goal.id)}
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <GoalFormDialog
            goal={editing}
            onSuccess={() => {
              setEditing(null)
              fetchGoals()
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!contributing} onOpenChange={(open) => !open && setContributing(null)}>
        {contributing && (
          <ContributeDialog
            goal={contributing}
            onSuccess={(updated) => {
              setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
              setContributing(null)
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

function GoalCard({
  goal,
  onContribute,
  onEdit,
  onRemove,
}: {
  goal: Goal
  onContribute: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const saved = Number(goal.saved_amount)
  const target = Number(goal.target_amount)
  const ratio = target > 0 ? saved / target : 0
  const color = goal.color ?? '#0071E3'
  const done = ratio >= 1

  // One coherent plan line: fixed plan ("you set $X/mo") shows its projected
  // finish; date-driven pace shows what this month needs; flexible shows
  // what's left. Never a giant lump-sum masquerading as a monthly number.
  const monthly = goalMonthlyBudget(goal)
  const hasFixedPlan = goal.monthly_allocation != null
  const contributed = goalContributedThisMonth(goal)
  const projected =
    hasFixedPlan && monthly ? projectedFinishMonth(target, saved, monthly) : null

  let planLine: string
  if (done) {
    planLine = ''
  } else if (hasFixedPlan && monthly != null && monthly > 0) {
    planLine = `Plan: ${formatCurrency(monthly)}/mo${projected ? ` · done ~${monthName(projected)}` : ''}`
    if (goal.target_date && projected) {
      planLine += projected <= goal.target_date.slice(0, 7) ? ' (on schedule)' : ' (past your date)'
    }
  } else if (hasFixedPlan) {
    planLine = 'Plan paused this month'
  } else if (goal.target_date && monthly != null) {
    planLine = `${formatCurrency(monthly)}/mo to stay on track · by ${formatDate(goal.target_date, { month: 'short', year: 'numeric' })}`
  } else {
    planLine = `${formatCurrency(target - saved)} to go · no monthly plan`
  }

  return (
    <Card className="group">
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <ProgressRing ratio={ratio} color={color} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-medium">
              {goal.icon && <CategoryIcon icon={goal.icon} color={color} className="size-4 shrink-0" />}
              {goal.name}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(saved)}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}
                of {formatCurrency(target)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {done ? (
                <span className="font-medium text-positive">Goal reached 🎉</span>
              ) : (
                planLine
              )}
            </p>
          </div>
          <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${goal.name}`}>
              <Pencil className="text-muted-foreground" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${goal.name}`}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{goal.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {saved > 0
                      ? `You've tracked ${formatCurrency(saved)} toward this goal — deleting removes that history.`
                      : 'This removes the goal permanently.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button variant="destructive" onClick={onRemove}>
                      Delete goal
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {!done && monthly != null && monthly > 0 && (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">This month</span>
              <span className="tabular-nums">
                <span className={cn('font-medium', contributed >= monthly && 'text-positive')}>
                  {formatCurrency(contributed)}
                </span>
                <span className="text-muted-foreground"> of {formatCurrency(monthly)}</span>
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (contributed / monthly) * 100)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={onContribute} className="w-full">
          {done ? 'Adjust savings' : 'Add money'}
        </Button>
      </CardContent>
    </Card>
  )
}

/** How the user plans to reach the goal — the core choice of the form.
 *  'date':   pick a deadline, the app computes (and re-computes) the
 *            monthly amount needed to land on it.
 *  'amount': pick a fixed monthly amount, the app projects the finish date.
 *  'flex':   no plan — contribute whenever, nothing budgeted monthly. */
type PlanMode = 'date' | 'amount' | 'flex'

/** Create (template → target & plan, with a live "what it takes" preview)
 *  or edit a goal */
function GoalFormDialog({
  goal,
  onSuccess,
}: {
  goal?: Goal
  onSuccess: () => void
}) {
  const editing = !!goal
  const [step, setStep] = useState<'template' | 'details'>(editing ? 'details' : 'template')
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? String(Number(goal.target_amount)) : '')
  const [starting, setStarting] = useState('')
  const [countStartingThisMonth, setCountStartingThisMonth] = useState(false)
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[0])
  const [icon, setIcon] = useState<string | null>(goal?.icon ?? null)
  const [planMode, setPlanMode] = useState<PlanMode>(
    goal?.monthly_allocation != null
      ? 'amount'
      : goal?.target_date
        ? 'date'
        : editing
          ? 'flex'
          : 'date'
  )
  const [monthly, setMonthly] = useState(
    goal?.monthly_allocation != null ? String(Number(goal.monthly_allocation)) : ''
  )
  const [saving, setSaving] = useState(false)

  const pickTemplate = (t: (typeof GOAL_TEMPLATES)[number]) => {
    setName(t.name)
    setTarget(t.amount > 0 ? String(t.amount) : '')
    setColor(t.color)
    setIcon(t.icon)
    setStep('details')
  }

  const targetNum = parseFloat(target) || 0
  const startingNum = editing ? Number(goal.saved_amount) : parseFloat(starting) || 0
  const monthlyNum = parseFloat(monthly) || 0
  const toSave = Math.max(0, targetNum - startingNum)

  // Live preview: each plan mode derives the number the user DIDN'T type —
  // by-date derives the money, by-amount derives the time.
  let previewHeadline: string | null = null
  let previewDetail: string | null = null
  if (targetNum > 0 && toSave === 0) {
    previewHeadline = 'Already covered 🎉'
    previewDetail = 'Your starting balance meets the target.'
  } else if (planMode === 'date') {
    if (!targetDate) {
      previewDetail = 'Pick a target date to see what it takes per month.'
    } else {
      const months = monthsThrough(targetDate)
      if (months === 0) {
        previewDetail = 'That date has already passed — pick a future month.'
      } else if (targetNum > 0) {
        previewHeadline = `≈ ${formatCurrency(toSave / months)}/mo`
        previewDetail = `for ${months} ${months === 1 ? 'month' : 'months'} — recalculated monthly to keep you on track for ${monthName(targetDate.slice(0, 7))}`
      }
    }
  } else if (planMode === 'amount') {
    if (monthlyNum <= 0) {
      previewDetail = 'Enter a monthly amount to see your finish date.'
    } else if (targetNum > 0) {
      const projected = projectedFinishMonth(targetNum, startingNum, monthlyNum)
      const months = Math.ceil(toSave / monthlyNum)
      if (projected) {
        previewHeadline = `Reach it by ${monthName(projected)}`
        previewDetail = `${months} ${months === 1 ? 'month' : 'months'} of ${formatCurrency(monthlyNum)} — this becomes your plan on the Budgets page`
        if (editing && goal.target_date) {
          previewDetail +=
            projected <= goal.target_date.slice(0, 7)
              ? ` (ahead of your ${monthName(goal.target_date.slice(0, 7))} date)`
              : ` (past your ${monthName(goal.target_date.slice(0, 7))} date)`
        }
      }
    }
  } else {
    previewHeadline = 'No monthly target'
    previewDetail =
      'Contribute whenever you like — nothing is budgeted for this goal each month. You can add a plan later.'
  }

  const invalid =
    !name ||
    targetNum <= 0 ||
    (planMode === 'date' && (!targetDate || monthsThrough(targetDate) === 0)) ||
    (planMode === 'amount' && monthlyNum <= 0)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (invalid) return
    setSaving(true)
    try {
      // 'flex' drops the deadline; 'amount' keeps an existing one (the plan
      // is fixed, but the date stays as the aspiration to compare against)
      const dateToSave =
        planMode === 'date' ? targetDate : planMode === 'flex' ? null : (goal?.target_date ?? null)
      const response = await fetch('/api/goals', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: goal.id } : {}),
          name,
          target_amount: targetNum,
          target_date: dateToSave,
          color,
          icon,
          ...(!editing && planMode === 'amount' && monthlyNum > 0
            ? { monthly_plan: monthlyNum }
            : {}),
        }),
      })
      if (!response.ok) throw new Error('failed')

      // Record a starting balance as an initial contribution
      if (!editing && startingNum > 0) {
        const created = await response.json()
        await fetch('/api/goals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: created.id,
            contribute: startingNum,
            count_this_month: countStartingThisMonth,
          }),
        })
      }

      // Keep the plan in sync when editing: a fixed amount writes/updates
      // the perpetual allocation; switching away from it clears the plan
      if (editing) {
        const hadPlan = goal.monthly_allocation != null
        if (planMode === 'amount' && Number(goal.monthly_allocation ?? NaN) !== monthlyNum) {
          await fetch('/api/goals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal_id: goal.id, amount: monthlyNum, perpetual: true }),
          })
        } else if (planMode !== 'amount' && hadPlan) {
          await fetch('/api/goals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal_id: goal.id, clear: true }),
          })
        }
      }

      toast.success(editing ? 'Goal updated' : 'Goal created')
      onSuccess()
    } catch {
      toast.error(`Failed to ${editing ? 'update' : 'create'} goal`)
    } finally {
      setSaving(false)
    }
  }

  if (step === 'template') {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What are you saving for?</DialogTitle>
          <DialogDescription>Pick a starting point — you can adjust everything next.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-4 sm:grid-cols-3">
          {GOAL_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickTemplate(t)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 transition-colors hover:border-transparent hover:bg-accent"
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, ${t.color} 15%, transparent)` }}
              >
                {t.icon ? (
                  <CategoryIcon icon={t.icon} color={t.color} className="size-5" />
                ) : (
                  <Target className="size-5" style={{ color: t.color }} />
                )}
              </span>
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    )
  }

  return (
    <DialogContent>
      {!editing && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setStep('template')}
          aria-label="Back to templates"
          className="absolute top-2 left-2"
        >
          <ArrowLeft />
        </Button>
      )}
      <form onSubmit={handleSubmit}>
        <DialogHeader className={cn(!editing && 'pl-7')}>
          <DialogTitle>{editing ? `Edit “${goal.name}”` : name || 'New goal'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Adjust the target, the plan, or the look.'
              : 'Set the target, then pick how you want to get there.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Identity: live icon/color preview next to the name */}
          <div className="flex items-center gap-3">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl transition-colors"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
            >
              {icon ? (
                <CategoryIcon icon={icon} color={color} className="size-6" />
              ) : (
                <Target className="size-6" style={{ color }} />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="goal-name" className="sr-only">Name</Label>
              <Input
                id="goal-name"
                required
                autoFocus={!editing}
                placeholder="e.g. Emergency fund, Japan trip"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-base font-medium"
              />
              <div className="flex gap-1.5">
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    className={cn(
                      'size-5 rounded-full transition-transform',
                      color === c && 'scale-110 ring-2 ring-ring ring-offset-2 ring-offset-card'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Target: how much, and where you're starting from */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Target
            </p>
            <div className={cn('grid gap-3', !editing && 'grid-cols-2')}>
              <div className="space-y-1.5">
                <Label htmlFor="goal-target" className="text-xs">Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="goal-target"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    placeholder="5000"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              {!editing && (
                <div className="space-y-1.5">
                  <Label htmlFor="goal-starting" className="text-xs">Already saved</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="goal-starting"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={starting}
                      onChange={(e) => setStarting(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
              )}
            </div>
            {!editing && startingNum > 0 && targetNum > 0 && (
              <div className="space-y-1">
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (startingNum / targetNum) * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You&apos;re starting {Math.round(Math.min(1, startingNum / targetNum) * 100)}% of
                  the way there
                </p>
              </div>
            )}
            {!editing && startingNum > 0 && (
              <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={countStartingThisMonth}
                  onCheckedChange={(v) => setCountStartingThisMonth(v === true)}
                  className="mt-0.5"
                />
                Deduct this from this month&apos;s budget (counts as this month&apos;s
                contribution on the Budgets page)
              </label>
            )}
          </div>

          {/* Plan: pick a date and get the amount, or pick an amount and
              get the date */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Monthly plan
            </p>
            <Tabs value={planMode} onValueChange={(v) => setPlanMode(v as PlanMode)}>
              <TabsList className="w-full">
                <TabsTrigger value="date" className="flex-1">By date</TabsTrigger>
                <TabsTrigger value="amount" className="flex-1">By amount</TabsTrigger>
                <TabsTrigger value="flex" className="flex-1">Flexible</TabsTrigger>
              </TabsList>
            </Tabs>

            {planMode === 'date' && (
              <div className="space-y-1.5">
                <Label htmlFor="goal-date" className="text-xs">Reach it by</Label>
                <DatePicker
                  id="goal-date"
                  value={targetDate}
                  onChange={setTargetDate}
                  placeholder="Pick a date"
                  clearable
                />
              </div>
            )}
            {planMode === 'amount' && (
              <div className="space-y-1.5">
                <Label htmlFor="goal-monthly" className="text-xs">Set aside each month</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="goal-monthly"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="200"
                    value={monthly}
                    onChange={(e) => setMonthly(e.target.value)}
                    className="pl-7"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                    /mo
                  </span>
                </div>
              </div>
            )}

            {(previewHeadline || previewDetail) && (
              <div className="space-y-0.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                {previewHeadline && (
                  <p className="text-sm font-semibold tabular-nums">{previewHeadline}</p>
                )}
                {previewDetail && (
                  <p className="text-xs text-muted-foreground">{previewDetail}</p>
                )}
              </div>
            )}
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Goals get their own group on the Budgets page — the plan sets
            what&apos;s budgeted there, and money you add comes out of that
            month&apos;s remaining budget. It&apos;s savings, not spending, so
            Reports are never affected.
          </p>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving || invalid} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : editing ? 'Save goal' : 'Create goal'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function ContributeDialog({
  goal,
  onSuccess,
}: {
  goal: Goal
  onSuccess: (updated: Goal) => void
}) {
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'add' | 'withdraw'>('add')
  const [saving, setSaving] = useState(false)

  const saved = Number(goal.saved_amount)
  const remaining = Math.max(0, Number(goal.target_amount) - saved)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!value || value <= 0) return
    setSaving(true)
    try {
      const signed = direction === 'add' ? value : -value
      const response = await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goal.id, contribute: signed }),
      })
      if (!response.ok) throw new Error('failed')
      const updated = await response.json()
      toast.success(
        direction === 'add'
          ? `${formatCurrency(value)} added to ${goal.name}`
          : `${formatCurrency(value)} withdrawn from ${goal.name}`
      )
      onSuccess(updated)
    } catch {
      toast.error(direction === 'add' ? 'Failed to add money' : 'Failed to withdraw')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>“{goal.name}”</DialogTitle>
          <DialogDescription>
            {formatCurrency(saved)} saved of {formatCurrency(Number(goal.target_amount))}
            {remaining > 0 && ` — ${formatCurrency(remaining)} to go`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as 'add' | 'withdraw')}>
            <TabsList className="w-full">
              <TabsTrigger value="add" className="flex-1">
                <Plus className="size-3.5" />
                Add
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="flex-1" disabled={saved <= 0}>
                <Minus className="size-3.5" />
                Withdraw
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="contribution">Amount</Label>
            <Input
              id="contribution"
              type="number"
              min="0.01"
              step="0.01"
              required
              autoFocus
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs tabular-nums"
                  onClick={() => setAmount(String(v))}
                >
                  ${v}
                </Button>
              ))}
              {direction === 'add' && remaining > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs tabular-nums"
                  onClick={() => setAmount(String(remaining))}
                >
                  Finish it ({formatCurrency(remaining)})
                </Button>
              )}
              {direction === 'withdraw' && saved > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs tabular-nums"
                  onClick={() => setAmount(String(saved))}
                >
                  All ({formatCurrency(saved)})
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving || !amount} className="w-full">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : direction === 'add' ? (
              'Add money'
            ) : (
              'Withdraw'
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
