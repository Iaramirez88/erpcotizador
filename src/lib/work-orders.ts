import { Prioridad, Prisma } from '@prisma/client'
import { generarNumeroOrden } from '@/lib/utils'
import { syncInternalTaskForWorkOrder } from '@/lib/work-order-task-sync'

const WORK_ORDER_STAGES = [
  { nombre: 'Preproducción', secuencia: 1 },
  { nombre: 'Producción', secuencia: 2 },
  { nombre: 'Control de calidad', secuencia: 3 },
  { nombre: 'Entrega', secuencia: 4 },
] as const

export class WorkOrderClientResolutionError extends Error {
  constructor() {
    super('WORK_ORDER_CLIENT_RESOLUTION_REQUIRED')
  }
}

type QuoteWorkOrderItem = {
  materialId: string | null
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  unidadMedida: string | null
  terminados: string[]
  requiresWorkOrder: boolean
  autoCreateWorkOrder: boolean
}

type InvoiceWorkOrderItem = {
  materialId: string | null
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  unidadMedida: string | null
  requiresWorkOrder: boolean
  autoCreateWorkOrder: boolean
}

type ManualWorkOrderItem = {
  descripcion: string
  cantidad: number
  especificaciones?: string | null
}

function parseOrderSequence(numero?: string | null) {
  if (!numero) return 0
  const match = /^OT-(\d{4})-(\d+)$/.exec(numero.trim())
  if (!match) return 0
  return Number.parseInt(match[2] || '0', 10) || 0
}

async function getNextWorkOrderNumber(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear()
  const prefix = `OT-${year}-`

  const latest = await tx.ordenTrabajo.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { numero: true },
  })

  return generarNumeroOrden(parseOrderSequence(latest?.numero) + 1)
}

function normalizePriority(priority?: Prioridad | null) {
  return priority ?? Prioridad.NORMAL
}

function buildQuoteSnapshotItems(
  items: Array<{
    materialId: string | null
    descripcion: string | null
    cantidad: number
    precioUnitario: number
    subtotal: number
    material: { nombre: string; unidadMedida: string; requiresWorkOrder: boolean; autoCreateWorkOrder: boolean } | null
    terminados: Array<{ terminado: { nombre: string } }>
  }>
): QuoteWorkOrderItem[] {
  return items
    .map((item) => ({
      materialId: item.materialId,
      descripcion: String(item.descripcion || item.material?.nombre || 'Ítem').trim() || 'Ítem',
      cantidad: Number(item.cantidad) || 0,
      precioUnitario: Number(item.precioUnitario) || 0,
      subtotal: Number(item.subtotal) || 0,
      unidadMedida: item.material?.unidadMedida ?? null,
      terminados: item.terminados.map((entry) => entry.terminado.nombre),
      requiresWorkOrder: Boolean(item.material?.requiresWorkOrder),
      autoCreateWorkOrder: item.material?.autoCreateWorkOrder !== false,
    }))
    .filter((item) => item.cantidad > 0)
}

function buildInvoiceSnapshotItems(
  items: Array<{
    materialId: string | null
    descripcion: string
    quantity: number
    unitPrice: number
    total: number
    material: { nombre: string; unidadMedida: string; requiresWorkOrder: boolean; autoCreateWorkOrder: boolean } | null
  }>
): InvoiceWorkOrderItem[] {
  return items
    .map((item) => ({
      materialId: item.materialId,
      descripcion: String(item.descripcion || item.material?.nombre || 'Ítem').trim() || 'Ítem',
      cantidad: Number(item.quantity) || 0,
      precioUnitario: Number(item.unitPrice) || 0,
      subtotal: Number(item.total) || 0,
      unidadMedida: item.material?.unidadMedida ?? null,
      requiresWorkOrder: Boolean(item.material?.requiresWorkOrder),
      autoCreateWorkOrder: item.material?.autoCreateWorkOrder !== false,
    }))
    .filter((item) => item.cantidad > 0)
}

