'use client'

import { createClient } from '@/lib/supabase-client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SettingsSection title="Account">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {loading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Input id="email" disabled value={email ?? ''} />
              )}
              <p className="text-xs text-muted-foreground">Contact support to change email</p>
            </div>
          </SettingsSection>

          <SettingsSection title="Preferences">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  defaultValue="USD"
                  onValueChange={() => toast.info('Currency preferences are coming soon')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SettingsSection>
        </div>

        <div className="space-y-6">
          <SettingsSection title="Danger Zone">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() =>
                toast.error('Account deletion isn’t available yet — contact support')
              }
            >
              Delete Account
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">This action cannot be undone</p>
          </SettingsSection>

          <SettingsSection title="App Version">
            <p>v0.1.0 (Beta)</p>
          </SettingsSection>
        </div>
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
        <CardTitle className="font-heading text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}
