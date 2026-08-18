/**
 * API Route: Inventario (movimientos)
 * GET  /api/inventario?materialId=&type=&limit=
 * POST /api/inventario
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { AccessLevel, InventoryMovementType, ModuleKey } from '@prisma/client'
import { requireSedeAccess } from '@/lib/rbac'

export const runtime = 'nodejs'

function n(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function isMovementType(value: unknown): value is InventoryMovementType {
  return value === 'IN' || value === 'OUT' || value === 'ADJUST'
}

async function ensureDefaultWarehouse(args: { empresaId: string; sedeId: string }) {
  const existingDefault = await prisma.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId, isDefault: true },
    select: { id: true },
  })
  if (existingDefault) return existingDefault.id

  const existingAny = await prisma.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existingAny?.id) return existingAny.id

  const created = await prisma.inventoryWarehouse.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      nombre: 'Principal',
      codigo: 'PRIN',
      isDefault: true,
    },
    select: { id: true },
  })

  return created.id
}

async function getAccessibleSedeIds(args: { empresaId: string; userId: string; fallbackSedeId: string; isSystemAdmin: boolean }) {
  if (args.isSystemAdmin) {
    const sedes = await prisma.sede.findMany({
      where: { empresaId: args.empresaId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    const sedeIds = sedes.map((sede) => sede.id)
    return sedeIds.length ? sedeIds : [args.fallbackSedeId]
  }

  const memberships = await prisma.sedeMembership.findMany({
    where: {
      userId: args.userId,
      sede: { empresaId: args.empresaId },
    },
    select: { sedeId: true },
    orderBy: { createdAt: 'asc' },
  })

  const sedeIds = Array.from(new Set(memberships.map((membership) => membership.sedeId).filter(Boolean)))
  return sedeIds.length ? sedeIds : [args.fallbackSedeId]
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const materialId = searchParams.get('materialId') || undefined
    const type = searchParams.get('type') || undefined
    const warehouseId = searchParams.get('warehouseId') || undefined
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))

    if (warehouseId) {
      const warehouse = await prisma.inventoryWarehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, empresaId: true, sedeId: true },
      })

      if (!warehouse || warehouse.empresaId !== empresaId) {
        return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
      }

      if (warehouse.sedeId && access.session.user.role !== 'ADMIN') {
        try {
          await requireSedeAccess({
            userId: access.userId,
            sedeId: warehouse.sedeId,
            module: 'INVENTARIO' as ModuleKey,
            minLevel: AccessLevel.READ,
          })
        } catch (error) {
          if (error instanceof Error && error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
          }
          throw error
        }
      }
    }

    const where: {
      empresaId: string
      materialId?: string
      type?: InventoryMovementType
      warehouseId?: string
    } = { empresaId }

    if (materialId) where.materialId = materialId
    if (type && isMovementType(type)) where.type = type
    if (warehouseId) where.warehouseId = warehouseId

    const movements = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        quantity: true,
        stockBefore: true,
        stockAfter: true,
        note: true,
        createdAt: true,
        material: { select: { id: true, externalId: true, nombre: true, unidadMedida: true } },
        warehouse: { select: { id: true, nombre: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, data: movements })
  } catch (error) {
    console.error('Error al obtener inventario:', error)
    return NextResponse.json({ error: 'Error al obtener inventario' }, { status: 500 })
  }
}

type PostBody =
  | {
      materialId: string
      type: 'IN' | 'OUT'
      quantity: number
      warehouseId?: string
      warehouseIds?: string[]
      applyToAllSedes?: boolean
      note?: string
      updateProveedor?: boolean
      proveedor?: string
    }
  | {
      materialId: string
      type: 'ADJUST'
      newStock: number
      warehouseId?: string
      warehouseIds?: string[]
      applyToAllSedes?: boolean
      note?: string
      updateProveedor?: boolean
      proveedor?: string
    }

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null
    const materialId = typeof body?.materialId === 'string' ? body.materialId : ''
    const type = body?.type
    const warehouseId = typeof (body as { warehouseId?: unknown })?.warehouseId === 'string' ? (body as { warehouseId?: string }).warehouseId : null
    const warehouseIds = Array.isArray((body as { warehouseIds?: unknown })?.warehouseIds)
      ? Array.from(
          new Set(
            ((body as { warehouseIds?: unknown[] }).warehouseIds ?? [])
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter(Boolean)
          )
        )
      : []
    const applyToAllSedes = Boolean((body as { applyToAllSedes?: unknown })?.applyToAllSedes)

    if (!materialId || !isMovementType(type)) {
      return NextResponse.json({ error: 'Body inválido. Esperado: { materialId, type, ... }' }, { status: 400 })
    }

    const targetWarehouses: Array<{ id: string; sedeId: string | null }> = []

    if (applyToAllSedes) {
      const accessibleSedeIds = await getAccessibleSedeIds({
        empresaId,
        userId: access.userId,
        fallbackSedeId: access.sedeId,
        isSystemAdmin: access.session.user.role === 'ADMIN',
      })

      for (const sedeId of accessibleSedeIds) {
        const defaultWarehouseId = await ensureDefaultWarehouse({ empresaId, sedeId })
        targetWarehouses.push({ id: defaultWarehouseId, sedeId })
      }
    } else {
      const requestedWarehouseIds = warehouseIds.length ? warehouseIds : warehouseId ? [warehouseId] : []

      for (const requestedId of requestedWarehouseIds) {
        const wh = await prisma.inventoryWarehouse.findUnique({
          where: { id: requestedId },
          select: { id: true, empresaId: true, sedeId: true },
        })

        if (!wh || wh.empresaId !== empresaId) {
          return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
        }

        if (wh.sedeId && access.session.user.role !== 'ADMIN') {
          try {
            await requireSedeAccess({
              userId: access.userId,
              sedeId: wh.sedeId,
              module: 'INVENTARIO' as ModuleKey,
              minLevel: AccessLevel.WRITE,
            })
          } catch (error) {
            if (error instanceof Error && error.message === 'FORBIDDEN') {
              return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
            }
            throw error
          }
        }

        targetWarehouses.push({ id: wh.id, sedeId: wh.sedeId ?? null })
      }
    }

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, empresaId: true, stockActual: true, nombre: true, unidadMedida: true, proveedor: true },
    })

    if (!material || material.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
    }

    const stockBeforeGlobal = material.stockActual

    const note = typeof body?.note === 'string' ? body.note.trim() : null

    const updateProveedor = Boolean((body as { updateProveedor?: unknown })?.updateProveedor)
    const proveedorRaw = (body as { proveedor?: unknown })?.proveedor
    const proveedor = typeof proveedorRaw === 'string' ? proveedorRaw.trim() : ''

    if (updateProveedor && type !== 'IN') {
      return NextResponse.json({ error: 'Solo puedes actualizar el proveedor en movimientos de Entrada' }, { status: 400 })
    }

    if (updateProveedor && !proveedor) {
      return NextResponse.json({ error: 'Proveedor requerido para actualizar' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const hasAnyDistributedStock = await tx.inventoryStock.findFirst({
        where: { materialId },
        select: { id: true },
      })

      const targetMovementRows: Array<{ warehouseId: string | null; sedeId: string | null; stockBefore: number; stockAfter: number; delta: number }> = []

      if (targetWarehouses.length) {
        for (const [index, target] of targetWarehouses.entries()) {
          const current = await tx.inventoryStock.findUnique({
            where: { warehouseId_materialId: { warehouseId: target.id, materialId } },
            select: { quantity: true },
          })

          const stockBefore = current?.quantity
            ?? (!hasAnyDistributedStock && targetWarehouses.length === 1 && index === 0 ? stockBeforeGlobal : 0)

          let delta = 0
          let stockAfter = stockBefore

          if (type === 'IN' || type === 'OUT') {
            const qty = n((body as { quantity?: unknown }).quantity)
            if (qty === null || qty <= 0) {
              return NextResponse.json({ error: 'quantity debe ser > 0' }, { status: 400 })
            }

            delta = type === 'IN' ? qty : -qty
            stockAfter = stockBefore + delta
            if (stockAfter < 0) {
              return NextResponse.json({ error: 'Stock insuficiente para salida' }, { status: 400 })
            }
          } else {
            const newStock = n((body as { newStock?: unknown }).newStock)
            if (newStock === null || newStock < 0) {
              return NextResponse.json({ error: 'newStock debe ser >= 0' }, { status: 400 })
            }

            stockAfter = newStock
            delta = stockAfter - stockBefore
          }

          targetMovementRows.push({ warehouseId: target.id, sedeId: target.sedeId, stockBefore, stockAfter, delta })
        }
      } else {
        let delta = 0
        let stockAfter = stockBeforeGlobal

        if (type === 'IN' || type === 'OUT') {
          const qty = n((body as { quantity?: unknown }).quantity)
          if (qty === null || qty <= 0) {
            return NextResponse.json({ error: 'quantity debe ser > 0' }, { status: 400 })
          }

          delta = type === 'IN' ? qty : -qty
          stockAfter = stockBeforeGlobal + delta
          if (stockAfter < 0) {
            return NextResponse.json({ error: 'Stock insuficiente para salida' }, { status: 400 })
          }
        } else {
          const newStock = n((body as { newStock?: unknown }).newStock)
          if (newStock === null || newStock < 0) {
            return NextResponse.json({ error: 'newStock debe ser >= 0' }, { status: 400 })
          }

          stockAfter = newStock
          delta = stockAfter - stockBeforeGlobal
        }

        targetMovementRows.push({ warehouseId: null, sedeId: access.sedeId, stockBefore: stockBeforeGlobal, stockAfter, delta })
      }

      const deltaTotal = targetMovementRows.reduce((sum, row) => sum + row.delta, 0)
      const globalAfter = stockBeforeGlobal + deltaTotal
      if (globalAfter < 0) {
        return NextResponse.json({ error: 'Stock global resultante inválido' }, { status: 400 })
      }

      for (const row of targetMovementRows) {
        if (row.warehouseId) {
          await tx.inventoryStock.upsert({
            where: { warehouseId_materialId: { warehouseId: row.warehouseId, materialId } },
            create: { warehouseId: row.warehouseId, materialId, quantity: row.stockAfter },
            update: { quantity: row.stockAfter },
            select: { id: true },
          })
        }
      }

      const updatedMaterial = await tx.material.update({
        where: { id: materialId },
        data: {
          stockActual: globalAfter,
          ...(updateProveedor ? { proveedor } : {}),
        },
        select: { id: true, stockActual: true, nombre: true, unidadMedida: true, proveedor: true },
      })

      const movements = []
      for (const row of targetMovementRows) {
        const movement = await tx.inventoryMovement.create({
          data: {
            empresaId,
            sedeId: row.sedeId ?? access.sedeId,
            warehouseId: row.warehouseId,
            materialId,
            type,
            quantity: row.delta,
            stockBefore: row.stockBefore,
            stockAfter: row.stockAfter,
            note,
            createdById: access.userId,
          },
          select: {
            id: true,
            type: true,
            quantity: true,
            stockBefore: true,
            stockAfter: true,
            note: true,
            createdAt: true,
          },
        })
        movements.push(movement)
      }

      return { movements, updatedMaterial }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error al registrar movimiento:', error)
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 })
  }
}
