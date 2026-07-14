'use client'

import { createClient } from '@/lib/supabase-client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Moon, Sun } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
      setLoading(false)
    })
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const setTheme = (next: 'light' | 'dark') => {
    const isDark = next === 'dark'
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem('theme', next)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and preferences</p>
      </div>

      <div className="max-w-lg space-y-6">
        <SettingsSection title="Account">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Input id="email" disabled value={email ?? ''} />
            )}
            <p className="text-xs text-muted-foreground">
              Use “Forgot password?” on the sign-in page to change your password.
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title="Appearance">
          <div className="flex gap-2">
            <Button
              variant={dark ? 'outline' : 'default'}
              onClick={() => setTheme('light')}
              className="flex-1"
            >
              <Sun />
              Light
            </Button>
            <Button
              variant={dark ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
              className="flex-1"
            >
              <Moon />
              Dark
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection title="Danger zone">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => toast.error('Account deletion isn’t available yet — contact support')}
          >
            Delete account
          </Button>
          <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
        </SettingsSection>

        <p className="text-center text-xs text-muted-foreground">Fortuneer v0.2.0</p>
      </div>
    </div>
  )
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}
