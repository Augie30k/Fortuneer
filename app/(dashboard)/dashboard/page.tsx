'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  GripVertical,
  Landmark,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DashboardData, DashboardRange, Goal, RecurringStream } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePersonalization } from '@/components/personalization'
import NetWorthChart from '@/components/charts/NetWorthChart'
import CashFlowChart from '@/components/charts/CashFlowChart'
import SpendPaceGauge from '@/components/charts/SpendPaceGauge'
import CategoryIcon from '@/components/CategoryIcon'
import TransactionRow from '@/components/TransactionRow'
import ConnectAccountDialog from '@/components/ConnectAccountDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

type WidgetId = 'netWorth' | 'cashFlow' | 'spending' | 'bills' | 'goals' | 'recent'

const WIDGET_LABELS: Record<WidgetId, string> = {
  netWorth: 'Net worth chart',
  cashFlow: 'Cash flow',
  spending: 'Spending by category',
  bills: 'Upcoming bills',
  goals: 'Goals',
  recent: 'Recent activity',
}

const DEFAULT_WIDGETS: { id: WidgetId; visible: boolean }[] = [
  { id: 'netWorth', visible: true },
  { id: 'cashFlow', visible: true },
  { id: 'spending', visible: true },
  { id: 'bills', visible: true },
  { id: 'goals', visible: true },
  { id: 'recent', visible: true },
]

const WIDGETS_KEY = 'fortuneer.dashboard.widgets'
const RANGE_KEY = 'fortuneer.dashboard.range'

// Where each onboarding persona is pointed while their dashboard is still
// empty — the thing they said they came here to do
const PERSONA_SUGGESTIONS: Record<string, { label: string; href: string }> = {
  debt: { label: 'plan your debt payoff', href: '/projections' },
  saving: { label: 'visit your goals', href: '/goals' },
  budgeting: { label: 'shape your budget', href: '/budgets' },
  overview: { label: 'explore reports', href: '/reports' },
  investing: { label: 'set up your portfolio', href: '/investments' },
}