function hasWorkOrderItems(items: Array<{ requiresWorkOrder: boolean; autoCreateWorkOrder: boolean }>, force = false) {
  return items.some((item) => item.requiresWorkOrder && (force || item.autoCreateWorkOrder))
}

function defaultStages() {
  return WORK_ORDER_STAGES.map((stage) => ({
    nombre: stage.nombre,
    secuencia: stage.secuencia,
  }))
}

export async function createManualWorkOrder(
  tx: Prisma.TransactionClient,
  args: {
    empresaId: string
    sedeId: string
    createdById: string
    clienteId: string
    assignedToUserId?: string | null
    priority?: Prioridad | null
    fechaEntrega?: Date | null
    areaResponsable?: string | null
    observaciones?: string | null
    items: ManualWorkOrderItem[]
  }
) {
  const cliente = await tx.cliente.findFirst({
    where: { id: args.clienteId, empresaId: args.empresaId },
    select: { id: true },
  })
  if (!cliente) throw new Error('MANUAL_WORK_ORDER_CLIENT_NOT_FOUND')

  if (args.assignedToUserId) {
    const membership = await tx.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: args.sedeId, userId: args.assignedToUserId } },
      select: { id: true },
    })
    if (!membership) throw new Error('MANUAL_WORK_ORDER_ASSIGNEE_INVALID')
  }

  const items = args.items
    .map((item) => ({
      descripcion: String(item.descripcion || '').trim(),
      cantidad: Number(item.cantidad) || 0,
      especificaciones: String(item.especificaciones || '').trim() || null,
    }))
    .filter((item) => item.descripcion && item.cantidad > 0)

  if (!items.length) throw new Error('MANUAL_WORK_ORDER_ITEMS_REQUIRED')

  const numero = await getNextWorkOrderNumber(tx)
  return tx.ordenTrabajo.create({
    data: {
      numero,
      sedeId: args.sedeId,
      clienteId: cliente.id,
      vendedorId: args.createdById,
      assignedToUserId: args.assignedToUserId || null,
      assignedAt: args.assignedToUserId ? new Date() : null,
      fechaInicio: new Date(),
      fechaEntrega: args.fechaEntrega ?? null,
      sourceType: 'manual',
      estado: 'PENDIENTE',
      prioridad: normalizePriority(args.priority),
      areaResponsable: args.areaResponsable || null,
      observaciones: args.observaciones || null,
      itemsSnapshot: items as Prisma.InputJsonValue,
      etapas: { create: defaultStages() },
      events: {
        create: {
          type: 'CREATED',
          title: 'Orden creada manualmente',
          createdById: args.createdById,
          details: { sourceType: 'manual' },
        },
      },
    },
    include: {
      cliente: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      etapas: true,
    },
  })
}

export async function resolveClienteIdForPosInvoice(
  tx: Prisma.TransactionClient,
  args: { empresaId: string; clienteDocumento?: string | null; clienteNombre?: string | null }
) {
  const documento = String(args.clienteDocumento || '').trim()
  if (documento) {
    const cliente = await tx.cliente.findFirst({
      where: { empresaId: args.empresaId, documento },
      select: { id: true },
    })
    if (cliente) return cliente.id
  }

  const nombre = String(args.clienteNombre || '').trim()
  if (!nombre) return null

  const exactMatches = await tx.cliente.findMany({
    where: { empresaId: args.empresaId, nombre: { equals: nombre, mode: 'insensitive' } },
    select: { id: true },
    take: 2,
  })

  if (exactMatches.length === 1) return exactMatches[0].id
  return null
}

