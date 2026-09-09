import {
  InventoryMovementSourceType,
  InventoryMovementType,
  PosPaymentMethod,
  PosInvoiceStatus,
  PosPaymentFlow,
  PosPaymentProvider,
  PosPaymentSource,
  PosPaymentStatus,
  type Prisma,
} from '@prisma/client'
import { type PosFinalizePaymentInput } from '@/lib/pos-payments'
import { parseRestaurantSaleMetadata } from '@/lib/restaurante'

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

export type StockAdjustmentLine = {
  materialId: string
  quantity: number
}

export async function applyStockAdjustments(
  tx: Prisma.TransactionClient,
  args: {
    empresaId: string
    sedeId: string
    userId?: string | null
    warehouseId?: string | null
    sourceType: InventoryMovementSourceType
    sourceId: string
    note: string
    direction: 'OUT' | 'IN'
    lines: StockAdjustmentLine[]
  },
) {
  const aggregate = new Map<string, number>()
  for (const line of args.lines) {
    if (!line.materialId || line.quantity <= 0) continue
    aggregate.set(line.materialId, (aggregate.get(line.materialId) ?? 0) + line.quantity)
  }

  if (!aggregate.size) return

  const deltaSign = args.direction === 'OUT' ? -1 : 1

  for (const [materialId, quantity] of aggregate.entries()) {
    const mat = await tx.material.findUnique({ where: { id: materialId }, select: { stockActual: true, nombre: true } })
    const globalBefore = mat?.stockActual ?? 0
    const signedDelta = quantity * deltaSign

    if (args.warehouseId) {
      const stockRow = await tx.inventoryStock.findUnique({
        where: { warehouseId_materialId: { warehouseId: args.warehouseId, materialId } },
        select: { quantity: true },
      })
      const stockBefore = stockRow?.quantity ?? 0
      const stockAfter = stockBefore + signedDelta
      const globalAfter = globalBefore + signedDelta

      if (stockAfter < -1e-9 || globalAfter < -1e-9) {
        throw new StockInsufficientError({
          materialId,
          materialNombre: mat?.nombre ?? null,
          required: quantity,
          warehouseId: args.warehouseId,
          warehouseAvailable: stockBefore,
          globalAvailable: globalBefore,
        })
      }

      await tx.inventoryStock.upsert({
        where: { warehouseId_materialId: { warehouseId: args.warehouseId, materialId } },
        create: { warehouseId: args.warehouseId, materialId, quantity: stockAfter },
        update: { quantity: stockAfter },
        select: { id: true },
      })

      await tx.material.update({ where: { id: materialId }, data: { stockActual: globalAfter }, select: { id: true } })

      await tx.inventoryMovement.create({
        data: {
          empresaId: args.empresaId,
          sedeId: args.sedeId,
          warehouseId: args.warehouseId,
          materialId,
          type: args.direction === 'OUT' ? InventoryMovementType.OUT : InventoryMovementType.IN,
          quantity: signedDelta,
          stockBefore,
          stockAfter,
          note: args.note,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          createdById: args.userId ?? null,
        },
        select: { id: true },
      })
      continue
    }

    const stockBefore = globalBefore
    const stockAfter = stockBefore + signedDelta
    if (stockAfter < -1e-9) {
      throw new StockInsufficientError({
        materialId,
        materialNombre: mat?.nombre ?? null,
        required: quantity,
        globalAvailable: globalBefore,
      })
    }

    await tx.material.update({ where: { id: materialId }, data: { stockActual: stockAfter }, select: { id: true } })

    await tx.inventoryMovement.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.sedeId,
        materialId,
        type: args.direction === 'OUT' ? InventoryMovementType.OUT : InventoryMovementType.IN,
        quantity: signedDelta,
        stockBefore,
        stockAfter,
        note: args.note,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        createdById: args.userId ?? null,
      },
      select: { id: true },
    })
  }
}

export function extractRestaurantStockAdjustmentsFromPayments(payments: Array<{ metadata: unknown }>) {
  for (const payment of payments) {
    const metadata = parseRestaurantSaleMetadata(payment.metadata)
    if (metadata?.stockItems.length) return metadata.stockItems
  }
  return []
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
      payments: { where: { status: PosPaymentStatus.PAID }, select: { amount: true, metadata: true } },
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
  const defaultPayment: PosFinalizePaymentInput | null = remaining > 0
    ? {
        method: PosPaymentMethod.CASH,
        amount: remaining,
        note: null,
        provider: PosPaymentProvider.MANUAL,
        status: PosPaymentStatus.PAID,
        flow: PosPaymentFlow.CASH,
        source: PosPaymentSource.NONE,
        metadata: {},
      }
    : null

  const paymentsFinal: PosFinalizePaymentInput[] = paymentsInput.length
    ? paymentsInput
    : defaultPayment
      ? [defaultPayment]
      : []
  const paidNow = paymentsFinal.reduce((sum, payment) => sum + payment.amount, 0)

  if (remaining > 0 && Math.abs(paidNow - remaining) >= 0.01) {
    throw new Error('PAYMENTS_TOTAL_MISMATCH')
  }

  const resolvedWarehouseId = await resolveWarehouseId(tx, {
    empresaId: args.empresaId,
    sedeId: args.sedeId,
    warehouseId: args.body.warehouseId ?? invoice.warehouseId,
  })

  const directStockLines = invoice.items
    .filter((item) => Boolean(item.materialId) && item.quantity > 0)
    .map((item) => ({ materialId: item.materialId!, quantity: item.quantity }))

  await applyStockAdjustments(tx, {
    empresaId: args.empresaId,
    sedeId: args.sedeId,
    userId: args.userId,
    warehouseId: resolvedWarehouseId,
    sourceType: InventoryMovementSourceType.POS_INVOICE,
    sourceId: invoice.id,
    note: `Facturación factura ${invoice.numero}`,
    direction: 'OUT',
    lines: directStockLines,
  })

  const restaurantStockLines = extractRestaurantStockAdjustmentsFromPayments(paymentsFinal.length
    ? paymentsFinal.map((payment) => ({ metadata: payment.metadata ?? null }))
    : invoice.payments.map((payment) => ({ metadata: payment.metadata ?? null })))

  await applyStockAdjustments(tx, {
    empresaId: args.empresaId,
    sedeId: args.sedeId,
    userId: args.userId,
    warehouseId: resolvedWarehouseId,
    sourceType: InventoryMovementSourceType.POS_INVOICE,
    sourceId: invoice.id,
    note: `Consumo receta factura ${invoice.numero}`,
    direction: 'OUT',
    lines: restaurantStockLines,
  })

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