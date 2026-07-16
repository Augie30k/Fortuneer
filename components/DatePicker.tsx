'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fromIso(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatDisplay(value: string) {
  const d = fromIso(value)
  if (!d) return null
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** Calendar date picker — day grid in a popover, replacing native date inputs. */
export default function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  clearable = false,
  id,
  className,
  align = 'start',
}: {
  value: string // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void
  placeholder?: string
  /** Show a Clear action for optional dates */
  clearable?: boolean
  id?: string
  className?: string
  align?: 'start' | 'center' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const selected = fromIso(value)
  const [viewYear, setViewYear] = useState((selected ?? today).getFullYear())
  const [viewMonth, setViewMonth] = useState((selected ?? today).getMonth())

  const openTo = (d: Date) => {
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const shiftView = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const pick = (d: Date) => {
    onChange(toIso(d))
    setOpen(false)
  }

  // 6 fixed weeks so the popover never changes height while browsing
  const gridStart = new Date(viewYear, viewMonth, 1)
  gridStart.setDate(1 - gridStart.getDay())
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })

  const todayIso = toIso(today)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) openTo(selected ?? today)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {formatDisplay(value) ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[276px] p-3">
        <div className="flex items-center justify-between pb-2">
          <Button variant="ghost" size="icon-sm" onClick={() => shiftView(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <button
            type="button"
            className="rounded px-2 py-0.5 text-sm font-semibold transition-colors hover:bg-accent"
            onClick={() => openTo(today)}
            title="Jump to today"
          >
            {new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </button>
          <Button variant="ghost" size="icon-sm" onClick={() => shiftView(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>

        <div className="grid grid-cols-7 pb-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((d) => {
            const iso = toIso(d)
            const inMonth = d.getMonth() === viewMonth
            const isSelected = iso === value
            const isToday = iso === todayIso
            return (
              <button
                key={iso}
                type="button"
                onClick={() => pick(d)}
                aria-label={iso}
                className={cn(
                  'mx-auto flex size-8 items-center justify-center rounded-lg text-sm tabular-nums transition-colors',
                  inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                  isSelected
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'hover:bg-accent',
                  isToday && !isSelected && 'ring-1 ring-primary/50'
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-2 mt-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => pick(today)}>
            Today
          </Button>
          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
