'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RotateCcw, Search, UserRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { ModuleKey } from '@prisma/client'

type PlanTier = 'CRM' | 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'
type LimitPeriod = 'MONTHLY' | 'ACCUMULATED'
type OveragePolicy = 'BLOCK' | 'OVERAGE' | 'WARN'

export type PlanPricingOption = {
  tier: PlanTier
  nombre: string
  precioMensualCOP: number
}

type UserEmpresa = {
  id: string
  nombre: string
  nit: string | null
  planTier: PlanTier | null
  planValidUntil?: string | null
  trialTier?: PlanTier | null
  trialValidUntil?: string | null
}

type UserOption = {
  id: string
  email: string
  name: string | null
  role?: string | null
  empresa: UserEmpresa | null
}

type ModuleAssignmentRow = {
  module: ModuleKey
  nombre: string
  descripcion: string
  category: string
  priceCOP: number
  baseEnabled: boolean
  overrideEnabled: boolean | null
  effectiveEnabled: boolean
  includedInPlan: boolean
  moduleCOP: number
  capacityResources: string[]
  notes: string | null
}

type CapacityAssignmentRow = {
  resource: string
  label: string
  shortLabel: string
  unit: string
  description: string
  ownerModule: ModuleKey
  ownerModuleName: string
  modules: ModuleKey[]
  moduleEnabled: boolean
  shared: boolean
  planLimit: number | null
  planPolicy: OveragePolicy
  planPeriod: LimitPeriod
  limitValue: number | null
  limitPeriod: LimitPeriod
  overagePolicy: OveragePolicy | null
  pricePerExtraUnitCOP: number | null
  notes: string | null
  used: number
  effectiveLimit: number | null
  effectivePolicy: OveragePolicy
  effectivePeriod: LimitPeriod
  extraUnits: number
  consumptionCOP: number
  configured: boolean
}

type AssignmentsPayload = {
  ok: true
  empresa: {
    id: string
    nombre: string
    nit: string | null
    planTier: PlanTier
    effectivePlanTier: PlanTier
    billingCycle: string
    planOwnerUserId: string | null
    moduleOnlyBilling: boolean
  }
  rows: ModuleAssignmentRow[]
  capacity: CapacityAssignmentRow[]
  totals: {
    basePlanCOP: number
    modulesCOP: number
    consumptionCOP: number
    totalCOP: number
    includedModules: number
    extraModules: number
    consumptionResources: number
  }
}

type ApiError = { ok?: false; error?: string }

type QuantityDraft = { limit: string; price: string }

const PERIOD_LABELS: Record<LimitPeriod, string> = {
  MONTHLY: 'Por mes',
  ACCUMULATED: 'Acumulado',
}

const POLICY_OPTIONS: Array<{ value: OveragePolicy; label: string }> = [
  { value: 'BLOCK', label: 'Bloquear al límite' },
  { value: 'WARN', label: 'Solo alertar' },
  { value: 'OVERAGE', label: 'Cobrar excedente' },
]

const POLICY_LABELS: Record<OveragePolicy, string> = {
  BLOCK: 'Bloquea al límite',
  WARN: 'Solo alerta',
  OVERAGE: 'Cobra excedente',
}

function formatCOP(value: number) {
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(safe)
}

function formatUnits(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0)
}

function formatLimit(value: number | null, unit: string) {
  if (value === null) return 'Sin límite'
  return unit ? `${formatUnits(value)} ${unit}` : formatUnits(value)
}

function resolvePlanName(planOptions: PlanPricingOption[], tier: PlanTier | null) {
  if (!tier) return 'Sin plan'
  return planOptions.find((plan) => plan.tier === tier)?.nombre?.trim() || tier
}

function formatBillingCycle(cycle: string) {
  const normalized = cycle.toUpperCase()
  if (normalized === 'YEARLY' || normalized === 'ANNUAL') return 'anual'
  if (normalized === 'MONTHLY') return 'mensual'
  return cycle.toLowerCase()
}

function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.round(numeric)
}

function draftKey(resource: string) {
  return `capacity:${resource}`
}

