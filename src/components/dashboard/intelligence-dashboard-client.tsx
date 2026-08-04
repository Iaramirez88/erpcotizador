'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, BanknoteArrowDown, BrainCircuit, BriefcaseBusiness, Boxes, Camera, Factory, History, Loader2, Radar, ReceiptText, TrendingUp } from 'lucide-react'
import { ErpPageHero, ErpSectionHeading } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardInfoHeader } from '@/components/ui/card-info-header'

type HealthStatus = 'EXCELENTE' | 'BUENO' | 'ATENCION' | 'CRITICO'

type Insight = {
  id: string
  title: string
  summary: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

type ActionItem = {
  id: string
  title: string
  description: string
  priority: 'NOW' | 'THIS_WEEK' | 'THIS_MONTH'
  owner: 'SALES' | 'CRM' | 'OPERATIONS' | 'PURCHASES' | 'FINANCE' | 'MANAGEMENT'
  expectedImpact?: string | null
  href?: string | null
}

type Kpi = {
  id: string
  label: string
  formattedValue: string
  note?: string | null
}

type Prediction = {
  id: string
  title: string
  metric: string
  value: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  basis: string[]
}

type DecisionResult = {
  target: 'company' | 'crm' | 'sales' | 'inventory' | 'purchases' | 'operations' | 'finance'
  healthScore: number
  healthStatus: HealthStatus
  executiveSummary: string
  alerts: Insight[]
  opportunities: Insight[]
  risks: Insight[]
  recommendations: ActionItem[]
  actions: ActionItem[]
  kpis: Kpi[]
  predictions: Prediction[]
  metadata: {
    from: string
    to: string
    generatedAt: string
  }
}

type ApiResponse = {
  success?: boolean
  data?: DecisionResult
}

type SnapshotItem = {
  id: string
  scope: 'EMPRESA' | 'SEDE'
  from: string
  to: string
  locale: string
  engineVersion: string
  companyHealthScore: number
  companyHealthStatus: HealthStatus
  executiveSummary: string
  createdAt: string
  snapshot?: SnapshotBundle | null
}

type SnapshotApiResponse = {
  success?: boolean
  data?: SnapshotItem[]
}

type SnapshotBundle = {
  generatedAt: string
  company: DecisionResult
  crm: DecisionResult
  finance: DecisionResult
  inventory: DecisionResult
  operations: DecisionResult
  purchases: DecisionResult
  sales: DecisionResult
}

type IntelligenceAdoption = {
  recommendations: {
    openedCount: number
    uniqueActionIds: string[]
    lastOpenedAt: string | null
  }
}

type UiPrefsResponse = {
  success?: boolean
  data?: {
    report?: {
      intelligence?: IntelligenceAdoption
    }
  }
}

type SliceCardProps = {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'sky' | 'teal' | 'amber'
  result: DecisionResult | null
  loading: boolean
  href: string
}

const toneClass = {
  sky: 'border-sky-200 bg-sky-50/70',
  teal: 'border-emerald-200 bg-emerald-50/70',
  amber: 'border-amber-200 bg-amber-50/70',
} as const

const snapshotSliceConfig = [
  { key: 'company', label: 'Compañía', tone: 'sky' },
  { key: 'crm', label: 'CRM', tone: 'teal' },
  { key: 'sales', label: 'Ventas', tone: 'sky' },
  { key: 'inventory', label: 'Inventario', tone: 'amber' },
  { key: 'purchases', label: 'Compras', tone: 'amber' },
  { key: 'operations', label: 'Operaciones', tone: 'teal' },
  { key: 'finance', label: 'Finanzas', tone: 'sky' },
] as const

const emptyAdoption: IntelligenceAdoption = {
  recommendations: {
    openedCount: 0,
    uniqueActionIds: [],
    lastOpenedAt: null,
  },
}

function statusText(status: HealthStatus) {
  switch (status) {
    case 'EXCELENTE': return 'Excelente'
    case 'BUENO': return 'Bueno'
    case 'ATENCION': return 'Atención'
    default: return 'Crítico'
  }
}

function priorityText(priority: ActionItem['priority']) {
  switch (priority) {
    case 'NOW': return 'Ahora'
    case 'THIS_WEEK': return 'Esta semana'
    default: return 'Este mes'
  }
}

function formatGeneratedAt(value?: string) {
  if (!value) return 'Sin dato'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatDelta(value: number) {
  if (value === 0) return '0'
  return value > 0 ? `+${value}` : String(value)
}

function confidenceText(value: Prediction['confidence']) {
  switch (value) {
    case 'HIGH': return 'Alta'
    case 'MEDIUM': return 'Media'
    default: return 'Baja'
  }
}

function formatPredictionValue(result: DecisionResult, prediction: Prediction) {
  const shouldFormatAsCurrency = result.target === 'sales' || result.target === 'finance'
  if (shouldFormatAsCurrency) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(prediction.value)
  }

  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(prediction.value)
}

function normalizeAdoption(value: UiPrefsResponse['data']) {
  const recommendations = value?.report?.intelligence?.recommendations
  return {
    recommendations: {
      openedCount: typeof recommendations?.openedCount === 'number' ? recommendations.openedCount : 0,
      uniqueActionIds: Array.isArray(recommendations?.uniqueActionIds) ? recommendations.uniqueActionIds : [],
      lastOpenedAt: typeof recommendations?.lastOpenedAt === 'string' ? recommendations.lastOpenedAt : null,
    },
  } satisfies IntelligenceAdoption
}

function buildNextAdoptionState(current: IntelligenceAdoption, actionId: string) {
  return {
    recommendations: {
      openedCount: current.recommendations.openedCount + 1,
      uniqueActionIds: Array.from(new Set([...current.recommendations.uniqueActionIds, actionId])).slice(-30),
      lastOpenedAt: new Date().toISOString(),
    },
  } satisfies IntelligenceAdoption
}

function SliceCard({ title, description, icon: Icon, tone, result, loading, href }: SliceCardProps) {
  return (
    <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
      <CardHeader className="space-y-3 pb-4">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClass[tone]}`}>
          <Icon className="h-5 w-5 text-slate-900" />
        </div>
        <div>
          <CardTitle className="text-xl text-slate-950">{title}</CardTitle>
          <CardDescription className="mt-1 text-sm leading-6 text-slate-600">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando bloque...
          </div>
        ) : result ? (
          <>
            <div className={`rounded-[22px] border ${toneClass[tone]} p-4`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salud del bloque</div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <div className="text-3xl font-semibold text-slate-950">{result.healthScore}</div>
                  <div className="text-sm text-slate-600">{statusText(result.healthStatus)}</div>
                </div>
                <div className="text-right text-xs text-slate-500">Actualizado {formatGeneratedAt(result.metadata.generatedAt)}</div>
              </div>
            </div>

            <div className="space-y-2">
              {result.kpis.slice(0, 3).map((kpi) => (
                <div key={kpi.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-950">{kpi.label}</span>
                    <span className="text-slate-700">{kpi.formattedValue}</span>
                  </div>
                  {kpi.note ? <div className="mt-1 text-xs text-slate-500">{kpi.note}</div> : null}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {result.alerts[0] ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span className="font-medium">Alerta:</span> {result.alerts[0].summary}</div> : null}
              {result.risks[0] ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"><span className="font-medium">Riesgo:</span> {result.risks[0].summary}</div> : null}
              {result.opportunities[0] ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><span className="font-medium">Oportunidad:</span> {result.opportunities[0].summary}</div> : null}
            </div>

            <Button asChild variant="outline" className="w-full rounded-xl border-slate-200 bg-white/90">
              <Link href={href}>Abrir bloque</Link>
            </Button>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No se pudo cargar este bloque.</div>
        )}
      </CardContent>
    </Card>
  )
}

export function IntelligenceDashboardClient() {
  const [company, setCompany] = useState<DecisionResult | null>(null)
  const [crm, setCrm] = useState<DecisionResult | null>(null)
  const [finance, setFinance] = useState<DecisionResult | null>(null)
  const [inventory, setInventory] = useState<DecisionResult | null>(null)
  const [operations, setOperations] = useState<DecisionResult | null>(null)
  const [purchases, setPurchases] = useState<DecisionResult | null>(null)
  const [sales, setSales] = useState<DecisionResult | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([])
  const [adoption, setAdoption] = useState<IntelligenceAdoption>(emptyAdoption)
  const [loading, setLoading] = useState(true)
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [capturingSnapshot, setCapturingSnapshot] = useState(false)

  async function loadSnapshots(signal?: AbortSignal) {
    setLoadingSnapshots(true)
    try {
      const response = await fetch('/api/decision-engine/snapshots?limit=8&includeBundle=true', { cache: 'no-store', signal })
      const json = (await response.json().catch(() => null)) as SnapshotApiResponse | null
      setSnapshots(json?.success ? json.data ?? [] : [])
    } finally {
      setLoadingSnapshots(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        const [companyRes, crmRes, financeRes, inventoryRes, operationsRes, purchasesRes, salesRes, prefsRes] = await Promise.all([
          fetch('/api/decision-engine/company', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/decision-engine/crm', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/decision-engine/finance', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/decision-engine/inventory', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/decision-engine/operations', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/decision-engine/purchases', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/decision-engine/sales', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/ui-preferences', { cache: 'no-store', signal: controller.signal }),
        ])

        const [companyJson, crmJson, financeJson, inventoryJson, operationsJson, purchasesJson, salesJson, prefsJson] = await Promise.all([
          companyRes.json().catch(() => null) as Promise<ApiResponse | null>,
          crmRes.json().catch(() => null) as Promise<ApiResponse | null>,
          financeRes.json().catch(() => null) as Promise<ApiResponse | null>,
          inventoryRes.json().catch(() => null) as Promise<ApiResponse | null>,
          operationsRes.json().catch(() => null) as Promise<ApiResponse | null>,
          purchasesRes.json().catch(() => null) as Promise<ApiResponse | null>,
          salesRes.json().catch(() => null) as Promise<ApiResponse | null>,
          prefsRes.json().catch(() => null) as Promise<UiPrefsResponse | null>,
        ])

        setCompany(companyJson?.success ? companyJson.data ?? null : null)
        setCrm(crmJson?.success ? crmJson.data ?? null : null)
        setFinance(financeJson?.success ? financeJson.data ?? null : null)
        setInventory(inventoryJson?.success ? inventoryJson.data ?? null : null)
        setOperations(operationsJson?.success ? operationsJson.data ?? null : null)
        setPurchases(purchasesJson?.success ? purchasesJson.data ?? null : null)
        setSales(salesJson?.success ? salesJson.data ?? null : null)
        setAdoption(normalizeAdoption(prefsJson?.data))
        await loadSnapshots(controller.signal)
      } finally {
        setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  async function captureSnapshot() {
    setCapturingSnapshot(true)
    try {
      await fetch('/api/decision-engine/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      await loadSnapshots()
    } finally {
      setCapturingSnapshot(false)
    }
  }

  function recordRecommendationOpen(actionId: string) {
    const next = buildNextAdoptionState(adoption, actionId)
    setAdoption(next)

    void fetch('/api/ui-preferences', {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: {
          intelligence: next,
        },
      }),
    }).catch(() => null)
  }

  const totalPriorityActions = useMemo(() => {
    return [company, crm, finance, inventory, operations, purchases, sales]
      .flatMap((item) => item?.actions ?? [])
      .filter((action) => action.priority === 'NOW').length
  }, [company, crm, finance, inventory, operations, purchases, sales])

  const topActions = useMemo(() => {
    return [
      ...(company?.actions ?? []),
      ...(company?.recommendations ?? []),
      ...(crm?.actions ?? []),
      ...(crm?.recommendations ?? []),
      ...(finance?.actions ?? []),
      ...(finance?.recommendations ?? []),
      ...(inventory?.actions ?? []),
      ...(inventory?.recommendations ?? []),
      ...(operations?.actions ?? []),
      ...(operations?.recommendations ?? []),
      ...(purchases?.actions ?? []),
      ...(purchases?.recommendations ?? []),
      ...(sales?.actions ?? []),
      ...(sales?.recommendations ?? []),
    ].slice(0, 6)
  }, [company, crm, finance, inventory, operations, purchases, sales])

  const latestSnapshot = snapshots[0] ?? null
  const previousSnapshot = snapshots[1] ?? null
  const snapshotDelta = latestSnapshot && previousSnapshot
    ? latestSnapshot.companyHealthScore - previousSnapshot.companyHealthScore
    : null

  const forecastCards = useMemo(() => {
    return [sales, inventory, finance]
      .filter((item): item is DecisionResult => Boolean(item))
      .map((item) => ({
        target: item.target,
        prediction: item.predictions[0] ?? null,
        result: item,
      }))
      .filter((item): item is { target: DecisionResult['target']; prediction: Prediction; result: DecisionResult } => Boolean(item.prediction))
  }, [finance, inventory, sales])

  const sliceComparisons = useMemo(() => {
    return snapshotSliceConfig
      .map((config) => {
        const current = latestSnapshot?.snapshot?.[config.key] ?? null
        const previous = previousSnapshot?.snapshot?.[config.key] ?? null
        const history = snapshots
          .map((snapshot) => snapshot.snapshot?.[config.key]?.healthScore)
          .filter((value): value is number => typeof value === 'number')
          .slice(0, 4)

        if (!current) return null

        return {
          ...config,
          current,
          delta: previous ? current.healthScore - previous.healthScore : null,
          history,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [latestSnapshot, previousSnapshot, snapshots])

  const adoptionRate = useMemo(() => {
    if (!topActions.length) return 0
    return Math.min(100, Math.round((adoption.recommendations.uniqueActionIds.length / topActions.length) * 100))
  }, [adoption, topActions.length])

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inteligencia empresarial' }]}
        eyebrow="Analítica ejecutiva"
        title="Motor de inteligencia empresarial"
        description="Lectura ejecutiva mínima del negocio construida sobre el Decision Engine, separada del dashboard operativo y de los reportes tradicionales."
        actions={
          <>
            <Button asChild className="rounded-xl">
              <Link href="/dashboard/reportes">Abrir reportes</Link>
            </Button>
            <Button onClick={() => void captureSnapshot()} variant="outline" className="rounded-xl border-slate-200 bg-white/90" disabled={capturingSnapshot}>
              {capturingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Capturar snapshot
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white/90">
              <Link href="/dashboard/crm/oportunidades">Ir a CRM</Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Salud general', value: company?.healthScore ?? '—', hint: 'Puntaje consolidado actual', tone: 'sky' },
          { label: 'Acciones ahora', value: totalPriorityActions, hint: 'Acciones prioritarias inmediatas', tone: 'amber' },
          { label: 'Riesgos activos', value: (company?.risks.length ?? 0) + (finance?.risks.length ?? 0) + (inventory?.risks.length ?? 0) + (operations?.risks.length ?? 0) + (purchases?.risks.length ?? 0), hint: 'Riesgos principales detectados', tone: 'teal' },
        ]}
      />

      <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardInfoHeader
            title={<CardTitle className="text-2xl text-slate-950">Resumen ejecutivo</CardTitle>}
            description="Este bloque consolida la lectura compañía para gerencia. CRM y Ventas se muestran debajo como slices reutilizables del mismo motor."
            tone="data"
          />
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              El motor está consolidando la lectura ejecutiva.
            </div>
          ) : company ? (
            <>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <span>Estado general</span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">{statusText(company.healthStatus)}</span>
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-700">{company.executiveSummary}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-900"><AlertTriangle className="h-4 w-4" /> Riesgos</div>
                  <div className="mt-3 space-y-2">
                    {company.risks.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-rose-200 bg-white/80 px-3 py-3 text-sm text-rose-900">{item.summary}</div>
                    ))}
                    {company.risks.length === 0 ? <div className="rounded-2xl border border-dashed border-rose-200 px-3 py-3 text-sm text-rose-800">Sin riesgo dominante en esta lectura.</div> : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><TrendingUp className="h-4 w-4" /> Oportunidades</div>
                  <div className="mt-3 space-y-2">
                    {company.opportunities.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-emerald-200 bg-white/80 px-3 py-3 text-sm text-emerald-900">{item.summary}</div>
                    ))}
                    {company.opportunities.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-200 px-3 py-3 text-sm text-emerald-800">Sin oportunidad dominante en esta lectura.</div> : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-sky-900"><Activity className="h-4 w-4" /> KPIs</div>
                  <div className="mt-3 space-y-2">
                    {company.kpis.slice(0, 3).map((kpi) => (
                      <div key={kpi.id} className="rounded-2xl border border-sky-200 bg-white/85 px-3 py-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-950">{kpi.label}</span>
                          <span>{kpi.formattedValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No fue posible cargar el resumen ejecutivo.</div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <ErpSectionHeading
          title="Snapshots recientes"
          description="Historial corto de capturas consolidadas del motor para comparar el pulso ejecutivo sin recalcular a ciegas."
        />
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1.8fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardInfoHeader
                title={<CardTitle className="text-xl text-slate-950">Comparación rápida</CardTitle>}
                description="Comparación entre la última captura persistida y la inmediatamente anterior."
                tone="data"
              />
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {loadingSnapshots ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando snapshots...
                </div>
              ) : latestSnapshot ? (
                <>
                  <div className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-sky-900"><History className="h-4 w-4" /> Última captura</div>
                    <div className="mt-3 text-3xl font-semibold text-slate-950">{latestSnapshot.companyHealthScore}</div>
                    <div className="mt-1 text-sm text-slate-600">{statusText(latestSnapshot.companyHealthStatus)} · {formatGeneratedAt(latestSnapshot.createdAt)}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Delta de salud</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">{snapshotDelta == null ? '—' : formatDelta(snapshotDelta)}</div>
                      <div className="mt-1 text-sm text-slate-600">{previousSnapshot ? `Contra ${formatGeneratedAt(previousSnapshot.createdAt)}` : 'Aún no hay snapshot anterior.'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ventana capturada</div>
                      <div className="mt-2 text-sm font-medium text-slate-950">{formatGeneratedAt(latestSnapshot.from)} - {formatGeneratedAt(latestSnapshot.to)}</div>
                      <div className="mt-1 text-sm text-slate-600">{latestSnapshot.scope} · {latestSnapshot.engineVersion}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm leading-6 text-slate-700">
                    {latestSnapshot.executiveSummary}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">Todavía no hay snapshots persistidos. Usa “Capturar snapshot” para guardar la primera lectura.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardInfoHeader
                title={<CardTitle className="text-xl text-slate-950">Historial corto</CardTitle>}
                description="Últimas capturas disponibles para seguir tendencia sin depender solo del estado en vivo."
                tone="data"
              />
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {loadingSnapshots ? (
                <div className="text-sm text-slate-500">Cargando historial...</div>
              ) : snapshots.length ? snapshots.map((snapshot, index) => {
                const older = snapshots[index + 1] ?? null
                const delta = older ? snapshot.companyHealthScore - older.companyHealthScore : null
                return (
                  <div key={snapshot.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{formatGeneratedAt(snapshot.createdAt)}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{snapshot.scope} · salud {snapshot.companyHealthScore} · {statusText(snapshot.companyHealthStatus)}</div>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">{delta == null ? 'Sin base previa' : `Delta ${formatDelta(delta)}`}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{snapshot.executiveSummary}</p>
                  </div>
                )
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No hay historial persistido todavía.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <ErpSectionHeading
          title="Pronósticos próximos"
          description="Predicciones ejecutivas mínimas para ventas, demanda y caja usando la ventana actual y la comparación inmediata disponible."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {forecastCards.map(({ target, prediction, result }) => (
            <Card key={prediction.id} className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="space-y-2 pb-4">
                <CardTitle className="text-xl text-slate-950">{prediction.title}</CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-600">{prediction.metric}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bloque {target}</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">{formatPredictionValue(result, prediction)}</div>
                  <div className="mt-1 text-sm text-slate-600">Confianza {confidenceText(prediction.confidence)}</div>
                </div>
                <div className="space-y-2">
                  {prediction.basis.slice(0, 3).map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">{item}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <ErpSectionHeading
          title="Tendencia por slice"
          description="Comparación corta entre snapshots persistidos para ver qué frente mejora, se estanca o retrocede."
        />
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {sliceComparisons.map((slice) => (
            <Card key={slice.key} className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className={`rounded-[22px] border ${toneClass[slice.tone]} p-4`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{slice.label}</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-3xl font-semibold text-slate-950">{slice.current.healthScore}</div>
                      <div className="text-sm text-slate-600">{statusText(slice.current.healthStatus)}</div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {slice.delta == null ? 'Sin base previa' : `Delta ${formatDelta(slice.delta)}`}
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-600">{slice.current.executiveSummary}</p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                  Últimos puntajes: {slice.history.length ? slice.history.join(' / ') : 'Sin historial suficiente'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <ErpSectionHeading
          title="Slices analíticos activos"
          description="CRM y Ventas ya están acompañados por Finanzas, Inventario, Compras y Operaciones para que la inteligencia siga creciendo por dominios y no por pantallas aisladas."
        />
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-6">
          <SliceCard title="Lectura CRM" description="Seguimiento, oportunidades y cierre comercial desde Captación." icon={Radar} tone="teal" result={crm} loading={loading} href="/dashboard/crm/oportunidades" />
          <SliceCard title="Lectura Finanzas" description="Resultado operativo, caja estimada y presión de cartera y pagos." icon={BanknoteArrowDown} tone="sky" result={finance} loading={loading} href="/dashboard/contabilidad" />
          <SliceCard title="Lectura Inventario" description="Stock crítico, sobrestock y actividad reciente de materiales." icon={Boxes} tone="amber" result={inventory} loading={loading} href="/dashboard/inventario" />
          <SliceCard title="Lectura Operaciones" description="Órdenes retrasadas, áreas con carga acumulada y seguimiento operativo." icon={Factory} tone="teal" result={operations} loading={loading} href="/dashboard/ordenes" />
          <SliceCard title="Lectura Compras" description="Abastecimiento urgente, costos de insumos y pendientes de autorización o pago." icon={ReceiptText} tone="amber" result={purchases} loading={loading} href="/dashboard/compras" />
          <SliceCard title="Lectura Ventas" description="Cotizaciones, venta neta, clientes activos y tracción comercial." icon={BriefcaseBusiness} tone="sky" result={sales} loading={loading} href="/dashboard/cotizaciones" />
        </div>
      </section>

      <section className="space-y-4">
        <ErpSectionHeading
          title="Acciones sugeridas"
          description="Acciones priorizadas producidas por el motor y conectadas con los módulos operativos existentes."
        />
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="space-y-3 p-6">
            {loading ? (
              <div className="text-sm text-slate-500">Cargando acciones...</div>
            ) : topActions.length ? topActions.map((action) => (
              <div key={action.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-950">
                      <span>{action.title}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">{action.owner}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                    {action.expectedImpact ? <p className="mt-1 text-xs leading-5 text-slate-500">Impacto esperado: {action.expectedImpact}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">{priorityText(action.priority)}</span>
                    {action.href ? (
                      <Button asChild size="sm" variant="outline" className="rounded-xl border-slate-200 bg-white/90">
                        <Link
                          href={action.href}
                          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                            if (event.defaultPrevented) return
                            recordRecommendationOpen(action.id)
                          }}
                        >
                          Abrir
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">El motor todavía no devolvió acciones priorizadas para este alcance.</div>
            )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardInfoHeader
                title={<CardTitle className="text-xl text-slate-950">Adopción inicial</CardTitle>}
                description="Métrica ligera por usuario para saber si las recomendaciones del cockpit realmente se abren y usan."
                tone="data"
              />
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acciones abiertas</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{adoption.recommendations.openedCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Adopción actual</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{adoptionRate}%</div>
                  <div className="mt-1 text-sm text-slate-600">{adoption.recommendations.uniqueActionIds.length} acciones distintas abiertas desde este cockpit.</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm leading-6 text-slate-700">
                {adoption.recommendations.lastOpenedAt
                  ? `Última apertura registrada: ${formatGeneratedAt(adoption.recommendations.lastOpenedAt)}.`
                  : 'Todavía no hay aperturas registradas de recomendaciones en esta vista.'}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          <BrainCircuit className="h-4 w-4 text-slate-700" />
          Estado de la fase
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
          El cockpit ya consume el motor desacoplado, expone snapshots persistidos con comparación por slice, publica pronósticos operativos mínimos y registra adopción básica de recomendaciones por usuario. El frente pendiente fuera de estas fases es llevar el scheduler a infraestructura real y sustituir heurísticas por modelos más robustos donde haga sentido.
        </p>
      </section>
    </div>
  )
}