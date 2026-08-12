import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getRequestBaseUrl } from '@/lib/app-url'
import { assertCrmSedeAccess, normalizeString, parseMessageType } from '@/lib/crm'
import { findOutboundMessagingLimitViolation, formatOutboundMessagingLimitViolation, getOutboundMessagingLimitConfig, getOutboundMessagingUsageSnapshot, hasOutboundMessagingLimits } from '@/lib/crm-channel-limits'
import { getMetaMessagingDispatchConfig, sendMetaMediaMessage, sendMetaTextMessage } from '@/lib/crm-meta'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppMediaMessage, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'

export const runtime = 'nodejs'

type OutboundAttachmentInput = {
  type: 'IMAGE' | 'AUDIO' | 'DOCUMENT'
  url: string
  filename?: string | null
}

function normalizeAttachment(value: unknown): OutboundAttachmentInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const type = normalizeString(raw.type).toUpperCase()
  const url = normalizeString(raw.url)
  if (!url) return null
  if (type !== 'IMAGE' && type !== 'AUDIO' && type !== 'DOCUMENT') return null
  return {
    type: type as OutboundAttachmentInput['type'],
    url,
    filename: normalizeString(raw.filename) || null,
  }
}

function hasOpenMessagingWindow(lastInboundAt: Date | null) {
  if (!lastInboundAt) return false
  return (Date.now() - lastInboundAt.getTime()) <= 24 * 60 * 60 * 1000
}

function withMessageOrigin(payload: Prisma.InputJsonValue, messageOrigin: 'CRM_AGENT' | 'BOT' | 'SYSTEM') {
  const base = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}

  return {
    ...base,
    messageOrigin,
  } as Prisma.InputJsonValue
}

type RouteContext = {
  params: Promise<{ id: string }>
}

function isForceHybridOverrideEnabled(value: unknown) {
  return value === true
}

