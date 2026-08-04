import { CrmTaskStatus, EstadoEtapa, EstadoOrden, type PrismaClient } from '@prisma/client'
import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'
import { resolveAnalysisDateRange } from '@/lib/decision-engine/dates'

const ACTIVE_ORDER_STATES: EstadoOrden[] = [
  EstadoOrden.PENDIENTE,
  EstadoOrden.RECIBIDO,
  EstadoOrden.COTIZADO,
  EstadoOrden.APROBADO,
  EstadoOrden.EN_DISENO,
  EstadoOrden.EN_CORRECCION,
  EstadoOrden.APROBADO_PRODUCCION,
  EstadoOrden.EN_IMPRESION,
  EstadoOrden.EN_PRODUCCION,
  EstadoOrden.EN_ACONDICIONAMIENTO,
  EstadoOrden.EN_ACABADOS,
  EstadoOrden.EN_ENTREGA,
]

const FINISHED_ORDER_STATES: EstadoOrden[] = [
  EstadoOrden.LISTA_ENTREGA,
  EstadoOrden.ENTREGADA,
  EstadoOrden.FACTURADO,
  EstadoOrden.CERRADO,
  EstadoOrden.CANCELADA,
]

type OperationsWindowSummary = {
  created: number
  completed: number
  inProgress: number
}

export type OperationsDecisionFacts = {
  generatedAt: string
  scope: 'EMPRESA' | 'SEDE'
  period: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    durationDays: number
  }
  workOrders: {
    current: OperationsWindowSummary
    previous: OperationsWindowSummary
    overdue: Array<{
      id: string
      numero: string
      estado: EstadoOrden
      prioridad: string
      fechaEntrega: string
      assignedToName: string | null
      areaResponsable: string | null
    }>
    unassignedActive: Array<{
      id: string
      numero: string
      estado: EstadoOrden
      prioridad: string
      createdAt: string
      areaResponsable: string | null
    }>
  }
  stages: {
    stoppedCount: number
    stopped: Array<{
      id: string
      nombre: string
      ordenId: string
      ordenNumero: string
      responsable: string | null
      maquinaNombre: string | null
    }>
    bottlenecks: Array<{
      area: string
      activeOrders: number
    }>
  }
  taskTracking: {
    missingFollowUpTask: number
    delayedTasks: number
  }
}

type CollectOperationsFactsArgs = DecisionEngineContext & {
  prisma: PrismaClient
}

async function loadWorkOrderWindow(args: {
  prisma: PrismaClient
  sedeId?: string | null
  from: Date
  to: Date
}) {
  const [created, completed, inProgress] = await Promise.all([
    args.prisma.ordenTrabajo.count({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        createdAt: { gte: args.from, lte: args.to },
      },
    }),
    args.prisma.ordenTrabajo.count({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: FINISHED_ORDER_STATES },
        updatedAt: { gte: args.from, lte: args.to },
      },
    }),
    args.prisma.ordenTrabajo.count({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: ACTIVE_ORDER_STATES },
      },
    }),
  ])

  return { created, completed, inProgress } satisfies OperationsWindowSummary
}

export async function collectOperationsFacts(args: CollectOperationsFactsArgs): Promise<OperationsDecisionFacts> {
  const range = resolveAnalysisDateRange(args)

  const [current, previous, overdueOrders, unassignedActive, stoppedStages, activeOrdersForBottlenecks, missingFollowUpTask, delayedTasks] = await Promise.all([
    loadWorkOrderWindow({ prisma: args.prisma, sedeId: args.sedeId, from: range.from, to: range.to }),
    loadWorkOrderWindow({ prisma: args.prisma, sedeId: args.sedeId, from: range.previousFrom, to: range.previousTo }),
    args.prisma.ordenTrabajo.findMany({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: ACTIVE_ORDER_STATES },
        fechaEntrega: { lt: range.to },
      },
      orderBy: [{ fechaEntrega: 'asc' }],
      take: 8,
      select: {
        id: true,
        numero: true,
        estado: true,
        prioridad: true,
        fechaEntrega: true,
        areaResponsable: true,
        assignedTo: { select: { name: true, email: true } },
      },
    }),
    args.prisma.ordenTrabajo.findMany({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: ACTIVE_ORDER_STATES },
        assignedToUserId: null,
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 8,
      select: {
        id: true,
        numero: true,
        estado: true,
        prioridad: true,
        createdAt: true,
        areaResponsable: true,
      },
    }),
    args.prisma.etapaProduccion.findMany({
      where: {
        estado: EstadoEtapa.DETENIDA,
        orden: {
          ...(args.sedeId ? { sedeId: args.sedeId } : {}),
          estado: { in: ACTIVE_ORDER_STATES },
        },
      },
      orderBy: [{ updatedAt: 'asc' }],
      take: 8,
      select: {
        id: true,
        nombre: true,
        responsable: true,
        maquina: { select: { nombre: true } },
        orden: { select: { id: true, numero: true } },
      },
    }),
    args.prisma.ordenTrabajo.findMany({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: ACTIVE_ORDER_STATES },
      },
      select: {
        areaResponsable: true,
      },
      take: 200,
    }),
    args.prisma.ordenTrabajo.count({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: ACTIVE_ORDER_STATES },
        tareaSeguimiento: null,
      },
    }),
    args.prisma.ordenTrabajo.count({
      where: {
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: ACTIVE_ORDER_STATES },
        tareaSeguimiento: {
          is: {
            status: { in: [CrmTaskStatus.OPEN, CrmTaskStatus.IN_PROGRESS] },
            dueAt: { lt: range.to },
          },
        },
      },
    }),
  ])

  const areaCounts = new Map<string, number>()
  for (const order of activeOrdersForBottlenecks) {
    const area = order.areaResponsable?.trim() || 'Sin área'
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1)
  }

  const bottlenecks = [...areaCounts.entries()]
    .map(([area, activeOrders]) => ({ area, activeOrders }))
    .filter((entry) => entry.activeOrders >= 3)
    .sort((left, right) => right.activeOrders - left.activeOrders)
    .slice(0, 6)

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
    workOrders: {
      current,
      previous,
      overdue: overdueOrders.map((order) => ({
        id: order.id,
        numero: order.numero,
        estado: order.estado,
        prioridad: order.prioridad,
        fechaEntrega: order.fechaEntrega?.toISOString() ?? new Date().toISOString(),
        assignedToName: order.assignedTo?.name || order.assignedTo?.email || null,
        areaResponsable: order.areaResponsable ?? null,
      })),
      unassignedActive: unassignedActive.map((order) => ({
        id: order.id,
        numero: order.numero,
        estado: order.estado,
        prioridad: order.prioridad,
        createdAt: order.createdAt.toISOString(),
        areaResponsable: order.areaResponsable ?? null,
      })),
    },
    stages: {
      stoppedCount: stoppedStages.length,
      stopped: stoppedStages.map((stage) => ({
        id: stage.id,
        nombre: stage.nombre,
        ordenId: stage.orden.id,
        ordenNumero: stage.orden.numero,
        responsable: stage.responsable ?? null,
        maquinaNombre: stage.maquina?.nombre ?? null,
      })),
      bottlenecks,
    },
    taskTracking: {
      missingFollowUpTask,
      delayedTasks,
    },
  }
}