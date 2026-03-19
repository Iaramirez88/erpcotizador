import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString, parseMessageType } from '@/lib/crm'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmConversation.findUnique({
      where: { id },
      include: {
        channelConnection: {
          select: {
            provider: true,
            externalPhoneNumberId: true,
            externalPageId: true,
            settingsJson: true,
          },
        },
      },
    })
    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const bodyText = normalizeString(body?.bodyText)
    const messageType = parseMessageType(body?.messageType) ?? 'TEXT'

    if (!bodyText) {
      return NextResponse.json({ error: 'bodyText es requerido' }, { status: 400 })
    }

    const isWhatsApp = current.channelConnection.provider === 'WHATSAPP_CLOUD' || current.channelConnection.provider === 'WHATSAPP_SANDBOX'
    const whatsappConfig = getWhatsAppDispatchConfig(current.channelConnection)
    const recipientPhone = normalizeWhatsAppRecipient(current.contactPhone)

    let providerMessageId: string | null = null
    let providerPayload: Prisma.InputJsonValue = { testing: true, provider: current.channelConnection.provider }
    let messageStatus: 'SENT' | 'FAILED' = 'SENT'
    let sendErrorMessage: string | null = null

    if (isWhatsApp && whatsappConfig.enabled) {
      if (!recipientPhone) {
        return NextResponse.json({ error: 'La conversación no tiene teléfono del contacto para enviar por WhatsApp.' }, { status: 400 })
      }

      try {
        const result = await sendWhatsAppTextMessage({
          config: whatsappConfig,
          to: recipientPhone,
          bodyText,
        })
        providerMessageId = result.providerMessageId
        providerPayload = result.payloadJson
      } catch (error) {
        messageStatus = 'FAILED'
        sendErrorMessage = error instanceof Error ? error.message : 'No se pudo enviar por WhatsApp Cloud.'
        providerPayload = {
          provider: current.channelConnection.provider,
          dispatch: 'whatsapp-cloud',
          error: sendErrorMessage,
        }
      }
    } else if (isWhatsApp) {
      providerPayload = {
        testing: true,
        provider: current.channelConnection.provider,
        dispatch: 'local-demo',
        reason: 'El canal no tiene access token y phone number id configurados.',
      }
    }

    const row = await prisma.$transaction(async (tx) => {
      const message = await tx.crmMessage.create({
        data: {
          empresaId: access.empresaId,
          sedeId: current.sedeId,
          conversationId: current.id,
          providerMessageId,
          direction: 'OUTBOUND',
          messageType,
          status: messageStatus,
          bodyText,
          payloadJson: providerPayload,
          attachmentsJson: [],
          sentByUserId: access.userId,
          occurredAt: new Date(),
        },
        include: { sentByUser: { select: { id: true, name: true, email: true } } },
      })

      await tx.crmConversation.update({
        where: { id: current.id },
        data: {
          lastMessageAt: message.occurredAt,
          directionLastMessage: 'OUTBOUND',
          status: messageStatus === 'FAILED' ? current.status : (current.status === 'RESOLVED' ? 'HUMAN_ACTIVE' : current.status),
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: current.sedeId,
          type: current.channelConnection.provider === 'WHATSAPP_CLOUD' || current.channelConnection.provider === 'WHATSAPP_SANDBOX' ? 'WHATSAPP' : 'OTHER',
          summary: messageStatus === 'FAILED' ? 'Intento fallido de mensaje saliente desde CRM' : 'Mensaje saliente desde CRM',
          details: sendErrorMessage ? `${bodyText}\n\nError proveedor: ${sendErrorMessage}` : bodyText,
          leadId: current.leadId,
          opportunityId: current.opportunityId,
          clienteId: current.clienteId,
          occurredAt: message.occurredAt,
          createdById: access.userId,
        },
      })

      return message
    })

    if (messageStatus === 'FAILED') {
      return NextResponse.json({ error: sendErrorMessage || 'No se pudo enviar el mensaje por WhatsApp.', data: row }, { status: 502 })
    }

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error enviando mensaje CRM:', error)
    return NextResponse.json({ error: 'Error enviando mensaje CRM' }, { status: 500 })
  }
}