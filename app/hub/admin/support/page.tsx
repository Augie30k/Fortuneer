import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { adminEnabled, getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { resend } from '@/lib/resend'
import { fromAddress } from '@/lib/postmaster'
import SupportReplyEmail from '@/emails/support-reply-email'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HubStat } from '../../hub-stat'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = { support: 'Support', feature: 'Feature' }
const STATUS_FILTERS = ['all', 'open', 'closed'] as const

async function setRequestStatus(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!id || !['open', 'closed'].includes(status)) return

  const supabase = createAdminClientFor(await getAdminEnv())
  const { error } = await supabase.from('support_requests').update({ status }).eq('id', id)
  if (error) throw new Error(`Failed to update request: ${error.message}`)

  revalidatePath('/hub/admin/support')
  revalidatePath('/hub/admin')
}

/** Answer a ticket straight from the hub: sends a branded reply email to the
 *  requester and (by default) closes the ticket in the same step. The email
 *  send is gated before the status write, mirroring the approval flow. */
async function sendSupportReply(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const id = String(formData.get('id') ?? '')
  const reply = String(formData.get('reply') ?? '').trim()
  const close = formData.get('close') === 'on'
  if (!id || !reply) return

  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)

  const { data: ticket, error: ticketError } = await supabase
    .from('support_requests')
    .select('id, user_id, subject, message, status')
    .eq('id', id)
    .single()
  if (ticketError) throw new Error(`Failed to load ticket: ${ticketError.message}`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', ticket.user_id)
    .single()
  if (!profile?.email) throw new Error('Cannot reply: user has no email on file')

  const { error: sendError } = await resend.emails.send({
    from: fromAddress('support', env),
    to: profile.email,
    subject: `Re: ${ticket.subject}`,
    react: (
      <SupportReplyEmail
        fullName={profile.full_name}
        ticketSubject={ticket.subject}
        replyBody={reply}
        originalMessage={ticket.message}
      />
    ),
  })
  if (sendError) throw new Error(`Failed to send reply: ${sendError.message}`)

  if (close && ticket.status === 'open') {
    const { error } = await supabase.from('support_requests').update({ status: 'closed' }).eq('id', id)
    if (error) throw new Error(`Reply sent but closing the ticket failed: ${error.message}`)
  }

  await supabase.from('admin_events').insert({
    level: 'info',
    source: 'hub.supportReply',
    message: `Replied to "${ticket.subject}" (${profile.email})`,
    context: { ticketId: id, closed: close },
  })

  revalidatePath('/hub/admin/support')
  revalidatePath('/hub/admin')
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusFilter = 'all' } = await searchParams
  const supabase = createAdminClientFor(await getAdminEnv())

  const [{ data: requests, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('support_requests')
      .select('id, user_id, kind, subject, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('id, email, full_name'),
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

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const all = requests ?? []
  const openCount = all.filter((r) => r.status === 'open').length
  const tickets = statusFilter === 'all' ? all : all.filter((r) => r.status === statusFilter)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Support</h1>
        <p className="text-sm text-muted-foreground">{all.length} requests</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HubStat label="Open" value={String(openCount)} />
        <HubStat label="Closed" value={String(all.length - openCount)} />
      </div>

      <div className="flex gap-1 rounded-lg border p-1 self-start w-fit">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={{ pathname: '/hub/admin/support', query: s === 'all' ? {} : { status: s } }}
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

      <div className="space-y-3">
        {tickets.map((r) => {
          const profile = profileById.get(r.user_id)
          const email = profile?.email
          return (
            <Card key={r.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {email ?? r.user_id} · {KIND_LABEL[r.kind] ?? r.kind} · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'open'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      {r.status}
                    </span>
                    <form action={setRequestStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={r.status === 'open' ? 'closed' : 'open'} />
                      <Button type="submit" variant="outline" size="xs">
                        {r.status === 'open' ? 'Close' : 'Reopen'}
                      </Button>
                    </form>
                  </div>
                </div>

                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.message}</p>

                {email && (
                  <details className="rounded-lg border">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      Reply by email
                    </summary>
                    <form action={sendSupportReply} className="space-y-3 border-t p-3">
                      <input type="hidden" name="id" value={r.id} />
                      <textarea
                        name="reply"
                        required
                        rows={4}
                        placeholder={`Write a reply to ${email}…`}
                        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input type="checkbox" name="close" defaultChecked={r.status === 'open'} />
                          Close ticket after sending
                        </label>
                        <Button type="submit" variant="outline" size="xs">
                          Send reply
                        </Button>
                      </div>
                    </form>
                  </details>
                )}
              </CardContent>
            </Card>
          )
        })}
        {tickets.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {all.length === 0 ? 'No requests yet' : `No ${statusFilter} requests`}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
