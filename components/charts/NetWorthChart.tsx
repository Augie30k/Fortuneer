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
import type { NetWorthPoint } from '@/lib/types'
import { formatCurrencyCompact, formatDate } from '@/lib/format'
import ChartTooltip from './ChartTooltip'

export default function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={(d: string) => formatDate(d, { month: 'short', day: 'numeric' })}
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
              const p = payload[0].payload as NetWorthPoint
              return (
                <ChartTooltip
                  title={formatDate(String(label))}
                  rows={[
                    { name: 'Net worth', value: p.netWorth, color: 'var(--chart-1)' },
                    { name: 'Assets', value: p.assets },
                    { name: 'Liabilities', value: p.liabilities },
                  ]}
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="var(--chart-1)"
            fillOpacity={0.1}
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
