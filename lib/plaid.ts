import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode, JWKPublicKey } from 'plaid'
import { createHash } from 'crypto'
import { importJWK, decodeProtectedHeader, jwtVerify } from 'jose'
import type { AdminEnv } from '@/lib/supabase-admin'

function buildPlaidClient(clientId: string | undefined, secret: string | undefined, env: string) {
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
          'Plaid-Version': '2020-09-14',
        },
      },
    })
  )
}

/** Targets whichever Plaid environment is "live" in .env.local — used by
 *  real user-facing routes, which must never depend on the admin hub's
 *  environment toggle below. */
export const plaidClient = buildPlaidClient(
  process.env.PLAID_CLIENT_ID,
  process.env.PLAID_SECRET,
  process.env.PLAID_ENV || 'sandbox'
)

const adminPlaidClients = new Map<AdminEnv, PlaidApi>()

/** Plaid client for the /admin hub: reaches dev (sandbox) or prod regardless
 *  of which Plaid environment is "live" for the app itself — backed by its
 *  own always-uncommented ADMIN_DEV_PLAID_ / ADMIN_PROD_PLAID_ pair, mirroring
 *  createAdminClientFor in lib/supabase-admin.ts. */
export function getAdminPlaidClient(env: AdminEnv): PlaidApi {
  const cached = adminPlaidClients.get(env)
  if (cached) return cached

  const clientId = env === 'production' ? process.env.ADMIN_PROD_PLAID_CLIENT_ID : process.env.ADMIN_DEV_PLAID_CLIENT_ID
  const secret = env === 'production' ? process.env.ADMIN_PROD_PLAID_SECRET : process.env.ADMIN_DEV_PLAID_SECRET

  if (!clientId || !secret) {
    throw new Error(
      `Missing ADMIN_${env === 'production' ? 'PROD' : 'DEV'}_PLAID_CLIENT_ID/SECRET in .env.local`
    )
  }

  const client = buildPlaidClient(clientId, secret, env === 'production' ? 'production' : 'sandbox')
  adminPlaidClients.set(env, client)
  return client
}

// 'balance' is not a Link product — it comes free with any product.
export const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || 'transactions')
  .split(',')
  .map((p) => p.trim())
  .filter((p): p is Products => p !== 'balance' && Object.values(Products).includes(p as Products))

export const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US')
  .split(',')
  .map((c) => c.trim() as CountryCode)

/** Institution logo as a data URI, or null if Plaid has none / the lookup fails. */
export async function fetchInstitutionLogo(institutionId: string): Promise<string | null> {
  try {
    const { data } = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: PLAID_COUNTRY_CODES,
      options: { include_optional_metadata: true },
    })
    const logo = data.institution?.logo
    return logo ? `data:image/png;base64,${logo}` : null
  } catch (error) {
    console.warn('Institution logo lookup failed:', error)
    return null
  }
}

export class WebhookVerificationError extends Error {}

// Plaid webhook signing keys don't rotate in place — once fetched by kid, a
// key is valid forever, so caching for the life of the process is correct.
const webhookKeyCache = new Map<string, JWKPublicKey>()

/** Verifies a Plaid webhook's `Plaid-Verification` JWT and body hash; throws WebhookVerificationError on failure. */
export async function verifyPlaidWebhook(rawBody: string, signedJwt: string | null): Promise<void> {
  if (!signedJwt) throw new WebhookVerificationError('Missing Plaid-Verification header')

  let kid: string | undefined
  try {
    ;({ kid } = decodeProtectedHeader(signedJwt))
  } catch {
    throw new WebhookVerificationError('Malformed webhook JWT')
  }
  if (!kid) throw new WebhookVerificationError('Missing kid in webhook JWT header')

  let key = webhookKeyCache.get(kid)
  if (!key) {
    const { data } = await plaidClient.webhookVerificationKeyGet({ key_id: kid })
    key = data.key
    webhookKeyCache.set(kid, key)
  }

  if (key.alg !== 'ES256') {
    throw new WebhookVerificationError(`Unsupported webhook key algorithm: ${key.alg}`)
  }

  let payload
  try {
    const publicKey = await importJWK(key, 'ES256')
    ;({ payload } = await jwtVerify(signedJwt, publicKey, {
      algorithms: ['ES256'],
      maxTokenAge: '5 min',
    }))
  } catch (error) {
    throw new WebhookVerificationError(`Webhook JWT verification failed: ${error}`)
  }

  const bodyHash = createHash('sha256').update(rawBody).digest('hex')
  if (payload.request_body_sha256 !== bodyHash) {
    throw new WebhookVerificationError('Webhook body hash mismatch')
  }
}
