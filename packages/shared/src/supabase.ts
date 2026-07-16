import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type { SupabaseClient }

export interface SharedSupabaseOptions {
  /** React Native passes AsyncStorage here; web can omit (defaults to localStorage). */
  storage?: {
    getItem: (key: string) => Promise<string | null> | string | null
    setItem: (key: string, value: string) => Promise<void> | void
    removeItem: (key: string) => Promise<void> | void
  }
}

/**
 * Platform-neutral Supabase client factory. Each app passes its own env
 * values (NEXT_PUBLIC_* on web, EXPO_PUBLIC_* on mobile) because bundlers
 * only inline their own prefix.
 */
export function createSupabaseClient(
  url: string,
  publishableKey: string,
  options: SharedSupabaseOptions = {}
): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: {
      storage: options.storage,
      autoRefreshToken: true,
      persistSession: true,
      // Mobile has no URL fragment to parse; web uses @supabase/ssr instead
      // of this factory for its browser client, so this is safe to disable.
      detectSessionInUrl: false,
    },
  })
}
