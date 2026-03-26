import { NextResponse } from 'next/server'
import { Prisma, type CrmChannelConnection, type CrmChannelProvider, type CrmMessageStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { getWebhookInboundMapping, normalizeWebhookInboundPayload } from '@/lib/crm-webhook-normalizer'

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

async function processMetaWebhookForChannel(channel: MetaChannelRecord, body: Record<string, unknown> | null) {
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
    const processed = [] as Array<Awaited<ReturnType<typeof createInboundArtifacts>>>
    let processedStatuses = 0

    for (const update of normalized.statusUpdates) {
      processedStatuses += await applyMessageStatusUpdate({
        client: tx,
        channelId: channel.id,
        update,
      })
    }

    for (const event of normalized.events) {
      const artifacts = await createInboundArtifacts({
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
      leadId: first?.lead.id ?? null,
      conversationId: first?.conversation.id ?? null,
      messageId: first?.message.id ?? null,
      captureId: first?.capture.id ?? null,
      records: results.processed.map((result) => ({
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture.id,
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