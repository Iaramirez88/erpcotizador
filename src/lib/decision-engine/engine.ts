import type { DecisionAnalysisTarget, DecisionAnalyzerPlugin, DecisionEngine, DecisionEngineContext, DecisionEngineResult } from '@/lib/decision-engine/contracts'
import { defaultDecisionEngineRegistry, type DecisionEngineRegistry } from '@/lib/decision-engine/registry'

function normalizeResult(args: {
  target: DecisionAnalysisTarget
  context: DecisionEngineContext
  plugin: DecisionAnalyzerPlugin
  fragment: Awaited<ReturnType<DecisionAnalyzerPlugin['analyze']>>
  collected: Awaited<ReturnType<DecisionAnalyzerPlugin['collect']>>
}): DecisionEngineResult {
  const metadataSource = args.collected as { generatedAt?: string; period?: { from?: string; to?: string }; scope?: 'EMPRESA' | 'SEDE' }
  const generatedAt = metadataSource.generatedAt || new Date().toISOString()
  const from = metadataSource.period?.from || (args.context.from ?? new Date()).toISOString()
  const to = metadataSource.period?.to || (args.context.to ?? new Date()).toISOString()

  return {
    target: args.target,
    healthScore: args.fragment.healthScore ?? 0,
    healthStatus: args.fragment.healthStatus ?? 'ATENCION',
    executiveSummary: args.fragment.executiveSummary ?? 'El motor todavía no produjo un resumen ejecutivo para este alcance.',
    alerts: args.fragment.alerts ?? [],
    opportunities: args.fragment.opportunities ?? [],
    recommendations: args.fragment.recommendations ?? [],
    predictions: args.fragment.predictions ?? [],
    risks: args.fragment.risks ?? [],
    kpis: args.fragment.kpis ?? [],
    trends: args.fragment.trends ?? [],
    actions: args.fragment.actions ?? [],
    explainability: args.fragment.explainability ?? [],
    healthBreakdown: args.fragment.healthBreakdown ?? [],
    metadata: {
      generatedAt,
      scope: metadataSource.scope ?? (args.context.sedeId ? 'SEDE' : 'EMPRESA'),
      empresaId: args.context.empresaId,
      sedeId: args.context.sedeId ?? null,
      from,
      to,
      locale: args.context.locale || 'es-CO',
    },
  }
}

export function createDecisionEngine(registry: DecisionEngineRegistry = defaultDecisionEngineRegistry): DecisionEngine {
  async function analyze(target: DecisionAnalysisTarget, context: DecisionEngineContext) {
    const plugin = registry.get(target)
    if (!plugin) {
      throw new Error(`No existe un analyzer registrado para ${target}.`)
    }

    const collected = await plugin.collect(context)
    const fragment = await plugin.analyze(collected, context)

    return normalizeResult({
      target,
      context,
      plugin,
      fragment,
      collected,
    })
  }

  return {
    analyze,
    analyzeCrm(context) {
      return analyze('crm', context)
    },
    analyzeFinance(context) {
      return analyze('finance', context)
    },
    analyzeInventory(context) {
      return analyze('inventory', context)
    },
    analyzeOperations(context) {
      return analyze('operations', context)
    },
    analyzePurchases(context) {
      return analyze('purchases', context)
    },
    analyzeSales(context) {
      return analyze('sales', context)
    },
    analyzeCompany(context) {
      return analyze('company', context)
    },
  }
}