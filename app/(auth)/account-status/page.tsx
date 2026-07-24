import { redirect } from 'next/navigation'
import { Clock, ShieldOff, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'


export const dynamic = 'force-dynamic'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

async function sendMessage(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const message = String(formData.get('message') ?? '').trim().slice(0, 2000)
  if (message) {
    await supabase.from('support_requests').insert({
      user_id: user.id,
      kind: 'support',
      subject: 'Account status inquiry',
      message,
    })
  }
  redirect('/account-status?sent=1')
}

export default async function AccountStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single()
  // Mirrors proxy.ts: only a missing status column (pre-migration-019) fails
  // open — a missing row or other error keeps the user on this page rather
  // than bouncing them into the dashboard.
  const statusColumnMissing = profileError?.code === '42703'
  const status = statusColumnMissing ? 'active' : (profile?.status ?? 'pending')
  if (status === 'active') redirect('/dashboard')

  const sent = (await searchParams).sent === '1'
  const pending = status === 'pending'

  return (
    <Card>
      <CardHeader className="items-center text-center">
        {pending ? (
          <Clock className="mb-2 size-10 text-primary" />
        ) : (
          <ShieldOff className="mb-2 size-10 text-destructive" />
        )}
        <CardTitle className="text-2xl font-semibold">
          {pending ? 'Awaiting approval' : 'Account blocked'}
        </CardTitle>
        <CardDescription>
          {pending
            ? 'Your access request is in — an admin needs to approve your account before you can use Fortuneer. Check back soon.'
            : 'Your account has been blocked by an admin. If you think this is a mistake, send a message below.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3 py-2 text-sm">
            <Check className="size-4 text-positive" /> Message sent to the admin.
          </p>
        ) : (
          <form action={sendMessage} className="space-y-2">
            <Label htmlFor="message">Message the admin (optional)</Label>
            <textarea
              id="message"
              name="message"
              rows={3}
              maxLength={2000}
              placeholder={pending ? 'Anything the admin should know about your request…' : 'Why you think this is a mistake…'}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" variant="outline" className="w-full">
              Send message
            </Button>
          </form>
        )}

        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
