import type { SupabaseClient } from '@supabase/supabase-js'

const PERIODS_PER_YEAR: Record<string, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  yearly: 1,
}

const MS_PER_PERIOD: Record<string, number> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30.44 * 86_400_000,
  yearly: 365.25 * 86_400_000,
}

/**
 * Lazy APY accrual for manual accounts. Called before reads that show balances;
 * applies any whole compounding periods elapsed since last_accrued_at.
 * Savings balances grow; loan balances grow too (interest owed) — same math,
 * since both are stored as positive numbers.
 */
export async function accrueManualAccounts(supabase: SupabaseClient, userId: string) {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, balance, apy, compound_frequency, last_accrued_at')
    .eq('user_id', userId)
    .eq('is_manual', true)
    .gt('apy', 0)

  if (error || !accounts?.length) return

  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  for (const account of accounts) {
    const periodMs = MS_PER_PERIOD[account.compound_frequency] ?? MS_PER_PERIOD.monthly
    const periodsPerYear = PERIODS_PER_YEAR[account.compound_frequency] ?? 12
    const elapsed = now - new Date(account.last_accrued_at).getTime()
    const periods = Math.floor(elapsed / periodMs)
    if (periods < 1) continue

    const rate = Number(account.apy) / 100 / periodsPerYear
    const newBalance =
      Math.round(Number(account.balance) * Math.pow(1 + rate, periods) * 100) / 100
    const newAccruedAt = new Date(
      new Date(account.last_accrued_at).getTime() + periods * periodMs
    ).toISOString()

    await supabase
      .from('accounts')
      .update({
        balance: newBalance,
        last_accrued_at: newAccruedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)

    await supabase.from('balance_snapshots').upsert(
      { user_id: userId, account_id: account.id, balance: newBalance, date: today },
      { onConflict: 'account_id,date' }
    )
  }
}
