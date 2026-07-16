// Cost/token-efficiency layer for Vera: which Groq model handles a given
// turn, and how much history/output it gets to work with. Routing is a pure
// heuristic (no extra model call) so picking a model costs zero tokens.

/** llama-3.1-8b-instant is ~10x cheaper and faster than the 70b model on
 *  Groq — plenty for simple lookups and small talk. Anything that smells
 *  like a financial write, or is long/deep into a thread, escalates to
 *  llama-3.3-70b-versatile, since precision matters more once real money
 *  amounts are on the line (the Undo safety net covers the rest). */
export const VERA_MODELS = {
  light: 'llama-3.1-8b-instant',
  heavy: 'llama-3.3-70b-versatile',
} as const

const WRITE_VERBS =
  /\b(set|change|update|adjust|increase|decrease|raise|lower|add|put|contribute|allocate|create|start|cut|reduce|move|transfer)\b/i
const MONEY_OR_TOPIC = /\$\s?\d|\b\d+(\.\d+)?\s?(dollars|bucks|usd)\b|\bbudget\b|\bgoal\b/i
const GREETING_ONLY =
  /^(hi|hey|hello|yo|sup|thanks?|thank you|ty|ok|okay|cool|nice|got it|sounds good)[.!?]*$/i

/** Longest a turn's history window needs to be for Vera to stay coherent —
 *  trimmed well below the raw message list to cut tokens sent per request. */
export const VERA_HISTORY_WINDOW = 16

/** Caps runaway completions — Vera's own system prompt already asks for
 *  concise answers; this backstops it and bounds worst-case output cost. */
export const VERA_MAX_OUTPUT_TOKENS = 900

export function pickVeraModel(latestUserText: string, messageCount: number): string {
  const text = latestUserText.trim()
  if (!text || GREETING_ONLY.test(text)) return VERA_MODELS.light

  const looksLikeWrite = WRITE_VERBS.test(text) && MONEY_OR_TOPIC.test(text)
  const isLong = text.length > 200 || text.split(/\s+/).length > 35
  const deepThread = messageCount > VERA_HISTORY_WINDOW

  return looksLikeWrite || isLong || deepThread ? VERA_MODELS.heavy : VERA_MODELS.light
}
