import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { HubStat } from '../../hub-stat'
import { PlatformSplitChart, type SplitPoint } from '../charts'

export const dynamic = 'force-dynamic'

const DAYS = 30
const CHART_DAYS = 14

export default async function AnalystEngagementPage() {
  const supabase = createAdminClientFor(await getAdminEnv())
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: rows, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('usage_log')
      .select('user_id, client, input_tokens, output_tokens, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000),
    supabase.from('profiles').select('id, email, status'),
  ])

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load usage: {error.message}
        {error.message.includes('client') &&
          ' — has migration 021_admin_controls_logging.sql been applied?'}
      </p>
    )
  }

  const usage = rows ?? []
  const users = profiles ?? []
  const emailById = new Map(users.map((p) => [p.id, p.email ?? p.id]))
  const activeCount = users.filter((u) => u.status === 'active').length

  const veraUsers = new Set(usage.map((r) => r.user_id))
  const webRequests = usage.filter((r) => r.client !== 'mobile').length
  const mobileRequests = usage.length - webRequests
  const adoptionPct = activeCount > 0 ? Math.round((veraUsers.size / activeCount) * 100) : 0

  // Daily web/mobile split for the trailing two weeks, zero-filled
  const split: SplitPoint[] = []
  const byDay = new Map<string, SplitPoint>()
  const now = Date.now()
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const key = new Date(now - i * 86_400_000).toISOString().slice(0, 10)
    const point = { label: formatDate(key, { month: 'short', day: 'numeric' }), web: 0, mobile: 0 }
    byDay.set(key, point)
    split.push(point)
  }
  for (const r of usage) {
    const point = byDay.get(r.created_at.slice(0, 10))
    if (!point) continue
    if (r.client === 'mobile') point.mobile += 1
    else point.web += 1
  }

  // Per-user engagement over the full window
  type UserRow = { requests: number; tokens: number; mobile: number; last: string }
  const byUser = new Map<string, UserRow>()
  for (const r of usage) {
    const u = byUser.get(r.user_id) ?? { requests: 0, tokens: 0, mobile: 0, last: r.created_at }
    u.requests += 1
    u.tokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0)
    if (r.client === 'mobile') u.mobile += 1
    if (r.created_at > u.last) u.last = r.created_at
    byUser.set(r.user_id, u)
  }
  const engaged = [...byUser.entries()].sort((a, b) => b[1].requests - a[1].requests).slice(0, 15)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Engagement</h1>
        <p className="text-sm text-muted-foreground">Who actually uses Vera, and from where — last {DAYS} days</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HubStat label="Vera users" value={String(veraUsers.size)} hint={`of ${activeCount} active accounts`} />
        <HubStat label="Vera adoption" value={`${adoptionPct}%`} />
        <HubStat label="Web requests" value={webRequests.toLocaleString('en-US')} />
        <HubStat label="Mobile requests" value={mobileRequests.toLocaleString('en-US')} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Requests per day by platform ({CHART_DAYS} days)</h2>
        <Card>
          <CardContent>
            <PlatformSplitChart data={split} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Most engaged users</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium text-right">Requests</th>
                <th className="py-2 pr-4 font-medium text-right">Tokens</th>
                <th className="py-2 pr-4 font-medium text-right">Mobile share</th>
                <th className="py-2 pr-4 font-medium">Last request</th>
              </tr>
            </thead>
            <tbody>
              {engaged.map(([userId, u]) => (
                <tr key={userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4">{emailById.get(userId) ?? userId}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{u.requests.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{u.tokens.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {Math.round((u.mobile / u.requests) * 100)}%
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {formatDate(u.last, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {engaged.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No Vera usage in the last {DAYS} days
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
