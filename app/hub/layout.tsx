import { notFound } from 'next/navigation'
import { adminEnabled } from '@/lib/admin'
import ThemeToggle from '@/components/ThemeToggle'
import { HubModeTabs, HubSubNav } from './hub-nav'
import { EnvSwitcher } from './env-switcher'

// The ADMIN_SECRET/VERCEL check must run per request, never be baked in at build time
export const dynamic = 'force-dynamic'

export default function HubLayout({ children }: { children: React.ReactNode }) {
  if (!adminEnabled()) notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="flex items-center gap-6 px-6 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">The Hub</span>
            <span className="text-xs text-muted-foreground">Fortuneer</span>
          </div>
          <HubModeTabs />
          <EnvSwitcher />
          <ThemeToggle />
        </div>
        <div className="px-6 pb-2">
          <HubSubNav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  )
}
