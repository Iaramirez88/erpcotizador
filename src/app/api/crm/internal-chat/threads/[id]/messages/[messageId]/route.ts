import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string; messageId: string }>
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'INTERNAL_CHAT',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id, messageId } = await context.params
    const message = await prisma.internalChatMessage.findUnique({
      where: { id: messageId },
      include: { thread: { include: { participants: true, messages: { orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }], take: 2, select: { id: true, occurredAt: true } } } } },
    })

    if (!message || message.threadId !== id || message.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
    }
    if (message.sentByUserId !== access.userId) {
      return NextResponse.json({ error: 'Solo puedes borrar tus propios mensajes.' }, { status: 403 })
    }
    if ((Date.now() - message.occurredAt.getTime()) > 30_000) {
      return NextResponse.json({ error: 'Solo puedes borrar mensajes durante los primeros 30 segundos.' }, { status: 409 })
    }

    const isParticipant = message.thread.participants.some((participant) => participant.userId === access.userId)
    if (!isParticipant) {
      return NextResponse.json({ error: 'No perteneces a este chat.' }, { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.internalChatMessage.delete({ where: { id: message.id } })

      const fallbackLastMessage = message.thread.messages.find((item) => item.id !== message.id)
      await tx.internalChatThread.update({
        where: { id: message.threadId },
        data: {
          lastMessageAt: fallbackLastMessage?.occurredAt ?? message.thread.createdAt,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error borrando mensaje de chat interno CRM:', error)
    return NextResponse.json({ error: 'Error borrando mensaje de chat interno CRM' }, { status: 500 })
  }
}