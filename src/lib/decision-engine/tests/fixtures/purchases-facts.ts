import { EstadoCompra } from '@prisma/client'
import type { PurchasesDecisionFacts } from '@/lib/decision-engine/collectors/purchases-collector'

export const purchasesDecisionFactsFixture: PurchasesDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  purchases: {
    current: {
      count: 8,
      total: 18300000,
      unpaidCount: 3,
      unpaidBalance: 6200000,
    },
    previous: {
      count: 6,
      total: 12900000,
      unpaidCount: 1,
      unpaidBalance: 900000,
    },
    pendingAuthorization: [
      {
        id: 'purchase-1',
        proveedorNombre: 'Papeles del Centro',
        fechaCompra: '2026-07-22T12:00:00.000Z',
        total: 2400000,
        estado: EstadoCompra.BORRADOR,
      },
    ],
    unpaid: [
      {
        id: 'purchase-2',
        proveedorNombre: 'Empaques Andinos',
        fechaCompra: '2026-07-25T09:00:00.000Z',
        total: 5000000,
        paid: 1000000,
        balance: 4000000,
      },
    ],
  },
  replenishment: {
    urgentMaterials: [
      {
        id: 'mat-1',
        nombre: 'Vinilo adhesivo blanco',
        proveedor: 'Papeles del Centro',
        stockActual: 0,
        stockMinimo: 20,
        shortfall: 20,
      },
    ],
  },
  costSignals: {
    increasedItems: [
      {
        key: 'vinilo adhesivo blanco',
        descripcion: 'Vinilo adhesivo blanco',
        currentAvg: 18500,
        previousAvg: 15000,
        increasePct: 23.3,
        currentCount: 3,
        previousCount: 2,
      },
    ],
  },
}

export const purchasesDecisionFactsHealthyFixture: PurchasesDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  purchases: {
    current: {
      count: 6,
      total: 9800000,
      unpaidCount: 0,
      unpaidBalance: 0,
    },
    previous: {
      count: 5,
      total: 9500000,
      unpaidCount: 0,
      unpaidBalance: 0,
    },
    pendingAuthorization: [],
    unpaid: [],
  },
  replenishment: {
    urgentMaterials: [],
  },
  costSignals: {
    increasedItems: [],
  },
}