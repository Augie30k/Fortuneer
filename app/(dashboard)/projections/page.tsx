'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Armchair,
  Baby,
  Banknote,
  Briefcase,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gem,
  House,
  Info,
  Loader2,
  MapPin,
  Pause,
  Pencil,
  Plane,
  Plus,
  Sparkles,
  Telescope,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardData } from '@/lib/types'
import {
  DEFAULT_ASSUMPTIONS,
  LIFE_EVENT_TEMPLATES,
  computeEventImpacts,
  currentMonth,
  deriveBaselineAssumptions,
  monthAdd,
  simulateProjection,
  type LifeEvent,
  type LifeEventKind,
  type ProjectionAssumptions,
  type ProjectionScenario,
} from '@/lib/projection-math'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format'
import { cn } from '@/lib/utils'
import TrajectoryChart from '@/components/charts/TrajectoryChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

const EVENT_ICONS: Record<LifeEventKind, LucideIcon> = {
  home: House,
  car: CarFront,
  child: Baby,
  raise: TrendingUp,
  'career-break': Pause,
  wedding: Gem,
  trip: Plane,
  windfall: Coins,
  business: Briefcase,
  move: MapPin,
  retire: Armchair,
  'debt-free': Banknote,
  custom: Sparkles,
}

const templateFor = (kind: LifeEventKind) =>
  LIFE_EVENT_TEMPLATES.find((t) => t.kind === kind) ?? LIFE_EVENT_TEMPLATES[LIFE_EVENT_TEMPLATES.length - 1]

const eventColor = (kind: LifeEventKind) => templateFor(kind).color

type Step = 'baseline' | 'events' | 'render'

