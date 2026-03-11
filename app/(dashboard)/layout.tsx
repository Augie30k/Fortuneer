import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

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
      <nav className="border-b border-white/10 bg-[#0D0B28] px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-xl tracking-widest">
          <span className="text-[#EEE8F5]">FORT</span>
          <span className="text-[#FCD34D]">UNEER</span>
        </span>
        <span className="text-[#8B8BA8] text-sm">{user.email}</span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}