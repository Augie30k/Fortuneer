import Link from 'next/link'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HubStat } from '../../hub-stat'
import { setUserStatus, setUserVeraBlocked, deleteUser } from '../user-actions'
import { DeleteUserButton } from './delete-user-button'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const STATUS_FILTERS = ['all', 'pending', 'active', 'blocked'] as const

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q = '', status: statusFilter = 'all' } = await searchParams
  const supabase = createAdminClientFor(await getAdminEnv())

  const [{ data: profiles, error }, { data: authData }] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, status, vera_blocked, created_at'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (error) {
    return <p className="text-sm text-red-600">Failed to load users: {error.message}</p>
  }

  const lastSignIn = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null])
  )

  const order = { pending: 0, active: 1, blocked: 2 } as Record<string, number>
  const all = (profiles ?? []).sort(
    (a, b) =>
      (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
      +new Date(b.created_at) - +new Date(a.created_at)
  )
  const pendingCount = all.filter((u) => u.status === 'pending').length
  const activeCount = all.filter((u) => u.status === 'active').length
  const blockedCount = all.filter((u) => u.status === 'blocked').length

  const needle = q.trim().toLowerCase()
  const users = all.filter(
    (u) =>
      (statusFilter === 'all' || u.status === statusFilter) &&
      (!needle ||
        (u.email ?? '').toLowerCase().includes(needle) ||
        (u.full_name ?? '').toLowerCase().includes(needle))
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          {users.length === all.length ? `${all.length} total` : `${users.length} of ${all.length}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <HubStat label="Pending approval" value={String(pendingCount)} />
        <HubStat label="Active" value={String(activeCount)} />
        <HubStat label="Blocked" value={String(blockedCount)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={{ pathname: '/hub/admin/users', query: { ...(q ? { q } : {}), ...(s === 'all' ? {} : { status: s }) } }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                statusFilter === s
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              {s}
            </Link>
          ))}
        </div>
        <form method="GET" className="flex items-center gap-2">
          {statusFilter !== 'all' && <input type="hidden" name="status" value={statusFilter} />}
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search email or name…"
            className="h-8 w-56 text-sm"
          />
          <Button type="submit" variant="outline" size="xs">
            Search
          </Button>
        </form>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 pl-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Signed up</th>
              <th className="py-2 pr-4 font-medium">Last sign-in</th>
              <th className="py-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const signIn = lastSignIn.get(u.id)
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4">{u.email ?? '—'}</td>
                  <td className="py-2 pr-4">{u.full_name ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[u.status] ?? ''}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{formatDate(u.created_at)}</td>
                  <td className="py-2 pr-4">{signIn ? formatDate(signIn) : 'never'}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      {u.status !== 'active' && (
                        <StatusButton userId={u.id} status="active" label={u.status === 'pending' ? 'Approve' : 'Reactivate'} />
                      )}
                      {u.status !== 'blocked' && (
                        <StatusButton userId={u.id} status="blocked" label={u.status === 'pending' ? 'Deny' : 'Block'} />
                      )}
                      <VeraToggleButton userId={u.id} blocked={u.vera_blocked} />
                      <DeleteUserButton userId={u.id} email={u.email ?? u.id} action={deleteUser} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  {all.length === 0 ? 'No users yet' : 'No users match this filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function StatusButton({ userId, status, label }: { userId: string; status: string; label: string }) {
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

function VeraToggleButton({ userId, blocked }: { userId: string; blocked: boolean }) {
  return (
    <form action={setUserVeraBlocked}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="blocked" value={String(!blocked)} />
      <Button type="submit" variant="outline" size="xs">
        {blocked ? 'Enable Vera' : 'Disable Vera'}
      </Button>
    </form>
  )
}
