'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Wallet, ShoppingBag, Plus } from 'lucide-react'
import { Account, DashboardMetrics, Transaction } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit',
  investment: 'Investment',
  loan: 'Loan',
  other: 'Other',
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard')
        if (!response.ok) throw new Error('Failed to fetch dashboard data')
        const data = await response.json()
        setMetrics(data.metrics)
        setAccounts(data.accounts ?? [])
        setRecentTransactions(data.recentTransactions ?? [])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Fortuneer. Manage your finances strategically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          icon={TrendingUp}
          label="Net Worth"
          value={formatCurrency(metrics?.netWorth ?? 0)}
        />
        <MetricCard
          icon={Wallet}
          label="Total Assets"
          value={formatCurrency(metrics?.totalAssets ?? 0)}
        />
        <MetricCard
          icon={ShoppingBag}
          label="Monthly Spending"
          value={formatCurrency(metrics?.monthlySpending ?? 0)}
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Accounts</h2>
          <Button asChild size="sm">
            <Link href="/accounts">
              <Plus />
              Add Account
            </Link>
          </Button>
        </div>
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground">No accounts yet</p>
              <Button asChild size="sm" variant="secondary">
                <Link href="/accounts">Add your first account</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <Badge variant="secondary" className="mt-1">
                      {ACCOUNT_TYPE_LABEL[account.type]}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Transactions</h2>
        {recentTransactions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No transactions yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((transaction) => (
              <Card key={transaction.id}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString()}
                    </p>
                  </div>
                  <p
                    className={
                      transaction.type === 'credit'
                        ? 'font-semibold text-emerald-400'
                        : 'font-semibold text-rose-400'
                    }
                  >
                    {transaction.type === 'credit' ? '+' : '-'}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-primary">{value}</p>
        </div>
        <Icon className="size-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}
