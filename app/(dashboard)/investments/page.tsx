'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Lightbulb, TrendingUp } from 'lucide-react'
import type { Holding } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { tipOfTheDay } from '@/lib/financial-tips'
import { cn } from '@/lib/utils'
import BalanceChart, { type BalancePoint } from '@/components/charts/BalanceChart'
import CompareChart, { type IndexSeries } from '@/components/charts/CompareChart'
import Carousel from '@/components/Carousel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const RANGES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

interface HoldingRow extends Holding {
  accounts?: {
    name: string
    mask: string | null
    plaid_items?: { institution_name: string | null } | null
  } | null
}

interface Mover {
  ticker: string
  price: number
  dayChangePct: number
}

interface NewsItem {
  title: string
  link: string
  source: string
  published: string | null
}

const NEWS_SOURCE_COLORS: Record<string, string> = {
  'Yahoo Finance': '#6001D2',
  CNBC: '#005594',
}

function timeAgo(dateStr: string | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function InvestmentsPage() {
  const [holdings, setHoldings] = useState<HoldingRow[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [totalCostBasis, setTotalCostBasis] = useState(0)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<BalancePoint[]>([])
  const [range, setRange] = useState('6m')
  const [chartLoading, setChartLoading] = useState(false)
  const [chartView, setChartView] = useState<'value' | 'compare'>('value')

  const [indices, setIndices] = useState<IndexSeries[]>([])
  const [movers, setMovers] = useState<Mover[]>([])
  const [news, setNews] = useState<NewsItem[]>([])

  useEffect(() => {
    fetch('/api/holdings')
      .then((r) => r.json())
      .then((d) => {
        setHoldings(d.holdings ?? [])
        setTotalValue(d.totalValue ?? 0)
        setTotalCostBasis(d.totalCostBasis ?? 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const tickers = useMemo(
    () =>
      [...new Set(holdings.map((h) => h.ticker).filter((t): t is string => !!t))].slice(0, 15),
    [holdings]
  )

  const fetchHistory = useCallback(async () => {
    setChartLoading(true)
    try {
      const response = await fetch(`/api/networth?range=${range}&types=investment`)
      const data = await response.json()
      setHistory(
        (data.history ?? []).map((h: { date: string; assets: number }) => ({
          date: h.date,
          balance: h.assets,
        }))
      )
    } catch (error) {
      console.error('Error fetching investment history:', error)
    } finally {
      setChartLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Market context: indices for this range, movers for held tickers, news
  useEffect(() => {
    if (loading) return
    const params = new URLSearchParams({ range })
    if (tickers.length > 0) params.set('tickers', tickers.join(','))
    fetch(`/api/market?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setIndices(d.indices ?? [])
        setMovers(d.movers ?? [])
        setNews(d.news ?? [])
      })
      .catch(console.error)
  }, [loading, range, tickers])

  const holdingByTicker = useMemo(
    () => new Map(holdings.filter((h) => h.ticker).map((h) => [h.ticker as string, h])),
    [holdings]
  )

  const gain = totalValue - totalCostBasis
  const gainPct = totalCostBasis > 0 ? (gain / totalCostBasis) * 100 : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Investments</h1>
        <p className="text-sm text-muted-foreground">
          Holdings across your connected investment accounts
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {holdings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <TrendingUp className="size-6 text-primary" />
                </span>
                <div>
                  <p className="font-medium">No holdings yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Connect a brokerage or retirement account and sync — positions
                    appear here automatically when the institution supports it.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <Card>
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">Portfolio value</p>
                    <p className="mt-1 text-2xl font-semibold">{formatCurrency(totalValue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">Cost basis</p>
                    <p className="mt-1 text-2xl font-semibold">{formatCurrency(totalCostBasis)}</p>
                  </CardContent>
                </Card>
                <Card className="col-span-2 lg:col-span-1">
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">Total gain</p>
                    <p
                      className={cn(
                        'mt-1 text-2xl font-semibold',
                        gain >= 0 ? 'text-positive' : 'text-negative'
                      )}
                    >
                      {gain >= 0 ? '+' : ''}
                      {formatCurrency(gain)}
                      {gainPct != null && (
                        <span className="ml-1 text-sm font-medium">
                          ({gainPct >= 0 ? '+' : ''}
                          {gainPct.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex-row flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-semibold">
                    {chartView === 'value' ? 'Value over time' : 'Performance vs. the market'}
                  </CardTitle>
                  <div className="ml-auto flex items-center gap-2">
                    <Tabs value={chartView} onValueChange={(v) => setChartView(v as 'value' | 'compare')}>
                      <TabsList className="h-8">
                        <TabsTrigger value="value" className="px-2.5 text-xs">
                          Value
                        </TabsTrigger>
                        <TabsTrigger value="compare" className="px-2.5 text-xs">
                          vs. Market
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Tabs value={range} onValueChange={setRange}>
                      <TabsList className="h-8">
                        {RANGES.map((r) => (
                          <TabsTrigger key={r.value} value={r.value} className="px-2.5 text-xs">
                            {r.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className={cn('transition-opacity', chartLoading && 'opacity-60')}>
                  {history.length > 1 ? (
                    chartView === 'value' ? (
                      <BalanceChart data={history} />
                    ) : indices.length > 0 ? (
                      <CompareChart portfolio={history} indices={indices} />
                    ) : (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        Market data is unavailable right now — check back shortly.
                      </p>
                    )
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Value history builds as your investment accounts sync each day.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Left: movers (natural height) + tip filling the leftover space
              below it, so its bottom lines up with the news column's bottom.
              Right: news, narrow and its own scrollable height — keeps
              plain-text headlines from stretching across the full width. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col items-start gap-4 lg:col-span-2">
              {movers.length > 0 && (
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Portfolio movers today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Carousel itemCount={movers.length}>
                      {movers.map((m) => {
                        const holding = holdingByTicker.get(m.ticker)
                        return (
                          <div
                            key={m.ticker}
                            className="w-44 shrink-0 rounded-xl border border-border p-3"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold">{m.ticker}</p>
                              <p
                                className={cn(
                                  'text-sm font-semibold tabular-nums',
                                  m.dayChangePct >= 0 ? 'text-positive' : 'text-negative'
                                )}
                              >
                                {m.dayChangePct >= 0 ? '+' : ''}
                                {m.dayChangePct.toFixed(2)}%
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {holding?.name ?? m.ticker}
                            </p>
                            <p className="mt-1.5 text-sm font-medium tabular-nums">
                              {formatCurrency(m.price)}
                              <span className="text-xs text-muted-foreground"> /share</span>
                            </p>
                          </div>
                        )
                      })}
                    </Carousel>
                  </CardContent>
                </Card>
              )}

              {/* Tip of the day — compact, same width as the movers card;
                  mt-auto pushes it to the bottom of the column (leaving a
                  gap above) so it lines up with the news card's bottom
                  instead of stretching to fill the space */}
              <Card className="mt-auto w-full">
                <CardContent className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Lightbulb className="size-4 text-primary" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Tip of the day
                    </p>
                    <p className="mt-0.5 text-sm">{tipOfTheDay()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {news.length > 0 && (
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Market news</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[330px] space-y-2 overflow-y-auto pt-0">
                  {news.slice(0, 12).map((n) => {
                    const sourceColor = NEWS_SOURCE_COLORS[n.source] ?? 'var(--chart-1)'
                    const ago = timeAgo(n.published)
                    return (
                      <a
                        key={n.link}
                        href={n.link}
                        target="_blank"
                        rel="noreferrer"
                        className="group/news flex items-start gap-2.5 rounded-xl border border-border p-2.5 transition-colors hover:border-transparent hover:bg-accent"
                      >
                        <span
                          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: sourceColor }}
                        >
                          {n.source.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs leading-snug font-medium">{n.title}</p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            {n.source}
                            {ago && <>· {ago}</>}
                          </p>
                        </div>
                        <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/news:opacity-100" />
                      </a>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          {holdings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Holdings</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {holdings.map((h, i) => {
                  const holdingGain =
                    h.cost_basis != null ? Number(h.value) - Number(h.cost_basis) : null
                  return (
                    <div key={h.id}>
                      {i > 0 && <Separator />}
                      <div className="flex items-center gap-3 py-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold">
                          {(h.ticker ?? h.name ?? '?').slice(0, 4).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{h.name ?? h.ticker}</p>
                          <p className="text-xs text-muted-foreground">
                            {Number(h.quantity).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}{' '}
                            shares
                            {h.price != null && <> · {formatCurrency(Number(h.price))}</>}
                            {h.accounts?.name && <> · {h.accounts.name}</>}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(Number(h.value))}
                          </p>
                          {holdingGain != null && (
                            <p
                              className={cn(
                                'text-xs font-medium tabular-nums',
                                holdingGain >= 0 ? 'text-positive' : 'text-negative'
                              )}
                            >
                              {holdingGain >= 0 ? '+' : ''}
                              {formatCurrency(holdingGain)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
