import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  ModuleKey,
  type Prisma,
  InventoryMovementType,
  InventoryMovementSourceType,
  PosInvoiceStatus,
} from '@prisma/client'
import { reserveNextPosReturnNumber } from '@/lib/pos-numbering'

export const runtime = 'nodejs'

function n(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

async function ensureDefaultWarehouse(tx: Prisma.TransactionClient, args: { empresaId: string; sedeId: string }) {
  const existingDefault = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId, isDefault: true },
    select: { id: true },
  })
  if (existingDefault) return

  const existingAny = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId },
    select: { id: true },
  })
  if (existingAny) return

  await tx.inventoryWarehouse
    .create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.sedeId,
        nombre: 'Principal',
        codigo: 'PRIN',
        isDefault: true,
      },
      select: { id: true },
    })
    .catch(() => null)
}

async function resolveWarehouseId(
  tx: Prisma.TransactionClient,
  args: { empresaId: string; sedeId: string; warehouseId?: string | null }
) {
  if (args.warehouseId) {
    const wh = await tx.inventoryWarehouse.findUnique({
      where: { id: args.warehouseId },
      select: { id: true, empresaId: true, sedeId: true },
    })
    if (wh && wh.empresaId === args.empresaId && (!wh.sedeId || wh.sedeId === args.sedeId)) return wh.id
  }

  await ensureDefaultWarehouse(tx, { empresaId: args.empresaId, sedeId: args.sedeId })

  const defaultWh = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId, isDefault: true },
    select: { id: true },
  })

  if (defaultWh) return defaultWh.id

  const any = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return any?.id ?? null
}

type ReturnItemInput = {
  materialId?: string | null
  descripcion?: string
  quantity: number
  unitPrice: number
}

