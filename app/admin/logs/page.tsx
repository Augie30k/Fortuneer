import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { AdminStat } from '../admin-stat'

export const dynamic = 'force-dynamic'

const LEVEL_STYLE: Record<string, string> = {
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  info: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
}

export default async function AdminLogsPage() {
  const supabase = createAdminClientFor(await getAdminEnv())
  const { data: events, error } = await supabase
    .from('admin_events')
    .select('id, level, source, message, context, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Logs</h1>
        <p className="text-sm text-muted-foreground">Last {all.length} events</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AdminStat label="Errors" value={String(errorCount)} />
        <AdminStat label="Warnings" value={String(warnCount)} />
        <AdminStat label="Info" value={String(all.length - errorCount - warnCount)} />
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
            {all.map((e) => (
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
            {all.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">No events logged yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
