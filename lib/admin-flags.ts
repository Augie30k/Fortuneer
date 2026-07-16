import type { SupabaseClient } from '@supabase/supabase-js'

export type Client = 'web' | 'mobile'

/** Sent by the mobile app on requests that reach this Next.js app (currently
 *  just Vera, once wired up) so server code can tell it apart from a web
 *  request. Absent/anything else defaults to 'web'. */
export const FORTUNEER_CLIENT_HEADER = 'x-fortuneer-client'

export function clientFromHeader(value: string | null): Client {
  return value === 'mobile' ? 'mobile' : 'web'
}

/** Reads one row from admin_flags. Fails open (returns false) on any error —
 *  a missing table/row or a transient query failure must never lock
 *  everyone out, mirroring the fail-open status check in proxy.ts. */
export async function getFlag(
  supabase: SupabaseClient,
  key: string
): Promise<boolean> {
  try {
    const { data } = await supabase.from('admin_flags').select('enabled').eq('key', key).maybeSingle()
    return data?.enabled ?? false
  } catch {
    return false
  }
}
