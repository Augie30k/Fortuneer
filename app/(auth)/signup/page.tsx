'use client'

import { createClient } from '@/lib/supabase-client'
import { useState, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { Check, Eye, EyeOff, Loader2, MailCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
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

const MIN_PASSWORD_LENGTH = 8

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const longEnough = password.length >= MIN_PASSWORD_LENGTH
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const canSubmit = email.trim().length > 0 && longEnough && passwordsMatch

  const handleSignup = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!longEnough) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Without this, the confirmation email falls back to the Supabase
      // project's Site URL (localhost in dev config) regardless of where the
      // user actually signed up.
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // Supabase still returns a 200 for an email that's already registered and
    // confirmed (to avoid leaking that via an error) — but leaves `identities`
    // empty, which is the documented way to detect it client-side.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('duplicate-email')
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <MailCheck className="mb-2 size-10 text-primary" />
          <CardTitle className="text-2xl font-semibold">Request sent</CardTitle>
          <CardDescription>
            Confirm your email via the link we sent to{' '}
            <span className="text-foreground">{email}</span>. An admin will then
            review your request — you&apos;ll have access as soon as it&apos;s approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Request access</CardTitle>
        <CardDescription>
          Fortuneer is invite-only for now — create an account and an admin will
          approve your access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error === 'duplicate-email' ? (
                <>
                  An account with this email already exists —{' '}
                  <Link href="/login" className="font-medium underline underline-offset-2">
                    sign in instead
                  </Link>
                  .
                </>
              ) : (
                error
              )}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <p
                className={cn(
                  'flex items-center gap-1 text-xs',
                  longEnough ? 'text-positive' : 'text-muted-foreground'
                )}
              >
                {longEnough ? <Check className="size-3" /> : <X className="size-3" />}
                At least {MIN_PASSWORD_LENGTH} characters
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
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
                  passwordsMatch ? 'text-positive' : 'text-destructive'
                )}
              >
                {passwordsMatch ? <Check className="size-3" /> : <X className="size-3" />}
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading || !canSubmit} className="h-10 w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Request Access'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