function buildDrafts(payload: AssignmentsPayload): Record<string, QuantityDraft> {
  const next: Record<string, QuantityDraft> = {}
  for (const row of payload.capacity) {
    next[draftKey(row.resource)] = {
      limit: row.limitValue === null ? '' : String(row.limitValue),
      price: row.pricePerExtraUnitCOP === null ? '' : String(row.pricePerExtraUnitCOP),
    }
  }
  return next
}

export default function PlanModuleAssignmentPanel({ planOptions }: { planOptions: PlanPricingOption[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserOption[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [payload, setPayload] = useState<AssignmentsPayload | null>(null)
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, QuantityDraft>>({})
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const requestRef = useRef(0)

  const selectedLabel = selectedUser ? selectedUser.name?.trim() || selectedUser.email : null

  useEffect(() => {
    const term = query.trim()
    // Al elegir un usuario el input se rellena con su nombre: no repetimos la búsqueda.
    if (term.length < 2 || (selectedLabel && term === selectedLabel)) {
      setResults([])
      setSearching(false)
      return
    }
    const timer = setTimeout(async () => {
      const requestId = ++requestRef.current
      setSearching(true)
      try {
        const res = await fetch(`/api/super-admin/users?search=${encodeURIComponent(term)}&limit=8`, {
          cache: 'no-store',
        })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: UserOption[]; error?: string }
        if (requestRef.current !== requestId) return
        if (!res.ok || !json.ok) {
          setResults([])
          setError(json.error || 'No se pudieron buscar usuarios')
          return
        }
        setResults(Array.isArray(json.items) ? json.items : [])
        setShowResults(true)
      } catch (e) {
        if (requestRef.current === requestId) {
          setError(e instanceof Error ? e.message : 'Error inesperado')
        }
      } finally {
        if (requestRef.current === requestId) setSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query, selectedLabel])

  const applyPayload = useCallback((next: AssignmentsPayload) => {
    setPayload(next)
    setQuantityDrafts(buildDrafts(next))
  }, [])

  const loadAssignments = useCallback(async (empresaId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(empresaId)}/module-assignments`, {
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => ({}))) as AssignmentsPayload | ApiError
      if (!res.ok || !('ok' in json) || !json.ok) {
        setPayload(null)
        setError(('error' in json && json.error) || 'No se pudieron cargar los módulos de la empresa')
        return
      }
      applyPayload(json as AssignmentsPayload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [applyPayload])

  async function selectUser(user: UserOption) {
    setSelectedUser(user)
    setQuery(user.name?.trim() || user.email)
    setShowResults(false)
    setResults([])
    setNotice(null)
    setError(null)
    setPayload(null)
    setQuantityDrafts({})
    if (!user.empresa) {
      setNotice('Este usuario aún no tiene espacio de trabajo (empresa). Crea su empresa para asignarle módulos.')
      return
    }
    await loadAssignments(user.empresa.id)
  }

  /** Envía un cambio a la API y refresca la foto completa de la empresa. */
  async function saveAssignments(body: Record<string, unknown>, key: string): Promise<boolean> {
    const empresaId = payload?.empresa.id
    if (!empresaId) return false
    setSavingKey(key)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(empresaId)}/module-assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as AssignmentsPayload | ApiError
      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || 'No se pudo actualizar la configuración')
        return false
      }
      applyPayload(json as AssignmentsPayload)
      setNotice('Configuración actualizada.')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      return false
    } finally {
      setSavingKey(null)
    }
  }

  function saveModule(module: ModuleKey, patch: Record<string, unknown>, suffix: string) {
    return saveAssignments({ module, ...patch }, `${module}:${suffix}`)
  }

  function saveCapacity(resource: string, patch: Record<string, unknown>, suffix: string) {
    return saveAssignments({ resource, ...patch }, `${resource}:${suffix}`)
  }

  function updateDraft(resource: string, patch: Partial<QuantityDraft>) {
    setQuantityDrafts((current) => {
      const key = draftKey(resource)
      const previous = current[key] ?? { limit: '', price: '' }
      return { ...current, [key]: { ...previous, ...patch } }
    })
  }

  function commitCapacityLimit(row: CapacityAssignmentRow, raw: string) {
    const parsed = parseQuantity(raw)
    if (raw.trim() && parsed === null) {
      setError('El límite debe ser un número mayor o igual a 0')
      return
    }
    if (parsed === row.limitValue) return
    void saveCapacity(row.resource, { limitValue: parsed }, 'limit')
  }

  function commitCapacityPrice(raw: string, row: CapacityAssignmentRow) {
    const parsed = parseQuantity(raw)
    if (raw.trim() && parsed === null) {
      setError('El precio por unidad extra debe ser un número mayor o igual a 0')
      return
    }
    if (parsed === row.pricePerExtraUnitCOP) return
    void saveCapacity(row.resource, { pricePerExtraUnitCOP: parsed }, 'price')
  }

  function moduleNameFor(module: ModuleKey) {
    return payload?.rows.find((row) => row.module === module)?.nombre ?? module
  }

  const moduleOnlyBilling = payload?.empresa.moduleOnlyBilling ?? false
  const savingBillingMode = savingKey === 'billing:mode'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignar módulos, sedes y consumo por usuario</CardTitle>
        <CardDescription>
          Busca un usuario ya creado y configura su espacio de trabajo: qué módulos tiene disponibles, cuántas sedes y
          usuarios soporta y cuánto se factura por consumo. También puedes facturar solo módulos, sin plan base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Label
            htmlFor="module-assignment-user"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
            Usuario (nombre o correo)
          </Label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="module-assignment-user"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setShowResults(true)
              }}
              onFocus={() => {
                if (results.length) setShowResults(true)
              }}
              placeholder="Ej. maria@empresa.com"
              className="pl-8"
              autoComplete="off"
            />
            {searching ? (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-slate-400" />
            ) : null}
          </div>

          {showResults && results.length ? (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => void selectUser(user)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {user.name?.trim() || user.email}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{user.email}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {user.empresa ? user.empresa.nombre : 'Sin empresa'}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando módulos del cliente…
          </div>
        ) : null}

        {payload ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{payload.empresa.nombre}</div>
                <div className="truncate text-xs text-slate-500">
                  {selectedLabel ?? payload.empresa.nombre}
                  {selectedUser ? ` · ${selectedUser.email}` : ''}
                  {payload.empresa.nit ? ` · NIT ${payload.empresa.nit}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold">
                  Contratado: {resolvePlanName(planOptions, payload.empresa.planTier)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold">
                  Efectivo: {resolvePlanName(planOptions, payload.empresa.effectivePlanTier)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                  Ciclo {formatBillingCycle(payload.empresa.billingCycle)}
                </span>
                {moduleOnlyBilling ? (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                    Solo módulos · sin plan base
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Facturar solo módulos (sin plan base)</div>
                <p className="text-[11px] leading-snug text-slate-500">
                  Ideal para clientes que contratan módulos sueltos: no se cobra plan base, cada módulo habilitado se
                  factura aparte y los límites del plan dejan de aplicar (usa “Capacidad y consumo” para definirlos).
                </p>
              </div>
              <div className="flex items-center gap-2">
                {savingBillingMode ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                <Switch
                  checked={moduleOnlyBilling}
                  disabled={savingBillingMode}
                  onCheckedChange={(value) =>
                    void saveAssignments({ moduleOnlyBilling: Boolean(value) }, 'billing:mode')
                  }
                />
              </div>
            </div>

            {moduleOnlyBilling ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
                Sin plan base solo se facturan los módulos habilitados y el consumo configurado abajo.
                Al activar este modo conservamos los módulos que el cliente ya tenía: desmarca los que
                no contrató. Los módulos base (panel, notificaciones y configuración de sedes/usuarios)
                siguen activos y no se cobran.
              </p>
            ) : null}
          </div>
        ) : null}

        {payload ? (
          <div className={cn('grid gap-2 sm:grid-cols-2 lg:grid-cols-4')}>
            {[
              {
                label: 'Plan base',
                value: payload.totals.basePlanCOP,
                hint: moduleOnlyBilling ? 'No se cobra (solo módulos)' : 'Según plan contratado',
              },
              {
                label: 'Módulos',
                value: payload.totals.modulesCOP,
                hint: `${payload.totals.includedModules} incluidos · ${payload.totals.extraModules} adicionales`,
              },
              {
                label: 'Consumo',
                value: payload.totals.consumptionCOP,
                hint: `${payload.totals.consumptionResources} recurso(s) con excedente`,
              },
              { label: 'Total mensual', value: payload.totals.totalCOP, hint: 'COP antes de impuestos' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{formatCOP(item.value)}</div>
                <div className="text-[10px] text-slate-500">{item.hint}</div>
              </div>
            ))}
          </div>
        ) : null}


        {payload ? (
          <div className="space-y-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Módulos del cliente</div>
              <p className="text-[11px] leading-snug text-slate-500">
                Activa solo los módulos que el cliente puede usar. La capacidad y el consumo se configuran por recurso
                más abajo, para no duplicar valores entre módulos que comparten la misma medida.
              </p>
            </div>

            <div className="space-y-2">
              {payload.rows.map((row) => {
                const resources = row.capacityResources
                  .map((resource) => payload.capacity.find((item) => item.resource === resource))
                  .filter((item): item is CapacityAssignmentRow => Boolean(item))
                const moduleSaving = savingKey?.startsWith(`${row.module}:`) ?? false
                const toggleSaving = savingKey === `${row.module}:enabled`

                return (
                  <div key={row.module} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">{row.nombre}</span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {row.category}
                          </span>
                          {row.includedInPlan ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Incluido en el plan
                            </span>
                          ) : row.effectiveEnabled ? (
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                              Adicional
                            </span>
                          ) : null}
                          {row.overrideEnabled !== null ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              Asignación manual
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{row.descripcion}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">{formatCOP(row.moduleCOP)}</div>
                          <div className="text-[10px] text-slate-500">{row.includedInPlan ? 'incluido' : 'por mes'}</div>
                        </div>
                        {toggleSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : (
                          <Switch
                            checked={row.effectiveEnabled}
                            disabled={moduleSaving}
                            onCheckedChange={(value) =>
                              void saveModule(row.module, { enabled: Boolean(value) }, 'enabled')
                            }
                          />
                        )}
                      </div>
                    </div>

                    {resources.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-2 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Consumo</span>
                        {resources.map((resource) => (
                          <span
                            key={resource.resource}
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
                          >
                            {resource.shortLabel}: {formatUnits(resource.used)} /{' '}
                            {formatLimit(resource.effectiveLimit, resource.unit)}
                          </span>
                        ))}
                        <span className="text-[10px] text-slate-400">se edita en “Capacidad y consumo”</span>
                      </div>
                    ) : null}

                    {row.overrideEnabled !== null ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50"
                        disabled={moduleSaving}
                        onClick={() => void saveModule(row.module, { reset: true }, 'reset')}
                      >
                        <RotateCcw className="h-3 w-3" />{' '}
                        {moduleOnlyBilling ? 'Quitar asignación (apaga el módulo)' : 'Volver a heredar del plan'}
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {payload ? (
          <div className="space-y-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Capacidad y consumo por recurso</div>
              <p className="text-[11px] leading-snug text-slate-500">
                Define el límite, el periodo, qué pasa al excederse y el precio de la unidad extra. Sedes y usuarios
                comparten la misma medida del espacio de trabajo, por eso se configuran una sola vez desde{' '}
                {moduleNameFor('CONFIG')}.
              </p>
            </div>

            <div className="space-y-2">
              {payload.capacity.map((row) => {
                const draft = quantityDrafts[draftKey(row.resource)] ?? { limit: '', price: '' }
                const saving = savingKey?.startsWith(`${row.resource}:`) ?? false
                const limitSaving = savingKey === `${row.resource}:limit`
                const priceSaving = savingKey === `${row.resource}:price`
                const otherModules = row.modules.filter((module) => module !== row.ownerModule)

                return (
                  <div key={row.resource} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">{row.label}</span>
                          {row.configured ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              Ajuste propio
                            </span>
                          ) : moduleOnlyBilling ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              Ilimitado (sin plan)
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              Hereda del plan
                            </span>
                          )}
                          {row.shared ? (
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                              Compartido
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{row.description}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Lo administra {row.ownerModuleName}
                          {otherModules.length
                            ? ` · también lo alimentan ${otherModules.map(moduleNameFor).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {formatUnits(row.used)}{' '}
                          <span className="text-[10px] font-normal text-slate-500">{row.unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">usados</div>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label
                          htmlFor={`capacity-limit-${row.resource}`}
                          className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                        >
                          Límite {row.unit ? `(${row.unit})` : ''}
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            id={`capacity-limit-${row.resource}`}
                            inputMode="numeric"
                            value={draft.limit}
                            disabled={saving}
                            placeholder={row.planLimit === null ? 'Sin límite' : `Plan: ${formatUnits(row.planLimit)}`}
                            onChange={(event) => updateDraft(row.resource, { limit: event.target.value })}
                            onBlur={(event) => commitCapacityLimit(row, event.target.value)}
                            className="h-8 text-xs"
                          />
                          {limitSaving ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Periodo
                        </span>
                        <Select
                          value={row.limitPeriod}
                          disabled={saving}
                          onValueChange={(value) => void saveCapacity(row.resource, { limitPeriod: value }, 'period')}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(PERIOD_LABELS) as LimitPeriod[]).map((period) => (
                              <SelectItem key={period} value={period} className="text-xs">
                                {PERIOD_LABELS[period]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Al excederse
                        </span>
                        <Select
                          value={row.effectivePolicy}
                          disabled={saving}
                          onValueChange={(value) => void saveCapacity(row.resource, { overagePolicy: value }, 'policy')}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POLICY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label
                          htmlFor={`capacity-price-${row.resource}`}
                          className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                        >
                          Unidad extra (COP)
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            id={`capacity-price-${row.resource}`}
                            inputMode="numeric"
                            value={draft.price}
                            disabled={saving}
                            placeholder="0"
                            onChange={(event) => updateDraft(row.resource, { price: event.target.value })}
                            onBlur={(event) => commitCapacityPrice(event.target.value, row)}
                            className="h-8 text-xs"
                          />
                          {priceSaving ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          Límite efectivo: <strong>{formatLimit(row.effectiveLimit, row.unit)}</strong> ·{' '}
                          {POLICY_LABELS[row.effectivePolicy]} · {PERIOD_LABELS[row.effectivePeriod]}
                        </span>
                        {row.moduleEnabled ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                            Consumo facturable: {formatCOP(row.consumptionCOP)}
                            {row.extraUnits > 0 ? ` (${formatUnits(row.extraUnits)} extra)` : ''}
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">
                            {row.ownerModuleName} deshabilitado · no se factura consumo
                          </span>
                        )}
                      </div>
                      {row.configured ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50"
                          disabled={saving}
                          onClick={() => void saveCapacity(row.resource, { reset: true }, 'reset')}
                        >
                          <RotateCcw className="h-3 w-3" />{' '}
                          {moduleOnlyBilling ? 'Quitar límite propio' : 'Heredar del plan'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
              Un límite en 0 bloquea el recurso. El excedente solo se cobra cuando la política es “Cobrar excedente”, el
              recurso tiene precio por unidad extra y su módulo está habilitado. Sedes y usuarios se facturan una sola
              vez por espacio de trabajo, aunque varios módulos los usen.
              {moduleOnlyBilling
                ? ' Con “solo módulos” los límites del plan no aplican: cada recurso queda ilimitado hasta que definas un límite propio.'
                : ''}
            </p>
          </div>
        ) : null}

        {!payload && !loading ? (
          <p className="text-xs text-slate-500">
            Selecciona un usuario para ver y ajustar sus módulos, la capacidad de sedes y usuarios, y el consumo
            facturable.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

