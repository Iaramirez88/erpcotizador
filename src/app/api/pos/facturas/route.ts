import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  ModuleKey,
  PosInvoiceStatus,
  PosPaymentMethod,
  type Prisma,
  InventoryMovementType,
  InventoryMovementSourceType,
} from '@prisma/client'

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

async function resolveWarehouseId(tx: Prisma.TransactionClient, args: { empresaId: string; sedeId: string; warehouseId?: string | null }) {
  if (args.warehouseId) {
    const wh = await tx.inventoryWarehouse.findUnique({ where: { id: args.warehouseId }, select: { id: true, empresaId: true, sedeId: true } })
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

function formatPosNumber(prefix: string, seq: number): string {
  const padded = String(seq).padStart(6, '0')
  return `${prefix}-${padded}`
}

type InvoiceItemInput = {
  materialId?: string | null
  descripcion?: string
  quantity: number
  unitPrice: number
}

type PaymentInput = {
  method: PosPaymentMethod
  amount: number
  note?: string | null
}

type PostBody = {
  clienteNombre: string
  clienteDocumento?: string | null
  ivaPct?: number | null
  discountAmount?: number | null
  otherTaxesAmount?: number | null
  note?: string | null
  warehouseId?: string | null
  asDraft?: boolean
  items: InvoiceItemInput[]
  payments?: PaymentInput[]
}

function normalizePaymentMethod(value: unknown): PosPaymentMethod {
  if (typeof value !== 'string') return PosPaymentMethod.OTHER
  const v = value.trim().toUpperCase()
  const allowed = Object.values(PosPaymentMethod) as string[]
  return allowed.includes(v) ? (v as PosPaymentMethod) : PosPaymentMethod.OTHER
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))

    const invoices = await prisma.posInvoice.findMany({
      where: { empresaId, sedeId: access.sedeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        numero: true,
        status: true,
        clienteNombre: true,
        total: true,
        createdAt: true,
        warehouse: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json({ success: true, data: invoices })
  } catch (error) {
    console.error('Error al listar facturas POS:', error)
    return NextResponse.json({ error: 'Error al listar facturas POS' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null
    const clienteNombre = typeof body?.clienteNombre === 'string' ? body.clienteNombre.trim() : ''

    if (!clienteNombre) {
      return NextResponse.json({ error: 'clienteNombre es requerido' }, { status: 400 })
    }

    const items = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'items es requerido' }, { status: 400 })
    }

    const ivaPct = Math.max(0, n(body?.ivaPct ?? 0) ?? 0)
    const discountAmountInput = Math.max(0, n(body?.discountAmount ?? 0) ?? 0)
    const otherTaxesAmountInput = Math.max(0, n(body?.otherTaxesAmount ?? 0) ?? 0)
    const note = typeof body?.note === 'string' ? body.note.trim() : null
    const clienteDocumento = typeof body?.clienteDocumento === 'string' ? body.clienteDocumento.trim() : null
    const asDraft = Boolean(body?.asDraft)

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

      const warehouseId = await resolveWarehouseId(tx, { empresaId, sedeId: access.sedeId, warehouseId: body?.warehouseId })

      const seq = await tx.posSequence.upsert({
        where: { sedeId: access.sedeId },
        create: { sedeId: access.sedeId, nextInvoiceNumber: 2, nextReturnNumber: 1 },
        update: { nextInvoiceNumber: { increment: 1 } },
        select: { nextInvoiceNumber: true },
      })

      const seqNumber = seq.nextInvoiceNumber - 1
      const prefix = `POS${sede.codigo ? `-${sede.codigo}` : ''}`
      const numero = formatPosNumber(prefix, seqNumber)

      const resolvedItems = await Promise.all(
        normalizedItems.map(async (it) => {
          if (it.materialId) {
            const material = await tx.material.findUnique({
              where: { id: it.materialId },
              select: { id: true, empresaId: true, nombre: true, unidadMedida: true },
            })
            if (!material || material.empresaId !== empresaId) {
              throw new Error('MATERIAL_NOT_FOUND')
            }
            return { ...it, descripcion: it.descripcion || material.nombre, unidadMedida: material.unidadMedida }
          }
          return { ...it, descripcion: it.descripcion || 'Ítem', unidadMedida: null as string | null }
        })
      )

      const computedLineTotals = resolvedItems.map((it) => {
        const total = it.quantity * it.unitPrice
        return { ...it, total }
      })

      const subtotal = computedLineTotals.reduce((sum, it) => sum + it.total, 0)
      const discountFinal = Math.min(subtotal, discountAmountInput)
      const taxableBase = Math.max(0, subtotal - discountFinal)
      const iva = taxableBase * (ivaPct / 100)
      const total = taxableBase + iva + otherTaxesAmountInput

      const paymentsInput = Array.isArray(body?.payments) ? body.payments : []
      const paymentsNormalized: PaymentInput[] = paymentsInput
        .map((p) => {
          const amount = n(p.amount) ?? 0
          const method = normalizePaymentMethod((p as any).method)
          const note = typeof p.note === 'string' ? p.note.trim() : null
          return { method, amount, note }
        })
        .filter((p) => p.amount > 0)

      const paymentsFinal = asDraft
        ? []
        : paymentsNormalized.length
          ? paymentsNormalized
          : total > 0
            ? [{ method: PosPaymentMethod.CASH, amount: total, note: null }]
            : []

      const paidSum = paymentsFinal.reduce((sum, p) => sum + p.amount, 0)
      if (!asDraft && Math.abs(paidSum - total) >= 0.01) {
        throw new Error('PAYMENTS_TOTAL_MISMATCH')
      }

      const status: PosInvoiceStatus = asDraft ? PosInvoiceStatus.DRAFT : PosInvoiceStatus.PAID

      const invoice = await tx.posInvoice.create({
        data: {
          numero,
          status,
          empresaId,
          sedeId: access.sedeId,
          warehouseId,
          clienteNombre,
          clienteDocumento,
          ivaPct,
          subtotal,
          discountAmount: discountFinal,
          otherTaxesAmount: otherTaxesAmountInput,
          iva,
          total,
          note,
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
          payments: paymentsFinal.length
            ? {
                create: paymentsFinal.map((p) => ({ method: p.method, amount: p.amount, note: p.note })),
              }
            : undefined,
        },
        select: { id: true, numero: true, status: true, total: true, warehouseId: true },
      })

      if (invoice.status === PosInvoiceStatus.PAID) {
        for (const it of computedLineTotals) {
          if (!it.materialId) continue

          if (warehouseId) {
            const stockRow = await tx.inventoryStock.findUnique({
              where: { warehouseId_materialId: { warehouseId, materialId: it.materialId } },
              select: { id: true, quantity: true },
            })
            const stockBefore = stockRow?.quantity ?? 0
            const stockAfter = stockBefore - it.quantity
            if (stockAfter < -1e-9) {
              throw new Error('STOCK_INSUFFICIENT')
            }

            await tx.inventoryStock.upsert({
              where: { warehouseId_materialId: { warehouseId, materialId: it.materialId } },
              create: { warehouseId, materialId: it.materialId, quantity: stockAfter },
              update: { quantity: stockAfter },
              select: { id: true },
            })

            const mat = await tx.material.findUnique({ where: { id: it.materialId }, select: { stockActual: true } })
            const globalBefore = mat?.stockActual ?? 0
            const globalAfter = globalBefore - it.quantity
            if (globalAfter < -1e-9) {
              throw new Error('STOCK_INSUFFICIENT')
            }

            await tx.material.update({ where: { id: it.materialId }, data: { stockActual: globalAfter }, select: { id: true } })

            await tx.inventoryMovement.create({
              data: {
                empresaId,
                sedeId: access.sedeId,
                warehouseId,
                materialId: it.materialId,
                type: InventoryMovementType.OUT,
                quantity: -it.quantity,
                stockBefore,
                stockAfter,
                note: `POS factura ${invoice.numero}`,
                sourceType: InventoryMovementSourceType.POS_INVOICE,
                sourceId: invoice.id,
                createdById: access.userId,
              },
              select: { id: true },
            })
          } else {
            const mat = await tx.material.findUnique({ where: { id: it.materialId }, select: { stockActual: true } })
            const stockBefore = mat?.stockActual ?? 0
            const stockAfter = stockBefore - it.quantity
            if (stockAfter < -1e-9) {
              throw new Error('STOCK_INSUFFICIENT')
            }

            await tx.material.update({ where: { id: it.materialId }, data: { stockActual: stockAfter }, select: { id: true } })

            await tx.inventoryMovement.create({
              data: {
                empresaId,
                sedeId: access.sedeId,
                materialId: it.materialId,
                type: InventoryMovementType.OUT,
                quantity: -it.quantity,
                stockBefore,
                stockAfter,
                note: `POS factura ${invoice.numero}`,
                sourceType: InventoryMovementSourceType.POS_INVOICE,
                sourceId: invoice.id,
                createdById: access.userId,
              },
              select: { id: true },
            })
          }
        }
      }

      return invoice
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SEDE_NOT_FOUND') {
        return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
      }
      if (error.message === 'MATERIAL_NOT_FOUND') {
        return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
      }
      if (error.message === 'STOCK_INSUFFICIENT') {
        return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 })
      }
      if (error.message === 'PAYMENTS_TOTAL_MISMATCH') {
        return NextResponse.json({ error: 'La suma de pagos debe ser igual al total' }, { status: 400 })
      }
    }

    console.error('Error al crear factura POS:', error)
    return NextResponse.json({ error: 'Error al crear factura POS' }, { status: 500 })
  }
}
