import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** GET /api/support — the user's own support questions / feature requests. */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('support_requests')
      .select('id, kind, subject, message, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ requests: data ?? [] })
  } catch (error) {
    console.error('Error fetching support requests:', error)
    return NextResponse.json({ error: 'Failed to fetch support requests' }, { status: 500 })
  }
}

/** POST /api/support — submit a support question or feature request to the admin. */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const kind = body.kind === 'feature' ? 'feature' : 'support'
    const subject = String(body.subject ?? '').trim().slice(0, 200)
    const message = String(body.message ?? '').trim().slice(0, 5000)

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('support_requests')
      .insert({ user_id: user.id, kind, subject, message })
      .select('id, kind, subject, message, status, created_at')
      .single()

    if (error) throw error
    return NextResponse.json({ request: data }, { status: 201 })
  } catch (error) {
    console.error('Error creating support request:', error)
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 })
  }
}
