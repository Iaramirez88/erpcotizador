import { prisma } from '@/lib/prisma'
import type {
  DecisionAction,
  DecisionAnalyzerPlugin,
  DecisionEngineContext,
  DecisionInsight,
  DecisionKpi,
  DecisionPrediction,
  DecisionTrend,
} from '@/lib/decision-engine/contracts'
import { collectCompanyFacts, type CompanyDecisionFacts } from '@/lib/decision-engine/collectors/company-collector'
import { buildActionExplanation, buildInsightExplanation } from '@/lib/decision-engine/explainability'
import { computeHealthScore } from '@/lib/decision-engine/health-score'
import { buildExecutiveSummary } from '@/lib/decision-engine/summarizers/executive-summary'

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

function resolveSalesGrowthPct(facts: CompanyDecisionFacts) {
  const previous = facts.sales.previous.netSales
  const current = facts.sales.current.netSales

  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function buildInsights(facts: CompanyDecisionFacts, locale: string) {
  const risks: DecisionInsight[] = []
  const alerts: DecisionInsight[] = []
  const opportunities: DecisionInsight[] = []
  const recommendations: DecisionAction[] = []
  const actions: DecisionAction[] = []

  const salesGrowthPct = resolveSalesGrowthPct(facts)
  const overdueQuotesCount = facts.quotes.overdueQuotes.length
  const staleOpportunitiesCount = facts.crm.staleOpportunities.length
  const pipelineCoverageRatio = facts.sales.current.netSales > 0
    ? facts.crm.openOpportunityValue / facts.sales.current.netSales
    : facts.crm.openOpportunityValue > 0
      ? 1
      : 0

  if (salesGrowthPct != null && salesGrowthPct <= -10) {
    risks.push({
      id: 'risk-sales-decline',
      kind: 'RISK',
      title: 'Caída comercial relevante',
      summary: `La venta neta cayó ${formatPercent(Math.abs(salesGrowthPct), locale)}% frente al periodo anterior.`,
      severity: salesGrowthPct <= -20 ? 'CRITICAL' : 'HIGH',
      domain: 'VENTAS',
      subdomain: 'POS',
      reasons: ['La comparación contra el periodo previo muestra contracción de ingreso neto.'],
      evidence: [
        `Ventas netas actuales: ${formatCurrency(facts.sales.current.netSales, locale)}.`,
        `Ventas netas previas: ${formatCurrency(facts.sales.previous.netSales, locale)}.`,
      ],
      impact: {
        label: 'Diferencia neta estimada',
        amount: facts.sales.current.netSales - facts.sales.previous.netSales,
        currency: 'COP',
      },
    })

    recommendations.push({
      id: 'action-recover-sales',
      title: 'Activar recuperación comercial inmediata',
      description: 'Prioriza reactivación de clientes recientes, seguimiento de cotizaciones vivas y cierre del pipeline abierto.',
      priority: 'NOW',
      owner: 'MANAGEMENT',
      expectedImpact: 'Reducir la caída comercial y acelerar el cierre del pipeline activo.',
      href: '/dashboard/reportes',
    })
  }

  if (staleOpportunitiesCount > 0) {
    const topStale = facts.crm.staleOpportunities[0]

    risks.push({
      id: 'risk-stale-opportunities',
      kind: 'RISK',
      title: 'Pipeline con oportunidades estancadas',
      summary: `${staleOpportunitiesCount} oportunidades abiertas no muestran movimiento reciente.`,
      severity: staleOpportunitiesCount >= 5 ? 'HIGH' : 'MEDIUM',
      domain: 'CAPTACION',
      subdomain: 'OPPORTUNITIES',
      entityRefs: facts.crm.staleOpportunities.map((opportunity) => ({
        type: 'crmOpportunity',
        id: opportunity.id,
        label: opportunity.title,
      })),
      reasons: ['Las oportunidades sin actualización tienden a degradar su probabilidad real de cierre.'],
      evidence: [
        `La oportunidad más antigua sin movimiento es ${topStale?.title || 'sin título'} desde ${topStale ? formatDate(topStale.updatedAt, locale) : 'fecha desconocida'}.`,
      ],
    })

    actions.push({
      id: 'action-revive-opportunities',
      title: 'Revisar oportunidades estancadas',
      description: 'Asigna seguimiento a las oportunidades abiertas sin movimiento y decide si deben avanzar, reactivarse o cerrarse.',
      priority: 'THIS_WEEK',
      owner: 'CRM',
      expectedImpact: 'Mejorar la lectura real del pipeline y recuperar cierres probables.',
      href: '/dashboard/crm/oportunidades',
    })
  }

  if (overdueQuotesCount > 0) {
    const firstDue = facts.quotes.overdueQuotes[0]

    alerts.push({
      id: 'alert-overdue-quotes',
      kind: 'ALERT',
      title: 'Cotizaciones sin mover o vencidas',
      summary: `${overdueQuotesCount} cotizaciones requieren atención inmediata para no perder tracción comercial.`,
      severity: overdueQuotesCount >= 5 ? 'HIGH' : 'MEDIUM',
      domain: 'VENTAS',
      subdomain: 'QUOTES',
      entityRefs: facts.quotes.overdueQuotes.map((quote) => ({
        type: 'cotizacion',
        id: quote.id,
        label: quote.numero,
      })),
      reasons: ['Las cotizaciones que superan su ventana de validez pierden probabilidad de cierre y distorsionan el pipeline comercial.'],
      evidence: [
        `La más antigua del lote es ${firstDue?.numero || 'sin número'} con vencimiento estimado el ${firstDue ? formatDate(firstDue.dueAt, locale) : 'sin fecha'}.`,
      ],
    })

    actions.push({
      id: 'action-reactivate-quotes',
      title: 'Reactivar cotizaciones pendientes',
      description: 'Contacta hoy las cotizaciones sin respuesta y actualiza su estado comercial antes de que sigan envejeciendo.',
      priority: 'NOW',
      owner: 'SALES',
      expectedImpact: 'Recuperar oportunidades próximas a cierre o limpiar el pipeline documental.',
      href: '/dashboard/cotizaciones',
    })
  }

  if (facts.crm.openOpportunityValue > 0 && pipelineCoverageRatio >= 1.2) {
    opportunities.push({
      id: 'opportunity-pipeline-coverage',
      kind: 'OPPORTUNITY',
      title: 'Cobertura comercial aprovechable',
      summary: `El valor del pipeline abierto ya cubre ${formatPercent(pipelineCoverageRatio * 100, locale)}% de la venta neta del periodo.`,
      severity: 'MEDIUM',
      domain: 'CAPTACION',
      subdomain: 'OPPORTUNITIES',
      reasons: ['Existe volumen potencial suficiente en oportunidades abiertas para sostener la siguiente ventana comercial.'],
      evidence: [
        `Valor del pipeline abierto: ${formatCurrency(facts.crm.openOpportunityValue, locale)}.`,
        `Venta neta del periodo: ${formatCurrency(facts.sales.current.netSales, locale)}.`,
      ],
      impact: {
        label: 'Valor potencial en pipeline',
        amount: facts.crm.openOpportunityValue,
        currency: 'COP',
      },
    })

    recommendations.push({
      id: 'action-push-pipeline',
      title: 'Empujar pipeline con mejor probabilidad',
      description: 'Enfoca al equipo comercial en las oportunidades activas con mejor combinación de valor y probabilidad de cierre.',
      priority: 'THIS_WEEK',
      owner: 'CRM',
      expectedImpact: 'Convertir el pipeline abierto en ingresos concretos en la próxima ventana.',
      href: '/dashboard/crm/oportunidades',
    })
  }

  if (facts.notifications.unreadCount >= 10) {
    alerts.push({
      id: 'alert-notification-backlog',
      kind: 'ALERT',
      title: 'Acumulación de pendientes operativos',
      summary: `Hay ${facts.notifications.unreadCount} notificaciones sin leer dentro del alcance actual.`,
      severity: facts.notifications.unreadCount >= 20 ? 'HIGH' : 'MEDIUM',
      domain: 'CORE',
      subdomain: 'DASHBOARD',
      reasons: ['La acumulación de pendientes suele retrasar decisiones o ejecución.'],
      evidence: [`Notificaciones pendientes: ${facts.notifications.unreadCount}.`],
    })
  }

  if (facts.resources.lowStockCount > 0) {
    alerts.push({
      id: 'alert-low-stock-company',
      kind: 'ALERT',
      title: 'Abastecimiento crítico detectado',
      summary: `${facts.resources.lowStockCount} materiales están por debajo del mínimo dentro del alcance actual.`,
      severity: facts.resources.lowStockCount >= 6 ? 'HIGH' : 'MEDIUM',
      domain: 'RECURSOS',
      subdomain: 'INVENTORY',
      reasons: ['El faltante crítico de materiales ya afecta la continuidad operativa y debe escalarse a gerencia.'],
      evidence: [`Materiales en faltante crítico: ${facts.resources.lowStockCount}.`],
    })
  }

  if (facts.resources.pendingSupplyRequestCount > 0) {
    alerts.push({
      id: 'alert-pending-supply-requests',
      kind: 'ALERT',
      title: 'Solicitudes internas de abastecimiento pendientes',
      summary: `Hay ${facts.resources.pendingSupplyRequestCount} solicitudes entre sedes esperando atención.` ,
      severity: facts.resources.pendingSupplyRequestCount >= 5 ? 'HIGH' : 'MEDIUM',
      domain: 'RECURSOS',
      subdomain: 'INVENTORY',
      reasons: ['Las sedes hijas ya reportaron necesidad de productos y la sede padre aún no las atiende.'],
      evidence: [`Solicitudes pendientes: ${facts.resources.pendingSupplyRequestCount}.`],
    })

    actions.push({
      id: 'action-review-supply-requests',
      title: 'Atender solicitudes entre sedes',
      description: 'Revisa la cola de abastecimiento interno, prioriza urgentes y despacha desde la sede padre.',
      priority: 'NOW',
      owner: 'OPERATIONS',
      expectedImpact: 'Reducir faltantes operativos en sedes hijas y mejorar tiempos de respuesta internos.',
      href: '/dashboard/inventario/abastecimiento',
    })
  }

  if (facts.operations.overdueOrdersCount > 0) {
    risks.push({
      id: 'risk-overdue-work-orders',
      kind: 'RISK',
      title: 'Órdenes de trabajo retrasadas',
      summary: `${facts.operations.overdueOrdersCount} órdenes activas ya superan su fecha de entrega comprometida.`,
      severity: facts.operations.overdueOrdersCount >= 5 ? 'HIGH' : 'MEDIUM',
      domain: 'OPERACIONES',
      subdomain: 'WORK_ORDERS',
      reasons: ['Los atrasos operativos ya afectan cumplimiento y reputación frente al cliente.'],
      evidence: [`Órdenes retrasadas detectadas: ${facts.operations.overdueOrdersCount}.`],
    })

    actions.push({
      id: 'action-recover-operations',
      title: 'Intervenir cola operativa atrasada',
      description: 'Revisa órdenes retrasadas, reasigna capacidad y elimina bloqueos de producción visibles.',
      priority: 'NOW',
      owner: 'OPERATIONS',
      expectedImpact: 'Reducir atraso operativo y mejorar cumplimiento de entrega.',
      href: '/dashboard/ordenes',
    })
  }

  if (facts.resources.pendingPurchaseAuthorizationCount > 0) {
    recommendations.push({
      id: 'action-authorize-purchases',
      title: 'Destrabar compras pendientes',
      description: 'Prioriza la autorización de compras abiertas cuando el frente de abastecimiento ya está afectando la operación.',
      priority: 'THIS_WEEK',
      owner: 'MANAGEMENT',
      expectedImpact: 'Reducir fricción entre compras, inventario y producción.',
      href: '/dashboard/compras',
    })
  }

  if (facts.finance.netCashflow < 0 || facts.finance.receivablesCount > 0) {
    risks.push({
      id: 'risk-finance-cashflow-receivables',
      kind: 'RISK',
      title: 'Caja y cartera requieren atención gerencial',
      summary: `El flujo neto estimado es ${formatCurrency(facts.finance.netCashflow, locale)} y hay ${facts.finance.receivablesCount} saldos por cobrar visibles.`,
      severity: facts.finance.netCashflow < 0 && facts.finance.receivablesAmount >= 5000000 ? 'HIGH' : 'MEDIUM',
      domain: 'FINANZAS',
      subdomain: 'ACCOUNTING',
      reasons: ['La lectura financiera consolidada debe considerar tanto recaudo pendiente como presión inmediata de caja.'],
      evidence: [
        `Cartera visible: ${formatCurrency(facts.finance.receivablesAmount, locale)}.`,
        `Comprobantes en borrador: ${facts.finance.draftVouchersCount}.`,
      ],
    })

    actions.push({
      id: 'action-protect-company-cashflow',
      title: 'Intervenir recaudo y cierre financiero',
      description: 'Acelera recaudo, depura comprobantes en borrador y protege caja antes de ampliar compromisos operativos.',
      priority: 'NOW',
      owner: 'FINANCE',
      expectedImpact: 'Reducir tensión de liquidez y mejorar visibilidad gerencial del cierre.',
      href: '/dashboard/contabilidad',
    })
  }

  return {
    risks,
    alerts,
    opportunities,
    recommendations,
    actions,
    salesGrowthPct,
    pipelineCoverageRatio,
  }
}

function buildKpis(facts: CompanyDecisionFacts, locale: string, salesGrowthPct: number | null): DecisionKpi[] {
  return [
    {
      id: 'kpi-net-sales',
      label: 'Venta neta',
      value: facts.sales.current.netSales,
      formattedValue: formatCurrency(facts.sales.current.netSales, locale),
      status: salesGrowthPct != null && salesGrowthPct < 0 ? 'NEGATIVE' : 'POSITIVE',
      deltaPct: salesGrowthPct,
      note: `Basado en ${facts.sales.current.invoicesCount} facturas POS netas de devoluciones.`,
    },
    {
      id: 'kpi-active-customers',
      label: 'Clientes activos',
      value: facts.sales.current.uniqueCustomers,
      formattedValue: String(facts.sales.current.uniqueCustomers),
      status: facts.sales.current.uniqueCustomers > 0 ? 'POSITIVE' : 'NEUTRAL',
      note: 'Clientes con compra neta en el periodo consultado.',
    },
    {
      id: 'kpi-open-pipeline',
      label: 'Pipeline abierto',
      value: facts.crm.openOpportunityValue,
      formattedValue: formatCurrency(facts.crm.openOpportunityValue, locale),
      status: facts.crm.openOpportunityValue > 0 ? 'POSITIVE' : 'WARNING',
      note: `${facts.crm.openOpportunities} oportunidades abiertas en el alcance actual.`,
    },
    {
      id: 'kpi-overdue-quotes',
      label: 'Cotizaciones por mover',
      value: facts.quotes.overdueQuotes.length,
      formattedValue: String(facts.quotes.overdueQuotes.length),
      status: facts.quotes.overdueQuotes.length === 0 ? 'POSITIVE' : 'WARNING',
      note: 'Cotizaciones abiertas que ya superaron su ventana esperada.',
    },
    {
      id: 'kpi-pending-supply-requests',
      label: 'Abastecimientos pendientes',
      value: facts.resources.pendingSupplyRequestCount,
      formattedValue: String(facts.resources.pendingSupplyRequestCount),
      status: facts.resources.pendingSupplyRequestCount === 0 ? 'POSITIVE' : 'WARNING',
      note: 'Solicitudes internas entre sedes todavía sin atender.',
    },
  ]
}

function buildTrends(facts: CompanyDecisionFacts, locale: string, salesGrowthPct: number | null): DecisionTrend[] {
  return [
    {
      id: 'trend-sales',
      label: 'Tendencia comercial',
      direction: salesGrowthPct == null ? 'FLAT' : salesGrowthPct > 0 ? 'UP' : salesGrowthPct < 0 ? 'DOWN' : 'FLAT',
      summary: salesGrowthPct == null
        ? 'Sin histórico suficiente para evaluar tendencia de ventas.'
        : `Comparado con el periodo anterior, la venta neta varía ${formatPercent(salesGrowthPct, locale)}%.`,
      magnitudePct: salesGrowthPct,
    },
    {
      id: 'trend-pipeline',
      label: 'Tensión del pipeline',
      direction: facts.crm.staleOpportunities.length > 0 ? 'DOWN' : 'UP',
      summary: facts.crm.staleOpportunities.length > 0
        ? `Se detectan ${facts.crm.staleOpportunities.length} oportunidades sin movimiento reciente.`
        : 'El pipeline no muestra oportunidades claramente estancadas en la lectura actual.',
    },
  ]
}

function buildPredictions(facts: CompanyDecisionFacts, locale: string, salesGrowthPct: number | null): DecisionPrediction[] {
  const baseline = facts.sales.current.netSales
  const projectedGrowth = salesGrowthPct == null ? 0 : Math.max(-20, Math.min(20, salesGrowthPct * 0.5))
  const projectedSales = Math.max(0, baseline * (1 + projectedGrowth / 100))

  return [
    {
      id: 'prediction-next-sales-window',
      title: 'Proyección comercial base',
      metric: 'Ventas netas del siguiente periodo comparable',
      value: projectedSales,
      confidence: facts.sales.current.invoicesCount >= 10 && facts.sales.previous.invoicesCount >= 10 ? 'MEDIUM' : 'LOW',
      basis: [
        `Base actual: ${formatCurrency(baseline, locale)}.`,
        `Ajuste heurístico aplicado: ${formatPercent(projectedGrowth, locale)}%.`,
        'La proyección actual es heurística y todavía no usa modelo estadístico ni snapshot histórico persistido.',
      ],
    },
  ]
}

export const companyAnalyzerPlugin: DecisionAnalyzerPlugin<CompanyDecisionFacts> = {
  key: 'company',
  collect(context: DecisionEngineContext) {
    return collectCompanyFacts({
      ...context,
      prisma,
    })
  },
  async analyze(facts, context) {
    const locale = context.locale || 'es-CO'
    const insightBundle = buildInsights(facts, locale)
    const health = computeHealthScore({
      salesGrowthPct: insightBundle.salesGrowthPct,
      pipelineCoverageRatio: insightBundle.pipelineCoverageRatio,
      overdueQuotes: facts.quotes.overdueQuotes.length,
      staleOpportunities: facts.crm.staleOpportunities.length,
      unreadNotifications: facts.notifications.unreadCount,
      lowStockCount: facts.resources.lowStockCount,
      pendingPurchaseAuthorizationCount: facts.resources.pendingPurchaseAuthorizationCount,
      pendingSupplyRequestCount: facts.resources.pendingSupplyRequestCount,
      overdueOrdersCount: facts.operations.overdueOrdersCount,
      unassignedActiveOrdersCount: facts.operations.unassignedActiveOrdersCount,
      operatingResult: facts.finance.operatingResult,
      netCashflow: facts.finance.netCashflow,
      receivablesCount: facts.finance.receivablesCount,
      draftVouchersCount: facts.finance.draftVouchersCount,
    })

    const kpis = buildKpis(facts, locale, insightBundle.salesGrowthPct)
    const trends = buildTrends(facts, locale, insightBundle.salesGrowthPct)
    const predictions = buildPredictions(facts, locale, insightBundle.salesGrowthPct)

    const executiveSummary = buildExecutiveSummary({
      healthStatus: health.healthStatus,
      salesGrowthPct: insightBundle.salesGrowthPct,
      overdueQuotes: facts.quotes.overdueQuotes.length,
      staleOpportunities: facts.crm.staleOpportunities.length,
      lowStockCount: facts.resources.lowStockCount,
      pendingPurchaseAuthorizationCount: facts.resources.pendingPurchaseAuthorizationCount,
      pendingSupplyRequestCount: facts.resources.pendingSupplyRequestCount,
      overdueOrdersCount: facts.operations.overdueOrdersCount,
      netCashflow: facts.finance.netCashflow,
      receivablesCount: facts.finance.receivablesCount,
      receivablesAmount: facts.finance.receivablesAmount,
      draftVouchersCount: facts.finance.draftVouchersCount,
      opportunities: insightBundle.opportunities,
      risks: insightBundle.risks,
    })

    const explainability = [
      ...health.dimensions.map((dimension) => ({
        id: `health-${dimension.id}`,
        title: dimension.label,
        details: [dimension.summary, `Puntaje obtenido: ${dimension.score}/${dimension.maxScore}.`],
      })),
      ...insightBundle.risks.map(buildInsightExplanation),
      ...insightBundle.alerts.map(buildInsightExplanation),
      ...insightBundle.opportunities.map(buildInsightExplanation),
      ...insightBundle.recommendations.map(buildActionExplanation),
      ...insightBundle.actions.map(buildActionExplanation),
    ]

    return {
      healthScore: health.healthScore,
      healthStatus: health.healthStatus,
      executiveSummary,
      alerts: insightBundle.alerts,
      opportunities: insightBundle.opportunities,
      recommendations: insightBundle.recommendations,
      predictions,
      risks: insightBundle.risks,
      kpis,
      trends,
      actions: insightBundle.actions,
      explainability,
      healthBreakdown: health.dimensions,
    }
  },
}