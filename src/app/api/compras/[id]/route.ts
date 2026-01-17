/**
 * API Route: Compra por ID
 * GET /api/compras/:id
 * PATCH /api/compras/:id
 * DELETE /api/compras/:id
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { EstadoCompra } from "@prisma/client"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params

    const compra = await prisma.compra.findUnique({
      where: { id },
      include: { items: { orderBy: { orden: "asc" } } },
    })

    if (!compra) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

    return NextResponse.json({ success: true, data: compra })
  } catch (error) {
    console.error("Error al obtener compra:", error)
    return NextResponse.json({ error: "Error al obtener compra" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    const estadoParsed = body?.estado !== undefined ? parseEstadoCompra(body.estado) : undefined
    if (body?.estado !== undefined && !estadoParsed) {
      return NextResponse.json({ error: "Estado inválido. Usa BORRADOR, REGISTRADA o ANULADA" }, { status: 400 })
    }

    const compra = await prisma.compra.update({
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

        subtotalSinIva: body?.subtotalSinIva !== undefined ? n(body.subtotalSinIva) : undefined,
        iva: body?.iva !== undefined ? n(body.iva) : undefined,
        descuentoTotal: body?.descuentoTotal !== undefined ? n(body.descuentoTotal) : undefined,
        subtotalConIva: body?.subtotalConIva !== undefined ? n(body.subtotalConIva) : undefined,
        total: body?.total !== undefined ? n(body.total) : undefined,

        sede: body?.sede !== undefined ? (body.sede ? String(body.sede) : null) : undefined,
        observaciones: body?.observaciones !== undefined ? (body.observaciones ? String(body.observaciones) : null) : undefined,

        autorizado: body?.autorizado !== undefined ? Boolean(body.autorizado) : undefined,
        autorizadoAt: body?.autorizadoAt !== undefined ? (body.autorizadoAt ? new Date(String(body.autorizadoAt)) : null) : undefined,
        autorizadoById: body?.autorizadoById !== undefined ? (body.autorizadoById ? String(body.autorizadoById) : null) : undefined,
      },
      include: { items: { orderBy: { orden: "asc" } } },
    })

    return NextResponse.json({ success: true, data: compra })
  } catch (error) {
    console.error("Error al actualizar compra:", error)
    return NextResponse.json({ error: "Error al actualizar compra" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    await prisma.compra.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar compra:", error)
    return NextResponse.json({ error: "Error al eliminar compra" }, { status: 500 })
  }
}
