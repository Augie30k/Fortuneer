import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { clientFromHeader, getFlag, FORTUNEER_CLIENT_HEADER } from '@/lib/admin-flags'
import { hasAcceptedCurrentTerms } from '@/lib/terms'

export async function proxy(request: NextRequest) {
  // Local-only Hub (and the old /admin URLs that redirect into it):
  // invisible on Vercel or when ADMIN_SECRET is unset, and exempt from the
  // Supabase login redirect below.
  if (request.nextUrl.pathname.startsWith('/hub') || request.nextUrl.pathname.startsWith('/admin')) {
    if (process.env.VERCEL || !process.env.ADMIN_SECRET) {
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // App-wide kill switch, checked before auth so it also covers logged-out
  // paths (login/signup) — a maintenance message beats a login screen that
  // silently can't do anything useful. Scoped by frontend type: mobile sends
  // FORTUNEER_CLIENT_HEADER on the requests that reach this app (Vera); web
  // requests have no header and default to 'web'. Fails open on query error.
  const pathname = request.nextUrl.pathname
  const isApi = pathname.startsWith('/api')

  const requestClient = clientFromHeader(request.headers.get(FORTUNEER_CLIENT_HEADER))
  if (await getFlag(supabase, `app_disabled_${requestClient}`)) {
    if (isApi) {
      return NextResponse.json({ error: 'Fortuneer is temporarily unavailable' }, { status: 503 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/app-unavailable'
    return NextResponse.redirect(url)
  }

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password']
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))

  if (!user && !isPublicPath) {
    // API routes return their own 401s — redirecting a fetch to /login
    // would hand JSON callers an HTML page
    if (isApi) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Access gate: signups start as 'pending' until the admin approves, and the
  // admin can block an account. Non-active users only get /account-status and
  // sign-out. Only a genuinely pre-migration-019 database (no status column
  // at all) fails open — a missing profile row or any other query error
  // fails closed (treated as pending) so an unapproved/deleted account can
  // never slip through on a bad read.
  if (user && pathname !== '/api/auth/logout') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status, terms_accepted_at, terms_version')
      .eq('id', user.id)
      .single()
    const statusColumnMissing = profileError?.code === '42703'
    const status = statusColumnMissing ? 'active' : (profile?.status ?? 'pending')

    if (status !== 'active') {
      if (isApi) {
        return NextResponse.json(
          { error: status === 'pending' ? 'Account pending approval' : 'Account blocked', status },
          { status: 403 }
        )
      }
      const url = request.nextUrl.clone()
      url.pathname = '/account-status'
      return NextResponse.redirect(url)
    }

    // Terms gate: every user must have accepted the current Terms version
    // (existing users, and everyone again when TERMS_VERSION bumps). Pages
    // only — API calls mid-session (and the mobile app's requests) keep
    // working; the gate catches the next navigation. Fails open if the terms
    // columns are missing (pre-migration-025 the select above errors and
    // profile is null).
    if (!isApi && profile && !hasAcceptedCurrentTerms(profile)) {
      const url = request.nextUrl.clone()
      url.pathname = '/terms/accept'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/accounts/:path*',
    '/transactions/:path*',
    '/budgets/:path*',
    '/goals/:path*',
    '/recurring/:path*',
    '/investments/:path*',
    '/reports/:path*',
    '/projections/:path*',
    '/welcome/:path*',
    '/settings/:path*',
    '/vera/:path*',
    '/support/:path*',
    '/api/:path*',
    '/admin/:path*',
    '/hub/:path*',
  ],
}