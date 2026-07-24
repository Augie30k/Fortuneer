'use client'

import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LifeEvent, ProjectionMilestone, ProjectionPoint } from '@/lib/projection-math'
import { formatCurrencyCompact } from '@/lib/format'
import ChartTooltip from './ChartTooltip'

interface TrajectoryDatum {
  month: string
  expected: number
  low: number
  high: number
  band: [number, number]
  compare?: number
}

function monthLabel(month: string, ageBase: number | null, startMonth: string) {
  if (ageBase !== null) {
    const years = Math.floor(
      (Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) -
        (Number(startMonth.slice(0, 4)) * 12 + Number(startMonth.slice(5)))) / 12
    )
    return `Age ${ageBase + years}`
  }
  return month.slice(0, 4)
}

/** The Projections render: an uncertainty fan around the expected path, with
 *  life events pinned to the line and the FI crossing marked. An optional
 *  second scenario overlays as a dashed line for comparison. */
export default function TrajectoryChart({
  points,
  events,
  milestones,
  compare,
  ageBase = null,
  height = 380,
}: {
  points: ProjectionPoint[]
  events: (LifeEvent & { color: string })[]
  milestones: ProjectionMilestone[]
  /** Overlay scenario: name + its own simulated points */
  compare?: { name: string; points: ProjectionPoint[] } | null
  /** Current age — switches the x-axis from years to ages */
  ageBase?: number | null
  height?: number
}) {
  const startMonth = points[0]?.month ?? ''

  const data: TrajectoryDatum[] = useMemo(() => {
    const compareByMonth = new Map(compare?.points.map((p) => [p.month, p.expected]) ?? [])
    return points.map((p) => ({
      ...p,
      band: [p.low, p.high] as [number, number],
      compare: compareByMonth.get(p.month),
    }))
  }, [points, compare])

  const byMonth = useMemo(() => new Map(points.map((p) => [p.month, p])), [points])
  const eventsByMonth = useMemo(() => {
    const map = new Map<string, (LifeEvent & { color: string })[]>()
    for (const e of events) {
      const key = e.start
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events])

  const fi = milestones.find((m) => m.kind === 'fi')

  // Tick per January so the axis reads as years/ages without crowding
  const ticks = useMemo(() => {
    const januaries = points.filter((p) => p.month.endsWith('-01')).map((p) => p.month)
    const step = Math.max(1, Math.ceil(januaries.length / 10))
    return januaries.filter((_, i) => i % step === 0)
  }, [points])

  if (points.length < 2) return null

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="trajectoryBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.04} />
            </linearGradient>
            {/* The expected path shifts blue → violet as it moves into the
                future — the further out, the more speculative */}
            <linearGradient id="trajectoryStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-1)" />
              <stop offset="100%" stopColor="var(--chart-hub)" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="month"
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={(m: string) => monthLabel(m, ageBase, startMonth)}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = byMonth.get(String(label))
              if (!p) return null
              const monthEvents = eventsByMonth.get(String(label)) ?? []
              const d = new Date(p.month + '-01T00:00:00')
              const title =
                d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) +
                (ageBase !== null ? ` · ${monthLabel(p.month, ageBase, startMonth)}` : '') +
                (monthEvents.length ? ` · ${monthEvents.map((e) => e.name).join(', ')}` : '')
              const compareValue = compare
                ? compare.points.find((cp) => cp.month === p.month)?.expected
                : undefined
              return (
                <ChartTooltip
                  title={title}
                  rows={[
                    { name: 'Expected', value: p.expected, color: 'var(--chart-1)' },
                    { name: 'If markets do well', value: p.high },
                    { name: 'If markets struggle', value: p.low },
                    ...(compareValue !== undefined
                      ? [{ name: compare!.name, value: compareValue, color: 'var(--chart-4)' }]
                      : []),
                  ]}
                />
              )
            }}
          />

          {/* Break-even guide when the trajectory can dip below zero */}
          {(data.some((d) => d.low < 0)) && (
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}

          <Area
            dataKey="band"
            stroke="none"
            fill="url(#trajectoryBand)"
            isAnimationActive={false}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="expected"
            stroke="url(#trajectoryStroke)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
          />
          {compare && (
            <Line
              type="monotone"
              dataKey="compare"
              stroke="var(--chart-4)"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--chart-4)', stroke: 'var(--card)', strokeWidth: 2 }}
            />
          )}

          {/* Financial-independence crossing */}
          {fi && byMonth.has(fi.month) && (
            <ReferenceLine
              x={fi.month}
              stroke="var(--chart-2)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{
                value: 'FI',
                position: 'top',
                fill: 'var(--chart-2)',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}

          {/* Net-worth marks crossed along the way, as hollow notches */}
          {milestones
            .filter((m) => m.kind === 'threshold')
            .map((m) =>
              byMonth.has(m.month) ? (
                <ReferenceDot
                  key={`ms-${m.label}`}
                  x={m.month}
                  y={byMonth.get(m.month)!.expected}
                  r={3.5}
                  fill="var(--card)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  label={{
                    value: m.label,
                    position: 'top',
                    fill: 'var(--muted-foreground)',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              ) : null
            )}

          {/* Life events pinned to the expected path */}
          {events.map((e) => {
            const p = byMonth.get(e.start)
            if (!p) return null
            return (
              <ReferenceDot
                key={e.id}
                x={e.start}
                y={p.expected}
                r={5.5}
                fill={e.color}
                stroke="var(--card)"
                strokeWidth={2}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
