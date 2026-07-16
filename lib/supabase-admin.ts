import { createClient } from '@supabase/supabase-js'

export type AdminEnv = 'development' | 'production'

/** Service-role client for privileged operations (e.g. deleting an auth user).
 *  Never expose this to the browser — server-only, bypasses RLS entirely.
 *  Always targets whichever Supabase project is "live" in .env.local — used
 *  by real user-facing routes (account deletion, the Plaid webhook), which
 *  must never depend on the admin hub's environment toggle below. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Service-role client for the /admin hub, which needs to reach dev and prod
 *  Supabase at once regardless of which project is "live" for the app itself
 *  — backed by its own always-uncommented ADMIN_DEV_ / ADMIN_PROD_ pair. */
export function createAdminClientFor(env: AdminEnv) {
  const url = env === 'production' ? process.env.ADMIN_PROD_SUPABASE_URL : process.env.ADMIN_DEV_SUPABASE_URL
  const key = env === 'production' ? process.env.ADMIN_PROD_SUPABASE_SECRET_KEY : process.env.ADMIN_DEV_SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error(
      `Missing ADMIN_${env === 'production' ? 'PROD' : 'DEV'}_SUPABASE_URL/SECRET_KEY in .env.local`
    )
  }

  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
