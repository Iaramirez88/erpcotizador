'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PlanCapacityAdminPanel from '@/components/dashboard/plan-capacity-admin-panel'
import PlanModuleAssignmentPanel from '@/components/dashboard/plan-module-assignment-panel'
import type { ModuleKey } from '@prisma/client'

type PlanTier = 'CRM' | 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'

/** Planes comerciales vigentes: Básico, Medio, Intermedio y Full (el tier `CRM` es legado). */
const COMMERCIAL_PLAN_TIERS: PlanTier[] = ['BASIC', 'MEDIO', 'INTERMEDIO', 'FULL']

const PLAN_TIER_LABELS: Partial<Record<PlanTier, string>> = {
  BASIC: 'Básico',
  MEDIO: 'Medio',
  INTERMEDIO: 'Intermedio',
  FULL: 'Full',
}

/** Nombre comercial del plan (editable en el catálogo) con respaldo por tier. */
function resolvePlanLabel(tier: PlanTier, rows: PlanCatalogRow[]): string {
  const nombre = rows.find((row) => row.tier === tier)?.nombre?.trim()
  return nombre || PLAN_TIER_LABELS[tier] || tier
}

type PriceRow = {
  module: ModuleKey
  nombre: string
  descripcion: string
  category: string
  priceCOP: number
}

type PricesResponse =
  | { ok: true; rows: PriceRow[] }
  | { ok?: false; error?: string }

type CommercialPriceRow = {
  code: string
  title: string
  category: string
  description: string
  defaultPriceCOP: number
  priceCOP: number
}

type CommercialPricesResponse =
  | { ok: true; rows: CommercialPriceRow[] }
  | { ok?: false; error?: string }

type PlanCatalogRow = {
  tier: PlanTier
  nombre: string
  descripcion: string
  precioMensualCOP: number
  tagline: string
  forWho: string
  incluye: Array<{ title: string; items: string[] }>
  alcance: string[]
  storageLimitGb: number | null
  active: boolean
  displayOrder: number
}

type PlanCatalogResponse =
  | { ok: true; rows: PlanCatalogRow[] }
  | { ok?: false; error?: string }

type BusinessType =
  | 'ODONTOLOGIA'
  | 'RESTAURANTE'
  | 'ABOGADOS'
  | 'CLINICA'
  | 'CONTABILIDAD'
  | 'DOTACIONES'
  | 'LITOGRAFIA'
  | 'COMERCIO'
  | 'SERVICIOS'

type BusinessTypeRow = {
  businessType: BusinessType
  label: string
  description: string
  active: boolean
  sortOrder: number
  updatedAt: string
}

type BusinessTypesResponse =
  | { ok: true; rows: BusinessTypeRow[] }
  | { ok?: false; error?: string }

type BusinessTypePutResponse =
  | { ok: true; row: BusinessTypeRow }
  | { ok?: false; error?: string }

function serializeIncludeGroups(groups: PlanCatalogRow['incluye']) {
  return groups.map((group) => [group.title, ...group.items.map((item) => `- ${item}`)].join('\n')).join('\n\n')
}

function parseIncludeGroups(value: string): PlanCatalogRow['incluye'] {
  return value
    .split(/\n\s*\n/g)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .map((lines) => {
      const [title, ...items] = lines
      if (!title) return null
      return {
        title,
        items: items.map((item) => item.replace(/^[-*]\s*/, '').trim()).filter(Boolean),
      }
    })
    .filter((group): group is PlanCatalogRow['incluye'][number] => Boolean(group))
}

function serializeScope(items: string[]) {
  return items.join('\n')
}

function parseScope(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

/** Campo con etiqueta visible y ayuda corta: evita depender del placeholder precargado. */
function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-4 text-slate-500">{hint}</p> : null}
    </div>
  )
}

