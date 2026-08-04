import { prisma } from '@/lib/prisma'
import type { DecisionAction, DecisionAnalyzerPlugin, DecisionEngineContext, DecisionInsight, DecisionKpi, DecisionPrediction, DecisionTrend } from '@/lib/decision-engine/contracts'
import { collectSalesFacts, type SalesDecisionFacts } from '@/lib/decision-engine/collectors/sales-collector'
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

function resolveSalesGrowthPct(facts: SalesDecisionFacts) {
  const previous = facts.invoices.previous.netSales
  const current = facts.invoices.current.netSales
  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function resolveSalesForecastValue(facts: SalesDecisionFacts, salesGrowthPct: number | null, quoteApprovalPct: number) {
  const trendFactor = ((salesGrowthPct ?? 0) * 0.4) / 100
  const approvalFactor = Math.min(0.12, quoteApprovalPct / 500)
  return Math.max(0, facts.invoices.current.netSales * (1 + trendFactor + approvalFactor))
}

export const salesAnalyzerPlugin: DecisionAnalyzerPlugin<SalesDecisionFacts> = {
  key: 'sales',
  collect(context: DecisionEngineContext) {
    return collectSalesFacts({ ...context, prisma })
  },
  async analyze(facts, context) {
    const locale = context.locale || 'es-CO'
    const alerts: DecisionInsight[] = []
    const risks: DecisionInsight[] = []
    const opportunities: DecisionInsight[] = []
    const recommendations: DecisionAction[] = []
    const actions: DecisionAction[] = []
    const salesGrowthPct = resolveSalesGrowthPct(facts)
    const quoteApprovalPct = facts.quotes.createdThisPeriod > 0 ? (facts.quotes.approvedThisPeriod / facts.quotes.createdThisPeriod) * 100 : 0
    const salesForecastValue = resolveSalesForecastValue(facts, salesGrowthPct, quoteApprovalPct)

    if (salesGrowthPct != null && salesGrowthPct < 0) {
      risks.push({
        id: 'sales-risk-decline',
        kind: 'RISK',
        title: 'Caída de ventas frente al periodo anterior',
        summary: `La venta neta varía ${formatPercent(salesGrowthPct, locale)}% frente al periodo anterior.`,
        severity: salesGrowthPct <= -15 ? 'HIGH' : 'MEDIUM',
        domain: 'VENTAS',
        subdomain: 'POS',
        reasons: ['La venta neta comparada contra el periodo previo muestra deterioro comercial.'],
        evidence: [
          `Venta actual: ${formatCurrency(facts.invoices.current.netSales, locale)}.`,
          `Venta previa: ${formatCurrency(facts.invoices.previous.netSales, locale)}.`,
        ],
        impact: {
          label: 'Brecha neta frente al periodo anterior',
          amount: facts.invoices.current.netSales - facts.invoices.previous.netSales,
          currency: 'COP',
        },
      })
    }

    if (facts.quotes.overdue.length > 0) {
      const quote = facts.quotes.overdue[0]
      alerts.push({
        id: 'sales-alert-overdue-quotes',
        kind: 'ALERT',
        title: 'Cotizaciones próximas a perder tracción',
        summary: `${facts.quotes.overdue.length} cotizaciones abiertas ya superaron su ventana esperada.`,
        severity: facts.quotes.overdue.length >= 5 ? 'HIGH' : 'MEDIUM',
        domain: 'VENTAS',
        subdomain: 'QUOTES',
        entityRefs: facts.quotes.overdue.map((item) => ({ type: 'cotizacion', id: item.id, label: item.numero })),
        reasons: ['Las cotizaciones envejecidas reducen probabilidad de cierre y distorsionan el embudo comercial.'],
        evidence: [
          `La más antigua del lote es ${quote.numero} con vencimiento estimado el ${formatDate(quote.dueAt, locale)}.`,
        ],
      })

      actions.push({
        id: 'sales-action-recover-quotes',
        title: 'Recuperar cotizaciones abiertas',
        description: 'Prioriza contacto con las cotizaciones vencidas o sin respuesta para acelerar cierre o limpiar el embudo.',
        priority: 'NOW',
        owner: 'SALES',
        expectedImpact: 'Mejorar conversión efectiva y recuperar ingreso cercano.',
        href: '/dashboard/cotizaciones',
      })
    }

    if (facts.customers.topBuyers.length > 0) {
      const topBuyer = facts.customers.topBuyers[0]
      opportunities.push({
        id: 'sales-opportunity-top-buyers',
        kind: 'OPPORTUNITY',
        title: 'Clientes con mayor tracción de compra',
        summary: `${facts.customers.topBuyers.length} clientes ya concentran el mayor volumen neto del periodo.`,
        severity: 'MEDIUM',
        domain: 'VENTAS',
        subdomain: 'CUSTOMERS',
        entityRefs: facts.customers.topBuyers.map((item) => ({ type: 'customer', id: item.key, label: item.label })),
        reasons: ['Los mejores compradores actuales son una base natural para recompra, upsell o fidelización activa.'],
        evidence: [
          `El principal cliente del periodo es ${topBuyer.label} con ${formatCurrency(topBuyer.total, locale)} en ${topBuyer.count} compras.`,
        ],
        impact: {
          label: 'Venta concentrada en top compradores',
          amount: facts.customers.topBuyers.reduce((sum, item) => sum + item.total, 0),
          currency: 'COP',
        },
      })

      recommendations.push({
        id: 'sales-recommendation-repeat-buyers',
        title: 'Activar recompra sobre clientes con más movimiento',
        description: 'Usa la base de clientes con mayor ticket o frecuencia para campañas de recompra y venta cruzada.',
        priority: 'THIS_WEEK',
        owner: 'SALES',
        expectedImpact: 'Aumentar ingreso incremental con menor costo comercial.',
        href: '/dashboard/clientes',
      })
    }

    const healthScore = Math.max(0, Math.min(100,
      35
      + (salesGrowthPct == null ? 10 : Math.max(-15, Math.min(25, salesGrowthPct)))
      + Math.min(20, quoteApprovalPct / 2)
      - Math.min(25, facts.quotes.overdue.length * 4)
      + Math.min(20, facts.customers.topBuyers.length * 2)
    ))

    const kpis: DecisionKpi[] = [
      {
        id: 'sales-kpi-net-sales',
        label: 'Venta neta',
        value: facts.invoices.current.netSales,
        formattedValue: formatCurrency(facts.invoices.current.netSales, locale),
        status: salesGrowthPct != null && salesGrowthPct < 0 ? 'NEGATIVE' : 'POSITIVE',
        deltaPct: salesGrowthPct,
        note: `${facts.invoices.current.invoicesCount} facturas netas en el periodo actual.`,
      },
      {
        id: 'sales-kpi-quote-approval',
        label: 'Aprobación de cotizaciones',
        value: quoteApprovalPct,
        formattedValue: `${formatPercent(quoteApprovalPct, locale)}%`,
        status: quoteApprovalPct >= 25 ? 'POSITIVE' : quoteApprovalPct >= 10 ? 'WARNING' : 'NEGATIVE',
        note: `${facts.quotes.approvedThisPeriod} cotizaciones aprobadas sobre ${facts.quotes.createdThisPeriod} creadas.`,
      },
      {
        id: 'sales-kpi-active-customers',
        label: 'Clientes activos',
        value: facts.invoices.current.uniqueCustomers,
        formattedValue: String(facts.invoices.current.uniqueCustomers),
        status: facts.invoices.current.uniqueCustomers > 0 ? 'POSITIVE' : 'NEUTRAL',
        note: 'Clientes con compra neta dentro del periodo consultado.',
      },
    ]

    const trends: DecisionTrend[] = [
      {
        id: 'sales-trend-revenue',
        label: 'Tendencia de ventas',
        direction: salesGrowthPct == null ? 'FLAT' : salesGrowthPct > 0 ? 'UP' : salesGrowthPct < 0 ? 'DOWN' : 'FLAT',
        summary: salesGrowthPct == null
          ? 'Sin histórico comparable suficiente para leer tendencia.'
          : `La venta neta varía ${formatPercent(salesGrowthPct, locale)}% frente al periodo anterior.`,
        magnitudePct: salesGrowthPct,
      },
    ]

    const predictions: DecisionPrediction[] = [
      {
        id: 'sales-prediction-next-window',
        title: 'Pronóstico de ventas del siguiente periodo',
        metric: 'Venta neta proyectada del siguiente periodo comparable',
        value: salesForecastValue,
        confidence: facts.invoices.current.invoicesCount >= 10 && facts.invoices.previous.invoicesCount >= 10 ? 'MEDIUM' : 'LOW',
        basis: [
          `Base actual: ${formatCurrency(facts.invoices.current.netSales, locale)}.`,
          `Aprobación comercial actual: ${formatPercent(quoteApprovalPct, locale)}%.`,
          'El pronóstico usa una heurística de continuidad parcial de la tendencia reciente y la disciplina de cierre vigente.',
        ],
      },
    ]

    return {
      healthScore,
      healthStatus: healthScore >= 80 ? 'BUENO' : healthScore >= 55 ? 'ATENCION' : 'CRITICO',
      executiveSummary: `Ventas muestra ${facts.invoices.current.invoicesCount} facturas netas, ${facts.quotes.overdue.length} cotizaciones por mover y ${facts.customers.topBuyers.length} clientes de alto valor listos para recompra o upsell.`,
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
          id: 'sales-momentum',
          label: 'Momento comercial',
          score: Math.max(0, Math.min(40, 20 + (salesGrowthPct ?? 0))),
          maxScore: 40,
          summary: salesGrowthPct == null ? 'Sin histórico comparable suficiente.' : `Variación comercial de ${formatPercent(salesGrowthPct, locale)}%.`,
        },
        {
          id: 'sales-quote-discipline',
          label: 'Disciplina de cotización',
          score: Math.max(0, 35 - facts.quotes.overdue.length * 5 + Math.min(10, quoteApprovalPct / 5)),
          maxScore: 35,
          summary: `${facts.quotes.overdue.length} cotizaciones vencidas o envejecidas y aprobación estimada de ${formatPercent(quoteApprovalPct, locale)}%.`,
        },
        {
          id: 'sales-customer-base',
          label: 'Base de clientes activa',
          score: Math.min(25, facts.invoices.current.uniqueCustomers + facts.customers.topBuyers.length),
          maxScore: 25,
          summary: `${facts.invoices.current.uniqueCustomers} clientes activos en la ventana actual.`,
        },
      ],
    }
  },
}