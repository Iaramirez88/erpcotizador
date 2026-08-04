import { AccountingAccountType, PosPaymentStatus, type PrismaClient } from '@prisma/client'
import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'
import { resolveAnalysisDateRange } from '@/lib/decision-engine/dates'

type FinanceWindowSummary = {
  recognizedIncome: number
  recognizedExpense: number
  operatingResult: number
  inflows: number
  outflows: number
  netCashflow: number
  receivables: number
  payables: number
}

export type FinanceDecisionFacts = {
  generatedAt: string
  scope: 'EMPRESA' | 'SEDE'
  period: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    durationDays: number
  }
  accounting: {
    current: FinanceWindowSummary
    previous: FinanceWindowSummary
    openPeriods: number
    draftVouchers: number
  }
  receivables: {
    count: number
    topInvoices: Array<{
      id: string
      numero: string
      customerName: string
      balance: number
      createdAt: string
    }>
  }
  payables: {
    count: number
    topPurchases: Array<{
      id: string
      proveedorNombre: string
      balance: number
      fechaCompra: string
    }>
  }
}

type CollectFinanceFactsArgs = DecisionEngineContext & {
  prisma: PrismaClient
}

function clampPositive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

async function loadFinanceWindow(args: {
  prisma: PrismaClient
  empresaId: string
  sedeId?: string | null
  from: Date
  to: Date
}) {
  const [journalLines, posPayments, purchasePayments, receivableInvoices, payablePurchases] = await Promise.all([
    args.prisma.accountingJournalLine.findMany({
      where: {
        entry: {
          empresaId: args.empresaId,
          date: { gte: args.from, lte: args.to },
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
        receivedAt: { gte: args.from, lte: args.to },
        invoice: {
          empresaId: args.empresaId,
          ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        },
      },
      select: { amount: true },
    }),
    args.prisma.compraPago.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        fecha: { gte: args.from, lte: args.to },
      },
      select: { monto: true },
    }),
    args.prisma.posInvoice.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
      },
      take: 30,
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        numero: true,
        total: true,
        createdAt: true,
        clienteNombre: true,
        payments: {
          where: { status: PosPaymentStatus.PAID },
          select: { amount: true },
        },
      },
    }),
    args.prisma.compra.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { not: 'ANULADA' },
      },
      take: 30,
      orderBy: [{ fechaCompra: 'asc' }],
      select: {
        id: true,
        proveedorNombre: true,
        total: true,
        fechaCompra: true,
        pagos: {
          select: { monto: true },
        },
      },
    }),
  ])

  let recognizedIncome = 0
  let recognizedExpense = 0

  for (const line of journalLines) {
    if (line.account.type === AccountingAccountType.INCOME) {
      recognizedIncome += clampPositive(line.credit) - clampPositive(line.debit)
    }
    if (line.account.type === AccountingAccountType.EXPENSE) {
      recognizedExpense += clampPositive(line.debit) - clampPositive(line.credit)
    }
  }

  const inflows = posPayments.reduce((sum, payment) => sum + clampPositive(payment.amount), 0)
  const outflows = purchasePayments.reduce((sum, payment) => sum + clampPositive(payment.monto), 0)

  const receivableRows = posPayments.length >= 0
    ? posPayments
    : []
  void receivableRows

  const receivables = posInvoicesToReceivables(receivableInvoices)
  const payables = purchasesToPayables(payablePurchases)

  return {
    recognizedIncome,
    recognizedExpense,
    operatingResult: recognizedIncome - recognizedExpense,
    inflows,
    outflows,
    netCashflow: inflows - outflows,
    receivables: receivables.total,
    payables: payables.total,
    topReceivables: receivables.items,
    topPayables: payables.items,
  }
}

function posInvoicesToReceivables(invoices: Array<{
  id: string
  numero: string
  total: number
  createdAt: Date
  clienteNombre: string
  payments: Array<{ amount: number }>
}>) {
  const items = invoices
    .map((invoice) => {
      const paid = invoice.payments.reduce((sum, payment) => sum + clampPositive(payment.amount), 0)
      const balance = Math.max(0, clampPositive(invoice.total) - paid)
      if (balance <= 0) return null
      return {
        id: invoice.id,
        numero: invoice.numero,
        customerName: invoice.clienteNombre.trim() || 'Consumidor final',
        balance,
        createdAt: invoice.createdAt.toISOString(),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 8)

  return {
    total: items.reduce((sum, item) => sum + item.balance, 0),
    items,
  }
}

function purchasesToPayables(purchases: Array<{
  id: string
  proveedorNombre: string
  total: number
  fechaCompra: Date
  pagos: Array<{ monto: number }>
}>) {
  const items = purchases
    .map((purchase) => {
      const paid = purchase.pagos.reduce((sum, payment) => sum + clampPositive(payment.monto), 0)
      const balance = Math.max(0, clampPositive(purchase.total) - paid)
      if (balance <= 0) return null
      return {
        id: purchase.id,
        proveedorNombre: purchase.proveedorNombre,
        balance,
        fechaCompra: purchase.fechaCompra.toISOString(),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 8)

  return {
    total: items.reduce((sum, item) => sum + item.balance, 0),
    items,
  }
}

export async function collectFinanceFacts(args: CollectFinanceFactsArgs): Promise<FinanceDecisionFacts> {
  const range = resolveAnalysisDateRange(args)

  const [current, previous, openPeriods, draftVouchers] = await Promise.all([
    loadFinanceWindow({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.from, to: range.to }),
    loadFinanceWindow({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.previousFrom, to: range.previousTo }),
    args.prisma.accountingPeriod.count({
      where: {
        empresaId: args.empresaId,
        status: 'OPEN',
      },
    }),
    args.prisma.accountingVoucher.count({
      where: {
        empresaId: args.empresaId,
        status: 'DRAFT',
      },
    }),
  ])

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
    accounting: {
      current: {
        recognizedIncome: current.recognizedIncome,
        recognizedExpense: current.recognizedExpense,
        operatingResult: current.operatingResult,
        inflows: current.inflows,
        outflows: current.outflows,
        netCashflow: current.netCashflow,
        receivables: current.receivables,
        payables: current.payables,
      },
      previous: {
        recognizedIncome: previous.recognizedIncome,
        recognizedExpense: previous.recognizedExpense,
        operatingResult: previous.operatingResult,
        inflows: previous.inflows,
        outflows: previous.outflows,
        netCashflow: previous.netCashflow,
        receivables: previous.receivables,
        payables: previous.payables,
      },
      openPeriods,
      draftVouchers,
    },
    receivables: {
      count: current.topReceivables.length,
      topInvoices: current.topReceivables,
    },
    payables: {
      count: current.topPayables.length,
      topPurchases: current.topPayables,
    },
  }
}