export default function SuperAdminPlanModulesClient() {
  const [activeTab, setActiveTab] = useState<'planes' | 'catalogo' | 'facturacion' | 'nichos' | 'acceso'>('planes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [priceRows, setPriceRows] = useState<PriceRow[]>([])
  const [savingPriceKey, setSavingPriceKey] = useState<string | null>(null)
  const [commercialPriceRows, setCommercialPriceRows] = useState<CommercialPriceRow[]>([])
  const [savingCommercialPriceKey, setSavingCommercialPriceKey] = useState<string | null>(null)
  const [planRows, setPlanRows] = useState<PlanCatalogRow[]>([])
  const [savingPlanTier, setSavingPlanTier] = useState<PlanTier | null>(null)
  const [copySourceByTier, setCopySourceByTier] = useState<Partial<Record<PlanTier, PlanTier>>>({})
  const [businessTypeRows, setBusinessTypeRows] = useState<BusinessTypeRow[]>([])
  const [savingBusinessType, setSavingBusinessType] = useState<BusinessType | null>(null)

  const [empresaNit, setEmpresaNit] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [codePlanTier, setCodePlanTier] = useState<PlanTier>('FULL')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const pricesRes = await fetch('/api/super-admin/module-prices', { cache: 'no-store' })
        const pricesJson = (await pricesRes.json().catch(() => ({}))) as PricesResponse
        const commercialPricesRes = await fetch('/api/super-admin/commercial-prices', { cache: 'no-store' })
        const commercialPricesJson = (await commercialPricesRes.json().catch(() => ({}))) as CommercialPricesResponse
        const planCatalogRes = await fetch('/api/super-admin/plan-catalog', { cache: 'no-store' })
        const planCatalogJson = (await planCatalogRes.json().catch(() => ({}))) as PlanCatalogResponse
        const businessTypesRes = await fetch('/api/super-admin/onboarding-business-types', { cache: 'no-store' })
        const businessTypesJson = (await businessTypesRes.json().catch(() => ({}))) as BusinessTypesResponse
        if (!pricesRes.ok || !('ok' in pricesJson) || !pricesJson.ok) {
          setError(('error' in pricesJson && pricesJson.error) || 'No se pudo cargar los precios')
          return
        }
        if (!commercialPricesRes.ok || !('ok' in commercialPricesJson) || !commercialPricesJson.ok) {
          setError(('error' in commercialPricesJson && commercialPricesJson.error) || 'No se pudo cargar el pricing comercial')
          return
        }
        if (!planCatalogRes.ok || !('ok' in planCatalogJson) || !planCatalogJson.ok) {
          setError(('error' in planCatalogJson && planCatalogJson.error) || 'No se pudo cargar el catálogo de planes')
          return
        }
        if (!businessTypesRes.ok || !('ok' in businessTypesJson) || !businessTypesJson.ok) {
          setError(('error' in businessTypesJson && businessTypesJson.error) || 'No se pudo cargar los nichos de onboarding')
          return
        }

        if (!cancelled) {
          setPriceRows(pricesJson.rows)
          setCommercialPriceRows(commercialPricesJson.rows)
          setPlanRows(planCatalogJson.rows)
          setBusinessTypeRows(businessTypesJson.rows)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error inesperado')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])


  async function setPrice(moduleKey: ModuleKey, value: string) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError('El precio debe ser un número mayor o igual a cero')
      return
    }

    setSavingPriceKey(moduleKey)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/module-prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleKey, priceCOP: numericValue }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; row?: { module: ModuleKey; priceCOP: number }; error?: string }
      if (!res.ok || !json.ok || !json.row) {
        setError(json.error || 'No se pudo guardar el precio')
        return
      }

      setPriceRows((prev) => prev.map((row) => row.module === moduleKey ? { ...row, priceCOP: json.row!.priceCOP } : row))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSavingPriceKey(null)
    }
  }

  async function setCommercialPrice(code: string, value: string) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError('El precio comercial debe ser un número mayor o igual a cero')
      return
    }

    setSavingCommercialPriceKey(code)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/commercial-prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, priceCOP: numericValue }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; row?: { code: string; priceCOP: number }; error?: string }
      if (!res.ok || !json.ok || !json.row) {
        setError(json.error || 'No se pudo guardar el precio comercial')
        return
      }

      setCommercialPriceRows((prev) => prev.map((row) => row.code === code ? { ...row, priceCOP: json.row!.priceCOP } : row))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSavingCommercialPriceKey(null)
    }
  }

  function updatePlanRow(tier: PlanTier, updater: (row: PlanCatalogRow) => PlanCatalogRow) {
    setPlanRows((prev) => prev.map((row) => (row.tier === tier ? updater(row) : row)))
  }

  function copyPlanConfiguration(targetTier: PlanTier) {
    const sourceTier = copySourceByTier[targetTier]
    if (!sourceTier || sourceTier === targetTier) return
    const source = planRows.find((row) => row.tier === sourceTier)
    if (!source) return
    updatePlanRow(targetTier, (row) => ({
      ...row,
      nombre: source.nombre,
      descripcion: source.descripcion,
      precioMensualCOP: source.precioMensualCOP,
      tagline: source.tagline,
      forWho: source.forWho,
      incluye: source.incluye,
      alcance: source.alcance,
      storageLimitGb: source.storageLimitGb,
      active: source.active,
    }))
  }

  async function savePlan(row: PlanCatalogRow) {
    setSavingPlanTier(row.tier)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/plan-catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; row?: PlanCatalogRow; error?: string }
      if (!res.ok || !json.ok || !json.row) {
        setError(json.error || 'No se pudo guardar el plan')
        return
      }
      updatePlanRow(row.tier, () => json.row!)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSavingPlanTier(null)
    }
  }

  function updateBusinessTypeRow(businessType: BusinessType, updater: (row: BusinessTypeRow) => BusinessTypeRow) {
    setBusinessTypeRows((prev) => prev.map((row) => (row.businessType === businessType ? updater(row) : row)))
  }

  async function saveBusinessType(row: BusinessTypeRow) {
    setSavingBusinessType(row.businessType)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/onboarding-business-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: row.businessType, active: row.active, sortOrder: row.sortOrder }),
      })
      const json = (await res.json().catch(() => ({}))) as BusinessTypePutResponse
      if (!res.ok || !json.ok || !json.row) {
        setError(('error' in json && json.error) || 'No se pudo guardar el nicho')
        return
      }
      updateBusinessTypeRow(row.businessType, () => json.row)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSavingBusinessType(null)
    }
  }

  async function generateEmpresaCode() {
    setGeneratingCode(true)
    setError(null)
    setGeneratedCode(null)
    try {
      const res = await fetch('/api/super-admin/empresa-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nit: empresaNit.trim() || undefined,
          empresaId: empresaId.trim() || undefined,
          planTier: codePlanTier,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string }
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo generar el código')
        return
      }

      setGeneratedCode(json.code || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setGeneratingCode(false)
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Administración' }, { label: 'Super Admin · Planes y capacidad' }]}
        title="Super Admin · Planes y capacidad"
        description="Todos los planes incluyen todos los módulos. Lo que se configura aquí es la capacidad y el consumo de cada plan; los módulos se ajustan por cliente en “Módulos y facturación”."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/configuracion/super-admin/empresas">Empresas</Link>
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="planes">Capacidad y consumo por plan</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo y precios</TabsTrigger>
          <TabsTrigger value="facturacion">Cliente: módulos y facturación</TabsTrigger>
          <TabsTrigger value="nichos">Nichos</TabsTrigger>
          <TabsTrigger value="acceso">Acceso</TabsTrigger>
        </TabsList>

        {loading ? <div className="mt-3 text-sm text-gray-600">Cargando configuración…</div> : null}
        {error ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <TabsContent value="planes" className="mt-4">
          <PlanCapacityAdminPanel />
        </TabsContent>

        <TabsContent value="acceso" className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Código de espacio (WS-...)</CardTitle>
          <CardDescription>
            Obtiene el código único del espacio para registrar/asignar usuarios a una empresa ya registrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">NIT (opcional)</Label>
              <Input value={empresaNit} onChange={(e) => setEmpresaNit(e.target.value)} placeholder="900123456" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Empresa ID (opcional)</Label>
              <Input value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} placeholder="cuid..." />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Plan</Label>
              <Select value={codePlanTier} onValueChange={(v) => setCodePlanTier(v as PlanTier)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {COMMERCIAL_PLAN_TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {resolvePlanLabel(tier, planRows)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void generateEmpresaCode()}
              disabled={generatingCode || (!empresaNit.trim() && !empresaId.trim())}
            >
              Generar ID
            </Button>
            {generatedCode ? (
              <div className="text-sm">
                <span className="text-muted-foreground">Código de espacio: </span>
                <span className="font-mono">{generatedCode}</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="nichos" className="mt-4 space-y-4">
      {!loading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle>Nichos visibles en onboarding</CardTitle>
            <CardDescription>Controla qué nichos aparecen en la configuración inicial y el orden en que se muestran.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {businessTypeRows.map((row) => (
              <div key={row.businessType} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{row.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{row.description}</div>
                  </div>
                  <Switch checked={row.active} onCheckedChange={(value) => updateBusinessTypeRow(row.businessType, (current) => ({ ...current, active: Boolean(value) }))} />
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-sm">Orden</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.sortOrder}
                      onChange={(event) => updateBusinessTypeRow(row.businessType, (current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{row.active ? 'Visible en onboarding' : 'Oculto del onboarding'}</span>
                    <span>{savingBusinessType === row.businessType ? 'Guardando…' : ''}</span>
                  </div>
                  <Button type="button" onClick={() => void saveBusinessType(row)} disabled={savingBusinessType === row.businessType}>
                    {savingBusinessType === row.businessType ? 'Guardando…' : 'Guardar nicho'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
        </TabsContent>

        <TabsContent value="catalogo" className="mt-4 space-y-4">
      {!loading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle>Cobertura de módulos</CardTitle>
            <CardDescription>
              Todos los planes incluyen todos los módulos. Lo que diferencia a los planes es la capacidad y el consumo
              (sedes, usuarios, cotizaciones, productos, clientes…). Para apagar un módulo a un cliente puntual usa
              “Cliente: módulos y facturación”.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Cómo se compone el precio</CardTitle>
          <CardDescription>Tres capas independientes que se suman en la propuesta comercial.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="font-semibold text-slate-800">1. Catálogo de planes</div>
            <p className="mt-1 text-xs">Precio mensual base del plan, nombre visible, textos comerciales y espacio CRM incluido.</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="font-semibold text-slate-800">2. Precios por módulo</div>
            <p className="mt-1 text-xs">Solo aplican al modo “solo módulos” (clientes sin plan base): se cobra cada módulo habilitado, sin plan que lo absorba.</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="font-semibold text-slate-800">3. Pricing comercial</div>
            <p className="mt-1 text-xs">Valores de suite, módulos padre y submódulos que alimentan la calculadora comercial y el checkout.</p>
          </div>
        </CardContent>
      </Card>

      {!loading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle>Catálogo comercial de planes</CardTitle>
            <CardDescription>Edita título, textos, costo, espacio CRM, orden, copia desde otro plan y anula la visibilidad comercial. El límite de consumo interno de cada plan se define en la pestaña “Capacidad y consumo”.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {planRows.map((row) => {
              const includesText = serializeIncludeGroups(row.incluye)
              const scopeText = serializeScope(row.alcance)
              return (
                <div key={row.tier} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{resolvePlanLabel(row.tier, planRows)}</div>
                      <div className="text-xs text-slate-500">
                        Código {row.tier} · base operativa del plan actual
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={copySourceByTier[row.tier] ?? row.tier} onValueChange={(value) => setCopySourceByTier((prev) => ({ ...prev, [row.tier]: value as PlanTier }))}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Copiar desde" />
                        </SelectTrigger>
                        <SelectContent>
                          {planRows.map((plan) => (
                            <SelectItem key={`${row.tier}-${plan.tier}`} value={plan.tier}>
                              {resolvePlanLabel(plan.tier, planRows)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => copyPlanConfiguration(row.tier)}>
                        Copiar desde otro plan
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Nombre comercial" hint="Aparece en el catálogo de planes y en la propuesta comercial.">
                      <Input
                        value={row.nombre}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, nombre: event.target.value }))}
                        placeholder="Ej. Plan Full"
                      />
                    </Field>
                    <Field label="Precio mensual (COP)" hint="Valor base del plan, antes de módulos adicionales.">
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={row.precioMensualCOP}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, precioMensualCOP: Number(event.target.value || 0) }))}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Espacio CRM incluido (GB)" hint="Cuota de almacenamiento del plan. Vacío = sin cuota.">
                      <Input
                        type="number"
                        min={0}
                        value={row.storageLimitGb ?? ''}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, storageLimitGb: event.target.value === '' ? null : Number(event.target.value) }))}
                        placeholder="Sin cuota"
                      />
                    </Field>
                    <Field label="Orden de visualización" hint="Menor número aparece primero en el catálogo.">
                      <Input
                        type="number"
                        min={0}
                        value={row.displayOrder}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, displayOrder: Number(event.target.value || 0) }))}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Tagline" hint="Frase corta que resume el plan en la tarjeta.">
                      <Input
                        value={row.tagline}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, tagline: event.target.value }))}
                        placeholder="Ej. Todo el ERP en un solo plan"
                      />
                    </Field>
                    <Field label="Enfoque comercial (a quién apunta)" hint="Describe el tipo de empresa ideal para este plan.">
                      <Input
                        value={row.forWho}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, forWho: event.target.value }))}
                        placeholder="Ej. Empresas con varias sedes y equipo comercial"
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Descripción" hint="Texto largo que explica el plan en la tarjeta comercial.">
                      <textarea
                        className="min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={row.descripcion}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, descripcion: event.target.value }))}
                        placeholder="Ej. ERP completo con CRM, inventario, POS y contabilidad."
                      />
                    </Field>
                    <div className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                      Usa “Copiar desde otro plan” para arrancar desde una estructura existente y luego ajustar textos, costo y espacio.
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field
                      label={`Qué incluye · bloques (${row.incluye.length})`}
                      hint="Primera línea = título del bloque; las siguientes con “-” son los bullets. Deja una línea en blanco entre bloques. Puedes agregar todos los bloques y bullets que necesites."
                    >
                      <textarea
                        className="min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={includesText}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, incluye: parseIncludeGroups(event.target.value) }))}
                        placeholder={'Módulos operativos\n- Cotizaciones\n- Órdenes\n\nSoporte\n- Acompañamiento dedicado'}
                      />
                    </Field>
                    <Field
                      label={`Alcance visible · bullets (${row.alcance.length})`}
                      hint="Una línea por bullet. Se muestran todos los que agregues, sin límite de cantidad."
                    >
                      <textarea
                        className="min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={scopeText}
                        onChange={(event) => updatePlanRow(row.tier, (current) => ({ ...current, alcance: parseScope(event.target.value) }))}
                        placeholder={'Hasta 3 sedes\nUsuarios ilimitados\nSoporte prioritario'}
                      />
                    </Field>
                  </div>

                  {row.alcance.length ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Vista previa</span>
                      {row.alcance.map((item, index) => (
                        <span
                          key={`${row.tier}-alcance-${index}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={row.active} onCheckedChange={(value) => updatePlanRow(row.tier, (current) => ({ ...current, active: Boolean(value) }))} />
                      <Label>{row.active ? 'Visible en catálogo' : 'Anulado en catálogo'}</Label>
                    </div>
                    <Button type="button" onClick={() => void savePlan(row)} disabled={savingPlanTier === row.tier}>
                      {savingPlanTier === row.tier ? 'Guardando…' : 'Guardar plan'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Módulos y facturación</CardTitle>
          <CardDescription>
            Los precios por módulo, la asignación de módulos a un usuario/empresa (con su límite de consumo) y el
            pricing comercial editable se administran en la pestaña “Módulos y facturación”.
          </CardDescription>
        </CardHeader>
      </Card>
        </TabsContent>

        <TabsContent value="facturacion" className="mt-4 space-y-4">
      {!loading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle>Precios por módulo (modo solo módulos)</CardTitle>
            <CardDescription>
              Cada módulo se cobra mensualmente cuando está habilitado para una empresa con facturación “solo
              módulos” (sin plan base). Con plan, todos los módulos van incluidos en el precio del plan y solo se factura
              el consumo excedente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {priceRows.map((row) => (
                <div key={row.module} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{row.nombre}</div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Opcional
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{row.descripcion}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">{row.category}</div>
                  <div className="mt-3 grid gap-1.5">
                    <Label
                      htmlFor={`module-price-${row.module}`}
                      className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
                    >
                      Precio mensual (COP)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`module-price-${row.module}`}
                        type="number"
                        min={0}
                        step={1000}
                        defaultValue={row.priceCOP}
                        disabled={savingPriceKey === row.module}
                        onBlur={(event) => void setPrice(row.module, event.target.value)}
                      />
                      <span className="text-xs text-slate-500">COP/mes</span>
                    </div>
                    <p className="text-[11px] leading-4 text-slate-500">
                      Se cobra solo si el módulo se habilita para el cliente. Usa 0 para incluirlo sin cargo.
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-600">
              Si un cliente habilitara todos los módulos, el adicional mensual sería de{' '}
              <span className="font-semibold text-slate-900">
                {priceRows.reduce((sum, row) => sum + (Number.isFinite(row.priceCOP) ? row.priceCOP : 0), 0).toLocaleString('es-CO')} COP
              </span>
              . Usa el simulador de abajo para ver el total de un cliente puntual.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error ? (
        <PlanModuleAssignmentPanel
          planOptions={planRows.map((row) => ({
            tier: row.tier,
            nombre: row.nombre,
            precioMensualCOP: row.precioMensualCOP,
          }))}
        />
      ) : null}

      {!loading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle>Pricing comercial editable</CardTitle>
            <CardDescription>Edita suite global, módulos padre y submódulos comerciales sin tocar código.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {commercialPriceRows.map((row) => (
              <div key={row.code} className="rounded-lg border p-3">
                <div className="text-sm font-semibold text-slate-900">{row.title}</div>
                <div className="mt-1 text-xs text-slate-500">{row.description}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">{row.category}</div>
                <div className="mt-2 text-[11px] text-slate-500">Base: {row.defaultPriceCOP.toLocaleString('es-CO')} COP</div>
                <div className="mt-3 grid gap-1.5">
                  <Label
                    htmlFor={`commercial-price-${row.code}`}
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
                  >
                    Precio mensual (COP)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`commercial-price-${row.code}`}
                      type="number"
                      min={0}
                      step={1000}
                      defaultValue={row.priceCOP}
                      disabled={savingCommercialPriceKey === row.code}
                      onBlur={(event) => void setCommercialPrice(row.code, event.target.value)}
                    />
                    <span className="text-xs text-slate-500">COP/mes</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
        </TabsContent>

      </Tabs>
    </div>
  )
}
