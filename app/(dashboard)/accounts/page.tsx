'use client'

import { AccountWithItem, AccountType } from '@/lib/types'
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { Landmark, Loader2, Plus, RefreshCw, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import PlaidLinkButton from '@/components/PlaidLinkButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

const TYPE_LABEL: Record<AccountType, string> = {
  depository: 'Cash',
  credit: 'Credit',
  loan: 'Loan',
  investment: 'Investment',
  other: 'Other',
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      setAccounts(data.accounts ?? [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/plaid/sync', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error('sync failed')
      toast.success(
        data.added + data.modified > 0
          ? `Synced — ${data.added} new, ${data.modified} updated`
          : 'Everything up to date'
      )
      fetchAccounts()
    } catch (error) {
      console.error('Error syncing:', error)
      toast.error('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, AccountWithItem[]>()
    for (const a of accounts) {
      const key = a.is_manual ? 'Manual accounts' : (a.plaid_items?.institution_name ?? 'Linked')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return [...map.entries()]
  }, [accounts])

  const hasLinked = accounts.some((a) => !a.is_manual)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Connected banks and manual accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasLinked && (
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw />}
              Sync
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus />
                Manual
              </Button>
            </DialogTrigger>
            <AddManualAccountDialog
              onSuccess={() => {
                setDialogOpen(false)
                fetchAccounts()
              }}
            />
          </Dialog>
          <PlaidLinkButton onLinked={fetchAccounts} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <Landmark className="size-6 text-primary" />
            </span>
            <div>
              <p className="font-medium">Connect your first account</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Link a bank securely with Plaid, or track one manually.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                Add manually
              </Button>
              <PlaidLinkButton onLinked={fetchAccounts} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([institution, rows]) => (
            <Card key={institution}>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  {institution === 'Manual accounts' ? (
                    <Wallet className="size-4 text-muted-foreground" />
                  ) : (
                    <Landmark className="size-4 text-muted-foreground" />
                  )}
                  {institution}
                  <span className="ml-auto font-normal text-muted-foreground">
                    {formatCurrency(rows.reduce((s, a) => s + Number(a.balance), 0))}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {rows.map((account, i) => (
                  <div key={account.id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {account.name}
                          {account.mask && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ••{account.mask}
                            </span>
                          )}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {account.subtype ?? TYPE_LABEL[account.type]}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums">
                          {formatCurrency(Number(account.balance), account.currency)}
                        </p>
                        {account.available_balance != null && (
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(Number(account.available_balance), account.currency)}{' '}
                            available
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function AddManualAccountDialog({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'depository' as AccountType,
    balance: 0,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('failed')
      toast.success('Account added')
      onSuccess()
    } catch (error) {
      console.error('Error creating account:', error)
      toast.error('Failed to add account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Add manual account</DialogTitle>
          <DialogDescription>
            Track an account without connecting a bank.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              placeholder="e.g. Cash, Brokerage"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as AccountType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
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
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Add account'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
