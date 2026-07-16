import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminEnabled } from '@/lib/admin'

// The ADMIN_SECRET/VERCEL check must run per request, never be baked in at build time
export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/usage', label: 'AI Usage' },
  { href: '/admin/deployments', label: 'Deployments' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!adminEnabled()) notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-3 flex items-center gap-6">
        <span className="font-semibold">Fortuneer Admin</span>
        <nav className="flex gap-4 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-xs text-muted-foreground">local only</span>
      </header>
      <main className="p-6 max-w-5xl">{children}</main>
    </div>
  )
}
