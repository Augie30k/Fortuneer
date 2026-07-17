import { formatDate } from '@/lib/format'

export type ChartPoint = { label: string; value: number }

/** Start (Sunday, local time) of the week containing d. */
function weekStart(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

/** Counts of ISO timestamps per calendar week for the trailing `weeks`
 *  weeks, oldest first — empty weeks stay in the series as zeros so the
 *  time axis never lies by omission. */
export function weeklyCounts(isoDates: string[], weeks: number): ChartPoint[] {
  const current = weekStart(new Date())
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current)
    start.setDate(start.getDate() - 7 * (weeks - 1 - i))
    return { start, label: formatDate(start, { month: 'short', day: 'numeric' }), value: 0 }
  })

  const firstTime = buckets[0].start.getTime()
  for (const iso of isoDates) {
    const idx = Math.round((weekStart(new Date(iso)).getTime() - firstTime) / (7 * 86_400_000))
    if (idx >= 0 && idx < buckets.length) buckets[idx].value += 1
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}

/** Sums of per-day values ({ day: 'yyyy-mm-dd', value }) over the trailing
 *  `days` UTC days, oldest first, zero-filled. */
export function dailySums(rows: { day: string; value: number }[], days: number): ChartPoint[] {
  const buckets: { key: string; label: string; value: number }[] = []
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now - i * 86_400_000).toISOString().slice(0, 10)
    buckets.push({ key, label: formatDate(key, { month: 'short', day: 'numeric' }), value: 0 })
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const r of rows) {
    const b = byKey.get(r.day)
    if (b) b.value += r.value
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}
