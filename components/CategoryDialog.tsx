'use client'

import { useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'
import CategoryIcon, { PICKER_ICONS } from '@/components/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const CATEGORY_COLORS = [
  '#0071E3', '#248A3D', '#FF9500', '#AF52DE', '#FF375F', '#30B0C7', '#8E8E93',
]
export const DEFAULT_GROUPS = ['Essentials', 'Lifestyle', 'Financial', 'Other']
export const NEW_GROUP = '__new__'

interface CategoryDialogProps {
  mode: 'create' | 'edit'
  category?: Category
  existingGroups: string[]
  defaultGroup?: string
  onSaved: (category: Category) => void
  onDeleted?: (id: string) => void
}

/** Create or edit a category — icon picker, color, group. Shared by Settings and Budgets. */
export default function CategoryDialog({
  mode,
  category,
  existingGroups,
  defaultGroup,
  onSaved,
  onDeleted,
}: CategoryDialogProps) {
  const isBuiltIn = mode === 'edit' && category?.user_id === null
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0])
  const [icon, setIcon] = useState(category?.icon ?? 'circle-ellipsis')
  const [group, setGroup] = useState(category?.group_name ?? defaultGroup ?? 'Other')
  const [customGroup, setCustomGroup] = useState('')
  const [isIncome, setIsIncome] = useState(category?.is_income ?? false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // "Income" is a single reserved group, not a pickable name — an income
  // category always lands there (enforced server-side too); an expense
  // category picking "Income" would create a confusing second, unrelated
  // group with the same name.
  const groups = [...new Set([...DEFAULT_GROUPS, ...existingGroups])].filter((g) => g !== 'Income')

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return
    const groupName = isIncome
      ? 'Income'
      : group === NEW_GROUP
        ? customGroup.trim() || 'Other'
        : group
    setSaving(true)
    try {
      const url = mode === 'create' ? '/api/categories' : `/api/categories/${category!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          color,
          icon,
          group_name: groupName,
          is_income: isIncome,
        }),
      })
      if (!response.ok) throw new Error('failed')
      const saved = await response.json()
      toast.success(
        mode === 'create'
          ? 'Category created'
          : saved.forked
            ? 'Personalized copy saved'
            : 'Category updated'
      )
      onSaved(saved)
    } catch {
      toast.error(mode === 'create' ? 'Failed to create category' : 'Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!category) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('failed')
      toast.success('Category deleted')
      onDeleted?.(category.id)
    } catch {
      toast.error('Failed to delete category')
      setDeleting(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New category' : `Edit ${category?.name}`}</DialogTitle>
          <DialogDescription>
            {isBuiltIn
              ? 'This is a built-in category — saving creates your own personalized copy, and your past transactions move with it.'
              : 'Choose a name, icon, color, and group.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hobbies"
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {PICKER_ICONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={`Icon ${key}`}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent',
                    icon === key && 'bg-primary/10 ring-1 ring-primary'
                  )}
                >
                  <CategoryIcon icon={key} color={icon === key ? color : undefined} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    'size-6 rounded-full transition-transform',
                    color === c && 'scale-110 ring-2 ring-ring ring-offset-1 ring-offset-card'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {!isIncome && (
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger className="ml-auto h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_GROUP}>+ New group…</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {!isIncome && group === NEW_GROUP && (
            <Input
              placeholder="New group name (e.g. Kids, Business)"
              value={customGroup}
              onChange={(e) => setCustomGroup(e.target.value)}
              className="h-8 text-sm"
            />
          )}

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="min-w-0 flex-1 pr-3">
              <span className="block text-sm font-medium">Income category</span>
              <span className="block text-xs text-muted-foreground">
                {isIncome
                  ? 'Tracked in the Income group on the Budgets page, against what you expect to earn.'
                  : 'Money coming in, not spending — e.g. salary, freelance income, refunds.'}
              </span>
            </span>
            <Switch checked={isIncome} onCheckedChange={setIsIncome} />
          </label>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="submit" disabled={saving || !name.trim()} className="w-full">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === 'create' ? (
              'Create category'
            ) : (
              'Save changes'
            )}
          </Button>
          {mode === 'edit' && !isBuiltIn && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full text-destructive hover:text-destructive"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />}
              Delete category
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
