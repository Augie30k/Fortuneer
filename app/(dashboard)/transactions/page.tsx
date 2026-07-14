'use client'

import { Transaction } from '@/lib/types'
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions')
        if (!response.ok) throw new Error('Failed to fetch transactions')
        const data = await response.json()
        setTransactions(data.transactions ?? [])
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return transactions
    return transactions.filter((t) => t.description.toLowerCase().includes(query))
  }, [transactions, search])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">View and search your transaction history</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search transactions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-1 text-muted-foreground">
              {transactions.length === 0 ? 'No transactions yet' : 'No matching transactions'}
            </p>
            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add transactions to your accounts to see them here
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}
    </div>
  )
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isCredit = transaction.type === 'credit'

  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="font-medium">{transaction.description}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(transaction.date).toLocaleDateString()}
          </p>
        </div>
        <p className={`text-lg font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isCredit ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount))}
        </p>
      </CardContent>
    </Card>
  )
}
