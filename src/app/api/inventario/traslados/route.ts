/**
 * API Route: Traslados de Inventario entre Sedes
 * GET  /api/inventario/traslados?status=&limit=
 * POST /api/inventario/traslados
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { InventoryMovementType, InventoryMovementSourceType, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function n(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

type PostBody = {
  fromWarehouseId: string
  toWarehouseId: string
  materialId: string
  quantity: number
  note?: string
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))

    const where: {
      empresaId: string
      status?: 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO'
    } = { empresaId }

    if (status && (status === 'PENDIENTE' || status === 'COMPLETADO' || status === 'CANCELADO')) {
      where.status = status
    }

    const traslados = await prisma.inventoryTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        numero: true,
        status: true,
        quantity: true,
        note: true,
        createdAt: true,
        completedAt: true,
        fromWarehouse: { select: { id: true, nombre: true, codigo: true } },
        toWarehouse: { select: { id: true, nombre: true, codigo: true } },
        material: { select: { id: true, nombre: true, unidadMedida: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, data: traslados })
  } catch (error) {
    console.error('Error al obtener traslados:', error)
    return NextResponse.json({ error: 'Error al obtener traslados' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null
    const fromWarehouseId = typeof body?.fromWarehouseId === 'string' ? body.fromWarehouseId : ''
    const toWarehouseId = typeof body?.toWarehouseId === 'string' ? body.toWarehouseId : ''
    const materialId = typeof body?.materialId === 'string' ? body.materialId : ''
    const quantity = n(body?.quantity)
    const note = typeof body?.note === 'string' ? body.note.trim() : null

    if (!fromWarehouseId || !toWarehouseId || !materialId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Datos inválidos. Se requiere: fromWarehouseId, toWarehouseId, materialId, quantity > 0' },
        { status: 400 }
      )
    }

    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ error: 'No puedes trasladar a la misma sede' }, { status: 400 })
    }

    // Validar bodegas
    const [fromWh, toWh] = await Promise.all([
      prisma.inventoryWarehouse.findUnique({
        where: { id: fromWarehouseId },
        select: { id: true, empresaId: true, nombre: true, codigo: true },
      }),
      prisma.inventoryWarehouse.findUnique({
        where: { id: toWarehouseId },
        select: { id: true, empresaId: true, nombre: true, codigo: true },
      }),
    ])

    if (!fromWh || fromWh.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Sede origen no encontrada' }, { status: 404 })
    }
    if (!toWh || toWh.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Sede destino no encontrada' }, { status: 404 })
    }

    // Validar material
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, empresaId: true, nombre: true, stockActual: true },
    })

    if (!material || material.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
    }

    // Crear traslado en transacción
    const created = await prisma.$transaction(async (tx) => {
      // Verificar stock en bodega origen
      const stockOrigen = await tx.inventoryStock.findUnique({
        where: { warehouseId_materialId: { warehouseId: fromWarehouseId, materialId } },
        select: { quantity: true },
      })

      const currentStock = stockOrigen?.quantity || 0
      if (currentStock < quantity) {
        throw new Error(`Stock insuficiente en ${fromWh.nombre}. Disponible: ${currentStock}, Solicitado: ${quantity}`)
      }

      // Generar número de traslado
      const count = await tx.inventoryTransfer.count({ where: { empresaId } })
      const numero = `TRAS-${String(count + 1).padStart(6, '0')}`

      // Crear registro de traslado
      const traslado = await tx.inventoryTransfer.create({
        data: {
          numero,
          empresaId,
          fromWarehouseId,
          toWarehouseId,
          materialId,
          quantity,
          note: note || null,
          status: 'PENDIENTE',
          createdById: access.userId,
        },
        select: { id: true, numero: true },
      })

      // Aplicar movimientos de inventario inmediatamente (salida de origen)
      const stockBeforeFrom = currentStock
      const stockAfterFrom = stockBeforeFrom - quantity

      await tx.inventoryStock.update({
        where: { warehouseId_materialId: { warehouseId: fromWarehouseId, materialId } },
        data: { quantity: stockAfterFrom },
      })

      // Registrar movimiento OUT en origen
      await tx.inventoryMovement.create({
        data: {
          empresaId,
          warehouseId: fromWarehouseId,
          materialId,
          type: InventoryMovementType.OUT,
          quantity: -quantity,
          stockBefore: stockBeforeFrom,
          stockAfter: stockAfterFrom,
          note: `Traslado ${numero} a ${toWh.nombre}`,
          sourceType: InventoryMovementSourceType.TRANSFER,
          sourceId: traslado.id,
          createdById: access.userId,
        },
      })

      // Aplicar entrada en destino
      const stockDestino = await tx.inventoryStock.findUnique({
        where: { warehouseId_materialId: { warehouseId: toWarehouseId, materialId } },
        select: { quantity: true },
      })

      const stockBeforeTo = stockDestino?.quantity || 0
      const stockAfterTo = stockBeforeTo + quantity

      await tx.inventoryStock.upsert({
        where: { warehouseId_materialId: { warehouseId: toWarehouseId, materialId } },
        create: { warehouseId: toWarehouseId, materialId, quantity: stockAfterTo },
        update: { quantity: stockAfterTo },
      })

      // Registrar movimiento IN en destino
      await tx.inventoryMovement.create({
        data: {
          empresaId,
          warehouseId: toWarehouseId,
          materialId,
          type: InventoryMovementType.IN,
          quantity: quantity,
          stockBefore: stockBeforeTo,
          stockAfter: stockAfterTo,
          note: `Traslado ${numero} desde ${fromWh.nombre}`,
          sourceType: InventoryMovementSourceType.TRANSFER,
          sourceId: traslado.id,
          createdById: access.userId,
        },
      })

      // Marcar como completado inmediatamente
      await tx.inventoryTransfer.update({
        where: { id: traslado.id },
        data: {
          status: 'COMPLETADO',
          completedById: access.userId,
          completedAt: new Date(),
        },
      })

      return tx.inventoryTransfer.findUnique({
        where: { id: traslado.id },
        select: {
          id: true,
          numero: true,
          status: true,
          quantity: true,
          note: true,
          createdAt: true,
          completedAt: true,
          fromWarehouse: { select: { id: true, nombre: true, codigo: true } },
          toWarehouse: { select: { id: true, nombre: true, codigo: true } },
          material: { select: { id: true, nombre: true, unidadMedida: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
        },
      })
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear traslado'
    console.error('Error al crear traslado:', error)
    const status = message.includes('Stock insuficiente') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
