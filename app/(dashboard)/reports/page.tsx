'use client'

import type { AccountWithItem, ReportGroup, ReportsData, TransactionWithRefs } from '@/lib/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import GroupPieChart from '@/components/charts/GroupPieChart'
import SankeyChart, { type SankeySelection } from '@/components/charts/SankeyChart'
import TransactionRow from '@/components/TransactionRow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const ALL = 'all'

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function presetRange(preset: string): { start: string; end: string } {
  const now = new Date()
  const end = iso(now)
  switch (preset) {
    case 'this-month':
      return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start: iso(start), end: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
    }
    case '3-months':
      return { start: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), end }
    case 'ytd':
      return { start: iso(new Date(now.getFullYear(), 0, 1)), end }
    case '12-months':
      return { start: iso(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())), end }
    default:
      return { start: '2000-01-01', end }
  }
}

const PRESETS = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '3-months', label: 'Last 3 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12-months', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

const GROUP_BYS = [
  { value: 'category', label: 'By category' },
  { value: 'merchant', label: 'By vendor' },
  { value: 'account', label: 'By account' },
]

interface ActiveFilter {
  label: string
  categoryId?: string
  merchantQuery?: string
  accountId?: string
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [accounts, setAccounts] = useState<AccountWithItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)

  const [preset, setPreset] = useState('this-month')
  const [groupBy, setGroupBy] = useState('category')
  const [accountId, setAccountId] = useState(ALL)
  const [view, setView] = useState('cashflow')

  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null)
  const [filterTxns, setFilterTxns] = useState<TransactionWithRefs[]>([])
  const [filterTotal, setFilterTotal] = useState(0)
  const [filterLoading, setFilterLoading] = useState(false)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(console.error)
  }, [])

  const fetchReport = useCallback(async () => {
    const { start, end } = presetRange(preset)
    const params = new URLSearchParams({ start, end, groupBy })
    if (accountId !== ALL) params.set('accountId', accountId)
    setRefetching(true)
    try {
      const response = await fetch(`/api/reports?${params}`)
      if (!response.ok) throw new Error('failed')
      setData(await response.json())
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
      setRefetching(false)
    }
  }, [preset, groupBy, accountId])

  useEffect(() => {
    fetchReport()
    setActiveFilter(null)
  }, [fetchReport])

  const openFilter = async (filter: ActiveFilter) => {
    if (!data) return
    setActiveFilter(filter)
    setFilterLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: data.start,
        endDate: data.end,
        limit: '25',
      })
      if (filter.categoryId) params.set('categoryId', filter.categoryId)
      if (filter.accountId) params.set('accountId', filter.accountId)
      if (filter.merchantQuery) params.set('q', filter.merchantQuery)
      const response = await fetch(`/api/transactions?${params}`)
      const json = await response.json()
      setFilterTxns(json.transactions ?? [])
      setFilterTotal(json.total ?? 0)
    } catch (error) {
      console.error('Error fetching filtered transactions:', error)
    } finally {
      setFilterLoading(false)
    }
  }

  // Nudge the page down just enough for the transactions panel to catch the
  // eye — not a jump straight to it, which would be jarring after a click.
  useEffect(() => {
    if (!activeFilter || filterLoading) return
    const el = filterPanelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.top > window.innerHeight * 0.6) {
      window.scrollBy({ top: 220, behavior: 'smooth' })
    }
  }, [activeFilter, filterLoading])

  const handleSankeySelect = (selection: SankeySelection) => {
    if (selection.categoryId) {
      openFilter({ label: selection.name, categoryId: selection.categoryId })
    } else if (selection.merchantName) {
      openFilter({ label: selection.name, merchantQuery: selection.merchantName })
    }
  }

  const handleGroupSelect = (g: ReportGroup) => {
    if (groupBy === 'category') {
      if (g.key === 'uncategorized') return
      openFilter({ label: g.name, categoryId: g.key })
    } else if (groupBy === 'account') {
      openFilter({ label: g.name, accountId: g.key })
    } else {
      openFilter({ label: g.name, merchantQuery: g.name })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Where your money comes from and where it goes
        </p>
      </div>

      {/* One filter row scoping everything below */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BYS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All accounts" />
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
        <Tabs value={view} onValueChange={setView} className="ml-auto">
          <TabsList className="h-9">
            <TabsTrigger value="cashflow" className="px-3 text-xs">
              Cash flow
            </TabsTrigger>
            <TabsTrigger value="spending" className="px-3 text-xs">
              Spending
            </TabsTrigger>
            <TabsTrigger value="income" className="px-3 text-xs">
              Income
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div
          className={cn(
            'space-y-6 transition-opacity',
            refetching && 'pointer-events-none opacity-60'
          )}
        >
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">Income</p>
                <p className="mt-1 text-xl font-semibold text-positive lg:text-2xl">
                  {formatCurrency(data.income)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">Expenses</p>
                <p className="mt-1 text-xl font-semibold lg:text-2xl">
                  {formatCurrency(data.expenses)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">Net</p>
                <p
                  className={cn(
                    'mt-1 text-xl font-semibold lg:text-2xl',
                    data.net >= 0 ? 'text-positive' : 'text-negative'
                  )}
                >
                  {formatCurrency(data.net)}
                </p>
              </CardContent>
            </Card>
          </div>

          {view === 'cashflow' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Cash flow</CardTitle>
              </CardHeader>
              <CardContent>
                <SankeyChart data={data.sankey} onSelect={handleSankeySelect} />
              </CardContent>
            </Card>
          )}

          {view === 'spending' && (
            <GroupPieCard
              title={`Spending ${GROUP_BYS.find((g) => g.value === groupBy)?.label.toLowerCase()}`}
              groups={data.groups}
              emptyMessage="No spending in this period."
              onSelect={handleGroupSelect}
            />
          )}

          {view === 'income' && (
            <GroupPieCard
              title={`Income ${GROUP_BYS.find((g) => g.value === groupBy)?.label.toLowerCase()}`}
              groups={data.incomeGroups}
              emptyMessage="No income in this period."
              onSelect={handleGroupSelect}
            />
          )}

          {/* Click-to-filter transaction panel */}
          {activeFilter && (
            <Card ref={filterPanelRef}>
              <CardHeader className="flex-row items-center">
                <CardTitle className="text-sm font-semibold">
                  Transactions — {activeFilter.label}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  onClick={() => setActiveFilter(null)}
                  aria-label="Close"
                >
                  <X />
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {filterLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                  </div>
                ) : filterTxns.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No transactions found.
                  </p>
                ) : (
                  <>
                    {filterTxns.map((t, i) => (
                      <div key={t.id}>
                        {i > 0 && <Separator />}
                        <TransactionRow transaction={t} />
                      </div>
                    ))}
                    {filterTotal > filterTxns.length && (
                      <p className="pt-3 text-center text-xs text-muted-foreground">
                        Showing {filterTxns.length} of {filterTotal}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function GroupPieCard({
  title,
  groups,
  emptyMessage,
  onSelect,
}: {
  title: string
  groups: ReportGroup[]
  emptyMessage: string
  onSelect: (g: ReportGroup) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <GroupPieChart groups={groups} onSelect={onSelect} />
        )}
      </CardContent>
    </Card>
  )
}
