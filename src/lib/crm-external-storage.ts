import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'

export type CrmExternalStorageProvider = 'GOOGLE_DRIVE' | 'ONEDRIVE'

export type CrmExternalStorageItem = {
  id: string
  name: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
  updatedAt: string
  type: 'folder' | 'document'
  provider: CrmExternalStorageProvider
}

type SignedExternalStorageState = {
  userId: string
  provider: CrmExternalStorageProvider
  issuedAt: number
}

type StoredToken = {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  providerAccountId: string
  accountLabel: string
}

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function getSecretMaterial() {
  const secret = process.env.CRM_CHANNEL_SECRET || process.env.NEXTAUTH_SECRET || ''
  if (!secret) {
    throw new Error('Falta CRM_CHANNEL_SECRET o NEXTAUTH_SECRET para el selector de Drive/OneDrive.')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

function providerKey(provider: CrmExternalStorageProvider) {
  return provider === 'GOOGLE_DRIVE' ? 'crm-google-drive' : 'crm-onedrive'
}

function getBaseUrl(origin?: string) {
  const value = String(process.env.APP_URL || process.env.NEXTAUTH_URL || origin || '').trim()
  if (!value) {
    throw new Error('Falta APP_URL o NEXTAUTH_URL para completar el callback OAuth.')
  }
  return value.replace(/\/$/, '')
}

function requireGoogleEnv() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) {
    throw new Error('Falta GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET para conectar Google Drive.')
  }
  return { clientId, clientSecret }
}

function requireMicrosoftEnv() {
  const clientId = String(process.env.MICROSOFT_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.MICROSOFT_CLIENT_SECRET || '').trim()
  const tenantId = String(process.env.MICROSOFT_TENANT_ID || 'common').trim() || 'common'
  if (!clientId || !clientSecret) {
    throw new Error('Falta MICROSOFT_CLIENT_ID o MICROSOFT_CLIENT_SECRET para conectar OneDrive.')
  }
  return { clientId, clientSecret, tenantId }
}

function getCallbackUrl(provider: CrmExternalStorageProvider, origin?: string) {
  return `${getBaseUrl(origin)}/api/crm/external-storage/callback?provider=${provider}`
}

export function createSignedExternalStorageState(payload: SignedExternalStorageState) {
  const body = base64UrlEncode(JSON.stringify(payload))
  const signature = base64UrlEncode(crypto.createHmac('sha256', getSecretMaterial()).update(body).digest())
  return `${body}.${signature}`
}

export function verifySignedExternalStorageState(token: string, maxAgeSeconds = 15 * 60) {
  const [payloadB64, signature] = String(token || '').split('.')
  if (!payloadB64 || !signature) return null

  const expected = base64UrlEncode(crypto.createHmac('sha256', getSecretMaterial()).update(payloadB64).digest())
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== receivedBuffer.length) return null
  if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as SignedExternalStorageState
    if (!payload?.userId || !payload?.provider || typeof payload?.issuedAt !== 'number') return null
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.issuedAt
    if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) return null
    return payload
  } catch {
    return null
  }
}

export function buildExternalStorageAuthUrl(args: { provider: CrmExternalStorageProvider; state: string; origin?: string }) {
  if (args.provider === 'GOOGLE_DRIVE') {
    const { clientId } = requireGoogleEnv()
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', getCallbackUrl(args.provider, args.origin))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('scope', [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' '))
    url.searchParams.set('state', args.state)
    return url.toString()
  }

  const { clientId, tenantId } = requireMicrosoftEnv()
  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', getCallbackUrl(args.provider, args.origin))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', ['offline_access', 'User.Read', 'Files.Read'].join(' '))
  url.searchParams.set('state', args.state)
  return url.toString()
}

