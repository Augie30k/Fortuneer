export function formatCurrency(value: number, currency = 'USD', opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    ...opts,
  }).format(value)
}

/** Compact currency for chart axes: $1.2K, $3.4M */
export function formatCurrencyCompact(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Signed amount for the transaction feed. Plaid convention: positive = outflow.
 * Returns e.g. "-$12.50" for spending and "+$1,200.00" for income.
 */
export function formatSignedAmount(amount: number, currency = 'USD') {
  const abs = formatCurrency(Math.abs(amount), currency)
  return amount > 0 ? `-${abs}` : `+${abs}`
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T00:00:00' : '')) : date
  return d.toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

export function relativeDate(date: string) {
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return formatDate(date, { month: 'short', day: 'numeric' })
}
