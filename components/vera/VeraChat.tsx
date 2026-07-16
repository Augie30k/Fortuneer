'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { toast } from 'sonner'
import {
  ArrowUp,
  Check,
  History,
  Loader2,
  Maximize2,
  MessageSquare,
  RotateCcw,
  Sparkles,
  SquarePen,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const SUGGESTIONS = [
  'How much did I spend on food this month?',
  'Set my Entertainment budget to $150',
  'How am I doing against my budget?',
  'Create a $3,000 emergency fund goal',
]

const TOOL_LABELS: Record<string, string> = {
  get_financial_snapshot: 'Checked your accounts',
  get_budgets: 'Checked your budgets',
  get_spending_summary: 'Reviewed your spending',
  search_transactions: 'Searched transactions',
  get_goals: 'Checked your goals',
  set_budget: 'Budget updated',
  create_goal: 'Goal created',
  contribute_to_goal: 'Contribution recorded',
}

const WRITE_TOOLS = new Set(['set_budget', 'create_goal', 'contribute_to_goal'])

interface ToolOutput {
  success?: boolean
  summary?: string
  error?: string
  action_id?: string | null
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

/**
 * Vera chat. Two shells around one brain:
 * - floating popup (default, mounted in the dashboard layout)
 * - full page at /vera (fullPage) with a persistent history sidebar
 * Conversations persist server-side, ChatGPT-style.
 */
export default function VeraChat({ fullPage = false }: { fullPage?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(fullPage)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [input, setInput] = useState('')
  const [undone, setUndone] = useState<Set<string>>(new Set())
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const convRef = useRef<string | null>(null)

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: '/api/vera/chat',
        // isRetry lets the server skip re-inserting the user message into
        // history when a failed response is regenerated
        prepareSendMessagesRequest: ({ messages, body, trigger }) => ({
          body: {
            messages,
            conversationId: convRef.current,
            isRetry: String(trigger).includes('regenerate'),
            ...body,
          },
        }),
      })
  )

  const { messages, sendMessage, setMessages, status, error, regenerate } = useChat({ transport })

  const busy = status === 'submitted' || status === 'streaming'

  // Consecutive failed turns: the first failure offers a retry; after two
  // failed retries (3 straight failures) Vera is declared temporarily down
  // and the composer locks until a new chat is started.
  const [failCount, setFailCount] = useState(0)
  const prevStatusRef = useRef(status)
  useEffect(() => {
    if (status === 'error' && prevStatusRef.current !== 'error') {
      setFailCount((c) => c + 1)
    } else if (status === 'ready' && prevStatusRef.current === 'streaming') {
      setFailCount(0)
    }
    prevStatusRef.current = status
  }, [status])

  const veraDown = failCount >= 3
  const configError = !!error && /not configured|GROQ_API_KEY|503/i.test(error.message)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const fetchConversations = useCallback(() => {
    fetch('/api/vera/conversations')
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (fullPage) fetchConversations()
  }, [fullPage, fetchConversations])

  const newChat = () => {
    convRef.current = null
    setConversationId(null)
    setMessages([])
    setFailCount(0)
    setView('chat')
  }

  const openConversation = async (id: string) => {
    setLoadingConversation(true)
    try {
      const response = await fetch(`/api/vera/conversations/${id}`)
      const data = await response.json()
      const restored: UIMessage[] = (data.messages ?? []).map(
        (m: { id: string; role: 'user' | 'assistant'; parts: UIMessage['parts'] }) => ({
          id: m.id,
          role: m.role,
          parts: m.parts,
        })
      )
      convRef.current = id
      setConversationId(id)
      setMessages(restored)
      setFailCount(0)
      setView('chat')
    } catch {
      toast.error('Failed to load conversation')
    } finally {
      setLoadingConversation(false)
    }
  }

  const deleteConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/vera/conversations?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (convRef.current === id) newChat()
      toast.success('Conversation deleted')
    } catch {
      toast.error('Failed to delete conversation')
    }
  }

  const submit = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy || veraDown) return
    setInput('')
    // First message of a fresh chat creates its conversation, so history
    // starts persisting from message one
    if (!convRef.current) {
      try {
        const response = await fetch('/api/vera/conversations', { method: 'POST' })
        if (response.ok) {
          const conversation = await response.json()
          convRef.current = conversation.id
          setConversationId(conversation.id)
          setConversations((prev) => [conversation, ...prev])
        }
      } catch {
        // Persistence is best-effort; the chat itself still works
      }
    }
    sendMessage({ text: trimmed })
    // Title is set server-side from the first message — refresh the list
    setTimeout(fetchConversations, 1500)
  }

  const undoAction = async (actionId: string) => {
    try {
      const response = await fetch('/api/vera/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'failed')
      setUndone((prev) => new Set(prev).add(actionId))
      toast.success(json.message ?? 'Undone')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to undo')
    }
  }

  // The floating launcher stays out of the way on the dedicated page
  if (!fullPage && pathname === '/vera') return null

  if (!fullPage && !open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        aria-label="Ask Vera"
        className="fixed right-5 bottom-5 z-40 size-13 rounded-full shadow-lg"
      >
        <Sparkles className="size-5" />
      </Button>
    )
  }

  const historyList = (
    <div className="flex-1 space-y-1 overflow-y-auto">
      {conversations.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          No conversations yet.
        </p>
      ) : (
        conversations.map((c) => (
          <div
            key={c.id}
            className={cn(
              'group/conv flex items-center gap-1 rounded-lg pr-1 transition-colors',
              c.id === conversationId ? 'bg-accent' : 'hover:bg-accent/60'
            )}
          >
            <button
              type="button"
              onClick={() => openConversation(c.id)}
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
            >
              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{c.title}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {formatDate(c.updated_at.slice(0, 10))}
                </span>
              </span>
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 shrink-0 opacity-0 transition-opacity group-hover/conv:opacity-100"
                  aria-label={`Delete "${c.title}"`}
                >
                  <Trash2 className="size-3 text-muted-foreground" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{c.title}” and its messages will be removed. Changes Vera made to
                    your data are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button variant="destructive" onClick={() => deleteConversation(c.id)}>
                      Delete
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))
      )}
    </div>
  )

  const chatBody = (
    <>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loadingConversation ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className={cn('space-y-3 pt-4', fullPage && 'mx-auto max-w-md pt-16 text-center')}>
                <p className="text-sm text-muted-foreground">
                  Ask about your money, or tell me to make a change — every change I
                  make can be undone right here.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-lg border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={cn('space-y-1.5', fullPage && 'mx-auto max-w-2xl')}>
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    if (!part.text.trim()) return null
                    return (
                      <div
                        key={i}
                        className={cn(
                          'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
                          message.role === 'user'
                            ? 'ml-auto bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        {part.text}
                      </div>
                    )
                  }
                  if (part.type.startsWith('tool-')) {
                    const toolName = part.type.slice(5)
                    const state = 'state' in part ? (part.state as string) : ''
                    const output =
                      'output' in part ? (part.output as ToolOutput | undefined) : undefined
                    const isWrite = WRITE_TOOLS.has(toolName)
                    const done = state === 'output-available'
                    const failed = state === 'output-error' || (done && output?.success === false)
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                          isWrite && done && !failed
                            ? 'border-primary/25 bg-primary/5'
                            : 'border-border bg-muted/30 text-muted-foreground'
                        )}
                      >
                        {done ? (
                          failed ? (
                            <X className="size-3.5 shrink-0 text-destructive" />
                          ) : isWrite ? (
                            <Check className="size-3.5 shrink-0 text-positive" />
                          ) : (
                            <Wrench className="size-3.5 shrink-0" />
                          )
                        ) : (
                          <Loader2 className="size-3.5 shrink-0 animate-spin" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {failed
                            ? (output?.error ?? 'Something went wrong')
                            : (output?.summary ?? TOOL_LABELS[toolName] ?? toolName)}
                        </span>
                        {isWrite && done && !failed && output?.action_id && (
                          undone.has(output.action_id) ? (
                            <span className="shrink-0 text-muted-foreground">Undone</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 shrink-0 px-1.5 text-xs"
                              onClick={() => undoAction(output.action_id!)}
                            >
                              <RotateCcw className="size-3" />
                              Undo
                            </Button>
                          )
                        )}
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            ))}

            {busy && messages[messages.length - 1]?.role === 'user' && (
              <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', fullPage && 'mx-auto max-w-2xl')}>
                <Loader2 className="size-3 animate-spin" />
                Vera is thinking…
              </div>
            )}

            {error && (
              <div className={cn('rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive', fullPage && 'mx-auto max-w-2xl')}>
                {configError ? (
                  'Vera isn’t configured yet — a GROQ_API_KEY needs to be added to the server environment.'
                ) : veraDown ? (
                  'Vera is temporarily down — sorry about that. Check back in a few minutes, or start a new chat to try again.'
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span>Something went wrong.</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 shrink-0 px-2 text-xs"
                      onClick={() => regenerate()}
                      disabled={busy}
                    >
                      <RotateCcw className="size-3" />
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
        className="flex items-center gap-2 border-t p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={veraDown ? 'Vera is temporarily down' : 'Ask Vera anything…'}
          className={cn('flex-1', fullPage && 'mx-auto max-w-2xl')}
          disabled={veraDown}
          autoFocus
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || veraDown || !input.trim()}
          aria-label="Send"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </>
  )

  // ---- Full page: persistent history sidebar + chat ----
  if (fullPage) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] overflow-hidden rounded-xl border bg-card">
        <aside className="hidden w-64 shrink-0 flex-col border-r p-2 sm:flex">
          <Button variant="outline" size="sm" onClick={newChat} className="mb-2 w-full justify-start">
            <SquarePen />
            New chat
          </Button>
          {historyList}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-3 sm:hidden">
            <Button variant="ghost" size="icon-sm" onClick={() => setView(view === 'history' ? 'chat' : 'history')} aria-label="History">
              <History />
            </Button>
            <p className="text-sm font-semibold">Vera</p>
            <Button variant="ghost" size="icon-sm" onClick={newChat} className="ml-auto" aria-label="New chat">
              <SquarePen />
            </Button>
          </div>
          {view === 'history' ? <div className="flex flex-1 flex-col p-2">{historyList}</div> : chatBody}
        </div>
      </div>
    )
  }

  // ---- Popup ----
  return (
    <div className="fixed right-0 bottom-0 z-40 flex h-[600px] max-h-[85dvh] w-full flex-col rounded-t-2xl border bg-card shadow-2xl sm:right-5 sm:bottom-5 sm:w-[400px] sm:rounded-2xl">
      <div className="flex items-center gap-1.5 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1 pl-0.5">
          <p className="text-sm font-semibold">Vera</p>
          <p className="text-xs text-muted-foreground">Your straight-talking money co-pilot</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (view === 'chat') fetchConversations()
            setView(view === 'history' ? 'chat' : 'history')
          }}
          aria-label="Chat history"
          className={cn(view === 'history' && 'bg-accent')}
        >
          <History />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={newChat} aria-label="New chat">
          <SquarePen />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setOpen(false)
            router.push('/vera')
          }}
          aria-label="Open full page"
        >
          <Maximize2 />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close Vera">
          <X />
        </Button>
      </div>

      {view === 'history' ? (
        <div className="flex flex-1 flex-col overflow-hidden p-2">{historyList}</div>
      ) : (
        chatBody
      )}
    </div>
  )
}
