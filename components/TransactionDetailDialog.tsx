'use client'

import type { AccountWithItem, Category, TransactionWithRefs } from '@/lib/types'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { formatDate, formatSignedAmount } from '@/lib/format'
import CategoryIcon from '@/components/CategoryIcon'
import DatePicker from '@/components/DatePicker'
import RuleDialog from '@/components/RuleDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Category select items grouped by group name, with icons */
export function CategorySelectItems({ categories }: { categories: Category[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const c of categories) {
      const key = c.group_name || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()]
  }, [categories])

  return (
    <>
      {grouped.map(([group, rows]) => (
        <SelectGroup key={group}>
          <SelectLabel>{group}</SelectLabel>
          {rows.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <CategoryIcon icon={c.icon} color={c.color} />
              {c.name}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  )
}

export default function TransactionDetailDialog({
  transaction,
  categories,
  accounts,
  onUpdated,
  onDeleted,
}: {
  transaction: TransactionWithRefs
  categories: Category[]
  accounts: AccountWithItem[]
  onUpdated: (t: TransactionWithRefs) => void
  onDeleted: (id: string) => void
}) {
  const isManual = transaction.plaid_transaction_id === null

  const [description, setDescription] = useState(transaction.description)
  const [merchantName, setMerchantName] = useState(transaction.merchant_name ?? '')
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [notes, setNotes] = useState(transaction.notes ?? '')
  // Manual-only fields — banks own these on synced transactions
  const [direction, setDirection] = useState(transaction.amount >= 0 ? 'expense' : 'income')
  const [amount, setAmount] = useState(String(Math.abs(transaction.amount)))
  const [date, setDate] = useState(transaction.date)
  const [accountId, setAccountId] = useState(transaction.account_id)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      toast.success('Transaction deleted')
      onDeleted(transaction.id)
    } catch {
      toast.error('Failed to delete transaction')
      setDeleting(false)
    }
  }

  const merchant = transaction.merchant_name ?? transaction.description
  const categoryChanged = categoryId !== (transaction.category_id ?? '')

  const signedAmount = (direction === 'income' ? -1 : 1) * (Math.abs(parseFloat(amount)) || 0)
  const amountChanged = isManual && signedAmount !== transaction.amount
  const dirty =
    categoryChanged ||
    notes !== (transaction.notes ?? '') ||
    description !== transaction.description ||
    merchantName !== (transaction.merchant_name ?? '') ||
    amountChanged ||
    (isManual && (date !== transaction.date || accountId !== transaction.account_id))

  const save = async () => {
    if (!description.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId || null,
          notes: notes || null,
          description: description.trim(),
          merchant_name: merchantName,
          ...(isManual
            ? { amount: signedAmount, date, account_id: accountId }
            : {}),
        }),
      })
      if (!response.ok) throw new Error('failed')
      const updated = await response.json()
      toast.success('Transaction updated')
      onUpdated(updated)
    } catch (error) {
      console.error(error)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="truncate pr-8">{merchant}</DialogTitle>
        <DialogDescription>
          {formatDate(transaction.date)} · {transaction.accounts?.name}
          {transaction.pending && ' · Pending'}
          {!isManual && ' · Synced from your bank'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {isManual ? (
          <>
            <Tabs value={direction} onValueChange={setDirection}>
              <TabsList className="w-full">
                <TabsTrigger value="expense" className="flex-1">
                  Expense
                </TabsTrigger>
                <TabsTrigger value="income" className="flex-1">
                  Income
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txn-edit-amount">Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="txn-edit-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7 tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="txn-edit-date">Date</Label>
                <DatePicker id="txn-edit-date" value={date} onChange={setDate} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.mask ? ` ••${a.mask}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span
              className={`text-lg font-semibold tabular-nums ${transaction.amount < 0 ? 'text-positive' : ''}`}
            >
              {formatSignedAmount(transaction.amount)}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="txn-edit-desc">Vendor</Label>
          <Input
            id="txn-edit-desc"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="txn-edit-merchant">Display name (optional, shown in lists)</Label>
          <Input
            id="txn-edit-merchant"
            placeholder="Optional display name, e.g. Starbucks"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              <CategorySelectItems categories={categories} />
            </SelectContent>
          </Select>
          {categoryChanged && categoryId && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="min-w-0 text-xs text-muted-foreground">
                Always categorize{' '}
                <span className="font-medium text-foreground">“{merchant}”</span> this way?
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setRuleDialogOpen(true)}
              >
                Preview rule
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            placeholder="Add a note…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button onClick={save} disabled={!dirty || !description.trim() || saving} className="w-full">
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save changes'}
        </Button>
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full text-destructive hover:text-destructive"
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />}
          Delete transaction
        </Button>
      </div>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <RuleDialog
          categories={categories}
          initialMatcher={merchant}
          initialMatchField={transaction.merchant_name ? 'merchant' : 'description'}
          initialCategoryId={categoryId}
          title="Create a rule?"
          description={`Preview how this rule would apply before saving it — future imports of "${merchant}" will follow it automatically.`}
          onSaved={() => setRuleDialogOpen(false)}
        />
      </Dialog>
    </DialogContent>
  )
}
