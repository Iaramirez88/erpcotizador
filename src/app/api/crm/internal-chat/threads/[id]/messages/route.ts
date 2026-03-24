import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

type ChatAttachment = {
  name: string
  url: string
  type: 'image' | 'document'
  mimeType?: string | null
  sizeBytes?: number | null
}

function mapAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const row = item as Record<string, unknown>
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      const url = typeof row.url === 'string' ? row.url.trim() : ''
      const type = row.type === 'image' ? 'image' : row.type === 'document' ? 'document' : null
      if (!name || !url || !type) return null
      return {
        name,
        url,
        type,
        mimeType: typeof row.mimeType === 'string' ? row.mimeType : null,
        sizeBytes: typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) ? row.sizeBytes : null,
      } satisfies ChatAttachment
    })
    .filter((item): item is ChatAttachment => Boolean(item))
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const bodyText = typeof body?.bodyText === 'string' ? body.bodyText.trim() : ''
    const attachments = mapAttachments(body?.attachments)

    if (!bodyText && attachments.length === 0) {
      return NextResponse.json({ error: 'Escribe un mensaje o agrega un adjunto' }, { status: 400 })
    }

    const thread = await prisma.internalChatThread.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    })

    if (!thread || thread.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 })
    }

    const viewerParticipant = thread.participants.find((participant) => participant.userId === access.userId)
    if (!viewerParticipant) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const now = new Date()
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.internalChatMessage.create({
        data: {
          empresaId: access.empresaId,
          threadId: thread.id,
          sentByUserId: access.userId,
          bodyText: bodyText || null,
          attachmentsJson: attachments,
          occurredAt: now,
        },
        include: {
          sentByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      await tx.internalChatThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: now },
      })

      await tx.internalChatParticipant.update({
        where: { id: viewerParticipant.id },
        data: { lastReadAt: now },
      })

      return created
    })

    return NextResponse.json({
      success: true,
      data: {
        id: message.id,
        bodyText: message.bodyText,
        occurredAt: message.occurredAt,
        sentByUserId: message.sentByUserId,
        sentByUser: message.sentByUser,
        attachments,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error enviando mensaje en chat interno CRM:', error)
    return NextResponse.json({ error: 'Error enviando mensaje en chat interno CRM' }, { status: 500 })
  }
}