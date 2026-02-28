/**
 * API Route: Materiales - Borrado masivo
 * POST /api/materiales/bulk-delete
 *
 * - { scope: "ids", ids: string[] }
 * - { scope: "all" }
 *
 * Nota: por coherencia con DELETE /api/materiales/[id],
 * no se eliminan materiales usados en cotizaciones (items).
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

type Body =
  | { scope: "ids"; ids: unknown }
  | { scope: "all" }
  | { scope?: unknown; ids?: unknown }

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, "WRITE")
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const body = (await request.json().catch(() => null)) as Body | null
    const scope = typeof body?.scope === "string" ? body.scope : ""

    if (scope !== "ids" && scope !== "all") {
      return NextResponse.json({ success: false, error: "Payload inválido" }, { status: 400 })
    }

    if (scope === "all") {
      const [total, skippedUsed, del] = await prisma.$transaction([
        prisma.material.count({ where: { empresaId } }),
        prisma.material.count({ where: { empresaId, items: { some: {} } } }),
        prisma.material.deleteMany({ where: { empresaId, items: { none: {} } } }),
      ])

      return NextResponse.json({
        success: true,
        total,
        deleted: del.count,
        skippedUsed,
      })
    }

    // scope === "ids"
    const ids = Array.from(new Set(asStringArray((body as { ids?: unknown })?.ids)))
    if (!ids.length) {
      return NextResponse.json({ success: false, error: "Debes enviar ids" }, { status: 400 })
    }

    const [existing, skippedUsed, del] = await prisma.$transaction([
      prisma.material.count({ where: { empresaId, id: { in: ids } } }),
      prisma.material.count({ where: { empresaId, id: { in: ids }, items: { some: {} } } }),
      prisma.material.deleteMany({ where: { empresaId, id: { in: ids }, items: { none: {} } } }),
    ])

    const notFound = Math.max(0, ids.length - existing)

    return NextResponse.json({
      success: true,
      requested: ids.length,
      existing,
      notFound,
      deleted: del.count,
      skippedUsed,
    })
  } catch (error) {
    console.error("Error en bulk-delete materiales:", error)
    return NextResponse.json({ success: false, error: "Error al eliminar por lote" }, { status: 500 })
  }
}
