import { createAdminClient } from '@/lib/supabase-admin'

type Level = 'info' | 'warn' | 'error'

/** Persists a row to admin_events for the admin hub's Overview/Logs pages.
 *  Always uses the "live" service-role client so events land wherever the
 *  app is actually running, regardless of the admin hub's env toggle.
 *  Never throws — a logging failure must never break the caller. */
export async function logEvent(
  level: Level,
  source: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from('admin_events')
      .insert({ level, source, message, context: context ?? null })
    if (error) console.error('logEvent insert failed:', error.message)
  } catch (e) {
    console.error('logEvent failed:', e)
  }
}
