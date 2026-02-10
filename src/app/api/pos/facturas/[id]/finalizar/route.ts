import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getOrCreateDefaultEmpresa } from '@/lib/rbac'
import {
  InventoryMovementSourceType,
  InventoryMovementType,
  ModuleKey,
  PosInvoiceStatus,
  PosPaymentMethod,
  type Prisma,
} from '@prisma/client'

export const runtime = 'nodejs'

class StockInsufficientError extends Error {
  details: {
    materialId: string
    materialNombre?: string | null
    required: number
    warehouseId?: string | null
    warehouseNombre?: string | null
    warehouseAvailable?: number | null
    globalAvailable?: number | null
  }

  constructor(details: StockInsufficientError['details']) {
    super('STOCK_INSUFFICIENT')
    this.details = details
  }
}

function n(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

async function getOrCreateEmpresaIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  const empresa = await getOrCreateDefaultEmpresa()
  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
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
): Promise<string | null> {
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

type PaymentInput = {
  method: PosPaymentMethod
  amount: number
  note?: string | null
}

type PostBody = {
  warehouseId?: string | null
  payments?: PaymentInput[]
}

async function finalizeInvoice(
  tx: Prisma.TransactionClient,
  args: { empresaId: string; sedeId: string; userId: string; invoiceId: string; body: PostBody }
) {
  const invoice = await tx.posInvoice.findUnique({
    where: { id: args.invoiceId },
    select: {
      id: true,
      numero: true,
      status: true,
      empresaId: true,
      sedeId: true,
      warehouseId: true,
      total: true,
      payments: { select: { amount: true } },
      items: { select: { materialId: true, quantity: true } },
    },
  })

  if (!invoice || invoice.empresaId !== args.empresaId || invoice.sedeId !== args.sedeId) {
    throw new Error('INVOICE_NOT_FOUND')
  }

  if (invoice.status === PosInvoiceStatus.PAID) {
    return { id: invoice.id, numero: invoice.numero, status: invoice.status, finalized: false }
  }

  if (invoice.status !== PosInvoiceStatus.DRAFT) {
    throw new Error('INVOICE_STATUS_NOT_ALLOWED')
  }

  const alreadyPaid = invoice.payments.reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const remaining = Math.max(0, invoice.total - alreadyPaid)

  const paymentsInput = Array.isArray(args.body.payments) ? args.body.payments : null
  const paymentsNormalized: PaymentInput[] = paymentsInput
    ? paymentsInput
        .map((p) => {
          const amount = n(p.amount) ?? 0
          const note = typeof p.note === 'string' ? p.note.trim() : null
          return { method: p.method, amount, note }
        })
        .filter((p) => p.amount > 0)
    : []

  const paymentsFinal = paymentsNormalized.length
    ? paymentsNormalized
    : remaining > 0
      ? [{ method: PosPaymentMethod.CASH, amount: remaining, note: null }]
      : []

  const paidNow = paymentsFinal.reduce((sum, p) => sum + p.amount, 0)
  if (paidNow + 1e-6 < remaining) {
    throw new Error('PAYMENT_INSUFFICIENT')
  }

  const resolvedWarehouseId = await resolveWarehouseId(tx, {
    empresaId: args.empresaId,
    sedeId: args.sedeId,
    warehouseId: args.body.warehouseId ?? invoice.warehouseId,
  })

  const resolvedWarehouse = resolvedWarehouseId
    ? await tx.inventoryWarehouse.findUnique({ where: { id: resolvedWarehouseId }, select: { id: true, nombre: true } })
    : null

  for (const it of invoice.items) {
    if (!it.materialId) continue

    const required = it.quantity

    const mat = await tx.material.findUnique({ where: { id: it.materialId }, select: { stockActual: true, nombre: true } })
    const globalBefore = mat?.stockActual ?? 0

    if (resolvedWarehouseId) {
      const stockRow = await tx.inventoryStock.findUnique({
        where: { warehouseId_materialId: { warehouseId: resolvedWarehouseId, materialId: it.materialId } },
        select: { quantity: true },
      })
      const stockBefore = stockRow?.quantity ?? 0
      const stockAfter = stockBefore - required
      if (stockAfter < -1e-9) {
        throw new StockInsufficientError({
          materialId: it.materialId,
          materialNombre: mat?.nombre ?? null,
          required,
          warehouseId: resolvedWarehouseId,
          warehouseNombre: resolvedWarehouse?.nombre ?? null,
          warehouseAvailable: stockBefore,
          globalAvailable: globalBefore,
        })
      }

      const globalAfter = globalBefore - required
      if (globalAfter < -1e-9) {
        throw new StockInsufficientError({
          materialId: it.materialId,
          materialNombre: mat?.nombre ?? null,
          required,
          warehouseId: resolvedWarehouseId,
          warehouseNombre: resolvedWarehouse?.nombre ?? null,
          warehouseAvailable: stockBefore,
          globalAvailable: globalBefore,
        })
      }

      await tx.inventoryStock.upsert({
        where: { warehouseId_materialId: { warehouseId: resolvedWarehouseId, materialId: it.materialId } },
        create: { warehouseId: resolvedWarehouseId, materialId: it.materialId, quantity: stockAfter },
        update: { quantity: stockAfter },
        select: { id: true },
      })

      await tx.material.update({ where: { id: it.materialId }, data: { stockActual: globalAfter }, select: { id: true } })

      await tx.inventoryMovement.create({
        data: {
          empresaId: args.empresaId,
          sedeId: args.sedeId,
          warehouseId: resolvedWarehouseId,
          materialId: it.materialId,
          type: InventoryMovementType.OUT,
          quantity: -required,
          stockBefore,
          stockAfter,
          note: `Facturación factura ${invoice.numero}`,
          sourceType: InventoryMovementSourceType.POS_INVOICE,
          sourceId: invoice.id,
          createdById: args.userId,
        },
        select: { id: true },
      })
    } else {
      const stockBefore = globalBefore
      const stockAfter = stockBefore - required
      if (stockAfter < -1e-9) {
        throw new StockInsufficientError({
          materialId: it.materialId,
          materialNombre: mat?.nombre ?? null,
          required,
          warehouseId: null,
          warehouseNombre: null,
          warehouseAvailable: null,
          globalAvailable: globalBefore,
        })
      }

      await tx.material.update({ where: { id: it.materialId }, data: { stockActual: stockAfter }, select: { id: true } })

      await tx.inventoryMovement.create({
        data: {
          empresaId: args.empresaId,
          sedeId: args.sedeId,
          materialId: it.materialId,
          type: InventoryMovementType.OUT,
          quantity: -required,
          stockBefore,
          stockAfter,
          note: `Facturación factura ${invoice.numero}`,
          sourceType: InventoryMovementSourceType.POS_INVOICE,
          sourceId: invoice.id,
          createdById: args.userId,
        },
        select: { id: true },
      })
    }
  }

  await tx.posInvoice.update({
    where: { id: invoice.id },
    data: {
      status: PosInvoiceStatus.PAID,
      warehouseId: resolvedWarehouseId,
      payments: paymentsFinal.length
        ? {
            create: paymentsFinal.map((p) => ({ method: p.method, amount: p.amount, note: p.note ?? null })),
          }
        : undefined,
    },
    select: { id: true },
  })

  return { id: invoice.id, numero: invoice.numero, status: PosInvoiceStatus.PAID, finalized: true }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)
    const { id } = await ctx.params

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null

    const result = await prisma.$transaction((tx) =>
      finalizeInvoice(tx, {
        empresaId,
        sedeId: access.sedeId,
        userId: access.userId,
        invoiceId: id,
        body: {
          warehouseId: typeof body?.warehouseId === 'string' ? body.warehouseId : null,
          payments: Array.isArray(body?.payments) ? (body?.payments as PaymentInput[]) : undefined,
        },
      })
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVOICE_NOT_FOUND') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      if (error.message === 'INVOICE_STATUS_NOT_ALLOWED') {
        return NextResponse.json({ error: 'Estado de factura no permite finalizar' }, { status: 400 })
      }
      if (error.message === 'PAYMENT_INSUFFICIENT') {
        return NextResponse.json({ error: 'Pago insuficiente' }, { status: 400 })
      }
      if (error.message === 'STOCK_INSUFFICIENT') {
        const details = error instanceof StockInsufficientError ? error.details : undefined
        return NextResponse.json({ error: 'Stock insuficiente', details }, { status: 400 })
      }
    }

    console.error('Error al finalizar factura:', error)
    return NextResponse.json({ error: 'Error al finalizar factura' }, { status: 500 })
  }
}
