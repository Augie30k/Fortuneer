'use client'

import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts'
import type { ReportGroup } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format'

const FALLBACK_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-hub)',
]
const OTHER_COLOR = 'var(--muted-foreground)'
const TOP_N = 8

interface PieGroup extends ReportGroup {
  fill: string
}

interface SliceShapeProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  startAngle: number
  endAngle: number
  cornerRadius?: number
  fill: string
  index: number
}

export default function GroupPieChart({
  groups,
  onSelect,
}: {
  groups: ReportGroup[]
  onSelect?: (group: ReportGroup) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const top = groups.slice(0, TOP_N)
  const rest = groups.slice(TOP_N)
  const otherAmount = rest.reduce((s, g) => s + g.amount, 0)
  const otherCount = rest.reduce((s, g) => s + g.count, 0)

  const data: PieGroup[] = top.map((g, i) => ({
    ...g,
    fill: g.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }))
  if (otherAmount > 0) {
    data.push({
      key: 'other',
      name: 'Other',
      icon: null,
      color: null,
      amount: otherAmount,
      count: otherCount,
      fill: OTHER_COLOR,
    })
  }

  const total = data.reduce((s, g) => s + g.amount, 0)

  const selectByIndex = (i: number) => {
    const g = data[i]
    if (g.key !== 'other') onSelect?.(g)
  }

  // Grows the hovered slice and nudges it outward along its own angle — the
  // "enlarge and move" pull-out effect. Driven by the same hoveredIndex the
  // legend uses, so hovering either the slice or its legend entry lights up both.
  function renderSlice(props: unknown) {
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, cornerRadius, fill, index } =
      props as SliceShapeProps
    const isActive = hoveredIndex === index
    const RADIAN = Math.PI / 180
    const sin = Math.sin(-RADIAN * midAngle)
    const cos = Math.cos(-RADIAN * midAngle)
    const offset = isActive ? 14 : 0
    return (
      <Sector
        cx={cx + offset * cos}
        cy={cy + offset * sin}
        innerRadius={innerRadius}
        outerRadius={isActive ? outerRadius + 14 : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        cornerRadius={cornerRadius}
        fill={fill}
        style={{
          filter: isActive ? 'drop-shadow(0 6px 14px rgb(0 0 0 / 0.25))' : undefined,
          transition: 'all 150ms ease-out',
        }}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-8">
      <div
        className="relative h-[34rem] w-full min-w-0 flex-1"
        style={{ cursor: onSelect ? 'pointer' : 'default' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={110}
              outerRadius={178}
              paddingAngle={2}
              cornerRadius={4}
              isAnimationActive={false}
              shape={renderSlice}
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(_, index) => selectByIndex(index)}
            >
              {data.map((g) => (
                <Cell key={g.key} fill={g.fill} stroke="var(--card)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const g = payload[0].payload as PieGroup
                const pct = total > 0 ? (g.amount / total) * 100 : 0
                return (
                  <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                    <p className="font-medium">{g.name}</p>
                    <p className="mt-0.5 tabular-nums text-muted-foreground">
                      {formatCurrency(g.amount)} · {pct.toFixed(1)}%
                    </p>
                    {onSelect && g.key !== 'other' && (
                      <p className="mt-1 text-[10px] text-muted-foreground">Click to view transactions</p>
                    )}
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold tabular-nums">{formatCurrencyCompact(total)}</p>
          <p className="text-base text-muted-foreground">
            {data.length} {data.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
      </div>

      {/* Legend — vertical, beside the chart; hovering an entry highlights
          its slice, and vice versa */}
      <div className="flex w-full flex-col gap-1 lg:w-64 lg:shrink-0">
        {data.map((g, i) => {
          const pct = total > 0 ? (g.amount / total) * 100 : 0
          const active = hoveredIndex === i
          return (
            <button
              key={g.key}
              type="button"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => selectByIndex(i)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.fill }} />
              <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
              <span className="shrink-0 tabular-nums">{formatCurrencyCompact(g.amount)}</span>
              <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground/80">
                {pct.toFixed(0)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
