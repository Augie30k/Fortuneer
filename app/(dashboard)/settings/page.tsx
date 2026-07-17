'use client'

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Check,
  Download,
  GripVertical,
  Landmark,
  Loader2,
  Lock,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  Unplug,
  X,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Category, PlaidItemSummary, Profile, RuleWithCategory } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import CategoryIcon from '@/components/CategoryIcon'
import CategoryDialog, { NEW_GROUP } from '@/components/CategoryDialog'
import RuleDialog from '@/components/RuleDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']

type ThemeChoice = 'light' | 'dark' | 'system'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [originalName, setOriginalName] = useState('')
  const [originalCurrency, setOriginalCurrency] = useState('USD')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [loading, setLoading] = useState(true)

  const [theme, setTheme] = useState<ThemeChoice>('system')
  const [rules, setRules] = useState<RuleWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [institutions, setInstitutions] = useState<PlaidItemSummary[]>([])
  const [categoryDialog, setCategoryDialog] = useState<
    { mode: 'create' | 'edit'; category?: Category; startInNewGroup?: boolean } | null
  >(null)
  const [ruleDialog, setRuleDialog] = useState<{ rule?: RuleWithCategory } | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then((r) => r.json()),
      fetch('/api/rules').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/plaid/items').then((r) => r.json()),
    ])
      .then(([p, r, c, i]) => {
        setProfile(p)
        setFullName(p?.full_name ?? '')
        setCurrency(p?.currency ?? 'USD')
        setOriginalName(p?.full_name ?? '')
        setOriginalCurrency(p?.currency ?? 'USD')
        setRules(r.rules ?? [])
        setCategories(c.categories ?? [])
        setInstitutions(i.items ?? [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    try {
      const saved = localStorage.getItem('theme') as ThemeChoice | null
      setTheme(saved === 'light' || saved === 'dark' ? saved : 'system')
    } catch {}
  }, [])

  const applyTheme = (choice: ThemeChoice) => {
    setTheme(choice)
    try {
      if (choice === 'system') {
        localStorage.removeItem('theme')
        document.documentElement.classList.toggle(
          'dark',
          matchMedia('(prefers-color-scheme: dark)').matches
        )
      } else {
        localStorage.setItem('theme', choice)
        document.documentElement.classList.toggle('dark', choice === 'dark')
      }
    } catch {}
  }

  const profileDirty = fullName !== originalName || currency !== originalCurrency

  const cancelEditProfile = () => {
    setFullName(originalName)
    setCurrency(originalCurrency)
    setEditingProfile(false)
  }

  const saveProfile = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!profileDirty) return
    setSavingProfile(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, currency }),
      })
      if (!response.ok) throw new Error('failed')
      setOriginalName(fullName)
      setOriginalCurrency(currency)
      setEditingProfile(false)
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const deleteRule = async (id: string) => {
    try {
      const response = await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      setRules((prev) => prev.filter((r) => r.id !== id))
      toast.success('Rule deleted')
    } catch {
      toast.error('Failed to delete rule')
    }
  }

  const refetchCategories = async () => {
    const data = await fetch('/api/categories').then((r) => r.json())
    setCategories(data.categories ?? [])
  }

  const disconnect = async (item: PlaidItemSummary) => {
    try {
      const response = await fetch(`/api/plaid/items?id=${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      setInstitutions((prev) => prev.filter((i) => i.id !== item.id))
      toast.success(`${item.institution_name ?? 'Institution'} disconnected`)
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const deleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const response = await fetch('/api/profile', { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Failed to delete account')
      setDeletingAccount(false)
    }
  }

  // Only categories the user created from scratch — personal forks of
  // built-ins (renames/recolors) would otherwise flood this list
  const customCategories = categories.filter((c) => c.user_id !== null && !c.forked_from)

  // Budget groups, in their current order — reorder-only, categories aren't
  // rendered here (that lives in the Budgets "Edit budget" sheet)
  const budgetCategories = categories.filter((c) => !c.is_income && !c.is_transfer)
  const groupOrder = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    for (const c of budgetCategories) {
      const key = c.group_name || 'Other'
      if (!seen.has(key)) {
        seen.add(key)
        order.push(key)
      }
    }
    return order
  }, [budgetCategories])

  const persistGroupOrder = async (order: string[]) => {
    const groups = order.map((name) => ({
      name,
      categoryIds: budgetCategories.filter((c) => (c.group_name || 'Other') === name).map((c) => c.id),
    }))
    try {
      const response = await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      })
      if (!response.ok) throw new Error('failed')
      await refetchCategories()
      toast.success('Group order saved')
    } catch {
      toast.error('Failed to save group order')
    }
  }

  const groupSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = groupOrder.indexOf(String(active.id))
    const to = groupOrder.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    persistGroupOrder(arrayMove(groupOrder, from, to))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-80" />
        <div className="max-w-2xl space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Account, preferences, and data</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories & rules</TabsTrigger>
          <TabsTrigger value="connections">Connections & data</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* ---- Account: who you are, how the app looks, account removal ---- */}
        <TabsContent value="account" className="mt-4 max-w-2xl space-y-6">
          <SettingsSection
            title="Profile"
            action={
              !editingProfile && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditingProfile(true)}
                  aria-label="Edit profile"
                >
                  <Pencil className="text-muted-foreground" />
                </Button>
              )
            }
          >
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Name</Label>
                <Input
                  id="full-name"
                  placeholder="Your name"
                  value={fullName}
                  disabled={!editingProfile}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" disabled value={profile?.email ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={!editingProfile}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editingProfile && (
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={!profileDirty || savingProfile}>
                    {savingProfile ? <Loader2 className="size-4 animate-spin" /> : <Check />}
                    Save profile
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelEditProfile}
                    disabled={savingProfile}
                  >
                    <X />
                    Cancel
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Use “Forgot password?” on the sign-in page to change your password.
              </p>
            </form>
          </SettingsSection>

          <SettingsSection title="Appearance">
            <div className="flex gap-2">
              {(
                [
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={theme === value ? 'default' : 'outline'}
                  onClick={() => applyTheme(value)}
                  className="flex-1"
                >
                  <Icon />
                  {label}
                </Button>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="Danger zone">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes {profile?.email ?? 'your account'} and everything
                    tied to it — linked accounts, transactions, budgets, goals, rules, and
                    categories. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="destructive"
                      onClick={deleteAccount}
                      disabled={deletingAccount}
                    >
                      {deletingAccount ? <Loader2 className="size-4 animate-spin" /> : null}
                      Delete account
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </SettingsSection>
        </TabsContent>

        {/* ---- Categories & rules: how transactions get organized ---- */}
        <TabsContent value="categories" className="mt-4 max-w-2xl space-y-6">
          <SettingsSection
            title="Custom categories"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCategoryDialog({ mode: 'create' })}
              >
                <Plus />
                New category
              </Button>
            }
          >
            {customCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom categories yet. Built-in categories can also be renamed or recolored
                from the Budgets page — your changes only affect you.
              </p>
            ) : (
              <div>
                {customCategories.map((c, i) => (
                  <div key={c.id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center gap-3 py-2">
                      <CategoryIcon chip icon={c.icon} color={c.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.group_name || 'Other'}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setCategoryDialog({ mode: 'edit', category: c })}
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil className="text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Budget group"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCategoryDialog({ mode: 'create', startInNewGroup: true })}
              >
                <Plus />
                New group
              </Button>
            }
          >
            {categories.some((c) => c.is_income) && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-sm">
                <Lock className="size-3.5 shrink-0 text-muted-foreground/50" />
                <span className="font-medium">Income</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Pinned above your other groups
                </span>
              </div>
            )}
            {groupOrder.length === 0 ? (
              <p className="text-sm text-muted-foreground">No budget categories yet.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Drag to change the order groups appear in on the Budgets page.
                </p>
                <DndContext
                  sensors={groupSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleGroupDragEnd}
                >
                  <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {groupOrder.map((name) => (
                        <SortableGroupRow key={name} name={name} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </SettingsSection>

          <SettingsSection
            title="Category rules"
            action={
              <Button variant="outline" size="sm" onClick={() => setRuleDialog({})}>
                <Plus />
                New rule
              </Button>
            }
          >
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rules yet. Add one, or use the suggestion that appears after you
                recategorize a transaction — future imports follow rules automatically.
              </p>
            ) : (
              <div>
                {rules.map((rule, i) => (
                  <div key={rule.id}>
                    {i > 0 && <Separator />}
                    <div className="group/rule flex items-center gap-3 py-2.5">
                      <CategoryIcon
                        chip
                        icon={rule.categories?.icon}
                        color={rule.categories?.color}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="text-muted-foreground">
                            {rule.match_field === 'merchant' ? 'Vendor' : 'Description'}{' '}
                            {rule.match_type === 'exact' ? 'is exactly' : 'contains'}{' '}
                          </span>
                          <span className="font-medium">“{rule.matcher}”</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ruleAmountLabel(rule)}→ {rule.categories?.name}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRuleDialog({ rule })}
                        aria-label={`Edit rule for ${rule.matcher}`}
                      >
                        <Pencil className="text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteRule(rule.id)}
                        aria-label="Delete rule"
                      >
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>
        </TabsContent>

        {/* ---- Connections & data: banks and your data ---- */}
        <TabsContent value="connections" className="mt-4 max-w-2xl space-y-6">
          <SettingsSection title="Connected banks">
            {institutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No banks connected. Link one from the Accounts page.
              </p>
            ) : (
              <div>
                {institutions.map((item, i) => (
                  <div key={item.id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <Landmark className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.institution_name ?? 'Institution'}
                          {item.status !== 'good' && (
                            <Badge variant="destructive" className="ml-2 text-[10px]">
                              Needs attention
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.account_count} accounts
                          {item.last_synced_at &&
                            ` · synced ${formatDate(item.last_synced_at.slice(0, 10))}`}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Unplug />
                            Disconnect
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Disconnect {item.institution_name ?? 'this institution'}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes {item.account_count === 1 ? 'its account' : `all ${item.account_count} of its accounts`}{' '}
                              and their transactions from Fortuneer and revokes access at the bank.
                              You can reconnect later, but history since disconnecting won&apos;t backfill
                              automatically.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction asChild>
                              <Button variant="destructive" onClick={() => disconnect(item)}>
                                Disconnect
                              </Button>
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="Your data">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/transactions/export" target="_blank" rel="noreferrer">
                <Download />
                Export all transactions (CSV)
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Transactions can be imported from CSV on the Transactions page.
            </p>
          </SettingsSection>

          <p className="text-center text-xs text-muted-foreground">
            Fortuneer v{process.env.NEXT_PUBLIC_APP_VERSION ?? '2.1.0-beta'}
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={!!categoryDialog} onOpenChange={(open) => !open && setCategoryDialog(null)}>
        {categoryDialog?.mode === 'create' && (
          <CategoryDialog
            mode="create"
            existingGroups={[...new Set(categories.map((c) => c.group_name).filter(Boolean))]}
            defaultGroup={categoryDialog.startInNewGroup ? NEW_GROUP : undefined}
            onSaved={async () => {
              setCategoryDialog(null)
              await refetchCategories()
            }}
          />
        )}
        {categoryDialog?.mode === 'edit' && categoryDialog.category && (
          <CategoryDialog
            mode="edit"
            category={categoryDialog.category}
            existingGroups={[...new Set(categories.map((c) => c.group_name).filter(Boolean))]}
            onSaved={async () => {
              setCategoryDialog(null)
              await refetchCategories()
            }}
            onDeleted={async () => {
              setCategoryDialog(null)
              await refetchCategories()
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!ruleDialog} onOpenChange={(open) => !open && setRuleDialog(null)}>
        {ruleDialog && (
          <RuleDialog
            key={ruleDialog.rule?.id ?? 'new'}
            categories={categories}
            ruleId={ruleDialog.rule?.id}
            initialMatcher={ruleDialog.rule?.matcher ?? ''}
            initialMatchField={ruleDialog.rule?.match_field ?? 'merchant'}
            initialMatchType={ruleDialog.rule?.match_type ?? 'contains'}
            initialAmountMin={ruleDialog.rule?.amount_min ?? null}
            initialAmountMax={ruleDialog.rule?.amount_max ?? null}
            initialCategoryId={ruleDialog.rule?.category_id ?? ''}
            onSaved={(rule) => {
              setRuleDialog(null)
              setRules((prev) =>
                prev.some((r) => r.id === rule.id)
                  ? prev.map((r) => (r.id === rule.id ? rule : r))
                  : [rule, ...prev]
              )
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

/** Short "amount between $X–$Y · " prefix for a rule row, if it has amount conditions */
function ruleAmountLabel(rule: RuleWithCategory): string {
  const min = rule.amount_min != null ? Number(rule.amount_min) : null
  const max = rule.amount_max != null ? Number(rule.amount_max) : null
  if (min == null && max == null) return ''
  const income = max != null && max <= 0
  const lo = income ? (max <= -0.02 ? -max : null) : min != null && min >= 0.02 ? min : null
  const hi = income ? (min != null ? -min : null) : max
  const kind = income ? 'income' : 'expense'
  if (lo != null && hi != null) return `${kind} $${lo}–$${hi} · `
  if (lo != null) return `${kind} ≥ $${lo} · `
  if (hi != null) return `${kind} ≤ $${hi} · `
  return `${kind} · `
}

function SortableGroupRow({ name }: { name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm',
        isDragging && 'z-20 opacity-90 shadow-md ring-2 ring-primary/50'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}`}
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <span className="font-medium">{name}</span>
    </div>
  )
}

function SettingsSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}
