/**
 * API Route: Compras
 * GET /api/compras?search=&estado=&autorizado=&sede=&from=&to=
 * POST /api/compras
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { EstadoCompra } from "@prisma/client"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

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

function n(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseEstadoCompra(value: unknown): EstadoCompra | undefined {
  const v = String(value || "").trim()
  if (v === "BORRADOR" || v === "REGISTRADA" || v === "ANULADA") return v
  return undefined
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

  const subtotalConIva = subtotalSinIva + iva
  return { subtotalSinIva, iva, descuentoTotal, subtotalConIva, total }
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<{ empresaId: string; sedeNombre?: string | null } | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true, nombre: true } })
  if (!sede?.empresaId) return null
  return { empresaId: sede.empresaId, sedeNombre: sede.nombre }
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'READ')
    if (!access.ok) return access.response

    const userId = access.userId

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") || "").trim()
    const estado = (searchParams.get("estado") || "").trim()
    const autorizado = (searchParams.get("autorizado") || "").trim()
    const sede = (searchParams.get("sede") || "").trim()
    const from = (searchParams.get("from") || "").trim()
    const to = (searchParams.get("to") || "").trim()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId, sedeId: access.sedeId }

    if (search) {
      where.OR = [
        { proveedorNombre: { contains: search, mode: "insensitive" as const } },
        { numeroFactura: { contains: search, mode: "insensitive" as const } },
        { numeroPedido: { contains: search, mode: "insensitive" as const } },
        { numeroOrden: { contains: search, mode: "insensitive" as const } },
        { observaciones: { contains: search, mode: "insensitive" as const } },
      ]
    }

    if (estado) where.estado = estado
    if (sede) where.sede = { contains: sede, mode: "insensitive" as const }
    if (autorizado) where.autorizado = autorizado === "true"

    if (from || to) {
      where.fechaCompra = {}
      if (from) where.fechaCompra.gte = new Date(from)
      if (to) where.fechaCompra.lte = new Date(to)
    }

    const compras = await prisma.compra.findMany({
      where,
      include: {
        items: { orderBy: { orden: "asc" } },
      },
      orderBy: { fechaCompra: "desc" },
    })

    return NextResponse.json({ success: true, data: compras })
  } catch (error) {
    console.error("Error al obtener compras:", error)
    return NextResponse.json({ error: "Error al obtener compras" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'WRITE')
    if (!access.ok) return access.response

    const userId = access.userId

    const body = await request.json().catch(() => ({}))

    const proveedorNombre = String(body?.proveedorNombre || "").trim()
    if (!proveedorNombre) {
      return NextResponse.json({ error: "El nombre del proveedor es requerido" }, { status: 400 })
    }

    const fechaCompra = body?.fechaCompra ? new Date(String(body.fechaCompra)) : new Date()

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

    const totals = computeTotals(items)

    const sedeCtx = await getEmpresaIdFromSedeId(access.sedeId)
    if (!sedeCtx) {
      return NextResponse.json({ error: 'No se pudo resolver la empresa de la sede activa' }, { status: 400 })
    }

    const empresaId = sedeCtx.empresaId

    const estadoParsed = body?.estado ? parseEstadoCompra(body.estado) : undefined
    if (body?.estado && !estadoParsed) {
      return NextResponse.json({ error: "Estado inválido. Usa BORRADOR, REGISTRADA o ANULADA" }, { status: 400 })
    }

    const compra = await prisma.compra.create({
      data: {
        fechaCompra,
        estado: estadoParsed,

        sedeId: access.sedeId,

        proveedorId: body?.proveedorId ? String(body.proveedorId) : null,
        proveedorNombre,
        proveedorTelefono: body?.proveedorTelefono ? String(body.proveedorTelefono) : null,
        proveedorDireccion: body?.proveedorDireccion ? String(body.proveedorDireccion) : null,

        recibidoPorId: body?.recibidoPorId ? String(body.recibidoPorId) : null,
        recibidoPorNombre: body?.recibidoPorNombre ? String(body.recibidoPorNombre) : null,

        numeroPedido: body?.numeroPedido ? String(body.numeroPedido) : null,
        numeroOrden: body?.numeroOrden ? String(body.numeroOrden) : null,
        numeroFactura: body?.numeroFactura ? String(body.numeroFactura) : null,

        subtotalSinIva: n(body?.subtotalSinIva, totals.subtotalSinIva),
        iva: n(body?.iva, totals.iva),
        descuentoTotal: n(body?.descuentoTotal, totals.descuentoTotal),
        subtotalConIva: n(body?.subtotalConIva, totals.subtotalConIva),
        total: n(body?.total, totals.total),

        sede: body?.sede ? String(body.sede) : (sedeCtx.sedeNombre ?? null),
        observaciones: body?.observaciones ? String(body.observaciones) : null,

        autorizado: body?.autorizado === true,
        autorizadoAt: body?.autorizadoAt ? new Date(String(body.autorizadoAt)) : null,
        autorizadoById: body?.autorizadoById ? String(body.autorizadoById) : null,

        userId,
        empresaId,

        items: {
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
        },
      },
      include: { items: { orderBy: { orden: "asc" } } },
    })

    return NextResponse.json({ success: true, data: compra }, { status: 201 })
  } catch (error) {
    console.error("Error al crear compra:", error)
    return NextResponse.json({ error: "Error al crear compra" }, { status: 500 })
  }
}
