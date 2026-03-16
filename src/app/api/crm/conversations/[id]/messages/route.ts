import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString, parseMessageType } from '@/lib/crm'

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
      include: { channelConnection: { select: { provider: true } } },
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

    const row = await prisma.$transaction(async (tx) => {
      const message = await tx.crmMessage.create({
        data: {
          empresaId: access.empresaId,
          sedeId: current.sedeId,
          conversationId: current.id,
          direction: 'OUTBOUND',
          messageType,
          status: 'SENT',
          bodyText,
          payloadJson: { testing: true, provider: current.channelConnection.provider },
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
          status: current.status === 'RESOLVED' ? 'HUMAN_ACTIVE' : current.status,
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: current.sedeId,
          type: current.channelConnection.provider === 'WHATSAPP_CLOUD' || current.channelConnection.provider === 'WHATSAPP_SANDBOX' ? 'WHATSAPP' : 'OTHER',
          summary: 'Mensaje saliente desde CRM',
          details: bodyText,
          leadId: current.leadId,
          opportunityId: current.opportunityId,
          clienteId: current.clienteId,
          occurredAt: message.occurredAt,
          createdById: access.userId,
        },
      })

      return message
    })

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error enviando mensaje CRM:', error)
    return NextResponse.json({ error: 'Error enviando mensaje CRM' }, { status: 500 })
  }
}