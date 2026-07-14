import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS returns global (user_id null) + the user's own categories
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('is_income', { ascending: false })
      .order('name')

    if (error) throw error

    return NextResponse.json({ categories: categories ?? [] })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
