'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link'
import { toast } from 'sonner'
import { Landmark, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlaidLinkButtonProps {
  onLinked?: () => void
  variant?: 'default' | 'secondary' | 'outline'
  className?: string
}

export default function PlaidLinkButton({ onLinked, variant = 'default', className }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setBusy(true)
      try {
        const response = await fetch('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token: publicToken,
            institution: metadata.institution,
          }),
        })
        if (!response.ok) throw new Error('exchange failed')
        const data = await response.json()
        toast.success(
          `${metadata.institution?.name ?? 'Bank'} connected — ${data.added} transactions imported`
        )
        onLinked?.()
      } catch (error) {
        console.error('Error linking account:', error)
        toast.error('Failed to connect account. Please try again.')
      } finally {
        setBusy(false)
        setLinkToken(null)
      }
    },
    [onLinked]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  })

  // Once the token arrives and Link is ready, open it
  useEffect(() => {
    if (linkToken && ready && !busy) open()
  }, [linkToken, ready, busy, open])

  const startLink = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/plaid/link-token', { method: 'POST' })
      if (!response.ok) throw new Error('link token failed')
      const data = await response.json()
      setLinkToken(data.link_token)
    } catch (error) {
      console.error('Error creating link token:', error)
      toast.error('Could not start bank connection')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={startLink} disabled={busy || !!linkToken} variant={variant} className={className}>
      {busy || linkToken ? <Loader2 className="size-4 animate-spin" /> : <Landmark />}
      Connect bank
    </Button>
  )
}
