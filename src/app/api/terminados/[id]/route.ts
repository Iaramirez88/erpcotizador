/**
 * API Route: Terminados (catálogo de acabados)
 * PUT /api/terminados/:id - Actualiza terminado
 * DELETE /api/terminados/:id - Elimina terminado
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

function normalizeUnidadAplicacion(value: unknown): "m2" | "ml" | "unidad" {
  const v = String(value ?? "").trim().toLowerCase()
  if (v === "m2" || v === "m²") return "m2"
  if (v === "ml" || v === "m" || v === "metro") return "ml"
  return "unidad"
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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, "WRITE")
    if (!access.ok) return access.response

    const { id } = await params
    const body = await request.json().catch(() => null)

    const empresaId = await getOrCreateEmpresaId()

    const existing = await prisma.terminado.findFirst({ where: { id, empresaId }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    const nombre = body?.nombre !== undefined ? String(body.nombre ?? "").trim() : undefined
    const unidadAplicacion = body?.unidadAplicacion !== undefined ? normalizeUnidadAplicacion(body.unidadAplicacion) : undefined
    const precioUnitario = body?.precioUnitario !== undefined ? Number(body.precioUnitario ?? 0) : undefined
    const activo = body?.activo !== undefined ? (body.activo === false ? false : true) : undefined

    const terminado = await prisma.terminado.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(unidadAplicacion !== undefined ? { unidadAplicacion } : {}),
        ...(precioUnitario !== undefined ? { precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : 0 } : {}),
        ...(activo !== undefined ? { activo } : {}),
      },
    })

    return NextResponse.json({ success: true, data: terminado })
  } catch (error) {
    console.error("Error al actualizar terminado:", error)
    return NextResponse.json({ error: "Error al actualizar terminado" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, "WRITE")
    if (!access.ok) return access.response

    const { id } = await params
    const empresaId = await getOrCreateEmpresaId()

    const existing = await prisma.terminado.findFirst({ where: { id, empresaId }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    await prisma.terminado.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar terminado:", error)
    return NextResponse.json({ error: "Error al eliminar terminado" }, { status: 500 })
  }
}
