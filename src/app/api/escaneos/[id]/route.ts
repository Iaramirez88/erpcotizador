/**
 * API Route: Escaneo por ID
 * GET /api/escaneos/:id
 * DELETE /api/escaneos/:id
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deleteScanObject } from "@/lib/scan-storage"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.ESCANEOS, 'READ')
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

    return NextResponse.json({ success: true, data: scan })
  } catch (error) {
    console.error("Error al obtener escaneo:", error)
    return NextResponse.json({ success: false, error: "Error al obtener escaneo" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
    if (!access.ok) return access.response

    const userId = access.userId

    const { id } = await context.params

    const scan = await prisma.documentScan.findFirst({
      where: { id, userId },
      select: { id: true, storedFileName: true, fileUrl: true },
    })

    if (!scan) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    }

    await prisma.documentScan.delete({ where: { id: scan.id } })
    await deleteScanObject({ storedFileName: scan.storedFileName, fileUrl: scan.fileUrl })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar escaneo:", error)
    return NextResponse.json({ success: false, error: "Error al eliminar escaneo" }, { status: 500 })
  }
}
