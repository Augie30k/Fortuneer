import { createClient } from '@supabase/supabase-js'

/** Service-role client for privileged operations (e.g. deleting an auth user).
 *  Never expose this to the browser — server-only, bypasses RLS entirely. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
