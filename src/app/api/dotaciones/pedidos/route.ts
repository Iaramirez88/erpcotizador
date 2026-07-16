import { NextResponse } from 'next/server'
import { DotacionPedidoItemStatus, DotacionPedidoStatus, EstadoCotizacion } from '@prisma/client'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type PedidoRowInput = {
  employeeId?: string | null
  employeeName?: string | null
  sedeId?: string | null
  sedeName?: string | null
  materialId?: string | null
  materialName?: string | null
  talla?: string | null
  color?: string | null
  quantity?: number | string | null
  note?: string | null
  selected?: boolean
  status?: string | null
  deliveredAt?: string | null
  remisionId?: string | null
  remisionNumero?: string | null
}

type PostBody = {
  id?: string | null
  clienteId?: string | null
  cotizacionId?: string | null
  warehouseId?: string | null
  title?: string | null
  batchNote?: string | null
  rows?: PedidoRowInput[] | null
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cleanQuantity(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function normalizeItemStatus(value: unknown): DotacionPedidoItemStatus {
  return value === DotacionPedidoItemStatus.REMITIDA ? DotacionPedidoItemStatus.REMITIDA : DotacionPedidoItemStatus.PENDIENTE
}

function computePedidoStatus(statuses: DotacionPedidoItemStatus[]): DotacionPedidoStatus {
  if (!statuses.length) return DotacionPedidoStatus.BORRADOR
  const delivered = statuses.filter((status) => status === DotacionPedidoItemStatus.REMITIDA).length
  if (delivered === 0) return DotacionPedidoStatus.EN_PREPARACION
  if (delivered === statuses.length) return DotacionPedidoStatus.ENTREGADA
  return DotacionPedidoStatus.ENTREGA_PARCIAL
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'DOTACIONES', action: 'UPDATE', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as PostBody | null
    const pedidoId = cleanText(body?.id)
    const clienteId = cleanText(body?.clienteId)
    const cotizacionId = cleanText(body?.cotizacionId)
    const warehouseId = cleanText(body?.warehouseId)
    const title = cleanText(body?.title)
    const batchNote = cleanText(body?.batchNote)
    const rows = Array.isArray(body?.rows) ? body.rows ?? [] : []

    let clienteNombre: string | null = null
    if (clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: clienteId, empresaId: access.empresaId },
        select: { nombre: true },
      })
      if (!cliente) {
        return NextResponse.json({ ok: false, error: 'Cliente no válido para este lote' }, { status: 400 })
      }
      clienteNombre = cliente.nombre
    }

    let cotizacionNumero: string | null = null
    let resolvedClienteId = clienteId
    if (cotizacionId) {
      const cotizacion = await prisma.cotizacion.findFirst({
        where: {
          id: cotizacionId,
          estado: EstadoCotizacion.APROBADA,
          OR: [{ sedeId: access.sedeId }, { sedeId: null }],
          cliente: { empresaId: access.empresaId },
        },
        select: { numero: true, clienteId: true, cliente: { select: { nombre: true } } },
      })
      if (!cotizacion) {
        return NextResponse.json({ ok: false, error: 'La cotización seleccionada no está aprobada o no pertenece a la empresa' }, { status: 400 })
      }
      cotizacionNumero = cotizacion.numero
      resolvedClienteId = resolvedClienteId || cotizacion.clienteId
      clienteNombre = clienteNombre || cotizacion.cliente.nombre
    }

    const normalizedRows = rows.map((row, index) => {
      const status = normalizeItemStatus(row?.status)
      return {
        employeeId: cleanText(row?.employeeId),
        employeeName: cleanText(row?.employeeName),
        sedeId: cleanText(row?.sedeId),
        sedeName: cleanText(row?.sedeName),
        materialId: cleanText(row?.materialId),
        materialName: cleanText(row?.materialName),
        talla: cleanText(row?.talla),
        color: cleanText(row?.color),
        quantity: cleanQuantity(row?.quantity),
        note: cleanText(row?.note),
        selected: row?.selected !== false,
        status,
        deliveredAt: row?.deliveredAt ? new Date(row.deliveredAt) : status === DotacionPedidoItemStatus.REMITIDA ? new Date() : null,
        remisionId: cleanText(row?.remisionId),
        remisionNumero: cleanText(row?.remisionNumero),
        sortOrder: index,
      }
    })

    const status = computePedidoStatus(normalizedRows.map((row) => row.status))
    const resolvedTitle = title || (cotizacionNumero ? `Dotación desde ${cotizacionNumero}` : clienteNombre ? `Lote de ${clienteNombre}` : 'Lote de dotación')

    const selectShape = {
      id: true,
      clienteId: true,
      clienteNombre: true,
      cotizacionId: true,
      cotizacionNumero: true,
      warehouseId: true,
      title: true,
      batchNote: true,
      status: true,
      updatedAt: true,
      items: {
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
        select: {
          id: true,
          employeeId: true,
          employeeName: true,
          sedeId: true,
          sedeName: true,
          materialId: true,
          materialName: true,
          talla: true,
          color: true,
          quantity: true,
          note: true,
          selected: true,
          status: true,
          deliveredAt: true,
          remisionId: true,
          remisionNumero: true,
        },
      },
    }

    const pedido = await prisma.$transaction(async (tx) => {
      if (pedidoId) {
        const existing = await tx.dotacionPedido.findFirst({
          where: { id: pedidoId, empresaId: access.empresaId, sedeId: access.sedeId },
          select: { id: true },
        })
        if (!existing) {
          throw new Error('PEDIDO_NOT_FOUND')
        }

        await tx.dotacionPedidoItem.deleteMany({ where: { pedidoId: existing.id } })

        return tx.dotacionPedido.update({
          where: { id: existing.id },
          data: {
            clienteId: resolvedClienteId,
            clienteNombre,
            cotizacionId,
            cotizacionNumero,
            warehouseId,
            title: resolvedTitle,
            batchNote,
            status,
            updatedById: access.userId,
            items: { create: normalizedRows },
          },
          select: selectShape,
        })
      }

      return tx.dotacionPedido.create({
        data: {
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          clienteId: resolvedClienteId,
          clienteNombre,
          cotizacionId,
          cotizacionNumero,
          warehouseId,
          title: resolvedTitle,
          batchNote,
          status,
          createdById: access.userId,
          updatedById: access.userId,
          items: { create: normalizedRows },
        },
        select: selectShape,
      })
    })

    const deliveredCount = pedido.items.filter((item) => item.status === DotacionPedidoItemStatus.REMITIDA).length

    return NextResponse.json({
      ok: true,
      data: {
        ...pedido,
        itemCount: pedido.items.length,
        deliveredCount,
        pendingCount: pedido.items.length - deliveredCount,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PEDIDO_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'El lote ya no existe o no pertenece a tu sede' }, { status: 404 })
    }
    console.error('POST /api/dotaciones/pedidos error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el lote de dotación' }, { status: 500 })
  }
}