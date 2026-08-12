import { AccessLevel, Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getRequestBaseUrl } from '@/lib/app-url'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import { getDailyCallsAddonRuntimeForEmpresa } from '@/lib/crm-addons'
import { findOutboundMessagingLimitViolation, formatOutboundMessagingLimitViolation, getOutboundMessagingLimitConfig, getOutboundMessagingUsageSnapshot, hasOutboundMessagingLimits } from '@/lib/crm-channel-limits'
import { buildCrmDailyRoomName, createDailyMeetingToken, ensureDailyRoom } from '@/lib/crm-daily-calls'
import { prisma } from '@/lib/prisma'
import { assertCrmSedeAccess } from '@/lib/crm'
import { createDailyCallInviteToken } from '@/lib/share-token'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

type InviteDispatchResult = {
  attempted: boolean
  sent: boolean
  channel: 'WHATSAPP' | 'NONE'
  recipient: string | null
  inviteUrl: string | null
  error: string | null
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

function buildGuestInviteMessage(args: {
  advisorName: string
  contactLabel: string
  inviteUrl: string
  callType: 'video' | 'audio'
}) {
  return [
    `Hola ${args.contactLabel || 'cliente'},`,
    `${args.advisorName} te invita a una ${args.callType === 'audio' ? 'llamada' : 'videollamada'}:`,
    `Entra aquí: ${args.inviteUrl}`,
    args.callType === 'audio' ? 'Abre el enlace y permite el micrófono cuando el navegador lo pida.' : 'Abre el enlace y permite micrófono/cámara cuando el navegador lo pida.',
  ].filter(Boolean).join('\n\n')
}

function buildCrmInviteSummary(callType: 'video' | 'audio') {
  return callType === 'audio' ? 'Invitacion a llamada de audio' : 'Invitacion a videollamada'
}

async function sendWhatsAppDailyInvite(args: {
  empresaId: string
  userId: string
  conversation: {
    id: string
    sedeId: string | null
    leadId: string | null
    opportunityId: string | null
    clienteId: string | null
    status: 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'DISABLED' | 'RESOLVED' | 'SPAM'
    resolvedAt: Date | null
    contactPhone: string | null
    channelConnection: {
      id: string
      name: string
      provider: 'WHATSAPP_CLOUD' | 'WHATSAPP_SANDBOX' | 'FACEBOOK_PAGE' | 'MESSENGER' | 'WEB_FORM' | 'WEB_CHATBOT' | 'INSTAGRAM_DM'
      externalPhoneNumberId: string | null
      externalPageId: string | null
      settingsJson: Prisma.JsonValue
    }
    messages: Array<{ occurredAt: Date }>
  }
  advisorName: string
  contactLabel: string
  inviteUrl: string
  callType: 'video' | 'audio'
}): Promise<InviteDispatchResult> {
  const isWhatsApp = args.conversation.channelConnection.provider === 'WHATSAPP_CLOUD' || args.conversation.channelConnection.provider === 'WHATSAPP_SANDBOX'
  if (!isWhatsApp) {
    return { attempted: false, sent: false, channel: 'NONE', recipient: null, inviteUrl: args.inviteUrl, error: 'La invitación automática solo está disponible para conversaciones de WhatsApp.' }
  }

  const recipientPhone = normalizeWhatsAppRecipient(args.conversation.contactPhone)
  if (!recipientPhone) {
    return { attempted: true, sent: false, channel: 'WHATSAPP', recipient: null, inviteUrl: args.inviteUrl, error: 'La conversación no tiene un número válido para enviar la invitación.' }
  }

  if (!hasOpenMessagingWindow(args.conversation.messages[0]?.occurredAt ?? null)) {
    return { attempted: true, sent: false, channel: 'WHATSAPP', recipient: recipientPhone, inviteUrl: args.inviteUrl, error: 'La ventana de 24 horas de WhatsApp está cerrada. Aún no implementamos plantillas aprobadas para invitar a llamada.' }
  }

  const whatsappConfig = getWhatsAppDispatchConfig(args.conversation.channelConnection)
  if (!whatsappConfig.enabled) {
    return { attempted: true, sent: false, channel: 'WHATSAPP', recipient: recipientPhone, inviteUrl: args.inviteUrl, error: 'El canal de WhatsApp no tiene credenciales productivas completas.' }
  }

  const outboundLimits = getOutboundMessagingLimitConfig(args.conversation.channelConnection.settingsJson)
  if (hasOutboundMessagingLimits(outboundLimits)) {
    const usage = await getOutboundMessagingUsageSnapshot({ empresaId: args.empresaId, channelConnectionId: args.conversation.channelConnection.id })
    const violation = findOutboundMessagingLimitViolation(outboundLimits, usage)
    if (violation) {
      return { attempted: true, sent: false, channel: 'WHATSAPP', recipient: recipientPhone, inviteUrl: args.inviteUrl, error: formatOutboundMessagingLimitViolation(violation) }
    }
  }

  const providerBodyText = buildGuestInviteMessage(args)
  const crmBodyText = buildCrmInviteSummary(args.callType)
  let providerMessageId: string | null = null
  let messageStatus: 'SENT' | 'FAILED' = 'SENT'
  let sendErrorMessage: string | null = null
  let providerPayload: Prisma.InputJsonValue = withMessageOrigin({ provider: args.conversation.channelConnection.provider, dispatch: 'whatsapp-call-invite', inviteUrl: args.inviteUrl, callType: args.callType }, 'CRM_AGENT')

  try {
    const result = await sendWhatsAppTextMessage({ config: whatsappConfig, to: recipientPhone, bodyText: providerBodyText })
    providerMessageId = result.providerMessageId
    providerPayload = withMessageOrigin({ ...(result.payloadJson as Record<string, unknown>), dispatch: 'whatsapp-call-invite', inviteUrl: args.inviteUrl, callType: args.callType }, 'CRM_AGENT')
  } catch (error) {
    messageStatus = 'FAILED'
    sendErrorMessage = error instanceof Error ? error.message : 'No se pudo enviar la invitación por WhatsApp.'
    providerPayload = withMessageOrigin({ provider: args.conversation.channelConnection.provider, dispatch: 'whatsapp-call-invite', inviteUrl: args.inviteUrl, callType: args.callType, error: sendErrorMessage }, 'CRM_AGENT')
  }

  const occurredAt = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.crmMessage.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.conversation.sedeId,
        conversationId: args.conversation.id,
        providerMessageId,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        status: messageStatus,
        bodyText: crmBodyText,
        payloadJson: providerPayload,
        attachmentsJson: [],
        sentByUserId: args.userId,
        occurredAt,
      },
    })

    await tx.crmConversation.update({
      where: { id: args.conversation.id },
      data: {
        lastMessageAt: occurredAt,
        directionLastMessage: 'OUTBOUND',
        status: messageStatus === 'FAILED' ? args.conversation.status : args.conversation.status === 'RESOLVED' || args.conversation.status === 'DISABLED' ? 'HUMAN_ACTIVE' : 'PENDING',
        resolvedAt: messageStatus === 'FAILED' ? args.conversation.resolvedAt : args.conversation.status === 'RESOLVED' || args.conversation.status === 'DISABLED' ? null : args.conversation.resolvedAt,
      },
    })

    await tx.crmActivity.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.conversation.sedeId,
        type: 'WHATSAPP',
        summary: messageStatus === 'FAILED'
          ? `Falló el envío de invitación a ${args.callType === 'audio' ? 'llamada' : 'videollamada'}`
          : `Invitación a ${args.callType === 'audio' ? 'llamada' : 'videollamada'} enviada por WhatsApp`,
        details: sendErrorMessage ? `${providerBodyText}\n\nError proveedor: ${sendErrorMessage}` : `${providerBodyText}\n\nInvitación enviada al contacto ${recipientPhone}.`,
        leadId: args.conversation.leadId,
        opportunityId: args.conversation.opportunityId,
        clienteId: args.conversation.clienteId,
        occurredAt,
        createdById: args.userId,
      },
    })
  })

  return { attempted: true, sent: messageStatus === 'SENT', channel: 'WHATSAPP', recipient: recipientPhone, inviteUrl: args.inviteUrl, error: sendErrorMessage }
}

