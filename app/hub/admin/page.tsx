import Link from 'next/link'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HubStat } from '../hub-stat'
import { setUserStatus } from './user-actions'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: profiles }, { data: openTickets }] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, status, created_at').order('created_at', { ascending: false }),
    supabase
      .from('support_requests')
      .select('id, user_id, kind, subject, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const users = profiles ?? []
  const pending = users.filter((u) => u.status === 'pending')
  const newThisWeek = users.filter((u) => u.created_at >= weekAgo).length
  const emailById = new Map(users.map((u) => [u.id, u.email ?? u.id]))
  const recentSignups = users.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">People, approvals, and messages — {env}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HubStat label="Total users" value={String(users.length)} />
        <HubStat label="Pending approval" value={String(pending.length)} />
        <HubStat label="Open tickets" value={String((openTickets ?? []).length)} />
        <HubStat label="New this week" value={String(newThisWeek)} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Approval queue</h2>
          <Link href="/hub/admin/users" className="text-xs text-muted-foreground underline underline-offset-4">
            All users
          </Link>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Signed up</th>
                <th className="py-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4">{u.email ?? '—'}</td>
                  <td className="py-2 pr-4">{u.full_name ?? '—'}</td>
                  <td className="py-2 pr-4">{formatDate(u.created_at)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <QueueButton userId={u.id} status="active" label="Approve" />
                      <QueueButton userId={u.id} status="blocked" label="Deny" />
                    </div>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No signups waiting for approval
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted-foreground">Approving sends the welcome email before the status flips.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Open tickets</h2>
          <Link href="/hub/admin/support" className="text-xs text-muted-foreground underline underline-offset-4">
            All tickets
          </Link>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 pl-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Subject</th>
              </tr>
            </thead>
            <tbody>
              {(openTickets ?? []).map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="py-2 pr-4">{emailById.get(r.user_id) ?? r.user_id}</td>
                  <td className="py-2 pr-4 capitalize">{r.kind}</td>
                  <td className="py-2 pr-4">
                    <Link href="/hub/admin/support" className="underline-offset-4 hover:underline">
                      {r.subject}
                    </Link>
                  </td>
                </tr>
              ))}
              {(openTickets ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">No open tickets</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent signups</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {recentSignups.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4">{u.email ?? '—'}</td>
                  <td className="py-2 pr-4">{u.full_name ?? '—'}</td>
                  <td className="py-2 pr-4 capitalize text-muted-foreground">{u.status}</td>
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{formatDate(u.created_at)}</td>
                </tr>
              ))}
              {recentSignups.length === 0 && (
                <tr>
                  <td className="py-6 pl-4 text-center text-muted-foreground">No users yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

function QueueButton({ userId, status, label }: { userId: string; status: string; label: string }) {
  return (
    <form action={setUserStatus}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="outline" size="xs">
        {label}
      </Button>
    </form>
  )
}
