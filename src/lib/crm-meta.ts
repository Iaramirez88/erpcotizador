import { Prisma, type CrmChannelProvider } from '@prisma/client'
import { decryptChannelSecret, encryptChannelSecret } from '@/lib/crm-channel-secrets'
import { normalizeString } from '@/lib/crm'
import { parseJsonObject } from '@/lib/crm-omnichannel'

const META_GRAPH_VERSION = 'v23.0'

export const META_OAUTH_SCOPES = [
  'business_management',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_messages',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
]

export type MetaPageAsset = {
  pageId: string
  pageName: string
  pageAccessToken: string | null
  instagramAccountId: string | null
  instagramUsername: string | null
  instagramName: string | null
}

export type MetaWhatsAppAsset = {
  businessId: string
  businessName: string
  wabaId: string
  wabaName: string
  phoneNumberId: string
  displayPhoneNumber: string | null
  verifiedName: string | null
}

export type MetaConnectionSnapshot = {
  connectedUserId: string
  connectedUserName: string | null
  tokenType: string | null
  grantedScopes: string[]
  expiresAt: string | null
  pages: MetaPageAsset[]
  whatsappAssets: MetaWhatsAppAsset[]
}

type MetaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  granted_scopes?: string[]
}

function requireMetaEnv() {
  const appId = process.env.META_APP_ID || ''
  const appSecret = process.env.META_APP_SECRET || ''
  const appUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')

  if (!appId || !appSecret || !appUrl) {
    throw new Error('Falta configurar META_APP_ID, META_APP_SECRET o APP_URL/NEXTAUTH_URL.')
  }

  return { appId, appSecret, appUrl }
}

function getRedirectUri(channelId: string) {
  const { appUrl } = requireMetaEnv()
  return `${appUrl}/api/crm/channels/${channelId}/meta/callback`
}

async function fetchMetaGraph<T>(path: string, params: Record<string, string>, accessToken: string) {
  const query = new URLSearchParams({ ...params, access_token: accessToken })
  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}${path}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  const json = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(json?.error?.message || `Meta Graph respondió ${response.status}`)
  }
  return json
}

