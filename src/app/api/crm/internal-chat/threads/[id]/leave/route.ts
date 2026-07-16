import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'INTERNAL_CHAT',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const thread = await prisma.internalChatThread.findUnique({
      where: { id },
      include: { participants: true, messages: { orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }], take: 1, select: { occurredAt: true } } },
    })

    if (!thread || thread.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    }
    if (thread.type !== 'GROUP') {
      return NextResponse.json({ error: 'Solo puedes salir de grupos.' }, { status: 400 })
    }

    const participant = thread.participants.find((item) => item.userId === access.userId)
    if (!participant) {
      return NextResponse.json({ error: 'No perteneces a este grupo.' }, { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.internalChatParticipant.delete({ where: { id: participant.id } })

      const remainingParticipants = await tx.internalChatParticipant.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      })

      if (remainingParticipants.length === 0) {
        await tx.internalChatThread.delete({ where: { id: thread.id } })
        return
      }

      if (thread.createdById === access.userId) {
        await tx.internalChatThread.update({
          where: { id: thread.id },
          data: {
            createdById: remainingParticipants[0]?.userId ?? null,
            lastMessageAt: thread.messages[0]?.occurredAt ?? thread.lastMessageAt,
          },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saliendo del grupo interno CRM:', error)
    return NextResponse.json({ error: 'Error saliendo del grupo interno CRM' }, { status: 500 })
  }
}