async function exchangeCodeForTokens(args: { provider: CrmExternalStorageProvider; code: string; origin?: string }) {
  if (args.provider === 'GOOGLE_DRIVE') {
    const { clientId, clientSecret } = requireGoogleEnv()
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: args.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getCallbackUrl(args.provider, args.origin),
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
    const json = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string; id_token?: string; error?: string; error_description?: string }
    if (!response.ok || !json.access_token) {
      throw new Error(json.error_description || json.error || 'No se pudo conectar con Google Drive.')
    }
    return json
  }

  const { clientId, clientSecret, tenantId } = requireMicrosoftEnv()
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: args.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getCallbackUrl(args.provider, args.origin),
      grant_type: 'authorization_code',
      scope: 'offline_access User.Read Files.Read',
    }),
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string; id_token?: string; error?: string; error_description?: string }
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'No se pudo conectar con OneDrive.')
  }
  return json
}

async function refreshTokens(args: { provider: CrmExternalStorageProvider; refreshToken: string; origin?: string }) {
  if (args.provider === 'GOOGLE_DRIVE') {
    const { clientId, clientSecret } = requireGoogleEnv()
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: args.refreshToken,
        grant_type: 'refresh_token',
      }),
      cache: 'no-store',
    })
    const json = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string; error?: string; error_description?: string }
    if (!response.ok || !json.access_token) {
      throw new Error(json.error_description || json.error || 'No se pudo refrescar el acceso a Google Drive.')
    }
    return json
  }

  const { clientId, clientSecret, tenantId } = requireMicrosoftEnv()
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: args.refreshToken,
      grant_type: 'refresh_token',
      scope: 'offline_access User.Read Files.Read',
    }),
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string; error?: string; error_description?: string }
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'No se pudo refrescar el acceso a OneDrive.')
  }
  return json
}

async function fetchProfile(provider: CrmExternalStorageProvider, accessToken: string) {
  if (provider === 'GOOGLE_DRIVE') {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const json = await response.json().catch(() => ({})) as { id?: string; email?: string; name?: string; error?: { message?: string } }
    if (!response.ok || !json.email) {
      throw new Error(json.error?.message || 'Google no devolvió un perfil válido para Drive.')
    }
    return { providerAccountId: String(json.id || json.email).trim(), label: String(json.name || json.email).trim() || json.email }
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({})) as { id?: string; displayName?: string; userPrincipalName?: string; mail?: string; error?: { message?: string } }
  const email = String(json.mail || json.userPrincipalName || '').trim()
  if (!response.ok || !json.id || !email) {
    throw new Error(json.error?.message || 'Microsoft no devolvió un perfil válido para OneDrive.')
  }
  return { providerAccountId: String(json.id).trim(), label: String(json.displayName || email).trim() || email }
}

export async function saveExternalStorageConnection(args: { provider: CrmExternalStorageProvider; userId: string; code: string; origin?: string }) {
  const token = await exchangeCodeForTokens({ provider: args.provider, code: args.code, origin: args.origin })
  const profile = await fetchProfile(args.provider, token.access_token!)
  const expiresAt = typeof token.expires_in === 'number' ? Math.floor(Date.now() / 1000) + token.expires_in : null
  const providerName = providerKey(args.provider)

  await prisma.$transaction([
    prisma.account.deleteMany({
      where: {
        userId: args.userId,
        provider: providerName,
        NOT: { providerAccountId: profile.providerAccountId },
      },
    }),
    prisma.account.upsert({
      where: { provider_providerAccountId: { provider: providerName, providerAccountId: profile.providerAccountId } },
      update: {
        userId: args.userId,
        type: 'oauth',
        access_token: token.access_token || null,
        refresh_token: token.refresh_token || undefined,
        expires_at: expiresAt,
        token_type: token.token_type || null,
        scope: token.scope || null,
        id_token: token.id_token || null,
      },
      create: {
        userId: args.userId,
        type: 'oauth',
        provider: providerName,
        providerAccountId: profile.providerAccountId,
        access_token: token.access_token || null,
        refresh_token: token.refresh_token || null,
        expires_at: expiresAt,
        token_type: token.token_type || null,
        scope: token.scope || null,
        id_token: token.id_token || null,
      },
    }),
  ])

  return { accountLabel: profile.label }
}

