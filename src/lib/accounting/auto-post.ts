import { DianDocumentDirection, EstadoCompra, PosInvoiceStatus } from '@prisma/client'
import type { AccountingEventType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AccountingError, generateJournalEntryFromRule, type AccountingAmounts } from '@/lib/accounting/engine'

export const ACCOUNTING_REFERENCE_TYPES = [
  'POS_INVOICE',
  'POS_RETURN',
  'COMPRA',
  'COMPRA_PAGO',
  'DIAN_DOCUMENT',
] as const

export type AccountingReferenceType = (typeof ACCOUNTING_REFERENCE_TYPES)[number]

export type AutoPostSkipReason =
  | 'ALREADY_POSTED'
  | 'NOT_ELIGIBLE'
  | 'NO_AMOUNTS'
  | 'DOCUMENT_NOT_FOUND'
  | 'DUPLICATE_OF_COMPRA'

export type AutoPostOutcome = {
  ok: boolean
  referenceType: AccountingReferenceType
  referenceId: string
  entryId: string | null
  skipped?: AutoPostSkipReason
  code?: string
  error?: string
}

function money(value: number | null | undefined) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return 0
  return Math.round(num)
}

/**
 * Normaliza montos de una factura POS para el motor contable.
 * Garantiza TOTAL = SUBTOTAL (neto de descuento) + IVA (incluye otros impuestos).
 */
export function posInvoiceAmounts(invoice: {
  subtotal: number
  discountAmount: number
  iva: number
  otherTaxesAmount: number
  total: number
}): AccountingAmounts {
  const discount = Math.max(0, money(invoice.discountAmount))
  const netSubtotal = Math.max(0, money(invoice.subtotal) - discount)
  const taxes = Math.max(0, money(invoice.iva) + money(invoice.otherTaxesAmount))
  return {
    SUBTOTAL: netSubtotal,
    DESCUENTO: discount,
    IVA: taxes,
    TOTAL: netSubtotal + taxes,
  }
}

export function posReturnAmounts(posReturn: { subtotal: number; iva: number; total: number }): AccountingAmounts {
  const subtotal = Math.max(0, money(posReturn.subtotal))
  const iva = Math.max(0, money(posReturn.iva))
  return { SUBTOTAL: subtotal, IVA: iva, TOTAL: subtotal + iva }
}

export function compraAmounts(compra: {
  subtotalSinIva: number
  descuentoTotal: number
  iva: number
  total: number
}): AccountingAmounts {
  const subtotal = Math.max(0, money(compra.subtotalSinIva))
  const iva = Math.max(0, money(compra.iva))
  return {
    SUBTOTAL: subtotal,
    DESCUENTO: Math.max(0, money(compra.descuentoTotal)),
    IVA: iva,
    TOTAL: subtotal + iva,
  }
}

export function compraPagoAmounts(pago: { monto: number }): AccountingAmounts {
  const total = Math.max(0, money(pago.monto))
  return { TOTAL: total, SUBTOTAL: total, IVA: 0 }
}

/** Extrae montos de un documento DIAN recibido (payload libre). Devuelve null si no hay cifras. */
export function dianDocumentAmounts(payload: unknown): AccountingAmounts | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const root = payload as Record<string, unknown>
  const totals =
    root.totals && typeof root.totals === 'object' && !Array.isArray(root.totals)
      ? (root.totals as Record<string, unknown>)
      : null

  const read = (keys: string[]) => {
    for (const source of [totals, root]) {
      if (!source) continue
      for (const key of keys) {
        const raw = source[key]
        const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
        if (Number.isFinite(num) && num > 0) return num
      }
    }
    return null
  }

  const total = read(['payableAmount', 'taxInclusiveAmount', 'total', 'importeTotal', 'valorTotal', 'totalAmount'])
  const subtotal = read(['taxExclusiveAmount', 'subtotal', 'subtotalSinIva', 'lineExtensionAmount'])
  const iva = read(['taxAmount', 'iva', 'totalIva'])

  if (total === null && subtotal === null) return null

  const netSubtotal = Math.max(0, money(subtotal ?? Math.max(0, (total ?? 0) - (iva ?? 0))))
  const totalFinal = money(total ?? netSubtotal + money(iva ?? 0))
  if (totalFinal <= 0) return null

  const taxes = Math.max(0, totalFinal - netSubtotal)
  return { SUBTOTAL: netSubtotal, IVA: taxes, TOTAL: netSubtotal + taxes }
}

