'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/format'
import type { ChartPoint } from './aggregate'

/** Recharts is client-only, so pages pass plain data + a format *tag*
 *  (functions can't cross the server/client boundary). */
type ValueFormat = 'int' | 'usd'

function fmtValue(v: number, format: ValueFormat) {
  if (format === 'usd') {
    return formatCurrency(v, 'USD', { maximumFractionDigits: v > 0 && v < 1 ? 4 : 2 })
  }
  return v.toLocaleString('en-US')
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

function fmtTick(v: number, format: ValueFormat) {
  return format === 'usd' ? `$${compact.format(v)}` : compact.format(v)
}

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 }

function ChartTooltip({
  active,
  payload,
  label,
  format,
  series,
}: {
  active?: boolean
  payload?: { name?: string; value?: number | string }[]
  label?: string
  format: ValueFormat
  series?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="mt-0.5 tabular-nums text-muted-foreground">
          {series ? `${p.name}: ` : ''}
          {fmtValue(Number(p.value ?? 0), format)}
        </p>
      ))}
    </div>
  )
}

/** Single-series column chart over time (signups per week, cost per day). */
export function TimeBarChart({ data, format = 'int' }: { data: ChartPoint[]; format?: ValueFormat }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={24} />
          <YAxis
            width={40}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => fmtTick(v, format)}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
            content={<ChartTooltip format={format} />}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Single-series line chart (cumulative users). */
export function TimeLineChart({ data, format = 'int' }: { data: ChartPoint[]; format?: ValueFormat }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={24} />
          <YAxis
            width={40}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => fmtTick(v, format)}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip format={format} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export type SplitPoint = { label: string; web: number; mobile: number }

/** Stacked daily requests, web vs mobile. Two series, so a legend is
 *  always shown; colors stay fixed per platform (web=chart-1, mobile=chart-2). */
export function PlatformSplitChart({ data }: { data: SplitPoint[] }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: 'var(--chart-1)' }} />
          Web
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: 'var(--chart-2)' }} />
          Mobile
        </span>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={24} />
            <YAxis
              width={40}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              tickFormatter={(v: number) => fmtTick(v, 'int')}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
              content={<ChartTooltip format="int" series />}
            />
            <Bar dataKey="web" name="Web" stackId="platform" fill="var(--chart-1)" stroke="var(--card)" strokeWidth={1} maxBarSize={28} />
            <Bar dataKey="mobile" name="Mobile" stackId="platform" fill="var(--chart-2)" stroke="var(--card)" strokeWidth={1} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
