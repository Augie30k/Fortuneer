import { Resend } from 'resend'

/** Server-only Resend client for transactional email (e.g. approval welcome
 *  email). RESEND_API_KEY must never be exposed to the browser. */
export const resend = new Resend(process.env.RESEND_API_KEY)