export async function ensureWorkOrderFromQuote(
  tx: Prisma.TransactionClient,
  args: {
    cotizacionId: string
    empresaId: string
    sedeId: string
    createdById: string
    posInvoiceId?: string | null
    priority?: Prioridad | null
    force?: boolean
  }
) {
  const cotizacion = await tx.cotizacion.findFirst({
    where: {
      id: args.cotizacionId,
      cliente: { empresaId: args.empresaId },
      OR: [{ sedeId: args.sedeId }, { sedeId: null }],
    },
    select: {
      id: true,
      numero: true,
      fecha: true,
      sedeId: true,
      clienteId: true,
      vendedorId: true,
      subtotal: true,
      descuento: true,
      iva: true,
      total: true,
      observaciones: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          materialId: true,
          descripcion: true,
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          material: {
            select: {
              nombre: true,
              unidadMedida: true,
              requiresWorkOrder: true,
              autoCreateWorkOrder: true,
            },
          },
          terminados: {
            select: {
              terminado: {
                select: { nombre: true },
              },
            },
          },
        },
      },
    },
  })

  if (!cotizacion) {
    throw new Error('QUOTE_NOT_FOUND_FOR_WORK_ORDER')
  }

  const snapshotItems = buildQuoteSnapshotItems(cotizacion.items)
  if (!hasWorkOrderItems(snapshotItems, args.force)) return null

  const existing = await tx.ordenTrabajo.findFirst({
    where: {
      OR: [
        { cotizacionId: cotizacion.id },
        ...(args.posInvoiceId ? [{ posInvoiceId: args.posInvoiceId }] : []),
      ],
    },
    select: { id: true },
  })

  const createPayload = {
    sedeId: cotizacion.sedeId ?? args.sedeId,
    clienteId: cotizacion.clienteId,
    vendedorId: cotizacion.vendedorId,
    fechaInicio: new Date(),
    fechaEntrega: null,
    sourceType: 'quotation',
    sourceId: cotizacion.id,
    cotizacionId: cotizacion.id,
    ...(args.posInvoiceId ? { posInvoiceId: args.posInvoiceId } : {}),
    subtotal: cotizacion.subtotal,
    descuento: cotizacion.descuento,
    iva: cotizacion.iva,
    total: cotizacion.total,
    estado: 'PENDIENTE' as const,
    prioridad: normalizePriority(args.priority),
    observaciones: cotizacion.observaciones,
    itemsSnapshot: snapshotItems as Prisma.InputJsonValue,
  }

  const syncPayload = {
    sedeId: cotizacion.sedeId ?? args.sedeId,
    clienteId: cotizacion.clienteId,
    vendedorId: cotizacion.vendedorId,
    sourceType: 'quotation',
    sourceId: cotizacion.id,
    cotizacionId: cotizacion.id,
    ...(args.posInvoiceId ? { posInvoiceId: args.posInvoiceId } : {}),
    subtotal: cotizacion.subtotal,
    descuento: cotizacion.descuento,
    iva: cotizacion.iva,
    total: cotizacion.total,
    prioridad: normalizePriority(args.priority),
    observaciones: cotizacion.observaciones,
    itemsSnapshot: snapshotItems as Prisma.InputJsonValue,
  }

  if (existing) {
    const orden = await tx.ordenTrabajo.update({
      where: { id: existing.id },
      data: syncPayload,
      include: {
        cliente: true,
        cotizacion: { select: { id: true, numero: true } },
        posInvoice: { select: { id: true, numero: true } },
        etapas: true,
      },
    })

    return orden
  }

  const numero = await getNextWorkOrderNumber(tx)

  const orden = await tx.ordenTrabajo.create({
    data: {
      numero,
      ...createPayload,
      etapas: {
        create: defaultStages(),
      },
      events: {
        create: {
          type: 'CREATED',
          title: `Orden creada desde cotización ${cotizacion.numero}`,
          createdById: args.createdById,
          details: { sourceType: 'quotation', sourceId: cotizacion.id },
        },
      },
    },
    include: {
      cliente: true,
      cotizacion: { select: { id: true, numero: true } },
      posInvoice: { select: { id: true, numero: true } },
      etapas: true,
    },
  })

  return orden
}

