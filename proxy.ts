import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { clientFromHeader, getFlag, FORTUNEER_CLIENT_HEADER } from '@/lib/admin-flags'

export async function proxy(request: NextRequest) {
  // Local-only admin hub: invisible on Vercel or when ADMIN_SECRET is unset,
  // and exempt from the Supabase login redirect below.
  if (request.nextUrl.pathname.startsWith('/admin')) {
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

  const pathname = request.nextUrl.pathname
  const isApi = pathname.startsWith('/api')

  // App-wide kill switch, checked before auth so it also covers logged-out
  // paths (login/signup) — a maintenance message beats a login screen that
  // silently can't do anything useful. Scoped by frontend type: mobile sends
  // FORTUNEER_CLIENT_HEADER on the requests that reach this app (Vera); web
  // requests have no header and default to 'web'. Fails open on query error.
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

  const pathname = request.nextUrl.pathname
  const isApi = pathname.startsWith('/api')

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
  // sign-out. Fails open if the status column is missing (pre-migration-019).
  if (user && pathname !== '/api/auth/logout') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()
    const status = profile?.status ?? 'active'

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
    '/settings/:path*',
    '/vera/:path*',
    '/support/:path*',
    '/api/:path*',
    '/admin/:path*',
  ],
}