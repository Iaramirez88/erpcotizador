import {
  InventoryMovementSourceType,
  InventoryMovementType,
  PosInvoiceStatus,
  PosPaymentFlow,
  PosPaymentProvider,
  PosPaymentSource,
  PosPaymentStatus,
  type Prisma,
} from '@prisma/client'
import { type PosFinalizePaymentInput } from '@/lib/pos-payments'

export class StockInsufficientError extends Error {
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

export async function resolveWarehouseId(
  tx: Prisma.TransactionClient,
  args: { empresaId: string; sedeId: string; warehouseId?: string | null },
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

export async function finalizeInvoice(
  tx: Prisma.TransactionClient,
  args: {
    empresaId: string
    sedeId: string
    userId?: string | null
    invoiceId: string
    body: { warehouseId?: string | null; payments?: PosFinalizePaymentInput[] }
  },
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
      payments: { where: { status: PosPaymentStatus.PAID }, select: { amount: true } },
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

  const paymentsInput = Array.isArray(args.body.payments) ? args.body.payments.filter((payment) => payment.amount > 0) : []
  const paymentsFinal = paymentsInput.length ? paymentsInput : []
  const paidNow = paymentsFinal.reduce((sum, payment) => sum + payment.amount, 0)

  if (remaining > 0 && Math.abs(paidNow - remaining) >= 0.01) {
    throw new Error('PAYMENTS_TOTAL_MISMATCH')
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
      const globalAfter = globalBefore - required

      if (stockAfter < -1e-9 || globalAfter < -1e-9) {
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
          createdById: args.userId ?? null,
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
          createdById: args.userId ?? null,
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
            create: paymentsFinal.map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              note: payment.note ?? null,
              status: payment.status ?? PosPaymentStatus.PAID,
              provider: payment.provider ?? PosPaymentProvider.MANUAL,
              flow: payment.flow ?? PosPaymentFlow.CASH,
              source: payment.source ?? PosPaymentSource.NONE,
              externalReference: payment.externalReference ?? null,
              boldPaymentLinkId: payment.boldPaymentLinkId ?? null,
              boldCheckoutUrl: payment.boldCheckoutUrl ?? null,
              boldPaymentId: payment.boldPaymentId ?? null,
              boldEventId: payment.boldEventId ?? null,
              boldType: payment.boldType ?? null,
              paidAt: payment.paidAt ?? new Date(),
              metadata: payment.metadata ?? {},
            })),
          }
        : undefined,
    },
    select: { id: true },
  })

  return { id: invoice.id, numero: invoice.numero, status: PosInvoiceStatus.PAID, finalized: true }
}