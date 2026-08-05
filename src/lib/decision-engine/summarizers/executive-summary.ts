import type { DecisionHealthStatus, DecisionInsight } from '@/lib/decision-engine/contracts'

type BuildExecutiveSummaryArgs = {
  healthStatus: DecisionHealthStatus
  salesGrowthPct: number | null
  overdueQuotes: number
  staleOpportunities: number
  lowStockCount: number
  pendingPurchaseAuthorizationCount: number
  overdueOrdersCount: number
  netCashflow: number
  receivablesCount: number
  receivablesAmount: number
  draftVouchersCount: number
  opportunities: DecisionInsight[]
  risks: DecisionInsight[]
}

function describeHealthStatus(status: DecisionHealthStatus) {
  switch (status) {
    case 'EXCELENTE':
      return 'La operación muestra una lectura sólida y estable.'
    case 'BUENO':
      return 'La empresa mantiene una base saludable, con focos puntuales por atender.'
    case 'ATENCION':
      return 'La empresa necesita intervención gerencial en varios frentes para evitar deterioro.'
    default:
      return 'La lectura general es crítica y requiere acción prioritaria de gerencia.'
  }
}

export function buildExecutiveSummary(args: BuildExecutiveSummaryArgs) {
  const trendLine = args.salesGrowthPct == null
    ? 'Todavía no hay suficiente histórico comparable para calificar la tendencia comercial.'
    : args.salesGrowthPct >= 0
      ? `Las ventas netas crecen ${args.salesGrowthPct.toFixed(1)}% frente al periodo anterior.`
      : `Las ventas netas caen ${Math.abs(args.salesGrowthPct).toFixed(1)}% frente al periodo anterior.`

  const attentionLine = args.overdueQuotes > 0 || args.staleOpportunities > 0
    ? `Hay ${args.overdueQuotes} cotizaciones vencidas o sin mover y ${args.staleOpportunities} oportunidades estancadas que deben revisarse.`
    : 'No se observan señales fuertes de fricción comercial en cotizaciones ni oportunidades abiertas.'

  const operationsLine = args.lowStockCount > 0 || args.pendingPurchaseAuthorizationCount > 0 || args.overdueOrdersCount > 0
    ? `En recursos y operaciones aparecen ${args.lowStockCount} faltantes críticos, ${args.pendingPurchaseAuthorizationCount} compras pendientes por autorizar y ${args.overdueOrdersCount} órdenes retrasadas.`
    : 'Recursos y operaciones no muestran una fricción dominante en stock, compras u órdenes activas.'

  const financeLine = args.netCashflow < 0 || args.receivablesCount > 0 || args.draftVouchersCount > 0
    ? `Finanzas muestra flujo neto estimado de ${args.netCashflow.toFixed(0)}, ${args.receivablesCount} saldos por cobrar por ${args.receivablesAmount.toFixed(0)} y ${args.draftVouchersCount} comprobantes aún en borrador.`
    : 'Finanzas no muestra tensión dominante en caja, cartera ni cierre contable.'

  const opportunityLine = args.opportunities.length > 0
    ? `La principal mejora sugerida en esta lectura es: ${args.opportunities[0]?.title.toLowerCase()}.`
    : 'Por ahora la lectura no resalta una mejora dominante que sobresalga sobre el resto.'

  const riskLine = args.risks.length > 0
    ? `El principal pendiente a revisar es: ${args.risks[0]?.title.toLowerCase()}.`
    : 'No hay un pendiente dominante por encima del resto en el periodo consultado.'

  return [describeHealthStatus(args.healthStatus), trendLine, attentionLine, operationsLine, financeLine, opportunityLine, riskLine].join(' ')
}