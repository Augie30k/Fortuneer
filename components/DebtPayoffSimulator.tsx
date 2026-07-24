'use client'

import type { AccountType, AccountWithItem } from '@/lib/types'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { minimumViablePayment, paymentForMonths, simulatePayoff, type DebtInput } from '@/lib/debt-math'
import { monthName, monthsThrough } from '@/lib/goal-math'
import { TYPE_META } from '@/lib/account-types'
import { cn } from '@/lib/utils'
import DatePicker from '@/components/DatePicker'
import DebtPayoffChart from '@/components/charts/DebtPayoffChart'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** How the user frames the plan — mirrors the goal form's plan modes.
 *  'payment': set a monthly amount, the app derives the payoff date.
 *  'date':    set a debt-free date, the app derives the monthly amount. */
type SimMode = 'payment' | 'date'

/** Sensible APR starting points when the account doesn't carry one —
 *  Plaid accounts have no APY field, so these seed the editable inputs. */
const DEFAULT_APR: Record<string, number> = { credit: 22, loan: 8 }

const QUICK_TERMS = [
  { months: 12, label: '1 yr' },
  { months: 24, label: '2 yrs' },
  { months: 36, label: '3 yrs' },
  { months: 60, label: '5 yrs' },
]

/** Payoff simulator dialog body — parent owns the <Dialog>. Lists every
 *  liability account, preselecting the group whose calculator was clicked. */
