import fs from 'node:fs'
import path from 'node:path'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { AdminStat } from '../admin-stat'

export const dynamic = 'force-dynamic'

const DAYS = 30

function getMobileAppVersion(): string | null {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'apps/mobile/app.json'), 'utf-8')
    return JSON.parse(raw)?.expo?.version ?? null
  } catch {
    return null
  }
}

export default async function AdminMobilePage() {
  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
  const version = getMobileAppVersion()

  const [{ data: rows, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('usage_log')
      .select('user_id, model, input_tokens, output_tokens, created_at')
      .eq('client', 'mobile')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000),
    supabase.from('profiles').select('id, email'),
  ])

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load mobile usage: {error.message}
        {error.message.includes('client') &&
          ' — has migration 021_admin_controls_logging.sql been applied?'}
      </p>
    )
  }

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email ?? p.id]))
  const veraUsers = new Set((rows ?? []).map((r) => r.user_id))
  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      requests: acc.requests + 1,
      input: acc.input + (r.input_tokens ?? 0),
      output: acc.output + (r.output_tokens ?? 0),
    }),
    { requests: 0, input: 0, output: 0 }
  )

  const recent = [...(rows ?? [])].slice(0, 50)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Mobile</h1>
        <p className="text-sm text-muted-foreground">
          App version {version ?? 'unknown'} · Vera on mobile isn't wired up yet, so this fills in as usage lands.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AdminStat label="Requests (30d)" value={totals.requests.toLocaleString('en-US')} />
        <AdminStat label="Active mobile users (30d)" value={String(veraUsers.size)} />
        <AdminStat label="Tokens (30d)" value={(totals.input + totals.output).toLocaleString('en-US')} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Block Vera or the whole app on mobile from the{' '}
            <a href="/admin/controls" className="underline underline-offset-4">Controls</a> page.
            Per-user Vera access is on the <a href="/admin/users" className="underline underline-offset-4">Users</a> page.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 pl-4 font-medium">Time</th>
              <th className="py-2 pr-4 font-medium">User</th>
              <th className="py-2 pr-4 font-medium">Model</th>
              <th className="py-2 pr-4 font-medium text-right">Input tokens</th>
              <th className="py-2 pr-4 font-medium text-right">Output tokens</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 pr-4 pl-4 whitespace-nowrap">{formatDate(r.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                <td className="py-2 pr-4">{emailById.get(r.user_id) ?? r.user_id}</td>
                <td className="py-2 pr-4 text-xs">{r.model}</td>
                <td className="py-2 pr-4 text-right">{(r.input_tokens ?? 0).toLocaleString('en-US')}</td>
                <td className="py-2 pr-4 text-right">{(r.output_tokens ?? 0).toLocaleString('en-US')}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  No mobile AI usage recorded in the last {DAYS} days
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
