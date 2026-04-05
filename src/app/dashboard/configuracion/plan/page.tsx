"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ModuleKey } from '@prisma/client'
import { cn } from "@/lib/utils"
import { formatCOP, getPlanPriceCOP, type BillingCycle, type PlanInfo, type PlanTier } from "@/lib/plans"
import {
  buildPlanModuleCatalog,
  getModularPlanQuote,
  getDefaultEnabledModulesForPlan,
  getMinimumPlanTierForModules,
  PLAN_MODULE_CATALOG,
} from "@/lib/plan-catalog"

type ComparisonFeature = {
  label: string
  availability: Record<PlanTier, boolean | string>
}

type PlanDetails = {
  tagline: string
  forWho: string
  incluye: Array<{ title: string; items: string[] }>
  alcance: string[]
}

const PLAN_DETAILS: Record<PlanTier, PlanDetails> = {
  CRM: {
    tagline: 'CRM comercial dedicado',
    forWho: 'Para equipos que solo necesitan CRM y chat omnicanal.',
    incluye: [
      { title: 'CRM comercial', items: ['Leads', 'Oportunidades', 'Agenda', 'Tareas', 'Inbox omnicanal', 'Chat global interno'] },
      { title: 'Operación mínima', items: ['Dashboard', 'Configuración básica', 'Notificaciones'] },
    ],
    alcance: ['CRM y chat global', 'Sin ERP operativo', 'Mensual fijo'],
  },
  BASIC: {
    tagline: '“Ideal para comenzar”',
    forWho: 'Para emprendedores y equipos pequeños.',
    incluye: [
      { title: '📊 Centro de Control', items: ['Dashboard', 'Reportes (100)'] },
      { title: '💰 Comercial', items: ['Cotizador', 'Cotizaciones (300/mes)', 'Remisiones (100)', 'Clientes (500)'] },
      { title: '🏭 Operaciones', items: ['Órdenes de Trabajo (100)', 'Litografía (sin límite)', 'Escaneos (sin límite)', 'Terminados (sin límite)'] },
      { title: '📦 Logística', items: ['Inventario', 'Proveedores (50)', 'Productos (200)'] },
      { title: '⚙️ Gestión', items: ['1 sede', '2 usuarios'] },
      { title: '🛠 Preferencias', items: ['Mi perfil', 'Notificaciones'] },
    ],
    alcance: ['1 sede', '2 usuarios', '500 clientes', '300 cotizaciones / mes', 'Litografía, Escaneos y Terminados sin límite'],
  },
  MEDIO: {
    tagline: 'Operacion estable y escalable',
    forWho: 'Para empresas que ya necesitan POS, inventario y compras sin llegar a full.',
    incluye: [
      { title: 'Incluye todo el Básico +', items: ['Inventario', 'POS', 'Compras', 'Traslados', 'Proveedores ampliados'] },
      { title: 'Capacidad', items: ['3 sedes', '5 usuarios', '2.500 clientes', '1.500 cotizaciones / mes'] },
    ],
    alcance: ['3 sedes', '5 usuarios', '2.500 clientes', '1.500 cotizaciones / mes'],
  },
  INTERMEDIO: {
    tagline: '“Control real de la empresa”',
    forWho: 'Para equipos en crecimiento.',
    incluye: [
      { title: 'Incluye todo el Básico +', items: [] },
      { title: '📊 Centro de Control', items: ['Reportes ilimitados'] },
      { title: '💰 Comercial', items: ['POS', 'Remisiones ilimitadas', 'Facturación', 'Cotizaciones (5.000/mes)', 'Clientes (8.000)'] },
      { title: '🏭 Operaciones', items: ['Órdenes de Trabajo ilimitadas', 'Litografía, Escaneos y Terminados ilimitados'] },
      { title: '📦 Logística', items: ['Inventario', 'Proveedores ilimitados', 'Productos ilimitados', 'Compras', 'Traslados', 'Desperdicios'] },
      { title: '⚙️ Gestión', items: ['6 sedes', '10 usuarios'] },
      { title: '🛠 Preferencias', items: ['Mi perfil', 'Notificaciones', 'Usuarios'] },
    ],
    alcance: ['6 sedes', '10 usuarios', '8.000 clientes', '5.000 cotizaciones / mes'],
  },
  FULL: {
    tagline: '“Escala sin límites”',
    forWho: 'Para empresas con operación completa.',
    incluye: [
      { title: 'Incluye todo +', items: [] },
      { title: '⚙️ Gestión', items: ['Permisos', 'Empresa', 'Plan', 'Usuarios ilimitados', 'Sedes ilimitadas'] },
      { title: 'CRM', items: ['CRM omnicanal completo', 'Agenda', 'Tareas', 'Integraciones', 'Chat global'] },
      { title: '🛠 Preferencias', items: ['Personalizar menú', 'Configuración', 'Ayuda'] },
      { title: '📊 Centro de Control', items: ['KPIs por sede', 'Reportes avanzados'] },
      { title: '💰 Comercial', items: ['Todo ilimitado'] },
      { title: '🏭 Operaciones', items: ['Todo ilimitado'] },
      { title: '📦 Logística', items: ['Todo ilimitado'] },
    ],
    alcance: ['Sedes ilimitadas', 'Usuarios ilimitados', 'Clientes ilimitados', 'Cotizaciones ilimitadas'],
  },
}

