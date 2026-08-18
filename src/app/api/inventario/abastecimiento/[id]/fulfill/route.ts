import { NextResponse } from 'next/server'
import { InventoryMovementSourceType, InventoryMovementType, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { appendTaskHistory } from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.INVENTARIO, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params

    const current = await prisma.inventorySupplyRequest.findFirst({
      where: { id, empresaId: access.empresaId },
      select: {
        id: true,
        numero: true,
        status: true,
        taskId: true,
        supplyWarehouseId: true,
        requestingWarehouseId: true,
        supplyWarehouse: { select: { id: true, nombre: true } },
        requestingWarehouse: { select: { id: true, nombre: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            materialId: true,
            material: { select: { id: true, nombre: true, unidadMedida: true } },
          },
        },
      },
    })

    if (!current) {
      return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 })
    }

    if (current.status !== 'PENDIENTE') {
      return NextResponse.json({ error: 'La solicitud ya no está pendiente.' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const item of current.items) {
        const sourceStock = await tx.inventoryStock.findUnique({
          where: { warehouseId_materialId: { warehouseId: current.supplyWarehouseId, materialId: item.materialId } },
          select: { quantity: true },
        })

        const sourceBefore = sourceStock?.quantity ?? 0
        if (sourceBefore < item.quantity) {
          throw new Error(`Stock insuficiente para ${item.material.nombre}. Disponible en bodega abastecedora: ${sourceBefore}`)
        }

        const targetStock = await tx.inventoryStock.findUnique({
          where: { warehouseId_materialId: { warehouseId: current.requestingWarehouseId, materialId: item.materialId } },
          select: { quantity: true },
        })

        const sourceAfter = sourceBefore - item.quantity
        const targetBefore = targetStock?.quantity ?? 0
        const targetAfter = targetBefore + item.quantity

        await tx.inventoryStock.upsert({
          where: { warehouseId_materialId: { warehouseId: current.supplyWarehouseId, materialId: item.materialId } },
          create: { warehouseId: current.supplyWarehouseId, materialId: item.materialId, quantity: sourceAfter },
          update: { quantity: sourceAfter },
        })

        await tx.inventoryStock.upsert({
          where: { warehouseId_materialId: { warehouseId: current.requestingWarehouseId, materialId: item.materialId } },
          create: { warehouseId: current.requestingWarehouseId, materialId: item.materialId, quantity: targetAfter },
          update: { quantity: targetAfter },
        })

        const transferCount = await tx.inventoryTransfer.count({ where: { empresaId: access.empresaId } })
        const transferNumber = `TRAS-${String(transferCount + 1).padStart(6, '0')}`

        const transfer = await tx.inventoryTransfer.create({
          data: {
            numero: transferNumber,
            empresaId: access.empresaId,
            fromWarehouseId: current.supplyWarehouseId,
            toWarehouseId: current.requestingWarehouseId,
            materialId: item.materialId,
            quantity: item.quantity,
            note: `Cumplimiento solicitud ${current.numero}`,
            status: 'COMPLETADO',
            createdById: access.userId,
            completedById: access.userId,
            completedAt: new Date(),
          },
          select: { id: true },
        })

        await tx.inventoryMovement.create({
          data: {
            empresaId: access.empresaId,
            warehouseId: current.supplyWarehouseId,
            materialId: item.materialId,
            type: InventoryMovementType.OUT,
            quantity: -item.quantity,
            stockBefore: sourceBefore,
            stockAfter: sourceAfter,
            note: `Solicitud ${current.numero} hacia ${current.requestingWarehouse.nombre}`,
            sourceType: InventoryMovementSourceType.TRANSFER,
            sourceId: transfer.id,
            createdById: access.userId,
          },
        })

        await tx.inventoryMovement.create({
          data: {
            empresaId: access.empresaId,
            warehouseId: current.requestingWarehouseId,
            materialId: item.materialId,
            type: InventoryMovementType.IN,
            quantity: item.quantity,
            stockBefore: targetBefore,
            stockAfter: targetAfter,
            note: `Abastecimiento recibido ${current.numero} desde ${current.supplyWarehouse.nombre}`,
            sourceType: InventoryMovementSourceType.TRANSFER,
            sourceId: transfer.id,
            createdById: access.userId,
          },
        })
      }

      const updated = await tx.inventorySupplyRequest.update({
        where: { id: current.id },
        data: {
          status: 'COMPLETADO',
          fulfilledById: access.userId,
          fulfilledAt: new Date(),
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
            in: [updated.requestingWarehouse.sedeId, updated.supplyWarehouse.sedeId].filter(Boolean) as string[],
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
            sedeId: updated.requestingWarehouse.sedeId ?? updated.supplyWarehouse.sedeId ?? null,
            type: 'SUCCESS',
            title: `Solicitud completada ${updated.numero}`,
            body: `${updated.supplyWarehouse.nombre} surtió la solicitud para ${updated.requestingWarehouse.nombre}.`,
            actionUrl: '/dashboard/inventario/abastecimiento',
            actionLabel: 'Ver historial',
          })),
        })
      }

      if (current.taskId) {
        await tx.crmTask.update({
          where: { id: current.taskId },
          data: {
            status: 'DONE',
            completedAt: new Date(),
          },
        })

        await appendTaskHistory(tx, {
          empresaId: access.empresaId,
          taskId: current.taskId,
          actorUserId: access.userId,
          type: 'STATUS_CHANGED',
          message: `La solicitud de abastecimiento ${current.numero} fue completada desde inventario.`,
          metadata: {
            inventorySupplyRequestId: current.id,
            nextStatus: 'DONE',
          },
        })
      }

      return updated
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error al cumplir la solicitud de abastecimiento:', error)
    const message = error instanceof Error ? error.message : 'Error al cumplir la solicitud de abastecimiento'
    const status = message.includes('Stock insuficiente') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}