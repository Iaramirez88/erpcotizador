/**
 * POST /api/compras/:id/autorizar
 * Body: { autorizado: boolean }
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    const autorizado = Boolean(body?.autorizado)

    const compra = await prisma.compra.update({
      where: { id },
      data: {
        autorizado,
        autorizadoAt: autorizado ? new Date() : null,
        autorizadoById: autorizado ? String(access.userId) : null,
      },
    })

    return NextResponse.json({ success: true, data: compra })
  } catch (error) {
    console.error("Error al autorizar compra:", error)
    return NextResponse.json({ error: "Error al autorizar compra" }, { status: 500 })
  }
}
