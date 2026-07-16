'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/usage', label: 'AI Usage' },
  { href: '/admin/deployments', label: 'Deployments' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 text-sm">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-lg px-3 py-1.5 font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