type PersistArgs = {
  empresaId: string
  userId?: string | null
  referenceType: AccountingReferenceType
  referenceId: string
  eventType: AccountingEventType
  date: Date
  description: string
  amounts: AccountingAmounts
  referenceExtra?: Record<string, unknown> | null
}

async function persistEntry(args: PersistArgs): Promise<AutoPostOutcome> {
  const base = { referenceType: args.referenceType, referenceId: args.referenceId }

  const hasAmounts = Object.values(args.amounts).some((value) => money(value ?? 0) > 0)
  if (!hasAmounts) {
    return { ...base, ok: true, entryId: null, skipped: 'NO_AMOUNTS' }
  }

  try {
    const closedPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        empresaId: args.empresaId,
        status: { in: ['CLOSED', 'LOCKED'] },
        startsAt: { lte: args.date },
        endsAt: { gte: args.date },
      },
      select: { code: true, status: true },
    })

    if (closedPeriod) {
      const message = `El período ${closedPeriod.code} está ${closedPeriod.status === 'LOCKED' ? 'bloqueado' : 'cerrado'}; reábrelo para contabilizar`
      console.warn('[contabilidad] contabilización bloqueada por período', { ...base, code: 'PERIOD_CLOSED', message })
      return { ...base, ok: false, entryId: null, code: 'PERIOD_CLOSED', error: message }
    }

    const entry = await generateJournalEntryFromRule({
      empresaId: args.empresaId,
      userId: args.userId ?? null,
      eventType: args.eventType,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      date: args.date,
      description: args.description,
      amounts: args.amounts,
      referenceExtra: args.referenceExtra ?? null,
    })

    return { ...base, ok: true, entryId: entry.id }
  } catch (error) {
    if (error instanceof AccountingError && error.code === 'ENTRY_ALREADY_EXISTS') {
      return { ...base, ok: true, entryId: null, skipped: 'ALREADY_POSTED' }
    }

    const code = error instanceof AccountingError ? error.code : 'UNEXPECTED'
    const message = error instanceof Error ? error.message : 'Error desconocido al contabilizar'

    console.warn('[contabilidad] no se pudo contabilizar automáticamente', { ...base, code, message })

    return { ...base, ok: false, entryId: null, code, error: message }
  }
}

/**
 * Contabiliza una referencia de negocio (venta POS, devolución, compra, pago, documento DIAN).
 * Nunca lanza: devuelve el resultado para no romper el flujo transaccional del módulo origen.
 */
