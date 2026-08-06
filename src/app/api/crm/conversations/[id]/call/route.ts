import { AccessLevel, Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getRequestBaseUrl } from '@/lib/app-url'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import { getDailyCallsAddonRuntimeForEmpresa } from '@/lib/crm-addons'
import { findOutboundMessagingLimitViolation, formatOutboundMessagingLimitViolation, getOutboundMessagingLimitConfig, getOutboundMessagingUsageSnapshot, hasOutboundMessagingLimits } from '@/lib/crm-channel-limits'
import { prisma } from '@/lib/prisma'
import { assertCrmSedeAccess } from '@/lib/crm'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

type DailyRoomResponse = {
  name?: string
  url?: string
}

type InviteDispatchResult = {
  attempted: boolean
  sent: boolean
  channel: 'WHATSAPP' | 'NONE'
  recipient: string | null
  inviteUrl: string | null
  error: string | null
}

function normalizeRoomSegment(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
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
    `${args.advisorName} te invitó a una ${args.callType === 'audio' ? 'llamada de audio' : 'videollamada'} desde SGDigital CRM.`,
    'Puedes entrar desde tu navegador con este enlace seguro:',
    args.inviteUrl,
    'Si ves el aviso de micrófono o cámara, acéptalo para unirte a la llamada.',
  ].filter(Boolean).join('\n\n')
}

async function dailyRequest<T>(args: {
  apiKey: string
  path: string
  method?: 'GET' | 'POST'
  body?: Prisma.JsonObject
}) {
  const response = await fetch(`https://api.daily.co/v1${args.path}`, {
    method: args.method || 'GET',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      Accept: 'application/json',
      ...(args.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
    cache: 'no-store',
  })

  const json = await response.json().catch(() => null) as Record<string, unknown> | null

  return {
    ok: response.ok,
    status: response.status,
    json,
  }
}

async function ensureDailyRoom(args: {
  apiKey: string
  roomName: string
  callType: 'video' | 'audio'
  enableRecording: boolean
  domainHost: string
}) {
  const current = await dailyRequest<DailyRoomResponse>({
    apiKey: args.apiKey,
    path: `/rooms/${encodeURIComponent(args.roomName)}`,
  })

  if (current.ok) {
    return current.json as DailyRoomResponse
  }

  if (current.status !== 404) {
    throw new Error((current.json?.info as string) || (current.json?.error as string) || `Daily devolvió ${current.status} al consultar la sala.`)
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = nowSeconds + (8 * 60 * 60)
  const created = await dailyRequest<DailyRoomResponse>({
    apiKey: args.apiKey,
    path: '/rooms',
    method: 'POST',
    body: {
      name: args.roomName,
      privacy: 'private',
      properties: {
        exp: expiresAt,
        eject_at_room_exp: true,
        start_video_off: args.callType === 'audio',
        start_audio_off: false,
        enable_prejoin_ui: true,
        enable_screenshare: args.callType === 'video',
        enable_chat: false,
        enable_people_ui: true,
        enable_network_ui: false,
        ...(args.enableRecording ? { enable_recording: 'local' } : {}),
        lang: 'es',
      },
    },
  })

  if (!created.ok) {
    throw new Error((created.json?.info as string) || (created.json?.error as string) || `Daily devolvió ${created.status} al crear la sala.`)
  }

  return {
    ...(created.json as DailyRoomResponse),
    url: (created.json?.url as string) || `https://${args.domainHost}/${args.roomName}`,
  }
}

async function createDailyMeetingToken(args: {
  apiKey: string
  roomName: string
  callType: 'video' | 'audio'
  canRecord: boolean
  userId: string
  userName: string
  isOwner?: boolean
}) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = nowSeconds + (2 * 60 * 60)
  const response = await dailyRequest<{ token?: string }>({
    apiKey: args.apiKey,
    path: '/meeting-tokens',
    method: 'POST',
    body: {
      properties: {
        room_name: args.roomName,
        user_name: args.userName,
        user_id: args.userId.slice(0, 36),
        is_owner: args.isOwner !== false,
        nbf: nowSeconds - 30,
        exp: expiresAt,
        eject_at_token_exp: true,
        start_video_off: args.callType === 'audio',
        start_audio_off: false,
        enable_prejoin_ui: true,
        enable_recording_ui: args.canRecord,
        lang: 'es',
      },
    },
  })

  const token = typeof response.json?.token === 'string' ? response.json.token : ''
  if (!response.ok || !token) {
    throw new Error((response.json?.info as string) || (response.json?.error as string) || `Daily devolvió ${response.status} al crear el token.`)
  }

  return {
    token,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }
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
    status: 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED' | 'SPAM'
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

  const bodyText = buildGuestInviteMessage(args)
  let providerMessageId: string | null = null
  let messageStatus: 'SENT' | 'FAILED' = 'SENT'
  let sendErrorMessage: string | null = null
  let providerPayload: Prisma.InputJsonValue = withMessageOrigin({ provider: args.conversation.channelConnection.provider, dispatch: 'whatsapp-call-invite', inviteUrl: args.inviteUrl }, 'CRM_AGENT')

  try {
    const result = await sendWhatsAppTextMessage({ config: whatsappConfig, to: recipientPhone, bodyText })
    providerMessageId = result.providerMessageId
    providerPayload = withMessageOrigin({ ...(result.payloadJson as Record<string, unknown>), dispatch: 'whatsapp-call-invite', inviteUrl: args.inviteUrl }, 'CRM_AGENT')
  } catch (error) {
    messageStatus = 'FAILED'
    sendErrorMessage = error instanceof Error ? error.message : 'No se pudo enviar la invitación por WhatsApp.'
    providerPayload = withMessageOrigin({ provider: args.conversation.channelConnection.provider, dispatch: 'whatsapp-call-invite', inviteUrl: args.inviteUrl, error: sendErrorMessage }, 'CRM_AGENT')
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
        bodyText,
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
        status: messageStatus === 'FAILED' ? args.conversation.status : args.conversation.status === 'RESOLVED' ? 'HUMAN_ACTIVE' : 'PENDING',
        resolvedAt: messageStatus === 'FAILED' ? args.conversation.resolvedAt : args.conversation.status === 'RESOLVED' ? null : args.conversation.resolvedAt,
      },
    })

    await tx.crmActivity.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.conversation.sedeId,
        type: 'WHATSAPP',
        summary: messageStatus === 'FAILED' ? 'Falló el envío de invitación a videollamada' : 'Invitación a videollamada enviada por WhatsApp',
        details: sendErrorMessage ? `${bodyText}\n\nError proveedor: ${sendErrorMessage}` : `${bodyText}\n\nInvitación enviada al contacto ${recipientPhone}.`,
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

    const roomPrefix = normalizeRoomSegment(addonRuntime.settings.roomPrefix || 'crm-room', 'crm-room')
    const roomName = `${roomPrefix}-${normalizeRoomSegment(conversation.id, 'conversation')}`
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
    const guestInviteUrl = baseUrl
      ? `${baseUrl}/llamada?callType=${encodeURIComponent(requestedCallType)}#url=${encodeURIComponent(joinUrl)}&token=${encodeURIComponent(guestToken.token)}&name=${encodeURIComponent(contactLabel)}&room=${encodeURIComponent(roomName)}`
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