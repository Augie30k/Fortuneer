import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const LIABILITY_TYPES = new Set(['credit', 'loan'])

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const monthStart = `${now.toISOString().slice(0, 7)}-01`
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      .toISOString()
      .slice(0, 10)

    const [accountsRes, txnsRes, snapshotsRes, categoriesRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('*, plaid_items(institution_name, last_synced_at, status)')
        .eq('user_id', user.id)
        .eq('hidden', false)
        .order('balance', { ascending: false }),
      supabase
        .from('transactions')
        .select('amount, date, category_id')
        .eq('user_id', user.id)
        .gte('date', sixMonthsAgo),
      supabase
        .from('balance_snapshots')
        .select('account_id, balance, date')
        .eq('user_id', user.id)
        .order('date'),
      supabase.from('categories').select('id, name, icon, color, is_transfer, is_income'),
    ])

    if (accountsRes.error) throw accountsRes.error
    if (txnsRes.error) throw txnsRes.error
    if (snapshotsRes.error) throw snapshotsRes.error
    if (categoriesRes.error) throw categoriesRes.error

    const accounts = accountsRes.data ?? []
    const transactions = txnsRes.data ?? []
    const snapshots = snapshotsRes.data ?? []
    const categories = categoriesRes.data ?? []

    const categoryById = new Map(categories.map((c) => [c.id, c]))
    const isTransfer = (categoryId: string | null) =>
      categoryId ? (categoryById.get(categoryId)?.is_transfer ?? false) : false

    // ---- Current totals ----
    let totalAssets = 0
    let totalLiabilities = 0
    for (const a of accounts) {
      if (LIABILITY_TYPES.has(a.type)) totalLiabilities += Number(a.balance)
      else totalAssets += Number(a.balance)
    }
    const netWorth = totalAssets - totalLiabilities

    // ---- This month's income / spending (transfers excluded) ----
    let monthlyIncome = 0
    let monthlySpending = 0
    for (const t of transactions) {
      if (t.date < monthStart || isTransfer(t.category_id)) continue
      const amount = Number(t.amount)
      if (amount < 0) monthlyIncome += -amount
      else monthlySpending += amount
    }

    // ---- Net worth history: forward-fill each account's last known balance ----
    const accountType = new Map(accounts.map((a) => [a.id, a.type]))
    const lastBalance = new Map<string, number>()
    const byDate = new Map<string, { account_id: string; balance: number }[]>()
    for (const s of snapshots) {
      if (!byDate.has(s.date)) byDate.set(s.date, [])
      byDate.get(s.date)!.push(s)
    }
    const netWorthHistory = [...byDate.keys()].sort().map((date) => {
      for (const s of byDate.get(date)!) lastBalance.set(s.account_id, Number(s.balance))
      let assets = 0
      let liabilities = 0
      for (const [accountId, balance] of lastBalance) {
        if (LIABILITY_TYPES.has(accountType.get(accountId) ?? '')) liabilities += balance
        else assets += balance
      }
      return { date, assets, liabilities, netWorth: assets - liabilities }
    })

    // ---- Cash flow by month, last 6 months (transfers excluded) ----
    const cashFlowMap = new Map<string, { income: number; expenses: number }>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      cashFlowMap.set(d.toISOString().slice(0, 7), { income: 0, expenses: 0 })
    }
    for (const t of transactions) {
      if (isTransfer(t.category_id)) continue
      const bucket = cashFlowMap.get(t.date.slice(0, 7))
      if (!bucket) continue
      const amount = Number(t.amount)
      if (amount < 0) bucket.income += -amount
      else bucket.expenses += amount
    }
    const cashFlow = [...cashFlowMap.entries()].map(([month, v]) => ({ month, ...v }))

    // ---- Spending by category, current month ----
    const spendMap = new Map<string, number>()
    for (const t of transactions) {
      const amount = Number(t.amount)
      if (t.date < monthStart || amount <= 0 || !t.category_id || isTransfer(t.category_id))
        continue
      spendMap.set(t.category_id, (spendMap.get(t.category_id) ?? 0) + amount)
    }
    const spendingByCategory = [...spendMap.entries()]
      .map(([categoryId, amount]) => {
        const c = categoryById.get(categoryId)
        return {
          categoryId,
          name: c?.name ?? 'Other',
          color: c?.color ?? null,
          icon: c?.icon ?? null,
          amount,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    // ---- Recent transactions ----
    const { data: recentTransactions, error: recentError } = await supabase
      .from('transactions')
      .select('*, accounts(name, mask), categories(name, icon, color, is_income, is_transfer)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8)

    if (recentError) throw recentError

    return NextResponse.json({
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlyIncome,
      monthlySpending,
      netWorthHistory,
      cashFlow,
      spendingByCategory,
      recentTransactions: recentTransactions ?? [],
      accounts,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
