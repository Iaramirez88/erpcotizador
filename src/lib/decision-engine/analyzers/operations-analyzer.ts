import { prisma } from '@/lib/prisma'
import type { DecisionAction, DecisionAnalyzerPlugin, DecisionEngineContext, DecisionInsight, DecisionKpi, DecisionPrediction, DecisionTrend } from '@/lib/decision-engine/contracts'
import { collectOperationsFacts, type OperationsDecisionFacts } from '@/lib/decision-engine/collectors/operations-collector'
import { buildActionExplanation, buildInsightExplanation } from '@/lib/decision-engine/explainability'

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

function resolveCompletionDeltaPct(facts: OperationsDecisionFacts) {
  const previous = facts.workOrders.previous.completed
  const current = facts.workOrders.current.completed
  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

export const operationsAnalyzerPlugin: DecisionAnalyzerPlugin<OperationsDecisionFacts> = {
  key: 'operations',
  collect(context: DecisionEngineContext) {
    return collectOperationsFacts({ ...context, prisma })
  },
  async analyze(facts, context) {
    const locale = context.locale || 'es-CO'
    const alerts: DecisionInsight[] = []
    const risks: DecisionInsight[] = []
    const opportunities: DecisionInsight[] = []
    const recommendations: DecisionAction[] = []
    const actions: DecisionAction[] = []
    const completionDeltaPct = resolveCompletionDeltaPct(facts)

    if (facts.workOrders.overdue.length > 0) {
      const order = facts.workOrders.overdue[0]
      alerts.push({
        id: 'operations-alert-overdue-orders',
        kind: 'ALERT',
        title: 'Ordenes de trabajo retrasadas',
        summary: `${facts.workOrders.overdue.length} ordenes activas ya superaron su fecha de entrega comprometida.`,
        severity: facts.workOrders.overdue.length >= 5 ? 'HIGH' : 'MEDIUM',
        domain: 'OPERACIONES',
        subdomain: 'WORK_ORDERS',
        entityRefs: facts.workOrders.overdue.map((item) => ({ type: 'workOrder', id: item.id, label: item.numero })),
        reasons: ['Las ordenes vencidas afectan SLA interno, experiencia del cliente y capacidad de cierre operativo.'],
        evidence: [
          `${order.numero} sigue en ${order.estado} con fecha compromiso ${formatDate(order.fechaEntrega, locale)}.`,
        ],
      })

      actions.push({
        id: 'operations-action-recover-orders',
        title: 'Recuperar ordenes vencidas',
        description: 'Prioriza replanificacion, reasignacion y cierre de las ordenes que ya incumplieron fecha compromiso.',
        priority: 'NOW',
        owner: 'OPERATIONS',
        expectedImpact: 'Reducir atraso operativo visible y proteger cumplimiento con clientes.',
        href: '/dashboard/ordenes',
      })
    }

    if (facts.stages.stoppedCount > 0 || facts.workOrders.unassignedActive.length > 0) {
      const unassigned = facts.workOrders.unassignedActive.length
      const stopped = facts.stages.stoppedCount
      risks.push({
        id: 'operations-risk-bottlenecks',
        kind: 'RISK',
        title: 'Cuellos operativos por detencion o falta de responsable',
        summary: `${stopped} etapas detenidas y ${unassigned} ordenes activas sin responsable directo tensionan la ejecucion.`,
        severity: stopped + unassigned >= 6 ? 'HIGH' : 'MEDIUM',
        domain: 'OPERACIONES',
        subdomain: 'WORK_ORDERS',
        reasons: ['Las etapas detenidas o sin dueño directo ralentizan el flujo y esconden trabajo en cola.'],
        evidence: [
          facts.stages.stopped[0] ? `La etapa detenida mas visible es ${facts.stages.stopped[0].nombre} en ${facts.stages.stopped[0].ordenNumero}.` : 'No hay etapa detenida listada en detalle.',
          facts.workOrders.unassignedActive[0] ? `La orden sin responsable mas antigua es ${facts.workOrders.unassignedActive[0].numero}.` : 'No hay ordenes activas sin responsable en detalle.',
        ],
      })
    }

    if (facts.stages.bottlenecks.length > 0) {
      const top = facts.stages.bottlenecks[0]
      opportunities.push({
        id: 'operations-opportunity-balance-load',
        kind: 'OPPORTUNITY',
        title: 'Balancear carga operativa por area',
        summary: `${facts.stages.bottlenecks.length} areas muestran acumulacion relevante de ordenes activas.`,
        severity: 'MEDIUM',
        domain: 'OPERACIONES',
        subdomain: 'WORK_ORDERS',
        reasons: ['La lectura por area permite redistribuir carga antes de que el atraso se convierta en incumplimiento.'],
        evidence: [`${top.area} concentra ${top.activeOrders} ordenes activas en la ventana actual.`],
      })

      recommendations.push({
        id: 'operations-recommendation-balance-capacity',
        title: 'Rebalancear capacidad entre areas',
        description: 'Usa la cola por area para redistribuir responsables, secuencias o prioridades antes de que se acumulen atrasos.',
        priority: 'THIS_WEEK',
        owner: 'OPERATIONS',
        expectedImpact: 'Reducir cuellos y estabilizar el flujo de produccion.',
        href: '/dashboard/ordenes',
      })
    }

    const healthScore = Math.max(0, Math.min(100,
      72
      - Math.min(32, facts.workOrders.overdue.length * 5)
      - Math.min(18, facts.stages.stoppedCount * 4)
      - Math.min(15, facts.workOrders.unassignedActive.length * 3)
      - Math.min(12, facts.taskTracking.missingFollowUpTask * 2)
      + Math.min(15, facts.workOrders.current.completed)
    ))

    const kpis: DecisionKpi[] = [
      {
        id: 'operations-kpi-in-progress',
        label: 'Ordenes activas',
        value: facts.workOrders.current.inProgress,
        formattedValue: String(facts.workOrders.current.inProgress),
        status: facts.workOrders.current.inProgress > 0 ? 'POSITIVE' : 'NEUTRAL',
        note: 'Ordenes activas dentro del alcance actual.',
      },
      {
        id: 'operations-kpi-overdue',
        label: 'Ordenes vencidas',
        value: facts.workOrders.overdue.length,
        formattedValue: String(facts.workOrders.overdue.length),
        status: facts.workOrders.overdue.length === 0 ? 'POSITIVE' : facts.workOrders.overdue.length <= 3 ? 'WARNING' : 'NEGATIVE',
        note: 'Ordenes que ya superaron fecha de entrega comprometida.',
      },
      {
        id: 'operations-kpi-stopped-stages',
        label: 'Etapas detenidas',
        value: facts.stages.stoppedCount,
        formattedValue: String(facts.stages.stoppedCount),
        status: facts.stages.stoppedCount === 0 ? 'POSITIVE' : 'WARNING',
        note: 'Etapas de produccion marcadas como detenidas.',
      },
    ]

    const trends: DecisionTrend[] = [
      {
        id: 'operations-trend-completion',
        label: 'Cierre operativo',
        direction: completionDeltaPct == null ? 'FLAT' : completionDeltaPct > 0 ? 'UP' : completionDeltaPct < 0 ? 'DOWN' : 'FLAT',
        summary: completionDeltaPct == null
          ? 'Sin historico comparable suficiente para cierre de ordenes.'
          : `Las ordenes completadas varian ${formatPercent(completionDeltaPct, locale)}% frente al periodo anterior.`,
        magnitudePct: completionDeltaPct,
      },
    ]

    const predictions: DecisionPrediction[] = [
      {
        id: 'operations-prediction-next-attention',
        title: 'Presion operativa inmediata',
        metric: 'Frentes operativos que seguiran requiriendo atencion',
        value: facts.workOrders.overdue.length + facts.stages.stoppedCount + facts.workOrders.unassignedActive.length,
        confidence: facts.workOrders.current.inProgress >= 6 ? 'MEDIUM' : 'LOW',
        basis: [
          `Ordenes vencidas: ${facts.workOrders.overdue.length}.`,
          `Etapas detenidas: ${facts.stages.stoppedCount}.`,
        ],
      },
    ]

    return {
      healthScore,
      healthStatus: healthScore >= 80 ? 'BUENO' : healthScore >= 55 ? 'ATENCION' : 'CRITICO',
      executiveSummary: `Operaciones muestra ${facts.workOrders.overdue.length} ordenes retrasadas, ${facts.stages.stoppedCount} etapas detenidas y ${facts.workOrders.unassignedActive.length} ordenes activas sin responsable directo.`,
      alerts,
      opportunities,
      recommendations,
      predictions,
      risks,
      kpis,
      trends,
      actions,
      explainability: [
        ...alerts.map(buildInsightExplanation),
        ...risks.map(buildInsightExplanation),
        ...opportunities.map(buildInsightExplanation),
        ...recommendations.map(buildActionExplanation),
        ...actions.map(buildActionExplanation),
      ],
      healthBreakdown: [
        {
          id: 'operations-delivery',
          label: 'Cumplimiento de entrega',
          score: Math.max(0, 40 - facts.workOrders.overdue.length * 6),
          maxScore: 40,
          summary: `${facts.workOrders.overdue.length} ordenes superan la fecha compromiso.`,
        },
        {
          id: 'operations-flow',
          label: 'Flujo de produccion',
          score: Math.max(0, 30 - facts.stages.stoppedCount * 5 - facts.workOrders.unassignedActive.length * 2),
          maxScore: 30,
          summary: `${facts.stages.stoppedCount} etapas detenidas y ${facts.workOrders.unassignedActive.length} ordenes sin responsable.`,
        },
        {
          id: 'operations-tracking',
          label: 'Seguimiento operativo',
          score: Math.max(0, 30 - facts.taskTracking.missingFollowUpTask * 3 - facts.taskTracking.delayedTasks * 2),
          maxScore: 30,
          summary: `${facts.taskTracking.missingFollowUpTask} ordenes sin tarea de seguimiento y ${facts.taskTracking.delayedTasks} tareas vencidas.`,
        },
      ],
    }
  },
}