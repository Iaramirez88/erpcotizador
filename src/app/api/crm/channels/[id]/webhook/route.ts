import { NextResponse } from 'next/server'
import { Prisma, type CrmMessageStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createConversationMessageEvent, createInboundArtifacts, getConnectionToken } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { getWebhookInboundMapping, normalizeWebhookInboundPayload } from '@/lib/crm-webhook-normalizer'

export const runtime = 'nodejs'

const MESSAGE_STATUS_RANK: Record<CrmMessageStatus, number> = {
  RECEIVED: 10,
  QUEUED: 20,
  SENT: 30,
  DELIVERED: 40,
  READ: 50,
  FAILED: 5,
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
      select: { id: true, status: true, payloadJson: true },
    })

    for (const row of rows) {
      if (!shouldAdvanceMessageStatus(row.status, args.update.status)) continue
      await args.client.crmMessage.update({
        where: { id: row.id },
        data: {
          status: args.update.status,
          payloadJson: {
            ...(row.payloadJson && typeof row.payloadJson === 'object' && !Array.isArray(row.payloadJson)
              ? row.payloadJson as Record<string, unknown>
              : {}),
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
      select: { id: true, status: true, payloadJson: true },
    })

    for (const row of rows) {
      if (!shouldAdvanceMessageStatus(row.status, args.update.status)) continue
      await args.client.crmMessage.update({
        where: { id: row.id },
        data: {
          status: args.update.status,
          payloadJson: {
            ...(row.payloadJson && typeof row.payloadJson === 'object' && !Array.isArray(row.payloadJson)
              ? row.payloadJson as Record<string, unknown>
              : {}),
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

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const channel = await prisma.crmChannelConnection.findUnique({ where: { id } })
  if (!channel) return new NextResponse('Not found', { status: 404 })

  const { searchParams } = new URL(request.url)
  const verifyToken = normalizeString(searchParams.get('hub.verify_token') || searchParams.get('verify_token'))
  const challenge = normalizeString(searchParams.get('hub.challenge') || searchParams.get('challenge'))
  const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)

  if (!challenge) {
    return NextResponse.json({ ok: true, provider: channel.provider, status: channel.status })
  }

  if (expectedToken && verifyToken !== expectedToken) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return new NextResponse(challenge, { status: 200 })
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true } } },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (!['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX', 'MESSENGER', 'FACEBOOK_PAGE', 'INSTAGRAM_DM'].includes(channel.provider)) {
      return NextResponse.json({ error: 'Canal no soporta webhook' }, { status: 400 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para webhook' }, { status: 409 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const providedToken = normalizeString(
      request.headers.get('x-crm-webhook-token') ||
      request.headers.get('x-verify-token') ||
      body?.token
    )
    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)

    if (expectedToken && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Token inválido para webhook' }, { status: 403 })
    }

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

      return NextResponse.json({
        success: true,
        processed: 0,
        ignored: true,
        reason: normalized.ignoredReason || 'Evento recibido sin mensajes inbound utilizables.',
        testing: channel.status === 'TESTING',
      })
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

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Error procesando webhook CRM:', error)
    await prisma.crmChannelConnection.updateMany({
      where: { id },
      data: { lastErrorAt: new Date(), lastErrorMessage: error instanceof Error ? error.message : 'Error inesperado' },
    })
    return NextResponse.json({ error: 'Error procesando webhook CRM' }, { status: 500 })
  }
}