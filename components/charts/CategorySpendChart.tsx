'use client'

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency, formatCurrencyCompact, formatMonth } from '@/lib/format'

export interface CategoryMonthPoint {
  month: string // YYYY-MM
  spent: number
  count: number
  /** Budget effective that month; null = nothing budgeted */
  budget: number | null
}

/** Monthly bars in the category's own color; months that blew their budget
 *  turn red (the tooltip names the state — never color alone). The dashed
 *  step line traces the effective budget across the window. */
export default function CategorySpendChart({
  data,
  color,
  income = false,
  selectedMonth,
  onSelectMonth,
}: {
  data: CategoryMonthPoint[]
  color: string | null
  /** Income categories track money received — more is good, so no red */
  income?: boolean
  selectedMonth?: string | null
  onSelectMonth?: (month: string) => void
}) {
  const barColor = color ?? 'var(--chart-1)'
  const hasBudget = data.some((d) => d.budget != null)
  const hasOver = !income && data.some((d) => d.budget != null && d.spent > d.budget)
  const spendLabel = income ? 'Received' : 'Spent'

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={formatMonth}
              interval="preserveStartEnd"
              minTickGap={16}
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
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as CategoryMonthPoint
                const over = !income && p.budget != null && p.spent > p.budget
                return (
                  <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                    <p className="font-medium">
                      {formatMonth(p.month)} {p.month.slice(0, 4)}
                    </p>
                    <p className="mt-0.5 tabular-nums text-muted-foreground">
                      {formatCurrency(p.spent)} {spendLabel.toLowerCase()}
                      {p.budget != null && <> of {formatCurrency(p.budget)} budgeted</>}
                      {' · '}
                      {p.count} {p.count === 1 ? 'txn' : 'txns'}
                    </p>
                    {over && p.budget != null && (
                      <p className="mt-0.5 font-medium text-negative">
                        {formatCurrency(p.spent - p.budget)} over budget
                      </p>
                    )}
                    {onSelectMonth && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Click to {selectedMonth === p.month ? 'clear the filter' : 'filter transactions'}
                      </p>
                    )}
                  </div>
                )
              }}
            />
            {hasBudget && (
              <Line
                dataKey="budget"
                type="stepAfter"
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            <Bar
              dataKey="spent"
              maxBarSize={28}
              radius={[4, 4, 0, 0]}
              cursor={onSelectMonth ? 'pointer' : 'default'}
              onClick={(entry) => {
                const p = entry as unknown as CategoryMonthPoint
                if (p?.month) onSelectMonth?.(p.month)
              }}
            >
              {data.map((d) => {
                const over = !income && d.budget != null && d.spent > d.budget
                return (
                  <Cell
                    key={d.month}
                    fill={over ? 'var(--destructive)' : barColor}
                    fillOpacity={selectedMonth && selectedMonth !== d.month ? 0.35 : 1}
                  />
                )
              })}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: barColor }} />
          {spendLabel}
        </span>
        {hasBudget && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: 'var(--muted-foreground)' }}
            />
            Budget
          </span>
        )}
        {hasOver && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--destructive)' }} />
            Over budget
          </span>
        )}
      </div>
    </div>
  )
}
