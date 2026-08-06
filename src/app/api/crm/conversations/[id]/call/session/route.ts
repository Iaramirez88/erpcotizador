import { NextResponse } from 'next/server'
import { AccessLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess } from '@/lib/crm'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

type SessionEvent = 'JOINED' | 'LEFT' | 'FAILED'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseIsoDate(value: unknown) {
  const normalized = normalizeString(value)
  if (!normalized) return new Date()
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

async function canOperateDailyCall(args: { userId: string; sedeId?: string | null; assignedToUserId?: string | null }) {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: args.userId }, select: { role: true } }),
    args.sedeId
      ? prisma.sedeMembership.findUnique({ where: { sedeId_userId: { sedeId: args.sedeId, userId: args.userId } }, select: { role: true } })
      : Promise.resolve(null),
  ])

  return user?.role === 'ADMIN'
    || membership?.role === 'ADMIN'
    || membership?.role === 'MANAGER'
    || Boolean(args.assignedToUserId && args.assignedToUserId === args.userId)
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
    const conversation = await prisma.crmConversation.findUnique({ where: { id } })
    if (!conversation || conversation.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    if (conversation.sedeId) {
      const denied = await assertCrmSedeAccess({
        sedeId: conversation.sedeId,
        empresaId: access.empresaId,
        userId: access.userId,
        minLevel: AccessLevel.WRITE,
      })
      if (denied) return denied
    }

    const allowed = await canOperateDailyCall({
      userId: access.userId,
      sedeId: conversation.sedeId,
      assignedToUserId: conversation.assignedToUserId,
    })
    if (!allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar eventos de esta llamada.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const event = normalizeString(body?.event) as SessionEvent
    if (event !== 'JOINED' && event !== 'LEFT' && event !== 'FAILED') {
      return NextResponse.json({ error: 'Evento de llamada inválido' }, { status: 400 })
    }

    const roomName = normalizeString(body?.roomName)
    const sessionKey = normalizeString(body?.sessionKey)
    const callType = body?.callType === 'audio' ? 'audio' : 'video'
    const durationSeconds = typeof body?.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
      ? Math.max(0, Math.round(body.durationSeconds))
      : null
    const errorMessage = normalizeString(body?.errorMessage) || null
    const occurredAt = parseIsoDate(body?.occurredAt)
    const startedAt = normalizeString(body?.startedAt) || null
    const endedAt = normalizeString(body?.endedAt) || null

    const summary = event === 'JOINED'
      ? `Llamada ${callType === 'audio' ? 'de audio' : 'de video'} iniciada`
      : event === 'LEFT'
        ? `Llamada ${callType === 'audio' ? 'de audio' : 'de video'} finalizada`
        : `Falló la llamada ${callType === 'audio' ? 'de audio' : 'de video'}`

    const details = [
      roomName ? `Sala: ${roomName}` : '',
      sessionKey ? `Sesión: ${sessionKey}` : '',
      durationSeconds !== null ? `Duración: ${durationSeconds}s` : '',
      errorMessage || '',
    ].filter(Boolean).join(' · ')

    await prisma.$transaction(async (tx) => {
      await tx.crmMessage.create({
        data: {
          empresaId: access.empresaId,
          sedeId: conversation.sedeId,
          conversationId: conversation.id,
          direction: 'SYSTEM',
          messageType: 'EVENT',
          status: event === 'FAILED' ? 'FAILED' : 'SENT',
          bodyText: summary,
          payloadJson: {
            eventType: 'DAILY_CALL_SESSION',
            sessionEvent: event,
            roomName,
            sessionKey,
            callType,
            startedAt,
            endedAt,
            durationSeconds,
            errorMessage,
          },
          attachmentsJson: [],
          sentByUserId: access.userId,
          occurredAt,
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: conversation.sedeId,
          type: 'CALL',
          summary,
          details: details || null,
          leadId: conversation.leadId,
          opportunityId: conversation.opportunityId,
          clienteId: conversation.clienteId,
          occurredAt,
          createdById: access.userId,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error registrando sesión Daily CRM:', error)
    return NextResponse.json({ error: 'Error registrando sesión Daily CRM' }, { status: 500 })
  }
}