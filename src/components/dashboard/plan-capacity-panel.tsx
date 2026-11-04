'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type PlanCapacityLevel = 'ok' | 'warning' | 'critical' | 'reached'

export type PlanCapacityMeterDTO = {
  resource: string
  label: string
  shortLabel: string
  unit: string
  period: 'MONTHLY' | 'ACCUMULATED'
  policy: 'BLOCK' | 'OVERAGE' | 'WARN'
  limit: number | null
  used: number
  remaining: number | null
  percentage: number
  level: PlanCapacityLevel
  allowed: boolean
  warningPct: number
  criticalPct: number
  planTier: string
  upgradeUrl: string
  message: string
  description: string
  blockedOperations: string[]
  allowedOperations: string[]
}

export type PlanCapacityResponse = {
  ok: boolean
  isSuperAdmin?: boolean
  companyId: string | null
  companyName: string | null
  planTier: string | null
  generatedAt: string
  meters: PlanCapacityMeterDTO[]
  summary: { level: PlanCapacityLevel; alerts: number; blocked: number } | null
  error?: string
}

const LEVEL_STYLES: Record<
  PlanCapacityLevel,
  { bar: string; badge: string; border: string; label: string }
> = {
  ok: {
    bar: 'bg-emerald-600',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    border: 'border-slate-200',
    label: 'Saludable',
  },
  warning: {
    bar: 'bg-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    border: 'border-amber-200',
    label: 'Aviso 80%',
  },
  critical: {
    bar: 'bg-orange-500',
    badge: 'border-orange-200 bg-orange-50 text-orange-700',
    border: 'border-orange-200',
    label: 'Alerta 90%',
  },
  reached: {
    bar: 'bg-rose-600',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    border: 'border-rose-200',
    label: 'Capacidad alcanzada',
  },
}

const POLICY_LABELS: Record<PlanCapacityMeterDTO['policy'], string> = {
  BLOCK: 'Bloquea nuevas operaciones',
  OVERAGE: 'Permite excedente facturable',
  WARN: 'Solo advierte',
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value)
}

function formatAmount(value: number | null, unit: string): string {
  if (value === null) return 'Ilimitado'
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

function buildCsv(meters: PlanCapacityMeterDTO[], companyName: string | null): string {
  const header = [
    'Empresa',
    'Recurso',
    'Consumo',
    'Limite',
    'Disponible',
    'Porcentaje',
    'Periodo',
    'Estado',
    'Politica',
  ]
  const rows = meters.map((meter) => [
    companyName ?? '',
    meter.label,
    String(meter.used),
    meter.limit === null ? 'ILIMITADO' : String(meter.limit),
    meter.remaining === null ? '' : String(meter.remaining),
    `${meter.percentage}%`,
    meter.period === 'MONTHLY' ? 'Mensual' : 'Acumulado',
    meter.level,
    meter.policy,
  ])
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
}

export type PlanCapacityPanelProps = {
  /** Solo super admin: consulta el consumo de otra empresa. */
  empresaId?: string
  title?: string
  description?: string
  showUpgradeCta?: boolean
  showExport?: boolean
  refreshToken?: number
  className?: string
}

export function PlanCapacityPanel({
  empresaId,
  title = 'Consumo de tu plan',
  description = 'Seguimiento del consumo real de tu empresa con avisos al 80%, 90% y 100% de la capacidad.',
  showUpgradeCta = true,
  showExport = true,
  refreshToken = 0,
  className,
}: PlanCapacityPanelProps) {
  const [data, setData] = useState<PlanCapacityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (empresaId) params.set('empresaId', empresaId)
      const query = params.toString()
      const response = await fetch(`/api/plan/capacity${query ? `?${query}` : ''}`, { cache: 'no-store' })
      const payload = (await response.json()) as PlanCapacityResponse
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'No se pudo cargar el consumo del plan')
      }
      setData(payload)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Error al cargar el consumo')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    void load()
  }, [load, refreshToken, reloadKey])

  const meters = useMemo(() => data?.meters ?? [], [data])
  const reachedMeters = useMemo(() => meters.filter((meter) => meter.limit !== null && !meter.allowed), [meters])
  const worstLevel: PlanCapacityLevel = data?.summary?.level ?? 'ok'

  const handleExport = useCallback(() => {
    if (meters.length === 0) return
    const csv = buildCsv(meters, data?.companyName ?? null)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    link.download = `consumo-plan-${data?.companyId ?? 'empresa'}-${stamp}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [data?.companyId, data?.companyName, meters])

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="gap-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {title}
              {data?.planTier ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Plan {data.planTier}
                </span>
              ) : null}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {showExport ? (
              <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={meters.length === 0}>
                <Download className="mr-1.5 h-4 w-4" />
                Exportar CSV
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </div>

        {data && data.summary ? (
          <div
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              LEVEL_STYLES[worstLevel].border,
              LEVEL_STYLES[worstLevel].badge
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">{LEVEL_STYLES[worstLevel].label}</span>
              <span className="text-xs">
                {data.summary.alerts} recurso(s) en aviso · {data.summary.blocked} bloqueado(s) para nuevas operaciones
              </span>
            </div>
            {reachedMeters.length > 0 ? (
              <p className="mt-1 text-xs">
                Puedes seguir consultando y exportando tu histórico. Para crear nuevos registros en{' '}
                {reachedMeters.map((meter) => meter.label.toLowerCase()).join(', ')}, amplía tu plan.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {data && data.isSuperAdmin && !data.companyId ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            Como super admin no tienes una empresa asignada. Consulta el consumo real por empresa en{' '}
            <Link className="font-semibold underline" href="/dashboard/configuracion/super-admin/modulos-por-plan">
              Super Admin · Capacidad y consumo
            </Link>
            .
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        {loading && meters.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando consumo…
          </div>
        ) : null}

        {!loading && meters.length === 0 && !error ? (
          <p className="text-sm text-slate-500">Aún no hay recursos medibles para esta empresa.</p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {meters.map((meter) => (
            <div key={meter.resource} className={cn('rounded-xl border p-3', LEVEL_STYLES[meter.level].border)}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{meter.label}</span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    LEVEL_STYLES[meter.level].badge
                  )}
                >
                  {meter.limit === null ? 'Ilimitado' : `${formatNumber(meter.percentage)}%`}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-slate-600">
                <span>
                  {formatAmount(meter.used, meter.unit)} de {formatAmount(meter.limit, meter.unit)}
                </span>
                <span>{meter.period === 'MONTHLY' ? 'Mensual' : 'Acumulado'}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full transition-all', LEVEL_STYLES[meter.level].bar)}
                  style={{
                    width: `${meter.limit === null ? 100 : Math.min(100, Math.max(meter.percentage, meter.used > 0 ? 4 : 0))}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{meter.message}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {POLICY_LABELS[meter.policy]} · Aviso {meter.warningPct}% · Crítico {meter.criticalPct}%
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Reglas de consumo</p>
          <p>80%: aviso preventivo. 90%: alerta al administrador. 100%: capacidad alcanzada.</p>
          <p>Nunca se elimina ni se bloquea el acceso a tus registros existentes: siempre puedes consultar y exportar.</p>
        </div>

        {showUpgradeCta && reachedMeters.length > 0 ? (
          <Button asChild>
            <Link href="/dashboard/configuracion/plan">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Ampliar capacidad
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
