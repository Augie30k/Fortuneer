// Shared surface for Fortuneer apps (web + mobile).
//
// The web app's lib/ stays the single source of truth — this package
// re-exports the platform-neutral modules from it rather than copying them.
// Only modules with no Next.js/server dependencies belong here; the Groq
// calls themselves live in the web app's /api/vera route (mobile talks to
// that endpoint instead of holding a Groq key in the app binary).

export * from '../../../lib/types'
export * from '../../../lib/format'
export * from '../../../lib/vera-router'
export * from './supabase'
