import assert from 'node:assert/strict'
import { companyAnalyzerPlugin } from '../src/lib/decision-engine/analyzers/company-analyzer'
import { crmAnalyzerPlugin } from '../src/lib/decision-engine/analyzers/crm-analyzer'
import { financeAnalyzerPlugin } from '../src/lib/decision-engine/analyzers/finance-analyzer'
import { inventoryAnalyzerPlugin } from '../src/lib/decision-engine/analyzers/inventory-analyzer'
import { operationsAnalyzerPlugin } from '../src/lib/decision-engine/analyzers/operations-analyzer'
import { purchasesAnalyzerPlugin } from '../src/lib/decision-engine/analyzers/purchases-analyzer'
import { salesAnalyzerPlugin } from '../src/lib/decision-engine/analyzers/sales-analyzer'
import type { DecisionAnalysisTarget, DecisionAnalyzerPlugin, DecisionEngineContext, DecisionEngineResultFragment } from '../src/lib/decision-engine/contracts'
import { createDecisionEngine } from '../src/lib/decision-engine/engine'
import { createDecisionEngineRegistry } from '../src/lib/decision-engine/registry'
import { companyDecisionFactsFixture } from '../src/lib/decision-engine/tests/fixtures/company-facts'
import { crmDecisionFactsFixture, crmDecisionFactsHealthyFixture } from '../src/lib/decision-engine/tests/fixtures/crm-facts'
import { financeDecisionFactsFixture, financeDecisionFactsHealthyFixture } from '../src/lib/decision-engine/tests/fixtures/finance-facts'
import { inventoryDecisionFactsFixture, inventoryDecisionFactsHealthyFixture } from '../src/lib/decision-engine/tests/fixtures/inventory-facts'
import { operationsDecisionFactsFixture, operationsDecisionFactsHealthyFixture } from '../src/lib/decision-engine/tests/fixtures/operations-facts'
import { purchasesDecisionFactsFixture, purchasesDecisionFactsHealthyFixture } from '../src/lib/decision-engine/tests/fixtures/purchases-facts'
import { salesDecisionFactsFixture, salesDecisionFactsHealthyFixture } from '../src/lib/decision-engine/tests/fixtures/sales-facts'

const baseContext: DecisionEngineContext = {
  empresaId: 'empresa-test',
  sedeId: 'sede-test',
  actorUserId: 'user-test',
  locale: 'es-CO',
}

function withFixtureCollect<TFacts>(plugin: {
  key: DecisionAnalysisTarget
  analyze: (facts: TFacts, context: DecisionEngineContext) => Promise<DecisionEngineResultFragment>
}, facts: TFacts): DecisionAnalyzerPlugin<TFacts> {
  return {
    key: plugin.key,
    collect: async () => facts,
    analyze: plugin.analyze,
  }
}

