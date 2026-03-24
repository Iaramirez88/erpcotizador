import { NextResponse } from 'next/server'
import { ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function mapAttachments(value: unknown) {
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
      }
    })
    .filter(Boolean)
}

function isInternalChatSchemaMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2021' || error.code === 'P2022')
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params
    const thread = await prisma.internalChatThread.findUnique({
      where: { id },
      include: {
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
          orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
          take: 150,
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
      },
    })

    if (!thread || thread.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 })
    }

    const viewerParticipant = thread.participants.find((participant) => participant.userId === access.userId)
    if (!viewerParticipant) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    await prisma.internalChatParticipant.update({
      where: { id: viewerParticipant.id },
      data: { lastReadAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: thread.id,
        type: thread.type,
        title: thread.title,
        createdById: thread.createdById,
        lastMessageAt: thread.lastMessageAt,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        participants: thread.participants,
        viewerParticipantId: viewerParticipant.id,
        messages: thread.messages.map((message) => ({
          id: message.id,
          bodyText: message.bodyText,
          occurredAt: message.occurredAt,
          sentByUserId: message.sentByUserId,
          sentByUser: message.sentByUser,
          attachments: mapAttachments((message as { attachmentsJson?: unknown }).attachmentsJson),
        })),
      },
    })
  } catch (error) {
    if (isInternalChatSchemaMissing(error)) {
      return NextResponse.json({ error: 'El chat interno requiere ejecutar las migraciones pendientes de base de datos.' }, { status: 503 })
    }
    console.error('Error obteniendo chat interno CRM:', error)
    return NextResponse.json({ error: 'Error obteniendo chat interno CRM' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const thread = await prisma.internalChatThread.findUnique({
      where: { id },
      include: { participants: true },
    })

    if (!thread || thread.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 })
    }

    const viewerParticipant = thread.participants.find((participant) => participant.userId === access.userId)
    if (!viewerParticipant) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
    if (thread.type !== 'GROUP') {
      return NextResponse.json({ error: 'Solo los grupos se pueden eliminar desde este panel' }, { status: 400 })
    }
    if (thread.createdById !== access.userId) {
      return NextResponse.json({ error: 'Solo el creador del grupo puede eliminarlo' }, { status: 403 })
    }

    await prisma.internalChatThread.delete({ where: { id: thread.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isInternalChatSchemaMissing(error)) {
      return NextResponse.json({ error: 'El chat interno requiere ejecutar las migraciones pendientes de base de datos.' }, { status: 503 })
    }
    console.error('Error eliminando grupo interno CRM:', error)
    return NextResponse.json({ error: 'Error eliminando grupo interno CRM' }, { status: 500 })
  }
}