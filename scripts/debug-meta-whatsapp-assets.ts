import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { getMetaAccessToken, syncMetaConnection } from '../src/lib/crm-meta'

const META_GRAPH_VERSION = 'v23.0'

type GraphListResponse<T> = {
  data?: T[]
}

type GraphBusiness = {
  id?: string
  name?: string
}

type GraphWaba = {
  id?: string
  name?: string
}

type GraphPhoneNumber = {
  id?: string
  display_phone_number?: string
  verified_name?: string
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function fetchGraph<T>(path: string, accessToken: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams({ ...params, access_token: accessToken })
  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}${path}?${search.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(json?.error?.message || `Meta Graph respondió ${response.status}`)
  }
  return json
}

async function listCandidateChannels() {
  const channels = await prisma.crmChannelConnection.findMany({
    where: {
      provider: { in: ['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      provider: true,
      status: true,
      externalAccountId: true,
      externalPhoneNumberId: true,
      updatedAt: true,
    },
  })

  if (!channels.length) {
    console.log('No se encontraron canales WhatsApp para diagnosticar.')
    return
  }

  console.log('Canales candidatos:')
  for (const channel of channels) {
    console.log(`- ${channel.id} | ${channel.name} | ${channel.provider} | ${channel.status} | phone=${channel.externalPhoneNumberId || '-'} | updated=${channel.updatedAt.toISOString()}`)
  }
  console.log('\nEjecuta: npx tsx scripts/debug-meta-whatsapp-assets.ts <channelId> [phoneNumberIdEsperado]')
}

async function main() {
  const channelId = process.argv[2]
  const expectedPhoneNumberId = normalizeString(process.argv[3])

  if (!channelId) {
    await listCandidateChannels()
    return
  }

  const channel = await prisma.crmChannelConnection.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
      provider: true,
      status: true,
      externalAccountId: true,
      externalPhoneNumberId: true,
      settingsJson: true,
      lastErrorMessage: true,
      updatedAt: true,
    },
  })

  if (!channel) {
    throw new Error(`Canal no encontrado: ${channelId}`)
  }

  const accessToken = getMetaAccessToken(channel.settingsJson)
  if (!accessToken) {
    throw new Error('El canal no tiene metaAccessToken utilizable en settingsJson.')
  }

  console.log('Canal:')
  console.log(JSON.stringify({
    id: channel.id,
    name: channel.name,
    provider: channel.provider,
    status: channel.status,
    externalAccountId: channel.externalAccountId,
    externalPhoneNumberId: channel.externalPhoneNumberId,
    lastErrorMessage: channel.lastErrorMessage,
    updatedAt: channel.updatedAt,
  }, null, 2))

  const rawSettings = (channel.settingsJson && typeof channel.settingsJson === 'object' && !Array.isArray(channel.settingsJson))
    ? channel.settingsJson as Record<string, unknown>
    : {}

  console.log('\nDatos guardados en settingsJson:')
  console.log(JSON.stringify({
    metaConnectedUserName: rawSettings.metaConnectedUserName,
    metaConnectedAt: rawSettings.metaConnectedAt,
    metaLastSyncAt: rawSettings.metaLastSyncAt,
    metaSelectedPhoneNumberId: rawSettings.metaSelectedPhoneNumberId,
    metaWhatsAppAssetsCount: Array.isArray(rawSettings.metaWhatsAppAssets) ? rawSettings.metaWhatsAppAssets.length : 0,
    metaWhatsAppAssets: rawSettings.metaWhatsAppAssets,
  }, null, 2))

  const profile = await fetchGraph<Record<string, unknown>>('/me', accessToken, { fields: 'id,name' })
  const businesses = await fetchGraph<GraphListResponse<GraphBusiness>>('/me/businesses', accessToken, {
    fields: 'id,name',
    limit: '100',
  })

  console.log('\nPerfil Meta:')
  console.log(JSON.stringify(profile, null, 2))

  console.log('\nNegocios visibles para el token:')
  console.log(JSON.stringify(businesses.data || [], null, 2))

  for (const business of businesses.data || []) {
    const businessId = normalizeString(business.id)
    if (!businessId) continue

    const businessDetail = await fetchGraph<Record<string, unknown>>(`/${businessId}`, accessToken, {
      fields: 'owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}',
    })

    const owned = Array.isArray(businessDetail.owned_whatsapp_business_accounts)
      ? businessDetail.owned_whatsapp_business_accounts as GraphWaba[]
      : []
    const client = Array.isArray(businessDetail.client_whatsapp_business_accounts)
      ? businessDetail.client_whatsapp_business_accounts as GraphWaba[]
      : []
    const wabas = [...owned, ...client]

    console.log(`\nWABAs visibles para business ${business.name || businessId}:`)
    console.log(JSON.stringify(wabas, null, 2))

    for (const waba of wabas) {
      const wabaId = normalizeString(waba.id)
      if (!wabaId) continue

      const phoneNumbers = await fetchGraph<GraphListResponse<GraphPhoneNumber>>(`/${wabaId}/phone_numbers`, accessToken, {
        fields: 'id,display_phone_number,verified_name',
        limit: '100',
      }).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }))

      console.log(`\nNumeros para WABA ${waba.name || wabaId}:`)
      console.log(JSON.stringify(phoneNumbers, null, 2))
    }
  }

  const snapshot = await syncMetaConnection(accessToken)
  console.log('\nResultado de syncMetaConnection():')
  console.log(JSON.stringify({
    connectedUserId: snapshot.connectedUserId,
    connectedUserName: snapshot.connectedUserName,
    grantedScopes: snapshot.grantedScopes,
    whatsappAssetsCount: snapshot.whatsappAssets.length,
    whatsappAssets: snapshot.whatsappAssets,
  }, null, 2))

  if (expectedPhoneNumberId) {
    const exists = snapshot.whatsappAssets.some((item) => item.phoneNumberId === expectedPhoneNumberId)
    console.log(`\nPhone Number ID esperado ${expectedPhoneNumberId}: ${exists ? 'SI aparece en snapshot' : 'NO aparece en snapshot'}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })