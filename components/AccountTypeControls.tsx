'use client'

import type { AccountType } from '@/lib/types'
import { FREQUENCIES, LIABILITY_TYPES, TYPE_META, TYPE_ORDER } from '@/lib/account-types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function TypeCard({
  type,
  active,
  onClick,
}: {
  type: AccountType
  active: boolean
  onClick: () => void
}) {
  const Meta = TYPE_META[type]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
      )}
    >
      <span
        className="flex size-8 items-center justify-center rounded-lg transition-shadow"
        style={{
          backgroundColor: `color-mix(in srgb, ${Meta.color} 15%, transparent)`,
          boxShadow: `0 4px 10px -2px color-mix(in srgb, ${Meta.color} ${active ? 60 : 30}%, transparent)`,
        }}
      >
        <Meta.icon className="size-4" style={{ color: Meta.color }} />
      </span>
      <span className={cn('text-xs font-medium', active && 'text-primary')}>{Meta.label}</span>
    </button>
  )
}

export function TypePicker({
  value,
  onChange,
}: {
  value: AccountType
  onChange: (t: AccountType) => void
}) {
  const assetTypes = TYPE_ORDER.filter((t) => !LIABILITY_TYPES.has(t))
  const liabilityTypes = TYPE_ORDER.filter((t) => LIABILITY_TYPES.has(t))

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Assets
        </p>
        <div className="grid grid-cols-3 gap-2">
          {assetTypes.map((t) => (
            <TypeCard key={t} type={t} active={value === t} onClick={() => onChange(t)} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Liabilities
        </p>
        <div className="grid grid-cols-2 gap-2">
          {liabilityTypes.map((t) => (
            <TypeCard key={t} type={t} active={value === t} onClick={() => onChange(t)} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ApyFields({
  apy,
  frequency,
  onApy,
  onFrequency,
  isLiability = false,
}: {
  apy: string
  frequency: string
  onApy: (v: string) => void
  onFrequency: (v: string) => void
  isLiability?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="apy">{isLiability ? 'APR' : 'APY'} % (optional)</Label>
        <Input
          id="apy"
          type="number"
          min="0"
          max="100"
          step="0.001"
          placeholder="0"
          value={apy}
          onChange={(e) => onApy(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Compounds</Label>
        <Select value={frequency} onValueChange={onFrequency}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
