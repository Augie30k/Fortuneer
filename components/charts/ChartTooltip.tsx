'use client'

import { formatCurrency } from '@/lib/format'

interface TooltipRow {
  name: string
  value: number
  color?: string
}

export default function ChartTooltip({
  title,
  rows,
}: {
  title: string
  rows: TooltipRow[]
}) {
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
      <p className="mb-1 font-medium text-muted-foreground">{title}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 py-0.5 font-medium">
          {row.color && (
            <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
          )}
          <span className="text-muted-foreground">{row.name}</span>
          <span className="ml-auto pl-3 tabular-nums">{formatCurrency(row.value)}</span>
        </p>
      ))}
    </div>
  )
}
