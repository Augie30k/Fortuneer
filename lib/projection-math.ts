import type { CashFlowMonth } from './types'

// Platform-neutral life-trajectory simulation, shared by the web
// /projections page and the mobile app. The engine is deterministic:
// three bands (conservative / expected / optimistic) come from a return
// spread around the expected annual return, not Monte Carlo, so results
// are stable across renders and identical on both platforms.

export type LifeEventKind =
  | 'home'
  | 'car'
  | 'child'
  | 'raise'
  | 'career-break'
  | 'wedding'
  | 'trip'
  | 'windfall'
  | 'business'
  | 'move'
  | 'retire'
  | 'debt-free'
  | 'custom'

export interface LifeEvent {
  id: string
  kind: LifeEventKind
  name: string
  /** YYYY-MM the event happens (one-time) or begins (recurring) */
  start: string
  /** One-time net-worth impact at start: + money in, − money out */
  oneTime: number
  /** Ongoing monthly cash-flow change from start: + saves more, − costs more */
  monthly: number
  /** How many months the monthly change lasts; null = rest of the projection */
  months: number | null
  /** Appreciating asset acquired at start (home, business); its growth accrues to net worth */
  assetValue: number
  /** Annual appreciation % applied to assetValue */
  assetGrowth: number
}

export interface ProjectionAssumptions {
  /** Starting net worth (seeded from accounts) */
  netWorth: number
  /** Current monthly income (seeded from cash-flow history) */
  monthlyIncome: number
  /** Current monthly spending (seeded from cash-flow history) */
  monthlySpending: number
  /** Expected annual return % on positive net worth */
  annualReturn: number
  /** Half-width of the uncertainty band, in percentage points of annual return */
  returnSpread: number
  /** Annual income growth % */
  incomeGrowth: number
  /** Annual inflation % applied to spending */
  inflation: number
  /** Projection length in years */
  years: number
  /** Current age, if the user wants an age axis; null hides it */
  currentAge: number | null
}

export interface ProjectionPoint {
  /** YYYY-MM */
  month: string
  expected: number
  low: number
  high: number
}

export interface ProjectionMilestone {
  month: string
  kind: 'threshold' | 'fi' | 'dip'
  label: string
  /** Expected-band net worth when the milestone is reached */
  value: number
}

export interface ProjectionResult {
  points: ProjectionPoint[]
  milestones: ProjectionMilestone[]
  /** Expected net worth at the end of the horizon */
  horizon: number
  horizonLow: number
  horizonHigh: number
}

export interface EventImpact {
  eventId: string
  /** Expected net-worth difference at the horizon vs a run without this event */
  horizonDelta: number
}

/** Saved scenario row (projection_scenarios table). */
export interface ProjectionScenario {
  id: string
  user_id: string
  name: string
  assumptions: ProjectionAssumptions
  events: LifeEvent[]
  created_at: string
  updated_at: string
}

export interface LifeEventTemplate {
  kind: LifeEventKind
  label: string
  description: string
  color: string
  /** Years from now the event defaults to when added */
  yearsOut: number
  defaults: Pick<LifeEvent, 'oneTime' | 'monthly' | 'months' | 'assetValue' | 'assetGrowth'>
}

/** Starting points for the add-event flow. Amounts are honest defaults the
 *  user is expected to edit — e.g. a home purchase's one-time hit is the
 *  closing costs (the down payment just moves cash into equity), while the
 *  property itself appreciates via assetValue/assetGrowth. */
