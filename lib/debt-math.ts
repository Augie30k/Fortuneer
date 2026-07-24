// Client-safe math for the debt payoff simulator. Mirrors the spirit of
// lib/goal-math.ts: one source of truth so the simulator's chart, summary,
// and the goal it creates all agree.
//
// Payments are pooled across the selected debts and applied avalanche-style
// (highest APR first) after each debt accrues its own month of interest —
// the mathematically optimal order, and what "one monthly payment toward my
// debt" actually means for a plan.

export interface DebtInput {
  id: string
  balance: number
  /** Annual rate %, e.g. 22.9 */
  apr: number
}

export interface PayoffPoint {
  /** 'YYYY-MM' */
  month: string
  balance: number
  /** Cumulative interest accrued through this month */
  interestPaid: number
  /** Cumulative amount paid through this month */
  totalPaid: number
}

export interface PayoffResult {
  /** False when the payment never outruns interest — balances only grow */
  viable: boolean
  /** Number of monthly payments until every balance hits zero */
  months: number
  /** 'YYYY-MM' of the final payment; null when not viable */
  payoffMonth: string | null
  totalInterest: number
  totalPaid: number
  points: PayoffPoint[]
}

/** Hard stop so a barely-viable payment can't spin forever (50 years). */
const MAX_MONTHS = 600

function monthKey(from: Date, offset: number): string {
  const d = new Date(from.getFullYear(), from.getMonth() + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** One month of interest on the starting balances — any payment at or below
 *  this can never reduce the total. The practical floor for the payment input. */
export function minimumViablePayment(debts: DebtInput[]): number {
  return debts.reduce((s, d) => s + d.balance * (d.apr / 100 / 12), 0)
}

/** Simulate paying `monthlyPayment` toward `debts` starting this month.
 *  Point 0 is today's combined balance; each following point is the balance
 *  after that month's interest + payment. */
export function simulatePayoff(
  debts: DebtInput[],
  monthlyPayment: number,
  from = new Date()
): PayoffResult {
  const active = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, rate: d.apr / 100 / 12 }))
    .sort((a, b) => b.rate - a.rate)

  const startBalance = active.reduce((s, d) => s + d.balance, 0)
  const points: PayoffPoint[] = [
    { month: monthKey(from, 0), balance: startBalance, interestPaid: 0, totalPaid: 0 },
  ]

  if (startBalance <= 0) {
    return { viable: true, months: 0, payoffMonth: monthKey(from, 0), totalInterest: 0, totalPaid: 0, points }
  }

  let totalInterest = 0
  let totalPaid = 0

  for (let m = 1; m <= MAX_MONTHS; m++) {
    const before = active.reduce((s, d) => s + d.balance, 0)

    for (const d of active) {
      const interest = d.balance * d.rate
      d.balance += interest
      totalInterest += interest
    }

    // Avalanche: the pool hits the highest-APR balance first
    let pool = monthlyPayment
    for (const d of active) {
      if (pool <= 0) break
      const pay = Math.min(pool, d.balance)
      d.balance -= pay
      pool -= pay
    }
    totalPaid += monthlyPayment - pool

    const after = active.reduce((s, d) => s + d.balance, 0)
    points.push({
      month: monthKey(from, m),
      balance: Math.max(0, after),
      interestPaid: totalInterest,
      totalPaid,
    })

    if (after <= 0.005) {
      return {
        viable: true,
        months: m,
        payoffMonth: monthKey(from, m),
        totalInterest,
        totalPaid,
        points,
      }
    }
    // Interest outran the payment — this plan never finishes
    if (after >= before) {
      return { viable: false, months: 0, payoffMonth: null, totalInterest, totalPaid, points: [] }
    }
  }

  return { viable: false, months: 0, payoffMonth: null, totalInterest, totalPaid, points: [] }
}

/** Smallest monthly payment (to the cent) that clears `debts` within
 *  `months` payments. Binary search over the simulation, so it stays exact
 *  for any mix of APRs. Null when months < 1 or there's nothing to pay. */
export function paymentForMonths(
  debts: DebtInput[],
  months: number,
  from = new Date()
): number | null {
  const total = debts.reduce((s, d) => s + Math.max(0, d.balance), 0)
  if (total <= 0 || months < 1) return null

  let lo = 0
  // Enough to clear everything in a single payment, interest included
  let hi = debts.reduce((s, d) => s + Math.max(0, d.balance) * (1 + d.apr / 100 / 12), 0)
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const sim = simulatePayoff(debts, mid, from)
    if (sim.viable && sim.months <= months) hi = mid
    else lo = mid
  }
  return Math.ceil(hi * 100) / 100
}
