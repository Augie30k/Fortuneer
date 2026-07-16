'use client'
/* eslint-disable @next/next/no-img-element */

import type { AccountWithItem, AccountType, NetWorthPoint } from '@/lib/types'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import {
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Unplug,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TYPE_META, TYPE_ORDER, LIABILITY_TYPES } from '@/lib/account-types'
import { ApyFields } from '@/components/AccountTypeControls'
import ConnectAccountDialog from '@/components/ConnectAccountDialog'
import NetWorthChart from '@/components/charts/NetWorthChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const RANGES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

/**
 * Surfaces a toast once we land back here from app/api/plaid/callback (the
 * OAuth resume page) and strips the ?plaid= param so a refresh doesn't
 * re-fire it. Needs its own component + Suspense boundary since
 * useSearchParams requires one.
 */
function PlaidOAuthResultToast({ onRefresh }: { onRefresh: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const result = searchParams.get('plaid')
    if (!result) return
    if (result === 'success') {
      toast.success('Bank connected')
      onRefresh()
    } else if (result === 'error') {
      toast.error('Failed to connect account. Please try again.')
    }
    router.replace('/accounts')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return null
}

export default function AccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountWithItem[]>([])
  const [history, setHistory] = useState<NetWorthPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connectingAccount, setConnectingAccount] = useState(false)
  const [editing, setEditing] = useState<AccountWithItem | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState<AccountWithItem | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  const [view, setView] = useState('networth')
  const [range, setRange] = useState('6m')
  const [typeFilter, setTypeFilter] = useState<Set<AccountType>>(new Set())

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      setAccounts(data.accounts ?? [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    setChartLoading(true)
    try {
      const params = new URLSearchParams({ range })
      if (typeFilter.size > 0) params.set('types', [...typeFilter].join(','))
      const response = await fetch(`/api/networth?${params}`)
      const data = await response.json()
      setHistory(data.history ?? [])
    } catch (error) {
      console.error('Error fetching net worth history:', error)
    } finally {
      setChartLoading(false)
    }
  }, [range, typeFilter])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/plaid/sync', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error('sync failed')
      toast.success(
        data.added + data.modified > 0
          ? `Synced — ${data.added} new, ${data.modified} updated`
          : 'Everything up to date'
      )
      fetchAccounts()
      fetchHistory()
    } catch {
      toast.error('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const patchAccount = async (id: string, body: Record<string, unknown>, message: string) => {
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('failed')
      toast.success(message)
      fetchAccounts()
    } catch {
      toast.error('Update failed')
    }
  }

  const deleteAccount = async (account: AccountWithItem) => {
    try {
      const response = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      toast.success(`${account.name} deleted`)
      fetchAccounts()
      fetchHistory()
    } catch {
      toast.error('Failed to delete account')
    }
  }

  const disconnectInstitution = async (account: AccountWithItem) => {
    if (!account.plaid_item_id) return
    try {
      const response = await fetch(`/api/plaid/items?id=${account.plaid_item_id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('failed')
      toast.success(
        `${account.plaid_items?.institution_name ?? 'Institution'} disconnected — its accounts and transactions were removed`
      )
      fetchAccounts()
      fetchHistory()
    } catch {
      toast.error('Failed to disconnect institution')
    }
  }

  const visibleAccounts = useMemo(
    () => accounts.filter((a) => showHidden || !a.hidden),
    [accounts, showHidden]
  )
  const hiddenCount = accounts.filter((a) => a.hidden).length

  const groups = useMemo(() => {
    const map = new Map<AccountType, AccountWithItem[]>()
    for (const a of visibleAccounts) {
      const type = (TYPE_ORDER.includes(a.type) ? a.type : 'other') as AccountType
      if (!map.has(type)) map.set(type, [])
      map.get(type)!.push(a)
    }
    return TYPE_ORDER.filter((t) => map.has(t)).map((t) => [t, map.get(t)!] as const)
  }, [visibleAccounts])

  // Breakdown view: composition of assets + liabilities by type (unhidden only)
  const breakdown = useMemo(() => {
    const byType = new Map<AccountType, number>()
    for (const a of accounts) {
      if (a.hidden) continue
      const type = (TYPE_ORDER.includes(a.type) ? a.type : 'other') as AccountType
      byType.set(type, (byType.get(type) ?? 0) + Number(a.balance))
    }
    const rows = TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({
      type: t,
      amount: byType.get(t)!,
      liability: LIABILITY_TYPES.has(t),
    }))
    const assets = rows.filter((r) => !r.liability).reduce((s, r) => s + r.amount, 0)
    const liabilities = rows.filter((r) => r.liability).reduce((s, r) => s + r.amount, 0)
    return { rows, assets, liabilities }
  }, [accounts])

  const netWorth = breakdown.assets - breakdown.liabilities
  const hasLinked = accounts.some((a) => !a.is_manual)

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <PlaidOAuthResultToast
          onRefresh={() => {
            fetchAccounts()
            fetchHistory()
          }}
        />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(netWorth)} net worth across {visibleAccounts.length} accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasLinked && (
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw />}
              Sync
            </Button>
          )}
          <ConnectAccountDialog
            variant="outline"
            onSuccess={() => {
              fetchAccounts()
              fetchHistory()
            }}
          />
        </div>
      </div>

      {/* Overview: flip between net worth trend and composition breakdown */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-8">
              <TabsTrigger value="networth" className="px-3 text-xs">
                Net worth
              </TabsTrigger>
              <TabsTrigger value="breakdown" className="px-3 text-xs">
                Breakdown
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === 'networth' && (
            <Tabs value={range} onValueChange={setRange} className="ml-auto">
              <TabsList className="h-8">
                {RANGES.map((r) => (
                  <TabsTrigger key={r.value} value={r.value} className="px-2.5 text-xs">
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {view === 'networth' && (
            <>
              {/* Type filter chips scope the trend */}
              <div className="flex flex-wrap gap-1.5">
                {TYPE_ORDER.filter((t) => accounts.some((a) => a.type === t && !a.hidden)).map(
                  (t) => {
                    const active = typeFilter.has(t)
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const next = new Set(typeFilter)
                          if (active) next.delete(t)
                          else next.add(t)
                          setTypeFilter(next)
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {TYPE_META[t].label}
                      </button>
                    )
                  }
                )}
                {typeFilter.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter(new Set())}
                    className="px-2 py-1 text-xs font-medium text-primary hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className={cn('transition-opacity', chartLoading && 'opacity-60')}>
                {history.length > 1 ? (
                  <NetWorthChart data={history} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Trend appears after a couple of days of syncing.
                  </p>
                )}
              </div>
            </>
          )}

          {view === 'breakdown' && (
            <div className="space-y-4">
              {/* Composition bar: assets by type, with 2px surface gaps */}
              {breakdown.assets > 0 && (
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Assets</p>
                    <p className="text-sm font-semibold text-positive">
                      {formatCurrency(breakdown.assets)}
                    </p>
                  </div>
                  <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                    {breakdown.rows
                      .filter((r) => !r.liability && r.amount > 0)
                      .map((r) => (
                        <div
                          key={r.type}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{
                            width: `${(r.amount / breakdown.assets) * 100}%`,
                            backgroundColor: TYPE_META[r.type].color,
                          }}
                          title={`${TYPE_META[r.type].label}: ${formatCurrency(r.amount)}`}
                        />
                      ))}
                  </div>
                </div>
              )}
              {breakdown.liabilities > 0 && (
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Liabilities</p>
                    <p className="text-sm font-semibold text-negative">
                      {formatCurrency(breakdown.liabilities)}
                    </p>
                  </div>
                  <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                    {breakdown.rows
                      .filter((r) => r.liability && r.amount > 0)
                      .map((r) => (
                        <div
                          key={r.type}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{
                            width: `${(r.amount / breakdown.liabilities) * 100}%`,
                            backgroundColor: TYPE_META[r.type].color,
                          }}
                          title={`${TYPE_META[r.type].label}: ${formatCurrency(r.amount)}`}
                        />
                      ))}
                  </div>
                </div>
              )}
              {/* Legend list — identity via colored dot, text in text tokens */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {breakdown.rows.map((r) => (
                  <div key={r.type} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_META[r.type].color }}
                    />
                    <span className="text-muted-foreground">{TYPE_META[r.type].label}</span>
                    <span className="ml-auto font-medium tabular-nums">
                      {r.liability ? '-' : ''}
                      {formatCurrency(r.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            {connectingAccount ? (
              <>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </span>
                <div>
                  <p className="font-medium">Setting up your account</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Importing accounts and transactions — this takes just a few seconds.
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Landmark className="size-6 text-primary" />
                </span>
                <div>
                  <p className="font-medium">Connect your first account</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Link a bank securely with Plaid, or track one manually.
                  </p>
                </div>
                <ConnectAccountDialog
                  onConnecting={() => setConnectingAccount(true)}
                  onError={() => setConnectingAccount(false)}
                  onSuccess={() => {
                    Promise.all([fetchAccounts(), fetchHistory()]).finally(() =>
                      setConnectingAccount(false)
                    )
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Grouped by type */}
          {groups.map(([type, rows]) => {
            const Meta = TYPE_META[type]
            const total = rows.reduce((s, a) => s + Number(a.balance), 0)
            return (
              <Card key={type}>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${Meta.color} 15%, transparent)`,
                      }}
                    >
                      <Meta.icon className="size-4" style={{ color: Meta.color }} />
                    </span>
                    {Meta.label}
                    <span className="ml-auto font-normal text-muted-foreground">
                      {LIABILITY_TYPES.has(type) ? '-' : ''}
                      {formatCurrency(total)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {rows.map((account, i) => (
                    <div key={account.id}>
                      {i > 0 && <Separator />}
                      <div
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(`/accounts/${account.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') router.push(`/accounts/${account.id}`)
                        }}
                        className={cn(
                          '-mx-4 flex cursor-pointer items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-accent',
                          account.hidden && 'opacity-50'
                        )}
                      >
                        {!account.is_manual && account.plaid_items?.logo_url ? (
                          <img
                            src={account.plaid_items.logo_url}
                            alt=""
                            className="size-8 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${Meta.color} 15%, transparent)`,
                            }}
                          >
                            <Meta.icon className="size-4" style={{ color: Meta.color }} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {account.name}
                            {account.mask && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ••{account.mask}
                              </span>
                            )}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {account.is_manual
                                ? 'Manual'
                                : (account.plaid_items?.institution_name ?? 'Linked')}
                            </Badge>
                            {account.subtype && (
                              <span className="text-xs text-muted-foreground capitalize">
                                {account.subtype}
                              </span>
                            )}
                            {Number(account.apy) > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                {Number(account.apy)}% APY · {account.compound_frequency}
                              </Badge>
                            )}
                            {account.hidden && (
                              <Badge variant="outline" className="text-[10px]">
                                Hidden
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <div className="text-right">
                            <p className="text-lg font-semibold tabular-nums">
                              {formatCurrency(Number(account.balance), account.currency)}
                            </p>
                            {account.available_balance != null && (
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(
                                  Number(account.available_balance),
                                  account.currency
                                )}{' '}
                                available
                              </p>
                            )}
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Manage ${account.name}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {account.is_manual && (
                                  <DropdownMenuItem onClick={() => setEditing(account)}>
                                    <Pencil />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() =>
                                    patchAccount(
                                      account.id,
                                      { hidden: !account.hidden },
                                      account.hidden ? 'Account unhidden' : 'Account hidden'
                                    )
                                  }
                                >
                                  {account.hidden ? <Eye /> : <EyeOff />}
                                  {account.hidden ? 'Unhide' : 'Hide'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {account.is_manual ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => deleteAccount(account)}
                                  >
                                    <Trash2 />
                                    Delete account
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setConfirmDisconnect(account)}
                                  >
                                    <Unplug />
                                    Disconnect{' '}
                                    {account.plaid_items?.institution_name ?? 'institution'}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHidden(!showHidden)}
              className="text-muted-foreground"
            >
              {showHidden ? <EyeOff /> : <Eye />}
              {showHidden ? 'Hide' : 'Show'} {hiddenCount} hidden{' '}
              {hiddenCount === 1 ? 'account' : 'accounts'}
            </Button>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <EditAccountDialog
            account={editing}
            onSuccess={() => {
              setEditing(null)
              fetchAccounts()
              fetchHistory()
            }}
          />
        )}
      </Dialog>

      <AlertDialog
        open={!!confirmDisconnect}
        onOpenChange={(open) => !open && setConfirmDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {confirmDisconnect?.plaid_items?.institution_name ?? 'this institution'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes all of its accounts and their transactions from Fortuneer and
              revokes access at the bank. You can reconnect later, but history since
              disconnecting won&apos;t backfill automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirmDisconnect) disconnectInstitution(confirmDisconnect)
                  setConfirmDisconnect(null)
                }}
              >
                Disconnect
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EditAccountDialog({
  account,
  onSuccess,
}: {
  account: AccountWithItem
  onSuccess: () => void
}) {
  const [name, setName] = useState(account.name)
  const [balance, setBalance] = useState(String(account.balance))
  const [apy, setApy] = useState(Number(account.apy) > 0 ? String(account.apy) : '')
  const [frequency, setFrequency] = useState<string>(account.compound_frequency ?? 'monthly')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          balance: parseFloat(balance) || 0,
          apy: apy ? parseFloat(apy) : 0,
          compound_frequency: frequency,
        }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success('Account updated')
      onSuccess()
    } catch {
      toast.error('Failed to update account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Edit {account.name}</DialogTitle>
          <DialogDescription>Manual account details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-balance">Balance</Label>
            <Input
              id="edit-balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <ApyFields
            apy={apy}
            frequency={frequency}
            onApy={setApy}
            onFrequency={setFrequency}
            isLiability={LIABILITY_TYPES.has(account.type)}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
