'use client'

import { Budget } from '@/lib/types'
import { useEffect, useState, type SyntheticEvent } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchBudgets()
  }, [])

  const fetchBudgets = async () => {
    try {
      const response = await fetch('/api/budgets')
      if (!response.ok) throw new Error('Failed to fetch budgets')
      const data = await response.json()
      setBudgets(data.budgets ?? [])
    } catch (error) {
      console.error('Error fetching budgets:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Create and manage spending budgets</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              New Budget
            </Button>
          </DialogTrigger>
          <NewBudgetDialog
            onSuccess={() => {
              setDialogOpen(false)
              fetchBudgets()
            }}
          />
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">No budgets created yet</p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Create Your First Budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetCard({ budget }: { budget: Budget }) {
  const spent = budget.spent ?? 0
  const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
  const statusColor =
    percentage > 100 ? 'text-rose-400' : percentage > 80 ? 'text-amber-400' : 'text-emerald-400'

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">{budget.name}</p>
          <span className="text-sm text-muted-foreground capitalize">{budget.period}</span>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {formatCurrency(spent)} of {formatCurrency(budget.amount)}
          </span>
          <span className={`text-sm font-semibold ${statusColor}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
        <Progress value={Math.min(percentage, 100)} />
      </CardContent>
    </Card>
  )
}

interface NewBudgetDialogProps {
  onSuccess: () => void
}

function NewBudgetDialog({ onSuccess }: NewBudgetDialogProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [formData, setFormData] = useState({
    name: '',
    amount: 0,
    period: 'monthly' as Budget['period'],
    start_date: today,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create budget')
      onSuccess()
    } catch (error) {
      console.error('Error creating budget:', error)
      setError('Failed to create budget. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>New Budget</DialogTitle>
          <DialogDescription>Set a spending limit to track against.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Budget Name</Label>
            <Input
              id="name"
              placeholder="e.g. Groceries"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                value={formData.period}
                onValueChange={(value) =>
                  setFormData({ ...formData, period: value as Budget['period'] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create Budget'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
