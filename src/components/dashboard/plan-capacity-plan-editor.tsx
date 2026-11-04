'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * Editor de capacidad y consumo de **un plan**.
 *
 * Es la pieza central de la pestaña “Planes”: los planes se diferencian por límites y consumo
 * (cotizaciones, productos, sedes, usuarios…), no por módulos. Se usa también dentro del panel
 * de capacidad autónomo para no duplicar reglas de guardado.
 */

export type PlanCapacityTier = 'CRM' | 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'
export type PlanCapacityPeriodValue = 'MONTHLY' | 'ACCUMULATED'
export type PlanCapacityPolicyValue = 'BLOCK' | 'OVERAGE' | 'WARN'
export type PlanCapacitySourceValue = 'DEFAULT' | 'CUSTOM' | 'CATALOG'

export type PlanCapacityResourceMeta = {
  resource: string
  label: string
  shortLabel: string
  unit: string
  period: PlanCapacityPeriodValue
  policy: PlanCapacityPolicyValue
  description: string
  blockedOperations: string[]
  allowedOperations: string[]
}

export type PlanCapacityLimitRow = {
  planTier: PlanCapacityTier
  resource: string
  limit: number | null
  period: PlanCapacityPeriodValue
  policy: PlanCapacityPolicyValue
  warningPct: number
  criticalPct: number
  source: PlanCapacitySourceValue
  isCustom: boolean
}

