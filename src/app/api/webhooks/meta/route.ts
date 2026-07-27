import { NextResponse } from 'next/server'
import { Prisma, type CrmChannelConnection, type CrmChannelProvider, type CrmMessageStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createConversationMessageEvent, createInboundArtifacts, getConnectionToken, parseJsonObject, parseMaybeDate } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { getWebhookInboundMapping, normalizeWebhookInboundPayload } from '@/lib/crm-webhook-normalizer'
import { fetchMetaLeadgenRecord, getMetaAccessToken, type MetaLeadgenRecord } from '@/lib/crm-meta'

export const runtime = 'nodejs'

const META_WEBHOOK_PROVIDERS: CrmChannelProvider[] = ['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX', 'MESSENGER', 'FACEBOOK_PAGE', 'INSTAGRAM_DM']

const MESSAGE_STATUS_RANK: Record<CrmMessageStatus, number> = {
  RECEIVED: 10,
  QUEUED: 20,
  SENT: 30,
  DELIVERED: 40,
  READ: 50,
  FAILED: 5,
}

type MetaChannelRecord = Pick<CrmChannelConnection, 'id' | 'empresaId' | 'sedeId' | 'provider' | 'status' | 'settingsJson' | 'verifyToken' | 'externalAccountId' | 'externalPageId' | 'externalPhoneNumberId'> & {
  createdBy: { id: string }
}

type NativeLeadgenChange = {
  leadgenId: string
  pageId: string | null
  formId: string | null
  eventAt: Date
  rawPayloadJson: Prisma.InputJsonValue
}

function shouldAdvanceMessageStatus(current: CrmMessageStatus, next: CrmMessageStatus) {
  if (current === 'READ') return false
  if (current === 'FAILED' && next !== 'READ') return false
  return MESSAGE_STATUS_RANK[next] > MESSAGE_STATUS_RANK[current]
}

async function applyMessageStatusUpdate(args: {
  client: Prisma.TransactionClient
  channelId: string
  update: ReturnType<typeof normalizeWebhookInboundPayload>['statusUpdates'][number]
}) {
  let affected = 0

  if (args.update.providerMessageId) {
    const rows = await args.client.crmMessage.findMany({
      where: {
        providerMessageId: args.update.providerMessageId,
        conversation: { channelConnectionId: args.channelId },
      },
      select: { id: true, status: true },
    })

    for (const row of rows) {
      if (!shouldAdvanceMessageStatus(row.status, args.update.status)) continue
      await args.client.crmMessage.update({
        where: { id: row.id },
        data: {
          status: args.update.status,
          payloadJson: {
            statusWebhook: args.update.rawPayloadJson,
            errorMessage: args.update.errorMessage,
          },
        },
      })
      affected += 1
    }
  }

  if (!affected && args.update.applyToConversationBefore && args.update.externalThreadId) {
    const conversation = await args.client.crmConversation.findFirst({
      where: {
        channelConnectionId: args.channelId,
        externalThreadId: args.update.externalThreadId,
      },
      select: { id: true },
    })

    if (!conversation) return 0

    const rows = await args.client.crmMessage.findMany({
      where: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        occurredAt: { lte: args.update.eventAt },
      },
      select: { id: true, status: true },
    })

    for (const row of rows) {
      if (!shouldAdvanceMessageStatus(row.status, args.update.status)) continue
      await args.client.crmMessage.update({
        where: { id: row.id },
        data: {
          status: args.update.status,
          payloadJson: {
            statusWebhook: args.update.rawPayloadJson,
            errorMessage: args.update.errorMessage,
          },
        },
      })
      affected += 1
    }
  }

  return affected
}

