import { groq } from '@ai-sdk/groq'
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buildVeraTools } from '@/lib/vera-tools'
import { pickVeraModel, VERA_HISTORY_WINDOW, VERA_MAX_OUTPUT_TOKENS } from '@/lib/vera-router'

export const maxDuration = 60

const SYSTEM = `You are Vera, Fortuneer's in-app financial co-pilot. Today's date is {{DATE}}.

Personality: sharp, warm, direct — a friend who's actually good with money, not a corporate advisor reading a script. Real opinions grounded in the user's actual numbers, never vibes or platitudes. Encouraging without cheerleading; honest about bad news without being alarmist. Light wit is welcome, but substance always leads — never crack a joke instead of answering. Don't lecture about money you haven't looked at.

Capabilities: answer questions using your tools (budgets, spending, transactions, goals, accounts/net worth); take direct action (adjust budget amounts, create goals, record goal contributions); give practical, level-headed finance guidance. You're not a licensed advisor — defer investment/tax/legal specifics to a professional instead of prescribing.

Money convention: amount > 0 = expense (OUT), < 0 = income (IN). USD unless stated otherwise.

Rules:
- Look up real data before answering — never guess numbers.
- Budget changes are single-month by default; set apply_to_future_months only when the user clearly wants it ongoing ("from now on", "every month", "going forward").
- Confirm before large or ambiguous changes (clearing a budget to 0, changes over $2,000) — restate what you're about to do first.
- No deletions, ever — no transactions, budgets, goals, accounts, or rules. Redirect delete requests to the app; every change you make has an Undo button right here.
- After a change, confirm plainly what changed and that it's undoable.

Style: concise, plain sentences, whole dollars, short lists over tables. Personality lives in word choice, not length — don't over-explain.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Vera is not configured — add GROQ_API_KEY to the environment.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const messages: UIMessage[] = body.messages ?? []
    const conversationId: string | null =
      typeof body.conversationId === 'string' ? body.conversationId : null
    // A regenerate after a failure resends the same last user message —
    // it's already in history, so don't insert it twice
    const isRetry = body.isRetry === true

    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const lastUserTextPart = lastUser?.parts.find((p) => p.type === 'text')
    const lastUserText = lastUserTextPart && 'text' in lastUserTextPart ? lastUserTextPart.text : ''

    // History is persisted per conversation; verify ownership before writing
    let canPersist = false
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('vera_conversations')
        .select('id, title')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single()
      canPersist = !!conversation

      if (canPersist && lastUser && !isRetry) {
        await supabase.from('vera_messages').insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          parts: lastUser.parts,
        })
        if (conversation!.title === 'New chat' && lastUserText) {
          await supabase
            .from('vera_conversations')
            .update({ title: lastUserText.slice(0, 60) })
            .eq('id', conversationId)
            .eq('user_id', user.id)
        }
      }
    }

    // Cost/token routing: cheap+fast model for simple lookups and small
    // talk, the larger model for anything that looks like a financial
    // write or a long/deep-thread ask. See lib/vera-router.ts.
    const model = pickVeraModel(lastUserText, messages.length)

    const result = streamText({
      model: groq(model),
      system: SYSTEM.replace('{{DATE}}', new Date().toISOString().slice(0, 10)),
      messages: await convertToModelMessages(messages.slice(-VERA_HISTORY_WINDOW)),
      tools: buildVeraTools(supabase, user.id),
      stopWhen: stepCountIs(8),
      maxOutputTokens: VERA_MAX_OUTPUT_TOKENS,
      onFinish: async ({ totalUsage }) => {
        // Token accounting for the admin hub; never let it break a chat
        const { error } = await supabase.from('usage_log').insert({
          user_id: user.id,
          model,
          input_tokens: totalUsage.inputTokens ?? 0,
          output_tokens: totalUsage.outputTokens ?? 0,
        })
        if (error) console.error('usage_log insert failed:', error.message)
      },
    })

    return result.toUIMessageStreamResponse({
      onFinish: async ({ responseMessage }) => {
        if (!canPersist || !conversationId) return
        await supabase.from('vera_messages').insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          parts: responseMessage.parts,
        })
        await supabase
          .from('vera_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
          .eq('user_id', user.id)
      },
    })
  } catch (error) {
    console.error('Vera chat error:', error)
    return NextResponse.json({ error: 'Vera hit an unexpected error' }, { status: 500 })
  }
}
