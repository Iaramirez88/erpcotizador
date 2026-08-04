import type { CrmDecisionFacts } from '@/lib/decision-engine/collectors/crm-collector'

export const crmDecisionFactsFixture: CrmDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  leads: {
    newThisPeriod: 24,
    convertedThisPeriod: 6,
    withoutRecentFollowUp: [
      {
        id: 'lead-1',
        nombre: 'Clinica Norte',
        empresaNombre: 'Clinica Norte SAS',
        lastActivityAt: '2026-07-10T10:00:00.000Z',
        createdAt: '2026-06-20T12:00:00.000Z',
      },
      {
        id: 'lead-2',
        nombre: 'Centro Dental Vital',
        empresaNombre: 'Centro Dental Vital',
        lastActivityAt: null,
        createdAt: '2026-07-04T09:00:00.000Z',
      },
    ],
  },
  opportunities: {
    openCount: 11,
    openValue: 18500000,
    wonThisPeriod: 4,
    stale: [
      {
        id: 'opp-1',
        title: 'Renovacion sede principal',
        updatedAt: '2026-07-08T14:00:00.000Z',
        expectedValue: 5200000,
        probabilityPct: 55,
      },
    ],
    highPotential: [
      {
        id: 'opp-2',
        title: 'Campana institucional agosto',
        expectedValue: 6800000,
        probabilityPct: 80,
        updatedAt: '2026-07-29T15:00:00.000Z',
      },
      {
        id: 'opp-3',
        title: 'Impresos corporativos recurrentes',
        expectedValue: 3100000,
        probabilityPct: 72,
        updatedAt: '2026-07-31T11:00:00.000Z',
      },
    ],
  },
}

export const crmDecisionFactsHealthyFixture: CrmDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  leads: {
    newThisPeriod: 10,
    convertedThisPeriod: 4,
    withoutRecentFollowUp: [],
  },
  opportunities: {
    openCount: 5,
    openValue: 12000000,
    wonThisPeriod: 3,
    stale: [],
    highPotential: [],
  },
}