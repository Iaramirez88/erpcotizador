import { prisma } from '@/lib/prisma'
import type { DecisionAction, DecisionAnalyzerPlugin, DecisionEngineContext, DecisionInsight, DecisionKpi, DecisionPrediction, DecisionTrend } from '@/lib/decision-engine/contracts'
import { collectPurchasesFacts, type PurchasesDecisionFacts } from '@/lib/decision-engine/collectors/purchases-collector'
import { buildActionExplanation, buildInsightExplanation } from '@/lib/decision-engine/explainability'

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

function resolvePurchaseGrowthPct(facts: PurchasesDecisionFacts) {
  const previous = facts.purchases.previous.total
  const current = facts.purchases.current.total
  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

export const purchasesAnalyzerPlugin: DecisionAnalyzerPlugin<PurchasesDecisionFacts> = {
  key: 'purchases',
  collect(context: DecisionEngineContext) {
    return collectPurchasesFacts({ ...context, prisma })
  },
  async analyze(facts, context) {
    const locale = context.locale || 'es-CO'
    const alerts: DecisionInsight[] = []
    const risks: DecisionInsight[] = []
    const opportunities: DecisionInsight[] = []
    const recommendations: DecisionAction[] = []
    const actions: DecisionAction[] = []
    const purchaseGrowthPct = resolvePurchaseGrowthPct(facts)

    if (facts.replenishment.urgentMaterials.length > 0) {
      const material = facts.replenishment.urgentMaterials[0]
      alerts.push({
        id: 'purchases-alert-urgent-replenishment',
        kind: 'ALERT',
        title: 'Compras urgentes por quiebre de stock',
        summary: `${facts.replenishment.urgentMaterials.length} materiales requieren compra o traslado urgente por estar por debajo del minimo.`,
        severity: facts.replenishment.urgentMaterials.length >= 6 ? 'HIGH' : 'MEDIUM',
        domain: 'RECURSOS',
        subdomain: 'PURCHASES',
        entityRefs: facts.replenishment.urgentMaterials.map((item) => ({ type: 'material', id: item.id, label: item.nombre })),
        reasons: ['Los faltantes de materiales deben traducirse en cola priorizada de abastecimiento para no romper la operacion.'],
        evidence: [`${material.nombre} tiene faltante estimado de ${material.shortfall} sobre minimo ${material.stockMinimo}.`],
      })

      actions.push({
        id: 'purchases-action-create-urgent-order',
        title: 'Generar orden de compra urgente',
        description: 'Convierte los materiales criticos en una cola inmediata de compra o traslado para proteger continuidad operativa.',
        priority: 'NOW',
        owner: 'PURCHASES',
        expectedImpact: 'Reducir riesgo de parada operativa por faltantes de abastecimiento.',
        href: '/dashboard/compras',
      })
    }

    if (facts.costSignals.increasedItems.length > 0) {
      const item = facts.costSignals.increasedItems[0]
      risks.push({
        id: 'purchases-risk-cost-increase',
        kind: 'RISK',
        title: 'Incremento de costo en insumos comprados',
        summary: `${facts.costSignals.increasedItems.length} items muestran alza relevante de precio frente al periodo previo.`,
        severity: item.increasePct >= 25 ? 'HIGH' : 'MEDIUM',
        domain: 'RECURSOS',
        subdomain: 'PURCHASES',
        reasons: ['El incremento en costo unitario presiona margen y puede requerir ajuste de compra, tarifa o proveedor.'],
        evidence: [
          `${item.descripcion} sube ${formatPercent(item.increasePct, locale)}%: ${formatCurrency(item.previousAvg, locale)} -> ${formatCurrency(item.currentAvg, locale)}.`,
        ],
        impact: {
          label: 'Variacion promedio del item principal',
          amount: item.currentAvg - item.previousAvg,
          currency: 'COP',
        },
      })

      recommendations.push({
        id: 'purchases-recommendation-review-costs',
        title: 'Revisar proveedor o precio de insumos',
        description: 'Analiza los items con mayor alza para renegociar proveedor o ajustar la politica comercial aguas abajo.',
        priority: 'THIS_WEEK',
        owner: 'PURCHASES',
        expectedImpact: 'Contener presion de costo y proteger margen operativo.',
        href: '/dashboard/compras',
      })
    }

    if (facts.purchases.pendingAuthorization.length > 0 || facts.purchases.unpaid.length > 0) {
      const pendingCount = facts.purchases.pendingAuthorization.length
      const unpaidBalance = facts.purchases.unpaid.reduce((sum, purchase) => sum + purchase.balance, 0)
      risks.push({
        id: 'purchases-risk-approval-cashflow',
        kind: 'RISK',
        title: 'Friccion de autorizacion o cartera por pagar',
        summary: `${pendingCount} compras siguen sin autorizar y el saldo pendiente asciende a ${formatCurrency(unpaidBalance, locale)}.`,
        severity: unpaidBalance > 10000000 || pendingCount >= 5 ? 'HIGH' : 'MEDIUM',
        domain: 'RECURSOS',
        subdomain: 'PURCHASES',
        reasons: ['La compra no autorizada o con saldo alto puede retrasar abastecimiento y tensionar caja operativa.'],
        evidence: [
          pendingCount > 0 ? `${pendingCount} compras esperan autorizacion.` : 'No hay autorizaciones pendientes relevantes.',
          `Saldo pendiente agregado: ${formatCurrency(unpaidBalance, locale)}.`,
        ],
      })
    }

    if (facts.purchases.current.count > 0 && facts.purchases.current.unpaidBalance === 0) {
      opportunities.push({
        id: 'purchases-opportunity-clean-ledger',
        kind: 'OPPORTUNITY',
        title: 'Abastecimiento con cartera controlada',
        summary: 'La cartera de compras del periodo no muestra saldo pendiente dominante.',
        severity: 'LOW',
        domain: 'RECURSOS',
        subdomain: 'PURCHASES',
        reasons: ['Una compra pagada y autorizada con disciplina reduce friccion operativa con proveedores.'],
        evidence: [`Se registran ${facts.purchases.current.count} compras en el periodo con saldo controlado.`],
      })
    }

    const healthScore = Math.max(0, Math.min(100,
      68
      - Math.min(30, facts.replenishment.urgentMaterials.length * 5)
      - Math.min(18, facts.costSignals.increasedItems.length * 4)
      - Math.min(20, facts.purchases.pendingAuthorization.length * 3)
      - Math.min(20, facts.purchases.current.unpaidBalance / 1000000)
      + Math.min(12, facts.purchases.current.count)
    ))

    const kpis: DecisionKpi[] = [
      {
        id: 'purchases-kpi-total',
        label: 'Compra registrada',
        value: facts.purchases.current.total,
        formattedValue: formatCurrency(facts.purchases.current.total, locale),
        status: facts.purchases.current.total > 0 ? 'POSITIVE' : 'NEUTRAL',
        deltaPct: purchaseGrowthPct,
        note: `${facts.purchases.current.count} compras no anuladas en el periodo.`,
      },
      {
        id: 'purchases-kpi-unpaid-balance',
        label: 'Saldo pendiente',
        value: facts.purchases.current.unpaidBalance,
        formattedValue: formatCurrency(facts.purchases.current.unpaidBalance, locale),
        status: facts.purchases.current.unpaidBalance === 0 ? 'POSITIVE' : facts.purchases.current.unpaidBalance < 3000000 ? 'WARNING' : 'NEGATIVE',
        note: `${facts.purchases.current.unpaidCount} compras conservan saldo abierto.`,
      },
      {
        id: 'purchases-kpi-pending-auth',
        label: 'Pendientes por autorizar',
        value: facts.purchases.pendingAuthorization.length,
        formattedValue: String(facts.purchases.pendingAuthorization.length),
        status: facts.purchases.pendingAuthorization.length === 0 ? 'POSITIVE' : 'WARNING',
        note: 'Compras o pedidos que aun no completan flujo de autorizacion.',
      },
    ]

    const trends: DecisionTrend[] = [
      {
        id: 'purchases-trend-total',
        label: 'Tendencia de compras',
        direction: purchaseGrowthPct == null ? 'FLAT' : purchaseGrowthPct > 0 ? 'UP' : purchaseGrowthPct < 0 ? 'DOWN' : 'FLAT',
        summary: purchaseGrowthPct == null
          ? 'Sin historico comparable suficiente para leer tendencia de compras.'
          : `El valor comprado varia ${formatPercent(purchaseGrowthPct, locale)}% frente al periodo anterior.`,
        magnitudePct: purchaseGrowthPct,
      },
    ]

    const predictions: DecisionPrediction[] = [
      {
        id: 'purchases-prediction-next-pressure',
        title: 'Presion de abastecimiento inmediata',
        metric: 'Frentes de compra que requeriran seguimiento prioritario',
        value: facts.replenishment.urgentMaterials.length + facts.costSignals.increasedItems.length + facts.purchases.pendingAuthorization.length,
        confidence: facts.purchases.current.count >= 5 ? 'MEDIUM' : 'LOW',
        basis: [
          `Materiales urgentes: ${facts.replenishment.urgentMaterials.length}.`,
          `Items con alza de costo: ${facts.costSignals.increasedItems.length}.`,
        ],
      },
    ]

    return {
      healthScore,
      healthStatus: healthScore >= 80 ? 'BUENO' : healthScore >= 55 ? 'ATENCION' : 'CRITICO',
      executiveSummary: `Compras muestra ${facts.replenishment.urgentMaterials.length} materiales con urgencia de abastecimiento, ${facts.costSignals.increasedItems.length} señales de alza de costo y ${facts.purchases.pendingAuthorization.length} compras pendientes por autorizar.`,
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
          id: 'purchases-replenishment',
          label: 'Urgencia de abastecimiento',
          score: Math.max(0, 35 - facts.replenishment.urgentMaterials.length * 6),
          maxScore: 35,
          summary: `${facts.replenishment.urgentMaterials.length} materiales requieren reposicion prioritaria.`,
        },
        {
          id: 'purchases-cost-pressure',
          label: 'Presion de costo',
          score: Math.max(0, 30 - facts.costSignals.increasedItems.length * 5),
          maxScore: 30,
          summary: `${facts.costSignals.increasedItems.length} items muestran alza de precio relevante.`,
        },
        {
          id: 'purchases-flow',
          label: 'Flujo de compras',
          score: Math.max(0, 35 - facts.purchases.pendingAuthorization.length * 4 - Math.min(15, facts.purchases.current.unpaidBalance / 2000000)),
          maxScore: 35,
          summary: `${facts.purchases.pendingAuthorization.length} pendientes por autorizar y saldo abierto de ${formatCurrency(facts.purchases.current.unpaidBalance, locale)}.`,
        },
      ],
    }
  },
}