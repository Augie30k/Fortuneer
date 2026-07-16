'use client'

/* eslint-disable @next/next/no-img-element */
import type { RecurringStream } from '@/lib/types'
import { useEffect, useState } from 'react'
import { CalendarClock, Repeat } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import CategoryIcon from '@/components/CategoryIcon'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const CADENCE_LABEL: Record<RecurringStream['cadence'], string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export default function RecurringPage() {
  const [streams, setStreams] = useState<RecurringStream[]>([])
  const [monthlyTotal, setMonthlyTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/recurring')
      .then((r) => r.json())
      .then((data) => {
        setStreams(data.streams ?? [])
        setMonthlyTotal(data.monthlyTotal ?? 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Recurring</h1>
        <p className="text-sm text-muted-foreground">
          Subscriptions and bills detected from your transaction history
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : streams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <Repeat className="size-6 text-primary" />
            </span>
            <div>
              <p className="font-medium">Nothing recurring detected yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Fortuneer looks for repeated charges — the same vendor on a steady
                weekly, monthly, or yearly rhythm. Sync more history and check back.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center gap-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <CalendarClock className="size-5 text-primary" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Estimated monthly recurring
                </p>
                <p className="text-2xl font-semibold">{formatCurrency(monthlyTotal)}</p>
              </div>
              <p className="ml-auto text-sm text-muted-foreground">
                {streams.length} active {streams.length === 1 ? 'stream' : 'streams'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              {streams.map((s, i) => (
                <div key={s.key}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 py-3">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <CategoryIcon chip icon={s.category?.icon} color={s.category?.color} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {CADENCE_LABEL[s.cadence]} · {s.occurrences} charges
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(s.averageAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-1 h-4 px-1.5 text-[10px]">
                          Next
                        </Badge>
                        {formatDate(s.nextDate, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
