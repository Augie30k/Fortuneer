import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { CountryCode } from 'plaid'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { getAdminPlaidClient } from '@/lib/plaid'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const CONFIG_CHECKS = [
  { label: 'Groq (Vera)', vars: ['GROQ_API_KEY'] },
  { label: 'Resend', vars: ['RESEND_API_KEY'] },
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
}

type CheckResult = { name: string; ok: boolean; ms: number; detail: string }

const CHECK_TIMEOUT_MS = 6000

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${CHECK_TIMEOUT_MS}ms`)), CHECK_TIMEOUT_MS)
    ),
  ])
}

async function runCheck(name: string, fn: () => Promise<string>): Promise<CheckResult> {
  const start = Date.now()
  try {
    const detail = await withTimeout(fn())
    return { name, ok: true, ms: Date.now() - start, detail }
  } catch (e) {
    return { name, ok: false, ms: Date.now() - start, detail: e instanceof Error ? e.message : String(e) }
  }
}

/** Live round-trips to every external service the app depends on, so "is it
 *  us or them?" is answerable at a glance. Each check is a real (cheap) API
 *  call with a timeout, not just an env-var presence test. */
function runHealthChecks(): Promise<CheckResult[]> {
  return Promise.all([
    runCheck('Supabase (dev)', async () => {
      const { count, error } = await createAdminClientFor('development')
        .from('profiles')
        .select('id', { count: 'exact', head: true })
      if (error) throw new Error(error.message)
      return `${count ?? 0} profiles`
    }),
    runCheck('Supabase (prod)', async () => {
      const { count, error } = await createAdminClientFor('production')
        .from('profiles')
        .select('id', { count: 'exact', head: true })
      if (error) throw new Error(error.message)
      return `${count ?? 0} profiles`
    }),
    runCheck('Groq', async () => {
      if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY unset')
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      return `${json.data?.length ?? 0} models available`
    }),
    runCheck('Plaid (dev)', async () => {
      await getAdminPlaidClient('development').institutionsGet({
        count: 1,
        offset: 0,
        country_codes: [CountryCode.Us],
      })
      return 'reachable'
    }),
    runCheck('Plaid (prod)', async () => {
      await getAdminPlaidClient('production').institutionsGet({
        count: 1,
        offset: 0,
        country_codes: [CountryCode.Us],
      })
      return 'reachable'
    }),
    runCheck('Resend', async () => {
      if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY unset')
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      // Send-only API keys 401 on read endpoints — the key still works for
      // the hub's actual job (sending), so that's healthy, not down.
      if (res.status === 401 && String(json?.message ?? '').includes('restricted')) {
        return 'API key valid (send-only)'
      }
      if (!res.ok) throw new Error(json?.message ? `HTTP ${res.status}: ${json.message}` : `HTTP ${res.status}`)
      return `${json?.data?.length ?? 0} verified domains`
    }),
  ])
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

function getGitInfo(): { branch: string; sha: string } | null {
  try {
    const gitDir = path.join(process.cwd(), '.git')
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim()
    if (!head.startsWith('ref: ')) return { branch: 'detached', sha: head.slice(0, 7) }

    const ref = head.slice(5)
    let sha = ''
    const refPath = path.join(gitDir, ref)
    if (fs.existsSync(refPath)) {
      sha = fs.readFileSync(refPath, 'utf-8').trim()
    } else {
      const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf-8')
      sha = packed.split('\n').find((l) => l.endsWith(` ${ref}`))?.split(' ')[0] ?? ''
    }
    return { branch: ref.replace('refs/heads/', ''), sha: sha.slice(0, 7) }
  } catch {
    return null
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(seconds % 60)}s`
}

export default async function DevOpsDiagnosticsPage() {
  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)

  const [checks, { data: flags }, { data: events }] = await Promise.all([
    runHealthChecks(),
    supabase.from('admin_flags').select('key, enabled').order('key'),
    supabase
      .from('admin_events')
      .select('id, level, source, message, created_at')
      .in('level', ['error', 'warn'])
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const pkg = readJson(path.join(process.cwd(), 'package.json'))
  const git = getGitInfo()
  const deps = (pkg?.dependencies ?? {}) as Record<string, string>

  const runtime = [
    { label: 'App version', value: String(process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown') },
    { label: 'Next.js', value: deps.next ?? 'unknown' },
    { label: 'Node', value: process.version },
    { label: 'Git', value: git ? `${git.branch} @ ${git.sha}` : 'unknown' },
    { label: 'Server uptime', value: formatUptime(process.uptime()) },
    { label: 'Platform', value: `${process.platform} ${process.arch}` },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Diagnostics</h1>
        <p className="text-sm text-muted-foreground">Live service health, config, and runtime — {env}</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Service health</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">Service</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium text-right">Latency</th>
                <th className="py-2 pr-4 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.name} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4 font-medium whitespace-nowrap">{c.name}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={c.ok ? 'secondary' : 'destructive'}>{c.ok ? 'up' : 'down'}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{c.ms.toLocaleString('en-US')} ms</td>
                  <td className="py-2 pr-4 text-muted-foreground">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted-foreground">Checks run live on every load of this page.</p>
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
        <p className="text-xs text-muted-foreground">
          Manage these on the <Link href="/hub/devops/controls" className="underline underline-offset-4">Controls</Link> page.
        </p>
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
        <h2 className="text-sm font-semibold">Runtime</h2>
        <Card>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {runtime.map((r) => (
              <div key={r.label}>
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="text-sm font-medium tabular-nums">{r.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent errors &amp; warnings</h2>
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
                  <td className="py-2 pr-4 pl-4 whitespace-nowrap">
                    {formatDate(e.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </td>
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
                    No errors or warnings logged
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted-foreground">
          Full history on the <Link href="/hub/devops/logs" className="underline underline-offset-4">Logs</Link> page.
        </p>
      </div>
    </div>
  )
}
