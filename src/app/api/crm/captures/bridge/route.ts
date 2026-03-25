import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { normalizeString } from '@/lib/crm'
import { createInboundArtifacts, getConnectionToken, parseJsonObject, parseMaybeDate } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const SUPPORTED_BRIDGES = new Set(['GMAIL', 'OUTLOOK', 'TIKTOK', 'YOUTUBE'])

function resolveBridgeMetadata(bridgeKind: string) {
  switch (bridgeKind) {
    case 'GMAIL':
      return {
        activityType: 'EMAIL' as const,
        sourceLabel: 'Gmail Inbox Bridge',
        sourceMedium: 'gmail-bridge',
        landingPageUrl: 'gmail://inbox',
      }
    case 'OUTLOOK':
      return {
        activityType: 'EMAIL' as const,
        sourceLabel: 'Outlook Inbox Bridge',
        sourceMedium: 'outlook-bridge',
        landingPageUrl: 'outlook://mail',
      }
    case 'TIKTOK':
      return {
        activityType: 'NOTE' as const,
        sourceLabel: 'TikTok Lead Bridge',
        sourceMedium: 'tiktok-bridge',
        landingPageUrl: null,
      }
    case 'YOUTUBE':
      return {
        activityType: 'NOTE' as const,
        sourceLabel: 'YouTube Lead Bridge',
        sourceMedium: 'youtube-bridge',
        landingPageUrl: null,
      }
    default:
      return null
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const channelId = normalizeString(body?.channelId)
    const providedToken = normalizeString(request.headers.get('x-crm-channel-token') || body?.token)

    if (!channelId) {
      return NextResponse.json({ error: 'channelId es requerido' }, { status: 400 })
    }

    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id: channelId },
      include: { createdBy: { select: { id: true } } },
    })

    if (!channel || channel.provider !== 'WEB_FORM') {
      return NextResponse.json({ error: 'Canal bridge no encontrado' }, { status: 404 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para capturas' }, { status: 409 })
    }

    const settings = parseJsonObject(channel.settingsJson)
    const bridgeKind = normalizeString(settings.bridgeKind).toUpperCase()
    if (!SUPPORTED_BRIDGES.has(bridgeKind)) {
      return NextResponse.json({ error: 'Canal no configurado como bridge soportado' }, { status: 409 })
    }

    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)
    if (expectedToken && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Token inválido para bridge CRM' }, { status: 403 })
    }

    const metadata = resolveBridgeMetadata(bridgeKind)
    if (!metadata) {
      return NextResponse.json({ error: 'Bridge no soportado' }, { status: 400 })
    }

    const payload = parseJsonObject(body?.payload)
    const fromName = normalizeString(body?.fromName || body?.nombre || payload.fromName || payload.nombre || payload.name)
    const fromAddress = normalizeString(body?.fromAddress || body?.email || payload.fromAddress || payload.email).toLowerCase()
    const phone = normalizeString(body?.telefono || body?.celular || payload.telefono || payload.celular || payload.phone)
    const messageText = normalizeString(body?.mensaje || body?.message || payload.mensaje || payload.message || payload.bodyPreview || payload.body)
    const empresaNombre = normalizeString(body?.empresaNombre || payload.empresaNombre || payload.company)
    const ciudad = normalizeString(body?.ciudad || payload.ciudad || payload.city)
    const document = normalizeString(body?.documento || payload.documento)
    const sourceCampaign = normalizeString(body?.sourceCampaign || payload.sourceCampaign || payload.campaign)
    const eventAt = parseMaybeDate(body?.eventAt || payload.eventAt || payload.receivedAt)
    const externalThreadId = normalizeString(
      body?.externalThreadId
      || payload.externalThreadId
      || payload.threadId
      || payload.conversationId
      || payload.messageId
      || payload.id,
    )
    const providerMessageId = normalizeString(body?.providerMessageId || payload.providerMessageId || payload.messageId || payload.id)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.sourceUrl) || metadata.landingPageUrl

    if (!fromName && !fromAddress && !phone) {
      return NextResponse.json({ error: 'Se requiere al menos remitente, email o teléfono' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source: 'IMPORT',
        captureType: 'MANUAL_IMPORT',
        activityType: metadata.activityType,
        messageType: 'TEXT',
        eventAt,
        nombre: fromName,
        empresaNombre,
        email: fromAddress,
        phone,
        document,
        ciudad,
        messageText,
        externalThreadId,
        providerMessageId,
        sourceLabel: metadata.sourceLabel,
        sourceCampaign: sourceCampaign || null,
        sourceMedium: metadata.sourceMedium,
        sourceContent: normalizeString(body?.sourceContent || payload.sourceContent || payload.subject) || null,
        utmSource: normalizeString(body?.utmSource || payload.utmSource) || null,
        utmMedium: normalizeString(body?.utmMedium || payload.utmMedium) || metadata.sourceMedium,
        utmCampaign: normalizeString(body?.utmCampaign || payload.utmCampaign) || null,
        utmContent: normalizeString(body?.utmContent || payload.utmContent) || null,
        utmTerm: normalizeString(body?.utmTerm || payload.utmTerm) || null,
        landingPageUrl,
        referrerUrl: normalizeString(body?.referrerUrl || payload.referrerUrl) || null,
        rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
        normalizedDataJson: {
          bridgeKind,
          fromName,
          fromAddress,
          phone,
          empresaNombre,
          ciudad,
          document,
          messageText,
          externalThreadId,
          providerMessageId,
          subject: normalizeString(body?.subject || payload.subject) || null,
          eventAt: eventAt.toISOString(),
        },
      })

      await tx.crmChannelConnection.update({
        where: { id: channel.id },
        data: { lastWebhookAt: eventAt, lastErrorAt: null, lastErrorMessage: null },
      })

      return artifacts
    })

    return NextResponse.json({
      success: true,
      data: {
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture.id,
        bridgeKind,
        testing: channel.status === 'TESTING',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando bridge CRM:', error)
    return NextResponse.json({ error: 'Error capturando bridge CRM' }, { status: 500 })
  }
}