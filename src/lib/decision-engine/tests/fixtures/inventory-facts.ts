import type { InventoryDecisionFacts } from '@/lib/decision-engine/collectors/inventory-collector'

export const inventoryDecisionFactsFixture: InventoryDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  materials: {
    activeCount: 42,
    withStock: 29,
    lowStock: [
      {
        id: 'mat-1',
        nombre: 'Vinilo adhesivo blanco',
        externalId: 'VIN-001',
        proveedor: 'Papeles del Centro',
        unidadMedida: 'm2',
        stockActual: 0,
        stockMinimo: 20,
        shortfall: 20,
      },
    ],
    overstock: [
      {
        id: 'mat-2',
        nombre: 'Carton microcorrugado',
        externalId: 'CAR-778',
        proveedor: 'Empaques Andinos',
        unidadMedida: 'unidad',
        stockActual: 180,
        stockMinimo: 40,
        excess: 140,
        lastMovementAt: '2026-06-10T10:00:00.000Z',
      },
    ],
  },
  movements: {
    current: {
      entries: 7,
      outputs: 13,
      adjustments: 2,
    },
    previous: {
      entries: 9,
      outputs: 8,
      adjustments: 1,
    },
  },
}

export const inventoryDecisionFactsHealthyFixture: InventoryDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  materials: {
    activeCount: 30,
    withStock: 24,
    lowStock: [],
    overstock: [],
  },
  movements: {
    current: {
      entries: 8,
      outputs: 11,
      adjustments: 1,
    },
    previous: {
      entries: 7,
      outputs: 10,
      adjustments: 1,
    },
  },
}