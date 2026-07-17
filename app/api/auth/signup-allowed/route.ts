import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/** Pre-signup quarantine check, so a barred address gets a clear message
 *  instead of a raw database error. Reachable signed-out by design. Fails
 *  open on any error — the reject_quarantined_email trigger on auth.users
 *  (migration 022) is the actual enforcement and can't be skipped. */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ allowed: true })
    }

    const { data } = await createAdminClient()
      .from('quarantined_emails')
      .select('email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    return NextResponse.json({ allowed: !data })
  } catch {
    return NextResponse.json({ allowed: true })
  }
}
