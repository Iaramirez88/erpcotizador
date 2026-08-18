import type { CompanyDecisionFacts } from '@/lib/decision-engine/collectors/company-collector'

export const companyDecisionFactsFixture: CompanyDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  sales: {
    current: {
      netSales: 18000000,
      grossSales: 18700000,
      returnedTotal: 700000,
      invoicesCount: 42,
      uniqueCustomers: 24,
    },
    previous: {
      netSales: 15000000,
      grossSales: 15500000,
      returnedTotal: 500000,
      invoicesCount: 37,
      uniqueCustomers: 20,
    },
  },
  crm: {
    openOpportunities: 14,
    openOpportunityValue: 24000000,
    staleOpportunities: [
      {
        id: 'opp-1',
        title: 'Renovación cliente institucional',
        updatedAt: '2026-07-01T10:00:00.000Z',
        expectedValue: 4200000,
        probabilityPct: 60,
      },
    ],
    wonThisPeriod: 6,
  },
  quotes: {
    createdThisPeriod: 28,
    overdueQuotes: [
      {
        id: 'quote-1',
        numero: 'COT-001',
        total: 1800000,
        dueAt: '2026-07-15T00:00:00.000Z',
      },
    ],
  },
  notifications: {
    unreadCount: 4,
  },
  resources: {
    lowStockCount: 2,
    pendingPurchaseAuthorizationCount: 1,
    pendingSupplyRequestCount: 3,
  },
  operations: {
    overdueOrdersCount: 1,
    unassignedActiveOrdersCount: 2,
  },
  finance: {
    operatingResult: 3900000,
    netCashflow: -2500000,
    receivablesCount: 2,
    receivablesAmount: 7400000,
    draftVouchersCount: 3,
  },
}