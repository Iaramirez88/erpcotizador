import type { DecisionAnalysisTarget, DecisionAnalyzerPlugin } from '@/lib/decision-engine/contracts'
import { companyAnalyzerPlugin } from '@/lib/decision-engine/analyzers/company-analyzer'
import { crmAnalyzerPlugin } from '@/lib/decision-engine/analyzers/crm-analyzer'
import { financeAnalyzerPlugin } from '@/lib/decision-engine/analyzers/finance-analyzer'
import { inventoryAnalyzerPlugin } from '@/lib/decision-engine/analyzers/inventory-analyzer'
import { operationsAnalyzerPlugin } from '@/lib/decision-engine/analyzers/operations-analyzer'
import { purchasesAnalyzerPlugin } from '@/lib/decision-engine/analyzers/purchases-analyzer'
import { salesAnalyzerPlugin } from '@/lib/decision-engine/analyzers/sales-analyzer'

type RegisteredDecisionAnalyzerPlugin = DecisionAnalyzerPlugin<any>

export type DecisionEngineRegistry = {
  register: (plugin: RegisteredDecisionAnalyzerPlugin) => void
  get: (target: DecisionAnalysisTarget) => RegisteredDecisionAnalyzerPlugin | null
  list: () => RegisteredDecisionAnalyzerPlugin[]
}

export function createDecisionEngineRegistry(initialPlugins: RegisteredDecisionAnalyzerPlugin[] = []): DecisionEngineRegistry {
  const plugins = new Map<DecisionAnalysisTarget, RegisteredDecisionAnalyzerPlugin>()

  const registry: DecisionEngineRegistry = {
    register(plugin) {
      plugins.set(plugin.key, plugin)
    },
    get(target) {
      return plugins.get(target) ?? null
    },
    list() {
      return [...plugins.values()]
    },
  }

  initialPlugins.forEach((plugin) => registry.register(plugin))
  return registry
}

export const defaultDecisionEngineRegistry = createDecisionEngineRegistry([
  companyAnalyzerPlugin,
  crmAnalyzerPlugin,
  financeAnalyzerPlugin,
  inventoryAnalyzerPlugin,
  operationsAnalyzerPlugin,
  purchasesAnalyzerPlugin,
  salesAnalyzerPlugin,
])