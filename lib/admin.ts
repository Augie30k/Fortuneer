import { cookies } from 'next/headers'
import type { AdminEnv } from '@/lib/supabase-admin'

/** The admin hub at /admin is local-only: it exists when ADMIN_SECRET is set
 *  and the app is not running on Vercel. proxy.ts 404s the routes; pages and
 *  server actions call this again as defense in depth. */
export function adminEnabled() {
  return !!process.env.ADMIN_SECRET && !process.env.VERCEL
}

export const ADMIN_ENV_COOKIE = 'admin_env'

/** Which Supabase project (dev or prod) the admin hub is currently pointed
 *  at — independent of which project the app itself is "live" on, so you
 *  can inspect prod data without reconfiguring/restarting the whole app.
 *  Persisted in a cookie set by the env-switcher in the admin header. */
export async function getAdminEnv(): Promise<AdminEnv> {
  const store = await cookies()
  return store.get(ADMIN_ENV_COOKIE)?.value === 'production' ? 'production' : 'development'
}
