import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode, JWKPublicKey } from 'plaid'
import { createHash } from 'crypto'
import { importJWK, decodeProtectedHeader, jwtVerify } from 'jose'

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
})

export const plaidClient = new PlaidApi(configuration)

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