function extractMetaIdentifiers(body: Record<string, unknown> | null) {
  const payload = body ?? {}
  const pageIds = new Set<string>()
  const accountIds = new Set<string>()
  const phoneNumberIds = new Set<string>()
  const object = normalizeString(payload.object).toLowerCase()
  const entries = Array.isArray(payload.entry) ? payload.entry.map((item) => parseJsonObject(item)) : []

  for (const entry of entries) {
    const entryId = normalizeString(entry.id)
    if (object === 'whatsapp_business_account') {
      if (entryId) accountIds.add(entryId)
    } else {
      if (entryId) {
        pageIds.add(entryId)
        accountIds.add(entryId)
      }
    }

    const messagingRows = Array.isArray(entry.messaging) ? entry.messaging.map((item) => parseJsonObject(item)) : []
    for (const messaging of messagingRows) {
      const recipientId = normalizeString(parseJsonObject(messaging.recipient).id)
      if (recipientId) pageIds.add(recipientId)
    }

    const changes = Array.isArray(entry.changes) ? entry.changes.map((item) => parseJsonObject(item)) : []
    for (const change of changes) {
      const value = parseJsonObject(change.value)
      const metadata = parseJsonObject(value.metadata)
      const phoneNumberId = normalizeString(metadata.phone_number_id)
      const valueId = normalizeString(value.id)
      const instagramAccountId = normalizeString(value.instagram_account_id)
      const pageId = normalizeString(value.page_id)

      if (phoneNumberId) phoneNumberIds.add(phoneNumberId)
      if (pageId) pageIds.add(pageId)
      if (instagramAccountId) accountIds.add(instagramAccountId)
      if (valueId) {
        if (object === 'whatsapp_business_account') accountIds.add(valueId)
        else accountIds.add(valueId)
      }
    }
  }

  return {
    object,
    pageIds: [...pageIds],
    accountIds: [...accountIds],
    phoneNumberIds: [...phoneNumberIds],
  }
}

function scoreMetaChannelMatch(channel: MetaChannelRecord, identifiers: ReturnType<typeof extractMetaIdentifiers>) {
  let score = 0

  if (channel.externalPhoneNumberId && identifiers.phoneNumberIds.includes(channel.externalPhoneNumberId)) score += 1000
  if (channel.externalPageId && identifiers.pageIds.includes(channel.externalPageId)) score += 600
  if (channel.externalAccountId && identifiers.accountIds.includes(channel.externalAccountId)) score += 400

  if (identifiers.object === 'whatsapp_business_account' && (channel.provider === 'WHATSAPP_CLOUD' || channel.provider === 'WHATSAPP_SANDBOX')) score += 50
  if (identifiers.object === 'instagram' && channel.provider === 'INSTAGRAM_DM') score += 40
  if (identifiers.object === 'page' && (channel.provider === 'MESSENGER' || channel.provider === 'FACEBOOK_PAGE')) score += 20

  return score
}

