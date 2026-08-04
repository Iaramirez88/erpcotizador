import type { FinanceDecisionFacts } from '@/lib/decision-engine/collectors/finance-collector'

export const financeDecisionFactsFixture: FinanceDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  accounting: {
    current: {
      recognizedIncome: 28000000,
      recognizedExpense: 24100000,
      operatingResult: 3900000,
      inflows: 16000000,
      outflows: 18500000,
      netCashflow: -2500000,
      receivables: 7400000,
      payables: 4300000,
    },
    previous: {
      recognizedIncome: 25000000,
      recognizedExpense: 20500000,
      operatingResult: 4500000,
      inflows: 15000000,
      outflows: 12000000,
      netCashflow: 3000000,
      receivables: 5200000,
      payables: 3800000,
    },
    openPeriods: 1,
    draftVouchers: 3,
  },
  receivables: {
    count: 2,
    topInvoices: [
      {
        id: 'inv-1',
        numero: 'FV-2026-0102',
        customerName: 'Cliente Demo SAS',
        balance: 4200000,
        createdAt: '2026-07-12T00:00:00.000Z',
      },
    ],
  },
  payables: {
    count: 2,
    topPurchases: [
      {
        id: 'buy-1',
        proveedorNombre: 'Papeles del Centro',
        balance: 2500000,
        fechaCompra: '2026-07-18T00:00:00.000Z',
      },
    ],
  },
}

export const financeDecisionFactsHealthyFixture: FinanceDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  accounting: {
    current: {
      recognizedIncome: 32000000,
      recognizedExpense: 25000000,
      operatingResult: 7000000,
      inflows: 22000000,
      outflows: 15000000,
      netCashflow: 7000000,
      receivables: 1200000,
      payables: 900000,
    },
    previous: {
      recognizedIncome: 28000000,
      recognizedExpense: 24000000,
      operatingResult: 4000000,
      inflows: 19000000,
      outflows: 17000000,
      netCashflow: 2000000,
      receivables: 1500000,
      payables: 1100000,
    },
    openPeriods: 1,
    draftVouchers: 0,
  },
  receivables: {
    count: 0,
    topInvoices: [],
  },
  payables: {
    count: 0,
    topPurchases: [],
  },
}