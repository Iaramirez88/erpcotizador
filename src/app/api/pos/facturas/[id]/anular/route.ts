import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  InventoryMovementSourceType,
  InventoryMovementType,
  ModuleKey,
  PosInvoiceStatus,
  type Prisma,
} from '@prisma/client'

export const runtime = 'nodejs'

async function reverseInvoiceStock(tx: Prisma.TransactionClient, args: { empresaId: string; sedeId: string; userId: string; invoiceId: string }) {
  const invoice = await tx.posInvoice.findUnique({
    where: { id: args.invoiceId },
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

  if (!invoice || invoice.empresaId !== args.empresaId || invoice.sedeId !== args.sedeId) {
    throw new Error('INVOICE_NOT_FOUND')
  }

  const hasReturns =
    (await tx.posReturn.count({
      where: { invoiceId: invoice.id, empresaId: args.empresaId, sedeId: args.sedeId },
    })) > 0

  if (hasReturns) {
    throw new Error('INVOICE_HAS_RETURNS')
  }

  if (invoice.status === PosInvoiceStatus.VOID) {
    return { id: invoice.id, numero: invoice.numero, status: invoice.status, reversed: false }
  }

  if (invoice.status === PosInvoiceStatus.DRAFT) {
    await tx.posInvoice.update({ where: { id: invoice.id }, data: { status: PosInvoiceStatus.VOID }, select: { id: true } })
    return { id: invoice.id, numero: invoice.numero, status: PosInvoiceStatus.VOID, reversed: false }
  }

  if (invoice.status !== PosInvoiceStatus.PAID) {
    throw new Error('INVOICE_STATUS_NOT_ALLOWED')
  }

  for (const it of invoice.items) {
    if (!it.materialId) continue

    if (invoice.warehouseId) {
      const stockRow = await tx.inventoryStock.findUnique({
        where: { warehouseId_materialId: { warehouseId: invoice.warehouseId, materialId: it.materialId } },
        select: { quantity: true },
      })

      const stockBefore = stockRow?.quantity ?? 0
      const stockAfter = stockBefore + it.quantity

      await tx.inventoryStock.upsert({
        where: { warehouseId_materialId: { warehouseId: invoice.warehouseId, materialId: it.materialId } },
        create: { warehouseId: invoice.warehouseId, materialId: it.materialId, quantity: stockAfter },
        update: { quantity: stockAfter },
        select: { id: true },
      })

      await tx.material.update({
        where: { id: it.materialId },
        data: { stockActual: { increment: it.quantity } },
        select: { id: true },
      })

      await tx.inventoryMovement.create({
        data: {
          empresaId: args.empresaId,
          sedeId: args.sedeId,
          warehouseId: invoice.warehouseId,
          materialId: it.materialId,
          type: InventoryMovementType.IN,
          quantity: it.quantity,
          stockBefore,
          stockAfter,
          note: `Anulación POS factura ${invoice.numero}`,
          sourceType: InventoryMovementSourceType.POS_INVOICE,
          sourceId: invoice.id,
          createdById: args.userId,
        },
        select: { id: true },
      })
    } else {
      const mat = await tx.material.findUnique({ where: { id: it.materialId }, select: { stockActual: true } })
      const stockBefore = mat?.stockActual ?? 0
      const stockAfter = stockBefore + it.quantity

      await tx.material.update({
        where: { id: it.materialId },
        data: { stockActual: stockAfter },
        select: { id: true },
      })

      await tx.inventoryMovement.create({
        data: {
          empresaId: args.empresaId,
          sedeId: args.sedeId,
          materialId: it.materialId,
          type: InventoryMovementType.IN,
          quantity: it.quantity,
          stockBefore,
          stockAfter,
          note: `Anulación POS factura ${invoice.numero}`,
          sourceType: InventoryMovementSourceType.POS_INVOICE,
          sourceId: invoice.id,
          createdById: args.userId,
        },
        select: { id: true },
      })
    }
  }

  await tx.posInvoice.update({ where: { id: invoice.id }, data: { status: PosInvoiceStatus.VOID }, select: { id: true } })

  return { id: invoice.id, numero: invoice.numero, status: PosInvoiceStatus.VOID, reversed: true }
}

type PostBody = {
  note?: string
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const { id } = await ctx.params

    // Reservado para futura auditoría / nota de anulación
    void ((await request.json().catch(() => null)) as Partial<PostBody> | null)

    const result = await prisma.$transaction((tx) =>
      reverseInvoiceStock(tx, { empresaId, sedeId: access.sedeId, userId: access.userId, invoiceId: id })
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVOICE_NOT_FOUND') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      if (error.message === 'INVOICE_HAS_RETURNS') {
        return NextResponse.json({ error: 'No se puede anular: la factura tiene devoluciones' }, { status: 400 })
      }
      if (error.message === 'INVOICE_STATUS_NOT_ALLOWED') {
        return NextResponse.json({ error: 'Estado de factura no permite anulación' }, { status: 400 })
      }
    }

    console.error('Error al anular factura POS:', error)
    return NextResponse.json({ error: 'Error al anular factura POS' }, { status: 500 })
  }
}
