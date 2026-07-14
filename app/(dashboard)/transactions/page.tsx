'use client'

import type { AccountWithItem, Category, TransactionWithRefs } from '@/lib/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'
import { formatDate } from '@/lib/format'
import TransactionRow from '@/components/TransactionRow'
import CategoryIcon from '@/components/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const PAGE_SIZE = 50
const ALL = 'all'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithRefs[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState(ALL)
  const [accountId, setAccountId] = useState(ALL)

  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<AccountWithItem[]>([])
  const [selected, setSelected] = useState<TransactionWithRefs | null>(null)

  const requestId = useRef(0)

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
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (categoryId !== ALL) params.set('categoryId', categoryId)
      if (accountId !== ALL) params.set('accountId', accountId)
      return params
    },
    [debouncedSearch, categoryId, accountId]
  )

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    fetch(`/api/transactions?${buildQuery(0)}`)
      .then((r) => r.json())
      .then((data) => {
        if (id !== requestId.current) return
        setTransactions(data.transactions ?? [])
        setTotal(data.total ?? 0)
      })
      .catch(console.error)
      .finally(() => {
        if (id === requestId.current) setLoading(false)
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

  const groups = useMemo(() => {
    const map = new Map<string, TransactionWithRefs[]>()
    for (const t of transactions) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return [...map.entries()]
  }, [transactions])

  const handleUpdated = (updated: TransactionWithRefs) => {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelected(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `${total.toLocaleString()} transactions` : 'Your full history'}
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search merchants and descriptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-9 w-44">
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
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-9 w-44">
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
              {debouncedSearch || categoryId !== ALL || accountId !== ALL
                ? 'No transactions match your filters.'
                : 'No transactions yet — connect a bank on the Accounts page.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, rows]) => (
            <Card key={date}>
              <CardContent>
                <p className="pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                {rows.map((t, i) => (
                  <div key={t.id}>
                    {i > 0 && <Separator />}
                    <TransactionRow transaction={t} onClick={() => setSelected(t)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

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

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <TransactionDetailDialog
            transaction={selected}
            categories={categories}
            onUpdated={handleUpdated}
          />
        )}
      </Dialog>
    </div>
  )
}

function TransactionDetailDialog({
  transaction,
  categories,
  onUpdated,
}: {
  transaction: TransactionWithRefs
  categories: Category[]
  onUpdated: (t: TransactionWithRefs) => void
}) {
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [notes, setNotes] = useState(transaction.notes ?? '')
  const [saving, setSaving] = useState(false)

  const dirty =
    categoryId !== (transaction.category_id ?? '') || notes !== (transaction.notes ?? '')

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId || null, notes: notes || null }),
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
        <DialogTitle className="truncate pr-8">
          {transaction.merchant_name ?? transaction.description}
        </DialogTitle>
        <DialogDescription>
          {formatDate(transaction.date)} · {transaction.accounts?.name}
          {transaction.pending && ' · Pending'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
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
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            placeholder="Add a note…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button onClick={save} disabled={!dirty || saving} className="w-full">
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save changes'}
        </Button>
      </div>
    </DialogContent>
  )
}