const STEPS: { key: Step; label: string }[] = [
  { key: 'baseline', label: 'Baseline' },
  { key: 'events', label: 'Life events' },
  { key: 'render', label: 'Trajectory' },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatEventMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`
}

/** Signed money as "+$1,200" / "−$500" with no decimals. */
function signedMoney(v: number) {
  const abs = formatCurrency(Math.abs(v), 'USD', { maximumFractionDigits: 0 })
  return v < 0 ? `−${abs}` : `+${abs}`
}

/** Info icon revealing a tooltip — keeps labels to a word or two. */
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" tabIndex={-1} aria-label="More info" className="cursor-help">
          <Info className="size-3.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

function FieldLabel({ label, info }: { label: string; info?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {info && <InfoTip text={info} />}
    </span>
  )
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  info,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  step?: number
  info?: string
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} info={info} />
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={cn('tabular-nums', prefix && 'pl-7', suffix && 'pr-8')}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

/** Amount field with an explicit "money out / money in" segmented toggle —
 *  the sign lives in the toggle so users never type negative numbers. */
function SignedAmountField({
  label,
  value,
  onChange,
  outLabel,
  inLabel,
  info,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  outLabel: string
  inLabel: string
  info?: string
}) {
  const [dir, setDir] = useState<'out' | 'in'>(value > 0 ? 'in' : 'out')
  const abs = Math.abs(value)
  const commit = (amount: number, direction: 'out' | 'in') =>
    onChange(direction === 'out' ? -Math.abs(amount) : Math.abs(amount))
  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} info={info} />
      <div className="flex rounded-lg bg-secondary p-0.5 text-xs font-medium">
        {(
          [
            ['out', outLabel],
            ['in', inLabel],
          ] as const
        ).map(([d, text]) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDir(d)
              commit(abs, d)
            }}
            className={cn(
              'flex-1 rounded-md py-1.5 transition-colors',
              dir === d
                ? d === 'out'
                  ? 'bg-card text-negative shadow-sm'
                  : 'bg-card text-positive shadow-sm'
                : 'text-muted-foreground'
            )}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          $
        </span>
        <Input
          type="number"
          min={0}
          value={abs || ''}
          placeholder="0"
          onChange={(e) => commit(Math.abs(parseFloat(e.target.value) || 0), dir)}
          className="pl-7 tabular-nums"
        />
      </div>
    </div>
  )
}

const DURATION_CHIPS: { label: string; months: number | null }[] = [
  { label: '1 yr', months: 12 },
  { label: '5 yrs', months: 60 },
  { label: '10 yrs', months: 120 },
  { label: 'Ongoing', months: null },
]

/** "For how long" picker: quick chips plus a custom months input. */
function DurationField({
  value,
  onChange,
}: {
  value: number | null
  onChange: (months: number | null) => void
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel
        label="Duration"
        info="How long the monthly amount keeps applying — Ongoing means the rest of the projection."
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {DURATION_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onChange(c.months)}
            className={cn(
              'rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors',
              value === c.months
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            {c.label}
          </button>
        ))}
        <div className="relative w-28">
          <Input
            type="number"
            min={0}
            value={value ?? ''}
            placeholder="Custom"
            onChange={(e) => {
              const v = Math.round(parseFloat(e.target.value) || 0)
              onChange(v > 0 ? v : null)
            }}
            className="h-8 pr-14 text-xs tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-muted-foreground">
            months
          </span>
        </div>
      </div>
    </div>
  )
}

const RETURN_PRESETS = [
  { label: 'Cautious', value: 4 },
  { label: 'Balanced', value: 6 },
  { label: 'Aggressive', value: 8 },
]

function MonthPicker({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  const [y, m] = value.split('-').map(Number)
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 51 }, (_, i) => thisYear + i)
  return (
    <div className="flex gap-2">
      <Select value={String(m)} onValueChange={(v) => onChange(`${y}-${String(v).padStart(2, '0')}`)}>
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(y)} onValueChange={(v) => onChange(`${v}-${String(m).padStart(2, '0')}`)}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function ProjectionsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<Step>('baseline')
  const [seededFrom, setSeededFrom] = useState<'data' | 'blank'>('blank')

  const [scenarios, setScenarios] = useState<ProjectionScenario[]>([])
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  const [scenarioName, setScenarioName] = useState('My trajectory')
  const [compareId, setCompareId] = useState<string | null>(null)

  const [assumptions, setAssumptions] = useState<ProjectionAssumptions>({
    ...DEFAULT_ASSUMPTIONS,
    netWorth: 0,
    monthlyIncome: 0,
    monthlySpending: 0,
  })
  const [events, setEvents] = useState<LifeEvent[]>([])

  const [editing, setEditing] = useState<LifeEvent | null>(null)
  const [axisMode, setAxisMode] = useState<'calendar' | 'age'>('calendar')
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const hydrated = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [dashRes, scenRes] = await Promise.all([
          fetch('/api/dashboard?range=1y'),
          fetch('/api/projections'),
        ])
        const dash = (await dashRes.json()) as DashboardData
        const scen = await scenRes.json()
        if (cancelled) return

        const saved: ProjectionScenario[] = scen.scenarios ?? []
        setScenarios(saved)

        if (saved.length > 0) {
          const s = saved[0]
          setScenarioId(s.id)
          setScenarioName(s.name)
          setAssumptions(s.assumptions)
          setEvents(s.events ?? [])
          setStep('render')
        } else if (dash && !('error' in dash)) {
          setAssumptions(deriveBaselineAssumptions({ netWorth: dash.netWorth, cashFlow: dash.cashFlow }))
          setSeededFrom('data')
        }
      } catch (error) {
        console.error('Error loading projections:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const result = useMemo(() => simulateProjection(assumptions, events), [assumptions, events])
  const impacts = useMemo(() => computeEventImpacts(assumptions, events), [assumptions, events])
  const impactById = useMemo(() => new Map(impacts.map((i) => [i.eventId, i.horizonDelta])), [impacts])

  const compareScenario = useMemo(() => {
    if (!compareId) return null
    const s = scenarios.find((x) => x.id === compareId)
    if (!s || s.id === scenarioId) return null
    return { name: s.name, points: simulateProjection(s.assumptions, s.events ?? []).points }
  }, [compareId, scenarios, scenarioId])

  const chartEvents = useMemo(
    () => events.map((e) => ({ ...e, color: eventColor(e.kind) })),
    [events]
  )

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.start.localeCompare(b.start)),
    [events]
  )

  const horizonYear = Number(currentMonth().slice(0, 4)) + assumptions.years
  const fi = result.milestones.find((m) => m.kind === 'fi')
  const dip = result.milestones.find((m) => m.kind === 'dip')

  const addEvent = (kind: LifeEventKind) => {
    const t = templateFor(kind)
    const event: LifeEvent = {
      id: crypto.randomUUID(),
      kind,
      name: t.kind === 'custom' ? 'Custom event' : t.label,
      start: monthAdd(currentMonth(), t.yearsOut * 12),
      ...t.defaults,
    }
    setEvents((prev) => [...prev, event])
    setEditing(event)
  }

  const saveEditing = () => {
    if (!editing) return
    setEvents((prev) => prev.map((e) => (e.id === editing.id ? editing : e)))
    setEditing(null)
  }

  const removeEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  const savingRef = useRef(false)

  const saveScenario = useCallback(
    async (asNew = false, silent = false) => {
      // One request at a time — a queued autosave will retry on the next edit
      if (savingRef.current) return
      savingRef.current = true
      setSaving(true)
      try {
        const payload = { name: scenarioName, assumptions, events }
        const isUpdate = scenarioId && !asNew
        const response = await fetch('/api/projections', {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isUpdate ? { id: scenarioId, ...payload } : payload),
        })
        if (!response.ok) throw new Error('Save failed')
        const saved: ProjectionScenario = await response.json()
        setScenarioId(saved.id)
        setScenarios((prev) => {
          const rest = prev.filter((s) => s.id !== saved.id)
          return [saved, ...rest]
        })
        if (silent) setAutoState('saved')
        else toast.success(isUpdate ? 'Scenario updated' : 'Scenario saved')
      } catch (error) {
        console.error('Error saving scenario:', error)
        // Autosave failures stay quiet — an inline "Couldn't save" instead of
        // a toast per keystroke; the next edit retries anyway.
        if (silent) setAutoState('error')
        else toast.error('Could not save the scenario')
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    },
    [scenarioId, scenarioName, assumptions, events]
  )

  // Autosave: any change to the working scenario persists after a short
  // pause, so people can leave and come back without losing anything.
  useEffect(() => {
    if (loading) return
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    setAutoState('saving')
    const t = setTimeout(() => {
      void saveScenario(false, true)
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assumptions, events, scenarioName, loading])

  const switchScenario = (id: string) => {
    const s = scenarios.find((x) => x.id === id)
    if (!s) return
    hydrated.current = false // loading a saved scenario isn't an edit
    setScenarioId(s.id)
    setScenarioName(s.name)
    setAssumptions(s.assumptions)
    setEvents(s.events ?? [])
    if (compareId === s.id) setCompareId(null)
  }

  const newScenario = () => {
    hydrated.current = false // the copy is created on the first real edit
    setScenarioId(null)
    setScenarioName(`Scenario ${scenarios.length + 1}`)
    setStep('baseline')
  }

  const deleteScenario = async () => {
    if (!scenarioId) return
    try {
      const response = await fetch(`/api/projections?id=${scenarioId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
      const rest = scenarios.filter((s) => s.id !== scenarioId)
      setScenarios(rest)
      if (compareId === scenarioId) setCompareId(null)
      if (rest.length > 0) {
        switchScenario(rest[0].id)
      } else {
        hydrated.current = false
        setScenarioId(null)
        setScenarioName('My trajectory')
        setEvents([])
        setStep('baseline')
      }
      toast.success('Scenario deleted')
    } catch (error) {
      console.error('Error deleting scenario:', error)
      toast.error('Could not delete the scenario')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--chart-1)] to-[var(--chart-hub)] shadow-sm">
              <Telescope className="size-5 text-white" />
            </span>
            Projections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add life&apos;s big moments. See where the path leads.
          </p>
        </div>
        {scenarios.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={scenarioId ?? ''} onValueChange={switchScenario}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Unsaved scenario" />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={newScenario}>
              <Plus />
              New
            </Button>
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-4 text-muted-foreground/50" />}
            <button
              onClick={() => setStep(s.key)}
              className={cn(
                'flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                step === s.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                  step === s.key
                    ? 'bg-primary text-primary-foreground'
                    : i < stepIndex
                      ? 'bg-positive/15 text-positive'
                      : 'bg-secondary text-secondary-foreground'
                )}
              >
                {i < stepIndex ? <Check className="size-3" /> : i + 1}
              </span>
              {s.label}
            </button>
          </div>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {autoState === 'saving' && (
            <>
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </>
          )}
          {autoState === 'saved' && (
            <>
              <Check className="size-3 text-positive" />
              Saved
            </>
          )}
          {autoState === 'error' && (
            <span className="flex items-center gap-1.5 text-destructive">
              Couldn&apos;t save
              <InfoTip text="Your edits are kept on screen and saving retries on the next change. If this persists, check your connection." />
            </span>
          )}
        </span>
      </div>

      {/* ---- Step 1: Baseline ---- */}
      {step === 'baseline' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Starting point</h2>
                  {seededFrom === 'data' && (
                    <span className="rounded-full bg-positive/10 px-2.5 py-0.5 text-[11px] font-medium text-positive">
                      Seeded from your accounts
                    </span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField
                    label="Net worth"
                    prefix="$"
                    value={assumptions.netWorth}
                    onChange={(v) => setAssumptions((a) => ({ ...a, netWorth: v }))}
                    info="Everything you own minus everything you owe — seeded from your accounts."
                  />
                  <NumberField
                    label="Money in"
                    prefix="$"
                    value={assumptions.monthlyIncome}
                    onChange={(v) => setAssumptions((a) => ({ ...a, monthlyIncome: v }))}
                    info="Average monthly take-home income, from your history."
                  />
                  <NumberField
                    label="Money out"
                    prefix="$"
                    value={assumptions.monthlySpending}
                    onChange={(v) => setAssumptions((a) => ({ ...a, monthlySpending: v }))}
                    info="Typical monthly spending, from your history."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Saving {formatCurrency(Math.max(0, assumptions.monthlyIncome - assumptions.monthlySpending), 'USD', { maximumFractionDigits: 0 })}/mo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-sm font-semibold">Growth</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <NumberField
                      label="Growth"
                      suffix="% / yr"
                      step={0.5}
                      value={assumptions.annualReturn}
                      onChange={(v) => setAssumptions((a) => ({ ...a, annualReturn: v }))}
                      info="What your savings and investments earn on average each year. 6% ≈ a balanced portfolio."
                    />
                    <div className="flex gap-1.5 pt-1">
                      {RETURN_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setAssumptions((a) => ({ ...a, annualReturn: p.value }))}
                          className={cn(
                            'rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                            assumptions.annualReturn === p.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-accent'
                          )}
                        >
                          {p.label} {p.value}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <NumberField
                    label="Market swing"
                    suffix="±%"
                    step={0.5}
                    value={assumptions.returnSpread}
                    onChange={(v) => setAssumptions((a) => ({ ...a, returnSpread: Math.max(0, v) }))}
                    info="How far good or bad markets could land from your growth guess — sets the width of the shaded band."
                  />
                  <NumberField
                    label="Raises"
                    suffix="% / yr"
                    step={0.5}
                    value={assumptions.incomeGrowth}
                    onChange={(v) => setAssumptions((a) => ({ ...a, incomeGrowth: v }))}
                    info="How much your income grows each year."
                  />
                  <NumberField
                    label="Inflation"
                    suffix="% / yr"
                    step={0.5}
                    value={assumptions.inflation}
                    onChange={(v) => setAssumptions((a) => ({ ...a, inflation: v }))}
                    info="Your spending creeps up this much each year."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-sm font-semibold">Horizon</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Look ahead"
                    suffix="years"
                    value={assumptions.years}
                    onChange={(v) => setAssumptions((a) => ({ ...a, years: Math.min(50, Math.max(1, Math.round(v))) }))}
                    info="Anywhere from 1 to 50 years."
                  />
                  <NumberField
                    label="Age"
                    value={assumptions.currentAge ?? 0}
                    onChange={(v) =>
                      setAssumptions((a) => ({ ...a, currentAge: v > 0 ? Math.round(v) : null }))
                    }
                    info="Optional — the timeline can read “Age 40” instead of “2036”."
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setStep('events')}>
                Next: Life events
                <ChevronRight />
              </Button>
            </div>
          </div>

          <LivePreview
            result={result}
            events={chartEvents}
            ageBase={null}
            caption={`${formatCurrencyCompact(result.horizon)} expected by ${horizonYear}`}
          />
        </div>
      )}

      {/* ---- Step 2: Life events ---- */}
      {step === 'events' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-sm font-semibold">Add a milestone</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {LIFE_EVENT_TEMPLATES.map((t) => {
                    const Icon = EVENT_ICONS[t.kind]
                    return (
                      <button
                        key={t.kind}
                        onClick={() => addEvent(t.kind)}
                        className="group flex flex-col items-start gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:border-transparent hover:bg-accent"
                      >
                        <span
                          className="flex size-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${t.color}1F` }}
                        >
                          <Icon className="size-4" style={{ color: t.color }} />
                        </span>
                        <span className="text-[13px] font-medium leading-tight">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {sortedEvents.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="mb-3 text-sm font-semibold">
                    Your timeline · {sortedEvents.length} {sortedEvents.length === 1 ? 'event' : 'events'}
                  </h2>
                  <div className="divide-y divide-border">
                    {sortedEvents.map((e) => {
                      const Icon = EVENT_ICONS[e.kind]
                      const color = eventColor(e.kind)
                      return (
                        <div key={e.id} className="flex items-center gap-3 py-3">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${color}1F` }}
                          >
                            <Icon className="size-4.5" style={{ color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{e.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatEventMonth(e.start)}
                              {e.oneTime !== 0 && ` · ${signedMoney(e.oneTime)} once`}
                              {e.monthly !== 0 &&
                                ` · ${signedMoney(e.monthly)}/mo${e.months ? ` for ${Math.round(e.months / 12)}y` : ''}`}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ ...e })}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeEvent(e.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('baseline')}>
                <ChevronLeft />
                Baseline
              </Button>
              <Button onClick={() => setStep('render')}>
                See trajectory
                <ChevronRight />
              </Button>
            </div>
          </div>

          <LivePreview
            result={result}
            events={chartEvents}
            ageBase={null}
            caption={`${formatCurrencyCompact(result.horizon)} expected by ${horizonYear}`}
          />
        </div>
      )}

      {/* ---- Step 3: Trajectory ---- */}
      {step === 'render' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    className="h-8 w-44 border-transparent bg-transparent px-2 text-sm font-semibold hover:border-border focus-visible:border-border"
                    aria-label="Scenario name"
                  />
                  {scenarioId && (
                    <Button variant="outline" size="sm" onClick={() => saveScenario(true)} disabled={saving}>
                      Save a copy
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {assumptions.currentAge !== null && (
                    <Tabs value={axisMode} onValueChange={(v) => setAxisMode(v as 'calendar' | 'age')}>
                      <TabsList className="h-8">
                        <TabsTrigger value="calendar" className="text-xs">
                          Years
                        </TabsTrigger>
                        <TabsTrigger value="age" className="text-xs">
                          Age
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  {scenarios.filter((s) => s.id !== scenarioId).length > 0 && (
                    <Select
                      value={compareId ?? 'none'}
                      onValueChange={(v) => setCompareId(v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Compare with…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No comparison</SelectItem>
                        {scenarios
                          .filter((s) => s.id !== scenarioId)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              vs. {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <TrajectoryChart
                points={result.points}
                events={chartEvents}
                milestones={result.milestones}
                compare={compareScenario}
                ageBase={axisMode === 'age' ? assumptions.currentAge : null}
              />

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-5 rounded-full bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-hub)]" />
                  Expected path
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-5 rounded-sm bg-[var(--chart-1)]/15" />
                  Range ±{assumptions.returnSpread}%
                  <InfoTip text="Where you could land if markets do better or worse than your growth guess." />
                </span>
                {compareScenario && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-5 rounded-full bg-[var(--chart-4)]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--chart-4) 0 4px, transparent 4px 7px)' }} />
                    {compareScenario.name}
                  </span>
                )}
                {chartEvents.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full border-2 border-card bg-[var(--chart-3)]" />
                    Life events
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Insight tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Expected in {horizonYear}
                  {assumptions.currentAge !== null && ` · age ${assumptions.currentAge + assumptions.years}`}
                </p>
                <p className="mt-1 bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-hub)] bg-clip-text text-2xl font-semibold text-transparent tabular-nums">
                  {formatCurrency(result.horizon, 'USD', { maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                  {formatCurrencyCompact(result.horizonLow)} – {formatCurrencyCompact(result.horizonHigh)}
                  <InfoTip text="The low end if markets struggle, the high end if they do well." />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Financial independence
                </p>
                {fi ? (
                  <>
                    <p className="mt-1 text-2xl font-semibold">{formatEventMonth(fi.month)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      At {formatCurrencyCompact(fi.value)}
                      <InfoTip text="The point where your net worth reaches 25× your annual spending — enough to live off ~4% withdrawals." />
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-semibold text-muted-foreground">Beyond horizon</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      Not within {assumptions.years} yrs
                      <InfoTip text="Reached when net worth hits 25× your annual spending — enough to live off ~4% withdrawals." />
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className={cn(dip && 'border-destructive/40')}>
              <CardContent className="pt-6">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {dip ? 'Warning' : 'Milestones ahead'}
                </p>
                {dip ? (
                  <>
                    <p className="mt-1 text-2xl font-semibold text-destructive">
                      Below $0 in {formatEventMonth(dip.month)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      Path dips negative
                      <InfoTip text="The expected path goes below zero — try spacing events out or trimming their costs." />
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {result.milestones.filter((m) => m.kind === 'threshold').length}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      Marks crossed
                      <InfoTip text="Net-worth levels ($50K, $100K, $250K…) your expected path crosses within the horizon." />
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Milestone timeline */}
          {result.milestones.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  Milestones
                  <InfoTip text="Read off the expected (middle) path." />
                </h2>
                <div className="flex flex-wrap gap-2">
                  {result.milestones.map((m) => (
                    <span
                      key={`${m.kind}-${m.label}-${m.month}`}
                      className={cn(
                        'flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium',
                        m.kind === 'fi' && 'border-positive/40 bg-positive/10 text-positive',
                        m.kind === 'dip' && 'border-destructive/40 bg-destructive/10 text-destructive'
                      )}
                    >
                      {m.label}
                      <span className="font-normal text-muted-foreground">{formatEventMonth(m.month)}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event impacts */}
          {sortedEvents.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  What each choice is worth
                  <InfoTip
                    text={`Expected net worth in ${horizonYear} with the event, versus without it.`}
                  />
                </h2>
                <div className="divide-y divide-border">
                  {sortedEvents.map((e) => {
                    const Icon = EVENT_ICONS[e.kind]
                    const color = eventColor(e.kind)
                    const delta = impactById.get(e.id) ?? 0
                    return (
                      <div key={e.id} className="flex items-center gap-3 py-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${color}1F` }}
                        >
                          <Icon className="size-4.5" style={{ color }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.name}</p>
                          <p className="text-xs text-muted-foreground">{formatEventMonth(e.start)}</p>
                        </div>
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            delta >= 0 ? 'text-positive' : 'text-negative'
                          )}
                        >
                          {signedMoney(Math.round(delta))}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('baseline')}>
                <Pencil />
                Adjust baseline
              </Button>
              <Button variant="outline" onClick={() => setStep('events')}>
                <Plus />
                Edit events
              </Button>
            </div>
            {scenarioId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-muted-foreground hover:text-destructive">
                    <Trash2 />
                    Delete scenario
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{scenarioName}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the saved scenario. Your accounts and transactions are untouched.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteScenario}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}

      {/* Event editor */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = EVENT_ICONS[editing.kind]
                    const color = eventColor(editing.kind)
                    return (
                      <span
                        className="flex size-7 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${color}1F` }}
                      >
                        <Icon className="size-4" style={{ color }} />
                      </span>
                    )
                  })()}
                  {templateFor(editing.kind).label}
                </DialogTitle>
                <DialogDescription>{templateFor(editing.kind).description}</DialogDescription>
              </DialogHeader>
              {/* Keyed so the Cost/Gain toggles reset when a different event opens */}
              <div key={editing.id} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">When</Label>
                  <MonthPicker
                    value={editing.start}
                    onChange={(start) => setEditing({ ...editing, start })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SignedAmountField
                    label="Up-front"
                    outLabel="Money out"
                    inLabel="Money in"
                    value={editing.oneTime}
                    onChange={(v) => setEditing({ ...editing, oneTime: v })}
                    info="Paid or received once, when this happens."
                  />
                  <SignedAmountField
                    label="Monthly"
                    outLabel="Costs me"
                    inLabel="Saves me"
                    value={editing.monthly}
                    onChange={(v) => setEditing({ ...editing, monthly: v })}
                    info="Ongoing change to your monthly budget afterwards."
                  />
                </div>
                {editing.monthly !== 0 && (
                  <DurationField
                    value={editing.months}
                    onChange={(months) => setEditing({ ...editing, months })}
                  />
                )}
                {(editing.kind === 'home' || editing.kind === 'business' || editing.kind === 'custom') && (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label="Asset value"
                      prefix="$"
                      value={editing.assetValue}
                      onChange={(v) => setEditing({ ...editing, assetValue: Math.max(0, v) })}
                      info="The home or stake you'd own — its growth adds to your net worth."
                    />
                    <NumberField
                      label="Growth"
                      suffix="% / yr"
                      step={0.5}
                      value={editing.assetGrowth}
                      onChange={(v) => setEditing({ ...editing, assetGrowth: v })}
                      info="Typical home appreciation is 3–4% a year."
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  className="mr-auto text-muted-foreground hover:text-destructive"
                  onClick={() => removeEvent(editing.id)}
                >
                  <Trash2 />
                  Remove
                </Button>
                <Button onClick={saveEditing}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}

/** Compact always-current preview shown beside the setup steps. */
function LivePreview({
  result,
  events,
  ageBase,
  caption,
}: {
  result: ReturnType<typeof simulateProjection>
  events: Parameters<typeof TrajectoryChart>[0]['events']
  ageBase: number | null
  caption: string
}) {
  return (
    <div className="lg:sticky lg:top-8 lg:self-start">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Live preview
          </p>
          <p className="mt-1 mb-2 text-lg font-semibold">{caption}</p>
          <TrajectoryChart
            points={result.points}
            events={events}
            milestones={result.milestones}
            ageBase={ageBase}
            height={240}
          />
        </CardContent>
      </Card>
    </div>
  )
}
