import Link from 'next/link'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HubStat } from '../../hub-stat'
import {
  setUserStatus,
  setUserVeraBlocked,
  denyUser,
  deleteUser,
  addQuarantinedEmail,
  removeQuarantinedEmail,
} from '../user-actions'
import { DenyUserDialog } from '../deny-user-dialog'
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

  const [{ data: profiles, error }, { data: authData }, { data: quarantined, error: quarantineError }] =
    await Promise.all([
      supabase.from('profiles').select('id, email, full_name, status, vera_blocked, created_at'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from('quarantined_emails').select('email, reason, created_at').order('created_at', { ascending: false }),
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
    <div className="space-y-6">
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

      <div className="space-y-3">
        {users.map((u) => {
          const signIn = lastSignIn.get(u.id)
          const displayName = u.full_name ?? u.email ?? 'Unknown user'
          const initial = (u.full_name ?? u.email ?? '?').trim().charAt(0).toUpperCase()
          return (
            <Card key={u.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email ?? u.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[u.status] ?? ''}`}>
                      {u.status}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        u.vera_blocked
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-secondary text-secondary-foreground'
                      )}
                    >
                      {u.vera_blocked ? 'Vera blocked' : 'Vera enabled'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Joined {formatDate(u.created_at)}</span>
                  <span>Last sign-in {signIn ? formatDate(signIn) : 'never'}</span>
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {u.status === 'pending' && (
                    <>
                      <StatusButton userId={u.id} status="active" label="Approve" primary />
                      <DenyUserDialog userId={u.id} email={u.email ?? u.id} action={denyUser} />
                    </>
                  )}
                  {u.status === 'active' && <StatusButton userId={u.id} status="blocked" label="Block" />}
                  {u.status === 'blocked' && <StatusButton userId={u.id} status="active" label="Reactivate" />}
                  <VeraToggleButton userId={u.id} blocked={u.vera_blocked} />
                  <DeleteUserButton userId={u.id} email={u.email ?? u.id} action={deleteUser} />
                </div>
              </CardContent>
            </Card>
          )
        })}
        {users.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {all.length === 0 ? 'No users yet' : 'No users match this filter'}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Quarantine</h2>
        <p className="text-xs text-muted-foreground">
          Quarantined emails can&apos;t be used to sign up — enforced in the signup flow and by a
          database trigger. Denying a request offers to quarantine automatically.
        </p>
        {quarantineError ? (
          <p className="text-sm text-red-600">
            Failed to load quarantine list: {quarantineError.message}
            {quarantineError.message.includes('quarantined_emails') &&
              ' — has migration 022_email_quarantine.sql been applied?'}
          </p>
        ) : (
          <Card>
            <CardContent className="space-y-3">
              <form action={addQuarantinedEmail} className="flex flex-wrap items-center gap-2">
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="someone@example.com"
                  className="h-8 w-64 text-sm"
                />
                <Button type="submit" variant="outline" size="xs">
                  Quarantine email
                </Button>
              </form>
              <div className="divide-y">
                {(quarantined ?? []).map((entry) => (
                  <div key={entry.email} className="flex flex-wrap items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.reason ?? '—'} · {formatDate(entry.created_at)}
                      </p>
                    </div>
                    <form action={removeQuarantinedEmail}>
                      <input type="hidden" name="email" value={entry.email} />
                      <Button type="submit" variant="outline" size="xs">
                        Remove
                      </Button>
                    </form>
                  </div>
                ))}
                {(quarantined ?? []).length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">No quarantined emails</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatusButton({
  userId,
  status,
  label,
  primary = false,
}: {
  userId: string
  status: string
  label: string
  primary?: boolean
}) {
  return (
    <form action={setUserStatus}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={primary ? 'default' : 'outline'} size="xs">
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
