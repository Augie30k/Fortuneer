import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { adminEnabled } from '@/lib/admin'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = { support: 'Support', feature: 'Feature' }

async function setRequestStatus(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('Admin hub is disabled')

  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!id || !['open', 'closed'].includes(status)) return

  const supabase = createAdminClient()
  const { error } = await supabase.from('support_requests').update({ status }).eq('id', id)
  if (error) throw new Error(`Failed to update request: ${error.message}`)

  revalidatePath('/admin/support')
}

export default async function AdminSupportPage() {
  const supabase = createAdminClient()

  const [{ data: requests, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('support_requests')
      .select('id, user_id, kind, subject, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('id, email'),
  ])

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load requests: {error.message}
        {error.message.includes('support_requests') &&
          ' — has migration 020_support_requests.sql been applied?'}
      </p>
    )
  }

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email ?? p.id]))
  const all = requests ?? []
  const openCount = all.filter((r) => r.status === 'open').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Support</h1>
        <p className="text-sm text-muted-foreground">
          {all.length} requests · {openCount} open
        </p>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Request</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.id} className="border-b align-top">
              <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.created_at)}</td>
              <td className="py-2 pr-4">{emailById.get(r.user_id) ?? r.user_id}</td>
              <td className="py-2 pr-4">{KIND_LABEL[r.kind] ?? r.kind}</td>
              <td className="py-2 pr-4">
                <p className="font-medium">{r.subject}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.message}</p>
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    r.status === 'open'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {r.status}
                </span>
              </td>
              <td className="py-2">
                <form action={setRequestStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value={r.status === 'open' ? 'closed' : 'open'} />
                  <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-accent">
                    {r.status === 'open' ? 'Close' : 'Reopen'}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {all.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">No requests yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
