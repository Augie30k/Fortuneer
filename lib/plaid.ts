import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'

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
