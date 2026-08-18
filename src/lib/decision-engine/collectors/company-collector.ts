import { AccountingAccountType, CrmOpportunityStage, EstadoCotizacion, PosInvoiceStatus, PosPaymentStatus, type PrismaClient } from '@prisma/client'
import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'
import { resolveAnalysisDateRange } from '@/lib/decision-engine/dates'

type SalesWindowSummary = {
  netSales: number
  grossSales: number
  returnedTotal: number
  invoicesCount: number
  uniqueCustomers: number
}

export type CompanyDecisionFacts = {
  generatedAt: string
  scope: 'EMPRESA' | 'SEDE'
  period: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    durationDays: number
  }
  sales: {
    current: SalesWindowSummary
    previous: SalesWindowSummary
  }
  crm: {
    openOpportunities: number
    openOpportunityValue: number
    staleOpportunities: Array<{
      id: string
      title: string
      updatedAt: string
      expectedValue: number
      probabilityPct: number
    }>
    wonThisPeriod: number
  }
  quotes: {
    createdThisPeriod: number
    overdueQuotes: Array<{
      id: string
      numero: string
      total: number
      dueAt: string
    }>
  }
  notifications: {
    unreadCount: number
  }
  resources: {
    lowStockCount: number
    pendingPurchaseAuthorizationCount: number
    pendingSupplyRequestCount: number
  }
  operations: {
    overdueOrdersCount: number
    unassignedActiveOrdersCount: number
  }
  finance: {
    operatingResult: number
    netCashflow: number
    receivablesCount: number
    receivablesAmount: number
    draftVouchersCount: number
  }
}

type CollectCompanyFactsArgs = DecisionEngineContext & {
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
      status: {
        in: [PosInvoiceStatus.PAID, PosInvoiceStatus.PARTIALLY_REFUNDED, PosInvoiceStatus.REFUNDED],
      },
      createdAt: {
        gte: args.from,
        lte: args.to,
      },
    },
    select: {
      id: true,
      total: true,
      status: true,
      clienteNombre: true,
      clienteDocumento: true,
      cliente: {
        select: {
          id: true,
        },
      },
      returns: {
        select: {
          total: true,
        },
      },
    },
  })

  const normalized = invoices
    .map((invoice) => {
      const returnedTotal = invoice.returns.reduce((sum, item) => sum + clampPositive(item.total ?? 0), 0)
      const grossTotal = clampPositive(invoice.total ?? 0)
      const netTotal = invoice.status === PosInvoiceStatus.REFUNDED
        ? 0
        : Math.max(0, grossTotal - returnedTotal)
      const customerKey = invoice.cliente?.id || invoice.clienteDocumento?.trim() || invoice.clienteNombre.trim() || invoice.id

      return {
        grossTotal,
        returnedTotal,
        netTotal,
        customerKey,
      }
    })
    .filter((sale) => sale.netTotal > 0)

  return {
    netSales: normalized.reduce((sum, sale) => sum + sale.netTotal, 0),
    grossSales: normalized.reduce((sum, sale) => sum + sale.grossTotal, 0),
    returnedTotal: normalized.reduce((sum, sale) => sum + sale.returnedTotal, 0),
    invoicesCount: normalized.length,
    uniqueCustomers: new Set(normalized.map((sale) => sale.customerKey)).size,
  } satisfies SalesWindowSummary
}

