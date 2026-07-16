import { revalidatePath } from 'next/cache'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { adminEnabled, getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { getAdminPlaidClient } from '@/lib/plaid'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AdminStat } from '../admin-stat'
import { DeleteUserButton } from './delete-user-button'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

async function setUserStatus(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('Admin hub is disabled')

  const userId = String(formData.get('userId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!userId || !['pending', 'active', 'blocked'].includes(status)) return

  const supabase = createAdminClientFor(await getAdminEnv())
  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId)
  if (error) throw new Error(`Failed to update status: ${error.message}`)

  revalidatePath('/admin/users')
}

/** Permanently delete a user: invalidate their Plaid access tokens first,
 *  then remove the auth user — every user-owned table cascades from
 *  auth.users(id) on delete, so that wipes profile/accounts/transactions/etc. */
async function deleteUser(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('Admin hub is disabled')

  const userId = String(formData.get('userId') ?? '')
  if (!userId) return

  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)
  const plaidClient = getAdminPlaidClient(env)

  const { data: items } = await supabase
    .from('plaid_items')
    .select('access_token')
    .eq('user_id', userId)

  await Promise.all(
    (items ?? []).map((item) =>
      plaidClient.itemRemove({ access_token: item.access_token }).catch((e) =>
        console.warn('Plaid itemRemove failed during user deletion (continuing):', e)
      )
    )
  )

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Failed to delete user: ${error.message}`)

  revalidatePath('/admin/users')
}

export default async function AdminUsersPage() {
  const supabase = createAdminClientFor(await getAdminEnv())

  const [{ data: profiles, error }, { data: authData }] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, status, created_at'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (error) {
    return <p className="text-sm text-red-600">Failed to load users: {error.message}</p>
  }

  const lastSignIn = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null])
  )

  const order = { pending: 0, active: 1, blocked: 2 } as Record<string, number>
  const users = (profiles ?? []).sort(
    (a, b) =>
      (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
      +new Date(b.created_at) - +new Date(a.created_at)
  )
  const pendingCount = users.filter((u) => u.status === 'pending').length
  const activeCount = users.filter((u) => u.status === 'active').length
  const blockedCount = users.filter((u) => u.status === 'blocked').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">{users.length} total</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AdminStat label="Pending approval" value={String(pendingCount)} />
        <AdminStat label="Active" value={String(activeCount)} />
        <AdminStat label="Blocked" value={String(blockedCount)} />
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
                      <DeleteUserButton userId={u.id} email={u.email ?? u.id} action={deleteUser} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">No users yet</td>
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
