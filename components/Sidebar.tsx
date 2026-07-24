'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChartPie,
  Gauge,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  Wallet,
  Receipt,
  PiggyBank,
  Repeat,
  Settings,
  Target,
  Telescope,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Logo from '@/components/Logo'
import LogoutButton from '@/components/LogoutButton'
import ThemeToggle from '@/components/ThemeToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/investments', label: 'Investments', icon: TrendingUp },
  { href: '/reports', label: 'Reports', icon: ChartPie },
  { href: '/projections', label: 'Projections', icon: Telescope },
]

const COLLAPSE_KEY = 'fortuneer.sidebar.collapsed'

/** Focus areas chosen at onboarding bubble to the top of the nav (right after
 *  Dashboard), in the order the user picked them; everything else keeps the
 *  default order. */
function orderedNavLinks(focusAreas: string[]) {
  if (focusAreas.length === 0) return NAV_LINKS
  const byKey = new Map(NAV_LINKS.map((l) => [l.href.slice(1), l]))
  const focused = focusAreas
    .map((k) => byKey.get(k))
    .filter((l): l is (typeof NAV_LINKS)[number] => l !== undefined)
  const rest = NAV_LINKS.slice(1).filter((l) => !focusAreas.includes(l.href.slice(1)))
  return [NAV_LINKS[0], ...focused, ...rest]
}

function UserMenu({
  email,
  preferredName,
  compact,
}: {
  email: string
  preferredName?: string | null
  compact?: boolean
}) {
  const initials = (preferredName?.trim() || email).slice(0, 2).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
          compact ? 'justify-center' : 'flex-1'
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <span className="min-w-0 flex-1 text-left">
            {preferredName && (
              <span className="block truncate text-xs font-medium text-foreground">
                {preferredName}
              </span>
            )}
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-foreground">
          {preferredName ? (
            <>
              <span className="block truncate font-medium">{preferredName}</span>
              <span className="block truncate text-xs text-muted-foreground">{email}</span>
            </>
          ) : (
            email
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/support">
            <LifeBuoy />
            Support
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LogoutButton />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && label}
    </Link>
  )
}

/** Client shell: owns sidebar collapse state so the content column can follow it */
export default function AppShell({
  email,
  preferredName,
  focusAreas = [],
  children,
}: {
  email: string
  preferredName?: string | null
  focusAreas?: string[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const navLinks = orderedNavLinks(focusAreas)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {}
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {}
  }

  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div
          className={cn(
            'flex items-center pt-5 pb-4',
            collapsed ? 'justify-center px-2' : 'justify-between px-5'
          )}
        >
          {!collapsed && (
            <Link href="/dashboard" className="transition-opacity hover:opacity-80">
              <Logo />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="text-muted-foreground"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>

        <nav className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
          {navLinks.map((link) => (
            <NavItem
              key={link.href}
              {...link}
              active={pathname === link.href}
              collapsed={collapsed}
            />
          ))}
          <NavItem
            href="/settings"
            label="Settings"
            icon={Settings}
            active={pathname === '/settings'}
            collapsed={collapsed}
          />
          <NavItem
            href="/support"
            label="Support"
            icon={LifeBuoy}
            active={pathname === '/support'}
            collapsed={collapsed}
          />
        </nav>

        <div
          className={cn(
            'flex items-center border-t border-border p-3',
            collapsed ? 'flex-col gap-2' : 'gap-1'
          )}
        >
          <UserMenu email={email} preferredName={preferredName} compact={collapsed} />
          <ThemeToggle />
        </div>
      </aside>

      <MobileHeader email={email} preferredName={preferredName} />

      <main
        className={cn(
          'transition-[padding] duration-200',
          collapsed ? 'md:pl-16' : 'md:pl-60'
        )}
      >
        <div className="mx-auto w-full max-w-screen-2xl p-4 pb-24 md:p-8 md:pb-12 lg:p-10">
          {children}
        </div>
      </main>

      <MobileTabBar focusAreas={focusAreas} />
    </div>
  )
}

export function MobileHeader({
  email,
  preferredName,
}: {
  email: string
  preferredName?: string | null
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/70 px-4 backdrop-blur-xl md:hidden">
      <Link href="/dashboard">
        <Logo />
      </Link>
      <div className="flex items-center">
        <ThemeToggle />
        <UserMenu email={email} preferredName={preferredName} />
      </div>
    </header>
  )
}

export function MobileTabBar({ focusAreas = [] }: { focusAreas?: string[] }) {
  const pathname = usePathname()
  // Dashboard, Accounts, Transactions, then the user's top focus areas
  // (defaulting to Budgets and Reports when none were chosen)
  const links = orderedNavLinks(focusAreas)
  const focused = links.filter((l) => focusAreas.includes(l.href.slice(1))).slice(0, 2)
  const tabs =
    focused.length > 0
      ? NAV_LINKS.slice(0, 3).concat(focused).slice(0, 5)
      : NAV_LINKS.slice(0, 4).concat(NAV_LINKS[7]) // Budgets + Reports default

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {tabs.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
            pathname === href ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Icon className="size-5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