export default function DebtPayoffSimulator({
  debts,
  defaultType,
  onDone,
}: {
  debts: AccountWithItem[]
  defaultType: AccountType
  onDone: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(debts.filter((d) => d.type === defaultType).map((d) => d.id))
  )
  const [aprs, setAprs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      debts.map((d) => [
        d.id,
        String(Number(d.apy) > 0 ? Number(d.apy) : (DEFAULT_APR[d.type] ?? 10)),
      ])
    )
  )
  const [mode, setMode] = useState<SimMode>('payment')
  const [payment, setPayment] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [creating, setCreating] = useState(false)

  const selectedDebts: DebtInput[] = useMemo(
    () =>
      debts
        .filter((d) => selected.has(d.id))
        .map((d) => ({
          id: d.id,
          balance: Number(d.balance),
          apr: Math.max(0, parseFloat(aprs[d.id]) || 0),
        }))
        .filter((d) => d.balance > 0),
    [debts, selected, aprs]
  )
  const totalBalance = selectedDebts.reduce((s, d) => s + d.balance, 0)
  const minPayment = minimumViablePayment(selectedDebts)

  // The number the user didn't type: by-payment derives the date,
  // by-date derives the payment.
  const months = mode === 'date' && targetDate ? monthsThrough(targetDate) : 0
  const derivedPayment = useMemo(
    () => (mode === 'date' && months > 0 ? paymentForMonths(selectedDebts, months) : null),
    [mode, months, selectedDebts]
  )
  const paymentNum = mode === 'payment' ? parseFloat(payment) || 0 : (derivedPayment ?? 0)

  const sim = useMemo(
    () => (totalBalance > 0 && paymentNum > 0 ? simulatePayoff(selectedDebts, paymentNum) : null),
    [selectedDebts, totalBalance, paymentNum]
  )

  const toggleDebt = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const singleDebt = selectedDebts.length === 1 ? debts.find((d) => d.id === selectedDebts[0].id) : null
  const goalName = singleDebt ? `Pay off ${singleDebt.name}` : 'Pay off debt'

  const createGoal = async () => {
    if (!sim?.viable || !sim.payoffMonth) return
    setCreating(true)
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: goalName,
          target_amount: Math.round(totalBalance * 100) / 100,
          target_date: `${sim.payoffMonth}-01`,
          icon: 'banknote',
          color: '#FF375F',
        }),
      })
      if (!response.ok) throw new Error('failed')
      const goal = await response.json()

      // Budget the payment on the Budgets page every month through the
      // payoff date, then stop automatically.
      const allocation = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_id: goal.id,
          amount: Math.round(paymentNum * 100) / 100,
          until_target: true,
        }),
      })
      if (!allocation.ok) throw new Error('failed')

      toast.success(
        `Goal created — ${formatCurrency(paymentNum)}/mo budgeted until ${monthName(sim.payoffMonth)}`
      )
      onDone()
    } catch {
      toast.error('Failed to create goal')
    } finally {
      setCreating(false)
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Debt payoff simulator</DialogTitle>
        <DialogDescription>
          Pick the debts to pay down, then set a monthly payment — or a debt-free
          date — to see the plan.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 py-4">
        {/* Which debts */}
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Debts
          </p>
          <div className="space-y-1">
            {debts.map((d) => {
              const Meta = TYPE_META[d.type]
              const checked = selected.has(d.id)
              return (
                <div
                  key={d.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors',
                    checked ? 'bg-accent/50' : 'opacity-60'
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleDebt(d.id)}
                    aria-label={`Include ${d.name}`}
                  />
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `color-mix(in srgb, ${Meta.color} 15%, transparent)` }}
                  >
                    <Meta.icon className="size-3.5" style={{ color: Meta.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(Number(d.balance), d.currency)}
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={aprs[d.id] ?? ''}
                      onChange={(e) => setAprs({ ...aprs, [d.id]: e.target.value })}
                      disabled={!checked}
                      aria-label={`${d.name} APR`}
                      className="h-8 w-24 pr-7 text-right text-sm tabular-nums"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          {selectedDebts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalBalance)} across {selectedDebts.length}{' '}
              {selectedDebts.length === 1 ? 'debt' : 'debts'} — APRs are estimates you can
              adjust to match your statements.
            </p>
          )}
        </div>

        {/* The plan: set the payment, or set the date */}
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Plan
          </p>
          <Tabs value={mode} onValueChange={(v) => setMode(v as SimMode)}>
            <TabsList className="w-full">
              <TabsTrigger value="payment" className="flex-1">Monthly payment</TabsTrigger>
              <TabsTrigger value="date" className="flex-1">Debt-free by</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'payment' ? (
            <div className="space-y-2">
              <Label htmlFor="sim-payment" className="text-xs">Pay each month</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="sim-payment"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder={minPayment > 0 ? `at least ${Math.ceil(minPayment + 1)}` : '250'}
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  className="pl-7"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                  /mo
                </span>
              </div>
              {totalBalance > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TERMS.map((t) => {
                    const p = paymentForMonths(selectedDebts, t.months)
                    if (p == null) return null
                    return (
                      <Button
                        key={t.months}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs tabular-nums"
                        onClick={() => setPayment(String(p))}
                      >
                        {t.label} · {formatCurrency(p)}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sim-date" className="text-xs">Debt-free by</Label>
              <DatePicker id="sim-date" value={targetDate} onChange={setTargetDate} clearable />
              {targetDate && months === 0 && (
                <p className="text-xs text-negative">
                  That date has already passed — pick a future month.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Result */}
        {totalBalance > 0 && paymentNum > 0 && sim && (
          sim.viable && sim.payoffMonth ? (
            <div className="space-y-3">
              <div className="space-y-0.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-sm font-semibold tabular-nums">
                  {mode === 'payment'
                    ? `Debt-free by ${monthName(sim.payoffMonth)}`
                    : `≈ ${formatCurrency(paymentNum)}/mo to be debt-free by ${monthName(sim.payoffMonth)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sim.months} {sim.months === 1 ? 'payment' : 'payments'} of{' '}
                  {formatCurrency(paymentNum)} · {formatCurrency(sim.totalInterest)} in
                  interest · {formatCurrency(sim.totalPaid)} paid in total
                </p>
              </div>

              <DebtPayoffChart data={sim.points} />

              <div className="space-y-2 rounded-lg border border-border px-3 py-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Target className="size-4 text-primary" />
                  Turn this into a goal
                </p>
                <p className="text-xs text-muted-foreground">
                  Creates “{goalName}” ({formatCurrency(totalBalance)}) and budgets{' '}
                  {formatCurrency(paymentNum)}/mo on the Budgets page every month until{' '}
                  {monthName(sim.payoffMonth)}, then stops automatically.
                </p>
                <Button onClick={createGoal} disabled={creating} className="w-full">
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>Create goal + budget {formatCurrency(paymentNum)}/mo</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-negative/30 bg-negative/5 px-3 py-2.5 text-xs text-negative">
              {formatCurrency(paymentNum)}/mo doesn&apos;t keep up with interest — the
              balance never shrinks. You&apos;d need more than{' '}
              {formatCurrency(Math.ceil(minPayment))}/mo to make progress.
            </p>
          )
        )}

        {totalBalance === 0 && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Select at least one debt with a balance to simulate.
          </p>
        )}
      </div>
    </DialogContent>
  )
}
