import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/Sidebar'
import VeraChat from '@/components/vera/VeraChat'
import { PersonalizationProvider } from '@/components/personalization'
import type { Persona } from '@/lib/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('preferred_name, full_name, persona, focus_areas, onboarded_at')
    .eq('id', user.id)
    .single()

  // First sign-in: personalize before the app renders. Anything can be
  // skipped there; onboarded_at is set either way so this fires exactly once.
  // A missing/errored profile is treated as not-yet-onboarded rather than
  // silently skipped, so a lookup hiccup can't let a new user bypass this.
  const statusColumnsMissing = profileError?.code === '42703'
  if (!statusColumnsMissing && !profile?.onboarded_at) redirect('/welcome')

  const personalization = {
    preferredName: profile?.preferred_name ?? profile?.full_name ?? null,
    persona: (profile?.persona ?? null) as Persona | null,
    focusAreas: profile?.focus_areas ?? [],
  }

  return (
    <PersonalizationProvider value={personalization}>
      <AppShell
        email={user.email ?? ''}
        preferredName={personalization.preferredName}
        focusAreas={personalization.focusAreas}
      >
        {children}
        <VeraChat />
      </AppShell>
    </PersonalizationProvider>
  )
}
