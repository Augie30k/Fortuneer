'use client'

import { Budget } from '@/lib/types'
import { useEffect, useState } from 'react'

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        // Placeholder - will fetch from API once DB is set up
        setBudgets([])
      } catch (error) {
        console.error('Error fetching budgets:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBudgets()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#EEE8F5] mb-2">Budgets</h1>
          <p className="text-[#8B8BA8]">Create and manage spending budgets</p>
        </div>
        <button className="px-4 py-2 bg-[#FCD34D] text-[#07071A] rounded-lg font-semibold hover:bg-[#D97706] transition-colors">
          + New Budget
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#12103A] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="p-12 rounded-lg border border-white/10 bg-[#0D0B28] text-center">
          <p className="text-[#8B8BA8] mb-4">No budgets created yet</p>
          <button className="px-6 py-3 bg-[#6D28D9] text-[#EEE8F5] rounded-lg font-semibold hover:bg-[#7C3AED] transition-colors">
            Create Your First Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </div>
  )
}

interface BudgetCardProps {
  budget: Budget
}

function BudgetCard({ budget }: BudgetCardProps) {
  const spent = Math.random() * budget.amount // Placeholder
  const percentage = (spent / budget.amount) * 100

  return (
    <div className="p-6 rounded-lg border border-white/10 bg-[#0D0B28] hover:bg-[#12103A] transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-[#EEE8F5]">{budget.name}</p>
        <span className="text-[#8B8BA8] text-sm">{budget.period}</span>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#8B8BA8] text-sm">
            ${spent.toLocaleString('en-US', { maximumFractionDigits: 0 })} of ${budget.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className={`text-sm font-semibold ${percentage > 100 ? 'text-red-400' : percentage > 80 ? 'text-yellow-400' : 'text-green-400'}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-[#12103A] rounded-full overflow-hidden">
          <div
            className={`h-full ${percentage > 100 ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
