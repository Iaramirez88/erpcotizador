import { Prisma, type CrmChannelProvider } from '@prisma/client'
import { decryptChannelSecret, encryptChannelSecret } from '@/lib/crm-channel-secrets'
import { normalizeString } from '@/lib/crm'
import { parseJsonObject } from '@/lib/crm-omnichannel'

const META_GRAPH_VERSION = 'v23.0'

const META_OAUTH_SCOPES = [
  'business_management',
  'leads_retrieval',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_messaging',
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'pages_read_engagement',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
]

const META_WHATSAPP_OAUTH_SCOPES = [
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
]

const META_FACEBOOK_PAGE_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'pages_messaging',
]

const META_INSTAGRAM_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'pages_read_engagement',
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

export type MetaLeadgenRecord = {
  leadgenId: string
  createdTime: string | null
  formId: string | null
  formName: string | null
  campaignId: string | null
  campaignName: string | null
  adId: string | null
  adName: string | null
  adsetId: string | null
  adsetName: string | null
  platform: string | null
  fieldData: Array<{ name: string; values: string[] }>
  rawJson: Prisma.InputJsonValue
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

export function getMetaOAuthRedirectUri() {
  const { appUrl } = requireMetaEnv()
  return `${appUrl}/api/oauth/meta/callback`
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

export function getMetaOAuthScopes(provider: CrmChannelProvider) {
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') {
    return META_WHATSAPP_OAUTH_SCOPES
  }

  if (provider === 'INSTAGRAM_DM') {
    return META_INSTAGRAM_OAUTH_SCOPES
  }

  if (provider === 'FACEBOOK_PAGE' || provider === 'MESSENGER') {
    return META_FACEBOOK_PAGE_OAUTH_SCOPES
  }

  return META_OAUTH_SCOPES
}

export function buildMetaOAuthUrl(args: { state: string; provider: CrmChannelProvider }) {
  const { appId } = requireMetaEnv()
  const redirectUri = getMetaOAuthRedirectUri()
  const search = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state: args.state,
    response_type: 'code',
    scope: getMetaOAuthScopes(args.provider).join(','),
  })
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${search.toString()}`
}

export async function exchangeMetaCode(args: { code: string; redirectUri?: string }) {
  const { appId, appSecret } = requireMetaEnv()
  const redirectUri = args.redirectUri || getMetaOAuthRedirectUri()

  const shortUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`)
  shortUrl.searchParams.set('client_id', appId)
  shortUrl.searchParams.set('client_secret', appSecret)
  shortUrl.searchParams.set('redirect_uri', redirectUri)
  shortUrl.searchParams.set('code', args.code)

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

export function isWhatsAppCloudChannelReadyForProduction(args: {
  provider: CrmChannelProvider
  settingsJson: unknown
  externalAccountId?: string | null
  externalPhoneNumberId?: string | null
}) {
  if (args.provider !== 'WHATSAPP_CLOUD') return true

  const settings = parseJsonObject(args.settingsJson)
  const hasConnectedAt = Boolean(normalizeString(settings.metaConnectedAt))
  const hasEncryptedToken = Boolean(normalizeString(settings.metaAccessTokenEncrypted))
  const selectedPhoneNumberId = normalizeString(settings.metaSelectedPhoneNumberId)
  const externalPhoneNumberId = normalizeString(args.externalPhoneNumberId)

  return hasConnectedAt
    && hasEncryptedToken
    && Boolean(normalizeString(args.externalAccountId))
    && Boolean(externalPhoneNumberId)
    && selectedPhoneNumberId === externalPhoneNumberId
}

export async function fetchMetaLeadgenRecord(args: { accessToken: string; leadgenId: string }) {
  const json = await fetchMetaGraph<Record<string, unknown>>(`/${args.leadgenId}`, {
    fields: 'id,created_time,field_data,form_id,campaign_id,campaign_name,ad_id,ad_name,adgroup_id,adgroup_name,platform',
  }, args.accessToken)

  const formId = normalizeString(json.form_id) || null
  const formJson = parseJsonObject(formId
    ? await fetchMetaGraph<Record<string, unknown>>(`/${formId}`, { fields: 'id,name' }, args.accessToken).catch(() => ({}))
    : {})

  const fieldRows = Array.isArray(json.field_data)
    ? json.field_data.map((item) => parseJsonObject(item))
    : []

  return {
    leadgenId: normalizeString(json.id) || args.leadgenId,
    createdTime: normalizeString(json.created_time) || null,
    formId,
    formName: normalizeString(formJson.name) || null,
    campaignId: normalizeString(json.campaign_id) || null,
    campaignName: normalizeString(json.campaign_name) || null,
    adId: normalizeString(json.ad_id) || null,
    adName: normalizeString(json.ad_name) || null,
    adsetId: normalizeString(json.adgroup_id) || null,
    adsetName: normalizeString(json.adgroup_name) || null,
    platform: normalizeString(json.platform) || null,
    fieldData: fieldRows.map((row) => ({
      name: normalizeString(row.name),
      values: Array.isArray(row.values)
        ? row.values.map((value) => normalizeString(value)).filter(Boolean)
        : normalizeString(row.value)
          ? [normalizeString(row.value)]
          : [],
    })).filter((row) => row.name),
    rawJson: json as Prisma.InputJsonValue,
  } satisfies MetaLeadgenRecord
}

