import { prisma } from '@/lib/prisma'
import type { DecisionAction, DecisionAnalyzerPlugin, DecisionEngineContext, DecisionInsight, DecisionKpi, DecisionPrediction, DecisionTrend } from '@/lib/decision-engine/contracts'
import { collectInventoryFacts, type InventoryDecisionFacts } from '@/lib/decision-engine/collectors/inventory-collector'
import { buildActionExplanation, buildInsightExplanation } from '@/lib/decision-engine/explainability'

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

function resolveMovementDeltaPct(facts: InventoryDecisionFacts) {
  const previous = facts.movements.previous.outputs
  const current = facts.movements.current.outputs
  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function resolveDemandForecastValue(facts: InventoryDecisionFacts, outputDeltaPct: number | null) {
  const projectedOutputs = facts.movements.current.outputs * (1 + ((outputDeltaPct ?? 0) * 0.35) / 100)
  return Math.max(0, projectedOutputs)
}

export const inventoryAnalyzerPlugin: DecisionAnalyzerPlugin<InventoryDecisionFacts> = {
  key: 'inventory',
  collect(context: DecisionEngineContext) {
    return collectInventoryFacts({ ...context, prisma })
  },
  async analyze(facts, context) {
    const locale = context.locale || 'es-CO'
    const alerts: DecisionInsight[] = []
    const risks: DecisionInsight[] = []
    const opportunities: DecisionInsight[] = []
    const recommendations: DecisionAction[] = []
    const actions: DecisionAction[] = []
    const outputDeltaPct = resolveMovementDeltaPct(facts)
    const demandForecastValue = resolveDemandForecastValue(facts, outputDeltaPct)

    if (facts.materials.lowStock.length > 0) {
      const first = facts.materials.lowStock[0]
      alerts.push({
        id: 'inventory-alert-low-stock',
        kind: 'ALERT',
        title: 'Inventario critico en materiales activos',
        summary: `${facts.materials.lowStock.length} materiales ya estan por debajo del minimo operativo.`,
        severity: facts.materials.lowStock.length >= 8 ? 'HIGH' : 'MEDIUM',
        domain: 'RECURSOS',
        subdomain: 'INVENTORY',
        entityRefs: facts.materials.lowStock.map((item) => ({ type: 'material', id: item.id, label: item.nombre })),
        reasons: ['Los materiales por debajo del minimo aumentan riesgo de quiebre y bloqueo operativo.'],
        evidence: [
          `${first.nombre} tiene ${formatNumber(first.stockActual, locale)} ${first.unidadMedida} frente a minimo ${formatNumber(first.stockMinimo, locale)}.`,
        ],
      })

      actions.push({
        id: 'inventory-action-replenish',
        title: 'Reponer materiales criticos',
        description: 'Prioriza compra o traslado interno de los materiales por debajo del minimo para proteger continuidad operativa.',
        priority: 'NOW',
        owner: 'PURCHASES',
        expectedImpact: 'Reducir riesgo de quiebre de stock y retrasos en produccion o despacho.',
        href: '/dashboard/inventario',
      })
    }

    if (facts.materials.overstock.length > 0) {
      const first = facts.materials.overstock[0]
      risks.push({
        id: 'inventory-risk-overstock',
        kind: 'RISK',
        title: 'Capital inmovilizado por sobrestock',
        summary: `${facts.materials.overstock.length} materiales muestran una cobertura muy superior al minimo operativo.`,
        severity: facts.materials.overstock.length >= 8 ? 'HIGH' : 'MEDIUM',
        domain: 'RECURSOS',
        subdomain: 'INVENTORY',
        entityRefs: facts.materials.overstock.map((item) => ({ type: 'material', id: item.id, label: item.nombre })),
        reasons: ['El sobrestock inmoviliza caja, ocupa capacidad y puede esconder rotacion lenta.'],
        evidence: [
          `${first.nombre} tiene excedente estimado de ${formatNumber(first.excess, locale)} ${first.unidadMedida}${first.lastMovementAt ? `; ultimo movimiento ${formatDate(first.lastMovementAt, locale)}` : ''}.`,
        ],
      })

      recommendations.push({
        id: 'inventory-recommendation-balance-stock',
        title: 'Rebalancear materiales con sobrestock',
        description: 'Revisa traslado, consumo esperado o congelacion temporal de compra para materiales con exceso de cobertura.',
        priority: 'THIS_WEEK',
        owner: 'OPERATIONS',
        expectedImpact: 'Liberar capital inmovilizado y mejorar rotacion del inventario.',
        href: '/dashboard/inventario',
      })
    }

    if (facts.materials.lowStock.length === 0 && facts.materials.overstock.length === 0 && facts.materials.withStock > 0) {
      opportunities.push({
        id: 'inventory-opportunity-stable-stock',
        kind: 'OPPORTUNITY',
        title: 'Base de inventario en rango sano',
        summary: 'El inventario activo no muestra quiebres ni exceso dominante dentro del alcance actual.',
        severity: 'LOW',
        domain: 'RECURSOS',
        subdomain: 'INVENTORY',
        reasons: ['La cobertura actual parece alineada con la operacion base sin friccion de stock dominante.'],
        evidence: [`${facts.materials.withStock} materiales tienen stock activo y no aparecen desbalances principales.`],
      })
    }

    const lowStockRatio = facts.materials.activeCount > 0 ? facts.materials.lowStock.length / facts.materials.activeCount : 0
    const overstockRatio = facts.materials.activeCount > 0 ? facts.materials.overstock.length / facts.materials.activeCount : 0
    const healthScore = Math.max(0, Math.min(100,
      70
      - Math.min(35, lowStockRatio * 180)
      - Math.min(20, overstockRatio * 120)
      + Math.min(10, facts.movements.current.outputs)
      - Math.min(10, facts.movements.current.adjustments * 1.5)
    ))

    const kpis: DecisionKpi[] = [
      {
        id: 'inventory-kpi-active-materials',
        label: 'Materiales activos',
        value: facts.materials.activeCount,
        formattedValue: String(facts.materials.activeCount),
        status: facts.materials.activeCount > 0 ? 'POSITIVE' : 'NEUTRAL',
        note: 'Materiales activos dentro de la empresa evaluada.',
      },
      {
        id: 'inventory-kpi-low-stock',
        label: 'Stock critico',
        value: facts.materials.lowStock.length,
        formattedValue: String(facts.materials.lowStock.length),
        status: facts.materials.lowStock.length === 0 ? 'POSITIVE' : facts.materials.lowStock.length <= 3 ? 'WARNING' : 'NEGATIVE',
        note: 'Materiales por debajo del minimo configurado.',
      },
      {
        id: 'inventory-kpi-overstock',
        label: 'Sobrestock',
        value: facts.materials.overstock.length,
        formattedValue: String(facts.materials.overstock.length),
        status: facts.materials.overstock.length === 0 ? 'POSITIVE' : 'WARNING',
        note: 'Materiales con cobertura muy superior al minimo.',
      },
    ]

    const trends: DecisionTrend[] = [
      {
        id: 'inventory-trend-output',
        label: 'Salida de inventario',
        direction: outputDeltaPct == null ? 'FLAT' : outputDeltaPct > 0 ? 'UP' : outputDeltaPct < 0 ? 'DOWN' : 'FLAT',
        summary: outputDeltaPct == null
          ? 'Sin historico comparable suficiente para salidas de inventario.'
          : `Las salidas de inventario varian ${formatNumber(outputDeltaPct, locale)}% frente al periodo anterior.`,
        magnitudePct: outputDeltaPct,
      },
    ]

    const predictions: DecisionPrediction[] = [
      {
        id: 'inventory-prediction-next-risk',
        title: 'Pronóstico de demanda operativa',
        metric: 'Salidas estimadas de inventario para el siguiente periodo comparable',
        value: demandForecastValue,
        confidence: facts.movements.current.outputs >= 10 ? 'MEDIUM' : 'LOW',
        basis: [
          `Salidas actuales: ${formatNumber(facts.movements.current.outputs, locale)}.`,
          outputDeltaPct == null
            ? 'Aún no hay histórico suficiente para una tendencia robusta; se usa la ventana actual como base.'
            : `Variación reciente de salidas: ${formatNumber(outputDeltaPct, locale)}%.`,
          `Materiales en stock crítico: ${facts.materials.lowStock.length}.`,
        ],
      },
    ]

    return {
      healthScore,
      healthStatus: healthScore >= 80 ? 'BUENO' : healthScore >= 55 ? 'ATENCION' : 'CRITICO',
      executiveSummary: `Inventario muestra ${facts.materials.lowStock.length} materiales criticos, ${facts.materials.overstock.length} con sobrestock y ${facts.movements.current.outputs} salidas registradas en la ventana actual.`,
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
          id: 'inventory-critical-stock',
          label: 'Cobertura critica',
          score: Math.max(0, 40 - facts.materials.lowStock.length * 6),
          maxScore: 40,
          summary: `${facts.materials.lowStock.length} materiales ya estan por debajo del minimo operativo.`,
        },
        {
          id: 'inventory-balance',
          label: 'Balance de cobertura',
          score: Math.max(0, 30 - facts.materials.overstock.length * 4),
          maxScore: 30,
          summary: `${facts.materials.overstock.length} materiales concentran exceso de cobertura.`,
        },
        {
          id: 'inventory-activity',
          label: 'Actividad reciente',
          score: Math.min(30, facts.movements.current.entries + facts.movements.current.outputs),
          maxScore: 30,
          summary: `${facts.movements.current.entries} entradas y ${facts.movements.current.outputs} salidas en la ventana actual.`,
        },
      ],
    }
  },
}