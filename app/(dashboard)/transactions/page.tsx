'use client'

import type { AccountWithItem, Category, TransactionWithRefs } from '@/lib/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { formatCurrency, formatDate, formatSignedAmount } from '@/lib/format'
import TransactionRow from '@/components/TransactionRow'
import CategoryIcon from '@/components/CategoryIcon'
import DatePicker from '@/components/DatePicker'
import RuleDialog from '@/components/RuleDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 50
const ALL = 'all'

const SORTS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Largest expense' },
  { value: 'amount-asc', label: 'Largest income' },
] as const

interface Filters {
  categoryId: string
  accountId: string
  startDate: string
  endDate: string
  minAmount: string
  maxAmount: string
  sort: string
}

const DEFAULT_FILTERS: Filters = {
  categoryId: ALL,
  accountId: ALL,
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  sort: 'date-desc',
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithRefs[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<AccountWithItem[]>([])
  const [selected, setSelected] = useState<TransactionWithRefs | null>(null)

  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const requestId = useRef(0)
  const firstLoad = useRef(true)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ])
      .then(([c, a]) => {
        setCategories(c.categories ?? [])
        setAccounts(a.accounts ?? [])
      })
      .catch(console.error)
  }, [])

  const buildQuery = useCallback(
    (offset: number) => {
      const [sort, dir] = filters.sort.split('-')
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
        dir,
      })
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (filters.categoryId !== ALL) params.set('categoryId', filters.categoryId)
      if (filters.accountId !== ALL) params.set('accountId', filters.accountId)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.minAmount) params.set('minAmount', filters.minAmount)
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount)
      return params
    },
    [debouncedSearch, filters]
  )

  useEffect(() => {
    const id = ++requestId.current
    if (firstLoad.current) setLoading(true)
    else setRefetching(true)
    fetch(`/api/transactions?${buildQuery(0)}`)
      .then((r) => r.json())
      .then((data) => {
        if (id !== requestId.current) return
        setTransactions(data.transactions ?? [])
        setTotal(data.total ?? 0)
        setChecked(new Set())
      })
      .catch(console.error)
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false)
          setRefetching(false)
          firstLoad.current = false
        }
      })
  }, [buildQuery])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const response = await fetch(`/api/transactions?${buildQuery(transactions.length)}`)
      const data = await response.json()
      setTransactions((prev) => [...prev, ...(data.transactions ?? [])])
      setTotal(data.total ?? 0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingMore(false)
    }
  }

  const groupByDate = filters.sort.startsWith('date')
  const groups = useMemo(() => {
    if (!groupByDate) return null
    const map = new Map<string, TransactionWithRefs[]>()
    for (const t of transactions) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return [...map.entries()]
  }, [transactions, groupByDate])

  const handleUpdated = (updated: TransactionWithRefs) => {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelected(null)
  }

  const toggleChecked = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyBulk = async () => {
    if (!bulkCategory || checked.size === 0) return
    setBulkSaving(true)
    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...checked], category_id: bulkCategory }),
      })
      if (!response.ok) throw new Error('failed')
      const { updated } = await response.json()
      const category = categories.find((c) => c.id === bulkCategory)
      setTransactions((prev) =>
        prev.map((t) =>
          checked.has(t.id)
            ? {
                ...t,
                category_id: bulkCategory,
                categories: category
                  ? {
                      name: category.name,
                      icon: category.icon,
                      color: category.color,
                      is_income: category.is_income,
                      is_transfer: category.is_transfer,
                    }
                  : t.categories,
              }
            : t
        )
      )
      setChecked(new Set())
      setBulkCategory('')
      toast.success(`${updated} transactions recategorized`)
    } catch {
      toast.error('Bulk update failed')
    } finally {
      setBulkSaving(false)
    }
  }

  const exportCsv = () => {
    const params = buildQuery(0)
    params.delete('limit')
    params.delete('offset')
    window.open(`/api/transactions/export?${params}`, '_blank')
  }

  const activeFilterCount =
    (filters.categoryId !== ALL ? 1 : 0) +
    (filters.accountId !== ALL ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0) +
    (filters.minAmount ? 1 : 0) +
    (filters.maxAmount ? 1 : 0) +
    (debouncedSearch ? 1 : 0)

  const renderRow = (t: TransactionWithRefs) => (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked.has(t.id)}
        onCheckedChange={() => toggleChecked(t.id)}
        aria-label="Select transaction"
      />
      <div className="min-w-0 flex-1">
        <TransactionRow transaction={t} onClick={() => setSelected(t)} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total.toLocaleString()} transactions` : 'Your full history'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download />
            Export CSV
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus />
                Add
              </Button>
            </DialogTrigger>
            <AddTransactionDialog
              accounts={accounts}
              categories={categories}
              onSuccess={() => {
                setAddOpen(false)
                setFilters({ ...filters }) // retrigger fetch
              }}
            />
          </Dialog>
        </div>
      </div>

      {/* Filter rows */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors and descriptions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Select
            value={filters.categoryId}
            onValueChange={(v) => setFilters({ ...filters, categoryId: v })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.accountId}
            onValueChange={(v) => setFilters({ ...filters, accountId: v })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sort}
            onValueChange={(v) => setFilters({ ...filters, sort: v })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            value={filters.startDate}
            onChange={(v) => setFilters({ ...filters, startDate: v })}
            placeholder="From"
            clearable
            className="h-9 w-40"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <DatePicker
            value={filters.endDate}
            onChange={(v) => setFilters({ ...filters, endDate: v })}
            placeholder="To"
            clearable
            className="h-9 w-40"
          />
          <Input
            type="number"
            min="0"
            placeholder="Min $"
            value={filters.minAmount}
            onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
            className="h-9 w-24"
          />
          <Input
            type="number"
            min="0"
            placeholder="Max $"
            value={filters.maxAmount}
            onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
            className="h-9 w-24"
          />
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(DEFAULT_FILTERS)
                setSearch('')
              }}
            >
              <X />
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              {activeFilterCount > 0
                ? 'No transactions match your filters.'
                : 'No transactions yet — connect a bank on the Accounts page.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cnRefetch(refetching)}
        >
          {groupByDate && groups ? (
            groups.map(([date, rows]) => (
              <Card key={date}>
                <CardContent>
                  <p className="pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  {rows.map((t, i) => (
                    <div key={t.id}>
                      {i > 0 && <Separator />}
                      {renderRow(t)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent>
                {transactions.map((t, i) => (
                  <div key={t.id}>
                    {i > 0 && <Separator />}
                    {renderRow(t)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {transactions.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {checked.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit items-center gap-3 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-lg backdrop-blur-xl">
          <p className="text-sm font-medium">{checked.size} selected</p>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Set category…" />
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
          <Button size="sm" onClick={applyBulk} disabled={!bulkCategory || bulkSaving}>
            {bulkSaving ? <Loader2 className="size-4 animate-spin" /> : 'Apply'}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setChecked(new Set())} aria-label="Clear selection">
            <X />
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <TransactionDetailDialog
            transaction={selected}
            categories={categories}
            accounts={accounts}
            onUpdated={handleUpdated}
            onDeleted={(id) => {
              setTransactions((prev) => prev.filter((t) => t.id !== id))
              setTotal((prev) => prev - 1)
              setSelected(null)
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

/** Category select items grouped by group name, with icons */
function CategorySelectItems({ categories }: { categories: Category[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const c of categories) {
      const key = c.group_name || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()]
  }, [categories])

  return (
    <>
      {grouped.map(([group, rows]) => (
        <SelectGroup key={group}>
          <SelectLabel>{group}</SelectLabel>
          {rows.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <CategoryIcon icon={c.icon} color={c.color} />
              {c.name}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  )
}

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function AddTransactionDialog({
  accounts,
  categories,
  onSuccess,
}: {
  accounts: AccountWithItem[]
  categories: Category[]
  onSuccess: () => void
}) {
  const [direction, setDirection] = useState('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(isoDaysAgo(0))
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : '')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  const [merchants, setMerchants] = useState<{ name: string; count: number }[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)

  useEffect(() => {
    fetch('/api/transactions/merchants')
      .then((r) => r.json())
      .then((d) => setMerchants(d.merchants ?? []))
      .catch(console.error)
  }, [])

  const suggestions = description.trim()
    ? merchants
        .filter((m) => m.name.toLowerCase().includes(description.trim().toLowerCase()))
        .slice(0, 5)
    : []

  const isIncome = direction === 'income'
  const value = Math.abs(parseFloat(amount)) || 0

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!value || !accountId || !description) return
    setSaving(true)
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          description,
          // Plaid convention: positive = money out
          amount: isIncome ? -value : value,
          date,
          category_id: categoryId || null,
        }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success(`${isIncome ? 'Income' : 'Expense'} of ${formatCurrency(value)} added`)
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
          <DialogDescription>Record something that isn&apos;t in a linked account.</DialogDescription>
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

          {/* Amount is the thing you know first — front and center */}
          <div className="flex items-center justify-center gap-1 py-2">
            <span
              className={cnAmount(isIncome, 'text-2xl font-semibold')}
              aria-hidden
            >
              {isIncome ? '+$' : '$'}
            </span>
            <input
              autoFocus
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Amount"
              className={cnAmount(
                isIncome,
                'w-40 border-none bg-transparent text-4xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="txn-desc">Vendor</Label>
            <div className="relative">
              <Input
                id="txn-desc"
                required
                autoComplete="off"
                placeholder={isIncome ? 'e.g. Paycheck, Refund' : 'e.g. Farmers market'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
              />
              {suggestOpen && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                  {suggestions.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDescription(m.name)
                        setSuggestOpen(false)
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="truncate">{m.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{m.count}×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.mask ? ` ••${a.mask}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <CategorySelectItems categories={categories} />
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="txn-date">Date</Label>
            <div className="flex gap-2">
              <DatePicker id="txn-date" value={date} onChange={setDate} className="flex-1" />
              <Button
                type="button"
                variant={date === isoDaysAgo(0) ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 self-center"
                onClick={() => setDate(isoDaysAgo(0))}
              >
                Today
              </Button>
              <Button
                type="button"
                variant={date === isoDaysAgo(1) ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 self-center"
                onClick={() => setDate(isoDaysAgo(1))}
              >
                Yesterday
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="submit"
            disabled={saving || !accountId || !description || !value}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Add ${value > 0 ? formatCurrency(value) + ' ' : ''}${isIncome ? 'income' : 'expense'}`
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function cnAmount(isIncome: boolean, base: string) {
  return `${base} ${isIncome ? 'text-positive' : 'text-foreground'}`
}

function cnRefetch(refetching: boolean) {
  return refetching
    ? 'space-y-4 pointer-events-none opacity-60 transition-opacity'
    : 'space-y-4 transition-opacity'
}

function TransactionDetailDialog({
  transaction,
  categories,
  accounts,
  onUpdated,
  onDeleted,
}: {
  transaction: TransactionWithRefs
  categories: Category[]
  accounts: AccountWithItem[]
  onUpdated: (t: TransactionWithRefs) => void
  onDeleted: (id: string) => void
}) {
  const isManual = transaction.plaid_transaction_id === null

  const [description, setDescription] = useState(transaction.description)
  const [merchantName, setMerchantName] = useState(transaction.merchant_name ?? '')
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [notes, setNotes] = useState(transaction.notes ?? '')
  // Manual-only fields — banks own these on synced transactions
  const [direction, setDirection] = useState(transaction.amount >= 0 ? 'expense' : 'income')
  const [amount, setAmount] = useState(String(Math.abs(transaction.amount)))
  const [date, setDate] = useState(transaction.date)
  const [accountId, setAccountId] = useState(transaction.account_id)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      toast.success('Transaction deleted')
      onDeleted(transaction.id)
    } catch {
      toast.error('Failed to delete transaction')
      setDeleting(false)
    }
  }

  const merchant = transaction.merchant_name ?? transaction.description
  const categoryChanged = categoryId !== (transaction.category_id ?? '')

  const signedAmount = (direction === 'income' ? -1 : 1) * (Math.abs(parseFloat(amount)) || 0)
  const amountChanged = isManual && signedAmount !== transaction.amount
  const dirty =
    categoryChanged ||
    notes !== (transaction.notes ?? '') ||
    description !== transaction.description ||
    merchantName !== (transaction.merchant_name ?? '') ||
    amountChanged ||
    (isManual && (date !== transaction.date || accountId !== transaction.account_id))

  const save = async () => {
    if (!description.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId || null,
          notes: notes || null,
          description: description.trim(),
          merchant_name: merchantName,
          ...(isManual
            ? { amount: signedAmount, date, account_id: accountId }
            : {}),
        }),
      })
      if (!response.ok) throw new Error('failed')
      const updated = await response.json()
      toast.success('Transaction updated')
      onUpdated(updated)
    } catch (error) {
      console.error(error)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="truncate pr-8">{merchant}</DialogTitle>
        <DialogDescription>
          {formatDate(transaction.date)} · {transaction.accounts?.name}
          {transaction.pending && ' · Pending'}
          {!isManual && ' · Synced from your bank'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {isManual ? (
          <>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txn-edit-amount">Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="txn-edit-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7 tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="txn-edit-date">Date</Label>
                <DatePicker id="txn-edit-date" value={date} onChange={setDate} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.mask ? ` ••${a.mask}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span
              className={`text-lg font-semibold tabular-nums ${transaction.amount < 0 ? 'text-positive' : ''}`}
            >
              {formatSignedAmount(transaction.amount)}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="txn-edit-desc">Vendor</Label>
          <Input
            id="txn-edit-desc"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="txn-edit-merchant">Display name (optional, shown in lists)</Label>
          <Input
            id="txn-edit-merchant"
            placeholder="Optional display name, e.g. Starbucks"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              <CategorySelectItems categories={categories} />
            </SelectContent>
          </Select>
          {categoryChanged && categoryId && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="min-w-0 text-xs text-muted-foreground">
                Always categorize{' '}
                <span className="font-medium text-foreground">“{merchant}”</span> this way?
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setRuleDialogOpen(true)}
              >
                Preview rule
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            placeholder="Add a note…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button onClick={save} disabled={!dirty || !description.trim() || saving} className="w-full">
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save changes'}
        </Button>
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full text-destructive hover:text-destructive"
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />}
          Delete transaction
        </Button>
      </div>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <RuleDialog
          categories={categories}
          initialMatcher={merchant}
          initialMatchField={transaction.merchant_name ? 'merchant' : 'description'}
          initialCategoryId={categoryId}
          title="Create a rule?"
          description={`Preview how this rule would apply before saving it — future imports of "${merchant}" will follow it automatically.`}
          onSaved={() => setRuleDialogOpen(false)}
        />
      </Dialog>
    </DialogContent>
  )
}
