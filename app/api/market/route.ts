import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * GET /api/market?range=6m&tickers=AAPL,MSFT — market context for the
 * investments page: index history (S&P 500 / Nasdaq / Dow) for comparison,
 * per-ticker daily movers, and headline market news. External data comes
 * from Yahoo Finance's public chart API + news RSS, cached in-memory
 * (indices/movers hourly, news daily) so we hit the sources sparingly.
 */

const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^DJI', name: 'Dow Jones' },
] as const

const RANGE_MAP: Record<string, string> = {
  '1m': '1mo',
  '3m': '3mo',
  '6m': '6mo',
  '1y': '1y',
  all: '5y',
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }

interface SeriesPoint {
  date: string
  close: number
}

const cache = new Map<string, { at: number; data: unknown }>()

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T
  const data = await fn()
  cache.set(key, { at: Date.now(), data })
  return data
}

async function fetchChart(symbol: string, range: string): Promise<SeriesPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) return []
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const timestamps: number[] = result?.timestamp ?? []
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
  const points: SeriesPoint[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (close == null) continue
    points.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close })
  }
  return points
}

async function fetchMover(ticker: string) {
  const points = await fetchChart(ticker, '5d')
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  return {
    ticker,
    price: last.close,
    dayChangePct: prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0,
  }
}

interface NewsItem {
  title: string
  link: string
  source: string
  published: string | null
}

/** Minimal RSS <item> extraction — titles/links/dates only, no external parser */
function parseRss(xml: string, source: string, limit: number): NewsItem[] {
  const items: NewsItem[] = []
  const itemBlocks = xml.split(/<item[\s>]/).slice(1)
  for (const block of itemBlocks.slice(0, limit)) {
    const pick = (tag: string) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block)
      if (!m) return null
      return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
    }
    const title = pick('title')
    const link = pick('link')
    if (!title || !link || !/^https?:\/\//.test(link)) continue
    items.push({ title, link, source, published: pick('pubDate') })
  }
  return items
}

async function fetchNews(): Promise<NewsItem[]> {
  const feeds = [
    { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance' },
    {
      url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
      source: 'CNBC',
    },
  ]
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const res = await fetch(f.url, { headers: UA })
      if (!res.ok) return []
      return parseRss(await res.text(), f.source, 8)
    })
  )
  const merged = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  // Interleave sources so one feed doesn't dominate the carousel
  const bySource = new Map<string, NewsItem[]>()
  for (const item of merged) {
    if (!bySource.has(item.source)) bySource.set(item.source, [])
    bySource.get(item.source)!.push(item)
  }
  const lists = [...bySource.values()]
  const interleaved: NewsItem[] = []
  for (let i = 0; interleaved.length < Math.min(12, merged.length); i++) {
    for (const list of lists) {
      if (list[i]) interleaved.push(list[i])
    }
    if (i > 20) break
  }
  return interleaved.slice(0, 12)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const range = RANGE_MAP[searchParams.get('range') ?? '6m'] ?? '6mo'
    const tickers = (searchParams.get('tickers') ?? '')
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z.\-]{1,10}$/.test(t))
      .slice(0, 15)

    const [indices, movers, news] = await Promise.all([
      cached(`indices:${range}`, 60 * 60 * 1000, async () => {
        const results = await Promise.allSettled(
          INDICES.map(async (idx) => {
            const points = await fetchChart(idx.symbol, range)
            const changePct =
              points.length > 1 && points[0].close > 0
                ? ((points[points.length - 1].close - points[0].close) / points[0].close) * 100
                : null
            return { symbol: idx.symbol as string, name: idx.name as string, points, changePct }
          })
        )
        return results
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value)
          .filter((i) => i.points.length > 0)
      }),
      tickers.length > 0
        ? cached(`movers:${tickers.join(',')}`, 60 * 60 * 1000, async () => {
            const results = await Promise.allSettled(tickers.map(fetchMover))
            return results
              .filter(
                (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchMover>>>> =>
                  r.status === 'fulfilled' && r.value !== null
              )
              .map((r) => r.value)
              .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
          })
        : Promise.resolve([]),
      cached('news', 24 * 60 * 60 * 1000, fetchNews),
    ])

    return NextResponse.json({ indices, movers, news })
  } catch (error) {
    console.error('Error fetching market data:', error)
    // Market context is decorative — never break the page over it
    return NextResponse.json({ indices: [], movers: [], news: [] })
  }
}
