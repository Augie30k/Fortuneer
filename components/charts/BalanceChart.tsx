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
import { formatCurrencyCompact, formatCurrency, formatDate } from '@/lib/format'

export interface BalancePoint {
  date: string
  balance: number
}

export default function BalanceChart({ data }: { data: BalancePoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
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
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                  <p className="font-medium text-muted-foreground">
                    {formatDate(String(label))}
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(Number(payload[0].value))}
                  </p>
                </div>
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
            fill="url(#balanceFill)"
            activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
