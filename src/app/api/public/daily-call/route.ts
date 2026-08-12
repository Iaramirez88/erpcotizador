import { NextRequest, NextResponse } from 'next/server'
import { getDailyCallsAddonRuntimeForEmpresa } from '@/lib/crm-addons'
import { buildCrmDailyRoomName, createDailyMeetingToken, ensureDailyRoom } from '@/lib/crm-daily-calls'
import { prisma } from '@/lib/prisma'
import { verifyDailyCallInviteToken } from '@/lib/share-token'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ success: false, error: 'Falta token de invitación.' }, { status: 400 })
  }

  const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Falta configurar SHARE_TOKEN_SECRET (o NEXTAUTH_SECRET).' }, { status: 500 })
  }

  const verified = verifyDailyCallInviteToken(token, secret)
  if (!verified) {
    return NextResponse.json({ success: false, error: 'La invitación expiró o no es válida.' }, { status: 401 })
  }

  const conversation = await prisma.crmConversation.findUnique({
    where: { id: verified.conversationId },
    select: {
      id: true,
      empresaId: true,
      contactDisplayName: true,
      contactPhone: true,
      contactEmail: true,
      lead: { select: { nombre: true } },
      cliente: { select: { nombre: true } },
    },
  })

  if (!conversation) {
    return NextResponse.json({ success: false, error: 'La conversación asociada ya no existe.' }, { status: 404 })
  }

  const addonRuntime = await getDailyCallsAddonRuntimeForEmpresa(conversation.empresaId)
  if (!addonRuntime.addon.enabled || !addonRuntime.addon.ready || !addonRuntime.apiKey || !addonRuntime.domainHost) {
    return NextResponse.json({ success: false, error: addonRuntime.addon.validation.message || 'Daily no está listo para esta empresa.' }, { status: 409 })
  }

  const roomName = buildCrmDailyRoomName(addonRuntime.settings.roomPrefix || 'crm-room', conversation.id)
  const contactLabel = conversation.contactDisplayName || conversation.cliente?.nombre || conversation.lead?.nombre || conversation.contactPhone || conversation.contactEmail || 'Invitado'
  const room = await ensureDailyRoom({
    apiKey: addonRuntime.apiKey,
    roomName,
    callType: verified.callType,
    enableRecording: addonRuntime.settings.enableRecording,
    domainHost: addonRuntime.domainHost,
  })
  const guestToken = await createDailyMeetingToken({
    apiKey: addonRuntime.apiKey,
    roomName,
    callType: verified.callType,
    canRecord: false,
    userId: `guest-${conversation.id}`,
    userName: contactLabel,
    isOwner: false,
  })

  return NextResponse.json({
    success: true,
    data: {
      url: room.url || `https://${addonRuntime.domainHost}/${roomName}`,
      token: guestToken.token,
      name: contactLabel,
      roomName,
      callType: verified.callType,
      expiresAt: guestToken.expiresAt,
    },
  })
}