async function getStoredAccessToken(args: { userId: string; provider: CrmExternalStorageProvider; origin?: string }): Promise<StoredToken | null> {
  const account = await prisma.account.findFirst({ where: { userId: args.userId, provider: providerKey(args.provider) }, orderBy: { id: 'desc' } })
  if (!account?.access_token) return null

  let accessToken = account.access_token
  let refreshToken = account.refresh_token || null
  let expiresAt = account.expires_at ?? null

  if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000) + 60) {
    if (!refreshToken) return null
    const refreshed = await refreshTokens({ provider: args.provider, refreshToken, origin: args.origin })
    accessToken = refreshed.access_token!
    refreshToken = refreshed.refresh_token || refreshToken
    expiresAt = typeof refreshed.expires_in === 'number' ? Math.floor(Date.now() / 1000) + refreshed.expires_in : expiresAt
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: refreshed.token_type || account.token_type,
        scope: refreshed.scope || account.scope,
      },
    })
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    providerAccountId: account.providerAccountId,
    accountLabel: account.providerAccountId,
  }
}

async function listGoogleDriveItems(accessToken: string, query: string) {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('pageSize', '25')
  url.searchParams.set('orderBy', 'modifiedTime desc')
  url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,size)')
  const clauses = ["trashed = false"]
  if (query) {
    clauses.push(`name contains '${query.replace(/'/g, "\\'")}'`)
  }
  url.searchParams.set('q', clauses.join(' and '))

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({})) as { files?: Array<{ id?: string; name?: string; mimeType?: string; modifiedTime?: string; webViewLink?: string; size?: string }>; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(json.error?.message || 'No se pudieron listar archivos de Google Drive.')
  }

  return (json.files || [])
    .filter((item) => item.id && item.name && item.webViewLink)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      url: String(item.webViewLink),
      mimeType: item.mimeType || null,
      sizeBytes: item.size ? Number(item.size) || null : null,
      updatedAt: item.modifiedTime || new Date().toISOString(),
      type: item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' as const : 'document' as const,
      provider: 'GOOGLE_DRIVE' as const,
    }))
}

async function listOneDriveItems(accessToken: string, query: string) {
  const base = query
    ? `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`
    : 'https://graph.microsoft.com/v1.0/me/drive/root/children'
  const url = new URL(base)
  url.searchParams.set('$top', '25')
  url.searchParams.set('$select', 'id,name,webUrl,size,lastModifiedDateTime,folder,file')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({})) as { value?: Array<{ id?: string; name?: string; webUrl?: string; size?: number; lastModifiedDateTime?: string; folder?: object; file?: { mimeType?: string } }>; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(json.error?.message || 'No se pudieron listar archivos de OneDrive.')
  }

  return (json.value || [])
    .filter((item) => item.id && item.name && item.webUrl)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      url: String(item.webUrl),
      mimeType: item.file?.mimeType || null,
      sizeBytes: typeof item.size === 'number' ? item.size : null,
      updatedAt: item.lastModifiedDateTime || new Date().toISOString(),
      type: item.folder ? 'folder' as const : 'document' as const,
      provider: 'ONEDRIVE' as const,
    }))
}

export async function listExternalStorageItems(args: { userId: string; provider: CrmExternalStorageProvider; query?: string; origin?: string }) {
  const stored = await getStoredAccessToken({ userId: args.userId, provider: args.provider, origin: args.origin })
  if (!stored) {
    return { connected: false, accountLabel: null, items: [] as CrmExternalStorageItem[] }
  }

  const items = args.provider === 'GOOGLE_DRIVE'
    ? await listGoogleDriveItems(stored.accessToken, String(args.query || '').trim())
    : await listOneDriveItems(stored.accessToken, String(args.query || '').trim())

  return { connected: true, accountLabel: stored.accountLabel, items }
}