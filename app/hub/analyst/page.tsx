import Link from 'next/link'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatCurrency } from '@/lib/format'
import { estimateCostUsd } from '@/lib/groq-pricing'
import { Card, CardContent } from '@/components/ui/card'
import { HubStat } from '../hub-stat'
import { weeklyCounts } from './aggregate'
import { TimeBarChart } from './charts'

export const dynamic = 'force-dynamic'

export default async function AnalystOverviewPage() {
  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: profiles }, { data: authData }, { data: usage }] = await Promise.all([
    supabase.from('profiles').select('id, email, status, created_at'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase
      .from('usage_log')
      .select('user_id, model, input_tokens, output_tokens, created_at')
      .gte('created_at', since30d)
      .limit(10000),
  ])

  const users = profiles ?? []
  const rows = usage ?? []

  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
  const newThisMonth = users.filter((u) => u.created_at.startsWith(thisMonth)).length
  const newLastMonth = users.filter((u) => u.created_at.startsWith(lastMonth)).length

  const active7d = (authData?.users ?? []).filter(
    (u) => u.last_sign_in_at && u.last_sign_in_at >= since7d
  ).length

  const cost30d = rows.reduce(
    (sum, r) => sum + estimateCostUsd(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0),
    0
  )

  const signupSeries = weeklyCounts(users.map((u) => u.created_at), 12)

  // Top Vera users by request count over the trailing 30 days
  const emailById = new Map(users.map((u) => [u.id, u.email ?? u.id]))
  const byUser = new Map<string, { requests: number; tokens: number; cost: number }>()
  for (const r of rows) {
    const b = byUser.get(r.user_id) ?? { requests: 0, tokens: 0, cost: 0 }
    b.requests += 1
    b.tokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0)
    b.cost += estimateCostUsd(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0)
    byUser.set(r.user_id, b)
  }
  const topUsers = [...byUser.entries()].sort((a, b) => b[1].requests - a[1].requests).slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Analyst</h1>
        <p className="text-sm text-muted-foreground">Growth, engagement, and cost at a glance — {env}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HubStat label="Total users" value={String(users.length)} />
        <HubStat
          label="New this month"
          value={String(newThisMonth)}
          hint={`${newLastMonth} last month`}
        />
        <HubStat label="Active users (7d)" value={String(active7d)} hint="Signed in this week" />
        <HubStat
          label="AI cost (30d)"
          value={formatCurrency(cost30d, 'USD', { maximumFractionDigits: cost30d < 1 ? 4 : 2 })}
          hint={`${rows.length.toLocaleString('en-US')} Vera requests`}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Signups per week</h2>
          <Link href="/hub/analyst/growth" className="text-xs text-muted-foreground underline underline-offset-4">
            Growth detail
          </Link>
        </div>
        <Card>
          <CardContent>
            <TimeBarChart data={signupSeries} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Top Vera users (30d)</h2>
          <Link href="/hub/analyst/engagement" className="text-xs text-muted-foreground underline underline-offset-4">
            Engagement detail
          </Link>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium text-right">Requests</th>
                <th className="py-2 pr-4 font-medium text-right">Tokens</th>
                <th className="py-2 pr-4 font-medium text-right">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map(([userId, b]) => (
                <tr key={userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4">{emailById.get(userId) ?? userId}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{b.requests.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{b.tokens.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCurrency(b.cost, 'USD', { maximumFractionDigits: b.cost < 1 ? 4 : 2 })}
                  </td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No Vera usage in the last 30 days
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
