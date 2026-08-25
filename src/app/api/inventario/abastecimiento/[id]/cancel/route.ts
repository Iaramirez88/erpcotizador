import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { appendTaskHistory } from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.INVENTARIO, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as { reason?: unknown } | null
    const reason = normalizeString(body?.reason) || null

    const current = await prisma.inventorySupplyRequest.findFirst({
      where: { id, empresaId: access.empresaId },
      select: {
        id: true,
        numero: true,
        status: true,
        note: true,
        taskId: true,
        requestingWarehouse: { select: { id: true, nombre: true, sedeId: true } },
        supplyWarehouse: { select: { id: true, nombre: true, sedeId: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        fulfilledBy: { select: { id: true, name: true, email: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            quantity: true,
            note: true,
            material: { select: { id: true, externalId: true, nombre: true, unidadMedida: true } },
          },
        },
        createdAt: true,
        fulfilledAt: true,
        priority: true,
      },
    })

    if (!current) {
      return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 })
    }

    if (current.status !== 'PENDIENTE') {
      return NextResponse.json({ error: 'La solicitud ya no está pendiente.' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextNote = reason
        ? [current.note?.trim(), `No fue posible surtir: ${reason}`].filter(Boolean).join('\n\n')
        : current.note

      const row = await tx.inventorySupplyRequest.update({
        where: { id: current.id },
        data: {
          status: 'CANCELADO',
          note: nextNote || null,
        },
        select: {
          id: true,
          numero: true,
          status: true,
          priority: true,
          note: true,
          taskId: true,
          createdAt: true,
          fulfilledAt: true,
          requestingWarehouse: { select: { id: true, nombre: true, sedeId: true } },
          supplyWarehouse: { select: { id: true, nombre: true, sedeId: true, isSupplyHub: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          fulfilledBy: { select: { id: true, name: true, email: true } },
          items: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              quantity: true,
              note: true,
              material: { select: { id: true, externalId: true, nombre: true, unidadMedida: true } },
            },
          },
        },
      })

      await tx.notification.updateMany({
        where: {
          empresaId: access.empresaId,
          actionUrl: '/dashboard/inventario/abastecimiento',
          title: `Solicitud de abastecimiento ${current.numero}`,
          archivedAt: null,
        },
        data: {
          archivedAt: new Date(),
          readAt: new Date(),
        },
      })

      const completionRecipients = await tx.sedeMembership.findMany({
        where: {
          sedeId: {
            in: [row.requestingWarehouse.sedeId, row.supplyWarehouse.sedeId].filter(Boolean) as string[],
          },
          role: { in: ['ADMIN', 'MANAGER'] },
        },
        select: { userId: true },
      })

      const recipientIds = Array.from(new Set(completionRecipients.map((membership) => membership.userId).filter((userId) => userId && userId !== access.userId)))
      if (recipientIds.length) {
        await tx.notification.createMany({
          data: recipientIds.map((userId) => ({
            userId,
            empresaId: access.empresaId,
            sedeId: row.requestingWarehouse.sedeId ?? row.supplyWarehouse.sedeId ?? null,
            type: 'WARNING',
            title: `Solicitud no posible ${row.numero}`,
            body: reason
              ? `${row.supplyWarehouse.nombre} marcó como no posible la solicitud para ${row.requestingWarehouse.nombre}. Motivo: ${reason}`
              : `${row.supplyWarehouse.nombre} marcó como no posible la solicitud para ${row.requestingWarehouse.nombre}.`,
            actionUrl: '/dashboard/inventario/abastecimiento',
            actionLabel: 'Ver historial',
          })),
        })
      }

      if (current.taskId) {
        await tx.crmTask.update({
          where: { id: current.taskId },
          data: {
            status: 'CANCELED',
            archivedAt: new Date(),
            completedAt: null,
          },
        })

        await appendTaskHistory(tx, {
          empresaId: access.empresaId,
          taskId: current.taskId,
          actorUserId: access.userId,
          type: 'STATUS_CHANGED',
          message: `La solicitud de abastecimiento ${current.numero} fue marcada como no posible.`,
          metadata: {
            inventorySupplyRequestId: current.id,
            nextStatus: 'CANCELED',
          },
        })

        if (reason) {
          await appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.taskId,
            actorUserId: access.userId,
            type: 'NOTE_ADDED',
            message: `Motivo: ${reason}`,
          })
        }
      }

      return row
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error al marcar la solicitud como no posible:', error)
    const message = error instanceof Error ? error.message : 'Error al marcar la solicitud como no posible'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}