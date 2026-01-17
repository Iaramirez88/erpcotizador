/**
 * POST /api/escaneos/:id/destino
 * Body: { target: 'COMPRA' | 'VENTA' | 'COTIZACION' | 'OTRO' }
 *
 * Guarda el destino del escaneo en extractedData.workflow.target y ajusta `tipo` (FACTURA/COTIZACION)
 * cuando aplique.
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

type Target = "COMPRA" | "VENTA" | "COTIZACION" | "OTRO"

type DbScanTipo = "FACTURA" | "COTIZACION"

interface RouteContext {
  params: Promise<{ id: string }>
}

function asPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function parseTarget(value: unknown): Target | null {
  const v = String(value || "").trim().toUpperCase()
  if (v === "COMPRA" || v === "VENTA" || v === "COTIZACION" || v === "OTRO") return v
  return null
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
  if (!access.ok) return access.response

  const userId = access.userId

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const target = parseTarget(body?.target)
  if (!target) {
    return NextResponse.json({ success: false, error: "Destino inválido" }, { status: 400 })
  }

  const scan = await prisma.documentScan.findFirst({ where: { id, userId } })
  if (!scan) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

  const extractedObj: Record<string, unknown> = asPlainObject(scan.extractedData ?? {})
  const workflow = asPlainObject(extractedObj.workflow)
  workflow.target = target
  workflow.targetSetAt = new Date().toISOString()
  workflow.targetSetById = userId
  extractedObj.workflow = workflow

  const newTipo: DbScanTipo | undefined =
    target === "COTIZACION" ? "COTIZACION" : target === "COMPRA" || target === "VENTA" ? "FACTURA" : undefined

  const updated = await prisma.documentScan.update({
    where: { id: scan.id },
    data: {
      extractedData: extractedObj as Prisma.InputJsonValue,
      ...(newTipo ? { tipo: newTipo } : {}),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