async function main() {
  const registry = createDecisionEngineRegistry([
    withFixtureCollect(companyAnalyzerPlugin, companyDecisionFactsFixture),
    withFixtureCollect(crmAnalyzerPlugin, crmDecisionFactsFixture),
    withFixtureCollect(financeAnalyzerPlugin, financeDecisionFactsFixture),
    withFixtureCollect(inventoryAnalyzerPlugin, inventoryDecisionFactsFixture),
    withFixtureCollect(operationsAnalyzerPlugin, operationsDecisionFactsFixture),
    withFixtureCollect(purchasesAnalyzerPlugin, purchasesDecisionFactsFixture),
    withFixtureCollect(salesAnalyzerPlugin, salesDecisionFactsFixture),
  ])

  const engine = createDecisionEngine(registry)

  const [companyResult, crmResult, financeResult, inventoryResult, operationsResult, purchasesResult, salesResult] = await Promise.all([
    engine.analyzeCompany(baseContext),
    engine.analyzeCrm(baseContext),
    engine.analyzeFinance(baseContext),
    engine.analyzeInventory(baseContext),
    engine.analyzeOperations(baseContext),
    engine.analyzePurchases(baseContext),
    engine.analyzeSales(baseContext),
  ])

  assert.equal(companyResult.target, 'company')
  assert.equal(companyResult.metadata.empresaId, baseContext.empresaId)
  assert.ok(companyResult.executiveSummary.length > 20)
  assert.ok(companyResult.alerts.some((item) => item.id === 'alert-low-stock-company'))
  assert.ok(companyResult.risks.some((item) => item.id === 'risk-overdue-work-orders'))
  assert.ok(companyResult.risks.some((item) => item.id === 'risk-finance-cashflow-receivables'))
  assert.ok(companyResult.actions.some((item) => item.id === 'action-protect-company-cashflow'))
  assert.ok(companyResult.healthBreakdown.some((item) => item.id === 'finance-resilience'))
  assert.ok(companyResult.executiveSummary.toLowerCase().includes('finanzas'))

  assert.equal(crmResult.target, 'crm')
  assert.ok(crmResult.alerts.some((item) => item.id === 'crm-alert-no-follow-up'))
  assert.ok(crmResult.risks.some((item) => item.id === 'crm-risk-stale-opportunities'))
  assert.ok(crmResult.opportunities.some((item) => item.id === 'crm-opportunity-high-potential'))
  assert.ok(crmResult.actions.some((item) => item.id === 'crm-action-follow-up'))
  assert.ok(crmResult.recommendations.some((item) => item.id === 'crm-recommendation-close-high-potential'))
  assert.ok(crmResult.kpis.some((item) => item.id === 'crm-kpi-conversion'))
  assert.ok(crmResult.healthScore > 0)

  assert.equal(financeResult.target, 'finance')
  assert.ok(financeResult.alerts.some((item) => item.id === 'finance-alert-negative-cashflow'))
  assert.ok(financeResult.risks.some((item) => item.id === 'finance-risk-margin-receivables'))
  assert.ok(financeResult.recommendations.some((item) => item.id === 'finance-recommendation-close-ledger'))
  assert.ok(financeResult.actions.some((item) => item.id === 'finance-action-protect-cash'))
  assert.ok(financeResult.predictions.some((item) => item.id === 'finance-prediction-next-pressure'))
  assert.ok(financeResult.predictions.some((item) => item.title.toLowerCase().includes('flujo de caja')))
  assert.ok(financeResult.healthScore > 0)

  assert.equal(inventoryResult.target, 'inventory')
  assert.ok(inventoryResult.alerts.some((item) => item.id === 'inventory-alert-low-stock'))
  assert.ok(inventoryResult.risks.some((item) => item.id === 'inventory-risk-overstock'))
  assert.ok(inventoryResult.actions.some((item) => item.id === 'inventory-action-replenish'))
  assert.ok(inventoryResult.recommendations.some((item) => item.id === 'inventory-recommendation-balance-stock'))
  assert.ok(inventoryResult.predictions.some((item) => item.id === 'inventory-prediction-next-risk'))
  assert.ok(inventoryResult.predictions.some((item) => item.title.toLowerCase().includes('demanda')))
  assert.ok(inventoryResult.healthScore > 0)

  assert.equal(operationsResult.target, 'operations')
  assert.ok(operationsResult.alerts.some((item) => item.id === 'operations-alert-overdue-orders'))
  assert.ok(operationsResult.risks.some((item) => item.id === 'operations-risk-bottlenecks'))
  assert.ok(operationsResult.opportunities.some((item) => item.id === 'operations-opportunity-balance-load'))
  assert.ok(operationsResult.actions.some((item) => item.id === 'operations-action-recover-orders'))
  assert.ok(operationsResult.recommendations.some((item) => item.id === 'operations-recommendation-balance-capacity'))
  assert.ok(operationsResult.predictions.some((item) => item.id === 'operations-prediction-next-attention'))
  assert.ok(operationsResult.healthScore > 0)

  assert.equal(purchasesResult.target, 'purchases')
  assert.ok(purchasesResult.alerts.some((item) => item.id === 'purchases-alert-urgent-replenishment'))
  assert.ok(purchasesResult.risks.some((item) => item.id === 'purchases-risk-cost-increase'))
  assert.ok(purchasesResult.risks.some((item) => item.id === 'purchases-risk-approval-cashflow'))
  assert.ok(purchasesResult.actions.some((item) => item.id === 'purchases-action-create-urgent-order'))
  assert.ok(purchasesResult.recommendations.some((item) => item.id === 'purchases-recommendation-review-costs'))
  assert.ok(purchasesResult.predictions.some((item) => item.id === 'purchases-prediction-next-pressure'))
  assert.ok(purchasesResult.healthScore > 0)

  assert.equal(salesResult.target, 'sales')
  assert.ok(salesResult.risks.some((item) => item.id === 'sales-risk-decline'))
  assert.ok(salesResult.alerts.some((item) => item.id === 'sales-alert-overdue-quotes'))
  assert.ok(salesResult.opportunities.some((item) => item.id === 'sales-opportunity-top-buyers'))
  assert.ok(salesResult.actions.some((item) => item.id === 'sales-action-recover-quotes'))
  assert.ok(salesResult.recommendations.some((item) => item.id === 'sales-recommendation-repeat-buyers'))
  assert.ok(salesResult.predictions.some((item) => item.id === 'sales-prediction-next-window'))
  assert.ok(salesResult.predictions.some((item) => item.title.toLowerCase().includes('pronóstico') || item.title.toLowerCase().includes('pronostico')))
  assert.ok(salesResult.healthScore > 0)

  const healthyRegistry = createDecisionEngineRegistry([
    withFixtureCollect(crmAnalyzerPlugin, crmDecisionFactsHealthyFixture),
    withFixtureCollect(financeAnalyzerPlugin, financeDecisionFactsHealthyFixture),
    withFixtureCollect(inventoryAnalyzerPlugin, inventoryDecisionFactsHealthyFixture),
    withFixtureCollect(operationsAnalyzerPlugin, operationsDecisionFactsHealthyFixture),
    withFixtureCollect(purchasesAnalyzerPlugin, purchasesDecisionFactsHealthyFixture),
    withFixtureCollect(salesAnalyzerPlugin, salesDecisionFactsHealthyFixture),
  ])
  const healthyEngine = createDecisionEngine(healthyRegistry)

  const [healthyCrm, healthyFinance, healthyInventory, healthyOperations, healthyPurchases, healthySales] = await Promise.all([
    healthyEngine.analyzeCrm(baseContext),
    healthyEngine.analyzeFinance(baseContext),
    healthyEngine.analyzeInventory(baseContext),
    healthyEngine.analyzeOperations(baseContext),
    healthyEngine.analyzePurchases(baseContext),
    healthyEngine.analyzeSales(baseContext),
  ])

  assert.equal(healthyCrm.alerts.length, 0)
  assert.equal(healthyCrm.risks.length, 0)
  assert.equal(healthyFinance.alerts.length, 0)
  assert.equal(healthyFinance.risks.length, 0)
  assert.ok(healthyFinance.opportunities.some((item) => item.id === 'finance-opportunity-profitable-window'))
  assert.equal(healthyInventory.alerts.length, 0)
  assert.equal(healthyInventory.risks.length, 0)
  assert.ok(healthyInventory.opportunities.some((item) => item.id === 'inventory-opportunity-stable-stock'))
  assert.equal(healthyOperations.alerts.length, 0)
  assert.equal(healthyOperations.risks.length, 0)
  assert.equal(healthyPurchases.alerts.length, 0)
  assert.equal(healthyPurchases.risks.length, 0)
  assert.ok(healthyPurchases.opportunities.some((item) => item.id === 'purchases-opportunity-clean-ledger'))
  assert.equal(healthySales.alerts.length, 0)
  assert.equal(healthySales.risks.length, 0)

  console.log('Decision Engine slice fixtures OK')
  console.log(`company health=${companyResult.healthScore}`)
  console.log(`crm health=${crmResult.healthScore}`)
  console.log(`finance health=${financeResult.healthScore}`)
  console.log(`inventory health=${inventoryResult.healthScore}`)
  console.log(`operations health=${operationsResult.healthScore}`)
  console.log(`purchases health=${purchasesResult.healthScore}`)
  console.log(`sales health=${salesResult.healthScore}`)
}

main().catch((error) => {
  console.error('Decision Engine slice fixtures FAIL')
  console.error(error)
  process.exit(1)
})