'use client'

import type { AccountWithItem, Category, TransactionWithRefs } from '@/lib/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Download, Loader2, Search, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import CategoryIcon from '@/components/CategoryIcon'
import CategorySpendChart, { type CategoryMonthPoint } from '@/components/charts/CategorySpendChart'
import DatePicker from '@/components/DatePicker'
import TransactionRow from '@/components/TransactionRow'
import TransactionDetailDialog from '@/components/TransactionDetailDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 50
const ALL = 'all'

const RANGES = [
  { value: '6', label: '6M' },
  { value: '12', label: '1Y' },
  { value: '24', label: '2Y' },
]

const SORTS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Largest expense' },
  { value: 'amount-asc', label: 'Largest income' },
] as const

interface Filters {
  accountId: string
  startDate: string
  endDate: string
  minAmount: string
  maxAmount: string
  sort: string
}

const DEFAULT_FILTERS: Filters = {
  accountId: ALL,
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  sort: 'date-desc',
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const router = useRouter()

  const [category, setCategory] = useState<Category | null>(null)
  const [history, setHistory] = useState<CategoryMonthPoint[]>([])
  const [range, setRange] = useState('12')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)

  const [transactions, setTransactions] = useState<TransactionWithRefs[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  // Chart click narrows the list to one month; shown as a dismissable chip
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const [accounts, setAccounts] = useState<AccountWithItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<TransactionWithRefs | null>(null)

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

  const fetchHistory = useCallback(async () => {
    setChartLoading(true)
    try {
      const response = await fetch(`/api/categories/${categoryId}/history?months=${range}`)
      if (response.status === 404) {
        toast.error('Category not found')
        router.push('/budgets')
        return
      }
      const data = await response.json()
      setCategory(data.category ?? null)
      setHistory(data.history ?? [])
    } catch (error) {
      console.error('Error fetching category history:', error)
    } finally {
      setLoading(false)
      setChartLoading(false)
    }
  }, [categoryId, range, router])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const buildQuery = useCallback(
    (offset: number) => {
      const [sort, dir] = filters.sort.split('-')
      const params = new URLSearchParams({
        categoryId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
        dir,
      })
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (filters.accountId !== ALL) params.set('accountId', filters.accountId)
      if (selectedMonth) params.set('month', selectedMonth)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.minAmount) params.set('minAmount', filters.minAmount)
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount)
      return params
    },
    [categoryId, debouncedSearch, filters, selectedMonth]
  )

  useEffect(() => {
    const id = ++requestId.current
    if (firstLoad.current) setListLoading(true)
    else setRefetching(true)
    fetch(`/api/transactions?${buildQuery(0)}`)
      .then((r) => r.json())
      .then((data) => {
        if (id !== requestId.current) return
        setTransactions(data.transactions ?? [])
        setTotal(data.total ?? 0)
      })
      .catch(console.error)
      .finally(() => {
        if (id === requestId.current) {
          setListLoading(false)
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

  const income = category?.is_income ?? false

  // ---- Summary tiles, all derived from the loaded history window ----
  const thisMonth = history[history.length - 1]
  const priorMonths = history.slice(0, -1)
  const monthlyAverage =
    priorMonths.length > 0
      ? priorMonths.reduce((s, m) => s + m.spent, 0) / priorMonths.length
      : (thisMonth?.spent ?? 0)
  const windowTotal = history.reduce((s, m) => s + m.spent, 0)
  const windowCount = history.reduce((s, m) => s + m.count, 0)

  const groupByDate = filters.sort.startsWith('date')
  const dateGroups = useMemo(() => {
    if (!groupByDate) return null
    const map = new Map<string, TransactionWithRefs[]>()
    for (const t of transactions) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return [...map.entries()]
  }, [transactions, groupByDate])

  const handleUpdated = (updated: TransactionWithRefs) => {
    if (updated.category_id !== categoryId) {
      // Recategorized away — it no longer belongs on this page
      setTransactions((prev) => prev.filter((t) => t.id !== updated.id))
      setTotal((prev) => prev - 1)
    } else {
      setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    }
    setSelected(null)
    fetchHistory()
  }

  const handleDeleted = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    setTotal((prev) => prev - 1)
    setSelected(null)
    fetchHistory()
  }

  const exportCsv = () => {
    const params = new URLSearchParams({ categoryId })
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (filters.accountId !== ALL) params.set('accountId', filters.accountId)
    // The export route filters by date range only — translate a month chip
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number)
      params.set('startDate', `${selectedMonth}-01`)
      params.set('endDate', new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10))
    } else {
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
    }
    window.open(`/api/transactions/export?${params}`, '_blank')
  }

  const activeFilterCount =
    (filters.accountId !== ALL ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0) +
    (filters.minAmount ? 1 : 0) +
    (filters.maxAmount ? 1 : 0) +
    (selectedMonth ? 1 : 0) +
    (debouncedSearch ? 1 : 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!category) return null

  const budget = thisMonth?.budget ?? null
  const spent = thisMonth?.spent ?? 0
  const ratio = budget != null && budget > 0 ? spent / budget : 0
  const over = !income && budget != null && spent > budget
  const near = !income && !over && budget != null && ratio > 0.85
  const baseColor = category.color ?? 'var(--chart-1)'
  const meterFill = income
    ? 'var(--positive)'
    : over
      ? 'var(--destructive)'
      : near
        ? '#FF9500'
        : baseColor

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to budgets">
            <Link href="/budgets">
              <ArrowLeft />
            </Link>
          </Button>
          <CategoryIcon chip icon={category.icon} color={category.color} className="size-11" />
          <div>
            <h1 className="text-3xl font-semibold">{category.name}</h1>
            <p className="text-sm text-muted-foreground">
              {category.group_name || 'Other'}
              {income && ' · Income'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download />
          Export CSV
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              {thisMonth ? monthLabel(thisMonth.month) : 'This month'}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(spent)}</p>
            {budget != null ? (
              <>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${meterFill} 14%, transparent)` }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: meterFill }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {income
                    ? spent >= budget
                      ? `Expected income met — ${formatCurrency(budget)} expected`
                      : `${formatCurrency(budget - spent)} more expected of ${formatCurrency(budget)}`
                    : over
                      ? `${formatCurrency(spent - budget)} over the ${formatCurrency(budget)} budget`
                      : `${formatCurrency(budget - spent)} left of ${formatCurrency(budget)}`}
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No budget set this month</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">Monthly average</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(monthlyAverage)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {priorMonths.length > 0
                ? `Over the previous ${priorMonths.length} ${priorMonths.length === 1 ? 'month' : 'months'}`
                : 'This month so far'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">
              Last {history.length} months
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(windowTotal)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {windowCount.toLocaleString()} {windowCount === 1 ? 'transaction' : 'transactions'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spend-over-time chart */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">
            {income ? 'Income by month' : 'Spending by month'}
          </CardTitle>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : (
            <CategorySpendChart
              data={history}
              color={category.color}
              income={income}
              selectedMonth={selectedMonth}
              onSelectMonth={(month) =>
                setSelectedMonth((prev) => (prev === month ? null : month))
              }
            />
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Click a bar to see just that month&apos;s transactions below
          </p>
        </CardContent>
      </Card>

      {/* Transactions */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Transactions
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {total.toLocaleString()}
              </span>
            )}
          </h2>
          {selectedMonth && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {monthLabel(selectedMonth)}
              <button
                type="button"
                onClick={() => setSelectedMonth(null)}
                aria-label="Clear month filter"
                className="rounded-full p-0.5 hover:bg-accent"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
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
            <Select value={filters.sort} onValueChange={(v) => setFilters({ ...filters, sort: v })}>
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
                  setSelectedMonth(null)
                }}
              >
                <X />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>

        {listLoading ? (
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
                  : `No ${category.name} transactions yet.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              'space-y-4 transition-opacity',
              refetching && 'pointer-events-none opacity-60'
            )}
          >
            {groupByDate && dateGroups ? (
              dateGroups.map(([date, rows]) => (
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
              ))
            ) : (
              <Card>
                <CardContent>
                  {transactions.map((t, i) => (
                    <div key={t.id}>
                      {i > 0 && <Separator />}
                      <TransactionRow transaction={t} onClick={() => setSelected(t)} />
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
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <TransactionDetailDialog
            transaction={selected}
            categories={categories}
            accounts={accounts}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        )}
      </Dialog>
    </div>
  )
}
