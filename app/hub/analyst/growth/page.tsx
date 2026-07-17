import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { HubStat } from '../../hub-stat'
import { weeklyCounts, type ChartPoint } from '../aggregate'
import { TimeBarChart, TimeLineChart } from '../charts'

export const dynamic = 'force-dynamic'

type MonthRow = { month: string; label: string; signups: number; cumulative: number; growthPct: number | null }

/** Signups per calendar month from the first signup to now, zero-filled,
 *  with a running total and month-over-month growth. */
function monthlySeries(createdDates: string[]): MonthRow[] {
  if (createdDates.length === 0) return []

  const byMonth = new Map<string, number>()
  for (const iso of createdDates) {
    const m = iso.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1)
  }

  const first = [...byMonth.keys()].sort()[0]
  const [firstYear, firstMonth] = first.split('-').map(Number)
  const now = new Date()

  const rows: MonthRow[] = []
  let cumulative = 0
  const cursor = new Date(Date.UTC(firstYear, firstMonth - 1, 1))
  while (cursor.getTime() <= now.getTime()) {
    const key = cursor.toISOString().slice(0, 7)
    const signups = byMonth.get(key) ?? 0
    const prevCumulative = cumulative
    cumulative += signups
    rows.push({
      month: key,
      label: formatDate(`${key}-01`, { month: 'short', year: 'numeric' }),
      signups,
      cumulative,
      growthPct: prevCumulative > 0 ? (signups / prevCumulative) * 100 : null,
    })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return rows
}

export default async function AnalystGrowthPage() {
  const supabase = createAdminClientFor(await getAdminEnv())

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    supabase.from('profiles').select('id, created_at'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const users = profiles ?? []
  const months = monthlySeries(users.map((u) => u.created_at))
  const weekly = weeklyCounts(users.map((u) => u.created_at), 12)
  const cumulativeSeries: ChartPoint[] = months.map((m) => ({ label: m.label, value: m.cumulative }))

  const thisMonth = months.at(-1)
  const lastMonth = months.at(-2)
  const everSignedIn = (authData?.users ?? []).filter((u) => u.last_sign_in_at).length
  const activationPct = users.length > 0 ? Math.round((everSignedIn / users.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Growth</h1>
        <p className="text-sm text-muted-foreground">Signups and account activation over time</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HubStat label="Total users" value={String(users.length)} />
        <HubStat label="New this month" value={String(thisMonth?.signups ?? 0)} />
        <HubStat label="New last month" value={String(lastMonth?.signups ?? 0)} />
        <HubStat
          label="Activation"
          value={`${activationPct}%`}
          hint={`${users.length - everSignedIn} never signed in`}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Signups per week (12 weeks)</h2>
        <Card>
          <CardContent>
            <TimeBarChart data={weekly} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Cumulative users</h2>
        <Card>
          <CardContent>
            {cumulativeSeries.length > 1 ? (
              <TimeLineChart data={cumulativeSeries} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Not enough history for a trend yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">By month</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium text-right">Signups</th>
                <th className="py-2 pr-4 font-medium text-right">Total users</th>
                <th className="py-2 pr-4 font-medium text-right">Growth</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.month} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4 whitespace-nowrap">{m.label}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.signups}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.cumulative}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {m.growthPct == null ? '—' : `+${m.growthPct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
              {months.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">No users yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
