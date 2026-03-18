import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { extractHostFromUrl, getPublicChatbotSettings, getRequestHost, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'

export const runtime = 'nodejs'

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

    if (!channel || channel.provider !== 'WEB_CHATBOT') {
      return NextResponse.json({ error: 'Canal chatbot no encontrado' }, { status: 404 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para chatbot' }, { status: 409 })
    }

    const settings = getPublicChatbotSettings(channel.settingsJson)
    const publicEmbedEnabled = settings.publicEmbedEnabled
    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)
    if (expectedToken && !publicEmbedEnabled && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Token inválido para chatbot' }, { status: 403 })
    }

    const eventAt = new Date()
    const payload = parseJsonObject(body?.payload)
    const nombre = normalizeString(body?.nombre || payload.nombre || payload.name)
    const email = normalizeString(body?.email || payload.email).toLowerCase()
    const phone = normalizeString(body?.telefono || body?.celular || payload.telefono || payload.celular || payload.phone)
    const messageText = normalizeString(body?.mensaje || body?.message || payload.mensaje || payload.message || payload.question)
    const empresaNombre = normalizeString(body?.empresaNombre || payload.empresaNombre || payload.company)
    const ciudad = normalizeString(body?.ciudad || payload.ciudad || payload.city)
    const document = normalizeString(body?.documento || payload.documento)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.pageUrl)
    const referrerUrl = normalizeString(body?.referrerUrl || payload.referrerUrl)
    const requestHuman = Boolean(body?.requestHuman || payload.requestHuman)

    if (publicEmbedEnabled) {
      const requestHost = await getRequestHost()
      const embedHost = extractHostFromUrl(referrerUrl || landingPageUrl)
      if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: embedHost || requestHost, appHost: requestHost })) {
        return NextResponse.json({ error: 'Dominio no autorizado para este chatbot' }, { status: 403 })
      }
    }

    if (!nombre && !email && !phone) {
      return NextResponse.json({ error: 'Se requiere al menos nombre, email o teléfono' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source: 'WEB',
        captureType: 'CHATBOT_START',
        activityType: 'NOTE',
        messageType: 'TEXT',
        eventAt,
        nombre,
        empresaNombre,
        email,
        phone,
        document,
        ciudad,
        messageText,
        externalThreadId: normalizeString(body?.externalThreadId || payload.externalThreadId || `${channel.id}-${phone || email || Date.now()}`),
        providerMessageId: normalizeString(body?.providerMessageId || payload.providerMessageId || `chatbot-${Date.now()}`),
        providerLeadId: normalizeString(body?.providerLeadId || phone || email || null),
        sourceLabel: 'Chatbot web',
        sourceCampaign: normalizeString(body?.utmCampaign || payload.utmCampaign),
        sourceMedium: normalizeString(body?.utmMedium || payload.utmMedium) || 'web-chatbot',
        sourceContent: normalizeString(body?.utmContent || payload.utmContent),
        utmSource: normalizeString(body?.utmSource || payload.utmSource),
        utmMedium: normalizeString(body?.utmMedium || payload.utmMedium),
        utmCampaign: normalizeString(body?.utmCampaign || payload.utmCampaign),
        utmContent: normalizeString(body?.utmContent || payload.utmContent),
        utmTerm: normalizeString(body?.utmTerm || payload.utmTerm),
        landingPageUrl,
        referrerUrl,
        rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
        normalizedDataJson: {
          nombre,
          email,
          phone,
          empresaNombre,
          ciudad,
          document,
          messageText,
          requestHuman,
          landingPageUrl,
          referrerUrl,
        },
      })

      await tx.crmConversation.update({
        where: { id: artifacts.conversation.id },
        data: {
          status: requestHuman ? 'HUMAN_ACTIVE' : 'BOT_ACTIVE',
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
        testing: channel.status === 'TESTING',
        publicEmbedEnabled,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando chatbot CRM:', error)
    return NextResponse.json({ error: 'Error capturando chatbot CRM' }, { status: 500 })
  }
}