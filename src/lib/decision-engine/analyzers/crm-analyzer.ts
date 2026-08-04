import { prisma } from '@/lib/prisma'
import type { DecisionAction, DecisionAnalyzerPlugin, DecisionEngineContext, DecisionInsight, DecisionKpi, DecisionPrediction, DecisionTrend } from '@/lib/decision-engine/contracts'
import { collectCrmFacts, type CrmDecisionFacts } from '@/lib/decision-engine/collectors/crm-collector'
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

export const crmAnalyzerPlugin: DecisionAnalyzerPlugin<CrmDecisionFacts> = {
  key: 'crm',
  collect(context: DecisionEngineContext) {
    return collectCrmFacts({ ...context, prisma })
  },
  async analyze(facts, context) {
    const locale = context.locale || 'es-CO'
    const alerts: DecisionInsight[] = []
    const risks: DecisionInsight[] = []
    const opportunities: DecisionInsight[] = []
    const recommendations: DecisionAction[] = []
    const actions: DecisionAction[] = []

    if (facts.leads.withoutRecentFollowUp.length > 0) {
      const lead = facts.leads.withoutRecentFollowUp[0]
      alerts.push({
        id: 'crm-alert-no-follow-up',
        kind: 'ALERT',
        title: 'Leads sin seguimiento reciente',
        summary: `${facts.leads.withoutRecentFollowUp.length} leads siguen abiertos sin actividad reciente.`,
        severity: facts.leads.withoutRecentFollowUp.length >= 8 ? 'HIGH' : 'MEDIUM',
        domain: 'CAPTACION',
        subdomain: 'LEADS',
        entityRefs: facts.leads.withoutRecentFollowUp.map((item) => ({ type: 'crmLead', id: item.id, label: item.nombre })),
        reasons: ['Los leads sin actividad reciente pierden intención y reducen la tasa de conversión efectiva.'],
        evidence: [
          `El lead más antiguo del lote es ${lead.nombre} y su última actividad registrada es ${lead.lastActivityAt ? formatDate(lead.lastActivityAt, locale) : 'ninguna'}.`,
        ],
      })

      actions.push({
        id: 'crm-action-follow-up',
        title: 'Programar seguimiento comercial',
        description: 'Reasigna o contacta los leads sin actividad reciente antes de perder su intención comercial.',
        priority: 'NOW',
        owner: 'CRM',
        expectedImpact: 'Recuperar leads tibios y mejorar velocidad de respuesta comercial.',
        href: '/dashboard/crm/leads',
      })
    }

    if (facts.opportunities.stale.length > 0) {
      const stale = facts.opportunities.stale[0]
      risks.push({
        id: 'crm-risk-stale-opportunities',
        kind: 'RISK',
        title: 'Oportunidades estancadas en pipeline',
        summary: `${facts.opportunities.stale.length} oportunidades abiertas no muestran movimiento reciente.`,
        severity: facts.opportunities.stale.length >= 5 ? 'HIGH' : 'MEDIUM',
        domain: 'CAPTACION',
        subdomain: 'OPPORTUNITIES',
        entityRefs: facts.opportunities.stale.map((item) => ({ type: 'crmOpportunity', id: item.id, label: item.title })),
        reasons: ['La falta de movimiento reciente reduce la probabilidad real de cierre y distorsiona la lectura del pipeline.'],
        evidence: [
          `La oportunidad más antigua sin movimiento es ${stale.title} desde ${formatDate(stale.updatedAt, locale)}.`,
        ],
        impact: {
          label: 'Valor comprometido en oportunidades estancadas',
          amount: facts.opportunities.stale.reduce((sum, item) => sum + item.expectedValue, 0),
          currency: 'COP',
        },
      })
    }

    if (facts.opportunities.highPotential.length > 0) {
      const top = facts.opportunities.highPotential[0]
      opportunities.push({
        id: 'crm-opportunity-high-potential',
        kind: 'OPPORTUNITY',
        title: 'Deals con alta probabilidad de cierre',
        summary: `${facts.opportunities.highPotential.length} oportunidades abiertas ya superan el umbral de alta probabilidad.`,
        severity: 'MEDIUM',
        domain: 'CAPTACION',
        subdomain: 'OPPORTUNITIES',
        entityRefs: facts.opportunities.highPotential.map((item) => ({ type: 'crmOpportunity', id: item.id, label: item.title })),
        reasons: ['El pipeline ya contiene oportunidades con buena probabilidad y valor suficiente para priorizar cierre.'],
        evidence: [
          `La principal del lote es ${top.title} con probabilidad ${top.probabilityPct}% y valor esperado ${formatCurrency(top.expectedValue, locale)}.`,
        ],
        impact: {
          label: 'Valor potencial priorizable',
          amount: facts.opportunities.highPotential.reduce((sum, item) => sum + item.expectedValue, 0),
          currency: 'COP',
        },
      })

      recommendations.push({
        id: 'crm-recommendation-close-high-potential',
        title: 'Priorizar oportunidades con mayor probabilidad',
        description: 'Enfoca la agenda comercial en los deals con mejor combinación de probabilidad, valor y frescura operativa.',
        priority: 'THIS_WEEK',
        owner: 'CRM',
        expectedImpact: 'Mejorar la velocidad de cierre y el aprovechamiento del pipeline activo.',
        href: '/dashboard/crm/oportunidades',
      })
    }

    const conversionPct = facts.leads.newThisPeriod > 0 ? (facts.leads.convertedThisPeriod / facts.leads.newThisPeriod) * 100 : 0
    const healthScore = Math.max(0, Math.min(100,
      30
      + Math.min(25, facts.opportunities.highPotential.length * 4)
      + Math.min(20, conversionPct / 2)
      - Math.min(20, facts.leads.withoutRecentFollowUp.length * 2)
      - Math.min(15, facts.opportunities.stale.length * 3)
    ))

    const kpis: DecisionKpi[] = [
      {
        id: 'crm-kpi-new-leads',
        label: 'Leads nuevos',
        value: facts.leads.newThisPeriod,
        formattedValue: String(facts.leads.newThisPeriod),
        status: facts.leads.newThisPeriod > 0 ? 'POSITIVE' : 'NEUTRAL',
        note: 'Leads creados dentro del periodo actual.',
      },
      {
        id: 'crm-kpi-conversion',
        label: 'Conversión de leads',
        value: conversionPct,
        formattedValue: `${formatPercent(conversionPct, locale)}%`,
        status: conversionPct >= 20 ? 'POSITIVE' : conversionPct >= 10 ? 'WARNING' : 'NEGATIVE',
        note: `${facts.leads.convertedThisPeriod} leads convertidos en el periodo.`,
      },
      {
        id: 'crm-kpi-open-pipeline',
        label: 'Valor del pipeline',
        value: facts.opportunities.openValue,
        formattedValue: formatCurrency(facts.opportunities.openValue, locale),
        status: facts.opportunities.openValue > 0 ? 'POSITIVE' : 'WARNING',
        note: `${facts.opportunities.openCount} oportunidades abiertas.`,
      },
    ]

    const trends: DecisionTrend[] = [
      {
        id: 'crm-trend-follow-up',
        label: 'Seguimiento comercial',
        direction: facts.leads.withoutRecentFollowUp.length > 0 ? 'DOWN' : 'UP',
        summary: facts.leads.withoutRecentFollowUp.length > 0
          ? `Se acumulan ${facts.leads.withoutRecentFollowUp.length} leads sin actividad reciente.`
          : 'El frente comercial no muestra atraso fuerte en seguimiento de leads.',
      },
    ]

    const predictions: DecisionPrediction[] = [
      {
        id: 'crm-prediction-close-ready',
        title: 'Potencial de cierre comercial',
        metric: 'Oportunidades listas para empuje de cierre',
        value: facts.opportunities.highPotential.length,
        confidence: facts.opportunities.highPotential.length >= 3 ? 'MEDIUM' : 'LOW',
        basis: [
          `Oportunidades con probabilidad >= 70%: ${facts.opportunities.highPotential.length}.`,
          'La predicción actual es heurística y se basa en probabilidad declarada y actividad reciente.',
        ],
      },
    ]

    return {
      healthScore,
      healthStatus: healthScore >= 80 ? 'BUENO' : healthScore >= 55 ? 'ATENCION' : 'CRITICO',
      executiveSummary: `CRM muestra ${facts.opportunities.openCount} oportunidades abiertas, ${facts.leads.withoutRecentFollowUp.length} leads sin seguimiento reciente y ${facts.opportunities.highPotential.length} deals listos para priorizar cierre.`,
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
          id: 'crm-follow-up-discipline',
          label: 'Disciplina de seguimiento',
          score: Math.max(0, 35 - facts.leads.withoutRecentFollowUp.length * 4),
          maxScore: 35,
          summary: `${facts.leads.withoutRecentFollowUp.length} leads requieren seguimiento inmediato.`,
        },
        {
          id: 'crm-pipeline-quality',
          label: 'Calidad del pipeline',
          score: Math.max(0, 35 - facts.opportunities.stale.length * 5 + facts.opportunities.highPotential.length * 2),
          maxScore: 35,
          summary: `${facts.opportunities.stale.length} oportunidades estancadas y ${facts.opportunities.highPotential.length} con alta probabilidad.`,
        },
        {
          id: 'crm-conversion',
          label: 'Conversión comercial',
          score: Math.min(30, conversionPct),
          maxScore: 30,
          summary: `Conversión estimada del periodo: ${formatPercent(conversionPct, locale)}%.`,
        },
      ],
    }
  },
}