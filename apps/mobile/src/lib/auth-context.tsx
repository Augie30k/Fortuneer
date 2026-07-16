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
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  loading: boolean
  blocked: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, blocked: false })

/** Mobile's app-wide/account block gate. There's no server middleware on
 *  this side (the mobile app talks to Supabase directly via RLS for
 *  everything but Vera) so this mirrors proxy.ts's status check by hand:
 *  read profile status + the admin_flags 'app_disabled_mobile' kill switch,
 *  and treat either as blocked. Fails open on any query error. */
async function checkBlocked(userId: string): Promise<boolean> {
  try {
    const [{ data: profile }, { data: flag }] = await Promise.all([
      supabase.from('profiles').select('status').eq('id', userId).maybeSingle(),
      supabase.from('admin_flags').select('enabled').eq('key', 'app_disabled_mobile').maybeSingle(),
    ])
    return profile?.status === 'blocked' || flag?.enabled === true
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)

  const refreshBlocked = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setBlocked(false)
      return
    }
    setBlocked(await checkBlocked(userId))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await refreshBlocked(data.session?.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      refreshBlocked(next?.user.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [refreshBlocked])

  // Re-check on foreground so an admin flipping a kill switch mid-session
  // takes effect the next time the user opens the app, not just next login.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session?.user.id) refreshBlocked(session.user.id)
    })
    return () => sub.remove()
  }, [session?.user.id, refreshBlocked])

  return (
    <AuthContext.Provider value={{ session, loading, blocked }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
