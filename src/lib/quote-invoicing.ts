import { PosInvoiceStatus, Prisma } from '@prisma/client'
import { reserveNextPosInvoiceNumber } from '@/lib/pos-numbering'

function n(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps
}

function sumCotizacionItemsGross(items: Array<{ subtotal?: number | null; cantidad: number; precioUnitario: number }>) {
  return items.reduce((acc, item) => {
    const lineSubtotal = n(item.subtotal)
    if (lineSubtotal !== 0) return acc + lineSubtotal
    return acc + n(item.cantidad) * n(item.precioUnitario)
  }, 0)
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

  await tx.inventoryWarehouse.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      nombre: 'Principal',
      codigo: 'PRIN',
      isDefault: true,
    },
    select: { id: true },
  }).catch(() => null)
}

async function resolveWarehouseId(tx: Prisma.TransactionClient, args: { empresaId: string; sedeId: string }) {
  await ensureDefaultWarehouse(tx, args)

  const defaultWarehouse = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId, isDefault: true },
    select: { id: true },
  })
  if (defaultWarehouse) return defaultWarehouse.id

  const warehouse = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return warehouse?.id ?? null
}

function groupItems(
  items: Array<{ materialId: string | null; descripcion: string; cantidad: number; precioUnitario: number }>
) {
  const map = new Map<string, { materialId: string | null; descripcion: string; quantity: number; unitPrice: number }>()

  for (const item of items) {
    const materialId = item.materialId
    const descripcion = String(item.descripcion || '').trim() || 'Ítem'
    const quantity = n(item.cantidad)
    const unitPrice = n(item.precioUnitario)

    if (quantity <= 0) continue

    const key = `${materialId ?? ''}::${descripcion}::${unitPrice.toFixed(6)}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity += quantity
    } else {
      map.set(key, { materialId, descripcion, quantity, unitPrice })
    }
  }

  return Array.from(map.values()).filter((item) => item.quantity > 0)
}

export class QuoteInvoiceError extends Error {
  constructor(code: string) {
    super(code)
  }
}

export async function ensureInvoiceFromQuote(
  tx: Prisma.TransactionClient,
  args: {
    cotizacionId: string
    empresaId: string
    sedeId: string
    createdById: string
  }
) {
  const cotizacion = await tx.cotizacion.findFirst({
    where: {
      id: args.cotizacionId,
      AND: [{ OR: [{ sedeId: args.sedeId }, { sedeId: null }] }],
    },
    select: {
      id: true,
      numero: true,
      estado: true,
      sedeId: true,
      clienteId: true,
      subtotal: true,
      descuento: true,
      iva: true,
      total: true,
      cliente: { select: { nombre: true, documento: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        select: { materialId: true, descripcion: true, cantidad: true, precioUnitario: true, subtotal: true },
      },
    },
  })

  if (!cotizacion) throw new QuoteInvoiceError('COTIZACION_NOT_FOUND')
  if (String(cotizacion.estado) !== 'APROBADA') throw new QuoteInvoiceError('COTIZACION_NOT_APPROVED')

  const noteMarker = `COTIZACION_ID:${cotizacion.id}`
  const existing = await tx.posInvoice.findFirst({
    where: {
      empresaId: args.empresaId,
      OR: [
        { cotizacionId: cotizacion.id },
        { note: { contains: noteMarker } },
      ],
    },
    select: { id: true, numero: true, status: true, clienteId: true, cotizacionId: true },
  })

  if (existing) {
    if (!existing.cotizacionId || existing.clienteId !== cotizacion.clienteId) {
      await tx.posInvoice.update({
        where: { id: existing.id },
        data: {
          cotizacionId: cotizacion.id,
          clienteId: cotizacion.clienteId,
        },
        select: { id: true },
      })
    }

    return { ...existing, cotizacionId: cotizacion.id, clienteId: cotizacion.clienteId, alreadyExisted: true as const }
  }

  const sede = await tx.sede.findUnique({ where: { id: args.sedeId }, select: { id: true, codigo: true, empresaId: true } })
  if (!sede || sede.empresaId !== args.empresaId) throw new QuoteInvoiceError('SEDE_NOT_FOUND')

  const createdBy = await tx.user.findUnique({ where: { id: args.createdById }, select: { id: true } })
  const warehouseId = await resolveWarehouseId(tx, { empresaId: args.empresaId, sedeId: args.sedeId })

  const prefix = `POS${sede.codigo ? `-${sede.codigo}` : ''}`
  const numero = await reserveNextPosInvoiceNumber(tx, { sedeId: args.sedeId, prefix })

  const grouped = groupItems(cotizacion.items)
  if (!grouped.length) throw new QuoteInvoiceError('NO_ITEMS')

  const cotSubtotal = n(cotizacion.subtotal)
  const cotDescuento = Math.max(0, n(cotizacion.descuento))
  const cotIva = Math.max(0, n(cotizacion.iva))
  const cotTotal = Math.max(0, n(cotizacion.total))

  const itemsGross = sumCotizacionItemsGross(cotizacion.items)
  const grossAfterDiscount = Math.max(0, itemsGross - cotDescuento)
  const itemsIncludeIva = approxEqual(cotTotal, grossAfterDiscount)

  const rate = cotSubtotal > 0 ? Math.max(0, cotIva / cotSubtotal) : 0
  const ivaPct = Math.min(100, Math.max(0, rate * 100))
  const denom = 1 + rate

  const resolvedItems = grouped.map((item) => {
    const unitPriceNoIva = itemsIncludeIva && denom > 0 ? item.unitPrice / denom : item.unitPrice
    return {
      materialId: item.materialId,
      descripcion: item.descripcion,
      quantity: item.quantity,
      unitPrice: unitPriceNoIva,
      total: item.quantity * unitPriceNoIva,
    }
  })

  const discountNoIva = itemsIncludeIva && denom > 0 ? cotDescuento / denom : cotDescuento
  const discountLine = discountNoIva > 0
    ? [{ materialId: null as string | null, descripcion: 'Descuento', quantity: 1, unitPrice: -discountNoIva, total: -discountNoIva }]
    : []

  const computedLineTotals = [...resolvedItems, ...discountLine]
  const subtotal = computedLineTotals.reduce((sum, item) => sum + item.total, 0)
  const iva = subtotal * rate
  const total = subtotal + iva

  const note = [`Origen: Cotización ${cotizacion.numero}`, noteMarker].join('\n')

  const invoice = await tx.posInvoice.create({
    data: {
      numero,
      status: PosInvoiceStatus.DRAFT,
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      warehouseId,
      clienteId: cotizacion.clienteId,
      cotizacionId: cotizacion.id,
      clienteNombre: String(cotizacion.cliente?.nombre || 'Cliente').trim() || 'Cliente',
      clienteDocumento: String(cotizacion.cliente?.documento || '').trim() || null,
      ivaPct,
      subtotal,
      iva,
      total,
      note,
      createdById: createdBy?.id ?? null,
      items: {
        create: computedLineTotals.map((item) => ({
          materialId: item.materialId,
          descripcion: item.descripcion,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    },
    select: { id: true, numero: true, status: true, clienteId: true, cotizacionId: true },
  })

  return { ...invoice, alreadyExisted: false as const }
}
