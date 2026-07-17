'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClientFor } from '@/lib/supabase-admin'
import { adminEnabled, getAdminEnv, getAdminSiteUrl } from '@/lib/admin'
import { getAdminPlaidClient } from '@/lib/plaid'
import { logEvent } from '@/lib/admin-log'
import { resend } from '@/lib/resend'
import { fromAddress } from '@/lib/postmaster'
import WelcomeEmail from '@/emails/welcome-email'

/** User-status actions shared by the Admin overview (pending queue) and the
 *  Users page — both render approve/deny/block buttons against the same flow. */

function revalidateUsers() {
  revalidatePath('/hub/admin')
  revalidatePath('/hub/admin/users')
}

/** Approving a pending user (pending -> active) sends a branded welcome
 *  email. The send is gated *before* the status write: if it fails, we throw
 *  and never touch the DB, so a user can never end up "active" without
 *  actually having been notified. Other transitions (deny, block, reactivate
 *  a blocked user) don't involve email and go straight to the update. */
export async function setUserStatus(formData: FormData) {
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const userId = String(formData.get('userId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!userId || !['pending', 'active', 'blocked'].includes(status)) return

  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)

  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('status, email, full_name')
    .eq('id', userId)
    .single()
  if (fetchError) throw new Error(`Failed to load user: ${fetchError.message}`)

  const isApproval = profile.status === 'pending' && status === 'active'
  if (isApproval) {
    if (!profile.email) throw new Error('Cannot approve: user has no email on file')

    try {
      const { error: sendError } = await resend.emails.send({
        from: fromAddress('welcome', env),
        to: profile.email,
        subject: "Welcome to Fortuneer — you're approved",
        react: (
          <WelcomeEmail
            fullName={profile.full_name}
            loginUrl={getAdminSiteUrl(env)}
          />
        ),
      })
      if (sendError) throw new Error(sendError.message)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await logEvent('error', 'admin.setUserStatus', `Welcome email failed, approval aborted: ${message}`, { userId })
      throw new Error(`Failed to send welcome email — user was NOT approved: ${message}`)
    }
  }

  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId)
  if (error) {
    if (isApproval) {
      // Email already went out but the DB write failed — flag it so an
      // admin can reconcile manually instead of the user silently staying
      // "pending" despite having a welcome email in their inbox.
      await logEvent('error', 'admin.setUserStatus', `Welcome email sent but status update failed: ${error.message}`, { userId })
    }
    throw new Error(`Failed to update status: ${error.message}`)
  }

  revalidateUsers()
}

export async function setUserVeraBlocked(formData: FormData) {
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const userId = String(formData.get('userId') ?? '')
  const blocked = formData.get('blocked') === 'true'
  if (!userId) return

  const supabase = createAdminClientFor(await getAdminEnv())
  const { error } = await supabase.from('profiles').update({ vera_blocked: blocked }).eq('id', userId)
  if (error) throw new Error(`Failed to update Vera access: ${error.message}`)

  revalidateUsers()
}

/** Permanently delete a user: invalidate their Plaid access tokens first,
 *  then remove the auth user — every user-owned table cascades from
 *  auth.users(id) on delete, so that wipes profile/accounts/transactions/etc. */
export async function deleteUser(formData: FormData) {
  if (!adminEnabled()) throw new Error('The Hub is disabled')

  const userId = String(formData.get('userId') ?? '')
  if (!userId) return

  const env = await getAdminEnv()
  const supabase = createAdminClientFor(env)
  const plaidClient = getAdminPlaidClient(env)

  const { data: items } = await supabase
    .from('plaid_items')
    .select('access_token')
    .eq('user_id', userId)

  await Promise.all(
    (items ?? []).map((item) =>
      plaidClient.itemRemove({ access_token: item.access_token }).catch(async (e) => {
        console.warn('Plaid itemRemove failed during user deletion (continuing):', e)
        await logEvent('warn', 'admin.deleteUser', `Plaid itemRemove failed: ${e instanceof Error ? e.message : e}`, {
          userId,
        })
      })
    )
  )

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Failed to delete user: ${error.message}`)

  revalidateUsers()
}
