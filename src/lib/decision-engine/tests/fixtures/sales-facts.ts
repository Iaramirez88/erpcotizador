import type { SalesDecisionFacts } from '@/lib/decision-engine/collectors/sales-collector'

export const salesDecisionFactsFixture: SalesDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  invoices: {
    current: {
      netSales: 12300000,
      invoicesCount: 28,
      uniqueCustomers: 16,
    },
    previous: {
      netSales: 15600000,
      invoicesCount: 31,
      uniqueCustomers: 18,
    },
  },
  quotes: {
    createdThisPeriod: 20,
    approvedThisPeriod: 4,
    sentThisPeriod: 13,
    overdue: [
      {
        id: 'quote-1',
        numero: 'COT-PRIN-0042',
        total: 2400000,
        dueAt: '2026-07-18T00:00:00.000Z',
      },
      {
        id: 'quote-2',
        numero: 'COT-PRIN-0048',
        total: 1100000,
        dueAt: '2026-07-24T00:00:00.000Z',
      },
    ],
  },
  customers: {
    topBuyers: [
      {
        key: 'cli-1',
        label: 'Distribuciones Andina',
        total: 4300000,
        count: 4,
      },
      {
        key: 'cli-2',
        label: 'Optica Central',
        total: 2700000,
        count: 2,
      },
    ],
  },
}

export const salesDecisionFactsHealthyFixture: SalesDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  invoices: {
    current: {
      netSales: 14600000,
      invoicesCount: 30,
      uniqueCustomers: 18,
    },
    previous: {
      netSales: 14000000,
      invoicesCount: 29,
      uniqueCustomers: 17,
    },
  },
  quotes: {
    createdThisPeriod: 14,
    approvedThisPeriod: 6,
    sentThisPeriod: 10,
    overdue: [],
  },
  customers: {
    topBuyers: [],
  },
}