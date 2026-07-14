'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Landmark } from 'lucide-react'
import type { DashboardData } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import NetWorthChart from '@/components/charts/NetWorthChart'
import CashFlowChart from '@/components/charts/CashFlowChart'
import CategoryIcon from '@/components/CategoryIcon'
import TransactionRow from '@/components/TransactionRow'
import PlaidLinkButton from '@/components/PlaidLinkButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) throw new Error('failed')
      setData(await response.json())
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-44" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const hasAccounts = data.accounts.length > 0
  const savingsRate =
    data.monthlyIncome > 0
      ? Math.max(0, (data.monthlyIncome - data.monthlySpending) / data.monthlyIncome)
      : null

  if (!hasAccounts) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Landmark className="size-7 text-primary" />
            </span>
            <div>
              <p className="text-lg font-semibold">Welcome to Fortuneer</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Connect a bank account to see your net worth, cash flow, and spending
                — all in one place.
              </p>
            </div>
            <PlaidLinkButton onLinked={fetchData} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalSpend = data.spendingByCategory.reduce((s, c) => s + c.amount, 0)
  const topCategories = data.spendingByCategory.slice(0, 6)
  const otherAmount = data.spendingByCategory.slice(6).reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Dashboard</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Net worth" value={formatCurrency(data.netWorth)} hero />
        <StatTile label="Assets" value={formatCurrency(data.totalAssets)} />
        <StatTile
          label="Spending this month"
          value={formatCurrency(data.monthlySpending)}
        />
        <StatTile
          label="Savings rate"
          value={savingsRate == null ? '—' : `${Math.round(savingsRate * 100)}%`}
          sub={
            data.monthlyIncome > 0
              ? `${formatCurrency(data.monthlyIncome)} income`
              : 'No income yet this month'
          }
        />
      </div>

      {/* Net worth trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Net worth over time</CardTitle>
        </CardHeader>
        <CardContent>
          {data.netWorthHistory.length > 1 ? (
            <NetWorthChart data={data.netWorthHistory} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              History builds as your accounts sync each day — check back tomorrow.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cash flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Cash flow</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={data.cashFlow} />
          </CardContent>
        </Card>

        {/* Spending by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Spending this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No spending recorded this month yet.
              </p>
            ) : (
              <div className="space-y-3">
                {topCategories.map((c) => (
                  <CategorySpendRow
                    key={c.categoryId}
                    name={c.name}
                    icon={c.icon}
                    color={c.color}
                    amount={c.amount}
                    share={totalSpend > 0 ? c.amount / totalSpend : 0}
                  />
                ))}
                {otherAmount > 0 && (
                  <CategorySpendRow
                    name="Other"
                    icon="circle-ellipsis"
                    color="#8E8E93"
                    amount={otherAmount}
                    share={totalSpend > 0 ? otherAmount / totalSpend : 0}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex-row items-center">
          <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
          <Link
            href="/transactions"
            className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {data.recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            data.recentTransactions.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <Separator />}
                <TransactionRow transaction={t} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  hero = false,
}: {
  label: string
  value: string
  sub?: string
  hero?: boolean
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 font-semibold',
            hero ? 'text-2xl lg:text-3xl' : 'text-xl lg:text-2xl'
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function CategorySpendRow({
  name,
  icon,
  color,
  amount,
  share,
}: {
  name: string
  icon: string | null
  color: string | null
  amount: number
  share: number
}) {
  return (
    <div className="flex items-center gap-3">
      <CategoryIcon chip icon={icon} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(amount)}
          </p>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, share * 100)}%`,
              backgroundColor: color ?? '#8E8E93',
            }}
          />
        </div>
      </div>
    </div>
  )
}
