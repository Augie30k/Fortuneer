import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const DAY = 86_400_000

interface Cadence {
  name: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  min: number
  max: number
  step: number
}

const CADENCES: Cadence[] = [
  { name: 'weekly', min: 5, max: 9, step: 7 },
  { name: 'biweekly', min: 12, max: 16, step: 14 },
  { name: 'monthly', min: 25, max: 35, step: 30 },
  { name: 'yearly', min: 340, max: 390, step: 365 },
]

/**
 * Heuristic recurring-stream detection: group outflows by merchant, then look
 * for a stable interval between charges and reasonably stable amounts.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oneYearAgo = new Date(Date.now() - 370 * DAY).toISOString().slice(0, 10)

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, date, description, merchant_name, logo_url, category_id, pending, categories(name, icon, color, is_transfer)')
      .eq('user_id', user.id)
      .gt('amount', 0)
      .eq('pending', false)
      .gte('date', oneYearAgo)
      .order('date')

    if (error) throw error

    // Group by normalized merchant (fall back to description)
    const groups = new Map<string, typeof transactions>()
    for (const t of transactions ?? []) {
      const categories = t.categories as unknown as { is_transfer: boolean } | null
      if (categories?.is_transfer) continue
      const key = (t.merchant_name ?? t.description).trim().toLowerCase()
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }

    const streams = []
    for (const [key, txns] of groups) {
      if (txns.length < 3) continue

      const dates = txns.map((t) => new Date(t.date + 'T00:00:00').getTime())
      const intervals = []
      for (let i = 1; i < dates.length; i++) {
        intervals.push(Math.round((dates[i] - dates[i - 1]) / DAY))
      }
      const median = intervals.slice().sort((a, b) => a - b)[Math.floor(intervals.length / 2)]

      const cadence = CADENCES.find((c) => median >= c.min && median <= c.max)
      if (!cadence) continue

      // Require most intervals near the median cadence
      const tolerance = Math.max(3, cadence.step * 0.25)
      const consistent = intervals.filter((i) => Math.abs(i - cadence.step) <= tolerance)
      if (consistent.length < intervals.length * 0.6) continue

      // Amount stability: median-based, within 25%
      const amounts = txns.map((t) => Number(t.amount))
      const medianAmount = amounts.slice().sort((a, b) => a - b)[Math.floor(amounts.length / 2)]
      const stable = amounts.filter((a) => Math.abs(a - medianAmount) <= medianAmount * 0.25)
      if (stable.length < amounts.length * 0.6) continue

      const last = txns[txns.length - 1]
      const lastTime = dates[dates.length - 1]
      const next = new Date(lastTime + cadence.step * DAY)

      streams.push({
        key,
        name: last.merchant_name ?? last.description,
        logo_url: last.logo_url,
        category: last.categories ?? null,
        cadence: cadence.name,
        averageAmount: medianAmount,
        lastAmount: Number(last.amount),
        lastDate: last.date,
        nextDate: next.toISOString().slice(0, 10),
        occurrences: txns.length,
      })
    }

    streams.sort((a, b) => a.nextDate.localeCompare(b.nextDate))

    const monthlyTotal = streams.reduce((sum, s) => {
      const perMonth = { weekly: 4.33, biweekly: 2.17, monthly: 1, yearly: 1 / 12 }[s.cadence]
      return sum + s.averageAmount * perMonth
    }, 0)

    return NextResponse.json({ streams, monthlyTotal })
  } catch (error) {
    console.error('Error detecting recurring streams:', error)
    return NextResponse.json({ error: 'Failed to detect recurring streams' }, { status: 500 })
  }
}
