'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Monitor, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The Hub is split into three modes, each a self-contained workspace:
 *  Admin (people & messages), DevOps (troubleshooting), Analyst (numbers).
 *  The mode tabs live in the header row; each mode brings its own sub-nav. */
const MODES = [
  {
    key: 'admin',
    label: 'Admin',
    base: '/hub/admin',
    icon: Shield,
    links: [
      { href: '/hub/admin', label: 'Overview', exact: true },
      { href: '/hub/admin/users', label: 'Users' },
      { href: '/hub/admin/support', label: 'Support' },
      { href: '/hub/admin/broadcast', label: 'Broadcast' },
    ],
  },
  {
    key: 'devops',
    label: 'DevOps',
    base: '/hub/devops',
    icon: Monitor,
    links: [
      { href: '/hub/devops', label: 'Diagnostics', exact: true },
      { href: '/hub/devops/logs', label: 'Logs' },
      { href: '/hub/devops/controls', label: 'Controls' },
      { href: '/hub/devops/deployments', label: 'Deployments' },
    ],
  },
  {
    key: 'analyst',
    label: 'Analyst',
    base: '/hub/analyst',
    icon: TrendingUp,
    links: [
      { href: '/hub/analyst', label: 'Overview', exact: true },
      { href: '/hub/analyst/growth', label: 'Growth' },
      { href: '/hub/analyst/costs', label: 'Costs' },
      { href: '/hub/analyst/engagement', label: 'Engagement' },
    ],
  },
]

function activeMode(pathname: string) {
  return MODES.find((m) => pathname.startsWith(m.base)) ?? MODES[0]
}

export function HubModeTabs() {
  const pathname = usePathname()
  const current = activeMode(pathname)

  return (
    <nav className="flex gap-1 rounded-lg border p-1 text-sm">
      {MODES.map((m) => {
        const Icon = m.icon
        const active = m.key === current.key
        return (
          <Link
            key={m.key}
            href={m.base}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="size-3.5" />
            {m.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function HubSubNav() {
  const pathname = usePathname()
  const current = activeMode(pathname)

  return (
    <nav className="flex gap-1 text-sm">
      {current.links.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-lg px-3 py-1 font-medium transition-colors',
              active
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
