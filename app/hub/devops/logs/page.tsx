import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { adminEnabled, getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HubStat } from '../../hub-stat'
import { ClearLogsButton } from './clear-logs-button'

export const dynamic = 'force-dynamic'

const LEVEL_STYLE: Record<string, string> = {
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  info: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
}

const LEVEL_FILTERS = ['all', 'error', 'warn', 'info'] as const

/** Prunes admin_events up to a cutoff: days > 0 keeps the recent window,
 *  days = 0 wipes everything logged so far. Records what it did as a fresh
 *  info event so the cleanup itself stays auditable. */
async function clearLogs(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const days = Number(formData.get('days') ?? NaN)
  if (!Number.isFinite(days) || days < 0) return

  const supabase = createAdminClientFor(await getAdminEnv())
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { count } = await supabase
    .from('admin_events')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', cutoff)

  const { error } = await supabase.from('admin_events').delete().lt('created_at', cutoff)
  if (error) throw new Error(`Failed to clear logs: ${error.message}`)

  await supabase.from('admin_events').insert({
    level: 'info',
    source: 'hub.logs',
    message: days > 0 ? `Cleared ${count ?? 0} events older than ${days} days` : `Cleared all ${count ?? 0} events`,
  })

  revalidatePath('/hub/devops/logs')
}

export default async function DevOpsLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string }>
}) {
  const { level = 'all', q = '' } = await searchParams
  const supabase = createAdminClientFor(await getAdminEnv())
  const { data: events, error } = await supabase
    .from('admin_events')
    .select('id, level, source, message, context, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load logs: {error.message}
        {error.message.includes('admin_events') &&
          ' — has migration 021_admin_controls_logging.sql been applied?'}
      </p>
    )
  }

  const all = events ?? []
  const errorCount = all.filter((e) => e.level === 'error').length
  const warnCount = all.filter((e) => e.level === 'warn').length

  const needle = q.trim().toLowerCase()
  const filtered = all.filter(
    (e) =>
      (level === 'all' || e.level === level) &&
      (!needle ||
        e.source.toLowerCase().includes(needle) ||
        e.message.toLowerCase().includes(needle))
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Logs</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length === all.length ? `Last ${all.length} events` : `${filtered.length} of last ${all.length} events`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <HubStat label="Errors" value={String(errorCount)} />
        <HubStat label="Warnings" value={String(warnCount)} />
        <HubStat label="Info" value={String(all.length - errorCount - warnCount)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          {LEVEL_FILTERS.map((l) => (
            <Link
              key={l}
              href={{ pathname: '/hub/devops/logs', query: { ...(q ? { q } : {}), ...(l === 'all' ? {} : { level: l }) } }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                level === l
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              {l}
            </Link>
          ))}
        </div>
        <form method="GET" className="flex items-center gap-2">
          {level !== 'all' && <input type="hidden" name="level" value={level} />}
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search source or message…"
            className="h-8 w-56 text-sm"
          />
          <Button type="submit" variant="outline" size="xs">
            Search
          </Button>
        </form>
        <div className="ml-auto flex gap-2">
          <ClearLogsButton action={clearLogs} days={30} label="Clear >30d" />
          <ClearLogsButton action={clearLogs} days={0} label="Clear all" />
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 pl-4 font-medium">Time</th>
              <th className="py-2 pr-4 font-medium">Level</th>
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 pr-4 font-medium">Message</th>
              <th className="py-2 pr-4 font-medium">Context</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b align-top last:border-0">
                <td className="py-2 pr-4 pl-4 whitespace-nowrap">
                  {formatDate(e.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[e.level] ?? ''}`}>
                    {e.level}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{e.source}</td>
                <td className="py-2 pr-4">{e.message}</td>
                <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                  {e.context ? JSON.stringify(e.context) : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  {all.length === 0 ? 'No events logged yet' : 'No events match this filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