export async function ensureWorkOrderFromInvoice(
  tx: Prisma.TransactionClient,
  args: {
    invoiceId: string
    empresaId: string
    sedeId: string
    createdById: string
    priority?: Prioridad | null
    force?: boolean
  }
) {
  const invoice = await tx.posInvoice.findFirst({
    where: { id: args.invoiceId, empresaId: args.empresaId, sedeId: args.sedeId },
    select: {
      id: true,
      numero: true,
      sedeId: true,
      clienteId: true,
      cotizacionId: true,
      clienteNombre: true,
      clienteDocumento: true,
      subtotal: true,
      discountAmount: true,
      iva: true,
      total: true,
      note: true,
      createdById: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          materialId: true,
          descripcion: true,
          quantity: true,
          unitPrice: true,
          total: true,
          material: {
            select: {
              nombre: true,
              unidadMedida: true,
              requiresWorkOrder: true,
              autoCreateWorkOrder: true,
            },
          },
        },
      },
    },
  })

  if (!invoice) {
    throw new Error('INVOICE_NOT_FOUND_FOR_WORK_ORDER')
  }

  if (invoice.cotizacionId) {
    return ensureWorkOrderFromQuote(tx, {
      cotizacionId: invoice.cotizacionId,
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      createdById: args.createdById,
      posInvoiceId: invoice.id,
      priority: args.priority,
      force: args.force,
    })
  }

  const snapshotItems = buildInvoiceSnapshotItems(invoice.items)
  if (!hasWorkOrderItems(snapshotItems, args.force)) return null

  const clienteId = invoice.clienteId
    ?? (await resolveClienteIdForPosInvoice(tx, {
      empresaId: args.empresaId,
      clienteDocumento: invoice.clienteDocumento,
      clienteNombre: invoice.clienteNombre,
    }))

  if (!clienteId) {
    throw new WorkOrderClientResolutionError()
  }

  const vendedorId = invoice.createdById ?? args.createdById
  const existing = await tx.ordenTrabajo.findFirst({
    where: { posInvoiceId: invoice.id },
    select: { id: true },
  })

  const createPayload = {
    sedeId: invoice.sedeId,
    clienteId,
    vendedorId,
    fechaInicio: new Date(),
    fechaEntrega: null,
    sourceType: 'invoice',
    sourceId: invoice.id,
    posInvoiceId: invoice.id,
    subtotal: invoice.subtotal,
    descuento: invoice.discountAmount,
    iva: invoice.iva,
    total: invoice.total,
    estado: 'PENDIENTE' as const,
    prioridad: normalizePriority(args.priority),
    observaciones: invoice.note,
    itemsSnapshot: snapshotItems as Prisma.InputJsonValue,
  }

  const syncPayload = {
    sedeId: invoice.sedeId,
    clienteId,
    vendedorId,
    sourceType: 'invoice',
    sourceId: invoice.id,
    posInvoiceId: invoice.id,
    subtotal: invoice.subtotal,
    descuento: invoice.discountAmount,
    iva: invoice.iva,
    total: invoice.total,
    prioridad: normalizePriority(args.priority),
    observaciones: invoice.note,
    itemsSnapshot: snapshotItems as Prisma.InputJsonValue,
  }

  await tx.posInvoice.update({
    where: { id: invoice.id },
    data: { clienteId },
    select: { id: true },
  })

  if (existing) {
    const orden = await tx.ordenTrabajo.update({
      where: { id: existing.id },
      data: syncPayload,
      include: {
        cliente: true,
        cotizacion: { select: { id: true, numero: true } },
        posInvoice: { select: { id: true, numero: true } },
        etapas: true,
      },
    })

    return orden
  }

  const numero = await getNextWorkOrderNumber(tx)

  const orden = await tx.ordenTrabajo.create({
    data: {
      numero,
      ...createPayload,
      etapas: {
        create: defaultStages(),
      },
      events: {
        create: {
          type: 'CREATED',
          title: `Orden creada desde factura ${invoice.numero}`,
          createdById: args.createdById,
          details: { sourceType: 'invoice', sourceId: invoice.id },
        },
      },
    },
    include: {
      cliente: true,
      cotizacion: { select: { id: true, numero: true } },
      posInvoice: { select: { id: true, numero: true } },
      etapas: true,
    },
  })

  return orden
}
