'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CashFlowMonth } from '@/lib/types'
import { formatCurrencyCompact, formatMonth } from '@/lib/format'
import ChartTooltip from './ChartTooltip'

export default function CashFlowChart({ data }: { data: CashFlowMonth[] }) {
  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={formatMonth}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={(v: number) => formatCurrencyCompact(v)}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as CashFlowMonth
                return (
                  <ChartTooltip
                    title={formatMonth(String(label))}
                    rows={[
                      { name: 'Income', value: p.income, color: 'var(--chart-2)' },
                      { name: 'Expenses', value: p.expenses, color: 'var(--negative)' },
                    ]}
                  />
                )
              }}
            />
            <Bar
              dataKey="income"
              name="Income"
              fill="var(--chart-2)"
              maxBarSize={20}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              fill="var(--negative)"
              maxBarSize={20}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--chart-2)' }} />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--negative)' }} />
          Expenses
        </span>
      </div>
    </div>
  )
}
