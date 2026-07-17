/** Groq pay-as-you-go rates in USD per 1M tokens, used by the Analyst pages
 *  to turn usage_log token counts into dollar estimates. Rates are entered by
 *  hand — update this map when Groq reprices or Vera adds a model. */
export const GROQ_PRICING: Record<string, { input: number; output: number }> = {
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
}

/** Unknown models bill at the priciest known rate so estimates err high. */
const FALLBACK_RATE = { input: 0.59, output: 0.79 }

export function groqRate(model: string): { input: number; output: number } {
  return GROQ_PRICING[model] ?? FALLBACK_RATE
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = groqRate(model)
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000
}
