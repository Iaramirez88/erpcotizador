/**
 * API Route: Reportes de documentos escaneados
 * GET /api/reportes/documentos?periodo=mes|trimestre|año&from=YYYY-MM-DD&to=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

type Periodo = "mes" | "trimestre" | "año"

function asPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function startDateFor(periodo: Periodo): Date {
  const now = new Date()
  if (periodo === "año") return new Date(now.getFullYear(), 0, 1)
  if (periodo === "trimestre") {
    const quarter = Math.floor(now.getMonth() / 3)
    return new Date(now.getFullYear(), quarter * 3, 1)
  }
  // mes
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function parseDateOnlyUtc(value: string, endOfDay: boolean): Date | null {
  const v = value.trim()
  if (!v) return null

  // YYYY-MM-DD (evita zonas horarias ambiguas)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [yy, mm, dd] = v.split('-').map((n) => Number(n))
    if (!yy || !mm || !dd) return null
    return endOfDay
      ? new Date(Date.UTC(yy, mm - 1, dd, 23, 59, 59, 999))
      : new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0, 0))
  }

  const dt = new Date(v)
  return Number.isFinite(dt.getTime()) ? dt : null
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response

  const userId = access.userId

  const { searchParams } = new URL(request.url)
  const periodo = (searchParams.get("periodo") || "mes") as Periodo
  const fromParam = searchParams.get("from") || ""
  const toParam = searchParams.get("to") || ""

  const from = parseDateOnlyUtc(fromParam, false) ?? startDateFor(periodo)
  const to = parseDateOnlyUtc(toParam, true) ?? new Date()

  // Nota: Para MVP agrupamos en memoria usando extractedData.classification.detected.
  // Si crece el volumen, lo migramos a raw SQL / materialized view.
  const scans = await prisma.documentScan.findMany({
    where: {
      userId,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      approved: true,
      status: true,
      createdAt: true,
      extractedData: true,
      tipo: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  const countsByDetected: Record<string, number> = {}
  let approvedCount = 0
  let processedCount = 0

  for (const s of scans) {
    if (s.approved) approvedCount++
    if (s.status === "PROCESADO" || s.status === "APROBADO") processedCount++

    const extractedObj = asPlainObject(s.extractedData)
    const classification = asPlainObject(extractedObj.classification)
    const detected = String(classification.detected || s.tipo || "DESCONOCIDO")
    countsByDetected[detected] = (countsByDetected[detected] || 0) + 1
  }

  return NextResponse.json({
    success: true,
    data: {
      periodo,
      from,
      to,
      totals: {
        total: scans.length,
        approved: approvedCount,
        processed: processedCount,
      },
      byDetected: countsByDetected,
    },
  })
}