export const CAPACITY_SOURCE_LABELS: Record<PlanCapacitySourceValue, { label: string; className: string }> = {
  DEFAULT: { label: 'Por defecto', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  CUSTOM: { label: 'Personalizado', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  CATALOG: { label: 'Catálogo', className: 'border-violet-200 bg-violet-50 text-violet-700' },
}

export const CAPACITY_POLICY_LABELS: Record<PlanCapacityPolicyValue, string> = {
  BLOCK: 'Bloquear al 100%',
  OVERAGE: 'Permitir excedente',
  WARN: 'Solo advertir',
}

export const CAPACITY_PERIOD_LABELS: Record<PlanCapacityPeriodValue, string> = {
  MONTHLY: 'Mensual',
  ACCUMULATED: 'Acumulado',
}

type Draft = {
  limit: string
  period: PlanCapacityPeriodValue
  policy: PlanCapacityPolicyValue
  warningPct: string
  criticalPct: string
}

function draftFromRow(row: PlanCapacityLimitRow): Draft {
  return {
    limit: row.limit === null ? '' : String(row.limit),
    period: row.period,
    policy: row.policy,
    warningPct: String(row.warningPct),
    criticalPct: String(row.criticalPct),
  }
}

function parseLimit(value: string): number | null | 'INVALID' {
  const trimmed = value.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) return 'INVALID'
  return Math.round(numeric)
}

function sanitizePct(value: string, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(100, Math.max(1, Math.round(numeric)))
}

export default function PlanCapacityPlanEditor({
  planTier,
  planLabel,
  resources,
  rows,
  onSaved,
  showHeader = true,
}: {
  planTier: PlanCapacityTier
  planLabel?: string
  resources: PlanCapacityResourceMeta[]
  rows: PlanCapacityLimitRow[]
  onSaved: () => void | Promise<void>
  showHeader?: boolean
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const planRows = useMemo(() => rows.filter((row) => row.planTier === planTier), [rows, planTier])

  const rowMap = useMemo(() => {
    const map = new Map<string, PlanCapacityLimitRow>()
    for (const row of planRows) map.set(row.resource, row)
    return map
  }, [planRows])

  // Los borradores se rehidratan cuando llegan datos nuevos del servidor. Se devuelve el mismo
  // objeto si nada cambió para no entrar en un ciclo de renders si el padre recrea el arreglo.
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, Draft> = {}
      for (const row of rows) {
        if (row.planTier === planTier) next[row.resource] = draftFromRow(row)
      }

      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)
      const isSame =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => {
          const a = prev[key]
          const b = next[key]
          return Boolean(a) && a.limit === b.limit && a.period === b.period && a.policy === b.policy &&
            a.warningPct === b.warningPct && a.criticalPct === b.criticalPct
        })

      return isSame ? prev : next
    })
  }, [rows, planTier])

  const updateDraft = useCallback((resource: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [resource]: { ...prev[resource], ...patch } }))
    setNotice(null)
  }, [])

  async function saveLimit(resource: string) {
    const draft = drafts[resource]
    if (!draft) return

    const parsedLimit = parseLimit(draft.limit)
    if (parsedLimit === 'INVALID') {
      setError('El límite debe ser un número mayor o igual a 0. Déjalo vacío para ilimitado.')
      return
    }

    setSavingKey(resource)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/super-admin/plan-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier,
          resource,
          limit: parsedLimit,
          period: draft.period,
          policy: draft.policy,
          warningPct: sanitizePct(draft.warningPct, 80),
          criticalPct: sanitizePct(draft.criticalPct, 90),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'No se pudo guardar el límite')
        return
      }
      setNotice(`Límite guardado para ${planLabel ?? planTier} · ${resource}.`)
      await onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error inesperado')
    } finally {
      setSavingKey(null)
    }
  }

  async function resetLimit(resource: string) {
    setSavingKey(resource)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/super-admin/plan-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier, resource, reset: true }),
      })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'No se pudo restablecer el límite')
        return
      }
      setNotice(`Límite restablecido a los valores por defecto en ${planLabel ?? planTier}.`)
      await onSaved()
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Error inesperado')
    } finally {
      setSavingKey(null)
    }
  }


  return (
    <div className="space-y-3">
      {showHeader ? (
        <p className="text-xs text-slate-500">
          Define el límite de cada recurso. Los avisos se disparan al 80% y 90%; al 100% la política define si se
          bloquea la creación o se permite con excedente.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {resources.map((meta) => {
          const row = rowMap.get(meta.resource)
          const baseDraft = row ? draftFromRow(row) : null
          const draft = drafts[meta.resource] ?? baseDraft
          if (!draft) return null

          const source = row?.source ?? 'DEFAULT'
          const isDirty =
            baseDraft !== null &&
            (draft.limit !== baseDraft.limit ||
              draft.period !== baseDraft.period ||
              draft.policy !== baseDraft.policy ||
              draft.warningPct !== baseDraft.warningPct ||
              draft.criticalPct !== baseDraft.criticalPct)

          return (
            <div key={meta.resource} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                  <div className="text-xs text-slate-500">{meta.description}</div>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    CAPACITY_SOURCE_LABELS[source].className
                  )}
                >
                  {CAPACITY_SOURCE_LABELS[source].label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Límite {meta.unit ? `(${meta.unit})` : ''}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.limit}
                    placeholder="Ilimitado"
                    disabled={savingKey === meta.resource}
                    onChange={(event) => updateDraft(meta.resource, { limit: event.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[11px] uppercase tracking-wide text-slate-500">Periodo</Label>
                  <Select
                    value={draft.period}
                    onValueChange={(value) =>
                      updateDraft(meta.resource, { period: value as PlanCapacityPeriodValue })
                    }
                  >
                    <SelectTrigger disabled={savingKey === meta.resource}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">{CAPACITY_PERIOD_LABELS.MONTHLY}</SelectItem>
                      <SelectItem value="ACCUMULATED">{CAPACITY_PERIOD_LABELS.ACCUMULATED}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>



              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-[11px] uppercase tracking-wide text-slate-500">Al llegar al 100%</Label>
                  <Select
                    value={draft.policy}
                    onValueChange={(value) =>
                      updateDraft(meta.resource, { policy: value as PlanCapacityPolicyValue })
                    }
                  >
                    <SelectTrigger disabled={savingKey === meta.resource}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BLOCK">{CAPACITY_POLICY_LABELS.BLOCK}</SelectItem>
                      <SelectItem value="OVERAGE">{CAPACITY_POLICY_LABELS.OVERAGE}</SelectItem>
                      <SelectItem value="WARN">{CAPACITY_POLICY_LABELS.WARN}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label className="text-[11px] uppercase tracking-wide text-slate-500">Aviso %</Label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={draft.warningPct}
                      disabled={savingKey === meta.resource}
                      onChange={(event) => updateDraft(meta.resource, { warningPct: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] uppercase tracking-wide text-slate-500">Crítico %</Label>
                    <Input
                      type="number"
                      min={2}
                      max={100}
                      value={draft.criticalPct}
                      disabled={savingKey === meta.resource}
                      onChange={(event) => updateDraft(meta.resource, { criticalPct: event.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  {row === undefined || row.limit === null
                    ? 'Ilimitado'
                    : `Actual: ${row.limit}${meta.unit ? ` ${meta.unit}` : ''}`}
                  {isDirty ? ' · sin guardar' : ''}
                </span>
                <div className="flex items-center gap-2">
                  {row?.isCustom ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={savingKey === meta.resource}
                      onClick={() => void resetLimit(meta.resource)}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Restablecer
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingKey === meta.resource}
                    onClick={() => void saveLimit(meta.resource)}
                  >
                    {savingKey === meta.resource ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
