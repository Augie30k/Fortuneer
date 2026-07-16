'use client'

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Plus, X } from 'lucide-react'
import type { Category, RuleWithCategory, TransactionWithRefs } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/format'
import CategoryIcon from '@/components/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Direction = 'any' | 'expense' | 'income'

interface RuleDialogProps {
  categories: Category[]
  onSaved: (rule: RuleWithCategory) => void
  /** When set, the dialog edits this existing rule instead of creating one */
  ruleId?: string
  initialMatcher?: string
  initialMatchField?: 'merchant' | 'description'
  initialMatchType?: 'contains' | 'exact'
  initialCategoryId?: string
  initialAmountMin?: number | null
  initialAmountMax?: number | null
  title?: string
  description?: string
}

/** Signed Plaid bounds (out > 0, in < 0) → user-facing direction + absolute range */
function fromSignedBounds(min: number | null, max: number | null): {
  direction: Direction
  low: string
  high: string
} {
  if (min == null && max == null) return { direction: 'any', low: '', high: '' }
  if (max != null && max <= 0) {
    // Income window: [-high, -low]
    return {
      direction: 'income',
      low: max <= -0.02 ? String(-max) : '',
      high: min != null ? String(-min) : '',
    }
  }
  return {
    direction: 'expense',
    low: min != null && min >= 0.02 ? String(min) : '',
    high: max != null ? String(max) : '',
  }
}

/** User-facing direction + absolute range → signed Plaid bounds */
function toSignedBounds(direction: Direction, low: string, high: string): {
  amount_min: number | null
  amount_max: number | null
} {
  const lo = parseFloat(low)
  const hi = parseFloat(high)
  const hasLo = isFinite(lo) && lo > 0
  const hasHi = isFinite(hi) && hi > 0
  if (direction === 'expense') {
    return { amount_min: hasLo ? lo : 0.01, amount_max: hasHi ? hi : null }
  }
  if (direction === 'income') {
    return { amount_min: hasHi ? -hi : null, amount_max: hasLo ? -lo : -0.01 }
  }
  return { amount_min: null, amount_max: null }
}

