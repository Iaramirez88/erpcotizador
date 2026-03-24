import { NextResponse } from 'next/server'
import { ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

type ChatAttachment = {
  name: string
  url: string
  type: 'image' | 'document'
  mimeType?: string | null
  sizeBytes?: number | null
}

const threadInclude = Prisma.validator<Prisma.InternalChatThreadInclude>()({
  participants: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
  messages: {
    orderBy: [{ occurredAt: 'desc' as const }, { createdAt: 'desc' as const }],
    take: 1,
    include: {
      sentByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
})

type InternalChatThreadSummary = Prisma.InternalChatThreadGetPayload<{
  include: typeof threadInclude
}>

function normalizeUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  return Array.from(new Set(ids))
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

function mapMessage(message: InternalChatThreadSummary['messages'][number] | null | undefined) {
  if (!message) return null

  return {
    id: message.id,
    bodyText: message.bodyText,
    occurredAt: message.occurredAt,
    sentByUserId: message.sentByUserId,
    sentByUser: message.sentByUser,
    attachments: mapAttachments((message as { attachmentsJson?: unknown }).attachmentsJson),
  }
}

function mapThreadSummary(thread: InternalChatThreadSummary, currentUserId: string) {
  const viewerParticipant = thread.participants.find((participant) => participant.userId === currentUserId) ?? null
  const counterpart = thread.type === 'DIRECT'
    ? thread.participants.find((participant) => participant.userId !== currentUserId) ?? viewerParticipant
    : null
  const lastMessage = mapMessage(thread.messages[0])
  const unreadCount = lastMessage && lastMessage.sentByUserId !== currentUserId && (!viewerParticipant?.lastReadAt || viewerParticipant.lastReadAt < new Date(lastMessage.occurredAt))
    ? 1
    : 0

  return {
    id: thread.id,
    type: thread.type,
    title: thread.title,
    createdById: thread.createdById,
    lastMessageAt: thread.lastMessageAt,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    counterpart: counterpart
      ? {
          id: counterpart.user.id,
          name: counterpart.user.name,
          email: counterpart.user.email,
          role: counterpart.user.role,
        }
      : null,
    participantsCount: thread.participants.length,
    participants: thread.participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      lastReadAt: participant.lastReadAt,
      user: participant.user,
    })),
    lastMessage,
    unreadCount,
  }
}

function isInternalChatSchemaMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2021' || error.code === 'P2022')
}

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const rows = await prisma.internalChatThread.findMany({
      where: {
        empresaId: access.empresaId,
        participants: {
          some: { userId: access.userId },
        },
      },
      include: threadInclude,
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    })

    return NextResponse.json({
      success: true,
      data: rows.map((thread) => mapThreadSummary(thread, access.userId)),
    })
  } catch (error) {
    if (isInternalChatSchemaMissing(error)) {
      console.warn('Chat interno CRM sin esquema/migracion aplicada. Se devuelve lista vacia temporalmente.')
      return NextResponse.json({ success: true, data: [], warning: 'internal-chat-schema-missing' })
    }
    console.error('Error listando chats internos CRM:', error)
    return NextResponse.json({ error: 'Error listando chats internos CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const threadType = typeof body?.threadType === 'string' ? body.threadType.trim().toUpperCase() : 'DIRECT'

    if (threadType === 'GROUP') {
      const title = typeof body?.title === 'string' ? body.title.trim() : ''
      const participantUserIds = normalizeUserIds(body?.participantUserIds)
      const allParticipantIds = Array.from(new Set([access.userId, ...participantUserIds]))

      if (!title) {
        return NextResponse.json({ error: 'title es requerido para grupos' }, { status: 400 })
      }
      if (allParticipantIds.length < 2) {
        return NextResponse.json({ error: 'Agrega al menos un participante adicional al grupo' }, { status: 400 })
      }

      const users = await prisma.user.findMany({
        where: { id: { in: allParticipantIds }, empresaId: access.empresaId },
        select: { id: true },
      })
      if (users.length !== allParticipantIds.length) {
        return NextResponse.json({ error: 'Hay participantes inválidos para el grupo' }, { status: 400 })
      }

      const now = new Date()
      const created = await prisma.internalChatThread.create({
        data: {
          empresaId: access.empresaId,
          type: 'GROUP',
          title,
          createdById: access.userId,
          lastMessageAt: now,
          participants: {
            create: allParticipantIds.map((userId) => ({
              userId,
              lastReadAt: userId === access.userId ? now : null,
            })),
          },
        },
        include: threadInclude,
      })

      return NextResponse.json(
        {
          success: true,
          data: mapThreadSummary(created, access.userId),
        },
        { status: 201 },
      )
    }

    const participantUserId = typeof body?.participantUserId === 'string' ? body.participantUserId.trim() : ''

    if (!participantUserId) {
      return NextResponse.json({ error: 'participantUserId es requerido' }, { status: 400 })
    }
    if (participantUserId === access.userId) {
      return NextResponse.json({ error: 'No puedes abrir un chat contigo mismo' }, { status: 400 })
    }

    const participant = await prisma.user.findUnique({
      where: { id: participantUserId },
      select: { id: true, empresaId: true },
    })

    if (!participant || participant.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'participantUserId inválido' }, { status: 400 })
    }

    const existing = await prisma.internalChatThread.findFirst({
      where: {
        empresaId: access.empresaId,
        type: 'DIRECT',
        participants: {
          some: { userId: access.userId },
        },
        AND: [{ participants: { some: { userId: participantUserId } } }],
      },
      include: threadInclude,
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        data: mapThreadSummary(existing, access.userId),
      })
    }

    const now = new Date()
    const created = await prisma.internalChatThread.create({
      data: {
        empresaId: access.empresaId,
        type: 'DIRECT',
        createdById: access.userId,
        lastMessageAt: now,
        participants: {
          create: [
            { userId: access.userId, lastReadAt: now },
            { userId: participantUserId },
          ],
        },
      },
      include: threadInclude,
    })

    return NextResponse.json(
      {
        success: true,
        data: mapThreadSummary(created, access.userId),
      },
      { status: 201 },
    )
  } catch (error) {
    if (isInternalChatSchemaMissing(error)) {
      return NextResponse.json({ error: 'El chat interno requiere ejecutar las migraciones pendientes de base de datos.' }, { status: 503 })
    }
    console.error('Error creando chat interno CRM:', error)
    return NextResponse.json({ error: 'Error creando chat interno CRM' }, { status: 500 })
  }
}