const PLAN_COMPARISON: ComparisonFeature[] = [
  {
    label: 'Dashboard y configuracion basica',
    availability: { CRM: true, BASIC: true, MEDIO: true, INTERMEDIO: true, FULL: true },
  },
  {
    label: 'Cotizador, cotizaciones y remisiones',
    availability: { CRM: false, BASIC: true, MEDIO: true, INTERMEDIO: true, FULL: true },
  },
  {
    label: 'Inventario, compras y proveedores',
    availability: { CRM: false, BASIC: false, MEDIO: true, INTERMEDIO: true, FULL: true },
  },
  {
    label: 'POS y facturacion',
    availability: { CRM: false, BASIC: false, MEDIO: true, INTERMEDIO: true, FULL: true },
  },
  {
    label: 'Contabilidad',
    availability: { CRM: false, BASIC: false, MEDIO: false, INTERMEDIO: true, FULL: true },
  },
  {
    label: 'CRM omnicanal',
    availability: { CRM: true, BASIC: false, MEDIO: false, INTERMEDIO: false, FULL: true },
  },
  {
    label: 'Agenda, tareas y chat global',
    availability: { CRM: true, BASIC: false, MEDIO: false, INTERMEDIO: false, FULL: true },
  },
  {
    label: 'Sedes',
    availability: { CRM: '1', BASIC: '1', MEDIO: '3', INTERMEDIO: '6', FULL: 'Ilimitadas' },
  },
  {
    label: 'Usuarios',
    availability: { CRM: '3', BASIC: '2', MEDIO: '5', INTERMEDIO: '10', FULL: 'Ilimitados' },
  },
]

type PlanApiResponse =
  | {
      ok: true
      current: PlanInfo
      effective?:
        | {
            planTier: PlanTier
            paywall: { show: boolean; blocking: boolean; reason: string }
            trial: {
              tier: PlanTier | null
              startedAt: string | null
              validUntil: string | null
              isActive: boolean
              isExpired: boolean
              daysLeft: number | null
            }
          }
        | null
      empresa: {
        planTier: PlanTier
        billingCycle: BillingCycle
        planValidUntil: string | null
        trialTier?: PlanTier | null
        trialStartedAt?: string | null
        trialValidUntil?: string | null
      } | null
      lastInvoice: LastInvoice | null
      invoices: LastInvoice[]
      modulePrices: Array<{ module: ModuleKey; priceCOP: number }>
      all: PlanInfo[]
      devDefault: PlanTier
    }
  | {
      ok?: false
      error?: string
    }

type CreateBoldLinkResponse =
  | { ok: true; url: string }
  | { ok?: false; error?: string }

type LastInvoice = {
  id: string
  provider: string
  status: string
  planTier: PlanTier
  billingCycle: BillingCycle
  currency: string
  amountCOP: number
  discountPct: number
  externalReference: string
  checkoutUrl: string | null
  quotedModules: ModuleKey[]
  expiresAt: string | null
  paidAt: string | null
  createdAt: string
}