export async function collectCompanyFacts(args: CollectCompanyFactsArgs): Promise<CompanyDecisionFacts> {
  const range = resolveAnalysisDateRange(args)
  const staleThreshold = new Date(range.to.getTime() - 21 * 24 * 60 * 60 * 1000)

  const [currentSales, previousSales, staleOpportunities, openOpportunityAggregate, wonThisPeriod, createdQuotesCount, overdueQuotes, unreadNotifications, lowStockCount, pendingPurchaseAuthorizationCount, pendingSupplyRequestCount, overdueOrdersCount, unassignedActiveOrdersCount, accountingLines, posPayments, purchasePayments, openReceivableInvoices, draftVouchersCount] = await Promise.all([
    loadSalesWindow({
      prisma: args.prisma,
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      from: range.from,
      to: range.to,
    }),
    loadSalesWindow({
      prisma: args.prisma,
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      from: range.previousFrom,
      to: range.previousTo,
    }),
    args.prisma.crmOpportunity.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        stage: {
          notIn: [CrmOpportunityStage.WON, CrmOpportunityStage.LOST],
        },
        updatedAt: {
          lte: staleThreshold,
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
      take: 8,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        expectedValue: true,
        probabilityPct: true,
      },
    }),
    args.prisma.crmOpportunity.aggregate({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        stage: {
          notIn: [CrmOpportunityStage.WON, CrmOpportunityStage.LOST],
        },
      },
      _count: { id: true },
      _sum: { expectedValue: true },
    }),
    args.prisma.crmOpportunity.count({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        stage: CrmOpportunityStage.WON,
        wonAt: {
          gte: range.from,
          lte: range.to,
        },
      },
    }),
    args.prisma.cotizacion.count({
      where: {
        cliente: {
          empresaId: args.empresaId,
        },
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        createdAt: {
          gte: range.from,
          lte: range.to,
        },
      },
    }),
    args.prisma.cotizacion.findMany({
      where: {
        cliente: {
          empresaId: args.empresaId,
        },
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: {
          in: [EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA],
        },
      },
      select: {
        id: true,
        numero: true,
        fecha: true,
        validezDias: true,
        total: true,
      },
    }),
    args.prisma.notification.count({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        readAt: null,
        archivedAt: null,
        publishAt: {
          lte: range.to,
        },
      },
    }),
    args.prisma.material.count({
      where: {
        empresaId: args.empresaId,
        activo: true,
        stockMinimo: { gt: 0 },
        stockActual: { lte: 0 },
      },
    }),
    args.prisma.compra.count({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        autorizado: false,
        estado: { not: 'ANULADA' },
      },
    }),
    args.prisma.inventorySupplyRequest.count({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { requestingSedeId: args.sedeId } : {}),
        status: 'PENDIENTE',
      },
    }),
    args.prisma.ordenTrabajo.count({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: {
          in: ['PENDIENTE', 'RECIBIDO', 'COTIZADO', 'APROBADO', 'EN_DISENO', 'EN_CORRECCION', 'APROBADO_PRODUCCION', 'EN_IMPRESION', 'EN_PRODUCCION', 'EN_ACONDICIONAMIENTO', 'EN_ACABADOS', 'EN_ENTREGA'],
        },
        fechaEntrega: { lt: range.to },
      },
    }),
    args.prisma.ordenTrabajo.count({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: {
          in: ['PENDIENTE', 'RECIBIDO', 'COTIZADO', 'APROBADO', 'EN_DISENO', 'EN_CORRECCION', 'APROBADO_PRODUCCION', 'EN_IMPRESION', 'EN_PRODUCCION', 'EN_ACONDICIONAMIENTO', 'EN_ACABADOS', 'EN_ENTREGA'],
        },
        assignedToUserId: null,
      },
    }),
    args.prisma.accountingJournalLine.findMany({
      where: {
        entry: {
          empresaId: args.empresaId,
          date: {
            gte: range.from,
            lte: range.to,
          },
        },
      },
      select: {
        debit: true,
        credit: true,
        account: {
          select: {
            type: true,
          },
        },
      },
    }),
    args.prisma.posPayment.findMany({
      where: {
        status: PosPaymentStatus.PAID,
        receivedAt: {
          gte: range.from,
          lte: range.to,
        },
        invoice: {
          empresaId: args.empresaId,
          ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        },
      },
      select: {
        amount: true,
      },
    }),
    args.prisma.compraPago.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        fecha: {
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        monto: true,
      },
    }),
    args.prisma.posInvoice.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        status: {
          notIn: [PosInvoiceStatus.VOID, PosInvoiceStatus.REFUNDED],
        },
      },
      select: {
        total: true,
        payments: {
          where: {
            status: PosPaymentStatus.PAID,
          },
          select: {
            amount: true,
          },
        },
      },
    }),
    args.prisma.accountingVoucher.count({
      where: {
        empresaId: args.empresaId,
        status: 'DRAFT',
      },
    }),
  ])

  const openOpportunityValue = clampPositive(openOpportunityAggregate._sum.expectedValue ?? 0)
  const openOpportunities = openOpportunityAggregate._count.id
  const operatingResult = accountingLines.reduce((sum, line) => {
    if (line.account.type === AccountingAccountType.INCOME) {
      return sum + clampPositive(line.credit) - clampPositive(line.debit)
    }
    if (line.account.type === AccountingAccountType.EXPENSE) {
      return sum - (clampPositive(line.debit) - clampPositive(line.credit))
    }
    return sum
  }, 0)
  const inflows = posPayments.reduce((sum, payment) => sum + clampPositive(payment.amount), 0)
  const outflows = purchasePayments.reduce((sum, payment) => sum + clampPositive(payment.monto), 0)
  const receivablesAmount = openReceivableInvoices.reduce((sum, invoice) => {
    const paid = invoice.payments.reduce((paymentsSum, payment) => paymentsSum + clampPositive(payment.amount), 0)
    return sum + Math.max(0, clampPositive(invoice.total ?? 0) - paid)
  }, 0)
  const receivablesCount = openReceivableInvoices.reduce((count, invoice) => {
    const paid = invoice.payments.reduce((paymentsSum, payment) => paymentsSum + clampPositive(payment.amount), 0)
    return count + (Math.max(0, clampPositive(invoice.total ?? 0) - paid) > 0 ? 1 : 0)
  }, 0)
  const normalizedOverdueQuotes = overdueQuotes
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
    sales: {
      current: currentSales,
      previous: previousSales,
    },
    crm: {
      openOpportunities,
      openOpportunityValue,
      staleOpportunities: staleOpportunities.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        updatedAt: opportunity.updatedAt.toISOString(),
        expectedValue: clampPositive(opportunity.expectedValue ?? 0),
        probabilityPct: opportunity.probabilityPct ?? 0,
      })),
      wonThisPeriod,
    },
    quotes: {
      createdThisPeriod: createdQuotesCount,
      overdueQuotes: normalizedOverdueQuotes.map((quote) => ({
        id: quote.id,
        numero: quote.numero,
        total: quote.total,
        dueAt: quote.dueAt.toISOString(),
      })),
    },
    notifications: {
      unreadCount: unreadNotifications,
    },
    resources: {
      lowStockCount,
      pendingPurchaseAuthorizationCount,
      pendingSupplyRequestCount,
    },
    operations: {
      overdueOrdersCount,
      unassignedActiveOrdersCount,
    },
    finance: {
      operatingResult,
      netCashflow: inflows - outflows,
      receivablesCount,
      receivablesAmount,
      draftVouchersCount,
    },
  }
}