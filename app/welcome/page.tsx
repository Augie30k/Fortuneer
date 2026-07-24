import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import WelcomeFlow from '@/components/onboarding/WelcomeFlow'

/** First-login personalization. The (dashboard) layout redirects here until
 *  the profile has onboarded_at set; once set, this page bounces straight
 *  back so it can't be revisited by accident. */
export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at, full_name, currency')
    .eq('id', user.id)
    .single()

  if (profile?.onboarded_at) redirect('/dashboard')

  return (
    <WelcomeFlow
      email={user.email ?? ''}
      initialName={profile?.full_name ?? ''}
      initialCurrency={profile?.currency ?? 'USD'}
    />
  )
}
