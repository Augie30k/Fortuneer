'use client'

import { useCallback, useEffect, useState, type SyntheticEvent } from 'react'
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link'
import { toast } from 'sonner'
import { ArrowLeft, Check, Landmark, Loader2, Sparkles, Wallet } from 'lucide-react'
import type { AccountType } from '@/lib/types'
import { LIABILITY_TYPES, SUBTYPE_OPTIONS } from '@/lib/account-types'
import { cn } from '@/lib/utils'
import { TypePicker, ApyFields } from '@/components/AccountTypeControls'
import { PLAID_OAUTH_LINK_TOKEN_KEY, exchangePlaidPublicToken } from '@/lib/plaid-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type Step = 'choose' | 'manual'

/**
 * "Connect bank" entry point: a picker between connection platforms (Plaid
 * is the only one for now, but this is where more would slot in) and a
 * manual account — rather than jumping straight into the Plaid popup.
 */
export default function ConnectAccountDialog({
  onSuccess,
  onConnecting,
  onError,
  variant = 'default',
  className,
}: {
  onSuccess?: () => void
  /** Fired the moment the user finishes picking a bank in Plaid Link — the
   *  popup is gone but exchange+initial sync (a few seconds) hasn't
   *  finished, so the caller can show its own "setting up your account"
   *  state instead of looking stuck. Only onSuccess OR onError follows —
   *  whichever the caller uses to clear that state, it fires exactly once. */
  onConnecting?: () => void
  onError?: () => void
  variant?: 'default' | 'secondary' | 'outline'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('choose')
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [connectingPlaid, setConnectingPlaid] = useState(false)

  const reset = () => {
    setStep('choose')
    setLinkToken(null)
    setConnectingPlaid(false)
    sessionStorage.removeItem(PLAID_OAUTH_LINK_TOKEN_KEY)
  }

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setConnectingPlaid(true)
      onConnecting?.()
      try {
        const data = await exchangePlaidPublicToken(publicToken, metadata.institution)
        toast.success(
          `${metadata.institution?.name ?? 'Bank'} connected — ${data.added} transactions imported`
        )
        onSuccess?.()
      } catch (error) {
        console.error('Error linking account:', error)
        toast.error('Failed to connect account. Please try again.')
        onError?.()
      } finally {
        reset()
      }
    },
    [onSuccess, onConnecting, onError]
  )

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => reset(),
  })

  // Once the token arrives and Link is ready, open Plaid's own overlay —
  // our picker dialog is already closed by then
  useEffect(() => {
    if (linkToken && plaidReady && !connectingPlaid) openPlaidLink()
  }, [linkToken, plaidReady, connectingPlaid, openPlaidLink])

  const startPlaid = async () => {
    setConnectingPlaid(true)
    try {
      const response = await fetch('/api/plaid/link-token', { method: 'POST' })
      if (!response.ok) throw new Error('link token failed')
      const data = await response.json()
      setOpen(false)
      // Stashed so app/api/plaid/callback can resume this same Link session
      // if the user picks an OAuth institution and gets bounced off-site.
      sessionStorage.setItem(PLAID_OAUTH_LINK_TOKEN_KEY, data.link_token)
      setLinkToken(data.link_token)
    } catch (error) {
      console.error('Error creating link token:', error)
      toast.error('Could not start bank connection')
    } finally {
      // Only gates the brief token fetch — once linkToken/ready are set,
      // this must be false or the effect below never opens Plaid's overlay
      setConnectingPlaid(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setStep('choose')
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={variant}
          className={cn('bg-[#0071E3] text-white hover:bg-[#0071E3]/90', className)}
        >
          <Landmark />
          Connect bank
        </Button>
      </DialogTrigger>

      {step === 'choose' ? (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect an account</DialogTitle>
            <DialogDescription>Choose how you&apos;d like to add it.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={startPlaid}
              disabled={connectingPlaid}
              className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-transparent hover:bg-accent disabled:opacity-60"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                {connectingPlaid ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Landmark className="size-4 text-primary" />
                )}
              </span>
              <span className="text-sm font-medium">Bank connection</span>
              <span className="text-xs text-muted-foreground">
                Securely link with Plaid — balances and transactions sync automatically.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStep('manual')}
              className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-transparent hover:bg-accent"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                <Wallet className="size-4 text-muted-foreground" />
              </span>
              <span className="text-sm font-medium">Manual account</span>
              <span className="text-xs text-muted-foreground">
                Track a balance yourself — cash, property, anything else.
              </span>
            </button>
          </div>
        </DialogContent>
      ) : (
        <ManualAccountStep
          onBack={() => setStep('choose')}
          onSuccess={() => {
            setOpen(false)
            setStep('choose')
            onSuccess?.()
          }}
        />
      )}
    </Dialog>
  )
}

function ManualAccountStep({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'depository' as AccountType,
    balance: 0,
  })
  const [subtype, setSubtype] = useState('')
  const [earnsInterest, setEarnsInterest] = useState(false)
  const [apy, setApy] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [loading, setLoading] = useState(false)

  const isLiability = LIABILITY_TYPES.has(formData.type)
  const subtypeOptions = SUBTYPE_OPTIONS[formData.type]

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          subtype: subtypeOptions && subtype ? subtype : null,
          apy: earnsInterest && apy ? parseFloat(apy) : 0,
          compound_frequency: frequency,
        }),
      })
      if (!response.ok) throw new Error('failed')
      toast.success('Account added')
      onSuccess()
    } catch {
      toast.error('Failed to add account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onBack}
        aria-label="Back"
        className="absolute top-2 left-2"
      >
        <ArrowLeft />
      </Button>
      <form onSubmit={handleSubmit}>
        <DialogHeader className="pl-7">
          <DialogTitle>Add manual account</DialogTitle>
          <DialogDescription>Track an account without connecting a bank.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label>Account type</Label>
            <TypePicker
              value={formData.type}
              onChange={(t) => {
                setFormData({ ...formData, type: t })
                setSubtype('')
              }}
            />
          </div>

          {subtypeOptions && (
            <div className="space-y-2">
              <Label>Type of {formData.type === 'loan' ? 'liability' : 'asset'}</Label>
              <Select value={subtype} onValueChange={setSubtype}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional — pick one for clarity" />
                </SelectTrigger>
                <SelectContent>
                  {subtypeOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. HYSA, Car loan"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Balance</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) =>
                  setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="rounded-xl border border-border">
            <label className="flex cursor-pointer items-center gap-3 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {isLiability ? 'This account charges interest' : 'This account earns interest'}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {isLiability
                    ? 'Balance grows to reflect interest owed'
                    : 'Balance auto-updates on a schedule'}
                </span>
              </span>
              <Switch checked={earnsInterest} onCheckedChange={setEarnsInterest} />
            </label>
            {earnsInterest && (
              <div className="border-t border-border p-3">
                <ApyFields
                  apy={apy}
                  frequency={frequency}
                  onApy={setApy}
                  onFrequency={setFrequency}
                  isLiability={isLiability}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Check />}
            Add account
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