export default function PlanPage() {
  const searchParams = useSearchParams()
  const blockedModule = searchParams?.get('blockedModule') ?? null

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<PlanInfo | null>(null)
  const [all, setAll] = useState<PlanInfo[]>([])
  const [empresa, setEmpresa] = useState<{
    planTier: PlanTier
    billingCycle: BillingCycle
    planValidUntil: string | null
  } | null>(null)
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null)
  const [invoices, setInvoices] = useState<LastInvoice[]>([])
  const [modulePriceMap, setModulePriceMap] = useState<Partial<Record<ModuleKey, number>>>({})
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY")
  const [isPaying, setIsPaying] = useState(false)
  const [selectedModules, setSelectedModules] = useState<(typeof PLAN_MODULE_CATALOG)[number]["module"][]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/plan")
        const json = (await res.json().catch(() => ({}))) as PlanApiResponse

        if (!res.ok) {
          setError(("error" in json && json.error) || "No se pudo cargar el plan")
          return
        }

        if (!cancelled && "ok" in json && json.ok) {
          setCurrent(json.current)
          setEmpresa(json.empresa)
          setCycle(json.empresa?.billingCycle ?? "MONTHLY")
          setAll(json.all)
          setLastInvoice(json.lastInvoice)
          setInvoices(json.invoices)
          setModulePriceMap(Object.fromEntries(json.modulePrices.map((row) => [row.module, row.priceCOP])) as Partial<Record<ModuleKey, number>>)
          return
        }

        if (!cancelled) {
          setError("Respuesta inválida del servidor")
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error inesperado")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    // Si vienes del callback de Bold (?ref=...), refresca unos segundos para capturar el webhook.
    let interval: number | null = null
    let timeout: number | null = null
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")
      if (ref) {
        interval = window.setInterval(() => {
          void load()
        }, 3000)
        timeout = window.setTimeout(() => {
          if (interval) window.clearInterval(interval)
        }, 30000)
      }
    } catch {
      // ignore
    }

    return () => {
      cancelled = true
      if (interval) window.clearInterval(interval)
      if (timeout) window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { role?: string | null } | null }
          | null

        if (!cancelled && res.ok && json?.success && json?.data?.role === 'ADMIN') {
          setIsSuperAdmin(true)
        }
      } catch {
        // ignore
      }
    }

    void loadMe()
    return () => {
      cancelled = true
    }
  }, [])

  const sortedPlans = useMemo(() => {
    const order: PlanTier[] = ["CRM", "BASIC", "MEDIO", "INTERMEDIO", "FULL"]
    return [...all].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))
  }, [all])

  const comparisonPlans = useMemo(() => sortedPlans.filter((plan) => plan.tier in PLAN_DETAILS), [sortedPlans])

  const pricedCatalog = useMemo(() => buildPlanModuleCatalog(modulePriceMap), [modulePriceMap])

  const modulesByCategory = useMemo(() => {
    return pricedCatalog.reduce<Record<string, typeof pricedCatalog>>((acc, item) => {
      const bucket = acc[item.category] ?? []
      bucket.push(item)
      acc[item.category] = bucket
      return acc
    }, {})
  }, [pricedCatalog])

  const recommendedTier = useMemo(() => getMinimumPlanTierForModules(selectedModules), [selectedModules])

  const recommendedPlan = useMemo(() => {
    return sortedPlans.find((plan) => plan.tier === recommendedTier) ?? null
  }, [recommendedTier, sortedPlans])

  const modularQuote = useMemo(() => getModularPlanQuote({ selectedModules, cycle, modulePriceMap }), [selectedModules, cycle, modulePriceMap])
  const recommendedPrice = modularQuote.totalCOP

  const includedModulesForRecommendedTier = useMemo(() => {
    return new Set(getDefaultEnabledModulesForPlan(recommendedTier))
  }, [recommendedTier])

  const currentRecommendedDifference = useMemo(() => {
    if (!current || current.tier === recommendedTier) return null

    const currentPrice = getPlanPriceCOP(current.tier, cycle)
    return recommendedPrice - currentPrice
  }, [current, recommendedPrice, recommendedTier, cycle])

  useEffect(() => {
    if (!current || selectedModules.length > 0) return

    const initialModules = pricedCatalog
      .map((item) => item.module)
      .filter((moduleKey) => getDefaultEnabledModulesForPlan(current.tier).includes(moduleKey))

    if (blockedModule && pricedCatalog.some((item) => item.module === blockedModule)) {
      setSelectedModules(Array.from(new Set([...initialModules, blockedModule as (typeof PLAN_MODULE_CATALOG)[number]["module"]])))
      return
    }

    setSelectedModules(initialModules)
  }, [blockedModule, current, pricedCatalog, selectedModules.length])

  function renderAvailability(value: boolean | string) {
    if (typeof value === 'string') return <span className="font-medium text-slate-800">{value}</span>
    return value ? <span className="font-semibold text-emerald-600">✓</span> : <span className="font-semibold text-rose-600">✕</span>
  }

  function toggleModule(moduleKey: (typeof PLAN_MODULE_CATALOG)[number]["module"]) {
    setSelectedModules((prev) => {
      if (prev.includes(moduleKey)) return prev.filter((item) => item !== moduleKey)
      return [...prev, moduleKey]
    })
  }

  async function startPayment(tier: PlanTier, modules: (typeof PLAN_MODULE_CATALOG)[number]["module"][] = []) {
    setIsPaying(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/bold/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, cycle, selectedModules: modules }),
      })

      const json = (await res.json().catch(() => ({}))) as CreateBoldLinkResponse
      if (!res.ok || !("ok" in json) || !json.ok) {
        setError(("error" in json && json.error) || "No se pudo iniciar el pago")
        return
      }

      if (!json.url) {
        setError("Respuesta inválida del servidor (sin url)")
        return
      }

      window.location.href = json.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan</h1>
          <p className="text-sm text-gray-600">Gestiona tu plan y facturación.</p>
        </div>

        {isSuperAdmin ? (
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/super-admin/modulos-por-plan">Super Admin</Link>
          </Button>
        ) : null}
      </div>

      {blockedModule ? (
        <Card>
          <CardHeader>
            <CardTitle>No incluido en tu plan</CardTitle>
            <CardDescription>
              El módulo <span className="font-medium">{blockedModule}</span> no está habilitado en tu plan actual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-700">Selecciona un plan superior para activarlo.</div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 items-start">
        <Card>
          <CardHeader className="p-3">
            <CardTitle>Plan actual</CardTitle>
            <CardDescription>Este es el plan asociado a tu empresa.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {isLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : current ? (
              <div>
                <div className="text-base font-semibold text-gray-900">{current.nombre}</div>
                <div className="text-sm text-gray-600">{current.descripcion}</div>
                <div className="mt-1 text-sm text-gray-700">
                  <span className="font-medium">{formatCOP(current.precioMensualCOP)}</span> / mes
                </div>
                {empresa?.planValidUntil ? (
                  <div className="mt-1 text-sm text-gray-700">
                    Vigente hasta:{" "}
                    <span className="font-medium">
                      {new Date(empresa.planValidUntil).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-gray-600">No se encontró el plan actual.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3">
            <CardTitle>Facturación</CardTitle>
            <CardDescription>Elige mensual o anual (10% de descuento anual).</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={cycle === "MONTHLY" ? "default" : "secondary"}
                onClick={() => setCycle("MONTHLY")}
                disabled={isPaying}
              >
                Mensual
              </Button>
              <Button
                type="button"
                size="sm"
                variant={cycle === "YEARLY" ? "default" : "secondary"}
                onClick={() => setCycle("YEARLY")}
                disabled={isPaying}
              >
                Anual (-10%)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3">
            <CardTitle>Último cobro</CardTitle>
            <CardDescription>Estado del último intento de pago registrado.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {!lastInvoice ? (
              <div className="text-sm text-gray-600">Aún no hay cobros registrados.</div>
            ) : (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-1 rounded",
                      lastInvoice.status === "PAID"
                        ? "bg-green-50 text-green-700"
                        : lastInvoice.status === "PENDING"
                          ? "bg-yellow-50 text-yellow-800"
                          : lastInvoice.status === "REJECTED"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {lastInvoice.status}
                  </span>
                  <span className="text-sm text-gray-700">
                    {formatCOP(lastInvoice.amountCOP)} ({lastInvoice.billingCycle === "YEARLY" ? "Anual" : "Mensual"})
                  </span>
                </div>

                <div className="text-sm text-gray-700">
                  Referencia: <span className="font-mono text-xs">{lastInvoice.externalReference}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Creado: {new Date(lastInvoice.createdAt).toLocaleString("es-CO")}
                  {lastInvoice.paidAt ? ` · Pagado: ${new Date(lastInvoice.paidAt).toLocaleString("es-CO")}` : ""}
                </div>

                {lastInvoice.quotedModules.length ? (
                  <div className="pt-1">
                    <div className="text-xs font-medium text-gray-700">Módulos cotizados</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {lastInvoice.quotedModules.map((moduleKey) => {
                        const item = pricedCatalog.find((module) => module.module === moduleKey)
                        return (
                          <span key={moduleKey} className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-700">
                            {item?.nombre ?? moduleKey}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {lastInvoice.status === "PENDING" && lastInvoice.checkoutUrl ? (
                  <div className="pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => (window.location.href = lastInvoice.checkoutUrl!)}
                    >
                      Continuar pago
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#eff6ff_100%)]">
          <CardHeader>
            <CardTitle>Arma tu plan por módulos</CardTitle>
            <CardDescription>
              Selecciona los módulos que realmente vas a usar. El sistema te recomienda el plan mínimo que los cubre y actualiza el valor en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {Object.entries(modulesByCategory).map(([category, modules]) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{category}</div>
                    <div className="text-xs text-slate-600">Activa solo lo que aporta valor a esta etapa de la operación.</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {modules.map((module) => {
                    const selected = selectedModules.includes(module.module)
                    const startingTier = getMinimumPlanTierForModules([module.module])

                    return (
                      <button
                        key={module.module}
                        type="button"
                        onClick={() => toggleModule(module.module)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-300/60"
                            : "border-white/70 bg-white/80 text-slate-900 shadow-sm hover:border-slate-300 hover:bg-white"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{module.nombre}</div>
                            <div className={cn("mt-1 text-xs", selected ? "text-slate-200" : "text-slate-600")}>{module.descripcion}</div>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[11px] font-semibold",
                              selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
                            )}
                          >
                            + {formatCOP(module.activationPriceMonthlyCOP)}/mes
                          </span>
                        </div>
                        <div className={cn("mt-3 text-[11px] font-medium uppercase tracking-[0.16em]", selected ? "text-slate-300" : "text-slate-500")}>
                          Tier mínimo: {startingTier}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-950 text-white">
          <CardHeader>
            <CardTitle>Resumen de cotización</CardTitle>
            <CardDescription className="text-slate-300">
              La plataforma se cobra por plan. La calculadora encuentra el tier mínimo que soporta tu combinación actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Plan recomendado</div>
              <div className="mt-2 text-3xl font-bold">{recommendedPlan?.nombre ?? recommendedTier}</div>
              <div className="mt-1 text-sm text-slate-300">{recommendedPlan?.descripcion ?? 'Configuración recomendada según tus módulos.'}</div>
              <div className="mt-4 text-4xl font-black">{formatCOP(recommendedPrice)}</div>
              <div className="text-sm text-slate-300">{cycle === 'YEARLY' ? 'COP / año' : 'COP / mes'}</div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-white/10 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-300">Base del plan {recommendedPlan?.nombre ?? recommendedTier}</span>
                <span>{formatCOP(cycle === 'YEARLY' ? getPlanPriceCOP(recommendedTier, 'YEARLY') : modularQuote.basePriceMonthlyCOP)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-300">Activación de módulos</span>
                <span>{formatCOP(cycle === 'YEARLY' ? recommendedPrice - getPlanPriceCOP(recommendedTier, 'YEARLY') : modularQuote.modulesSubtotalMonthlyCOP)}</span>
              </div>
              {cycle === 'YEARLY' ? (
                <div className="flex items-center justify-between gap-3 text-emerald-300">
                  <span>Descuento anual aplicado</span>
                  <span>{modularQuote.annualDiscountPct}%</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Módulos seleccionados</div>
              {selectedModules.length ? (
                <div className="space-y-2">
                  {selectedModules.map((moduleKey) => {
                    const item = pricedCatalog.find((module) => module.module === moduleKey)
                    return (
                      <div key={moduleKey} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-100">
                        <span>{item?.nombre ?? moduleKey}</span>
                        <span>{formatCOP(cycle === 'YEARLY' ? Math.round(item!.activationPriceMonthlyCOP * 12 * (1 - modularQuote.annualDiscountPct / 100)) : item!.activationPriceMonthlyCOP)}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-300">Selecciona al menos un módulo para construir la recomendación.</div>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 p-4">
              <div className="text-sm font-semibold">Cobertura del plan {recommendedPlan?.nombre ?? recommendedTier}</div>
              <div className="text-sm text-slate-300">
                {selectedModules.every((moduleKey) => includedModulesForRecommendedTier.has(moduleKey))
                  ? 'Todos los módulos elegidos quedan cubiertos en este plan.'
                  : 'Tu selección requiere un plan superior para cubrir todos los módulos.'}
              </div>
              {typeof currentRecommendedDifference === 'number' ? (
                <div className="text-sm text-slate-200">
                  {currentRecommendedDifference > 0
                    ? `Sube ${formatCOP(currentRecommendedDifference)} frente a tu plan actual en este ciclo.`
                    : `Baja ${formatCOP(Math.abs(currentRecommendedDifference))} frente a tu plan actual en este ciclo.`}
                </div>
              ) : current?.tier === recommendedTier ? (
                <div className="text-sm text-emerald-300">Tu plan actual ya cubre esta combinación.</div>
              ) : null}
            </div>

            <Button
              className="w-full bg-white text-slate-950 hover:bg-slate-100"
              disabled={isPaying || !recommendedPlan}
              onClick={() => recommendedPlan ? startPayment(recommendedPlan.tier, selectedModules) : undefined}
            >
              {isPaying ? 'Redirigiendo…' : `Continuar con ${recommendedPlan?.nombre ?? recommendedTier}`}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Planes base disponibles</h2>
          <p className="text-sm text-slate-600">Si prefieres comparar por paquete cerrado, aquí sigues teniendo la vista completa de cada plan.</p>
        </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sortedPlans.map((p) => {
          const isCurrent = current?.tier === p.tier
          const displayPrice = getPlanPriceCOP(p.tier, cycle)
          const disablePay = isPaying || isLoading || (isCurrent && empresa?.billingCycle === cycle && !!empresa?.planValidUntil)
          const details = PLAN_DETAILS[p.tier]

          return (
            <Card
              key={p.tier}
              className={cn(
                "border",
                isCurrent ? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200"
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{p.nombre}</span>
                  {isCurrent ? (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      Actual
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>{p.descripcion}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{formatCOP(displayPrice)}</div>
                <div className="text-sm text-gray-600">{cycle === "YEARLY" ? "COP / año" : "COP / mes"}</div>

                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-gray-900">{details.tagline}</div>
                  <div className="text-sm text-gray-700">{details.forWho}</div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="text-sm font-semibold text-gray-900">Incluye</div>
                  <div className="space-y-2">
                    {details.incluye.map((group) => (
                      <div key={group.title} className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">{group.title}</div>
                        {group.items.length ? (
                          <ul className="list-disc pl-5 text-sm text-gray-700">
                            {group.items.map((it) => (
                              <li key={it}>{it}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-sm font-semibold text-gray-900">Alcance</div>
                  <ul className="list-disc pl-5 text-sm text-gray-700">
                    {details.alcance.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4">
                  <Button
                    className="w-full"
                    disabled={disablePay}
                    variant={isCurrent ? "secondary" : "default"}
                    onClick={() => startPayment(p.tier)}
                  >
                    {isPaying ? "Redirigiendo…" : isCurrent ? "Plan actual" : "Cambiar a este plan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de cobros</CardTitle>
          <CardDescription>Últimos intentos y pagos registrados para la empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!invoices.length ? (
            <div className="text-sm text-gray-600">Aún no hay cobros registrados.</div>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-1 rounded",
                        invoice.status === "PAID"
                          ? "bg-green-50 text-green-700"
                          : invoice.status === "PENDING"
                            ? "bg-yellow-50 text-yellow-800"
                            : invoice.status === "REJECTED"
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-100 text-gray-700"
                      )}
                    >
                      {invoice.status}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{formatCOP(invoice.amountCOP)}</span>
                    <span className="text-xs text-slate-500">{invoice.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}</span>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(invoice.createdAt).toLocaleString('es-CO')}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500">Referencia: <span className="font-mono">{invoice.externalReference}</span></div>
                {invoice.quotedModules.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {invoice.quotedModules.map((moduleKey) => {
                      const item = pricedCatalog.find((module) => module.module === moduleKey)
                      return <span key={moduleKey} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{item?.nombre ?? moduleKey}</span>
                    })}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diferencias entre planes</CardTitle>
          <CardDescription>Comparativo rapido de funcionalidades, capacidad y CRM.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-semibold text-slate-900">Funcionalidad</th>
                {comparisonPlans.map((plan) => (
                  <th key={plan.tier} className="px-3 py-2 text-center font-semibold text-slate-900">{plan.nombre}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((feature) => (
                <tr key={feature.label} className="border-b last:border-b-0">
                  <td className="px-3 py-2 text-slate-700">{feature.label}</td>
                  {comparisonPlans.map((plan) => (
                    <td key={`${feature.label}-${plan.tier}`} className="px-3 py-2 text-center">
                      {renderAvailability(feature.availability[plan.tier])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
