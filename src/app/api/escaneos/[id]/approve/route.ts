/**
 * API Route: Aprobar escaneo
 * POST /api/escaneos/:id/approve
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
    if (!access.ok) return access.response

    const userId = access.userId

    const { id } = await context.params

    const scan = await prisma.documentScan.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!scan) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    }

    // Requerir confirmación de campos mínimos (si ya hay extractedData).
    const extracted = scan.extractedData ?? null
    if (extracted && typeof extracted === "object") {
      const confirmation = (extracted as Record<string, unknown>).confirmation
      const fields = confirmation && typeof confirmation === "object"
        ? (confirmation as Record<string, unknown>).fields
        : null

      const required = ["vendor.nit", "invoice.number", "monetary.total"]
      const missing = required.filter((p) => {
        if (!fields || typeof fields !== "object") return true
        const entry = (fields as Record<string, unknown>)[p]
        if (!entry || typeof entry !== "object") return true
        return (entry as Record<string, unknown>).confirmed !== true
      })

      if (missing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Faltan campos por confirmar antes de aprobar",
            details: { missing },
          },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.documentScan.update({
      where: { id },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedById: userId,
        status: "APROBADO",
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Error al aprobar escaneo:", error)
    return NextResponse.json({ success: false, error: "Error al aprobar escaneo" }, { status: 500 })
  }
}
