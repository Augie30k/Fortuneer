import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'
import Sidebar from '@/components/Sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const initials = user.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-6">
        <Link
          href="/dashboard"
          className="font-serif text-xl font-bold tracking-widest transition-opacity hover:opacity-80"
        >
          <span className="text-foreground">FORT</span>
          <span className="text-primary">UNEER</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Avatar>
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-foreground">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <LogoutButton />
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div className="flex">
        <Sidebar />
        <main className="max-w-5xl flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
