'use client'

import { Account } from '@/lib/types'
import { useState, useEffect } from 'react'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/dashboard')
      const data = await response.json()
      setAccounts(data.accounts)
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#EEE8F5] mb-2">Accounts</h1>
          <p className="text-[#8B8BA8]">Manage your financial accounts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#FCD34D] text-[#07071A] rounded-lg font-semibold hover:bg-[#D97706] transition-colors"
        >
          + Add Account
        </button>
      </div>

      {showForm && <AddAccountForm onSuccess={() => { setShowForm(false); fetchAccounts(); }} />}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[#12103A] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-12 rounded-lg border border-white/10 bg-[#0D0B28] text-center">
          <p className="text-[#8B8BA8] mb-4">No accounts yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-[#6D28D9] text-[#EEE8F5] rounded-lg font-semibold hover:bg-[#7C3AED] transition-colors"
          >
            Create Your First Account
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}

interface AccountRowProps {
  account: Account
}

function AccountRow({ account }: AccountRowProps) {
  const accountTypeColors = {
    checking: 'bg-blue-500/20 text-blue-300',
    savings: 'bg-green-500/20 text-green-300',
    credit: 'bg-orange-500/20 text-orange-300',
    investment: 'bg-purple-500/20 text-purple-300',
    loan: 'bg-red-500/20 text-red-300',
    other: 'bg-gray-500/20 text-gray-300',
  }

  return (
    <div className="p-4 rounded-lg border border-white/10 bg-[#0D0B28] flex items-center justify-between hover:bg-[#12103A] transition-colors">
      <div className="flex-1">
        <p className="font-semibold text-[#EEE8F5]">{account.name}</p>
        <span className={`text-xs font-medium px-2 py-1 rounded mt-1 inline-block ${accountTypeColors[account.type]}`}>
          {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
        </span>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-[#FCD34D]">
          ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
        {account.is_connected && <span className="text-xs text-green-400">Connected</span>}
      </div>
    </div>
  )
}

interface AddAccountFormProps {
  onSuccess: () => void
}

function AddAccountForm({ onSuccess }: AddAccountFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    balance: 0,
    currency: 'USD',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create account')
      onSuccess()
    } catch (error) {
      console.error('Error creating account:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 rounded-lg border border-white/10 bg-[#0D0B28] space-y-4"
    >
      <div>
        <label className="block text-[#EEE8F5] mb-2 font-semibold">Account Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] focus:outline-none focus:border-[#6D28D9]"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[#EEE8F5] mb-2 font-semibold">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] focus:outline-none focus:border-[#6D28D9]"
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit">Credit Card</option>
            <option value="investment">Investment</option>
            <option value="loan">Loan</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-[#EEE8F5] mb-2 font-semibold">Balance</label>
          <input
            type="number"
            step="0.01"
            value={formData.balance}
            onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] focus:outline-none focus:border-[#6D28D9]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-[#FCD34D] text-[#07071A] rounded-lg font-semibold hover:bg-[#D97706] transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Account'}
      </button>
    </form>
  )
}
