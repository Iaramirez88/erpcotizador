'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { PlanCapacityPanel } from '@/components/dashboard/plan-capacity-panel'
import PlanCapacityPlanEditor, {
  type PlanCapacityLimitRow,
  type PlanCapacityResourceMeta,
  type PlanCapacityTier,
} from '@/components/dashboard/plan-capacity-plan-editor'

type PlanSummaryRow = {
  planTier: PlanCapacityTier
  nombre: string
  storageLimitGb: number | null
}

type EmpresaOption = {
  id: string
  nombre: string
  nit: string | null
  planTier: string | null
}

type PlanLimitsResponse =
  | {
      ok: true
      plans: PlanSummaryRow[]
      resources: PlanCapacityResourceMeta[]
      rows: PlanCapacityLimitRow[]
      thresholds: { warningPct: number; criticalPct: number }
    }
  | { ok?: false; error?: string }

const PLAN_TIER_FALLBACK_LABELS: Record<PlanCapacityTier, string> = {
  CRM: 'CRM',
  BASIC: 'Básico',
  MEDIO: 'Medio',
  INTERMEDIO: 'Intermedio',
  FULL: 'Full',
}

/**
 * Panel autónomo de capacidad y consumo.
 *
 * La edición por plan vive en `PlanCapacityPlanEditor` (compartido con la pestaña “Planes”).
 * Aquí se agrega el consumo real de una empresa concreta para detectar quién está cerca del límite.
 */
export default function PlanCapacityAdminPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<PlanSummaryRow[]>([])
  const [resources, setResources] = useState<PlanCapacityResourceMeta[]>([])
  const [rows, setRows] = useState<PlanCapacityLimitRow[]>([])
  const [activeTier, setActiveTier] = useState<PlanCapacityTier>('FULL')

  const [empresaQuery, setEmpresaQuery] = useState('')
  const [empresaOptions, setEmpresaOptions] = useState<EmpresaOption[]>([])
  const [empresaSearching, setEmpresaSearching] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaOption | null>(null)
  const [consumptionToken, setConsumptionToken] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/super-admin/plan-limits', { cache: 'no-store' })
      const payload = (await response.json().catch(() => ({}))) as PlanLimitsResponse
      if (!response.ok || !payload.ok) {
        setError(('error' in payload && payload.error) || 'No se pudo cargar la configuración de capacidad')
        return
      }
      setPlans(payload.plans)
      setResources(payload.resources)
      setRows(payload.rows)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const planLabel = (tier: PlanCapacityTier) =>
    plans.find((plan) => plan.planTier === tier)?.nombre?.trim() || PLAN_TIER_FALLBACK_LABELS[tier]

  async function searchEmpresas() {
    setEmpresaSearching(true)
    setError(null)
    try {
      const query = empresaQuery.trim()
      const response = await fetch(`/api/super-admin/empresas${query ? `?search=${encodeURIComponent(query)}` : ''}`, {
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        items?: EmpresaOption[]
        empresas?: EmpresaOption[]
        error?: string
      }
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'No se pudieron cargar las empresas')
        return
      }
      // `GET /api/super-admin/empresas` responde `items`; se acepta `empresas` por compatibilidad.
      setEmpresaOptions(((payload.items ?? payload.empresas) ?? []).slice(0, 20))
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Error inesperado')
    } finally {
      setEmpresaSearching(false)
    }
  }

  function selectEmpresa(empresa: EmpresaOption) {
    setSelectedEmpresa(empresa)
    setConsumptionToken((token) => token + 1)
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Capacidad y consumo por plan</CardTitle>
          <CardDescription>
            Los planes se diferencian por límites y consumo, no por módulos. Los avisos se disparan al 80% y 90%, y al
            100% la política define si se bloquea la creación o se permite con excedente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && resources.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando límites…
            </div>
          ) : null}

          <Tabs value={activeTier} onValueChange={(value) => setActiveTier(value as PlanCapacityTier)}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
              {plans.map((plan) => (
                <TabsTrigger key={plan.planTier} value={plan.planTier} className="flex-1 sm:flex-none">
                  <span className="flex flex-col items-start leading-tight">
                    <span>{plan.nombre?.trim() || PLAN_TIER_FALLBACK_LABELS[plan.planTier]}</span>
                    <span className="text-[10px] font-normal uppercase tracking-wide opacity-70">{plan.planTier}</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <PlanCapacityPlanEditor
            planTier={activeTier}
            planLabel={planLabel(activeTier)}
            resources={resources}
            rows={rows}
            onSaved={load}
          />
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Consumo real de una empresa</CardTitle>
          <CardDescription>
            Consulta cómo va el consumo de cualquier empresa frente a los límites de su plan actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-[240px] flex-1 gap-1.5">
              <Label className="text-sm">Nombre, NIT, código de espacio o ID</Label>
              <Input
                value={empresaQuery}
                onChange={(event) => setEmpresaQuery(event.target.value)}
                placeholder="Ej. 900123456 o WS-XXXX"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void searchEmpresas()
                }}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void searchEmpresas()} disabled={empresaSearching}>
              {empresaSearching ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>

          {empresaOptions.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {empresaOptions.map((empresa) => (
                <button
                  key={empresa.id}
                  type="button"
                  onClick={() => selectEmpresa(empresa)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    selectedEmpresa?.id === empresa.id
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <div className="font-medium text-slate-900">{empresa.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {empresa.nit ? `NIT ${empresa.nit}` : 'Sin NIT'}
                    {empresa.planTier ? ` · Plan ${empresa.planTier}` : ''}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {selectedEmpresa ? (
            <PlanCapacityPanel
              key={`${selectedEmpresa.id}-${consumptionToken}`}
              empresaId={selectedEmpresa.id}
              title={`Consumo · ${selectedEmpresa.nombre}`}
              description="Métricas reales de consumo del espacio de trabajo seleccionado."
              showUpgradeCta={false}
              refreshToken={consumptionToken}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Busca una empresa para ver su consumo real y detectar quién está cerca de su límite.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

