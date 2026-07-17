import type { AdminEnv } from '@/lib/supabase-admin'

/** The postmaster: hands out the "from" address for every kind of email the
 *  app sends, so each purpose gets its own sender identity instead of one
 *  global EMAIL_FROM env. Add a kind here (not a new env var) when a new
 *  email shows up. The domain must stay verified in Resend — any local part
 *  on it is sendable without further setup. */

const EMAIL_DOMAIN = 'fortuneer.app'
const DISPLAY_NAME = 'Fortuneer'

/** kind → local part of the address; keys double as the public API. */
const SENDERS = {
  welcome: 'welcome',
  support: 'support',
  broadcast: 'broadcast',
} as const

export type EmailKind = keyof typeof SENDERS

/** e.g. fromAddress('welcome') → "Fortuneer <welcome@fortuneer.app>";
 *  against dev the local part is prefixed ("dev.welcome@…") so test sends
 *  are unmistakable in a real inbox. */
export function fromAddress(kind: EmailKind, env: AdminEnv = 'production'): string {
  const local = env === 'development' ? `dev.${SENDERS[kind]}` : SENDERS[kind]
  return `${DISPLAY_NAME} <${local}@${EMAIL_DOMAIN}>`
}
