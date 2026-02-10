import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, PosInvoiceStatus, type Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function n(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps
}

function sumCotizacionItemsGross(items: Array<{ subtotal?: number | null; cantidad: number; precioUnitario: number }>): number {
  return items.reduce((acc, it) => {
    const lineSubtotal = n(it.subtotal)
    if (Number.isFinite(lineSubtotal) && (lineSubtotal as number) !== 0) return acc + (lineSubtotal as number)
    return acc + n(it.cantidad) * n(it.precioUnitario)
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

async function resolveWarehouseId(tx: Prisma.TransactionClient, args: { empresaId: string; sedeId: string }) {
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

function formatPosNumber(prefix: string, seq: number): string {
  const padded = String(seq).padStart(6, '0')
  return `${prefix}-${padded}`
}

function groupItems(
  items: Array<{ materialId: string | null; descripcion: string; cantidad: number; precioUnitario: number }>
) {
  const map = new Map<string, { materialId: string | null; descripcion: string; quantity: number; unitPrice: number }>()

  for (const it of items) {
    const materialId = it.materialId
    const descripcion = String(it.descripcion || '').trim() || 'Ítem'
    const quantity = n(it.cantidad)
    const unitPrice = n(it.precioUnitario)

    if (quantity <= 0) continue

    const key = `${materialId ?? ''}::${descripcion}::${unitPrice.toFixed(6)}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity += quantity
    } else {
      map.set(key, { materialId, descripcion, quantity, unitPrice })
    }
  }

  return Array.from(map.values()).filter((x) => x.quantity > 0)
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const accessCot = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!accessCot.ok) return accessCot.response

    const accessPos = await requireApiAccess(ModuleKey.POS, 'WRITE')
    if (!accessPos.ok) return accessPos.response

    if (accessCot.empresaId !== accessPos.empresaId) {
      return NextResponse.json({ error: 'Acceso inválido para la empresa actual' }, { status: 403 })
    }

    const { id } = await ctx.params
    const empresaId = accessPos.empresaId

    const result = await prisma.$transaction(async (tx) => {
      const cotizacion = await tx.cotizacion.findFirst({
        where: {
          id,
          AND: [{ OR: [{ sedeId: accessCot.sedeId }, { sedeId: null }] }],
        },
        select: {
          id: true,
          numero: true,
          estado: true,
          sedeId: true,
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

      if (!cotizacion) throw new Error('COTIZACION_NOT_FOUND')

      if (String(cotizacion.estado) !== 'APROBADA') {
        throw new Error('COTIZACION_NOT_APPROVED')
      }

      const noteMarker = `COTIZACION_ID:${cotizacion.id}`
      const existing = await tx.posInvoice.findFirst({
        where: {
          empresaId,
          sedeId: accessPos.sedeId,
          note: { contains: noteMarker },
        },
        select: { id: true, numero: true, status: true },
      })

      if (existing) {
        return { ...existing, alreadyExisted: true as const }
      }

      const sede = await tx.sede.findUnique({ where: { id: accessPos.sedeId }, select: { id: true, codigo: true, empresaId: true } })
      if (!sede || sede.empresaId !== empresaId) throw new Error('SEDE_NOT_FOUND')

      const warehouseId = await resolveWarehouseId(tx, { empresaId, sedeId: accessPos.sedeId })

      const seq = await tx.posSequence.upsert({
        where: { sedeId: accessPos.sedeId },
        create: { sedeId: accessPos.sedeId, nextInvoiceNumber: 2, nextReturnNumber: 1 },
        update: { nextInvoiceNumber: { increment: 1 } },
        select: { nextInvoiceNumber: true },
      })

      const seqNumber = seq.nextInvoiceNumber - 1
      const prefix = `POS${sede.codigo ? `-${sede.codigo}` : ''}`
      const numero = formatPosNumber(prefix, seqNumber)

      const grouped = groupItems(cotizacion.items)
      if (!grouped.length) throw new Error('NO_ITEMS')

      // En el cotizador existe un setting: precios con IVA incluido.
      // Esa bandera NO está persistida por cotización. Además, los campos (subtotal/iva/total)
      // se guardan ya con el descuento aplicado, mientras que los ítems NO necesariamente lo incluyen.
      // Por eso inferimos si los precios de ítems venían CON IVA comparando:
      //   (suma(subtotales items) - descuento) vs total.
      // Si coinciden, entonces los ítems venían con IVA incluido (el total ya lo incluye).
      // Si no, entonces los ítems venían sin IVA (el total suele ser base+iva).
      const cotSubtotal = n(cotizacion.subtotal)
      const cotDescuento = Math.max(0, n(cotizacion.descuento))
      const cotIva = Math.max(0, n(cotizacion.iva))
      const cotTotal = Math.max(0, n(cotizacion.total))

      const itemsGross = sumCotizacionItemsGross(cotizacion.items)
      const grossAfterDiscount = Math.max(0, itemsGross - cotDescuento)

      const itemsIncludeIva = approxEqual(cotTotal, grossAfterDiscount)

      // Derivar tasa efectiva desde la cotización (evita aplicar 19% extra sobre precios con IVA incluido).
      // Nota: cotSubtotal ya está en base (sin IVA) y ya tiene descuento aplicado.
      const rate = cotSubtotal > 0 ? Math.max(0, cotIva / cotSubtotal) : 0
      const ivaPct = Math.min(100, Math.max(0, rate * 100))

      const denom = 1 + rate

      // Convertir items a precios sin IVA si los ítems venían con IVA incluido.
      const resolvedItems = grouped.map((it) => {
        const unitPriceNoIva = itemsIncludeIva && denom > 0 ? it.unitPrice / denom : it.unitPrice
        return {
          materialId: it.materialId,
          descripcion: it.descripcion,
          quantity: it.quantity,
          unitPrice: unitPriceNoIva,
          total: it.quantity * unitPriceNoIva,
        }
      })

      // Aplicar descuento como línea negativa (en base sin IVA).
      // En cotizador, si los ítems venían con IVA, el descuento también está expresado sobre el valor con IVA.
      const discountNoIva = itemsIncludeIva && denom > 0 ? cotDescuento / denom : cotDescuento

      const discountLine = discountNoIva > 0
        ? [{ materialId: null as string | null, descripcion: 'Descuento', quantity: 1, unitPrice: -discountNoIva, total: -discountNoIva }]
        : []

      const computedLineTotals = [...resolvedItems, ...discountLine]
      const subtotal = computedLineTotals.reduce((sum, it) => sum + it.total, 0)
      const iva = subtotal * rate
      const total = subtotal + iva

      const note = [`Origen: Cotización ${cotizacion.numero}`, noteMarker].join('\n')

      const invoice = await tx.posInvoice.create({
        data: {
          numero,
          status: PosInvoiceStatus.DRAFT,
          empresaId,
          sedeId: accessPos.sedeId,
          warehouseId,
          clienteNombre: String(cotizacion.cliente?.nombre || 'Cliente').trim() || 'Cliente',
          clienteDocumento: String(cotizacion.cliente?.documento || '').trim() || null,
          ivaPct,
          subtotal,
          iva,
          total,
          note,
          createdById: accessPos.userId,
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
        select: { id: true, numero: true, status: true },
      })

      return { ...invoice, alreadyExisted: false as const }
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'COTIZACION_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Cotización no encontrada' }, { status: 404 })
      }
      if (error.message === 'COTIZACION_NOT_APPROVED') {
        return NextResponse.json({ ok: false, error: 'Primero aprueba la cotización para facturar' }, { status: 400 })
      }
      if (error.message === 'SEDE_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Sede no encontrada' }, { status: 404 })
      }
      if (error.message === 'NO_ITEMS') {
        return NextResponse.json({ ok: false, error: 'La cotización no tiene ítems válidos para facturar' }, { status: 400 })
      }
    }

    console.error('Error al facturar desde cotización:', error)
    return NextResponse.json({ ok: false, error: 'Error al facturar desde cotización' }, { status: 500 })
  }
}
