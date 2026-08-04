import type { DecisionAction, DecisionExplanation, DecisionInsight } from '@/lib/decision-engine/contracts'

export function buildInsightExplanation(insight: DecisionInsight): DecisionExplanation {
  return {
    id: `explain-${insight.id}`,
    title: insight.title,
    details: [...insight.reasons, ...insight.evidence],
  }
}

export function buildActionExplanation(action: DecisionAction): DecisionExplanation {
  return {
    id: `explain-${action.id}`,
    title: action.title,
    details: [action.description, action.expectedImpact || 'Acción priorizada por el motor para reducir riesgo o capturar oportunidad.'],
  }
}