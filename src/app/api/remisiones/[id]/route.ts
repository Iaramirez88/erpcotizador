/**
 * API Route: Remisión por ID
 * GET    /api/remisiones/:id
 * DELETE /api/remisiones/:id  -> anula (reversa inventario)
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { InventoryMovementType, InventoryMovementSourceType, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { id } = await ctx.params

    const remision = await prisma.remision.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        status: true,
        clienteNombre: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        sedeId: true,
        empresaId: true,
        warehouse: { select: { id: true, nombre: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            note: true,
            material: { select: { id: true, nombre: true, unidadMedida: true } },
          },
        },
      },
    })

    if (!remision || remision.empresaId !== empresaId || remision.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: remision })
  } catch (error) {
    console.error('Error al obtener remisión:', error)
    return NextResponse.json({ error: 'Error al obtener remisión' }, { status: 500 })
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { id } = await ctx.params

    const remision = await prisma.remision.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        status: true,
        empresaId: true,
        sedeId: true,
        warehouseId: true,
        items: { select: { materialId: true, quantity: true } },
      },
    })

    if (!remision || remision.empresaId !== empresaId || remision.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 })
    }

    if (remision.status === 'ANULADA') {
      return NextResponse.json({ success: true, data: { id: remision.id, status: remision.status } })
    }

    const warehouseId = remision.warehouseId

    const updated = await prisma.$transaction(async (tx) => {
      // Reversar inventario (IN) por cada item
      for (const it of remision.items) {
        const material = await tx.material.findUnique({
          where: { id: it.materialId },
          select: { id: true, empresaId: true, stockActual: true },
        })

        if (!material || material.empresaId !== empresaId) {
          throw new Error(`Material no encontrado: ${it.materialId}`)
        }

        const qty = it.quantity
        const stockBeforeGlobal = material.stockActual
        const stockBeforeWarehouse = warehouseId
          ? (
              await tx.inventoryStock.findUnique({
                where: { warehouseId_materialId: { warehouseId, materialId: it.materialId } },
                select: { quantity: true },
              })
            )?.quantity ?? 0
          : null

        const stockBefore = warehouseId ? stockBeforeWarehouse! : stockBeforeGlobal
        const delta = qty
        const stockAfter = stockBefore + delta

        const globalAfter = stockBeforeGlobal + delta

        if (warehouseId) {
          await tx.inventoryStock.upsert({
            where: { warehouseId_materialId: { warehouseId, materialId: it.materialId } },
            create: { warehouseId, materialId: it.materialId, quantity: stockAfter },
            update: { quantity: stockAfter },
            select: { id: true },
          })
        }

        await tx.material.update({
          where: { id: it.materialId },
          data: { stockActual: globalAfter },
          select: { id: true },
        })

        await tx.inventoryMovement.create({
          data: {
            empresaId,
            sedeId: access.sedeId,
            warehouseId,
            materialId: it.materialId,
            type: InventoryMovementType.IN,
            quantity: delta,
            stockBefore,
            stockAfter,
            note: `Anulación remisión ${remision.numero}`,
            sourceType: InventoryMovementSourceType.REMISION,
            sourceId: remision.id,
            createdById: access.userId,
          },
          select: { id: true },
        })
      }

      return tx.remision.update({
        where: { id: remision.id },
        data: { status: 'ANULADA' },
        select: { id: true, status: true },
      })
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al anular remisión'
    console.error('Error al anular remisión:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