async function resolveVerificationChannel(verifyToken: string) {
  const globalVerifyToken = normalizeString(process.env.META_WEBHOOK_VERIFY_TOKEN)
  if (globalVerifyToken && verifyToken === globalVerifyToken) {
    return { mode: 'global' as const, channel: null }
  }

  const channels = await prisma.crmChannelConnection.findMany({
    where: {
      provider: { in: META_WEBHOOK_PROVIDERS },
      status: { in: ['TESTING', 'ACTIVE'] },
    },
    select: {
      id: true,
      empresaId: true,
      sedeId: true,
      provider: true,
      status: true,
      settingsJson: true,
      verifyToken: true,
      externalAccountId: true,
      externalPageId: true,
      externalPhoneNumberId: true,
      createdBy: { select: { id: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  const channel = channels.find((item) => getConnectionToken(item.settingsJson, item.verifyToken) === verifyToken) || null
  return { mode: 'channel' as const, channel }
}

async function resolveMetaChannel(body: Record<string, unknown> | null) {
  const identifiers = extractMetaIdentifiers(body)
  const orFilters: Prisma.CrmChannelConnectionWhereInput[] = []

  if (identifiers.phoneNumberIds.length) {
    orFilters.push({ externalPhoneNumberId: { in: identifiers.phoneNumberIds } })
  }
  if (identifiers.pageIds.length) {
    orFilters.push({ externalPageId: { in: identifiers.pageIds } })
  }
  if (identifiers.accountIds.length) {
    orFilters.push({ externalAccountId: { in: identifiers.accountIds } })
  }

  if (!orFilters.length) {
    return { channel: null, identifiers }
  }

  const rows = await prisma.crmChannelConnection.findMany({
    where: {
      provider: { in: META_WEBHOOK_PROVIDERS },
      status: { in: ['TESTING', 'ACTIVE'] },
      OR: orFilters,
    },
    select: {
      id: true,
      empresaId: true,
      sedeId: true,
      provider: true,
      status: true,
      settingsJson: true,
      verifyToken: true,
      externalAccountId: true,
      externalPageId: true,
      externalPhoneNumberId: true,
      createdBy: { select: { id: true } },
    },
  })

  const ranked = rows
    .map((channel) => ({ channel, score: scoreMetaChannelMatch(channel, identifiers) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)

  return {
    channel: ranked[0]?.channel || null,
    identifiers,
  }
}

function extractNativeLeadgenChanges(body: Record<string, unknown> | null) {
  const payload = body ?? {}
  const entries = Array.isArray(payload.entry) ? payload.entry.map((item) => parseJsonObject(item)) : []
  const changes: NativeLeadgenChange[] = []

  for (const entry of entries) {
    const pageId = normalizeString(entry.id) || null
    const rows = Array.isArray(entry.changes) ? entry.changes.map((item) => parseJsonObject(item)) : []

    for (const change of rows) {
      const field = normalizeString(change.field).toLowerCase()
      if (!field.includes('leadgen')) continue

      const value = parseJsonObject(change.value)
      const leadgenId = normalizeString(value.leadgen_id || value.leadgenId || value.id)
      if (!leadgenId) continue

      changes.push({
        leadgenId,
        pageId,
        formId: normalizeString(value.form_id || value.formId) || null,
        eventAt: parseMaybeDate(value.created_time || value.time || entry.time),
        rawPayloadJson: {
          object: payload.object ?? null,
          entry,
          change,
          value,
        } as Prisma.InputJsonValue,
      })
    }
  }

  return changes
}

function getLeadFieldValue(record: MetaLeadgenRecord, aliases: string[]) {
  const lowerAliases = aliases.map((alias) => alias.toLowerCase())
  for (const field of record.fieldData) {
    if (!lowerAliases.includes(field.name.toLowerCase())) continue
    const joined = field.values.map((value) => normalizeString(value)).filter(Boolean).join(', ')
    if (joined) return joined
  }
  return ''
}

function buildMetaLeadgenMessage(record: MetaLeadgenRecord) {
  const lines = [
    record.formName ? `Formulario: ${record.formName}` : '',
    record.campaignName ? `Campaña: ${record.campaignName}` : '',
    record.adName ? `Anuncio: ${record.adName}` : '',
    getLeadFieldValue(record, ['message', 'mensaje', 'comments', 'comentarios', 'pregunta']),
  ].filter(Boolean)

  return lines.join('\n') || 'Lead recibido desde Meta Lead Ads.'
}

async function processNativeMetaLeadgenForChannel(channel: MetaChannelRecord, body: Record<string, unknown> | null) {
  const leadgenChanges = extractNativeLeadgenChanges(body)
  if (!leadgenChanges.length) return null

  const accessToken = getMetaAccessToken(channel.settingsJson)
  if (!accessToken) {
    throw new Error('El canal Meta no tiene access token para resolver leadgen_id nativo.')
  }

  const leadRecords = await Promise.all(leadgenChanges.map(async (change) => ({
    change,
    record: await fetchMetaLeadgenRecord({ accessToken, leadgenId: change.leadgenId }),
  })))

  const latestEventAt = leadRecords
    .map(({ change, record }) => parseMaybeDate(record.createdTime || change.eventAt.toISOString()))
    .sort((left, right) => left.getTime() - right.getTime())
    .at(-1) ?? new Date()

  const results = await prisma.$transaction(async (tx) => {
    const processed = [] as Array<Awaited<ReturnType<typeof createInboundArtifacts>>>

    for (const { change, record } of leadRecords) {
      const nombre = getLeadFieldValue(record, ['full_name', 'nombre', 'name']) || [getLeadFieldValue(record, ['first_name', 'nombre']), getLeadFieldValue(record, ['last_name', 'apellido'])].filter(Boolean).join(' ')
      const email = getLeadFieldValue(record, ['email', 'correo', 'correo_electronico']).toLowerCase()
      const phone = getLeadFieldValue(record, ['phone_number', 'telefono', 'celular', 'mobile_phone'])
      const empresaNombre = getLeadFieldValue(record, ['company_name', 'empresa', 'company'])
      const ciudad = getLeadFieldValue(record, ['city', 'ciudad'])
      const messageText = buildMetaLeadgenMessage(record)
      const eventAt = parseMaybeDate(record.createdTime || change.eventAt.toISOString())

      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source: 'WEB',
        captureType: 'WEB_FORM',
        activityType: 'OTHER',
        messageType: 'EVENT',
        eventAt,
        nombre,
        empresaNombre,
        email,
        phone,
        ciudad,
        messageText,
        externalThreadId: `meta-leadgen:${change.pageId || channel.externalPageId || channel.id}:${record.leadgenId}`,
        providerLeadId: record.leadgenId,
        sourceLabel: 'Meta Lead Ads',
        sourceCampaign: record.campaignName,
        sourceMedium: 'meta-lead-ads-native',
        sourceContent: record.adName || record.formName,
        landingPageUrl: record.formId ? `https://www.facebook.com/ads/leadgen/forms/${record.formId}` : null,
        rawPayloadJson: {
          webhook: change.rawPayloadJson,
          leadgen: record.rawJson,
        } as Prisma.InputJsonValue,
        normalizedDataJson: {
          provider: channel.provider,
          providerLeadId: record.leadgenId,
          pageId: change.pageId,
          formId: record.formId,
          formName: record.formName,
          campaignId: record.campaignId,
          campaignName: record.campaignName,
          adId: record.adId,
          adName: record.adName,
          adsetId: record.adsetId,
          adsetName: record.adsetName,
          platform: record.platform,
          fieldData: record.fieldData,
        } as Prisma.InputJsonValue,
      })

      processed.push(artifacts)
    }

    await tx.crmChannelConnection.update({
      where: { id: channel.id },
      data: { lastWebhookAt: latestEventAt, lastErrorAt: null, lastErrorMessage: null },
    })

    return processed
  })

  const first = results[0]

  return {
    success: true,
    processed: results.length,
    processedStatuses: 0,
    data: {
      leadId: first?.lead?.id ?? null,
      conversationId: first?.conversation.id ?? null,
      messageId: first?.message.id ?? null,
      captureId: first?.capture?.id ?? null,
      records: results.map((result) => ({
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture.id,
      })),
      nativeLeadgen: true,
      testing: channel.status === 'TESTING',
    },
  }
}

async function processMetaWebhookForChannel(channel: MetaChannelRecord, body: Record<string, unknown> | null) {
  const nativeLeadgenResult = await processNativeMetaLeadgenForChannel(channel, body)
  if (nativeLeadgenResult) return nativeLeadgenResult

  const normalized = normalizeWebhookInboundPayload({ provider: channel.provider, body })
  const mapping = getWebhookInboundMapping(channel.provider)
  const latestEventAt = [
    ...normalized.events.map((item) => item.eventAt),
    ...normalized.statusUpdates.map((item) => item.eventAt),
  ].sort((left, right) => left.getTime() - right.getTime()).at(-1) ?? new Date()

  if (!normalized.events.length && !normalized.statusUpdates.length) {
    await prisma.crmChannelConnection.update({
      where: { id: channel.id },
      data: { lastWebhookAt: latestEventAt, lastErrorAt: null, lastErrorMessage: null },
    })

    return {
      success: true,
      processed: 0,
      ignored: true,
      reason: normalized.ignoredReason || 'Evento recibido sin mensajes inbound utilizables.',
      testing: channel.status === 'TESTING',
    }
  }

  const results = await prisma.$transaction(async (tx) => {
    const processed = [] as Array<{
      lead: { id: string } | null
      conversation: { id: string }
      message: { id: string }
      capture: { id: string } | null
    }>
    let processedStatuses = 0

    for (const update of normalized.statusUpdates) {
      processedStatuses += await applyMessageStatusUpdate({
        client: tx,
        channelId: channel.id,
        update,
      })
    }

    for (const event of normalized.events) {
      const artifacts = event.eventDirection === 'OUTBOUND'
        ? await createConversationMessageEvent({
            client: tx,
            empresaId: channel.empresaId,
            sedeId: channel.sedeId,
            createdById: channel.createdBy.id,
            ownerUserId: channel.createdBy.id,
            activityType: mapping.activityType,
            channelConnectionId: channel.id,
            direction: 'OUTBOUND',
            messageType: event.messageType,
            eventAt: event.eventAt,
            nombre: event.nombre,
            email: event.email,
            phone: event.phone,
            messageText: event.messageText,
            messageOrigin: event.messageOrigin,
            externalThreadId: event.externalThreadId,
            providerMessageId: event.providerMessageId,
            sourceLabel: mapping.sourceLabel,
            sourceCampaign: event.sourceCampaign,
            sourceMedium: event.sourceMedium,
            sourceContent: event.sourceContent,
            rawPayloadJson: event.rawPayloadJson,
          }).then((result) => ({ lead: null, conversation: result.conversation, message: result.message, capture: null }))
        : await createInboundArtifacts({
            client: tx,
            empresaId: channel.empresaId,
            sedeId: channel.sedeId,
            createdById: channel.createdBy.id,
            ownerUserId: channel.createdBy.id,
            channelConnectionId: channel.id,
            source: mapping.source,
            captureType: mapping.captureType,
            activityType: mapping.activityType,
            messageType: event.messageType,
            eventAt: event.eventAt,
            nombre: event.nombre,
            empresaNombre: event.empresaNombre,
            email: event.email,
            phone: event.phone,
            ciudad: event.ciudad,
            messageText: event.messageText,
            messageOrigin: event.messageOrigin,
            externalThreadId: event.externalThreadId,
            providerMessageId: event.providerMessageId,
            providerLeadId: event.providerLeadId,
            sourceLabel: mapping.sourceLabel,
            sourceCampaign: event.sourceCampaign,
            sourceMedium: event.sourceMedium,
            sourceContent: event.sourceContent,
            rawPayloadJson: event.rawPayloadJson,
            normalizedDataJson: event.normalizedDataJson,
          })

      processed.push(artifacts)
    }

    await tx.crmChannelConnection.update({
      where: { id: channel.id },
      data: { lastWebhookAt: latestEventAt, lastErrorAt: null, lastErrorMessage: null },
    })

    return { processed, processedStatuses }
  })

  const first = results.processed[0]

  return {
    success: true,
    processed: results.processed.length,
    processedStatuses: results.processedStatuses,
    data: {
      leadId: first?.lead?.id ?? null,
      conversationId: first?.conversation.id ?? null,
      messageId: first?.message.id ?? null,
      captureId: first?.capture?.id ?? null,
      records: results.processed.map((result) => ({
        leadId: result.lead?.id ?? null,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture?.id ?? null,
      })),
      testing: channel.status === 'TESTING',
    },
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const verifyToken = normalizeString(searchParams.get('hub.verify_token') || searchParams.get('verify_token'))
  const challenge = normalizeString(searchParams.get('hub.challenge') || searchParams.get('challenge'))

  if (!challenge) {
    return NextResponse.json({ ok: true, provider: 'META', route: 'global-webhook' })
  }

  if (!verifyToken) {
    console.error('[Meta Webhook] verificacion sin token.')
    return new NextResponse('Forbidden', { status: 403 })
  }

  const resolved = await resolveVerificationChannel(verifyToken)
  if (!resolved.channel && resolved.mode !== 'global') {
    console.error('[Meta Webhook] token de verificacion invalido.')
    return new NextResponse('Forbidden', { status: 403 })
  }

  console.info('[Meta Webhook] verificacion aceptada.', {
    mode: resolved.mode,
    channelId: resolved.channel?.id || null,
  })

  return new NextResponse(challenge, { status: 200 })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const { channel, identifiers } = await resolveMetaChannel(body)

  if (!channel) {
    console.error('[Meta Webhook] no se pudo resolver canal.', identifiers)
    return NextResponse.json({
      success: true,
      ignored: true,
      reason: 'No se encontro un canal Meta que coincida con los identificadores recibidos.',
      identifiers,
    })
  }

  try {
    console.info('[Meta Webhook] procesando evento.', {
      channelId: channel.id,
      provider: channel.provider,
      identifiers,
    })

    const result = await processMetaWebhookForChannel(channel, body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado'
    console.error('[Meta Webhook] error procesando evento.', {
      channelId: channel.id,
      provider: channel.provider,
      error: message,
    })

    await prisma.crmChannelConnection.update({
      where: { id: channel.id },
      data: { lastErrorAt: new Date(), lastErrorMessage: message },
    })

    return NextResponse.json({ error: 'Error procesando webhook Meta' }, { status: 500 })
  }
}