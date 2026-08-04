import { EstadoOrden } from '@prisma/client'
import type { OperationsDecisionFacts } from '@/lib/decision-engine/collectors/operations-collector'

export const operationsDecisionFactsFixture: OperationsDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  workOrders: {
    current: {
      created: 18,
      completed: 7,
      inProgress: 9,
    },
    previous: {
      created: 16,
      completed: 9,
      inProgress: 7,
    },
    overdue: [
      {
        id: 'ot-1',
        numero: 'OT-2026-0012',
        estado: EstadoOrden.EN_PRODUCCION,
        prioridad: 'ALTA',
        fechaEntrega: '2026-07-20T00:00:00.000Z',
        assignedToName: 'Laura Produccion',
        areaResponsable: 'Produccion',
      },
    ],
    unassignedActive: [
      {
        id: 'ot-2',
        numero: 'OT-2026-0016',
        estado: EstadoOrden.APROBADO_PRODUCCION,
        prioridad: 'NORMAL',
        createdAt: '2026-07-22T00:00:00.000Z',
        areaResponsable: 'Preproduccion',
      },
    ],
  },
  stages: {
    stoppedCount: 1,
    stopped: [
      {
        id: 'stage-1',
        nombre: 'Control de calidad',
        ordenId: 'ot-1',
        ordenNumero: 'OT-2026-0012',
        responsable: 'Laura Produccion',
        maquinaNombre: 'Plotter 1',
      },
    ],
    bottlenecks: [
      {
        area: 'Produccion',
        activeOrders: 4,
      },
    ],
  },
  taskTracking: {
    missingFollowUpTask: 2,
    delayedTasks: 1,
  },
}

export const operationsDecisionFactsHealthyFixture: OperationsDecisionFacts = {
  generatedAt: '2026-08-04T12:00:00.000Z',
  scope: 'SEDE',
  period: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-08-01T23:59:59.999Z',
    previousFrom: '2026-01-29T00:00:00.000Z',
    previousTo: '2026-04-30T23:59:59.999Z',
    durationDays: 92,
  },
  workOrders: {
    current: {
      created: 12,
      completed: 10,
      inProgress: 4,
    },
    previous: {
      created: 11,
      completed: 8,
      inProgress: 5,
    },
    overdue: [],
    unassignedActive: [],
  },
  stages: {
    stoppedCount: 0,
    stopped: [],
    bottlenecks: [],
  },
  taskTracking: {
    missingFollowUpTask: 0,
    delayedTasks: 0,
  },
}