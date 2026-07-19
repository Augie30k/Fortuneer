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
export * from '../../../lib/dashboard-math'
export * from '../../../lib/reports-math'
export * from '../../../lib/recurring-math'
export * from '../../../lib/budget-math'
export * from '../../../lib/effective-budget'
export * from '../../../lib/budget-write'
export * from '../../../lib/goal-math'
export * from '../../../lib/goal-contributions'
export * from '../../../lib/goal-allocation'
export * from '../../../lib/goal-autosave'
export * from '../../../lib/accrue'
export * from './supabase'