export async function postReferenceToAccounting(args: {
  empresaId: string
  userId?: string | null
  referenceType: AccountingReferenceType
  referenceId: string
}): Promise<AutoPostOutcome> {
  const base = { referenceType: args.referenceType, referenceId: args.referenceId }
  const common = { empresaId: args.empresaId, userId: args.userId ?? null, ...base }

  try {
    if (args.referenceType === 'POS_INVOICE') {
      const invoice = await prisma.posInvoice.findFirst({
        where: { id: args.referenceId, empresaId: args.empresaId },
        select: {
          id: true,
          numero: true,
          status: true,
          clienteNombre: true,
          clienteDocumento: true,
          subtotal: true,
          discountAmount: true,
          iva: true,
          otherTaxesAmount: true,
          total: true,
          createdAt: true,
        },
      })

      if (!invoice) return { ...base, ok: false, entryId: null, skipped: 'DOCUMENT_NOT_FOUND' }
      if (invoice.status === PosInvoiceStatus.DRAFT || invoice.status === PosInvoiceStatus.VOID) {
        return { ...base, ok: true, entryId: null, skipped: 'NOT_ELIGIBLE' }
      }

      return persistEntry({
        ...common,
        eventType: 'POS_INVOICE',
        date: invoice.createdAt,
        description: `Venta POS ${invoice.numero} - ${invoice.clienteNombre}`,
        amounts: posInvoiceAmounts(invoice),
        referenceExtra: {
          numero: invoice.numero,
          cliente: invoice.clienteNombre,
          documento: invoice.clienteDocumento,
          status: invoice.status,
        },
      })
    }

    if (args.referenceType === 'POS_RETURN') {
      const posReturn = await prisma.posReturn.findFirst({
        where: { id: args.referenceId, empresaId: args.empresaId },
        select: {
          id: true,
          numero: true,
          subtotal: true,
          iva: true,
          total: true,
          createdAt: true,
          invoice: { select: { numero: true } },
        },
      })

      if (!posReturn) return { ...base, ok: false, entryId: null, skipped: 'DOCUMENT_NOT_FOUND' }

      return persistEntry({
        ...common,
        eventType: 'POS_RETURN',
        date: posReturn.createdAt,
        description: `Devolución POS ${posReturn.numero}${posReturn.invoice?.numero ? ` (factura ${posReturn.invoice.numero})` : ''}`,
        amounts: posReturnAmounts(posReturn),
        referenceExtra: { numero: posReturn.numero, factura: posReturn.invoice?.numero ?? null },
      })
    }


    if (args.referenceType === 'COMPRA') {
      const compra = await prisma.compra.findFirst({
        where: { id: args.referenceId, empresaId: args.empresaId },
        select: {
          id: true,
          proveedorNombre: true,
          numeroFactura: true,
          estado: true,
          autorizado: true,
          fechaCompra: true,
          subtotalSinIva: true,
          descuentoTotal: true,
          iva: true,
          total: true,
        },
      })

      if (!compra) return { ...base, ok: false, entryId: null, skipped: 'DOCUMENT_NOT_FOUND' }
      if (!compra.autorizado || compra.estado === EstadoCompra.ANULADA) {
        return { ...base, ok: true, entryId: null, skipped: 'NOT_ELIGIBLE' }
      }

      return persistEntry({
        ...common,
        eventType: 'COMPRA',
        date: compra.fechaCompra,
        description: `Compra ${compra.numeroFactura ?? compra.id} - ${compra.proveedorNombre}`,
        amounts: compraAmounts(compra),
        referenceExtra: {
          proveedor: compra.proveedorNombre,
          numeroFactura: compra.numeroFactura,
          estado: compra.estado,
        },
      })
    }

    if (args.referenceType === 'COMPRA_PAGO') {
      const pago = await prisma.compraPago.findFirst({
        where: { id: args.referenceId, empresaId: args.empresaId },
        select: {
          id: true,
          monto: true,
          fecha: true,
          metodo: true,
          referencia: true,
          compra: { select: { id: true, proveedorNombre: true, numeroFactura: true } },
        },
      })

      if (!pago) return { ...base, ok: false, entryId: null, skipped: 'DOCUMENT_NOT_FOUND' }

      return persistEntry({
        ...common,
        eventType: 'COMPRA_PAGO',
        date: pago.fecha,
        description: `Pago compra ${pago.compra?.numeroFactura ?? pago.compra?.id ?? ''} - ${pago.compra?.proveedorNombre ?? ''}`.trim(),
        amounts: compraPagoAmounts(pago),
        referenceExtra: {
          compraId: pago.compra?.id ?? null,
          metodo: pago.metodo,
          referencia: pago.referencia,
        },
      })
    }

    // DIAN_DOCUMENT: solo documentos recibidos (compras electrónicas).
    const doc = await prisma.dianElectronicDocument.findFirst({
      where: { id: args.referenceId, empresaId: args.empresaId },
      select: {
        id: true,
        direction: true,
        type: true,
        status: true,
        numero: true,
        cufe: true,
        payload: true,
        receivedAt: true,
        createdAt: true,
        posInvoiceId: true,
      },
    })

    if (!doc) return { ...base, ok: false, entryId: null, skipped: 'DOCUMENT_NOT_FOUND' }
    if (doc.direction !== DianDocumentDirection.INBOUND || doc.posInvoiceId) {
      return { ...base, ok: true, entryId: null, skipped: 'NOT_ELIGIBLE' }
    }

    if (doc.numero) {
      const compraExistente = await prisma.compra.findFirst({
        where: { empresaId: args.empresaId, numeroFactura: doc.numero },
        select: { id: true },
      })
      if (compraExistente) {
        return { ...base, ok: true, entryId: null, skipped: 'DUPLICATE_OF_COMPRA' }
      }
    }

    const amounts = dianDocumentAmounts(doc.payload)
    if (!amounts) return { ...base, ok: true, entryId: null, skipped: 'NO_AMOUNTS' }

    return persistEntry({
      ...common,
      eventType: 'DIAN_DOCUMENT',
      date: doc.receivedAt ?? doc.createdAt,
      description: `Documento DIAN ${doc.type} ${doc.numero ?? doc.id}`.trim(),
      amounts,
      referenceExtra: { numero: doc.numero, cufe: doc.cufe, tipo: doc.type },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado al contabilizar'
    console.warn('[contabilidad] error inesperado al contabilizar', { ...base, message })
    return { ...base, ok: false, entryId: null, code: 'UNEXPECTED', error: message }
  }
}

/** Anula (status VOID) el asiento generado para una referencia, si existe y está posteado. */
export async function voidReferenceAccounting(args: {
  empresaId: string
  referenceType: AccountingReferenceType
  referenceId: string
  reason?: string
}): Promise<{ ok: boolean; voided: boolean }> {
  try {
    const entry = await prisma.accountingJournalEntry.findFirst({
      where: {
        empresaId: args.empresaId,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
      },
      select: { id: true, status: true, description: true },
    })

    if (!entry || entry.status !== 'POSTED') return { ok: true, voided: false }

    const suffix = args.reason ? ` [ANULADO: ${args.reason}]` : ' [ANULADO]'

    await prisma.accountingJournalEntry.update({
      where: { id: entry.id },
      data: { status: 'VOID', description: `${entry.description}${suffix}`.slice(0, 500) },
      select: { id: true },
    })

    return { ok: true, voided: true }
  } catch (error) {
    console.warn('[contabilidad] no se pudo anular el asiento', {
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, voided: false }
  }
}


export type PendingAccountingItem = {
  referenceType: AccountingReferenceType
  referenceId: string
  label: string
  detail: string | null
  date: string
  amount: number
}

export type PendingAccountingGroup = {
  referenceType: AccountingReferenceType
  label: string
  count: number
  amount: number
  items: PendingAccountingItem[]
}

const PENDING_WINDOW_DAYS = 120
const MAX_ITEMS_PER_SOURCE = 25
const MAX_SCAN_PER_SOURCE = 300

/**
 * Lista documentos de negocio que aún no tienen asiento contable.
 * Útil cuando el evento ocurrió sin regla configurada: se puede contabilizar después.
 */
export async function listPendingAccounting(args: {
  empresaId: string
  days?: number
}): Promise<{ windowDays: number; total: number; groups: PendingAccountingGroup[] }> {
  const empresaId = args.empresaId
  const windowDays = args.days && args.days > 0 ? Math.min(args.days, 3650) : PENDING_WINDOW_DAYS
  const from = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const existing = await prisma.accountingJournalEntry.findMany({
    where: { empresaId },
    select: { referenceType: true, referenceId: true },
  })

  const handled = new Set(existing.map((row) => `${row.referenceType}::${row.referenceId}`))

  const [invoices, returns, compras, pagos, dianDocs] = await Promise.all([
    prisma.posInvoice.findMany({
      where: {
        empresaId,
        createdAt: { gte: from },
        status: { notIn: [PosInvoiceStatus.DRAFT, PosInvoiceStatus.VOID] },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_SCAN_PER_SOURCE,
      select: { id: true, numero: true, clienteNombre: true, total: true, createdAt: true },
    }),
    prisma.posReturn.findMany({
      where: { empresaId, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      take: MAX_SCAN_PER_SOURCE,
      select: { id: true, numero: true, total: true, createdAt: true },
    }),
    prisma.compra.findMany({
      where: { empresaId, autorizado: true, estado: { not: EstadoCompra.ANULADA }, fechaCompra: { gte: from } },
      orderBy: { fechaCompra: 'desc' },
      take: MAX_SCAN_PER_SOURCE,
      select: { id: true, proveedorNombre: true, numeroFactura: true, total: true, fechaCompra: true },
    }),
    prisma.compraPago.findMany({
      where: { empresaId, fecha: { gte: from } },
      orderBy: { fecha: 'desc' },
      take: MAX_SCAN_PER_SOURCE,
      select: {
        id: true,
        monto: true,
        fecha: true,
        referencia: true,
        compra: { select: { numeroFactura: true, proveedorNombre: true } },
      },
    }),
    prisma.dianElectronicDocument.findMany({
      where: { empresaId, direction: DianDocumentDirection.INBOUND, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      take: MAX_SCAN_PER_SOURCE,
      select: {
        id: true,
        type: true,
        numero: true,
        payload: true,
        receivedAt: true,
        createdAt: true,
      },
    }),
  ])

  const buildGroup = (
    referenceType: AccountingReferenceType,
    label: string,
    raw: Array<{ id: string; label: string; detail: string | null; date: Date; amount: number }>
  ): PendingAccountingGroup | null => {
    const pending = raw.filter((row) => !handled.has(`${referenceType}::${row.id}`))
    if (pending.length === 0) return null

    return {
      referenceType,
      label,
      count: pending.length,
      amount: pending.reduce((sum, row) => sum + money(row.amount), 0),
      items: pending.slice(0, MAX_ITEMS_PER_SOURCE).map((row) => ({
        referenceType,
        referenceId: row.id,
        label: row.label,
        detail: row.detail,
        date: row.date.toISOString(),
        amount: money(row.amount),
      })),
    }
  }

  const groups = [
    buildGroup(
      'POS_INVOICE',
      'Ventas POS sin asiento',
      invoices.map((invoice) => ({
        id: invoice.id,
        label: `Venta ${invoice.numero}`,
        detail: invoice.clienteNombre,
        date: invoice.createdAt,
        amount: invoice.total,
      }))
    ),
    buildGroup(
      'POS_RETURN',
      'Devoluciones POS sin asiento',
      returns.map((posReturn) => ({
        id: posReturn.id,
        label: `Devolución ${posReturn.numero}`,
        detail: null,
        date: posReturn.createdAt,
        amount: posReturn.total,
      }))
    ),
    buildGroup(
      'COMPRA',
      'Compras autorizadas sin asiento',
      compras.map((compra) => ({
        id: compra.id,
        label: `Compra ${compra.numeroFactura ?? compra.id}`,
        detail: compra.proveedorNombre,
        date: compra.fechaCompra,
        amount: compra.total,
      }))
    ),
    buildGroup(
      'COMPRA_PAGO',
      'Pagos a proveedor sin asiento',
      pagos.map((pago) => ({
        id: pago.id,
        label: `Pago ${pago.referencia ?? pago.id}`,
        detail: pago.compra ? `${pago.compra.proveedorNombre} ${pago.compra.numeroFactura ?? ''}`.trim() : null,
        date: pago.fecha,
        amount: pago.monto,
      }))
    ),
    buildGroup(
      'DIAN_DOCUMENT',
      'Documentos DIAN recibidos sin asiento',
      dianDocs.map((doc) => ({
        id: doc.id,
        label: `DIAN ${doc.type} ${doc.numero ?? doc.id}`,
        detail: dianDocumentAmounts(doc.payload) ? null : 'Sin montos en el payload',
        date: doc.receivedAt ?? doc.createdAt,
        amount: dianDocumentAmounts(doc.payload)?.TOTAL ?? 0,
      }))
    ),
  ].filter((group): group is PendingAccountingGroup => Boolean(group))

  return {
    windowDays,
    total: groups.reduce((sum, group) => sum + group.count, 0),
    groups,
  }
}

