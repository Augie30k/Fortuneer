import { revalidatePath } from 'next/cache'
import { render } from '@react-email/render'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { adminEnabled, getAdminEnv } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { resend } from '@/lib/resend'
import { fromAddress } from '@/lib/postmaster'
import BroadcastEmail from '@/emails/broadcast-email'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HubStat } from '../../hub-stat'

export const dynamic = 'force-dynamic'

/** One announcement email to every active user (or a test copy to a single
 *  address first). Both paths share the compose form; the all-users path
 *  additionally requires the explicit confirmation checkbox — nothing is
 *  sent to real users on a bare button press. */
async function sendBroadcast(formData: FormData) {
  'use server'
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const mode = formData.get('mode') === 'all' ? 'all' : 'test'
  if (!subject || !body) throw new Error('Subject and message are both required')

  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)

  const email = <BroadcastEmail subject={subject} body={body} />
  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })])
  const from = fromAddress('broadcast', env)

  if (mode === 'test') {
    const to = String(formData.get('testEmail') ?? '').trim()
    if (!to) throw new Error('Enter a test address to send the test to')

    const { error } = await resend.emails.send({ from, to, subject, html, text })
    if (error) throw new Error(`Test send failed: ${error.message}`)
  } else {
    if (formData.get('confirm') !== 'on') {
      throw new Error('Check the confirmation box before sending to all users')
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('email')
      .eq('status', 'active')
      .not('email', 'is', null)
    if (profilesError) throw new Error(`Failed to load recipients: ${profilesError.message}`)

    const recipients = (profiles ?? []).map((p) => p.email as string)
    if (recipients.length === 0) throw new Error('No active users with an email on file')

    // Resend's batch endpoint caps at 100 emails per call
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100)
      const { error } = await resend.batch.send(chunk.map((to) => ({ from, to, subject, html, text })))
      if (error) {
        throw new Error(`Broadcast failed after ${i} of ${recipients.length} emails: ${error.message}`)
      }
    }

    await supabase.from('admin_events').insert({
      level: 'info',
      source: 'hub.broadcast',
      message: `Broadcast "${subject}" sent to ${recipients.length} active users`,
      context: { subject, recipients: recipients.length },
    })
  }

  revalidatePath('/hub/admin/broadcast')
}

export default async function AdminBroadcastPage() {
  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)

  const [{ data: profiles }, { data: history }] = await Promise.all([
    supabase.from('profiles').select('email').eq('status', 'active').not('email', 'is', null),
    supabase
      .from('admin_events')
      .select('id, message, created_at')
      .eq('source', 'hub.broadcast')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const recipientCount = (profiles ?? []).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Broadcast</h1>
        <p className="text-sm text-muted-foreground">
          Email every active user — product updates, downtime notices. Sends from {fromAddress('broadcast', env)} against {env}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HubStat label="Recipients" value={String(recipientCount)} hint="Active users with an email" />
        <HubStat label="Broadcasts sent" value={String((history ?? []).length)} hint="Recorded in this environment" />
      </div>

      <Card>
        <CardContent>
          <form action={sendBroadcast} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="broadcast-subject" className="text-sm font-medium">Subject</label>
              <Input id="broadcast-subject" name="subject" required placeholder="What's new in Fortuneer" />
            </div>
            <div className="space-y-1">
              <label htmlFor="broadcast-body" className="text-sm font-medium">Message</label>
              <textarea
                id="broadcast-body"
                name="body"
                required
                rows={8}
                placeholder={'Plain text — blank lines become paragraphs.'}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <Input name="testEmail" type="email" placeholder="you@example.com" className="h-8 w-56 text-sm" />
              <Button type="submit" name="mode" value="test" variant="outline" size="xs">
                Send test copy
              </Button>
              <p className="text-xs text-muted-foreground">Preview the email in a real inbox before the full send.</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" />
                <span>
                  Send to all <span className="font-semibold">{recipientCount}</span> active users — this emails real
                  people.
                </span>
              </label>
              <Button type="submit" name="mode" value="all" variant="destructive" size="xs">
                Send broadcast
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent broadcasts</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {(history ?? []).map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 pl-4 whitespace-nowrap text-muted-foreground">
                    {formatDate(h.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="py-2 pr-4">{h.message}</td>
                </tr>
              ))}
              {(history ?? []).length === 0 && (
                <tr>
                  <td className="py-6 pl-4 text-center text-muted-foreground">No broadcasts sent yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
