import { EstadoCotizacion, PosInvoiceStatus, type PrismaClient } from '@prisma/client'
import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'
import { resolveAnalysisDateRange } from '@/lib/decision-engine/dates'

type SalesWindowSummary = {
  netSales: number
  invoicesCount: number
  uniqueCustomers: number
}

export type SalesDecisionFacts = {
  generatedAt: string
  scope: 'EMPRESA' | 'SEDE'
  period: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    durationDays: number
  }
  invoices: {
    current: SalesWindowSummary
    previous: SalesWindowSummary
  }
  quotes: {
    createdThisPeriod: number
    approvedThisPeriod: number
    sentThisPeriod: number
    overdue: Array<{
      id: string
      numero: string
      total: number
      dueAt: string
    }>
  }
  customers: {
    topBuyers: Array<{
      key: string
      label: string
      total: number
      count: number
    }>
  }
}

type CollectSalesFactsArgs = DecisionEngineContext & {
  prisma: PrismaClient
}

function clampPositive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

async function loadSalesWindow(args: {
  prisma: PrismaClient
  empresaId: string
  sedeId?: string | null
  from: Date
  to: Date
}) {
  const invoices = await args.prisma.posInvoice.findMany({
    where: {
      empresaId: args.empresaId,
      ...(args.sedeId ? { sedeId: args.sedeId } : {}),
      status: { in: [PosInvoiceStatus.PAID, PosInvoiceStatus.PARTIALLY_REFUNDED, PosInvoiceStatus.REFUNDED] },
      createdAt: { gte: args.from, lte: args.to },
    },
    select: {
      id: true,
      total: true,
      status: true,
      clienteNombre: true,
      clienteDocumento: true,
      cliente: { select: { id: true, nombre: true } },
      returns: { select: { total: true } },
    },
  })

  const normalized = invoices
    .map((invoice) => {
      const returnedTotal = invoice.returns.reduce((sum, item) => sum + clampPositive(item.total ?? 0), 0)
      const grossTotal = clampPositive(invoice.total ?? 0)
      const netTotal = invoice.status === PosInvoiceStatus.REFUNDED ? 0 : Math.max(0, grossTotal - returnedTotal)
      const customerKey = invoice.cliente?.id || invoice.clienteDocumento?.trim() || invoice.clienteNombre.trim() || invoice.id

      return {
        netTotal,
        customerKey,
      }
    })
    .filter((sale) => sale.netTotal > 0)

  return {
    netSales: normalized.reduce((sum, sale) => sum + sale.netTotal, 0),
    invoicesCount: normalized.length,
    uniqueCustomers: new Set(normalized.map((sale) => sale.customerKey)).size,
  } satisfies SalesWindowSummary
}

export async function collectSalesFacts(args: CollectSalesFactsArgs): Promise<SalesDecisionFacts> {
  const range = resolveAnalysisDateRange(args)

  const [current, previous, createdQuotes, approvedQuotes, sentQuotes, overdueQuotesRaw, topInvoices] = await Promise.all([
    loadSalesWindow({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.from, to: range.to }),
    loadSalesWindow({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.previousFrom, to: range.previousTo }),
    args.prisma.cotizacion.count({
      where: {
        cliente: {
          empresaId: args.empresaId,
        },
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
    }),
    args.prisma.cotizacion.count({
      where: {
        cliente: {
          empresaId: args.empresaId,
        },
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: [EstadoCotizacion.APROBADA, EstadoCotizacion.CONVERTIDA] },
        updatedAt: { gte: range.from, lte: range.to },
      },
    }),
    args.prisma.cotizacion.count({
      where: {
        cliente: {
          empresaId: args.empresaId,
        },
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        OR: [
          { lastEmailSentAt: { gte: range.from, lte: range.to } },
          { lastWhatsappSentAt: { gte: range.from, lte: range.to } },
        ],
      },
    }),
    args.prisma.cotizacion.findMany({
      where: {
        cliente: {
          empresaId: args.empresaId,
        },
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: [EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA] },
      },
      select: {
        id: true,
        numero: true,
        fecha: true,
        validezDias: true,
        total: true,
      },
    }),
    args.prisma.posInvoice.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        status: { in: [PosInvoiceStatus.PAID, PosInvoiceStatus.PARTIALLY_REFUNDED, PosInvoiceStatus.REFUNDED] },
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        id: true,
        total: true,
        status: true,
        clienteNombre: true,
        clienteDocumento: true,
        cliente: { select: { id: true, nombre: true } },
        returns: { select: { total: true } },
      },
    }),
  ])

  const overdue = overdueQuotesRaw
    .map((quote) => {
      const dueAt = new Date(quote.fecha.getTime() + Math.max(1, quote.validezDias) * 24 * 60 * 60 * 1000)
      return {
        id: quote.id,
        numero: quote.numero,
        total: clampPositive(quote.total ?? 0),
        dueAt,
      }
    })
    .filter((quote) => quote.dueAt.getTime() < range.to.getTime())
    .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime())
    .slice(0, 8)

  const topByCustomer = new Map<string, { key: string; label: string; total: number; count: number }>()
  for (const invoice of topInvoices) {
    const returned = invoice.returns.reduce((sum, item) => sum + clampPositive(item.total ?? 0), 0)
    const total = invoice.status === PosInvoiceStatus.REFUNDED ? 0 : Math.max(0, clampPositive(invoice.total ?? 0) - returned)
    if (total <= 0) continue

    const key = invoice.cliente?.id || invoice.clienteDocumento?.trim() || invoice.id
    const label = invoice.cliente?.nombre?.trim() || invoice.clienteNombre.trim() || 'Consumidor final'
    const currentCustomer = topByCustomer.get(key) ?? { key, label, total: 0, count: 0 }
    currentCustomer.total += total
    currentCustomer.count += 1
    topByCustomer.set(key, currentCustomer)
  }

  return {
    generatedAt: new Date().toISOString(),
    scope: args.sedeId ? 'SEDE' : 'EMPRESA',
    period: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      previousFrom: range.previousFrom.toISOString(),
      previousTo: range.previousTo.toISOString(),
      durationDays: range.durationDays,
    },
    invoices: {
      current,
      previous,
    },
    quotes: {
      createdThisPeriod: createdQuotes,
      approvedThisPeriod: approvedQuotes,
      sentThisPeriod: sentQuotes,
      overdue: overdue.map((quote) => ({
        id: quote.id,
        numero: quote.numero,
        total: quote.total,
        dueAt: quote.dueAt.toISOString(),
      })),
    },
    customers: {
      topBuyers: [...topByCustomer.values()].sort((left, right) => right.total - left.total).slice(0, 6),
    },
  }
}