import type { DecisionHealthDimension, DecisionHealthStatus } from '@/lib/decision-engine/contracts'

type ComputeHealthScoreArgs = {
  salesGrowthPct: number | null
  pipelineCoverageRatio: number
  overdueQuotes: number
  staleOpportunities: number
  unreadNotifications: number
  lowStockCount: number
  pendingPurchaseAuthorizationCount: number
  pendingSupplyRequestCount: number
  overdueOrdersCount: number
  unassignedActiveOrdersCount: number
  operatingResult: number
  netCashflow: number
  receivablesCount: number
  draftVouchersCount: number
}

export function computeHealthScore(args: ComputeHealthScoreArgs) {
  const salesScore = args.salesGrowthPct == null
    ? 14
    : args.salesGrowthPct >= 10
      ? 25
      : args.salesGrowthPct >= 0
        ? 20
        : args.salesGrowthPct >= -10
          ? 12
          : 6

  const pipelineScore = args.pipelineCoverageRatio >= 1.5
    ? 20
    : args.pipelineCoverageRatio >= 0.7
      ? 15
      : args.pipelineCoverageRatio >= 0.3
        ? 10
        : 5

  const commercialAttention = args.overdueQuotes + args.staleOpportunities
  const commercialHygieneScore = commercialAttention === 0
    ? 15
    : commercialAttention <= 3
      ? 11
      : commercialAttention <= 8
        ? 7
        : 3

  const operationalAttention = args.lowStockCount + args.pendingPurchaseAuthorizationCount + args.pendingSupplyRequestCount + args.overdueOrdersCount + args.unassignedActiveOrdersCount + args.unreadNotifications
  const operationsScore = operationalAttention === 0
    ? 20
    : operationalAttention <= 5
      ? 15
      : operationalAttention <= 12
        ? 9
        : 4

  const financePressure = (args.operatingResult < 0 ? 2 : 0)
    + (args.netCashflow < 0 ? 2 : 0)
    + (args.receivablesCount >= 5 ? 2 : args.receivablesCount > 0 ? 1 : 0)
    + (args.draftVouchersCount >= 4 ? 2 : args.draftVouchersCount > 0 ? 1 : 0)
  const financeScore = financePressure === 0
    ? 20
    : financePressure <= 2
      ? 14
      : financePressure <= 4
        ? 8
        : 3

  const dimensions: DecisionHealthDimension[] = [
    {
      id: 'sales-momentum',
      label: 'Momento comercial',
      score: salesScore,
      maxScore: 25,
      summary: args.salesGrowthPct == null
        ? 'Aún no hay histórico suficiente para medir tendencia comercial.'
        : `Variación comercial de ${args.salesGrowthPct.toFixed(1)}% frente al periodo anterior.`,
    },
    {
      id: 'pipeline-coverage',
      label: 'Cobertura de pipeline',
      score: pipelineScore,
      maxScore: 20,
      summary: `El pipeline abierto cubre ${args.pipelineCoverageRatio.toFixed(2)} veces la venta neta del periodo analizado.`,
    },
    {
      id: 'commercial-hygiene',
      label: 'Higiene comercial',
      score: commercialHygieneScore,
      maxScore: 15,
      summary: `${args.overdueQuotes} cotizaciones requieren atención y ${args.staleOpportunities} oportunidades muestran estancamiento.`,
    },
    {
      id: 'operations-load',
      label: 'Ejecución y abastecimiento',
      score: operationsScore,
      maxScore: 20,
      summary: `${args.lowStockCount} faltantes críticos, ${args.pendingPurchaseAuthorizationCount} compras pendientes, ${args.pendingSupplyRequestCount} solicitudes internas de abastecimiento, ${args.overdueOrdersCount} órdenes retrasadas, ${args.unassignedActiveOrdersCount} órdenes sin responsable y ${args.unreadNotifications} notificaciones pendientes.`,
    },
    {
      id: 'finance-resilience',
      label: 'Resiliencia financiera',
      score: financeScore,
      maxScore: 20,
      summary: `Resultado operativo de ${args.operatingResult.toFixed(0)}, flujo neto de ${args.netCashflow.toFixed(0)}, ${args.receivablesCount} saldos por cobrar y ${args.draftVouchersCount} comprobantes en borrador.`,
    },
  ]

  const healthScore = Math.max(0, Math.min(100, dimensions.reduce((sum, dimension) => sum + dimension.score, 0)))
  const healthStatus: DecisionHealthStatus = healthScore >= 85
    ? 'EXCELENTE'
    : healthScore >= 70
      ? 'BUENO'
      : healthScore >= 50
        ? 'ATENCION'
        : 'CRITICO'

  return {
    healthScore,
    healthStatus,
    dimensions,
  }
}