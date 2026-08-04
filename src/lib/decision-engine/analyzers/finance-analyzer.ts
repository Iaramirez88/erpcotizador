import { prisma } from '@/lib/prisma'
import type { DecisionAction, DecisionAnalyzerPlugin, DecisionEngineContext, DecisionInsight, DecisionKpi, DecisionPrediction, DecisionTrend } from '@/lib/decision-engine/contracts'
import { collectFinanceFacts, type FinanceDecisionFacts } from '@/lib/decision-engine/collectors/finance-collector'
import { buildActionExplanation, buildInsightExplanation } from '@/lib/decision-engine/explainability'

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

function resolveResultDeltaPct(facts: FinanceDecisionFacts) {
  const previous = facts.accounting.previous.operatingResult
  const current = facts.accounting.current.operatingResult
  if (previous === 0) return current !== 0 ? 100 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function resolveCashflowDeltaPct(facts: FinanceDecisionFacts) {
  const previous = facts.accounting.previous.netCashflow
  const current = facts.accounting.current.netCashflow
  if (previous === 0) return current !== 0 ? 100 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function resolveCashflowForecastValue(facts: FinanceDecisionFacts, cashflowDeltaPct: number | null) {
  const continuityFactor = ((cashflowDeltaPct ?? 0) * 0.35) / 100
  const receivablePressure = Math.min(0.18, facts.receivables.count * 0.02)
  const payablePressure = Math.min(0.12, facts.payables.count * 0.015)
  return facts.accounting.current.netCashflow * (1 + continuityFactor) - (facts.accounting.current.receivables * receivablePressure) - (facts.accounting.current.payables * payablePressure)
}

export const financeAnalyzerPlugin: DecisionAnalyzerPlugin<FinanceDecisionFacts> = {
  key: 'finance',
  collect(context: DecisionEngineContext) {
    return collectFinanceFacts({ ...context, prisma })
  },
  async analyze(facts, context) {
    const locale = context.locale || 'es-CO'
    const alerts: DecisionInsight[] = []
    const risks: DecisionInsight[] = []
    const opportunities: DecisionInsight[] = []
    const recommendations: DecisionAction[] = []
    const actions: DecisionAction[] = []
    const resultDeltaPct = resolveResultDeltaPct(facts)
    const cashflowDeltaPct = resolveCashflowDeltaPct(facts)
    const cashflowForecastValue = resolveCashflowForecastValue(facts, cashflowDeltaPct)

    if (facts.accounting.current.netCashflow < 0) {
      alerts.push({
        id: 'finance-alert-negative-cashflow',
        kind: 'ALERT',
        title: 'Flujo neto de caja en rojo',
        summary: `La caja operativa del periodo cierra en ${formatCurrency(facts.accounting.current.netCashflow, locale)}.`,
        severity: facts.accounting.current.netCashflow < -5000000 ? 'HIGH' : 'MEDIUM',
        domain: 'FINANZAS',
        subdomain: 'CASHFLOW',
        reasons: ['El recaudo efectivo del periodo no cubre los egresos operativos observables.'],
        evidence: [
          `Entradas estimadas: ${formatCurrency(facts.accounting.current.inflows, locale)}.`,
          `Salidas estimadas: ${formatCurrency(facts.accounting.current.outflows, locale)}.`,
        ],
        impact: {
          label: 'Flujo neto estimado',
          amount: facts.accounting.current.netCashflow,
          currency: 'COP',
        },
      })

      actions.push({
        id: 'finance-action-protect-cash',
        title: 'Proteger caja inmediata',
        description: 'Acelera recaudo, prioriza pagos críticos y evita nuevas salidas discrecionales mientras se estabiliza el flujo.',
        priority: 'NOW',
        owner: 'FINANCE',
        expectedImpact: 'Reducir presión de caja en la siguiente ventana operativa.',
        href: '/dashboard/contabilidad',
      })
    }

    if (facts.accounting.current.operatingResult < 0 || facts.receivables.topInvoices.length > 0) {
      const topInvoice = facts.receivables.topInvoices[0]
      risks.push({
        id: 'finance-risk-margin-receivables',
        kind: 'RISK',
        title: 'Resultado y cartera bajo presión',
        summary: `El resultado operativo es ${formatCurrency(facts.accounting.current.operatingResult, locale)} y la cartera visible suma ${formatCurrency(facts.accounting.current.receivables, locale)}.`,
        severity: facts.accounting.current.operatingResult < 0 && facts.accounting.current.receivables > 5000000 ? 'HIGH' : 'MEDIUM',
        domain: 'FINANZAS',
        subdomain: 'ACCOUNTING',
        entityRefs: topInvoice ? [{ type: 'posInvoice', id: topInvoice.id, label: topInvoice.numero }] : undefined,
        reasons: ['La rentabilidad contable y el recaudo pendiente deben leerse juntos para evitar falsa sensación de liquidez.'],
        evidence: [
          `Ingreso reconocido: ${formatCurrency(facts.accounting.current.recognizedIncome, locale)}.`,
          `Gasto reconocido: ${formatCurrency(facts.accounting.current.recognizedExpense, locale)}.`,
          topInvoice ? `La factura con mayor saldo es ${topInvoice.numero} por ${formatCurrency(topInvoice.balance, locale)}.` : 'No se detecta una factura dominante en la cartera visible.',
        ],
      })
    }

    if (facts.accounting.draftVouchers > 0 || facts.payables.topPurchases.length > 0) {
      recommendations.push({
        id: 'finance-recommendation-close-ledger',
        title: 'Depurar pendientes contables y de pago',
        description: 'Cierra comprobantes en borrador y reordena las compras con mayor saldo para mejorar la lectura financiera real.',
        priority: 'THIS_WEEK',
        owner: 'FINANCE',
        expectedImpact: 'Aumentar visibilidad contable y bajar fricción entre caja y obligaciones.',
        href: '/dashboard/contabilidad/comprobantes',
      })
    }

    if (facts.accounting.current.operatingResult > 0 && facts.accounting.current.netCashflow > 0) {
      opportunities.push({
        id: 'finance-opportunity-profitable-window',
        kind: 'OPPORTUNITY',
        title: 'Ventana financiera favorable',
        summary: 'La ventana actual combina resultado operativo positivo y flujo de caja neto a favor.',
        severity: 'LOW',
        domain: 'FINANZAS',
        subdomain: 'ACCOUNTING',
        reasons: ['Cuando resultado y caja avanzan juntos, la empresa gana margen para invertir o amortiguar riesgo futuro.'],
        evidence: [
          `Resultado operativo: ${formatCurrency(facts.accounting.current.operatingResult, locale)}.`,
          `Flujo neto: ${formatCurrency(facts.accounting.current.netCashflow, locale)}.`,
        ],
      })
    }

    const healthScore = Math.max(0, Math.min(100,
      70
      + Math.max(-20, Math.min(18, (resultDeltaPct ?? 0) / 2))
      - Math.min(22, Math.max(0, -facts.accounting.current.netCashflow) / 1000000)
      - Math.min(18, facts.accounting.current.receivables / 3000000)
      - Math.min(10, facts.accounting.draftVouchers * 2)
      - Math.min(12, facts.accounting.current.payables / 4000000)
    ))

    const kpis: DecisionKpi[] = [
      {
        id: 'finance-kpi-operating-result',
        label: 'Resultado operativo',
        value: facts.accounting.current.operatingResult,
        formattedValue: formatCurrency(facts.accounting.current.operatingResult, locale),
        status: facts.accounting.current.operatingResult > 0 ? 'POSITIVE' : facts.accounting.current.operatingResult < 0 ? 'NEGATIVE' : 'NEUTRAL',
        deltaPct: resultDeltaPct,
        note: 'Ingreso reconocido menos gasto reconocido desde asientos contables.',
      },
      {
        id: 'finance-kpi-net-cashflow',
        label: 'Flujo neto estimado',
        value: facts.accounting.current.netCashflow,
        formattedValue: formatCurrency(facts.accounting.current.netCashflow, locale),
        status: facts.accounting.current.netCashflow >= 0 ? 'POSITIVE' : 'NEGATIVE',
        note: 'Recaudos POS menos pagos de compras en la ventana actual.',
      },
      {
        id: 'finance-kpi-receivables',
        label: 'Cartera visible',
        value: facts.accounting.current.receivables,
        formattedValue: formatCurrency(facts.accounting.current.receivables, locale),
        status: facts.accounting.current.receivables < 3000000 ? 'POSITIVE' : facts.accounting.current.receivables < 8000000 ? 'WARNING' : 'NEGATIVE',
        note: `${facts.receivables.count} facturas con saldo pendiente en la lectura actual.`,
      },
    ]

    const trends: DecisionTrend[] = [
      {
        id: 'finance-trend-result',
        label: 'Tendencia del resultado',
        direction: resultDeltaPct == null ? 'FLAT' : resultDeltaPct > 0 ? 'UP' : resultDeltaPct < 0 ? 'DOWN' : 'FLAT',
        summary: resultDeltaPct == null
          ? 'Sin histórico comparable suficiente para tendencia financiera.'
          : `El resultado operativo varía ${formatPercent(resultDeltaPct, locale)}% frente al periodo anterior.`,
        magnitudePct: resultDeltaPct,
      },
    ]

    const predictions: DecisionPrediction[] = [
      {
        id: 'finance-prediction-next-pressure',
        title: 'Pronóstico de flujo de caja',
        metric: 'Flujo neto proyectado para el siguiente periodo comparable',
        value: cashflowForecastValue,
        confidence: facts.receivables.count + facts.payables.count >= 4 ? 'MEDIUM' : 'LOW',
        basis: [
          `Flujo neto actual: ${formatCurrency(facts.accounting.current.netCashflow, locale)}.`,
          cashflowDeltaPct == null
            ? 'Aún no hay histórico comparable sólido; el cálculo toma la ventana actual como base.'
            : `Variación reciente del flujo: ${formatPercent(cashflowDeltaPct, locale)}%.`,
          `Cartera visible: ${formatCurrency(facts.accounting.current.receivables, locale)} y cuentas por pagar: ${formatCurrency(facts.accounting.current.payables, locale)}.`,
        ],
      },
    ]

    return {
      healthScore,
      healthStatus: healthScore >= 80 ? 'BUENO' : healthScore >= 55 ? 'ATENCION' : 'CRITICO',
      executiveSummary: `Finanzas muestra resultado operativo de ${formatCurrency(facts.accounting.current.operatingResult, locale)}, flujo neto estimado de ${formatCurrency(facts.accounting.current.netCashflow, locale)} y cartera visible por ${formatCurrency(facts.accounting.current.receivables, locale)}.` ,
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
          id: 'finance-profitability',
          label: 'Rentabilidad operativa',
          score: Math.max(0, Math.min(40, 20 + facts.accounting.current.operatingResult / 500000)),
          maxScore: 40,
          summary: `Resultado operativo de ${formatCurrency(facts.accounting.current.operatingResult, locale)}.`,
        },
        {
          id: 'finance-cashflow',
          label: 'Liquidez inmediata',
          score: Math.max(0, 35 - Math.max(0, -facts.accounting.current.netCashflow) / 500000),
          maxScore: 35,
          summary: `Flujo neto estimado de ${formatCurrency(facts.accounting.current.netCashflow, locale)}.`,
        },
        {
          id: 'finance-close-discipline',
          label: 'Disciplina de cierre',
          score: Math.max(0, 25 - facts.accounting.draftVouchers * 3 - facts.receivables.count * 2),
          maxScore: 25,
          summary: `${facts.accounting.draftVouchers} comprobantes en borrador y ${facts.receivables.count} facturas con saldo.`,
        },
      ],
    }
  },
}