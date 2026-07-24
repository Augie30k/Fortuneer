'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PayoffPoint } from '@/lib/debt-math'
import { formatCurrencyCompact, formatMonth } from '@/lib/format'
import ChartTooltip from './ChartTooltip'

/** Remaining-balance curve for the payoff simulator — same single-series
 *  area idiom as NetWorthChart, just trending to zero. */
export default function DebtPayoffChart({ data }: { data: PayoffPoint[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="debtPayoffFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={(m: string) => formatMonth(m)}
            minTickGap={48}
          />
          <YAxis
            width={52}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as PayoffPoint
              return (
                <ChartTooltip
                  title={formatMonth(String(label))}
                  rows={[
                    { name: 'Balance left', value: p.balance, color: 'var(--chart-1)' },
                    { name: 'Interest so far', value: p.interestPaid },
                    { name: 'Paid so far', value: p.totalPaid },
                  ]}
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="url(#debtPayoffFill)"
            activeDot={{
              r: 4,
              fill: 'var(--chart-1)',
              stroke: 'var(--card)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