type PostBody = {
  invoiceId?: string | null
  warehouseId?: string | null
  motivo?: string | null
  ivaPct?: number | null
  items: ReturnItemInput[]
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))

    const returns = await prisma.posReturn.findMany({
      where: { empresaId, sedeId: access.sedeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        numero: true,
        total: true,
        createdAt: true,
        invoice: { select: { id: true, numero: true } },
        warehouse: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json({ success: true, data: returns })
  } catch (error) {
    console.error('Error al listar devoluciones POS:', error)
    return NextResponse.json({ error: 'Error al listar devoluciones POS' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null
    const items = Array.isArray(body?.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'items es requerido' }, { status: 400 })
    }

    const ivaPct = Math.max(0, n(body?.ivaPct ?? 0) ?? 0)
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : null
    const invoiceId = typeof body?.invoiceId === 'string' ? body.invoiceId : null

    const normalizedItems = items
      .map((it) => {
        const quantity = n(it.quantity) ?? 0
        const unitPrice = n(it.unitPrice) ?? 0
        const materialId = typeof it.materialId === 'string' ? it.materialId : null
        const descripcion = (typeof it.descripcion === 'string' ? it.descripcion : '').trim()
        return { materialId, descripcion, quantity, unitPrice }
      })
      .filter((it) => it.quantity > 0)

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: 'items debe tener quantity > 0' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const sede = await tx.sede.findUnique({ where: { id: access.sedeId }, select: { id: true, codigo: true, empresaId: true } })
      if (!sede || sede.empresaId !== empresaId) throw new Error('SEDE_NOT_FOUND')

      const invoice = invoiceId
        ? await tx.posInvoice.findUnique({
            where: { id: invoiceId },
            select: { id: true, empresaId: true, sedeId: true, total: true, warehouseId: true },
          })
        : null

      if (invoiceId && (!invoice || invoice.empresaId !== empresaId || invoice.sedeId !== access.sedeId)) {
        throw new Error('INVOICE_NOT_FOUND')
      }

      const warehouseId =
        (typeof body?.warehouseId === 'string' && body.warehouseId) || invoice?.warehouseId
          ? await resolveWarehouseId(tx, {
              empresaId,
              sedeId: access.sedeId,
              warehouseId: (typeof body?.warehouseId === 'string' ? body.warehouseId : null) ?? invoice?.warehouseId ?? null,
            })
          : await resolveWarehouseId(tx, { empresaId, sedeId: access.sedeId, warehouseId: null })

      const prefix = `DEV${sede.codigo ? `-${sede.codigo}` : ''}`
      const numero = await reserveNextPosReturnNumber(tx, { sedeId: access.sedeId, prefix })

      const resolvedItems = await Promise.all(
        normalizedItems.map(async (it) => {
          if (it.materialId) {
            const material = await tx.material.findUnique({
              where: { id: it.materialId },
              select: { id: true, empresaId: true, nombre: true },
            })
            if (!material || material.empresaId !== empresaId) {
              throw new Error('MATERIAL_NOT_FOUND')
            }
            return { ...it, descripcion: it.descripcion || material.nombre }
          }
          return { ...it, descripcion: it.descripcion || 'Ítem' }
        })
      )

      const computedLineTotals = resolvedItems.map((it) => ({ ...it, total: it.quantity * it.unitPrice }))
      const subtotal = computedLineTotals.reduce((sum, it) => sum + it.total, 0)
      const iva = subtotal * (ivaPct / 100)
      const total = subtotal + iva

      const createdReturn = await tx.posReturn.create({
        data: {
          numero,
          empresaId,
          sedeId: access.sedeId,
          warehouseId,
          invoiceId: invoice?.id ?? null,
          motivo,
          ivaPct,
          subtotal,
          iva,
          total,
          createdById: access.userId,
          items: {
            create: computedLineTotals.map((it) => ({
              materialId: it.materialId,
              descripcion: it.descripcion,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.total,
            })),
          },
        },
        select: { id: true, numero: true, total: true, invoiceId: true, warehouseId: true },
      })

      for (const it of computedLineTotals) {
        if (!it.materialId) continue

        if (warehouseId) {
          const stockRow = await tx.inventoryStock.findUnique({
            where: { warehouseId_materialId: { warehouseId, materialId: it.materialId } },
            select: { id: true, quantity: true },
          })
          const stockBefore = stockRow?.quantity ?? 0
          const stockAfter = stockBefore + it.quantity

          await tx.inventoryStock.upsert({
            where: { warehouseId_materialId: { warehouseId, materialId: it.materialId } },
            create: { warehouseId, materialId: it.materialId, quantity: stockAfter },
            update: { quantity: stockAfter },
            select: { id: true },
          })

          const mat = await tx.material.findUnique({ where: { id: it.materialId }, select: { stockActual: true } })
          const globalBefore = mat?.stockActual ?? 0
          const globalAfter = globalBefore + it.quantity

          await tx.material.update({ where: { id: it.materialId }, data: { stockActual: globalAfter }, select: { id: true } })

          await tx.inventoryMovement.create({
            data: {
              empresaId,
              sedeId: access.sedeId,
              warehouseId,
              materialId: it.materialId,
              type: InventoryMovementType.IN,
              quantity: it.quantity,
              stockBefore,
              stockAfter,
              note: `POS devolución ${createdReturn.numero}`,
              sourceType: InventoryMovementSourceType.POS_RETURN,
              sourceId: createdReturn.id,
              createdById: access.userId,
            },
            select: { id: true },
          })
        } else {
          const mat = await tx.material.findUnique({ where: { id: it.materialId }, select: { stockActual: true } })
          const stockBefore = mat?.stockActual ?? 0
          const stockAfter = stockBefore + it.quantity

          await tx.material.update({ where: { id: it.materialId }, data: { stockActual: stockAfter }, select: { id: true } })

          await tx.inventoryMovement.create({
            data: {
              empresaId,
              sedeId: access.sedeId,
              materialId: it.materialId,
              type: InventoryMovementType.IN,
              quantity: it.quantity,
              stockBefore,
              stockAfter,
              note: `POS devolución ${createdReturn.numero}`,
              sourceType: InventoryMovementSourceType.POS_RETURN,
              sourceId: createdReturn.id,
              createdById: access.userId,
            },
            select: { id: true },
          })
        }
      }

      if (invoice?.id) {
        const agg = await tx.posReturn.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { total: true },
        })

        const returnedTotal = agg._sum.total ?? 0

        const newStatus = returnedTotal + 1e-6 >= invoice.total ? PosInvoiceStatus.REFUNDED : PosInvoiceStatus.PARTIALLY_REFUNDED

        await tx.posInvoice.update({
          where: { id: invoice.id },
          data: { status: newStatus },
          select: { id: true },
        })
      }

      return createdReturn
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SEDE_NOT_FOUND') {
        return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
      }
      if (error.message === 'INVOICE_NOT_FOUND') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      if (error.message === 'MATERIAL_NOT_FOUND') {
        return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
      }
    }

    console.error('Error al crear devolución POS:', error)
    return NextResponse.json({ error: 'Error al crear devolución POS' }, { status: 500 })
  }
}
