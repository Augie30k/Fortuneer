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
]

const COLLAPSE_KEY = 'fortuneer.sidebar.collapsed'

function UserMenu({ email, compact }: { email: string; compact?: boolean }) {
  const initials = email.slice(0, 2).toUpperCase()
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
          <span className="min-w-0 truncate text-left text-xs text-muted-foreground">
            {email}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-foreground">
          {email}
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
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

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
          {NAV_LINKS.map((link) => (
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
          <UserMenu email={email} compact={collapsed} />
          <ThemeToggle />
        </div>
      </aside>

      <MobileHeader email={email} />

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

      <MobileTabBar />
    </div>
  )
}

export function MobileHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/70 px-4 backdrop-blur-xl md:hidden">
      <Link href="/dashboard">
        <Logo />
      </Link>
      <div className="flex items-center">
        <ThemeToggle />
        <UserMenu email={email} />
      </div>
    </header>
  )
}

const MOBILE_TABS = NAV_LINKS.slice(0, 4).concat(NAV_LINKS[7]) // Dashboard, Accounts, Transactions, Budgets, Reports

export function MobileTabBar() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {MOBILE_TABS.map(({ href, label, icon: Icon }) => (
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
