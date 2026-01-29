/**
 * API Route: Terminados (catálogo de acabados)
 * GET /api/terminados - Lista terminados
 * POST /api/terminados - Crea terminado
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

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, "READ")
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")

    const empresaId = await getOrCreateEmpresaId()

    const where = {
      empresaId,
      ...(search
        ? {
            OR: [{ nombre: { contains: search, mode: "insensitive" as const } }],
          }
        : {}),
    }

    const terminados = await prisma.terminado.findMany({
      where,
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        unidadAplicacion: true,
        precioUnitario: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: terminados })
  } catch (error) {
    console.error("Error al obtener terminados:", error)
    return NextResponse.json({ error: "Error al obtener terminados" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, "WRITE")
    if (!access.ok) return access.response

    const body = await request.json().catch(() => null)
    const nombre = String(body?.nombre ?? "").trim()
    const unidadAplicacion = normalizeUnidadAplicacion(body?.unidadAplicacion)
    const precioUnitario = Number(body?.precioUnitario ?? 0)
    const activo = body?.activo === false ? false : true

    if (!nombre) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 })
    }

    const empresaId = await getOrCreateEmpresaId()

    const terminado = await prisma.terminado.create({
      data: {
        nombre,
        unidadAplicacion,
        precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : 0,
        activo,
        empresaId,
      },
    })

    return NextResponse.json({ success: true, data: terminado }, { status: 201 })
  } catch (error) {
    console.error("Error al crear terminado:", error)
    return NextResponse.json({ error: "Error al crear terminado" }, { status: 500 })
  }
}
