/**
 * API Route: Reporte de ventas POS
 * GET /api/reportes/ventas?periodo=mes|trimestre|año&from=YYYY-MM-DD&to=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from "next/server"
import { AccessLevel, ModuleKey, PosInvoiceStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { requireSedeAccess } from "@/lib/rbac"

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

  const { searchParams } = new URL(request.url)
  const periodo = (searchParams.get("periodo") || "mes") as Periodo
  const fromParam = (searchParams.get("from") || "").trim()
  const toParam = (searchParams.get("to") || "").trim()
  const requestedSedeId = (searchParams.get("sedeId") || "").trim()

  const from = parseDateOnlyUtc(fromParam, false) ?? startDateFor(periodo)
  const to = parseDateOnlyUtc(toParam, true) ?? new Date()
  const sedeId = requestedSedeId || access.sedeId

  if (requestedSedeId && requestedSedeId !== access.sedeId) {
    try {
      await requireSedeAccess({
        userId: access.userId,
        sedeId: requestedSedeId,
        module: ModuleKey.REPORTES,
        minLevel: AccessLevel.READ,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN') {
        return NextResponse.json({ success: false, error: 'No tienes acceso a la sede solicitada.' }, { status: 403 })
      }
      throw error
    }
  }

  const invoices = await prisma.posInvoice.findMany({
    where: {
      empresaId: access.empresaId,
      sedeId,
      status: {
        in: [PosInvoiceStatus.PAID, PosInvoiceStatus.PARTIALLY_REFUNDED, PosInvoiceStatus.REFUNDED],
      },
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
      sedeId: true,
      clienteNombre: true,
      clienteDocumento: true,
      cliente: {
        select: {
          id: true,
          nombre: true,
        },
      },
      returns: {
        select: {
          total: true,
        },
      },
    },
  })

  const sales = invoices
    .map((invoice) => {
      const returnedTotal = invoice.returns.reduce((sum, item) => sum + (item.total ?? 0), 0)
      const grossTotal = invoice.total ?? 0
      const netTotal = invoice.status === PosInvoiceStatus.REFUNDED
        ? 0
        : Math.max(0, grossTotal - returnedTotal)
      const customerName = invoice.cliente?.nombre?.trim() || invoice.clienteNombre?.trim() || 'Consumidor final'
      const customerKey = invoice.cliente?.id || invoice.clienteDocumento?.trim() || `${customerName.toLowerCase()}-${invoice.id}`

      return {
        id: invoice.id,
        createdAt: invoice.createdAt,
        sedeId: invoice.sedeId,
        grossTotal,
        returnedTotal,
        netTotal,
        customerKey,
        customerName,
        customerCompany: null,
      }
    })
    .filter((sale) => sale.netTotal > 0)

  const netSales = sales.reduce((sum, sale) => sum + sale.netTotal, 0)
  const grossSales = sales.reduce((sum, sale) => sum + sale.grossTotal, 0)
  const returned = sales.reduce((sum, sale) => sum + sale.returnedTotal, 0)
  const uniqueCustomers = new Set(sales.map((sale) => sale.customerKey)).size

  return NextResponse.json({
    success: true,
    data: {
      periodo,
      from,
      to,
      totals: {
        grossSales,
        returned,
        netSales,
        count: sales.length,
        uniqueCustomers,
        averageSale: sales.length > 0 ? netSales / sales.length : 0,
      },
      sales: sales.map((sale) => ({
        id: sale.id,
        createdAt: sale.createdAt,
        sedeId: sale.sedeId,
        total: sale.netTotal,
        customerKey: sale.customerKey,
        customerName: sale.customerName,
        customerCompany: sale.customerCompany,
      })),
    },
  })
}