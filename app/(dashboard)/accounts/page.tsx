'use client'

import { Account } from '@/lib/types'
import { useEffect, useState, type SyntheticEvent } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit',
  investment: 'Investment',
  loan: 'Loan',
  other: 'Other',
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      setAccounts(data.accounts ?? [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your financial accounts</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              Add Account
            </Button>
          </DialogTrigger>
          <AddAccountDialog
            onSuccess={() => {
              setDialogOpen(false)
              fetchAccounts()
            }}
          />
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">No accounts yet</p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Create Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{account.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{ACCOUNT_TYPE_LABEL[account.type]}</Badge>
                    {account.is_connected && (
                      <span className="text-xs text-emerald-400">Connected</span>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(account.balance, account.currency)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

interface AddAccountDialogProps {
  onSuccess: () => void
}

function AddAccountDialog({ onSuccess }: AddAccountDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as Account['type'],
    balance: 0,
    currency: 'USD',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create account')
      onSuccess()
    } catch (error) {
      console.error('Error creating account:', error)
      setError('Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>Track a bank, credit, or investment account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as Account['type'] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance">Balance</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) =>
                  setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create Account'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
