'use client'

import { Transaction } from '@/lib/types'
import { useEffect, useState } from 'react'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        // Placeholder - will fetch from API once DB is set up
        setTransactions([])
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#EEE8F5] mb-2">Transactions</h1>
        <p className="text-[#8B8BA8]">View and manage your transactions</p>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search transactions..."
          className="flex-1 px-4 py-2 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] placeholder-[#8B8BA8] focus:outline-none focus:border-[#6D28D9]"
        />
        <select className="px-4 py-2 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] focus:outline-none focus:border-[#6D28D9]">
          <option>All Categories</option>
          <option>Groceries</option>
          <option>Transportation</option>
          <option>Dining</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#12103A] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="p-12 rounded-lg border border-white/10 bg-[#0D0B28] text-center">
          <p className="text-[#8B8BA8] mb-4">No transactions yet</p>
          <p className="text-sm text-[#8B8BA8]">Connect a bank account to start seeing your transactions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}
    </div>
  )
}

interface TransactionRowProps {
  transaction: Transaction
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const isCredit = transaction.type === 'credit'

  return (
    <div className="p-4 rounded-lg border border-white/10 bg-[#0D0B28] flex items-center justify-between hover:bg-[#12103A] transition-colors cursor-pointer">
      <div className="flex-1">
        <p className="font-semibold text-[#EEE8F5]">{transaction.description}</p>
        <p className="text-sm text-[#8B8BA8] mt-1">
          {new Date(transaction.date).toLocaleDateString()}
        </p>
      </div>
      <p className={`text-lg font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
        {isCredit ? '+' : '-'}${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}