export type MetaMessagingDispatchConfig = {
  enabled: boolean
  accessToken: string | null
  apiVersion: string
}

export type MetaMessagingDispatchResult = {
  providerMessageId: string | null
  payloadJson: Prisma.InputJsonValue
}

export type MetaMediaAttachment = {
  type: 'IMAGE' | 'AUDIO' | 'DOCUMENT'
  url: string
  filename?: string | null
  caption?: string | null
}

export function getMetaMessagingDispatchConfig(settingsJson: unknown): MetaMessagingDispatchConfig {
  const settings = parseJsonObject(settingsJson)
  const accessToken = getMetaPageAccessToken(settingsJson)
  const apiVersion = normalizeString(settings.metaApiVersion || settings.whatsappApiVersion || settings.apiVersion) || META_GRAPH_VERSION

  return {
    enabled: Boolean(accessToken),
    accessToken: accessToken || null,
    apiVersion,
  }
}

export async function sendMetaTextMessage(args: {
  config: MetaMessagingDispatchConfig
  recipientId: string
  bodyText: string
  provider: CrmChannelProvider
}) : Promise<MetaMessagingDispatchResult> {
  if (!args.config.accessToken) {
    throw new Error('El canal Meta no tiene page access token productivo.')
  }

  const response = await fetch(`https://graph.facebook.com/${args.config.apiVersion}/me/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.config.accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: args.recipientId },
      messaging_type: 'RESPONSE',
      message: {
        text: args.bodyText,
      },
    }),
  })

  const responseJson = await response.json().catch(() => ({})) as Record<string, unknown>
  const recipientId = normalizeString(parseJsonObject(responseJson.recipient).recipient_id)
  const messageId = normalizeString(parseJsonObject(responseJson.message_id).mid || responseJson.message_id)

  if (!response.ok) {
    const errorPayload = parseJsonObject(responseJson.error)
    const errorMessage = normalizeString(errorPayload.message) || `Meta Send API respondió ${response.status}`
    throw new Error(errorMessage)
  }

  return {
    providerMessageId: messageId || null,
    payloadJson: {
      provider: args.provider,
      response: responseJson,
      request: {
        recipientId: args.recipientId,
        text: args.bodyText,
      },
      metaRecipientId: recipientId || args.recipientId,
    } as Prisma.InputJsonValue,
  }
}

export async function sendMetaMediaMessage(args: {
  config: MetaMessagingDispatchConfig
  recipientId: string
  provider: CrmChannelProvider
  attachment: MetaMediaAttachment
}) : Promise<MetaMessagingDispatchResult> {
  if (!args.config.accessToken) {
    throw new Error('El canal Meta no tiene page access token productivo.')
  }

  const attachmentType = args.attachment.type === 'DOCUMENT' ? 'file' : args.attachment.type.toLowerCase()
  const response = await fetch(`https://graph.facebook.com/${args.config.apiVersion}/me/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.config.accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: args.recipientId },
      messaging_type: 'RESPONSE',
      message: {
        attachment: {
          type: attachmentType,
          payload: {
            url: args.attachment.url,
            is_reusable: true,
          },
        },
      },
    }),
  })

  const responseJson = await response.json().catch(() => ({})) as Record<string, unknown>
  const messageId = normalizeString(parseJsonObject(responseJson.message_id).mid || responseJson.message_id)

  if (!response.ok) {
    const errorPayload = parseJsonObject(responseJson.error)
    const errorMessage = normalizeString(errorPayload.message) || `Meta Send API respondió ${response.status}`
    throw new Error(errorMessage)
  }

  return {
    providerMessageId: messageId || null,
    payloadJson: {
      provider: args.provider,
      response: responseJson,
      request: {
        recipientId: args.recipientId,
        type: args.attachment.type,
        attachment: args.attachment,
      },
    } as Prisma.InputJsonValue,
  }
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
    fields: 'owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}',
  }, accessToken)

  const ownedWabas = Array.isArray(business.owned_whatsapp_business_accounts)
    ? business.owned_whatsapp_business_accounts.map((item) => parseJsonObject(item))
    : []
  const clientWabas = Array.isArray(business.client_whatsapp_business_accounts)
    ? business.client_whatsapp_business_accounts.map((item) => parseJsonObject(item))
    : []
  const wabas = [...ownedWabas, ...clientWabas]
  const seenWabaIds = new Set<string>()

  const assets: MetaWhatsAppAsset[] = []

  for (const waba of wabas) {
    const wabaId = normalizeString(waba.id)
    if (!wabaId) continue
    if (seenWabaIds.has(wabaId)) continue
    seenWabaIds.add(wabaId)

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
  const requestedPhoneNumberId = args.selectedPhoneNumberId || normalizeString(settings.metaSelectedPhoneNumberId)
  const selectedPage = resolveSelectedPage(args.snapshot, args.selectedPageId || normalizeString(settings.metaSelectedPageId))
  const selectedInstagram = resolveSelectedInstagram(args.snapshot, args.selectedInstagramAccountId || normalizeString(settings.metaSelectedInstagramAccountId), args.selectedPageId || selectedPage?.pageId || null)
  const selectedWhatsApp = resolveSelectedWhatsApp(args.snapshot, requestedPhoneNumberId)

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
    metaSelectedPhoneNumberId: selectedWhatsApp?.phoneNumberId || requestedPhoneNumberId || null,
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