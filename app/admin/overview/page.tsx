import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminStat } from '../admin-stat'

export const dynamic = 'force-dynamic'

const CONFIG_CHECKS = [
  { label: 'Groq (Vera)', vars: ['GROQ_API_KEY'] },
  { label: 'Admin → Dev Supabase', vars: ['ADMIN_DEV_SUPABASE_URL', 'ADMIN_DEV_SUPABASE_SECRET_KEY'] },
  { label: 'Admin → Prod Supabase', vars: ['ADMIN_PROD_SUPABASE_URL', 'ADMIN_PROD_SUPABASE_SECRET_KEY'] },
  { label: 'Admin → Dev Plaid', vars: ['ADMIN_DEV_PLAID_CLIENT_ID', 'ADMIN_DEV_PLAID_SECRET'] },
  { label: 'Admin → Prod Plaid', vars: ['ADMIN_PROD_PLAID_CLIENT_ID', 'ADMIN_PROD_PLAID_SECRET'] },
  { label: 'Vercel deep link', vars: ['ADMIN_VERCEL_URL'] },
  { label: 'EAS deep link', vars: ['ADMIN_EAS_URL'] },
]

const LEVEL_STYLE: Record<string, string> = {
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  info: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
}

export default async function AdminOverviewPage() {
  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)

  const [{ data: profiles }, { data: requests }, { data: flags }, { data: events }] = await Promise.all([
    supabase.from('profiles').select('status, vera_blocked'),
    supabase.from('support_requests').select('status'),
    supabase.from('admin_flags').select('key, enabled').order('key'),
    supabase
      .from('admin_events')
      .select('id, level, source, message, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const users = profiles ?? []
  const pendingCount = users.filter((u) => u.status === 'pending').length
  const blockedCount = users.filter((u) => u.status === 'blocked').length
  const veraBlockedCount = users.filter((u) => u.vera_blocked).length
  const openTickets = (requests ?? []).filter((r) => r.status === 'open').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Health, key counts, and recent errors — {env}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminStat label="Total users" value={String(users.length)} />
        <AdminStat label="Pending approval" value={String(pendingCount)} />
        <AdminStat label="Blocked" value={String(blockedCount)} />
        <AdminStat label="Open tickets" value={String(openTickets)} />
        <AdminStat label="Vera-blocked users" value={String(veraBlockedCount)} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Kill switches</h2>
        <Card>
          <CardContent className="flex flex-wrap gap-2">
            {(flags ?? []).map((f) => (
              <Badge key={f.key} variant={f.enabled ? 'destructive' : 'outline'}>
                {f.key.replace(/_/g, ' ')}: {f.enabled ? 'ON' : 'off'}
              </Badge>
            ))}
            {(flags ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No flags found — has migration 021_admin_controls_logging.sql been applied?
              </p>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Manage these on the Controls page.</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Config health</h2>
        <Card>
          <CardContent className="flex flex-wrap gap-2">
            {CONFIG_CHECKS.map((c) => {
              const ok = c.vars.every((v) => !!process.env[v])
              return (
                <Badge key={c.label} variant={ok ? 'secondary' : 'destructive'}>
                  {c.label}: {ok ? 'set' : 'missing'}
                </Badge>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent errors</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Level</th>
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4 whitespace-nowrap">{formatDate(e.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[e.level] ?? ''}`}>
                      {e.level}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{e.source}</td>
                  <td className="py-2 pr-4">{e.message}</td>
                </tr>
              ))}
              {(events ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No events logged yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted-foreground">
          Full history on the <a href="/admin/logs" className="underline underline-offset-4">Logs</a> page.
        </p>
      </div>
    </div>
  )
}