export function buildMetaOAuthUrl(args: { channelId: string; state: string }) {
  const { appId } = requireMetaEnv()
  const redirectUri = getRedirectUri(args.channelId)
  const search = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state: args.state,
    response_type: 'code',
    scope: META_OAUTH_SCOPES.join(','),
  })
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${search.toString()}`
}

export async function exchangeMetaCode(channelId: string, code: string) {
  const { appId, appSecret } = requireMetaEnv()
  const redirectUri = getRedirectUri(channelId)

  const shortUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`)
  shortUrl.searchParams.set('client_id', appId)
  shortUrl.searchParams.set('client_secret', appSecret)
  shortUrl.searchParams.set('redirect_uri', redirectUri)
  shortUrl.searchParams.set('code', code)

  const shortResponse = await fetch(shortUrl, { cache: 'no-store' })
  const shortJson = await shortResponse.json().catch(() => ({})) as MetaTokenResponse & { error?: { message?: string } }
  if (!shortResponse.ok || !shortJson.access_token) {
    throw new Error(shortJson?.error?.message || 'No se pudo obtener el access token inicial de Meta.')
  }

  const exchangeUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`)
  exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token')
  exchangeUrl.searchParams.set('client_id', appId)
  exchangeUrl.searchParams.set('client_secret', appSecret)
  exchangeUrl.searchParams.set('fb_exchange_token', shortJson.access_token)

  const longResponse = await fetch(exchangeUrl, { cache: 'no-store' })
  const longJson = await longResponse.json().catch(() => ({})) as MetaTokenResponse & { error?: { message?: string } }

  if (longResponse.ok && longJson.access_token) {
    return longJson
  }

  return shortJson
}

export function getMetaAccessToken(settingsJson: unknown) {
  const settings = parseJsonObject(settingsJson)
  const encrypted = normalizeString(settings.metaAccessTokenEncrypted)
  if (encrypted) return decryptChannelSecret(encrypted)
  return normalizeString(settings.metaAccessToken || settings.whatsappAccessToken || settings.accessToken)
}

export function getMetaPageAccessToken(settingsJson: unknown) {
  const settings = parseJsonObject(settingsJson)
  const encrypted = normalizeString(settings.metaPageAccessTokenEncrypted)
  if (encrypted) return decryptChannelSecret(encrypted)
  return normalizeString(settings.metaPageAccessToken)
}

async function fetchMetaPages(accessToken: string) {
  const json = await fetchMetaGraph<{ data?: Array<Record<string, unknown>> }>('/me/accounts', {
    fields: 'id,name,access_token,tasks,instagram_business_account{id,username,name},connected_instagram_account{id,username,name}',
    limit: '200',
  }, accessToken)

  const rows = Array.isArray(json.data) ? json.data : []
  return rows.map((row) => {
    const instagramBusiness = parseJsonObject(row.instagram_business_account)
    const connectedInstagram = parseJsonObject(row.connected_instagram_account)
    const instagramAccount = Object.keys(instagramBusiness).length ? instagramBusiness : connectedInstagram

    return {
      pageId: normalizeString(row.id),
      pageName: normalizeString(row.name) || 'Página sin nombre',
      pageAccessToken: normalizeString(row.access_token) || null,
      instagramAccountId: normalizeString(instagramAccount.id) || null,
      instagramUsername: normalizeString(instagramAccount.username) || null,
      instagramName: normalizeString(instagramAccount.name) || null,
    } satisfies MetaPageAsset
  }).filter((row) => row.pageId)
}

async function fetchMetaBusinesses(accessToken: string) {
  const json = await fetchMetaGraph<{ data?: Array<Record<string, unknown>> }>('/me/businesses', {
    fields: 'id,name',
    limit: '100',
  }, accessToken)

  return Array.isArray(json.data)
    ? json.data.map((row) => ({
        id: normalizeString(row.id),
        name: normalizeString(row.name) || 'Business sin nombre',
      })).filter((row) => row.id)
    : []
}

async function fetchWhatsAppAssetsForBusiness(accessToken: string, businessId: string, businessName: string) {
  const business = await fetchMetaGraph<Record<string, unknown>>(`/${businessId}`, {
    fields: 'owned_whatsapp_business_accounts{id,name}',
  }, accessToken)

  const wabas = Array.isArray(business.owned_whatsapp_business_accounts)
    ? business.owned_whatsapp_business_accounts.map((item) => parseJsonObject(item))
    : []

  const assets: MetaWhatsAppAsset[] = []

  for (const waba of wabas) {
    const wabaId = normalizeString(waba.id)
    if (!wabaId) continue

    const phoneNumbers = await fetchMetaGraph<{ data?: Array<Record<string, unknown>> }>(`/${wabaId}/phone_numbers`, {
      fields: 'id,display_phone_number,verified_name',
      limit: '100',
    }, accessToken).catch(() => ({ data: [] }))

    const phoneRows = Array.isArray(phoneNumbers.data) ? phoneNumbers.data : []
    for (const phone of phoneRows) {
      const phoneNumberId = normalizeString(phone.id)
      if (!phoneNumberId) continue
      assets.push({
        businessId,
        businessName,
        wabaId,
        wabaName: normalizeString(waba.name) || 'WABA sin nombre',
        phoneNumberId,
        displayPhoneNumber: normalizeString(phone.display_phone_number) || null,
        verifiedName: normalizeString(phone.verified_name) || null,
      })
    }
  }

  return assets
}

export async function syncMetaConnection(accessToken: string, expiresInSeconds?: number | null, grantedScopes?: string[] | null) {
  const profile = await fetchMetaGraph<Record<string, unknown>>('/me', { fields: 'id,name' }, accessToken)
  const pages = await fetchMetaPages(accessToken).catch(() => [])
  const businesses = await fetchMetaBusinesses(accessToken).catch(() => [])

  const whatsappAssets: MetaWhatsAppAsset[] = []
  for (const business of businesses) {
    const businessAssets = await fetchWhatsAppAssetsForBusiness(accessToken, business.id, business.name).catch(() => [])
    whatsappAssets.push(...businessAssets)
  }

  return {
    connectedUserId: normalizeString(profile.id),
    connectedUserName: normalizeString(profile.name) || null,
    tokenType: 'bearer',
    grantedScopes: Array.isArray(grantedScopes) ? grantedScopes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
    expiresAt: typeof expiresInSeconds === 'number' && expiresInSeconds > 0 ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : null,
    pages,
    whatsappAssets,
  } satisfies MetaConnectionSnapshot
}

function resolveSelectedPage(snapshot: MetaConnectionSnapshot, currentPageId: string | null | undefined) {
  return snapshot.pages.find((item) => item.pageId === currentPageId) ?? snapshot.pages[0] ?? null
}

function resolveSelectedInstagram(snapshot: MetaConnectionSnapshot, currentInstagramId: string | null | undefined, currentPageId: string | null | undefined) {
  return snapshot.pages.find((item) => item.instagramAccountId && item.instagramAccountId === currentInstagramId)
    ?? snapshot.pages.find((item) => item.pageId === currentPageId && item.instagramAccountId)
    ?? snapshot.pages.find((item) => item.instagramAccountId)
    ?? null
}

function resolveSelectedWhatsApp(snapshot: MetaConnectionSnapshot, currentPhoneNumberId: string | null | undefined) {
  return snapshot.whatsappAssets.find((item) => item.phoneNumberId === currentPhoneNumberId) ?? snapshot.whatsappAssets[0] ?? null
}

export function buildMetaSettingsPatch(args: {
  provider: CrmChannelProvider
  currentSettingsJson: unknown
  snapshot: MetaConnectionSnapshot
  accessToken: string
  selectedPageId?: string | null
  selectedInstagramAccountId?: string | null
  selectedPhoneNumberId?: string | null
}) {
  const settings = parseJsonObject(args.currentSettingsJson)
  const selectedPage = resolveSelectedPage(args.snapshot, args.selectedPageId || normalizeString(settings.metaSelectedPageId))
  const selectedInstagram = resolveSelectedInstagram(args.snapshot, args.selectedInstagramAccountId || normalizeString(settings.metaSelectedInstagramAccountId), args.selectedPageId || selectedPage?.pageId || null)
  const selectedWhatsApp = resolveSelectedWhatsApp(args.snapshot, args.selectedPhoneNumberId || normalizeString(settings.metaSelectedPhoneNumberId))

  const selectedPageAccessToken = selectedInstagram?.pageAccessToken || selectedPage?.pageAccessToken || null
  const settingsPatch: Record<string, unknown> = {
    ...settings,
    metaConnectedAt: new Date().toISOString(),
    metaConnectedUserId: args.snapshot.connectedUserId,
    metaConnectedUserName: args.snapshot.connectedUserName,
    metaGrantedScopes: args.snapshot.grantedScopes,
    metaTokenType: args.snapshot.tokenType,
    metaTokenExpiresAt: args.snapshot.expiresAt,
    metaLastSyncAt: new Date().toISOString(),
    metaAccessTokenEncrypted: encryptChannelSecret(args.accessToken),
    metaPages: args.snapshot.pages,
    metaWhatsAppAssets: args.snapshot.whatsappAssets,
    metaSelectedPageId: selectedPage?.pageId || null,
    metaSelectedInstagramAccountId: selectedInstagram?.instagramAccountId || null,
    metaSelectedPhoneNumberId: selectedWhatsApp?.phoneNumberId || null,
    metaPageAccessTokenEncrypted: selectedPageAccessToken ? encryptChannelSecret(selectedPageAccessToken) : null,
  }

  const patch: {
    externalAccountId?: string | null
    externalPageId?: string | null
    externalPhoneNumberId?: string | null
    settingsJson: Prisma.InputJsonValue
  } = {
    settingsJson: settingsPatch as Prisma.InputJsonValue,
  }

  if (args.provider === 'WHATSAPP_CLOUD' || args.provider === 'WHATSAPP_SANDBOX') {
    patch.externalAccountId = selectedWhatsApp?.wabaId || null
    patch.externalPhoneNumberId = selectedWhatsApp?.phoneNumberId || null
  } else if (args.provider === 'INSTAGRAM_DM') {
    patch.externalAccountId = selectedInstagram?.instagramAccountId || null
    patch.externalPageId = selectedInstagram?.pageId || selectedPage?.pageId || null
  } else if (args.provider === 'FACEBOOK_PAGE' || args.provider === 'MESSENGER') {
    patch.externalAccountId = args.snapshot.connectedUserId || null
    patch.externalPageId = selectedPage?.pageId || null
  }

  return patch
}

export function clearMetaSettings(settingsJson: unknown) {
  const settings = parseJsonObject(settingsJson)
  const next = { ...settings }
  for (const key of [
    'metaConnectedAt',
    'metaConnectedUserId',
    'metaConnectedUserName',
    'metaGrantedScopes',
    'metaTokenType',
    'metaTokenExpiresAt',
    'metaLastSyncAt',
    'metaAccessTokenEncrypted',
    'metaPages',
    'metaWhatsAppAssets',
    'metaSelectedPageId',
    'metaSelectedInstagramAccountId',
    'metaSelectedPhoneNumberId',
    'metaPageAccessTokenEncrypted',
  ]) {
    delete next[key]
  }
  return next as Prisma.InputJsonValue
}