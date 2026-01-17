/**
 * API Route: Reporte profesional de compras
 * GET /api/reportes/compras?periodo=mes|trimestre|año&from=YYYY-MM-DD&to=YYYY-MM-DD&search=&autorizado=&sede=
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

type Periodo = "mes" | "trimestre" | "año"

function startDateFor(periodo: Periodo): Date {
  const now = new Date()
  if (periodo === "año") return new Date(now.getFullYear(), 0, 1)
  if (periodo === "trimestre") {
    const quarter = Math.floor(now.getMonth() / 3)
    return new Date(now.getFullYear(), quarter * 3, 1)
  }
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

function parseBool(value: string | null): boolean | undefined {
  if (value === null) return undefined
  const v = value.trim().toLowerCase()
  if (v === "true") return true
  if (v === "false") return false
  return undefined
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response

  const userId = access.userId

  const { searchParams } = new URL(request.url)
  const periodo = (searchParams.get("periodo") || "mes") as Periodo

  const fromParam = (searchParams.get("from") || "").trim()
  const toParam = (searchParams.get("to") || "").trim()
  const search = (searchParams.get("search") || "").trim()
  const sede = (searchParams.get("sede") || "").trim()
  const autorizado = parseBool(searchParams.get("autorizado"))

  const from = parseDateOnlyUtc(fromParam, false) ?? startDateFor(periodo)
  const to = parseDateOnlyUtc(toParam, true) ?? new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    userId,
    fechaCompra: {
      gte: from,
      lte: to,
    },
  }

  if (typeof autorizado === "boolean") where.autorizado = autorizado
  if (sede) where.sede = { contains: sede, mode: "insensitive" as const }

  if (search) {
    where.OR = [
      { proveedorNombre: { contains: search, mode: "insensitive" as const } },
      { numeroFactura: { contains: search, mode: "insensitive" as const } },
      { numeroOrden: { contains: search, mode: "insensitive" as const } },
      { numeroPedido: { contains: search, mode: "insensitive" as const } },
      { observaciones: { contains: search, mode: "insensitive" as const } },
    ]
  }

  const agg = await prisma.compra.aggregate({
    where,
    _count: { _all: true },
    _sum: {
      subtotalSinIva: true,
      iva: true,
      descuentoTotal: true,
      subtotalConIva: true,
      total: true,
    },
  })

  const byAut = await prisma.compra.groupBy({
    by: ["autorizado"],
    where,
    _count: { _all: true },
  })

  const byProveedor = await prisma.compra.groupBy({
    by: ["proveedorNombre"],
    where,
    _count: { _all: true },
    _sum: { total: true, iva: true, subtotalSinIva: true },
    orderBy: { _sum: { total: "desc" } },
    take: 10,
  })

  const bySede = await prisma.compra.groupBy({
    by: ["sede"],
    where,
    _count: { _all: true },
    _sum: { total: true },
    orderBy: { _sum: { total: "desc" } },
    take: 20,
  })

  const authorizedCount = byAut.find((x) => x.autorizado === true)?._count?._all ?? 0
  const unauthorizedCount = byAut.find((x) => x.autorizado === false)?._count?._all ?? 0

  return NextResponse.json({
    success: true,
    data: {
      periodo,
      from,
      to,
      filters: { search, sede, autorizado },
      totals: {
        count: agg._count._all,
        subtotalSinIva: agg._sum.subtotalSinIva ?? 0,
        iva: agg._sum.iva ?? 0,
        descuentoTotal: agg._sum.descuentoTotal ?? 0,
        subtotalConIva: agg._sum.subtotalConIva ?? 0,
        total: agg._sum.total ?? 0,
        authorizedCount,
        unauthorizedCount,
      },
      byProveedor: byProveedor.map((p) => ({
        proveedorNombre: p.proveedorNombre,
        count: p._count._all,
        subtotalSinIva: p._sum.subtotalSinIva ?? 0,
        iva: p._sum.iva ?? 0,
        total: p._sum.total ?? 0,
      })),
      bySede: bySede.map((s) => ({
        sede: s.sede ?? "(Sin sede)",
        count: s._count._all,
        total: s._sum.total ?? 0,
      })),
    },
  })
}
