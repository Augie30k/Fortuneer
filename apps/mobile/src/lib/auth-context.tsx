import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { hasAcceptedCurrentTerms } from '@fortuneer/shared'
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  loading: boolean
  blocked: boolean
  /** Signed up but not yet approved by an admin — same gate as web's
   *  /account-status, distinct from a hard block. */
  pending: boolean
  /** Current Terms & Conditions version not yet accepted — the navigator
   *  shows only the terms screen until this clears. */
  termsPending: boolean
  /** Re-runs the block/terms check (used after accepting the terms). */
  refreshAccess: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  blocked: false,
  pending: false,
  termsPending: false,
  refreshAccess: async () => {},
})

/** Mobile's app-wide/account block + terms gate. There's no server middleware
 *  on this side (the mobile app talks to Supabase directly via RLS for
 *  everything but Vera) so this mirrors proxy.ts's checks by hand: read
 *  profile status + terms acceptance and the admin_flags
 *  'app_disabled_mobile' kill switch. Only a missing status column
 *  (pre-migration-019) fails open — any other query error fails closed as
 *  pending, so an unapproved account can never slip through on a bad read. */
async function checkAccess(userId: string): Promise<{ blocked: boolean; pending: boolean; termsPending: boolean }> {
  try {
    const [{ data: profile, error: profileError }, { data: flag }] = await Promise.all([
      supabase
        .from('profiles')
        .select('status, terms_accepted_at, terms_version')
        .eq('id', userId)
        .maybeSingle(),
      supabase.from('admin_flags').select('enabled').eq('key', 'app_disabled_mobile').maybeSingle(),
    ])
    const statusColumnMissing = profileError?.code === '42703'
    const status = statusColumnMissing ? 'active' : (profile?.status ?? 'pending')
    return {
      blocked: status === 'blocked' || flag?.enabled === true,
      pending: status === 'pending',
      termsPending: profile ? !hasAcceptedCurrentTerms(profile) : false,
    }
  } catch {
    // Total failure (e.g. offline) — matches the pre-existing fail-open
    // behavior for connectivity issues; the pending/blocked check above is
    // what actually enforces the approval gate when the query succeeds.
    return { blocked: false, pending: false, termsPending: false }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [pending, setPending] = useState(false)
  const [termsPending, setTermsPending] = useState(false)

  const refreshFor = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setBlocked(false)
      setPending(false)
      setTermsPending(false)
      return
    }
    const access = await checkAccess(userId)
    setBlocked(access.blocked)
    setPending(access.pending)
    setTermsPending(access.termsPending)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await refreshFor(data.session?.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      refreshFor(next?.user.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [refreshFor])

  // Re-check on foreground so an admin flipping a kill switch (or a terms
  // version bump) mid-session takes effect the next time the user opens the
  // app, not just next login.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session?.user.id) refreshFor(session.user.id)
    })
    return () => sub.remove()
  }, [session?.user.id, refreshFor])

  const refreshAccess = useCallback(
    () => refreshFor(session?.user.id),
    [session?.user.id, refreshFor]
  )

  return (
    <AuthContext.Provider value={{ session, loading, blocked, pending, termsPending, refreshAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
