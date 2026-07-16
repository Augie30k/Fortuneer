/**
 * Client-side helpers shared between the initial Plaid Link flow
 * (ConnectAccountDialog) and the OAuth resume page it may hand off to
 * (app/api/plaid/callback). Plaid's OAuth institutions (Wealthfront, etc.)
 * navigate the whole browser away to the institution and back to
 * PLAID_REDIRECT_URI — a full page load that loses all React state — so the
 * link_token has to be stashed somewhere that survives that round trip.
 */
export const PLAID_OAUTH_LINK_TOKEN_KEY = 'plaid_oauth_link_token'

export async function exchangePlaidPublicToken(
  publicToken: string,
  institution?: { institution_id?: string | null; name?: string | null } | null
): Promise<{ ok: boolean; added: number; modified: number }> {
  const response = await fetch('/api/plaid/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_token: publicToken, institution }),
  })
  if (!response.ok) throw new Error('exchange failed')
  return response.json()
}
