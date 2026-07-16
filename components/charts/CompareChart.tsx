'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BalancePoint } from '@/components/charts/BalanceChart'

export interface IndexSeries {
  symbol: string
  name: string
  points: { date: string; close: number }[]
  changePct: number | null
}

const INDEX_COLORS: Record<string, string> = {
  '^GSPC': 'var(--chart-2)',
  '^IXIC': 'var(--chart-4)',
  '^DJI': 'var(--chart-5)',
}

/** Portfolio vs. major indices, all normalized to % change from the start of
 *  the visible window so different magnitudes are comparable. */
export default function CompareChart({
  portfolio,
  indices,
}: {
  portfolio: BalancePoint[]
  indices: IndexSeries[]
}) {
  // Index closes keyed by date, with forward-fill lookup for non-trading days
  const lookups = indices.map((idx) => {
    const map = new Map(idx.points.map((p) => [p.date, p.close]))
    const sortedDates = idx.points.map((p) => p.date)
    return { idx, map, sortedDates }
  })

  const firstPortfolio = portfolio.find((p) => p.balance > 0)?.balance ?? null
  const baselines = new Map<string, number>()

  const data = portfolio.map((p) => {
    const row: Record<string, string | number | null> = {
      date: p.date,
      Portfolio:
        firstPortfolio && firstPortfolio > 0
          ? ((p.balance - firstPortfolio) / firstPortfolio) * 100
          : null,
    }
    for (const { idx, map, sortedDates } of lookups) {
      // Latest close at or before this date
      let close = map.get(p.date)
      if (close == null) {
        for (let i = sortedDates.length - 1; i >= 0; i--) {
          if (sortedDates[i] <= p.date) {
            close = map.get(sortedDates[i])
            break
          }
        }
      }
      if (close == null) {
        row[idx.name] = null
        continue
      }
      if (!baselines.has(idx.symbol)) baselines.set(idx.symbol, close)
      const base = baselines.get(idx.symbol)!
      row[idx.name] = base > 0 ? ((close - base) / base) * 100 : null
    }
    return row
  })

  const portfolioChange =
    typeof data[data.length - 1]?.Portfolio === 'number'
      ? (data[data.length - 1].Portfolio as number)
      : null

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 pb-3 text-xs">
        <LegendChip name="Portfolio" color="var(--chart-1)" changePct={portfolioChange} />
        {indices.map((idx) => (
          <LegendChip
            key={idx.symbol}
            name={idx.name}
            color={INDEX_COLORS[idx.symbol] ?? 'var(--muted-foreground)'}
            changePct={idx.changePct}
          />
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatDate(d, { month: 'short', day: 'numeric' })}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
            />
            <YAxis
              tickFormatter={(v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                    <p className="font-medium">{formatDate(String(label))}</p>
                    {payload.map((entry) => (
                      <p key={String(entry.name)} className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: String(entry.color) }}
                        />
                        {entry.name}:{' '}
                        {typeof entry.value === 'number'
                          ? `${entry.value >= 0 ? '+' : ''}${entry.value.toFixed(1)}%`
                          : '—'}
                      </p>
                    ))}
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="Portfolio"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
            {indices.map((idx) => (
              <Line
                key={idx.symbol}
                type="monotone"
                dataKey={idx.name}
                stroke={INDEX_COLORS[idx.symbol] ?? 'var(--muted-foreground)'}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LegendChip({
  name,
  color,
  changePct,
}: {
  name: string
  color: string
  changePct: number | null
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium">{name}</span>
      {changePct != null && (
        <span
          className={cn(
            'tabular-nums',
            changePct >= 0 ? 'text-positive' : 'text-negative'
          )}
        >
          {changePct >= 0 ? '+' : ''}
          {changePct.toFixed(1)}%
        </span>
      )}
    </span>
  )
}
