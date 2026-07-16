'use client'

import type { AccountWithItem, Category, TransactionWithRefs } from '@/lib/types'
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { parseCsv, toCsv, downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import BalanceChart, { type BalancePoint } from '@/components/charts/BalanceChart'
import CategoryIcon from '@/components/CategoryIcon'
import DatePicker from '@/components/DatePicker'
import TransactionRow from '@/components/TransactionRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const RANGES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

const PAGE_SIZE = 25

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [account, setAccount] = useState<AccountWithItem | null>(null)
  const [history, setHistory] = useState<BalancePoint[]>([])
  const [range, setRange] = useState('6m')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)

  const [transactions, setTransactions] = useState<TransactionWithRefs[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [addTxnOpen, setAddTxnOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  const balancesFileRef = useRef<HTMLInputElement>(null)
  const transactionsFileRef = useRef<HTMLInputElement>(null)

  const fetchDetail = useCallback(async () => {
    setChartLoading(true)
    try {
      const response = await fetch(`/api/accounts/${id}/detail?range=${range}`)
      if (response.status === 404) {
        toast.error('Account not found')
        router.push('/accounts')
        return
      }
      const data = await response.json()
      setAccount(data.account)
      setHistory(data.history ?? [])
    } catch (error) {
      console.error('Error fetching account:', error)
    } finally {
      setLoading(false)
      setChartLoading(false)
    }
  }, [id, range, router])

  const fetchTransactions = useCallback(
    async (offset = 0) => {
      try {
        const response = await fetch(
          `/api/transactions?accountId=${id}&limit=${PAGE_SIZE}&offset=${offset}`
        )
        const data = await response.json()
        setTransactions((prev) =>
          offset === 0 ? (data.transactions ?? []) : [...prev, ...(data.transactions ?? [])]
        )
        setTotal(data.total ?? 0)
      } catch (error) {
        console.error('Error fetching transactions:', error)
      }
    },
    [id]
  )

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  useEffect(() => {
    fetchTransactions(0)
  }, [fetchTransactions])

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(console.error)
  }, [])

  const refreshAll = () => {
    fetchDetail()
    fetchTransactions(0)
  }

  const patchAccount = async (body: Record<string, unknown>, message: string) => {
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('failed')
      toast.success(message)
      fetchDetail()
    } catch {
      toast.error('Update failed')
    }
  }

  const deleteAccount = async () => {
    try {
      const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      toast.success('Account removed')
      router.push('/accounts')
    } catch {
      toast.error('Failed to remove account')
    }
  }

  const downloadBalances = () => {
    downloadCsv(
      `${account?.name ?? 'account'}-balances.csv`,
      toCsv(['Date', 'Balance'], history.map((h) => [h.date, h.balance.toFixed(2)]))
    )
  }

  const uploadBalances = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      if (rows.length === 0) throw new Error('empty')
      const hasHeader = isNaN(parseFloat(rows[0][1]))
      const entries = rows
        .slice(hasHeader ? 1 : 0)
        .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && !isNaN(parseFloat(r[1])))
        .map((r) => ({ date: r[0], balance: parseFloat(r[1]) }))
      if (entries.length === 0) throw new Error('no valid rows')
      const response = await fetch(`/api/accounts/${id}/balances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      if (!response.ok) throw new Error('failed')
      const { saved } = await response.json()
      toast.success(`${saved} balance ${saved === 1 ? 'entry' : 'entries'} imported`)
      fetchDetail()
    } catch (e) {
      console.error(e)
      toast.error('Balance upload failed — expected CSV rows of Date (YYYY-MM-DD), Balance')
    }
  }

  const uploadTransactions = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) throw new Error('empty')
      const header = rows[0].map((h) => h.trim().toLowerCase())
      const di = header.indexOf('date')
      const de = header.indexOf('description')
      const am = header.indexOf('amount')
      const ca = header.indexOf('category')
      if (di < 0 || de < 0 || am < 0) throw new Error('missing columns')
      const parsed = rows.slice(1).map((r) => ({
        date: r[di],
        description: r[de],
        amount: parseFloat(r[am]),
        category: ca >= 0 ? r[ca] : undefined,
      }))
      const response = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: id, rows: parsed }),
      })
      if (!response.ok) throw new Error('failed')
      const { imported, skipped } = await response.json()
      toast.success(`${imported} transactions imported${skipped ? `, ${skipped} skipped` : ''}`)
      refreshAll()
    } catch (e) {
      console.error(e)
      toast.error('Import failed — expected CSV with Date, Description, Amount (+ Category) columns')
    }
  }

  if (loading || !account) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for uploads */}
      <input
        ref={balancesFileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) uploadBalances(f)
          e.target.value = ''
        }}
      />
      <input
        ref={transactionsFileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) uploadTransactions(f)
          e.target.value = ''
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/accounts"
            className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Accounts
          </Link>
          <h1 className="text-3xl font-semibold">
            {account.name}
            {account.mask && (
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                ••{account.mask}
              </span>
            )}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="secondary">
              {account.is_manual
                ? 'Manual'
                : (account.plaid_items?.institution_name ?? 'Linked')}
            </Badge>
            {account.subtype && (
              <span className="text-xs text-muted-foreground capitalize">{account.subtype}</span>
            )}
            {Number(account.apy) > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {Number(account.apy)}% APY · {account.compound_frequency}
              </Badge>
            )}
            {account.hidden && <Badge variant="outline">Hidden</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-3xl font-semibold tabular-nums">
            {formatCurrency(Number(account.balance), account.currency)}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Manage account">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Manage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {account.is_manual && (
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Edit account
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                <History />
                Edit balance history
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={downloadBalances}>
                <Download />
                Download balances (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/transactions/export?accountId=${id}`} target="_blank" rel="noreferrer">
                  <Download />
                  Download transactions (CSV)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => balancesFileRef.current?.click()}>
                <Upload />
                Upload balances (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => transactionsFileRef.current?.click()}>
                <Upload />
                Upload transactions (CSV)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  patchAccount(
                    { hidden: !account.hidden },
                    account.hidden ? 'Account unhidden' : 'Account hidden'
                  )
                }
              >
                {account.hidden ? <Eye /> : <EyeOff />}
                {account.hidden ? 'Unhide' : 'Hide'} account
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={deleteAccount}>
                <Trash2 />
                {account.is_manual ? 'Delete account' : 'Remove account'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Balance over time */}
      <Card>
        <CardHeader className="flex-row items-center">
          <CardTitle className="text-sm font-semibold">Balance over time</CardTitle>
          <Tabs value={range} onValueChange={setRange} className="ml-auto">
            <TabsList className="h-8">
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value} className="px-2.5 text-xs">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className={cn('transition-opacity', chartLoading && 'opacity-60')}>
          {history.length > 1 ? (
            <BalanceChart data={history} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Balance history builds as this account syncs — or upload past balances
              from the manage menu.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader className="flex-row items-center">
          <CardTitle className="text-sm font-semibold">
            Transactions{total > 0 && ` (${total.toLocaleString()})`}
          </CardTitle>
          <Dialog open={addTxnOpen} onOpenChange={setAddTxnOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                <Plus />
                Add
              </Button>
            </DialogTrigger>
            <AddTransactionDialog
              accountId={id}
              categories={categories}
              onSuccess={() => {
                setAddTxnOpen(false)
                refreshAll()
              }}
            />
          </Dialog>
        </CardHeader>
        <CardContent className="pt-0">
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions in this account yet.
            </p>
          ) : (
            <>
              {transactions.map((t, i) => (
                <div key={t.id}>
                  {i > 0 && <Separator />}
                  <TransactionRow transaction={t} />
                </div>
              ))}
              {transactions.length < total && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={async () => {
                      setLoadingMore(true)
                      await fetchTransactions(transactions.length)
                      setLoadingMore(false)
                    }}
                  >
                    {loadingMore && <Loader2 className="size-4 animate-spin" />}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit account (manual) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        {editOpen && (
          <EditAccountDialog
            account={account}
            onSuccess={() => {
              setEditOpen(false)
              fetchDetail()
            }}
          />
        )}
      </Dialog>

      {/* Balance history editor (last 10 days, Monarch-style) */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        {historyOpen && (
          <BalanceHistoryDialog
            accountId={id}
            currency={account.currency}
            onSuccess={() => {
              setHistoryOpen(false)
              fetchDetail()
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

function BalanceHistoryDialog({
  accountId,
  currency,
  onSuccess,
}: {
  accountId: string
  currency: string
  onSuccess: () => void
}) {
  const [entries, setEntries] = useState<{ date: string; value: string; recorded: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/accounts/${accountId}/balances?days=10`)
      .then((r) => r.json())
      .then((data) =>
        setEntries(
          (data.entries ?? []).map((e: { date: string; balance: number; recorded: boolean }) => ({
            date: e.date,
            value: String(e.balance),
            recorded: e.recorded,
          }))
        )
      )
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [accountId])

  const save = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = entries
        .filter((entry) => entry.value !== '' && !isNaN(parseFloat(entry.value)))
        .map((entry) => ({ date: entry.date, balance: parseFloat(entry.value) }))
      const response = await fetch(`/api/accounts/${accountId}/balances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: payload }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success('Balance history updated')
      onSuccess()
    } catch {
      toast.error('Failed to update balance history')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <form onSubmit={save}>
        <DialogHeader>
          <DialogTitle>Edit balance history</DialogTitle>
          <DialogDescription>
            Last 10 days · {currency}. Faded values are carried forward, not recorded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : (
            entries
              .slice()
              .reverse()
              .map((entry) => (
                <div key={entry.date} className="flex items-center gap-3">
                  <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                    {formatDate(entry.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Label>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={entry.value}
                      onChange={(e) =>
                        setEntries((prev) =>
                          prev.map((p) =>
                            p.date === entry.date
                              ? { ...p, value: e.target.value, recorded: true }
                              : p
                          )
                        )
                      }
                      className={cn(
                        'h-8 pl-7 text-right tabular-nums',
                        !entry.recorded && 'text-muted-foreground'
                      )}
                    />
                  </div>
                </div>
              ))
          )}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving || loading} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save history'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function EditAccountDialog({
  account,
  onSuccess,
}: {
  account: AccountWithItem
  onSuccess: () => void
}) {
  const [name, setName] = useState(account.name)
  const [balance, setBalance] = useState(String(account.balance))
  const [apy, setApy] = useState(Number(account.apy) > 0 ? String(account.apy) : '')
  const [frequency, setFrequency] = useState<string>(account.compound_frequency ?? 'monthly')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          balance: parseFloat(balance) || 0,
          apy: apy ? parseFloat(apy) : 0,
          compound_frequency: frequency,
        }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success('Account updated')
      onSuccess()
    } catch {
      toast.error('Failed to update account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Edit {account.name}</DialogTitle>
          <DialogDescription>Manual account details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-balance">Balance</Label>
              <Input
                id="edit-balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-apy">APY %</Label>
              <Input
                id="edit-apy"
                type="number"
                min="0"
                max="100"
                step="0.001"
                placeholder="0"
                value={apy}
                onChange={(e) => setApy(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Compounds</Label>
            <div className="flex gap-2">
              {['daily', 'weekly', 'monthly', 'yearly'].map((f) => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={frequency === f ? 'default' : 'outline'}
                  onClick={() => setFrequency(f)}
                  className="flex-1 capitalize"
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function AddTransactionDialog({
  accountId,
  categories,
  onSuccess,
}: {
  accountId: string
  categories: Category[]
  onSuccess: () => void
}) {
  const [direction, setDirection] = useState('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = Math.abs(parseFloat(amount))
    if (!value || !description) return
    setSaving(true)
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          description,
          // Plaid convention: positive = money out
          amount: direction === 'expense' ? value : -value,
          date,
          category_id: categoryId || null,
        }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success('Transaction added')
      setDescription('')
      setAmount('')
      onSuccess()
    } catch {
      toast.error('Failed to add transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>Record a transaction manually for this account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Tabs value={direction} onValueChange={setDirection}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">
                Expense
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                Income
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="acct-txn-desc">Vendor</Label>
            <Input
              id="acct-txn-desc"
              required
              placeholder="e.g. Farmers market"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acct-txn-amount">Amount</Label>
              <Input
                id="acct-txn-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="25.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-txn-date">Date</Label>
              <DatePicker id="acct-txn-date" value={date} onChange={setDate} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional" />
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
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving || !description || !amount} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Add transaction'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
