// Platform-neutral month-actuals math for the Budgets page, shared by the
// web /api/budgets route and the mobile app.

export interface BudgetTxnRow {
  category_id: string | null
  amount: number
  category?: { is_income?: boolean; is_transfer?: boolean } | null
}

/** First day of `month` ('YYYY-MM') and the exclusive end (first of next month). */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  return { start: `${month}-01`, end: new Date(y, m, 1).toISOString().slice(0, 10) }
}

/**
 * Per-category actual amount for a month. Expense categories track outflows
 * (amount > 0); the Income category tracks inflows (amount < 0) so its
 * budget row can show "received so far" against a monthly target, just like
 * any other category. Transfers never count either way.
 */
export function computeMonthActuals(rows: BudgetTxnRow[]): {
  spendByCategory: Map<string, number>
  income: number
} {
  const spendByCategory = new Map<string, number>()
  let income = 0
  for (const t of rows) {
    const cat = t.category
    if (cat?.is_transfer) continue
    const amount = Number(t.amount)
    if (cat?.is_income) {
      if (amount >= 0) continue
      income += -amount
      if (t.category_id) {
        spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + -amount)
      }
    } else if (amount > 0 && t.category_id) {
      spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + amount)
    }
  }
  return { spendByCategory, income }
}
