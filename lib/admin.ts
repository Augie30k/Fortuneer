import { cookies } from 'next/headers'
import type { AdminEnv } from '@/lib/supabase-admin'

/** The Hub at /hub is local-only: it exists when ADMIN_SECRET is set
 *  and the app is not running on Vercel. proxy.ts 404s the routes; pages and
 *  server actions call this again as defense in depth. */
export function adminEnabled() {
  return !!process.env.ADMIN_SECRET && !process.env.VERCEL
}

export const ADMIN_ENV_COOKIE = 'admin_env'

/** Which Supabase project (dev or prod) The Hub is currently pointed
 *  at — independent of which project the app itself is "live" on, so you
 *  can inspect prod data without reconfiguring/restarting the whole app.
 *  Persisted in a cookie set by the env-switcher in the hub header. */
export async function getAdminEnv(): Promise<AdminEnv> {
  const store = await cookies()
  return store.get(ADMIN_ENV_COOKIE)?.value === 'production' ? 'production' : 'development'
}

/** Public base URL to use for links in emails sent from The Hub (e.g.
 *  the welcome email's "go to your dashboard" link) — backed by its own
 *  always-uncommented ADMIN_DEV_SITE_URL / ADMIN_PROD_SITE_URL pair so it
 *  reflects whichever environment the approval was actually made against,
 *  independent of the app's own "live" SITE_URL. */
export function getAdminSiteUrl(env: AdminEnv): string {
  const url = env === 'production' ? process.env.ADMIN_PROD_SITE_URL : process.env.ADMIN_DEV_SITE_URL

  if (!url) {
    throw new Error(`Missing ADMIN_${env === 'production' ? 'PROD' : 'DEV'}_SITE_URL in .env.local`)
  }

  return url
}
