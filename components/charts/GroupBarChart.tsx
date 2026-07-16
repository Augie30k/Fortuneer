'use client'

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { ReportGroup } from '@/lib/types'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format'

export default function GroupBarChart({
  groups,
  onSelect,
}: {
  groups: ReportGroup[]
  onSelect?: (group: ReportGroup) => void
}) {
  const top = groups.slice(0, 10)

  return (
    <div style={{ height: Math.max(180, top.length * 38) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={top}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
          barCategoryGap={12}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--foreground)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const g = payload[0].payload as ReportGroup
              return (
                <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                  <p className="font-medium">{g.name}</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">
                    {formatCurrency(g.amount)} · {g.count} {g.count === 1 ? 'txn' : 'txns'}
                  </p>
                  {onSelect && (
                    <p className="mt-1 text-[10px] text-muted-foreground">Click to view transactions</p>
                  )}
                </div>
              )
            }}
          />
          <Bar
            dataKey="amount"
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            onClick={(entry) => onSelect?.(entry as unknown as ReportGroup)}
            cursor={onSelect ? 'pointer' : 'default'}
          >
            {top.map((g) => (
              <Cell key={g.key} fill={g.color ?? 'var(--chart-1)'} />
            ))}
            <LabelList
              dataKey="amount"
              position="right"
              formatter={(v: unknown) => formatCurrencyCompact(Number(v))}
              style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
