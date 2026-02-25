/**
 * API Route: Remisiones
 * GET  /api/remisiones?from=&to=&limit=
 * POST /api/remisiones
 *
 * Crea una remisión (salida) y genera movimientos de inventario con trazabilidad
 * (InventoryMovement.sourceType = REMISION, sourceId = remisionId)
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { checkPlanLimit } from '@/lib/plan-limits'
import { InventoryMovementType, InventoryMovementSourceType, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function parseDateStart(value: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseDateEndExclusive(value: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + 1)
  return d
}

function n(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

type PostBody = {
  warehouseId?: string | null
  clienteNombre?: string | null
  note?: string | null
  items: Array<{ materialId: string; quantity: number; note?: string | null }>
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const from = parseDateStart(searchParams.get('from'))
    const to = parseDateEndExclusive(searchParams.get('to'))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))

    const where: {
      empresaId: string
      sedeId: string
      createdAt?: { gte?: Date; lt?: Date }
    } = { empresaId, sedeId: access.sedeId }

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lt = to
    }

    const remisiones = await prisma.remision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        numero: true,
        status: true,
        clienteNombre: true,
        note: true,
        createdAt: true,
        warehouse: { select: { id: true, nombre: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            material: { select: { id: true, nombre: true, unidadMedida: true } },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: remisiones })
  } catch (error) {
    console.error('Error al listar remisiones:', error)
    return NextResponse.json({ error: 'Error al listar remisiones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const limit = await checkPlanLimit(empresaId, 'REMISIONES_PER_MONTH')
    if (!limit.ok) {
      return NextResponse.json(limit, { status: 402 })
    }

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null
    const warehouseId = typeof body?.warehouseId === 'string' && body.warehouseId.trim() ? body.warehouseId.trim() : null
    const clienteNombre = typeof body?.clienteNombre === 'string' ? body.clienteNombre.trim() : null
    const note = typeof body?.note === 'string' ? body.note.trim() : null

    const rawItems = Array.isArray(body?.items) ? body!.items : []
    const items = rawItems
      .map((it) => ({
        materialId: String(it?.materialId || '').trim(),
        quantity: n(it?.quantity),
        note: typeof it?.note === 'string' ? it.note.trim() : null,
      }))
      .filter((it) => it.materialId && it.quantity !== null && it.quantity > 0)

    if (items.length === 0) {
      return NextResponse.json({ error: 'items es requerido (quantity > 0)' }, { status: 400 })
    }

    if (warehouseId) {
      const wh = await prisma.inventoryWarehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, empresaId: true, sedeId: true },
      })

      if (!wh || wh.empresaId !== empresaId) {
        return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
      }

      if (wh.sedeId && wh.sedeId !== access.sedeId) {
        return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const sede = await tx.sede.findUnique({
        where: { id: access.sedeId },
        select: { codigo: true },
      })

      const sedeCodigo = (sede?.codigo || '').trim() || '00'

      const seq = await tx.remisionSequence.upsert({
        where: { sedeId: access.sedeId },
        update: { currentNumber: { increment: 1 } },
        create: { sedeId: access.sedeId, currentNumber: 1 },
        select: { currentNumber: true },
      })

      const numero = `REM-${sedeCodigo}-${String(seq.currentNumber).padStart(4, '0')}`

      const remision = await tx.remision.create({
        data: {
          numero,
          status: 'EMITIDA',
          empresaId,
          sedeId: access.sedeId,
          warehouseId,
          clienteNombre: clienteNombre || null,
          note: note || null,
          createdById: access.userId,
          items: {
            create: items.map((it) => ({
              materialId: it.materialId,
              quantity: it.quantity!,
              note: it.note || null,
            })),
          },
        },
        select: { id: true, numero: true },
      })

      // Aplicar salidas al inventario + registrar movimientos por cada item
      for (const it of items) {
        const material = await tx.material.findUnique({
          where: { id: it.materialId },
          select: { id: true, empresaId: true, stockActual: true },
        })

        if (!material || material.empresaId !== empresaId) {
          throw new Error(`Material no encontrado: ${it.materialId}`)
        }

        const qty = it.quantity!
        const stockBeforeGlobal = material.stockActual
        const stockBeforeWarehouse = warehouseId
          ? await (async () => {
              const existing = await tx.inventoryStock.findUnique({
                where: { warehouseId_materialId: { warehouseId, materialId: it.materialId } },
                select: { quantity: true },
              })

              if (existing) return existing.quantity

              // Si el material nunca ha sido distribuido por bodegas, inicializamos la bodega
              // con el stock global para evitar falsos negativos al empezar a usar bodegas.
              const anyStock = await tx.inventoryStock.findFirst({
                where: { materialId: it.materialId },
                select: { id: true },
              })

              return anyStock ? 0 : stockBeforeGlobal
            })()
          : null

        const stockBefore = warehouseId ? stockBeforeWarehouse! : stockBeforeGlobal
        const delta = -qty
        const stockAfter = stockBefore + delta

        if (stockAfter < 0) {
          throw new Error('Stock insuficiente para salida')
        }

        const globalAfter = stockBeforeGlobal + delta
        if (globalAfter < 0) {
          throw new Error('Stock global resultante inválido')
        }

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
            type: InventoryMovementType.OUT,
            quantity: delta,
            stockBefore,
            stockAfter,
            note: it.note || note || `Remisión ${remision.numero}`,
            sourceType: InventoryMovementSourceType.REMISION,
            sourceId: remision.id,
            createdById: access.userId,
          },
          select: { id: true },
        })
      }

      return tx.remision.findUnique({
        where: { id: remision.id },
        select: {
          id: true,
          numero: true,
          status: true,
          clienteNombre: true,
          note: true,
          createdAt: true,
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
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear remisión'
    console.error('Error al crear remisión:', error)
    const status = message === 'Stock insuficiente para salida' ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
