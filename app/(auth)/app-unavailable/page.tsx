import { redirect } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const dynamic = 'force-dynamic'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/** Shown when an admin flips the app-wide kill switch (Admin Hub → Controls)
 *  for this frontend. proxy.ts redirects here before any auth/status check
 *  runs, so it covers signed-out visitors too. */
export default function AppUnavailablePage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <Wrench className="mb-2 size-10 text-primary" />
        <CardTitle className="text-2xl font-semibold">Temporarily unavailable</CardTitle>
        <CardDescription>
          Fortuneer is offline for maintenance right now. Please check back shortly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
