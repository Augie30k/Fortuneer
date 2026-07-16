'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link'
import { Loader2 } from 'lucide-react'
import { PLAID_OAUTH_LINK_TOKEN_KEY, exchangePlaidPublicToken } from '@/lib/plaid-link'

/**
 * Redirect target registered with Plaid (https://fortuneer.app/api/plaid/callback).
 * OAuth institutions (Wealthfront, etc.) send the whole browser off-site for
 * their own auth step, then bounce it back here with an `oauth_state_id`
 * query param. We reopen Link with the *same* link_token stashed in
 * sessionStorage before we left, plus `receivedRedirectUri` set to this
 * page's full URL, which lets Plaid resume the flow right where it left off
 * instead of restarting it.
 */
function PlaidOAuthResume() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(PLAID_OAUTH_LINK_TOKEN_KEY)
    const oauthStateId = searchParams.get('oauth_state_id')
    if (!stored || !oauthStateId) {
      setFailed(true)
      return
    }
    setLinkToken(stored)
  }, [searchParams])

  const { open, ready, error } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: typeof window !== 'undefined' ? window.location.href : undefined,
    onSuccess: async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      sessionStorage.removeItem(PLAID_OAUTH_LINK_TOKEN_KEY)
      try {
        await exchangePlaidPublicToken(publicToken, metadata.institution)
        router.replace('/accounts?plaid=success')
      } catch (err) {
        console.error('Error exchanging public token after OAuth resume:', err)
        router.replace('/accounts?plaid=error')
      }
    },
    onExit: () => {
      sessionStorage.removeItem(PLAID_OAUTH_LINK_TOKEN_KEY)
      router.replace('/accounts?plaid=error')
    },
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  useEffect(() => {
    if (failed || error) router.replace('/accounts?plaid=error')
  }, [failed, error, router])

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Reconnecting your bank…
    </div>
  )
}

export default function PlaidCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PlaidOAuthResume />
    </Suspense>
  )
}
