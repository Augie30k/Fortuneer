import { createAdminClient } from '@/lib/supabase-admin'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const DAYS = 30

export default async function AdminUsagePage() {
  const supabase = createAdminClient()
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: rows, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('usage_log')
      .select('user_id, model, input_tokens, output_tokens, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000),
    supabase.from('profiles').select('id, email'),
  ])

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load usage: {error.message}
        {error.message.includes('usage_log') &&
          ' — has migration 019_admin_status_usage.sql been applied?'}
      </p>
    )
  }

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email ?? p.id]))

  // Aggregate per user per day; fine in JS at local-admin scale.
  type Bucket = { day: string; email: string; requests: number; input: number; output: number; models: Set<string> }
  const buckets = new Map<string, Bucket>()
  for (const r of rows ?? []) {
    const day = r.created_at.slice(0, 10)
    const key = `${day}|${r.user_id}`
    let b = buckets.get(key)
    if (!b) {
      b = { day, email: emailById.get(r.user_id) ?? r.user_id, requests: 0, input: 0, output: 0, models: new Set() }
      buckets.set(key, b)
    }
    b.requests += 1
    b.input += r.input_tokens ?? 0
    b.output += r.output_tokens ?? 0
    b.models.add(r.model)
  }

  const days = [...buckets.values()].sort(
    (a, b) => b.day.localeCompare(a.day) || a.email.localeCompare(b.email)
  )
  const totals = days.reduce(
    (acc, b) => ({ requests: acc.requests + b.requests, input: acc.input + b.input, output: acc.output + b.output }),
    { requests: 0, input: 0, output: 0 }
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">AI Usage</h1>
        <p className="text-sm text-muted-foreground">
          Groq tokens per user per day, last {DAYS} days · {totals.requests.toLocaleString('en-US')} requests ·{' '}
          {totals.input.toLocaleString('en-US')} in / {totals.output.toLocaleString('en-US')} out
        </p>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Day</th>
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium text-right">Requests</th>
            <th className="py-2 pr-4 font-medium text-right">Input tokens</th>
            <th className="py-2 pr-4 font-medium text-right">Output tokens</th>
            <th className="py-2 font-medium">Models</th>
          </tr>
        </thead>
        <tbody>
          {days.map((b) => (
            <tr key={`${b.day}|${b.email}`} className="border-b">
              <td className="py-2 pr-4 whitespace-nowrap">{formatDate(b.day)}</td>
              <td className="py-2 pr-4">{b.email}</td>
              <td className="py-2 pr-4 text-right">{b.requests.toLocaleString('en-US')}</td>
              <td className="py-2 pr-4 text-right">{b.input.toLocaleString('en-US')}</td>
              <td className="py-2 pr-4 text-right">{b.output.toLocaleString('en-US')}</td>
              <td className="py-2 text-xs text-muted-foreground">{[...b.models].join(', ')}</td>
            </tr>
          ))}
          {days.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                No usage recorded in the last {DAYS} days
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
