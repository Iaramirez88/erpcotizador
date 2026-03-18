import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { createInboundArtifacts, parseMaybeDate } from '@/lib/crm-omnichannel'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const channelConnectionId = normalizeString(body?.channelConnectionId)
    if (!channelConnectionId) {
      return NextResponse.json({ error: 'channelConnectionId es requerido' }, { status: 400 })
    }

    const channel = await prisma.crmChannelConnection.findUnique({ where: { id: channelConnectionId } })
    if (!channel || channel.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'El canal no está disponible para simulación' }, { status: 409 })
    }

    const provider = channel.provider
    const eventAt = parseMaybeDate(body?.occurredAt)
    const nombre = normalizeString(body?.nombre)
    const email = normalizeString(body?.email).toLowerCase()
    const phone = normalizeString(body?.telefono || body?.celular)
    const empresaNombre = normalizeString(body?.empresaNombre)
    const ciudad = normalizeString(body?.ciudad)
    const document = normalizeString(body?.documento)
    const messageText = normalizeString(body?.message || body?.mensaje)
    const externalThreadId = normalizeString(body?.externalThreadId) || (phone ? `${provider.toLowerCase()}-${phone}` : '')
    const providerMessageId = normalizeString(body?.providerMessageId) || `${provider.toLowerCase()}-${Date.now()}`

    const mapping = provider === 'WEB_FORM'
      ? { source: 'WEB' as const, captureType: 'WEB_FORM' as const, activityType: 'NOTE' as const, messageType: 'FORM_SUBMISSION' as const, sourceLabel: 'Formulario web' }
      : provider === 'WEB_CHATBOT'
        ? { source: 'WEB' as const, captureType: 'CHATBOT_START' as const, activityType: 'NOTE' as const, messageType: 'TEXT' as const, sourceLabel: 'Chatbot web' }
        : provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX'
        ? { source: 'WHATSAPP' as const, captureType: 'WHATSAPP_INBOUND' as const, activityType: 'WHATSAPP' as const, messageType: 'TEXT' as const, sourceLabel: 'WhatsApp' }
        : { source: 'OTRO' as const, captureType: 'MESSENGER_INBOUND' as const, activityType: 'OTHER' as const, messageType: 'TEXT' as const, sourceLabel: 'Messenger/Facebook' }

    const result = await prisma.$transaction(async (tx) => {
      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: access.empresaId,
        sedeId: channel.sedeId,
        createdById: access.userId,
        ownerUserId: access.userId,
        channelConnectionId: channel.id,
        source: mapping.source,
        captureType: mapping.captureType,
        activityType: mapping.activityType,
        messageType: mapping.messageType,
        eventAt,
        nombre,
        empresaNombre,
        email,
        phone,
        document,
        ciudad,
        messageText,
        externalThreadId,
        providerMessageId,
        providerLeadId: normalizeString(body?.providerLeadId) || phone || email || null,
        sourceLabel: mapping.sourceLabel,
        sourceCampaign: normalizeString(body?.sourceCampaign),
        sourceMedium: normalizeString(body?.sourceMedium) || provider,
        sourceContent: normalizeString(body?.sourceContent),
        utmSource: normalizeString(body?.utmSource),
        utmMedium: normalizeString(body?.utmMedium),
        utmCampaign: normalizeString(body?.utmCampaign),
        utmContent: normalizeString(body?.utmContent),
        utmTerm: normalizeString(body?.utmTerm),
        landingPageUrl: normalizeString(body?.landingPageUrl),
        referrerUrl: normalizeString(body?.referrerUrl),
        rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
        normalizedDataJson: {
          nombre,
          email,
          phone,
          empresaNombre,
          ciudad,
          document,
          messageText,
          externalThreadId,
          providerMessageId,
          provider,
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
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error simulando inbound CRM:', error)
    return NextResponse.json({ error: 'Error simulando inbound CRM' }, { status: 500 })
  }
}