async function resolveDailyCallPermissions(args: {
  empresaId: string
  userId: string
  sedeId?: string | null
  assignedToUserId?: string | null
  enableRecording: boolean
}) {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: args.userId }, select: { role: true } }),
    args.sedeId
      ? prisma.sedeMembership.findUnique({ where: { sedeId_userId: { sedeId: args.sedeId, userId: args.userId } }, select: { role: true } })
      : Promise.resolve(null),
  ])

  const isSystemAdmin = user?.role === 'ADMIN'
  const isSedeAdminOrManager = membership?.role === 'ADMIN' || membership?.role === 'MANAGER'
  const isAssignedAdvisor = Boolean(args.assignedToUserId && args.assignedToUserId === args.userId)

  return {
    canStart: isSystemAdmin || isSedeAdminOrManager || isAssignedAdvisor,
    canJoin: isSystemAdmin || isSedeAdminOrManager || isAssignedAdvisor,
    canRecord: args.enableRecording && (isSystemAdmin || isSedeAdminOrManager),
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
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const requestedCallType = body?.callType === 'audio' ? 'audio' : 'video'
    const shouldSendWhatsappInvite = body?.sendWhatsappInvite === true

    const [conversation, addonRuntime, user] = await Promise.all([
      prisma.crmConversation.findUnique({
        where: { id },
        include: {
          lead: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, nombre: true } },
          channelConnection: { select: { id: true, name: true, provider: true, externalPhoneNumberId: true, externalPageId: true, settingsJson: true } },
          messages: {
            where: { direction: 'INBOUND' },
            orderBy: { occurredAt: 'desc' },
            take: 1,
            select: { occurredAt: true },
          },
        },
      }),
      getDailyCallsAddonRuntimeForEmpresa(access.empresaId),
      prisma.user.findUnique({ where: { id: access.userId }, select: { id: true, name: true, email: true } }),
    ])

    if (!conversation || conversation.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    if (conversation.sedeId) {
      const denied = await assertCrmSedeAccess({
        sedeId: conversation.sedeId,
        empresaId: access.empresaId,
        userId: access.userId,
        minLevel: AccessLevel.READ,
      })
      if (denied) return denied
    }

    if (!addonRuntime.addon.enabled) {
      return NextResponse.json({
        error: 'El addon Daily no está activado para esta empresa.',
        data: { addon: addonRuntime.addon },
      }, { status: 409 })
    }

    if (!addonRuntime.addon.commercial.canUseAddon) {
      return NextResponse.json({
        error: addonRuntime.addon.commercial.status === 'SUSPENDED'
          ? 'El addon Daily está suspendido comercialmente para esta empresa.'
          : 'El addon Daily aún no está activado comercialmente. Pásalo a prueba interna o activo comercial para usarlo.',
        data: { addon: addonRuntime.addon },
      }, { status: 409 })
    }

    if (!addonRuntime.addon.ready || !addonRuntime.apiKey || !addonRuntime.domainHost) {
      return NextResponse.json({
        error: addonRuntime.addon.validation.message || 'El addon Daily todavía no está listo.',
        data: { addon: addonRuntime.addon },
      }, { status: 409 })
    }

    const roomName = buildCrmDailyRoomName(addonRuntime.settings.roomPrefix || 'crm-room', conversation.id)
    const contactLabel = conversation.contactDisplayName || conversation.cliente?.nombre || conversation.lead?.nombre || conversation.contactPhone || conversation.contactEmail || 'Contacto CRM'
    const ownerDisplayName = user?.name?.trim() || user?.email?.trim() || 'Asesor CRM'
    const permissions = await resolveDailyCallPermissions({
      empresaId: access.empresaId,
      userId: access.userId,
      sedeId: conversation.sedeId,
      assignedToUserId: conversation.assignedToUserId,
      enableRecording: addonRuntime.settings.enableRecording,
    })

    if (!permissions.canStart) {
      return NextResponse.json({ error: 'No tienes permiso para iniciar esta llamada. Debe abrirla el asesor asignado o un admin/manager de la sede.' }, { status: 403 })
    }

    const room = await ensureDailyRoom({
      apiKey: addonRuntime.apiKey,
      roomName,
      callType: requestedCallType,
      enableRecording: addonRuntime.settings.enableRecording,
      domainHost: addonRuntime.domainHost,
    })
    const ownerToken = await createDailyMeetingToken({
      apiKey: addonRuntime.apiKey,
      roomName,
      callType: requestedCallType,
      canRecord: permissions.canRecord,
      userId: access.userId,
      userName: ownerDisplayName,
      isOwner: true,
    })
    const guestToken = await createDailyMeetingToken({
      apiKey: addonRuntime.apiKey,
      roomName,
      callType: requestedCallType,
      canRecord: false,
      userId: `guest-${conversation.id}`,
      userName: contactLabel,
      isOwner: false,
    })
    const joinUrl = room.url || `https://${addonRuntime.domainHost}/${roomName}`
    const sessionKey = crypto.randomUUID()
    const baseUrl = getRequestBaseUrl(request)
    const inviteSecret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
    const inviteToken = inviteSecret
      ? createDailyCallInviteToken({ conversationId: conversation.id, callType: requestedCallType, ttlSeconds: 8 * 60 * 60, secret: inviteSecret })
      : null
    const guestInviteUrl = baseUrl
      ? inviteToken
        ? `${baseUrl}/llamada?token=${encodeURIComponent(inviteToken)}`
        : `${baseUrl}/llamada?m=${requestedCallType === 'audio' ? 'a' : 'v'}#h=${encodeURIComponent(addonRuntime.domainHost)}&r=${encodeURIComponent(roomName)}&t=${encodeURIComponent(guestToken.token)}`
      : null
    const inviteDispatch = shouldSendWhatsappInvite && guestInviteUrl
      ? await sendWhatsAppDailyInvite({
          empresaId: access.empresaId,
          userId: access.userId,
          conversation: {
            id: conversation.id,
            sedeId: conversation.sedeId,
            leadId: conversation.leadId,
            opportunityId: conversation.opportunityId,
            clienteId: conversation.clienteId,
            status: conversation.status,
            resolvedAt: conversation.resolvedAt,
            contactPhone: conversation.contactPhone,
            channelConnection: conversation.channelConnection,
            messages: conversation.messages,
          },
          advisorName: ownerDisplayName,
          contactLabel,
          inviteUrl: guestInviteUrl,
          callType: requestedCallType,
        })
      : {
          attempted: false,
          sent: false,
          channel: 'NONE' as const,
          recipient: null,
          inviteUrl: guestInviteUrl,
          error: guestInviteUrl ? null : 'No se pudo resolver la URL pública del invitado.',
        }

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        roomName,
        callType: requestedCallType || addonRuntime.settings.defaultCallType,
        launchMode: 'EMBED_MODAL',
        connectionMode: addonRuntime.settings.connectionMode,
        domainHost: addonRuntime.domainHost,
        joinUrl,
        ownerToken: ownerToken.token,
        ownerDisplayName,
        ownerUserId: access.userId,
        expiresAt: ownerToken.expiresAt,
        sessionKey,
        enableRecording: permissions.canRecord,
        contactLabel,
        provider: conversation.channelConnection.provider,
        readinessMessage: addonRuntime.addon.validation.message,
        guestInviteUrl,
        inviteDispatch,
      },
    })
  } catch (error) {
    console.error('Error preparando llamada CRM:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error preparando llamada CRM' }, { status: 500 })
  }
}