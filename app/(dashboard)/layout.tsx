import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#07071A]">
      <nav className="border-b border-white/10 bg-[#0D0B28] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <a href="/dashboard" className="font-bold text-xl tracking-widest hover:opacity-80 transition-opacity">
          <span className="text-[#EEE8F5]">FORT</span>
          <span className="text-[#FCD34D]">UNEER</span>
        </a>
        <div className="flex items-center gap-4">
          <span className="text-[#8B8BA8] text-sm">{user.email}</span>
          <LogoutButton />
        </div>
      </nav>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 max-w-5xl">{children}</main>
      </div>
    </div>
  )
}