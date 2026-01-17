/**
 * API Route: Inventario (movimientos)
 * GET  /api/inventario?materialId=&type=&limit=
 * POST /api/inventario
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { InventoryMovementType, ModuleKey } from '@prisma/client'
import { getOrCreateDefaultEmpresa } from '@/lib/rbac'

export const runtime = 'nodejs'

function n(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function isMovementType(value: unknown): value is InventoryMovementType {
  return value === 'IN' || value === 'OUT' || value === 'ADJUST'
}

async function getOrCreateEmpresaIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  const empresa = await getOrCreateDefaultEmpresa()
  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)

    const { searchParams } = new URL(request.url)
    const materialId = searchParams.get('materialId') || undefined
    const type = searchParams.get('type') || undefined
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))

    const where: {
      empresaId: string
      materialId?: string
      type?: InventoryMovementType
    } = { empresaId }

    if (materialId) where.materialId = materialId
    if (type && isMovementType(type)) where.type = type

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
        material: { select: { id: true, nombre: true, unidadMedida: true } },
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
      note?: string
    }
  | {
      materialId: string
      type: 'ADJUST'
      newStock: number
      note?: string
    }

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null
    const materialId = typeof body?.materialId === 'string' ? body.materialId : ''
    const type = body?.type

    if (!materialId || !isMovementType(type)) {
      return NextResponse.json({ error: 'Body inválido. Esperado: { materialId, type, ... }' }, { status: 400 })
    }

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, empresaId: true, stockActual: true, nombre: true, unidadMedida: true },
    })

    if (!material || material.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
    }

    const stockBefore = material.stockActual
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

    const note = typeof body?.note === 'string' ? body.note.trim() : null

    const result = await prisma.$transaction(async (tx) => {
      const updatedMaterial = await tx.material.update({
        where: { id: materialId },
        data: { stockActual: stockAfter },
        select: { id: true, stockActual: true, nombre: true, unidadMedida: true },
      })

      const movement = await tx.inventoryMovement.create({
        data: {
          empresaId,
          materialId,
          type,
          quantity: delta,
          stockBefore,
          stockAfter,
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

      return { movement, updatedMaterial }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error al registrar movimiento:', error)
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 })
  }
}
