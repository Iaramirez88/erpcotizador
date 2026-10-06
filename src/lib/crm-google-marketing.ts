import crypto from 'node:crypto'
import { decryptChannelSecret, encryptChannelSecret } from '@/lib/crm-channel-secrets'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export type GoogleMarketingProduct = 'ADS' | 'ANALYTICS' | 'SEARCH_CONSOLE'

const GOOGLE_IDENTITY_SCOPES = ['openid', 'email']
const GOOGLE_PRODUCT_SCOPES: Record<GoogleMarketingProduct, string> = {
  ADS: 'https://www.googleapis.com/auth/adwords',
  ANALYTICS: 'https://www.googleapis.com/auth/analytics.readonly',
  SEARCH_CONSOLE: 'https://www.googleapis.com/auth/webmasters.readonly',
}

export function parseGoogleMarketingProduct(value: string | null | undefined): GoogleMarketingProduct | null {
  return value === 'ADS' || value === 'ANALYTICS' || value === 'SEARCH_CONSOLE' ? value : null
}

export function getGoogleMarketingProductScope(product: GoogleMarketingProduct) {
  return GOOGLE_PRODUCT_SCOPES[product]
}

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

function requireGoogleMarketingEnv() {
  const clientId = String(process.env.GOOGLE_MARKETING_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.GOOGLE_MARKETING_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim()
  const redirectUri = String(process.env.GOOGLE_MARKETING_REDIRECT_URI || '').trim()

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Configura GOOGLE_MARKETING_CLIENT_ID, GOOGLE_MARKETING_CLIENT_SECRET y GOOGLE_MARKETING_REDIRECT_URI.')
  }

  return { clientId, clientSecret, redirectUri }
}

export function getGoogleMarketingConfigurationStatus() {
  try {
    const config = requireGoogleMarketingEnv()
    return { configured: true, redirectUri: config.redirectUri }
  } catch (error) {
    return {
      configured: false,
      redirectUri: null,
      message: error instanceof Error ? error.message : 'La conexión Google Marketing no está configurada.',
    }
  }
}

export function createGoogleMarketingPkce() {
  const verifier = crypto.randomBytes(64).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge, method: 'S256' as const }
}

export function buildGoogleMarketingOAuthUrl(state: string, product: GoogleMarketingProduct, codeChallenge: string) {
  const { clientId, redirectUri } = requireGoogleMarketingEnv()
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('scope', [...GOOGLE_IDENTITY_SCOPES, GOOGLE_PRODUCT_SCOPES[product]].join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url
}

export async function exchangeGoogleMarketingCode(code: string, codeVerifier: string) {
  const { clientId, clientSecret, redirectUri } = requireGoogleMarketingEnv()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google no devolvió un token utilizable.')
  }
  return payload
}

export async function refreshGoogleMarketingAccessToken(refreshTokenEncrypted: string) {
  const refreshToken = decryptChannelSecret(refreshTokenEncrypted)
  if (!refreshToken) throw new Error('La conexión no tiene un refresh token válido.')

  const { clientId, clientSecret } = requireGoogleMarketingEnv()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'No se pudo renovar el acceso a Google.')
  }
  return payload
}

export async function fetchGoogleMarketingProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => ({}))) as { sub?: string; email?: string; error?: string }
  if (!response.ok || !payload.email) throw new Error(payload.error || 'No se pudo consultar la cuenta de Google.')
  return { accountId: payload.sub || payload.email, email: payload.email }
}

export function encryptGoogleMarketingToken(value: string | null | undefined) {
  return value ? encryptChannelSecret(value) : null
}

export function decryptGoogleMarketingToken(value: string | null | undefined) {
  return value ? decryptChannelSecret(value) : ''
}