/** Create or edit a category rule — Monarch-style If/Then with live preview. */
export default function RuleDialog({
  categories,
  onSaved,
  ruleId,
  initialMatcher = '',
  initialMatchField = 'merchant',
  initialMatchType = 'contains',
  initialCategoryId = '',
  initialAmountMin = null,
  initialAmountMax = null,
  title,
  description,
}: RuleDialogProps) {
  const editing = !!ruleId
  const initialAmounts = fromSignedBounds(initialAmountMin, initialAmountMax)

  // If — conditions
  const [matcher, setMatcher] = useState(initialMatcher)
  const [matchField, setMatchField] = useState(initialMatchField)
  const [matchType, setMatchType] = useState(initialMatchType)
  const [amountOpen, setAmountOpen] = useState(initialAmounts.direction !== 'any')
  const [direction, setDirection] = useState<Direction>(initialAmounts.direction)
  const [amountLow, setAmountLow] = useState(initialAmounts.low)
  const [amountHigh, setAmountHigh] = useState(initialAmounts.high)

  // Then — action
  const [categoryId, setCategoryId] = useState(initialCategoryId)

  const [applyExisting, setApplyExisting] = useState(true)
  const [saving, setSaving] = useState(false)

  const [merchants, setMerchants] = useState<{ name: string; count: number }[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [preview, setPreview] = useState<TransactionWithRefs[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    fetch('/api/transactions/merchants')
      .then((r) => r.json())
      .then((d) => setMerchants(d.merchants ?? []))
      .catch(console.error)
  }, [])

  const bounds = useMemo(
    () => toSignedBounds(amountOpen ? direction : 'any', amountLow, amountHigh),
    [amountOpen, direction, amountLow, amountHigh]
  )

  // Live preview of every condition combined — what this rule will actually touch
  useEffect(() => {
    const query = matcher.trim()
    if (query.length < 2) {
      setPreview(null)
      return
    }
    setPreviewLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/transactions?q=${encodeURIComponent(query)}&limit=100`
        )
        const data = await response.json()
        const field = matchField === 'merchant' ? 'merchant_name' : 'description'
        const needle = query.toLowerCase()
        const matches = (data.transactions ?? []).filter((t: TransactionWithRefs) => {
          const value = String(t[field] ?? '').toLowerCase()
          const textOk = matchType === 'exact' ? value === needle : value.includes(needle)
          if (!textOk) return false
          if (bounds.amount_min != null && t.amount < bounds.amount_min) return false
          if (bounds.amount_max != null && t.amount > bounds.amount_max) return false
          return true
        })
        setPreview(matches)
      } catch {
        setPreview(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 350)
    return () => clearTimeout(timeout)
  }, [matcher, matchField, matchType, bounds])

  const suggestions = merchants
    .filter((m) => m.name.toLowerCase().includes(matcher.trim().toLowerCase()))
    .slice(0, 6)

  const groupedCategories = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const c of categories) {
      const key = c.group_name || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()]
  }, [categories])

  const targetCategory = categories.find((c) => c.id === categoryId)
  const previewCount = preview?.length ?? 0
  const previewCapped = previewCount >= 100
  const wouldChange = (preview ?? []).filter((t) => t.category_id !== categoryId).length

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!matcher.trim() || !categoryId) return
    setSaving(true)
    try {
      const response = await fetch('/api/rules', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: ruleId } : {}),
          matcher: matcher.trim(),
          match_field: matchField,
          match_type: matchType,
          amount_min: bounds.amount_min,
          amount_max: bounds.amount_max,
          category_id: categoryId,
          apply: applyExisting,
        }),
      })
      if (!response.ok) throw new Error('failed')
      const { rule, applied } = await response.json()
      toast.success(
        `Rule ${editing ? 'updated' : 'created'}${applied > 0 ? ` — ${applied} matching transactions recategorized` : ''}`
      )
      onSaved(rule)
    } catch {
      toast.error(`Failed to ${editing ? 'update' : 'create'} rule`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{title ?? (editing ? 'Edit rule' : 'New rule')}</DialogTitle>
          <DialogDescription>
            {description ??
              'When a transaction matches every condition, it gets categorized automatically — on future imports, and optionally across your existing history.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* ---- IF ---- */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              If a transaction matches
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Select value={matchField} onValueChange={(v) => setMatchField(v as 'merchant' | 'description')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merchant">Vendor name</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                </SelectContent>
              </Select>
              <Select value={matchType} onValueChange={(v) => setMatchType(v as 'contains' | 'exact')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">contains</SelectItem>
                  <SelectItem value="exact">is exactly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Input
                required
                autoComplete="off"
                placeholder="e.g. Starbucks"
                value={matcher}
                onChange={(e) => setMatcher(e.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
              />
              {suggestOpen && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                  {suggestions.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setMatcher(m.name)
                        setSuggestOpen(false)
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="truncate">{m.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {m.count}×
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {amountOpen ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">and the amount is</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    aria-label="Remove amount condition"
                    onClick={() => {
                      setAmountOpen(false)
                      setDirection('any')
                      setAmountLow('')
                      setAmountHigh('')
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">An expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="min"
                      value={amountLow}
                      onChange={(e) => setAmountLow(e.target.value)}
                      className="pl-7"
                      aria-label="Minimum amount"
                    />
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="max"
                      value={amountHigh}
                      onChange={(e) => setAmountHigh(e.target.value)}
                      className="pl-7"
                      aria-label="Maximum amount"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave min/max empty to match any {direction === 'income' ? 'income' : 'expense'} amount.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setAmountOpen(true)
                  setDirection('expense')
                }}
              >
                <Plus className="size-3.5" />
                Add amount condition
              </Button>
            )}
          </div>

          {/* ---- THEN ---- */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Then set the category to
            </p>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {groupedCategories.map(([group, rows]) => (
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
              </SelectContent>
            </Select>
          </div>

          {/* ---- Preview ---- */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            {matcher.trim().length < 2 ? (
              <p className="text-xs text-muted-foreground">
                Type at least 2 characters to preview what this rule will match.
              </p>
            ) : previewLoading ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Checking your transactions…
              </p>
            ) : preview && previewCount > 0 ? (
              <>
                <p className="text-xs font-medium">
                  {previewCount}
                  {previewCapped ? '+' : ''} matching{' '}
                  {previewCount === 1 ? 'transaction' : 'transactions'}
                  {targetCategory && wouldChange > 0 && (
                    <span className="text-muted-foreground"> · {wouldChange} would change category</span>
                  )}
                </p>
                <div className="mt-2 space-y-1.5">
                  {preview.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate">
                        {t.merchant_name ?? t.description}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCurrency(Math.abs(t.amount))}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatDate(t.date, { month: 'short', day: 'numeric' })}
                      </span>
                      {targetCategory && t.category_id !== categoryId && (
                        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                          <span className="max-w-20 truncate">{t.categories?.name ?? '—'}</span>
                          <ArrowRight className="size-3" />
                          <span className="max-w-20 truncate font-medium text-foreground">
                            {targetCategory.name}
                          </span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-border pt-2.5 text-xs">
                  <Checkbox
                    checked={applyExisting}
                    onCheckedChange={(v) => setApplyExisting(v === true)}
                  />
                  Also update these existing transactions now
                </label>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                No existing transactions match — the rule will still apply to future imports.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving || !matcher.trim() || !categoryId} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : editing ? 'Save rule' : 'Create rule'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
