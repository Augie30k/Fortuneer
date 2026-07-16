/** The admin hub at /admin is local-only: it exists when ADMIN_SECRET is set
 *  and the app is not running on Vercel. proxy.ts 404s the routes; pages and
 *  server actions call this again as defense in depth. */
export function adminEnabled() {
  return !!process.env.ADMIN_SECRET && !process.env.VERCEL
}
