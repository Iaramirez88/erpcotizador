/**
 * POST /api/escaneos/:id/to-compra
 * Crea una Compra a partir de un escaneo aprobado y con destino COMPRA.
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

function asPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function n(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9,.-]/g, "").replace(/,(?=\d{3}\b)/g, ""))
  return Number.isFinite(num) ? num : fallback
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

async function getOrCreateEmpresaId() {
  let empresa = await prisma.empresa.findFirst({ select: { id: true } })
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: { nombre: "SGDigital", nit: "900000000-1" },
      select: { id: true },
    })
  }
  return empresa.id
}

export async function POST(_request: Request, context: RouteContext) {
  const accessScan = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
  if (!accessScan.ok) return accessScan.response
  const accessCompras = await requireApiAccess(ModuleKey.COMPRAS, 'WRITE')
  if (!accessCompras.ok) return accessCompras.response

  const userId = accessScan.userId

  const { id } = await context.params
  const scan = await prisma.documentScan.findFirst({ where: { id, userId } })
  if (!scan) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

  if (!scan.approved) {
    return NextResponse.json({ success: false, error: "El escaneo debe estar aprobado antes de crear la compra." }, { status: 400 })
  }

  const extractedObj = asPlainObject(scan.extractedData ?? {})
  const workflow = asPlainObject(extractedObj.workflow)
  const target = String(workflow.target || "").toUpperCase()
  if (target !== "COMPRA") {
    return NextResponse.json({ success: false, error: "Destino no es COMPRA. Selecciona 'Factura de compra'." }, { status: 400 })
  }

  const existingCompraId = String(workflow.createdCompraId || "").trim()
  if (existingCompraId) {
    return NextResponse.json(
      { success: false, error: `Este escaneo ya generó una compra (${existingCompraId}).` },
      { status: 400 }
    )
  }

  const semantic = asPlainObject(extractedObj.semantic)
  const structured = asPlainObject(semantic.structured)

  const proveedorNombre = String(getAtPath(structured, "vendor.name") || "").trim()
  const fechaRaw = String(getAtPath(structured, "invoice.date") || "").trim()
  const numeroFactura = String(getAtPath(structured, "invoice.number") || "").trim()

  const subtotal = n(getAtPath(structured, "monetary.subtotal"), 0)
  const iva = n(getAtPath(structured, "monetary.taxTotal"), 0)
  const total = n(getAtPath(structured, "monetary.total"), subtotal + iva)

  const fechaCompra = fechaRaw ? new Date(fechaRaw) : new Date()

  const itemsRaw = getAtPath(structured, "items")
  const itemsArray = Array.isArray(itemsRaw) ? itemsRaw : []

  const items = itemsArray
    .filter((x) => x && typeof x === "object")
    .map((x, idx) => {
      const obj = x as Record<string, unknown>
      const descripcion = String(obj.description || obj.descripcion || obj.name || "").trim() || `Ítem ${idx + 1}`
      const cantidad = n(obj.quantity ?? obj.cantidad, 1)
      const precioUnitario = n(obj.unitPrice ?? obj.precioUnitario ?? obj.price, 0)
      const descuento = n(obj.discount ?? obj.descuento, 0)
      const lineSubtotal = n(obj.subtotal ?? obj.subtotalSinIva, Math.max(0, cantidad * precioUnitario - descuento))
      const lineIva = n(obj.tax ?? obj.iva, 0)
      const lineTotal = n(obj.total, lineSubtotal + lineIva)
      return {
        descripcion,
        cantidad,
        precioUnitario,
        descuento,
        subtotalSinIva: lineSubtotal,
        iva: lineIva,
        total: lineTotal,
        orden: idx,
      }
    })

  const computed = items.length
    ? items.reduce(
        (acc, it) => {
          acc.subtotalSinIva += it.subtotalSinIva
          acc.iva += it.iva
          acc.descuentoTotal += it.descuento
          acc.total += it.total
          return acc
        },
        { subtotalSinIva: 0, iva: 0, descuentoTotal: 0, total: 0 }
      )
    : { subtotalSinIva: subtotal, iva, descuentoTotal: 0, total }

  const subtotalConIva = computed.subtotalSinIva + computed.iva

  const empresaId = await getOrCreateEmpresaId()

  const result = await prisma.$transaction(async (tx) => {
    const compra = await tx.compra.create({
      data: {
        fechaCompra,
        proveedorNombre: proveedorNombre || "Proveedor (pendiente)",
        numeroFactura: numeroFactura || null,
        subtotalSinIva: computed.subtotalSinIva,
        iva: computed.iva,
        descuentoTotal: computed.descuentoTotal,
        subtotalConIva,
        total: computed.total,
        observaciones: `Creada desde escaneo ${scan.id}${scan.originalFileName ? ` (${scan.originalFileName})` : ""}`,
        userId,
        empresaId,
        items: {
          create:
            items.length > 0
              ? items.map((it) => ({
                  descripcion: it.descripcion,
                  cantidad: it.cantidad,
                  precioUnitario: it.precioUnitario,
                  descuento: it.descuento,
                  subtotalSinIva: it.subtotalSinIva,
                  iva: it.iva,
                  total: it.total,
                  orden: it.orden,
                }))
              : [
                  {
                    descripcion: numeroFactura ? `Factura ${numeroFactura}` : "Compra",
                    cantidad: 1,
                    precioUnitario: computed.total,
                    descuento: 0,
                    subtotalSinIva: computed.subtotalSinIva,
                    iva: computed.iva,
                    total: computed.total,
                    orden: 0,
                  },
                ],
        },
      },
      include: { items: { orderBy: { orden: "asc" } } },
    })

    const nextExtracted = { ...extractedObj }
    const nextWorkflow = { ...workflow }
    nextWorkflow.createdCompraId = compra.id
    nextWorkflow.createdCompraAt = new Date().toISOString()
    nextExtracted.workflow = nextWorkflow

    await tx.documentScan.update({
      where: { id: scan.id },
      data: { extractedData: nextExtracted as Prisma.InputJsonValue },
    })

    return compra
  })

  return NextResponse.json({ success: true, data: { compra: result, scanId: scan.id } }, { status: 201 })
}
