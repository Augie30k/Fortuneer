import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { TERMS_VERSION, hasAcceptedCurrentTerms } from '@/lib/terms'
import TermsContent from '@/components/legal/TermsContent'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/** Acceptance gate: the proxy sends any signed-in user here until their
 *  profile records acceptance of the current TERMS_VERSION — both existing
 *  users who predate the terms and everyone whenever the version bumps. */

async function acceptTerms() {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('profiles')
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    })
    .eq('id', user.id)

  redirect('/dashboard')
}

async function declineAndSignOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function AcceptTermsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at, terms_version')
    .eq('id', user.id)
    .single()

  if (profile && hasAcceptedCurrentTerms(profile)) redirect('/dashboard')

  const isUpdate = Boolean(profile?.terms_accepted_at)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <p className="mb-6 rounded-lg border border-border bg-accent/50 px-4 py-3 text-sm text-foreground/90">
          {isUpdate
            ? 'Our Terms & Conditions have been updated. Please review and accept the new version to keep using Fortuneer.'
            : 'Before you continue, please review and accept the Terms & Conditions.'}
        </p>

        <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border p-5">
          <TermsContent />
        </div>

        <div className="mt-6 space-y-3">
          <form action={acceptTerms}>
            <Button type="submit" className="h-10 w-full">
              I agree to the Terms &amp; Conditions
            </Button>
          </form>
          <form action={declineAndSignOut}>
            <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
              Decline and sign out
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            By clicking &ldquo;I agree&rdquo; you accept version {TERMS_VERSION} of the Terms.
            Declining signs you out — you can accept later to regain access.
          </p>
        </div>
      </div>
    </div>
  )
}
