/**
 * API Route: Compra por ID
 * GET /api/compras/:id
 * PATCH /api/compras/:id
 * DELETE /api/compras/:id
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { EstadoCompra } from "@prisma/client"
import { requireCapabilityAccess } from "@/lib/api-rbac"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

function n(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseEstadoCompra(value: unknown): EstadoCompra | undefined {
  const v = String(value || "").trim()
  if (v === "BORRADOR" || v === "REGISTRADA" || v === "ANULADA") return v
  return undefined
}

type CompraItemInput = {
  descripcion: string
  cantidad?: number
  unidad?: string | null
  precioUnitario?: number
  descuento?: number
  subtotalSinIva?: number
  iva?: number
  total?: number
  observaciones?: string | null
  orden?: number
}

function computeTotals(items: CompraItemInput[]) {
  let subtotalSinIva = 0
  let iva = 0
  let descuentoTotal = 0
  let total = 0

  for (const it of items) {
    const cantidad = n(it.cantidad, 1)
    const precio = n(it.precioUnitario, 0)
    const descuento = n(it.descuento, 0)
    const lineBase = Math.max(0, cantidad * precio - descuento)
    const lineIva = n(it.iva, 0)
    const lineTotal = n(it.total, lineBase + lineIva)

    subtotalSinIva += n(it.subtotalSinIva, lineBase)
    iva += lineIva
    descuentoTotal += descuento
    total += lineTotal
  }

  return { subtotalSinIva, iva, descuentoTotal, subtotalConIva: subtotalSinIva + iva, total }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'RECURSOS',
      subdomain: 'PURCHASES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const empresaId = access.empresaId

    const compra = await prisma.compra.findUnique({
      where: { id },
      include: { items: { orderBy: { orden: "asc" } } },
    })

    if (!compra) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    if (compra.empresaId !== empresaId) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

    return NextResponse.json({ success: true, data: compra })
  } catch (error) {
    console.error("Error al obtener compra:", error)
    return NextResponse.json({ error: "Error al obtener compra" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'RECURSOS',
      subdomain: 'PURCHASES',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const empresaId = access.empresaId
    const body = await request.json().catch(() => ({}))
    const itemsIn: CompraItemInput[] = Array.isArray(body?.items) ? body.items : []
    const items = itemsIn
      .filter((it) => it && typeof it === "object")
      .map((it, idx) => ({
        descripcion: String(it.descripcion || "").trim(),
        cantidad: n(it.cantidad, 1),
        unidad: it.unidad ? String(it.unidad) : null,
        precioUnitario: n(it.precioUnitario, 0),
        descuento: n(it.descuento, 0),
        subtotalSinIva: n(it.subtotalSinIva, 0),
        iva: n(it.iva, 0),
        total: n(it.total, 0),
        observaciones: it.observaciones ? String(it.observaciones) : null,
        orden: Number.isFinite(Number(it.orden)) ? Number(it.orden) : idx,
      }))
      .filter((it) => it.descripcion)

    const hasItemsUpdate = Array.isArray(body?.items)
    const totals = hasItemsUpdate ? computeTotals(items) : null

    const estadoParsed = body?.estado !== undefined ? parseEstadoCompra(body.estado) : undefined
    if (body?.estado !== undefined && !estadoParsed) {
      return NextResponse.json({ error: "Estado inválido. Usa BORRADOR, REGISTRADA o ANULADA" }, { status: 400 })
    }

    const compraExistente = await prisma.compra.findUnique({
      where: { id },
      select: { id: true, empresaId: true },
    })

    if (!compraExistente || compraExistente.empresaId !== empresaId) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    }

    const compra = await prisma.$transaction(async (tx) => {
      if (hasItemsUpdate) {
        await tx.compraItem.deleteMany({ where: { compraId: id } })
      }

      return tx.compra.update({
        where: { id },
        data: {
          fechaCompra: body?.fechaCompra !== undefined ? new Date(String(body.fechaCompra)) : undefined,
          estado: estadoParsed,

          proveedorId: body?.proveedorId !== undefined ? (body.proveedorId ? String(body.proveedorId) : null) : undefined,
          proveedorNombre: body?.proveedorNombre !== undefined ? String(body.proveedorNombre).trim() : undefined,
          proveedorTelefono: body?.proveedorTelefono !== undefined ? (body.proveedorTelefono ? String(body.proveedorTelefono) : null) : undefined,
          proveedorDireccion: body?.proveedorDireccion !== undefined ? (body.proveedorDireccion ? String(body.proveedorDireccion) : null) : undefined,

          recibidoPorId: body?.recibidoPorId !== undefined ? (body.recibidoPorId ? String(body.recibidoPorId) : null) : undefined,
          recibidoPorNombre: body?.recibidoPorNombre !== undefined ? (body.recibidoPorNombre ? String(body.recibidoPorNombre) : null) : undefined,

          numeroPedido: body?.numeroPedido !== undefined ? (body.numeroPedido ? String(body.numeroPedido) : null) : undefined,
          numeroOrden: body?.numeroOrden !== undefined ? (body.numeroOrden ? String(body.numeroOrden) : null) : undefined,
          numeroFactura: body?.numeroFactura !== undefined ? (body.numeroFactura ? String(body.numeroFactura) : null) : undefined,

          subtotalSinIva: hasItemsUpdate ? totals?.subtotalSinIva : body?.subtotalSinIva !== undefined ? n(body.subtotalSinIva) : undefined,
          iva: hasItemsUpdate ? totals?.iva : body?.iva !== undefined ? n(body.iva) : undefined,
          descuentoTotal: hasItemsUpdate ? totals?.descuentoTotal : body?.descuentoTotal !== undefined ? n(body.descuentoTotal) : undefined,
          subtotalConIva: hasItemsUpdate ? totals?.subtotalConIva : body?.subtotalConIva !== undefined ? n(body.subtotalConIva) : undefined,
          total: hasItemsUpdate ? totals?.total : body?.total !== undefined ? n(body.total) : undefined,

          sede: body?.sede !== undefined ? (body.sede ? String(body.sede) : null) : undefined,
          observaciones: body?.observaciones !== undefined ? (body.observaciones ? String(body.observaciones) : null) : undefined,

          autorizado: body?.autorizado !== undefined ? Boolean(body.autorizado) : undefined,
          autorizadoAt: body?.autorizadoAt !== undefined ? (body.autorizadoAt ? new Date(String(body.autorizadoAt)) : null) : undefined,
          autorizadoById: body?.autorizadoById !== undefined ? (body.autorizadoById ? String(body.autorizadoById) : null) : undefined,

          items: hasItemsUpdate
            ? {
                create: items.map((it) => ({
                  descripcion: it.descripcion,
                  cantidad: it.cantidad,
                  unidad: it.unidad,
                  precioUnitario: it.precioUnitario,
                  descuento: it.descuento,
                  subtotalSinIva: it.subtotalSinIva,
                  iva: it.iva,
                  total: it.total,
                  observaciones: it.observaciones,
                  orden: it.orden,
                })),
              }
            : undefined,
        },
        include: { items: { orderBy: { orden: "asc" } } },
      })
    })

    return NextResponse.json({ success: true, data: compra })
  } catch (error) {
    console.error("Error al actualizar compra:", error)
    return NextResponse.json({ error: "Error al actualizar compra" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'RECURSOS',
      subdomain: 'PURCHASES',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const empresaId = access.empresaId

    const compra = await prisma.compra.findUnique({
      where: { id },
      select: { id: true, empresaId: true },
    })

    if (!compra || compra.empresaId !== empresaId) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    }

    await prisma.compra.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar compra:", error)
    return NextResponse.json({ error: "Error al eliminar compra" }, { status: 500 })
  }
}