export const LIFE_EVENT_TEMPLATES: LifeEventTemplate[] = [
  {
    kind: 'home',
    label: 'Buy a home',
    description: 'Closing costs up front, a payment change, and an appreciating asset',
    color: '#AF52DE',
    yearsOut: 3,
    defaults: { oneTime: -15000, monthly: -500, months: null, assetValue: 350000, assetGrowth: 3.5 },
  },
  {
    kind: 'child',
    label: 'Have a child',
    description: 'Up-front costs plus ~18 years of monthly expenses',
    color: '#FF9500',
    yearsOut: 2,
    defaults: { oneTime: -5000, monthly: -1100, months: 216, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'raise',
    label: 'Raise / new job',
    description: 'A lasting bump to monthly income',
    color: '#248A3D',
    yearsOut: 1,
    defaults: { oneTime: 0, monthly: 800, months: null, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'car',
    label: 'New car',
    description: 'Down payment plus a finance payment for five years',
    color: '#30B0C7',
    yearsOut: 1,
    defaults: { oneTime: -8000, monthly: -450, months: 60, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'wedding',
    label: 'Wedding',
    description: 'A one-time celebration budget',
    color: '#FF375F',
    yearsOut: 2,
    defaults: { oneTime: -25000, monthly: 0, months: null, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'career-break',
    label: 'Career break',
    description: 'Pause income for a sabbatical or transition',
    color: '#E8A200',
    yearsOut: 2,
    defaults: { oneTime: 0, monthly: -4000, months: 6, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'business',
    label: 'Start a business',
    description: 'Invest cash now for an appreciating stake',
    color: '#5E5CE6',
    yearsOut: 2,
    defaults: { oneTime: -30000, monthly: -500, months: 24, assetValue: 30000, assetGrowth: 8 },
  },
  {
    kind: 'trip',
    label: 'Big trip',
    description: 'A one-time travel budget',
    color: '#0A84FF',
    yearsOut: 1,
    defaults: { oneTime: -6000, monthly: 0, months: null, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'windfall',
    label: 'Windfall',
    description: 'Inheritance, equity vesting, a big bonus',
    color: '#24A148',
    yearsOut: 3,
    defaults: { oneTime: 50000, monthly: 0, months: null, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'move',
    label: 'Move cities',
    description: 'A lasting cost-of-living change',
    color: '#C2703D',
    yearsOut: 2,
    defaults: { oneTime: -4000, monthly: -400, months: null, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'debt-free',
    label: 'Pay off a debt',
    description: 'A payment you free up going forward',
    color: '#0071E3',
    yearsOut: 2,
    defaults: { oneTime: 0, monthly: 350, months: null, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'retire',
    label: 'Retire',
    description: 'Employment income stops; spending continues',
    color: '#8E8E93',
    yearsOut: 25,
    defaults: { oneTime: 0, monthly: -5000, months: null, assetValue: 0, assetGrowth: 0 },
  },
  {
    kind: 'custom',
    label: 'Something else',
    description: 'Any one-time or recurring change',
    color: '#86868B',
    yearsOut: 1,
    defaults: { oneTime: 0, monthly: 0, months: null, assetValue: 0, assetGrowth: 0 },
  },
]

export const DEFAULT_ASSUMPTIONS: Omit<ProjectionAssumptions, 'netWorth' | 'monthlyIncome' | 'monthlySpending'> = {
  annualReturn: 6,
  returnSpread: 3,
  incomeGrowth: 3,
  inflation: 2.5,
  years: 25,
  currentAge: null,
}

/** YYYY-MM plus n months. */
export function monthAdd(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Whole months from a to b (b >= a → positive). */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Seed baseline assumptions from real data: current net worth plus the
 *  average of fully-elapsed months in the cash-flow history (the current
 *  partial month would skew averages low). */
export function deriveBaselineAssumptions(input: {
  netWorth: number
  cashFlow: CashFlowMonth[]
  now?: Date
}): ProjectionAssumptions {
  const nowMonth = currentMonth(input.now)
  const complete = input.cashFlow.filter((m) => m.month < nowMonth && (m.income > 0 || m.expenses > 0))
  const monthlyIncome = complete.length
    ? Math.round(complete.reduce((s, m) => s + m.income, 0) / complete.length)
    : 0
  const monthlySpending = complete.length
    ? Math.round(complete.reduce((s, m) => s + m.expenses, 0) / complete.length)
    : 0
  return {
    ...DEFAULT_ASSUMPTIONS,
    netWorth: Math.round(input.netWorth),
    monthlyIncome,
    monthlySpending,
  }
}

const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1

/** Net-worth thresholds announced as milestones when first crossed upward. */
const THRESHOLDS = [50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000]

function thresholdLabel(v: number) {
  return v >= 1_000_000 ? `$${v / 1_000_000}M` : `$${v / 1_000}K`
}

/**
 * Run the trajectory. Monthly steps from `startMonth` (defaults to the
 * current month) over `assumptions.years`. Per band per month:
 *   1. market growth on the positive part of net worth (debt doesn't compound at market rate)
 *   2. savings = income (growing) − spending (inflating) + active event monthly deltas
 *   3. event one-time amounts land in their start month
 *   4. event assets appreciate at their own rate, identically across bands
 */
export function simulateProjection(
  assumptions: ProjectionAssumptions,
  events: LifeEvent[],
  startMonth?: string
): ProjectionResult {
  const start = startMonth ?? currentMonth()
  const totalMonths = Math.max(12, Math.round(assumptions.years * 12))

  const rates = {
    low: monthlyRate(assumptions.annualReturn - assumptions.returnSpread),
    expected: monthlyRate(assumptions.annualReturn),
    high: monthlyRate(assumptions.annualReturn + assumptions.returnSpread),
  }
  const incomeGrowthM = monthlyRate(assumptions.incomeGrowth)
  const inflationM = monthlyRate(assumptions.inflation)

  // Pre-index events by month offset
  const eventStartOffsets = events.map((e) => Math.max(0, monthDiff(start, e.start)))

  let low = assumptions.netWorth
  let expected = assumptions.netWorth
  let high = assumptions.netWorth
  let income = assumptions.monthlyIncome
  let spending = assumptions.monthlySpending
  const assetValues = events.map(() => 0)

  const points: ProjectionPoint[] = [
    { month: start, expected: Math.round(expected), low: Math.round(low), high: Math.round(high) },
  ]
  const milestones: ProjectionMilestone[] = []
  const crossed = new Set<number>()
  let fiReached = false
  let dipReported = assumptions.netWorth < 0

  for (let m = 1; m <= totalMonths; m++) {
    const month = monthAdd(start, m)

    // 1. market growth on the positive part only
    low += Math.max(0, low) * rates.low
    expected += Math.max(0, expected) * rates.expected
    high += Math.max(0, high) * rates.high

    // 2. baseline cash flow drift
    income *= 1 + incomeGrowthM
    spending *= 1 + inflationM
    let delta = income - spending

    // 3. events
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      const startOffset = eventStartOffsets[i]
      if (m === startOffset) {
        delta += e.oneTime
        assetValues[i] = e.assetValue
      }
      if (m >= startOffset && (e.months === null || m < startOffset + e.months)) {
        delta += e.monthly
      }
      // 4. asset appreciation accrues to net worth in every band
      if (assetValues[i] > 0) {
        const growth = assetValues[i] * monthlyRate(e.assetGrowth)
        assetValues[i] += growth
        delta += growth
      }
    }

    low += delta
    expected += delta
    high += delta

    points.push({
      month,
      expected: Math.round(expected),
      low: Math.round(low),
      high: Math.round(high),
    })

    // Milestones read off the expected band
    for (let t = 0; t < THRESHOLDS.length; t++) {
      if (!crossed.has(t) && expected >= THRESHOLDS[t] && assumptions.netWorth < THRESHOLDS[t]) {
        crossed.add(t)
        milestones.push({
          month,
          kind: 'threshold',
          label: thresholdLabel(THRESHOLDS[t]),
          value: Math.round(expected),
        })
      }
    }
    // Financial independence: 25× annual spending at that point (4% rule)
    if (!fiReached && spending > 0 && expected >= spending * 12 * 25) {
      fiReached = true
      milestones.push({
        month,
        kind: 'fi',
        label: 'Financial independence',
        value: Math.round(expected),
      })
    }
    if (!dipReported && expected < 0) {
      dipReported = true
      milestones.push({ month, kind: 'dip', label: 'Net worth dips negative', value: Math.round(expected) })
    }
  }

  return {
    points,
    milestones,
    horizon: Math.round(expected),
    horizonLow: Math.round(low),
    horizonHigh: Math.round(high),
  }
}

/** What each event is worth by the horizon: expected net worth with all
 *  events vs. with that one removed. Positive = the event leaves you ahead. */
export function computeEventImpacts(
  assumptions: ProjectionAssumptions,
  events: LifeEvent[],
  startMonth?: string
): EventImpact[] {
  if (events.length === 0) return []
  const full = simulateProjection(assumptions, events, startMonth).horizon
  return events.map((e) => ({
    eventId: e.id,
    horizonDelta: full - simulateProjection(assumptions, events.filter((x) => x.id !== e.id), startMonth).horizon,
  }))
}