/** "Good morning, Augie" once onboarding gave us a name; plain "Dashboard" otherwise */
function greetingFor(name: string | null): string {
  if (!name) return 'Dashboard'
  const hour = new Date().getHours()
  const salutation = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${salutation}, ${name.split(' ')[0]}`
}

function loadWidgets(): { id: WidgetId; visible: boolean }[] {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY)
    if (!raw) return DEFAULT_WIDGETS
    const parsed = JSON.parse(raw) as { id: WidgetId; visible: boolean }[]
    // Reconcile with defaults so new widgets appear for existing users
    const known = new Set(parsed.map((w) => w.id))
    return [
      ...parsed.filter((w) => w.id in WIDGET_LABELS),
      ...DEFAULT_WIDGETS.filter((w) => !known.has(w.id)),
    ]
  } catch {
    return DEFAULT_WIDGETS
  }
}

export default function DashboardPage() {
  const { preferredName, persona } = usePersonalization()
  const [data, setData] = useState<DashboardData | null>(null)
  const [bills, setBills] = useState<RecurringStream[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const [connectingAccount, setConnectingAccount] = useState(false)
  const [range, setRange] = useState<DashboardRange>('6m')
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    setWidgets(loadWidgets())
    try {
      const saved = localStorage.getItem(RANGE_KEY) as DashboardRange | null
      if (saved && RANGES.some((r) => r.value === saved)) setRange(saved)
    } catch {}
  }, [])

  const fetchData = useCallback(
    async (selectedRange: DashboardRange, initial = false) => {
      if (!initial) setRefetching(true)
      try {
        const response = await fetch(`/api/dashboard?range=${selectedRange}`)
        if (!response.ok) throw new Error('failed')
        setData(await response.json())
      } catch (error) {
        console.error('Error fetching dashboard:', error)
      } finally {
        setLoading(false)
        setRefetching(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchData(range, true)
    fetch('/api/recurring')
      .then((r) => r.json())
      .then((d) => setBills((d.streams ?? []).slice(0, 5)))
      .catch(console.error)
    fetch('/api/goals')
      .then((r) => r.json())
      .then((d) => setGoals(d.goals ?? []))
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeRange = (value: string) => {
    const next = value as DashboardRange
    setRange(next)
    try {
      localStorage.setItem(RANGE_KEY, next)
    } catch {}
    fetchData(next)
  }

  const updateWidgets = (next: { id: WidgetId; visible: boolean }[]) => {
    setWidgets(next)
    try {
      localStorage.setItem(WIDGETS_KEY, JSON.stringify(next))
    } catch {}
  }

  const toggleWidget = (id: WidgetId) =>
    updateWidgets(widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const visibleIds = widgets.filter((w) => w.visible).map((w) => w.id)
    const from = visibleIds.indexOf(active.id as WidgetId)
    const to = visibleIds.indexOf(over.id as WidgetId)
    if (from < 0 || to < 0) return
    const reordered = arrayMove(visibleIds, from, to)
    // Merge new visible order back, leaving hidden entries where they sit
    let cursor = 0
    updateWidgets(
      widgets.map((w) => (w.visible ? { id: reordered[cursor++], visible: true } : w))
    )
  }

  const spendDelta = useMemo(() => {
    if (!data || data.prevToDateSpending <= 0) return null
    return (data.monthlySpending - data.prevToDateSpending) / data.prevToDateSpending
  }, [data])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-44" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const suggestion = persona ? PERSONA_SUGGESTIONS[persona] : null

  const hasAccounts = data.accounts.length > 0
  if (!hasAccounts) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">{greetingFor(preferredName)}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            {connectingAccount ? (
              <>
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Loader2 className="size-7 animate-spin text-primary" />
                </span>
                <div>
                  <p className="text-lg font-semibold">Setting up your account</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Importing accounts and transactions — this takes just a few seconds.
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Landmark className="size-7 text-primary" />
                </span>
                <div>
                  <p className="text-lg font-semibold">Welcome to Fortuneer</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Connect a bank account to see your net worth, cash flow, and spending
                    — all in one place.
                  </p>
                </div>
                <ConnectAccountDialog
                  onConnecting={() => setConnectingAccount(true)}
                  onError={() => setConnectingAccount(false)}
                  onSuccess={() => fetchData(range).finally(() => setConnectingAccount(false))}
                />
                {suggestion && (
                  <Link
                    href={suggestion.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    No bank needed yet — {suggestion.label}
                    <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const savingsRate =
    data.monthlyIncome > 0
      ? Math.max(0, (data.monthlyIncome - data.monthlySpending) / data.monthlyIncome)
      : null

  const totalSpend = data.spendingByCategory.reduce((s, c) => s + c.amount, 0)
  const topCategories = data.spendingByCategory.slice(0, 6)
  const otherAmount = data.spendingByCategory.slice(6).reduce((s, c) => s + c.amount, 0)

  const widgetContent: Record<WidgetId, React.ReactNode> = {
    netWorth: (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Net worth over time</CardTitle>
        </CardHeader>
        <CardContent>
          {data.netWorthHistory.length > 1 ? (
            <NetWorthChart data={data.netWorthHistory} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              History builds as your accounts sync each day — check back tomorrow.
            </p>
          )}
        </CardContent>
      </Card>
    ),
    cashFlow: (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Cash flow</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={data.cashFlow} />
        </CardContent>
      </Card>
    ),
    spending: (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Spending this month</CardTitle>
        </CardHeader>
        <CardContent>
          {topCategories.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No spending recorded this month yet.
            </p>
          ) : (
            <div className="space-y-3">
              {topCategories.map((c) => (
                <CategorySpendRow
                  key={c.categoryId}
                  name={c.name}
                  icon={c.icon}
                  color={c.color}
                  amount={c.amount}
                  share={totalSpend > 0 ? c.amount / totalSpend : 0}
                />
              ))}
              {otherAmount > 0 && (
                <CategorySpendRow
                  name="Other"
                  icon="circle-ellipsis"
                  color="#8E8E93"
                  amount={otherAmount}
                  share={totalSpend > 0 ? otherAmount / totalSpend : 0}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    ),
    bills: (
      <Card>
        <CardHeader className="flex-row items-center">
          <CardTitle className="text-sm font-semibold">Upcoming bills</CardTitle>
          <Link
            href="/recurring"
            className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            All recurring
            <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {bills.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No recurring charges detected yet.
            </p>
          ) : (
            bills.map((b, i) => (
              <div key={b.key}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 py-2.5">
                  <CategoryIcon chip icon={b.category?.icon} color={b.category?.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(b.nextDate, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(b.averageAmount)}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    ),
    goals: (
      <Card>
        <CardHeader className="flex-row items-center">
          <CardTitle className="text-sm font-semibold">Goals</CardTitle>
          <Link
            href="/goals"
            className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            All goals
            <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {goals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No goals yet — set one on the Goals page.
            </p>
          ) : (
            goals.slice(0, 4).map((g, i) => {
              const saved = Number(g.saved_amount)
              const target = Number(g.target_amount)
              const ratio = target > 0 ? Math.min(1, saved / target) : 0
              const color = g.color ?? 'var(--chart-1)'
              return (
                <div key={g.id}>
                  {i > 0 && <Separator />}
                  <div className="py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                        {g.icon && <CategoryIcon icon={g.icon} color={color} className="size-4 shrink-0" />}
                        {g.name}
                      </p>
                      <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(saved)}{' '}
                        <span className="text-muted-foreground/70">of {formatCurrency(target)}</span>
                      </p>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full"
                      style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${ratio * 100}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    ),
    recent: (
      <Card>
        <CardHeader className="flex-row items-center">
          <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
          <Link
            href="/transactions"
            className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {data.recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            data.recentTransactions.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <Separator />}
                <TransactionRow transaction={t} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    ),
  }

  // Half-width widgets pair up; full-width ones take the row
  const HALF_WIDTH = new Set<WidgetId>(['cashFlow', 'spending', 'bills', 'goals'])
  // Goals widget stays out of the normal view with nothing to show, but
  // still shows up in edit mode so it can be managed like any other widget
  const visible = widgets.filter(
    (w) => w.visible && !(w.id === 'goals' && goals.length === 0 && !editMode)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{greetingFor(preferredName)}</h1>
        <div className="flex items-center gap-2">
          <Tabs value={range} onValueChange={changeRange}>
            <TabsList className="h-8">
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value} className="px-2.5 text-xs">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {editMode ? (
            <Button size="sm" onClick={() => setEditMode(false)}>
              <Check />
              Done
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <SlidersHorizontal />
              Edit
            </Button>
          )}
        </div>
      </div>

      {editMode && (
        <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
          Arrange your dashboard: drag widgets to reorder, ✕ to remove. Removed
          widgets appear below — tap to add them back.
        </p>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Net worth" value={formatCurrency(data.netWorth)} hero />
        <StatTile label="Assets" value={formatCurrency(data.totalAssets)} />
        <StatTile
          label="Spending this month"
          value={formatCurrency(data.monthlySpending)}
          delta={
            spendDelta != null ? (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  spendDelta > 0 ? 'text-negative' : 'text-positive'
                )}
              >
                {spendDelta > 0 ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {Math.abs(Math.round(spendDelta * 100))}% vs this time last month
              </span>
            ) : undefined
          }
          right={<SpendPaceGauge delta={spendDelta} />}
        />
        <StatTile
          label="Savings rate"
          value={savingsRate == null ? '—' : `${Math.round(savingsRate * 100)}%`}
          sub={
            data.monthlyIncome > 0
              ? `${formatCurrency(data.monthlyIncome)} income`
              : 'No income yet this month'
          }
        />
      </div>

      {/* Widgets, in user order; refetch dims instead of skeleton-flashing */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={visible.map((w) => w.id)}
          strategy={rectSortingStrategy}
          disabled={!editMode}
        >
          <div
            className={cn(
              'grid grid-cols-1 gap-6 transition-opacity lg:grid-cols-2',
              refetching && 'pointer-events-none opacity-60'
            )}
          >
            {visible.map((w) => (
              <SortableWidget
                key={w.id}
                id={w.id}
                label={WIDGET_LABELS[w.id]}
                editMode={editMode}
                fullWidth={!HALF_WIDTH.has(w.id)}
                onRemove={() => toggleWidget(w.id)}
              >
                {widgetContent[w.id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Hidden-widget tray, edit mode only */}
      {editMode && widgets.some((w) => !w.visible) && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">Add back:</p>
          {widgets
            .filter((w) => !w.visible)
            .map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleWidget(w.id)}
                className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="size-3" />
                {WIDGET_LABELS[w.id]}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function SortableWidget({
  id,
  label,
  editMode,
  fullWidth,
  onRemove,
  children,
}: {
  id: string
  label: string
  editMode: boolean
  fullWidth: boolean
  onRemove: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative', fullWidth && 'lg:col-span-2', isDragging && 'z-20 opacity-80')}
    >
      {editMode && (
        <div className="absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1 shadow-sm">
          <GripVertical className="size-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      <div
        {...(editMode ? { ...attributes, ...listeners } : {})}
        className={cn(
          editMode &&
            'cursor-grab rounded-xl ring-2 ring-primary/30 transition-shadow select-none active:cursor-grabbing [&>*]:pointer-events-none'
        )}
      >
        {children}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  delta,
  hero = false,
  right,
}: {
  label: string
  value: string
  sub?: string
  delta?: React.ReactNode
  hero?: boolean
  right?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-1 font-semibold',
              hero ? 'text-2xl lg:text-3xl' : 'text-xl lg:text-2xl'
            )}
          >
            {value}
          </p>
          {delta && <div className="mt-0.5">{delta}</div>}
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {right}
      </CardContent>
    </Card>
  )
}

function CategorySpendRow({
  name,
  icon,
  color,
  amount,
  share,
}: {
  name: string
  icon: string | null
  color: string | null
  amount: number
  share: number
}) {
  return (
    <div className="flex items-center gap-3">
      <CategoryIcon chip icon={icon} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(amount)}
          </p>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, share * 100)}%`,
              backgroundColor: color ?? '#8E8E93',
            }}
          />
        </div>
      </div>
    </div>
  )
}
