'use client'

import { createClient } from '@/lib/supabase-client'
import { useEffect, useState } from 'react'
import { Account, DashboardMetrics } from '@/lib/types'

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // For now, we'll show placeholder data
        // Once database is set up, we'll fetch from Supabase
        setMetrics({
          totalAssets: 0,
          totalLiabilities: 0,
          netWorth: 0,
          monthlySpending: 0,
          accountsCount: 0,
          transactionsCount: 0,
        })
        setAccounts([])
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
        <div className="h-8 bg-[#12103A] rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-[#12103A] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#EEE8F5] mb-2">Dashboard</h1>
        <p className="text-[#8B8BA8]">Welcome to Fortuneer. Manage your finances strategically.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Net Worth"
          value={metrics?.netWorth ?? 0}
          type="currency"
        />
        <MetricCard
          label="Total Assets"
          value={metrics?.totalAssets ?? 0}
          type="currency"
        />
        <MetricCard
          label="Monthly Spending"
          value={metrics?.monthlySpending ?? 0}
          type="currency"
        />
      </div>

      {/* Accounts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#EEE8F5]">Accounts</h2>
          <button className="px-4 py-2 bg-[#FCD34D] text-[#07071A] rounded-lg font-semibold hover:bg-[#D97706] transition-colors">
            + Add Account
          </button>
        </div>
        {accounts.length === 0 ? (
          <div className="p-6 rounded-lg border border-white/10 bg-[#0D0B28] text-center">
            <p className="text-[#8B8BA8] mb-4">No accounts connected yet</p>
            <button className="px-4 py-2 bg-[#6D28D9] text-[#EEE8F5] rounded-lg font-semibold hover:bg-[#7C3AED] transition-colors">
              Connect Bank Account
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 className="text-xl font-bold text-[#EEE8F5] mb-4">Recent Transactions</h2>
        <div className="p-6 rounded-lg border border-white/10 bg-[#0D0B28] text-center">
          <p className="text-[#8B8BA8]">Connect an account to see transactions</p>
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: number
  type: 'currency' | 'count'
}

function MetricCard({ label, value, type }: MetricCardProps) {
  const formatted = type === 'currency' ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : value.toLocaleString()
  
  return (
    <div className="p-6 rounded-lg border border-white/10 bg-[#0D0B28]">
      <p className="text-[#8B8BA8] text-sm mb-2">{label}</p>
      <p className="text-3xl font-bold text-[#FCD34D]">{formatted}</p>
    </div>
  )
}

interface AccountCardProps {
  account: Account
}

function AccountCard({ account }: AccountCardProps) {
  const accountTypeColors = {
    checking: 'bg-blue-500/20 text-blue-300',
    savings: 'bg-green-500/20 text-green-300',
    credit: 'bg-orange-500/20 text-orange-300',
    investment: 'bg-purple-500/20 text-purple-300',
    loan: 'bg-red-500/20 text-red-300',
    other: 'bg-gray-500/20 text-gray-300',
  }

  return (
    <div className="p-4 rounded-lg border border-white/10 bg-[#0D0B28] flex items-center justify-between hover:bg-[#12103A] transition-colors cursor-pointer">
      <div>
        <p className="font-semibold text-[#EEE8F5]">{account.name}</p>
        <span className={`text-xs font-medium px-2 py-1 rounded mt-1 inline-block ${accountTypeColors[account.type]}`}>
          {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
        </span>
      </div>
      <p className="text-2xl font-bold text-[#FCD34D]">
        ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}