/**
 * POST /api/escaneos/:id/to-cotizacion
 * Crea una Cotización (BORRADOR) a partir de un escaneo aprobado y con destino COTIZACION.
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
  const num =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^0-9,.-]/g, "").replace(/,(?=\d{3}\b)/g, ""))
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

async function getOrCreateEmpresaIdForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  let empresa = await prisma.empresa.findFirst({ select: { id: true } })
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: { nombre: "SGDigital", nit: "900000000-1" },
      select: { id: true },
    })
  }

  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
}

async function nextCotizacionNumero(tx: Prisma.TransactionClient) {
  const last = await tx.cotizacion.findFirst({ orderBy: { createdAt: "desc" }, select: { numero: true } })
  let seq = 1
  if (last?.numero) {
    const match = last.numero.match(/COT-(\d+)/)
    if (match) seq = Number.parseInt(match[1], 10) + 1
  }
  return `COT-${String(seq).padStart(5, "0")}`
}

function normalizeDocumento(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export async function POST(_request: Request, context: RouteContext) {
  const accessScan = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
  if (!accessScan.ok) return accessScan.response
  const accessCotizaciones = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
  if (!accessCotizaciones.ok) return accessCotizaciones.response

  const userId = accessScan.userId

  const { id } = await context.params
  const scan = await prisma.documentScan.findFirst({ where: { id, userId } })
  if (!scan) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

  if (!scan.approved) {
    return NextResponse.json(
      { success: false, error: "El escaneo debe estar aprobado antes de crear la cotización." },
      { status: 400 }
    )
  }

  const extractedObj = asPlainObject(scan.extractedData ?? {})
  const workflow = asPlainObject(extractedObj.workflow)
  const target = String(workflow.target || "").toUpperCase()
  if (target !== "COTIZACION") {
    return NextResponse.json(
      { success: false, error: "Destino no es COTIZACION. Selecciona 'Cotización'." },
      { status: 400 }
    )
  }

  const existingId = String(workflow.createdCotizacionId || "").trim()
  if (existingId) {
    return NextResponse.json(
      { success: false, error: `Este escaneo ya generó una cotización (${existingId}).` },
      { status: 400 }
    )
  }

  const semantic = asPlainObject(extractedObj.semantic)
  const structured = asPlainObject(semantic.structured)

  const customerName = String(getAtPath(structured, "customer.name") || "").trim()
  const customerDoc = normalizeDocumento(String(getAtPath(structured, "customer.nit") || getAtPath(structured, "customer.document") || ""))

  const subtotal = n(getAtPath(structured, "monetary.subtotal"), 0)
  const iva = n(getAtPath(structured, "monetary.taxTotal"), 0)
  const total = n(getAtPath(structured, "monetary.total"), subtotal + iva)

  const itemsRaw = getAtPath(structured, "items")
  const itemsArray = Array.isArray(itemsRaw) ? itemsRaw : []

  const items = itemsArray
    .filter((x) => x && typeof x === "object")
    .map((x, idx) => {
      const obj = x as Record<string, unknown>
      const descripcion = String(obj.description || obj.descripcion || obj.name || "").trim() || `Ítem ${idx + 1}`
      const cantidad = n(obj.quantity ?? obj.cantidad, 1)
      const precioUnitario = n(obj.unitPrice ?? obj.precioUnitario ?? obj.price, 0)
      const lineSubtotal = n(obj.subtotal, Math.max(0, cantidad * precioUnitario))
      return {
        descripcion,
        cantidad,
        precioUnitario,
        subtotal: n(obj.total, lineSubtotal),
        orden: idx,
      }
    })

  const empresaId = await getOrCreateEmpresaIdForUser(userId)

  const result = await prisma.$transaction(async (tx) => {
    const numero = await nextCotizacionNumero(tx)

    const documento = customerDoc || `PENDIENTE-${scan.id.slice(0, 8)}`
    const nombre = customerName || "Cliente (pendiente)"

    const cliente = await tx.cliente.upsert({
      where: { documento },
      create: {
        nombre,
        tipoDocumento: customerDoc ? "NIT" : "NIT",
        documento,
        empresaId,
      },
      update: {
        nombre: customerName ? nombre : undefined,
      },
      select: { id: true, nombre: true, documento: true },
    })

    const cotizacion = await tx.cotizacion.create({
      data: {
        numero,
        clienteId: cliente.id,
        vendedorId: userId,
        subtotal,
        descuento: 0,
        iva,
        total,
        validezDias: 15,
        estado: "BORRADOR",
        observaciones: `Creada desde escaneo ${scan.id}${scan.originalFileName ? ` (${scan.originalFileName})` : ""}`,
        items: {
          create:
            items.length > 0
              ? items.map((it) => ({
                  descripcion: it.descripcion,
                  cantidad: it.cantidad,
                  unidad: "unidad",
                  precioUnitario: it.precioUnitario,
                  subtotal: it.subtotal,
                  orden: it.orden,
                }))
              : [
                  {
                    descripcion: "Cotización (pendiente de detallar)",
                    cantidad: 1,
                    unidad: "unidad",
                    precioUnitario: total,
                    subtotal: total,
                    orden: 0,
                  },
                ],
        },
      },
      include: { cliente: true, items: true },
    })

    const nextExtracted = { ...extractedObj }
    const nextWorkflow = { ...workflow }
    nextWorkflow.createdCotizacionId = cotizacion.id
    nextWorkflow.createdCotizacionAt = new Date().toISOString()
    nextWorkflow.createdClienteId = cliente.id
    nextExtracted.workflow = nextWorkflow

    await tx.documentScan.update({
      where: { id: scan.id },
      data: { extractedData: nextExtracted as Prisma.InputJsonValue },
    })

    return cotizacion
  })

  return NextResponse.json({ success: true, data: { cotizacion: result, scanId: scan.id } }, { status: 201 })
}
