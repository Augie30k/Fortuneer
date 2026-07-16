import { notFound } from 'next/navigation'
import { adminEnabled } from '@/lib/admin'
import { AdminNav } from './admin-nav'
import { EnvSwitcher } from './env-switcher'

// The ADMIN_SECRET/VERCEL check must run per request, never be baked in at build time
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!adminEnabled()) notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-6 border-b px-6 py-3">
        <span className="font-semibold">Fortuneer Admin</span>
        <AdminNav />
        <EnvSwitcher />
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  )
}
