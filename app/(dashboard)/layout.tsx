import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/Sidebar'
import VeraChat from '@/components/vera/VeraChat'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <AppShell email={user.email ?? ''}>
      {children}
      <VeraChat />
    </AppShell>
  )
}
