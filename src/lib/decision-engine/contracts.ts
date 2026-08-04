export type DecisionAnalysisTarget =
  | 'crm'
  | 'sales'
  | 'inventory'
  | 'purchases'
  | 'operations'
  | 'finance'
  | 'company'

export type DecisionHealthStatus = 'EXCELENTE' | 'BUENO' | 'ATENCION' | 'CRITICO'
export type DecisionInsightKind = 'ALERT' | 'OPPORTUNITY' | 'RISK'
export type DecisionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type DecisionActionPriority = 'NOW' | 'THIS_WEEK' | 'THIS_MONTH'
export type DecisionOwner = 'SALES' | 'CRM' | 'OPERATIONS' | 'PURCHASES' | 'FINANCE' | 'MANAGEMENT'
export type DecisionPredictionConfidence = 'LOW' | 'MEDIUM' | 'HIGH'
export type DecisionKpiStatus = 'POSITIVE' | 'NEUTRAL' | 'WARNING' | 'NEGATIVE'

export type DecisionEngineContext = {
  empresaId: string
  sedeId?: string | null
  actorUserId?: string | null
  from?: Date
  to?: Date
  locale?: string
}

export type DecisionEntityRef = {
  type: string
  id: string
  label?: string | null
}

export type DecisionInsight = {
  id: string
  kind: DecisionInsightKind
  title: string
  summary: string
  severity: DecisionSeverity
  domain: string
  subdomain?: string | null
  entityRefs?: DecisionEntityRef[]
  reasons: string[]
  evidence: string[]
  impact?: {
    label: string
    amount?: number | null
    currency?: 'COP' | null
  }
}

export type DecisionAction = {
  id: string
  title: string
  description: string
  priority: DecisionActionPriority
  owner: DecisionOwner
  expectedImpact?: string | null
  href?: string | null
}

export type DecisionPrediction = {
  id: string
  title: string
  metric: string
  value: number
  confidence: DecisionPredictionConfidence
  basis: string[]
}

export type DecisionKpi = {
  id: string
  label: string
  value: number
  formattedValue: string
  status: DecisionKpiStatus
  deltaPct?: number | null
  note?: string | null
}

export type DecisionTrend = {
  id: string
  label: string
  direction: 'UP' | 'DOWN' | 'FLAT'
  summary: string
  magnitudePct?: number | null
}

export type DecisionExplanation = {
  id: string
  title: string
  details: string[]
}

export type DecisionHealthDimension = {
  id: string
  label: string
  score: number
  maxScore: number
  summary: string
}

export type DecisionEngineResult = {
  target: DecisionAnalysisTarget
  healthScore: number
  healthStatus: DecisionHealthStatus
  executiveSummary: string
  alerts: DecisionInsight[]
  opportunities: DecisionInsight[]
  recommendations: DecisionAction[]
  predictions: DecisionPrediction[]
  risks: DecisionInsight[]
  kpis: DecisionKpi[]
  trends: DecisionTrend[]
  actions: DecisionAction[]
  explainability: DecisionExplanation[]
  healthBreakdown: DecisionHealthDimension[]
  metadata: {
    generatedAt: string
    scope: 'EMPRESA' | 'SEDE'
    empresaId: string
    sedeId: string | null
    from: string
    to: string
    locale: string
  }
}

export type DecisionEngineResultFragment = Partial<Omit<DecisionEngineResult, 'target' | 'metadata'>>

export interface DecisionAnalyzerPlugin<TFacts = unknown> {
  key: DecisionAnalysisTarget
  collect: (context: DecisionEngineContext) => Promise<TFacts>
  analyze: (facts: TFacts, context: DecisionEngineContext) => Promise<DecisionEngineResultFragment>
}

export interface DecisionEngine {
  analyze: (target: DecisionAnalysisTarget, context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzeCrm: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzeFinance: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzeInventory: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzeOperations: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzePurchases: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzeSales: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzeCompany: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
}