function resolveOutboundAttachmentUrl(request: Request, url: string): string {
  if (/^https?:\/\//i.test(url)) return url

  const baseUrl = getRequestBaseUrl(request)
  if (!baseUrl) return url

  try {
    return new URL(url, `${baseUrl}/`).toString()
  } catch {
    return url
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmConversation.findUnique({
      where: { id },
      include: {
        channelConnection: {
          select: {
            id: true,
            name: true,
            provider: true,
            externalPhoneNumberId: true,
            externalPageId: true,
            settingsJson: true,
          },
        },
        messages: {
          where: { direction: 'INBOUND' },
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { occurredAt: true },
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
    const attachment = normalizeAttachment(Array.isArray(body?.attachments) ? body?.attachments[0] : body?.attachment)
    const forceHybridOverride = isForceHybridOverrideEnabled(body?.forceHybridOverride)
    const lastInboundAt = current.messages[0]?.occurredAt ?? null
    const requiresPolicyWindow = current.channelConnection.provider === 'WHATSAPP_CLOUD' || current.channelConnection.provider === 'WHATSAPP_SANDBOX' || current.channelConnection.provider === 'FACEBOOK_PAGE' || current.channelConnection.provider === 'MESSENGER' || current.channelConnection.provider === 'INSTAGRAM_DM'
    const withinMessagingWindow = !requiresPolicyWindow || hasOpenMessagingWindow(lastInboundAt)

    if (messageType === 'TEXT' && !bodyText) {
      return NextResponse.json({ error: 'bodyText es requerido' }, { status: 400 })
    }

    if ((messageType === 'IMAGE' || messageType === 'AUDIO' || messageType === 'DOCUMENT') && !attachment) {
      return NextResponse.json({ error: 'Debes enviar un attachment con URL para mensajes multimedia.' }, { status: 400 })
    }

    const isWhatsApp = current.channelConnection.provider === 'WHATSAPP_CLOUD' || current.channelConnection.provider === 'WHATSAPP_SANDBOX'
    const isMetaMessaging = current.channelConnection.provider === 'FACEBOOK_PAGE' || current.channelConnection.provider === 'MESSENGER' || current.channelConnection.provider === 'INSTAGRAM_DM'
    const whatsappConfig = getWhatsAppDispatchConfig(current.channelConnection)
    const metaConfig = getMetaMessagingDispatchConfig(current.channelConnection.settingsJson)
    const recipientPhone = normalizeWhatsAppRecipient(current.contactPhone)
    const recipientThreadId = normalizeString(current.externalThreadId)
    const outboundLimits = getOutboundMessagingLimitConfig(current.channelConnection.settingsJson)
    const hasCostedProviderDispatch = (isWhatsApp && whatsappConfig.enabled) || (isMetaMessaging && metaConfig.enabled)
    const recentOutboundMessages = await prisma.crmMessage.findMany({
      where: {
        conversationId: current.id,
        direction: 'OUTBOUND',
        occurredAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { occurredAt: 'desc' },
      take: 5,
      select: {
        id: true,
        occurredAt: true,
        bodyText: true,
        payloadJson: true,
      },
    })

    const recentPhoneOutbound = recentOutboundMessages.find((message) => {
      const payload = message.payloadJson && typeof message.payloadJson === 'object' && !Array.isArray(message.payloadJson)
        ? message.payloadJson as Record<string, unknown>
        : null
      return payload?.messageOrigin === 'PHONE_APP' && payload?.collisionDetected === true
    }) ?? null

    if (recentPhoneOutbound && !forceHybridOverride) {
      return NextResponse.json({
        error: 'Parece que ya hubo respuestas cruzadas entre el CRM y otra fuente en esta conversación. Revisa el hilo antes de volver a responder.',
        code: 'HYBRID_RECENT_PHONE_ACTIVITY',
        recentPhoneActivity: {
          id: recentPhoneOutbound.id,
          occurredAt: recentPhoneOutbound.occurredAt.toISOString(),
          bodyText: recentPhoneOutbound.bodyText,
        },
      }, { status: 409 })
    }

    let providerMessageId: string | null = null
    let providerPayload: Prisma.InputJsonValue = { testing: true, provider: current.channelConnection.provider }
    let messageStatus: 'SENT' | 'FAILED' = 'SENT'
    let sendErrorMessage: string | null = null
    const attachmentsJson = attachment ? [{ type: attachment.type.toLowerCase(), url: attachment.url, name: attachment.filename || null }] : []
    const outboundAttachment = attachment
      ? {
          ...attachment,
          url: resolveOutboundAttachmentUrl(request, attachment.url),
        }
      : null

    if (!withinMessagingWindow) {
      const failedMessage = await prisma.$transaction(async (tx) => {
        const message = await tx.crmMessage.create({
          data: {
            empresaId: access.empresaId,
            sedeId: current.sedeId,
            conversationId: current.id,
            providerMessageId: null,
            direction: 'OUTBOUND',
            messageType,
            status: 'FAILED',
            bodyText: bodyText || null,
            payloadJson: withMessageOrigin({
              provider: current.channelConnection.provider,
              dispatch: 'policy-window',
              fallback: isWhatsApp ? 'whatsapp-template-required' : 'wait-for-new-inbound',
              lastInboundAt: lastInboundAt?.toISOString() || null,
            }, 'CRM_AGENT'),
            attachmentsJson,
            sentByUserId: access.userId,
            occurredAt: new Date(),
          },
          include: { sentByUser: { select: { id: true, name: true, email: true } } },
        })

        await tx.crmActivity.create({
          data: {
            empresaId: access.empresaId,
            sedeId: current.sedeId,
            type: isWhatsApp ? 'WHATSAPP' : 'OTHER',
            summary: 'Intento bloqueado por política de ventana de mensajería',
            details: isWhatsApp
              ? 'La ventana de 24 horas de WhatsApp está cerrada. Debe usarse una plantilla aprobada o esperar un nuevo inbound.'
              : 'La ventana de respuesta de Meta está cerrada. Debe esperarse un nuevo inbound o usar otra estrategia autorizada.',
            leadId: current.leadId,
            opportunityId: current.opportunityId,
            clienteId: current.clienteId,
            occurredAt: message.occurredAt,
            createdById: access.userId,
          },
        })

        return message
      })

      return NextResponse.json({
        error: isWhatsApp
          ? 'La ventana de 24 horas de WhatsApp está cerrada. Aún no implementamos fallback con plantillas aprobadas.'
          : 'La ventana de respuesta de Meta está cerrada. Espera un nuevo inbound del contacto para responder desde el inbox.',
        data: failedMessage,
      }, { status: 409 })
    }

    if (hasCostedProviderDispatch && hasOutboundMessagingLimits(outboundLimits)) {
      const usage = await getOutboundMessagingUsageSnapshot({
        empresaId: access.empresaId,
        channelConnectionId: current.channelConnection.id,
      })
      const violation = findOutboundMessagingLimitViolation(outboundLimits, usage)

      if (violation) {
        const limitMessage = formatOutboundMessagingLimitViolation(violation)
        const failedMessage = await prisma.$transaction(async (tx) => {
          const message = await tx.crmMessage.create({
            data: {
              empresaId: access.empresaId,
              sedeId: current.sedeId,
              conversationId: current.id,
              providerMessageId: null,
              direction: 'OUTBOUND',
              messageType,
              status: 'FAILED',
              bodyText: bodyText || null,
              payloadJson: withMessageOrigin({
                provider: current.channelConnection.provider,
                dispatch: 'operational-limit',
                scope: violation.scope,
                window: violation.window,
                limit: violation.limit,
                used: violation.used,
                channelName: current.channelConnection.name,
              }, 'CRM_AGENT'),
              attachmentsJson,
              sentByUserId: access.userId,
              occurredAt: new Date(),
            },
            include: { sentByUser: { select: { id: true, name: true, email: true } } },
          })

          await tx.crmActivity.create({
            data: {
              empresaId: access.empresaId,
              sedeId: current.sedeId,
              type: isWhatsApp ? 'WHATSAPP' : 'OTHER',
              summary: 'Intento bloqueado por límite operativo de mensajería',
              details: `${limitMessage} Ajusta el límite del canal o espera la siguiente ventana operativa.`,
              leadId: current.leadId,
              opportunityId: current.opportunityId,
              clienteId: current.clienteId,
              occurredAt: message.occurredAt,
              createdById: access.userId,
            },
          })

          return message
        })

        return NextResponse.json({
          error: limitMessage,
          data: failedMessage,
          limit: violation,
          usage,
        }, { status: 409 })
      }
    }

    if (isWhatsApp && whatsappConfig.enabled) {
      if (!recipientPhone) {
        return NextResponse.json({ error: 'La conversación no tiene teléfono del contacto para enviar por WhatsApp.' }, { status: 400 })
      }

      try {
        const result = messageType === 'TEXT'
          ? await sendWhatsAppTextMessage({
              config: whatsappConfig,
              to: recipientPhone,
              bodyText,
            })
          : await sendWhatsAppMediaMessage({
              config: whatsappConfig,
              to: recipientPhone,
              attachment: {
                type: outboundAttachment!.type,
                url: outboundAttachment!.url,
                filename: outboundAttachment!.filename,
                caption: bodyText || null,
              },
            })
        providerMessageId = result.providerMessageId
        providerPayload = result.payloadJson
      } catch (error) {
        messageStatus = 'FAILED'
        sendErrorMessage = error instanceof Error ? error.message : 'No se pudo enviar por WhatsApp Cloud.'
        providerPayload = withMessageOrigin({
          provider: current.channelConnection.provider,
          dispatch: 'whatsapp-cloud',
          error: sendErrorMessage,
        }, 'CRM_AGENT')
      }
    } else if (isWhatsApp) {
      providerPayload = withMessageOrigin({
        testing: true,
        provider: current.channelConnection.provider,
        dispatch: 'local-demo',
        reason: 'El canal no tiene access token y phone number id configurados.',
      }, 'CRM_AGENT')
    } else if (isMetaMessaging && metaConfig.enabled) {
      if (!recipientThreadId) {
        return NextResponse.json({ error: 'La conversación no tiene externalThreadId para responder por Meta.' }, { status: 400 })
      }

      try {
        const result = messageType === 'TEXT'
          ? await sendMetaTextMessage({
              config: metaConfig,
              recipientId: recipientThreadId,
              bodyText,
              provider: current.channelConnection.provider,
            })
          : await sendMetaMediaMessage({
              config: metaConfig,
              recipientId: recipientThreadId,
              provider: current.channelConnection.provider,
              attachment: {
                type: outboundAttachment!.type,
                url: outboundAttachment!.url,
                filename: outboundAttachment!.filename,
                caption: bodyText || null,
              },
            })
        providerMessageId = result.providerMessageId
        providerPayload = result.payloadJson
      } catch (error) {
        messageStatus = 'FAILED'
        sendErrorMessage = error instanceof Error ? error.message : 'No se pudo enviar por Meta.'
        providerPayload = withMessageOrigin({
          provider: current.channelConnection.provider,
          dispatch: 'meta-send-api',
          error: sendErrorMessage,
        }, 'CRM_AGENT')
      }
    } else if (isMetaMessaging) {
      providerPayload = withMessageOrigin({
        testing: true,
        provider: current.channelConnection.provider,
        dispatch: 'local-demo',
        reason: 'El canal no tiene page access token sincronizado desde Meta.',
      }, 'CRM_AGENT')
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
          bodyText: bodyText || null,
          payloadJson: withMessageOrigin(providerPayload, 'CRM_AGENT'),
          attachmentsJson,
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
          status: messageStatus === 'FAILED'
            ? current.status
            : current.status === 'RESOLVED' || current.status === 'DISABLED'
              ? 'HUMAN_ACTIVE'
              : 'PENDING',
          resolvedAt: messageStatus === 'FAILED'
            ? current.resolvedAt
            : current.status === 'RESOLVED' || current.status === 'DISABLED'
              ? null
              : current.resolvedAt,
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: current.sedeId,
          type: current.channelConnection.provider === 'WHATSAPP_CLOUD' || current.channelConnection.provider === 'WHATSAPP_SANDBOX' ? 'WHATSAPP' : 'OTHER',
          summary: messageStatus === 'FAILED' ? 'Intento fallido de mensaje saliente desde CRM' : 'Mensaje saliente desde CRM',
            details: sendErrorMessage
              ? `${bodyText || '[Mensaje sin texto]'}\n\nError proveedor: ${sendErrorMessage}`
              : `${bodyText || '[Mensaje multimedia]'}${recentPhoneOutbound ? `\n\nOverride híbrido: el asesor respondió desde CRM después de detectar actividad reciente en celular (${recentPhoneOutbound.id}).` : ''}`,
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