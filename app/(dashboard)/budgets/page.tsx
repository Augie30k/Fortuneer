'use client'

import type { BudgetWithSpend, Category } from '@/lib/types'
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import CategoryIcon from '@/components/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpend[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchBudgets = useCallback(async () => {
    try {
      const response = await fetch(`/api/budgets?month=${month}`)
      const data = await response.json()
      setBudgets(data.budgets ?? [])
    } catch (error) {
      console.error('Error fetching budgets:', error)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) =>
        setCategories(
          (data.categories ?? []).filter((c: Category) => !c.is_income && !c.is_transfer)
        )
      )
      .catch(console.error)
  }, [])

  const unbudgetedCategories = useMemo(() => {
    const used = new Set(budgets.map((b) => b.category_id))
    return categories.filter((c) => !used.has(c.id))
  }, [budgets, categories])

  const totals = useMemo(() => {
    const budgeted = budgets.reduce((s, b) => s + Number(b.amount), 0)
    const spent = budgets.reduce((s, b) => s + b.spent, 0)
    return { budgeted, spent, remaining: budgeted - spent }
  }, [budgets])

  const removeBudget = async (id: string) => {
    try {
      const response = await fetch(`/api/budgets?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      setBudgets((prev) => prev.filter((b) => b.id !== id))
      toast.success('Budget removed')
    } catch {
      toast.error('Failed to remove budget')
    }
  }

  const isCurrentMonth = month === currentMonth()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Monthly limits per category
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={unbudgetedCategories.length === 0}>
              <Plus />
              New budget
            </Button>
          </DialogTrigger>
          <NewBudgetDialog
            categories={unbudgetedCategories}
            onSuccess={() => {
              setDialogOpen(false)
              fetchBudgets()
            }}
          />
        </Dialog>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={isCurrentMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight />
        </Button>
        {!isCurrentMonth && (
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
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-medium">No budgets yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Set a monthly limit for a category and Fortuneer tracks your spending
              against it automatically.
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Create your first budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <Card>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Budgeted</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(totals.budgeted)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Spent</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(totals.spent)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Remaining</p>
                <p
                  className={cn(
                    'mt-1 text-lg font-semibold',
                    totals.remaining < 0 ? 'text-negative' : 'text-positive'
                  )}
                >
                  {formatCurrency(totals.remaining)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {budgets.map((budget) => (
              <BudgetRow key={budget.id} budget={budget} onRemove={() => removeBudget(budget.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BudgetRow({ budget, onRemove }: { budget: BudgetWithSpend; onRemove: () => void }) {
  const amount = Number(budget.amount)
  const ratio = amount > 0 ? budget.spent / amount : 0
  const over = ratio > 1
  const near = ratio > 0.85 && !over

  // Meter: fill carries severity; track is a lighter step of the same ramp
  const fill = over ? 'var(--destructive)' : near ? '#FF9500' : 'var(--chart-1)'
  const track = over
    ? 'color-mix(in srgb, var(--destructive) 15%, transparent)'
    : near
      ? 'color-mix(in srgb, #FF9500 15%, transparent)'
      : 'color-mix(in srgb, var(--chart-1) 12%, transparent)'

  return (
    <Card className="group">
      <CardContent className="flex items-center gap-3">
        <CategoryIcon chip icon={budget.category?.icon} color={budget.category?.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium">{budget.category?.name}</p>
            <p className="shrink-0 text-sm tabular-nums">
              <span className={cn('font-semibold', over && 'text-negative')}>
                {formatCurrency(budget.spent)}
              </span>
              <span className="text-muted-foreground"> / {formatCurrency(amount)}</span>
            </p>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: track }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: fill }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {over
              ? `${formatCurrency(budget.spent - amount)} over budget`
              : `${formatCurrency(amount - budget.spent)} left`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Remove ${budget.category?.name} budget`}
        >
          <Trash2 className="text-muted-foreground" />
        </Button>
      </CardContent>
    </Card>
  )
}

function NewBudgetDialog({
  categories,
  onSuccess,
}: {
  categories: Category[]
  onSuccess: () => void
}) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!categoryId || !amount) return
    setSaving(true)
    try {
      const response = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, amount: parseFloat(amount) }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success('Budget created')
      setCategoryId('')
      setAmount('')
      onSuccess()
    } catch {
      toast.error('Failed to create budget')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>Set a monthly spending limit for a category.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <CategoryIcon icon={c.icon} color={c.color} />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Monthly amount</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving || !categoryId || !amount} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Create budget'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
