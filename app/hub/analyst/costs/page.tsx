import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatCurrency } from '@/lib/format'
import { GROQ_PRICING, estimateCostUsd, groqRate } from '@/lib/groq-pricing'
import { Card, CardContent } from '@/components/ui/card'
import { HubStat } from '../../hub-stat'
import { dailySums } from '../aggregate'
import { TimeBarChart } from '../charts'

export const dynamic = 'force-dynamic'

const DAYS = 30

function fmtUsd(v: number) {
  return formatCurrency(v, 'USD', { maximumFractionDigits: v > 0 && v < 1 ? 4 : 2 })
}

export default async function AnalystCostsPage() {
  const supabase = createAdminClientFor(await getAdminEnv())
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: rows, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('usage_log')
      .select('user_id, model, input_tokens, output_tokens, created_at')
      .gte('created_at', since)
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

  const usage = rows ?? []
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email ?? p.id]))
  const costOf = (r: (typeof usage)[number]) =>
    estimateCostUsd(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0)

  const total30d = usage.reduce((sum, r) => sum + costOf(r), 0)

  const now = new Date()
  const monthStart = `${now.toISOString().slice(0, 7)}-01`
  const mtdRows = usage.filter((r) => r.created_at >= monthStart)
  const mtd = mtdRows.reduce((sum, r) => sum + costOf(r), 0)
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate()
  const projected = (mtd / now.getUTCDate()) * daysInMonth

  const dailyCost = dailySums(
    usage.map((r) => ({ day: r.created_at.slice(0, 10), value: costOf(r) })),
    DAYS
  )

  const byModel = new Map<string, { requests: number; input: number; output: number; cost: number }>()
  const byUser = new Map<string, { requests: number; tokens: number; cost: number }>()
  for (const r of usage) {
    const m = byModel.get(r.model) ?? { requests: 0, input: 0, output: 0, cost: 0 }
    m.requests += 1
    m.input += r.input_tokens ?? 0
    m.output += r.output_tokens ?? 0
    m.cost += costOf(r)
    byModel.set(r.model, m)

    const u = byUser.get(r.user_id) ?? { requests: 0, tokens: 0, cost: 0 }
    u.requests += 1
    u.tokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0)
    u.cost += costOf(r)
    byUser.set(r.user_id, u)
  }
  const models = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost)
  const topSpenders = [...byUser.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Costs</h1>
        <p className="text-sm text-muted-foreground">
          Estimated Groq spend from usage_log token counts, last {DAYS} days
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HubStat label={`Est. cost (${DAYS}d)`} value={fmtUsd(total30d)} />
        <HubStat label="Month to date" value={fmtUsd(mtd)} />
        <HubStat label="Projected month" value={fmtUsd(projected)} hint="At the current MTD run rate" />
        <HubStat
          label="Avg per request"
          value={usage.length > 0 ? fmtUsd(total30d / usage.length) : '—'}
          hint={`${usage.length.toLocaleString('en-US')} requests`}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Cost per day</h2>
        <Card>
          <CardContent>
            <TimeBarChart data={dailyCost} format="usd" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">By model</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium text-right">Requests</th>
                <th className="py-2 pr-4 font-medium text-right">Input tokens</th>
                <th className="py-2 pr-4 font-medium text-right">Output tokens</th>
                <th className="py-2 pr-4 font-medium text-right">Rate ($/1M in · out)</th>
                <th className="py-2 pr-4 font-medium text-right">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {models.map(([model, m]) => {
                const rate = groqRate(model)
                return (
                  <tr key={model} className="border-b last:border-0">
                    <td className="py-2 pr-4 pl-4 font-mono text-xs">{model}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{m.requests.toLocaleString('en-US')}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{m.input.toLocaleString('en-US')}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{m.output.toLocaleString('en-US')}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {rate.input.toFixed(2)} · {rate.output.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtUsd(m.cost)}</td>
                  </tr>
                )
              })}
              {models.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No usage recorded in the last {DAYS} days
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted-foreground">
          Rates live in lib/groq-pricing.ts ({Object.keys(GROQ_PRICING).length} models priced); unknown models bill
          at the highest known rate so estimates err high.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Top spenders</h2>
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
              {topSpenders.map(([userId, u]) => (
                <tr key={userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4">{emailById.get(userId) ?? userId}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{u.requests.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{u.tokens.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtUsd(u.cost)}</td>
                </tr>
              ))}
              {topSpenders.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No usage recorded in the last {DAYS} days
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
