'use client'

import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MIN_PASSWORD_LENGTH, PASSWORD_REQUIREMENTS, isStrongPassword } from '@/lib/password'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Status = 'verifying' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('verifying')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let active = true

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) {
        setStatus('ready')
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session) setStatus('ready')
    })

    const timeout = setTimeout(() => {
      setStatus((current) => (current === 'verifying' ? 'invalid' : current))
    }, 4000)

    return () => {
      active = false
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase])

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!isStrongPassword(password)) {
      setError('Password does not meet the requirements below')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    toast.success('Password updated')
    router.push('/dashboard')
    router.refresh()
  }

  if (status === 'verifying') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'invalid') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Link expired</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Request a new link
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password.length > 0 && (
              <ul className="space-y-1">
                {PASSWORD_REQUIREMENTS.map((req) => {
                  const met = req.test(password)
                  return (
                    <li
                      key={req.key}
                      className={cn(
                        'flex items-center gap-1 text-xs',
                        met ? 'text-positive' : 'text-muted-foreground'
                      )}
                    >
                      {met ? <Check className="size-3" /> : <X className="size-3" />}
                      {req.label}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword.length > 0 && (
              <p
                className={cn(
                  'flex items-center gap-1 text-xs',
                  password === confirmPassword ? 'text-positive' : 'text-destructive'
                )}
              >
                {password === confirmPassword ? (
                  <Check className="size-3" />
                ) : (
                  <X className="size-3" />
                )}
                {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading} className="h-10 w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
