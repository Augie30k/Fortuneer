import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/** GET /api/vera/conversations/[id] — a conversation's messages, oldest first */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { data: messages, error } = await supabase
      .from('vera_messages')
      .select('id, role, parts')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) throw error

    return NextResponse.json({ messages: messages ?? [] })
  } catch (error) {
    console.error('Error fetching conversation messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
