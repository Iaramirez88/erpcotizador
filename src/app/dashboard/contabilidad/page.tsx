'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  FileSpreadsheet,
  Landmark,
  ReceiptText,
  Scale,
  Settings2,
  Sparkles,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { ErpPageHero, ErpSectionHeading } from '@/components/dashboard/erp-page-chrome'
import { PIE_COLORS } from '@/lib/chart-colors'
import { cn } from '@/lib/utils'
import type { AccountingAccountType, AccountingEventType } from '@prisma/client'

type ChartKind = 'bar' | 'line' | 'pie'
type AreaKind = 'accounts' | 'cost-centers' | 'rules'

type AccountRow = {
  id: string
  type: AccountingAccountType
  isPosting: boolean
  createdAt: string
}

type CostCenterRow = {
  id: string
  createdAt: string
}

type RuleLineRow = {
  accountId: string
  costCenterId: string | null
}

type RuleRow = {
  id: string
  eventType: AccountingEventType
  isActive: boolean
  createdAt: string
  lines: RuleLineRow[]
}

type SeriesPoint = { month: string; count: number }
type NamedCount = { name: string; count: number }

type FinanceKpi = {
  id: string
  label: string
  formattedValue: string
  status: string
  note?: string
}

type FinanceInsight = {
  id: string
  title: string
  summary: string
  severity?: string
}

type FinanceAction = {
  id: string
  title: string
  description: string
  href: string
  priority?: string
}

type FinanceSummary = {
  healthScore: number
  healthStatus: string
  executiveSummary: string
  kpis: FinanceKpi[]
  alerts: FinanceInsight[]
  risks: FinanceInsight[]
  recommendations: FinanceAction[]
  actions: FinanceAction[]
}

type QuickFlowCard = {
  title: string
  hint: string
  href: string
  icon: LucideIcon
  status: string
}

type ModuleAccessCard = {
  title: string
  href: string
  icon: LucideIcon
  metric: string
  hint: string
  tone: string
}

const ACCOUNT_TYPE_LABEL: Record<AccountingAccountType, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Patrimonio',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
}

const EVENT_TYPE_LABEL: Record<AccountingEventType, string> = {
  POS_INVOICE: 'POS - Venta',
  POS_RETURN: 'POS - Devolución',
  COMPRA: 'Compra',
  COMPRA_PAGO: 'Compra - Pago',
  DIAN_DOCUMENT: 'DIAN',
  PAYROLL_PERIOD: 'Nómina - Causación',
  PAYROLL_PAYMENT: 'Nómina - Pago',
  PAYROLL_SETTLEMENT: 'Nómina - Liquidación',
  MANUAL: 'Manual',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : String(value ?? '')
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  return Boolean(record[key])
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function toMonthlySeries(items: Array<{ createdAt: string }>): SeriesPoint[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = monthKey(item.createdAt)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, count]) => ({ month, count }))
}

function toNamedCounts<T>(items: T[], keyFn: (item: T) => string): NamedCount[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function formatCompactMonth(value: string) {
  const [year, month] = value.split('-')
  return `${month}/${year?.slice(-2) ?? ''}`
}

function parseFinanceSummary(value: unknown): FinanceSummary | null {
  if (!isRecord(value)) return null

  return {
    healthScore: readNumber(value, 'healthScore'),
    healthStatus: readString(value, 'healthStatus'),
    executiveSummary: readString(value, 'executiveSummary'),
    kpis: readArray(value.kpis).flatMap((item) => {
      if (!isRecord(item)) return []
      return [{
        id: readString(item, 'id'),
        label: readString(item, 'label'),
        formattedValue: readString(item, 'formattedValue'),
        status: readString(item, 'status'),
        note: readString(item, 'note') || undefined,
      }]
    }),
    alerts: readArray(value.alerts).flatMap((item) => {
      if (!isRecord(item)) return []
      return [{
        id: readString(item, 'id'),
        title: readString(item, 'title'),
        summary: readString(item, 'summary'),
        severity: readString(item, 'severity') || undefined,
      }]
    }),
    risks: readArray(value.risks).flatMap((item) => {
      if (!isRecord(item)) return []
      return [{
        id: readString(item, 'id'),
        title: readString(item, 'title'),
        summary: readString(item, 'summary'),
        severity: readString(item, 'severity') || undefined,
      }]
    }),
    recommendations: readArray(value.recommendations).flatMap((item) => {
      if (!isRecord(item)) return []
      return [{
        id: readString(item, 'id'),
        title: readString(item, 'title'),
        description: readString(item, 'description'),
        href: readString(item, 'href') || '/dashboard/contabilidad',
        priority: readString(item, 'priority') || undefined,
      }]
    }),
    actions: readArray(value.actions).flatMap((item) => {
      if (!isRecord(item)) return []
      return [{
        id: readString(item, 'id'),
        title: readString(item, 'title'),
        description: readString(item, 'description'),
        href: readString(item, 'href') || '/dashboard/contabilidad',
        priority: readString(item, 'priority') || undefined,
      }]
    }),
  }
}

function resolveHealthTone(status: string) {
  if (status === 'BUENO' || status === 'EXCELENTE') {
    return {
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      progress: 'bg-emerald-500',
      glow: 'from-emerald-100 via-white to-cyan-50',
    }
  }

  if (status === 'ATENCION') {
    return {
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      progress: 'bg-amber-500',
      glow: 'from-amber-100 via-white to-orange-50',
    }
  }

  return {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    progress: 'bg-rose-500',
    glow: 'from-rose-100 via-white to-orange-50',
  }
}

function resolveKpiTone(status: string) {
  if (status === 'POSITIVE') return 'text-emerald-600'
  if (status === 'WARNING') return 'text-amber-600'
  if (status === 'NEGATIVE') return 'text-rose-600'
  return 'text-slate-500'
}

export default function ContabilidadHomePage() {
  const [chartKind, setChartKind] = useState<ChartKind>('bar')
  const [areaKind, setAreaKind] = useState<AreaKind>('accounts')
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [aRes, cRes, rRes, financeRes] = await Promise.all([
          fetch('/api/contabilidad/cuentas', { cache: 'no-store' }),
          fetch('/api/contabilidad/centros-de-costo', { cache: 'no-store' }),
          fetch('/api/contabilidad/reglas', { cache: 'no-store' }),
          fetch('/api/decision-engine/finance?locale=es-CO', { cache: 'no-store' }).catch(() => null),
        ])

        const aRaw = (await aRes.json()) as unknown
        const cRaw = (await cRes.json()) as unknown
        const rRaw = (await rRes.json()) as unknown

        const aOk = isRecord(aRaw) && aRaw.ok === true
        const cOk = isRecord(cRaw) && cRaw.ok === true
        const rOk = isRecord(rRaw) && rRaw.ok === true

        if (!aRes.ok || !aOk) throw new Error((isRecord(aRaw) ? (aRaw.error as string) : '') || 'Error cargando cuentas')
        if (!cRes.ok || !cOk) {
          throw new Error((isRecord(cRaw) ? (cRaw.error as string) : '') || 'Error cargando centros de costo')
        }
        if (!rRes.ok || !rOk) throw new Error((isRecord(rRaw) ? (rRaw.error as string) : '') || 'Error cargando reglas')
        if (cancelled) return

        setAccounts(
          readArray((aRaw as Record<string, unknown>).data).flatMap((row) => {
            if (!isRecord(row)) return []
            return [{
              id: readString(row, 'id'),
              type: readString(row, 'type') as AccountingAccountType,
              isPosting: readBoolean(row, 'isPosting'),
              createdAt: readString(row, 'createdAt'),
            }]
          }),
        )

        setCostCenters(
          readArray((cRaw as Record<string, unknown>).data).flatMap((row) => {
            if (!isRecord(row)) return []
            return [{ id: readString(row, 'id'), createdAt: readString(row, 'createdAt') }]
          }),
        )

        setRules(
          readArray((rRaw as Record<string, unknown>).data).flatMap((row) => {
            if (!isRecord(row)) return []
            const linesRaw = readArray(row.lines)
            const lines = linesRaw.flatMap((line) => {
              if (!isRecord(line)) return []
              const rawCostCenter = line.costCenterId
              return [{
                accountId: readString(line, 'accountId'),
                costCenterId: typeof rawCostCenter === 'string' ? rawCostCenter : null,
              }]
            })

            return [{
              id: readString(row, 'id'),
              eventType: readString(row, 'eventType') as AccountingEventType,
              isActive: readBoolean(row, 'isActive'),
              createdAt: readString(row, 'createdAt'),
              lines,
            }]
          }),
        )

        if (financeRes) {
          const financeRaw = (await financeRes.json().catch(() => null)) as unknown
          const financeOk = isRecord(financeRaw) && financeRaw.success === true
          const parsedSummary = financeOk ? parseFinanceSummary(financeRaw.data) : null
          if (!cancelled) setFinanceSummary(parsedSummary)
        } else if (!cancelled) {
          setFinanceSummary(null)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error cargando estadísticas')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const linkedCostCenters = useMemo(() => {
    const linked = new Set<string>()
    for (const rule of rules) {
      for (const line of rule.lines) {
        if (line.costCenterId) linked.add(line.costCenterId)
      }
    }
    return linked.size
  }, [rules])

  const postingAccounts = useMemo(() => accounts.filter((account) => account.isPosting).length, [accounts])
  const activeRules = useMemo(() => rules.filter((rule) => rule.isActive).length, [rules])

  const postingCoverage = accounts.length > 0 ? (postingAccounts / accounts.length) * 100 : 0
  const centerCoverage = costCenters.length > 0 ? (linkedCostCenters / costCenters.length) * 100 : 0
  const automationCoverage = rules.length > 0 ? (activeRules / rules.length) * 100 : 0

  const readinessScore = Math.round((postingCoverage + centerCoverage + automationCoverage) / 3)
  const executiveHealthScore = financeSummary?.healthScore ?? readinessScore
  const executiveHealthStatus = financeSummary?.healthStatus ?? (readinessScore >= 75 ? 'BUENO' : readinessScore >= 45 ? 'ATENCION' : 'CRITICO')
  const healthTone = resolveHealthTone(executiveHealthStatus)

  const chartTitle = useMemo(() => {
    if (areaKind === 'accounts') return 'Plan de cuentas'
    if (areaKind === 'cost-centers') return 'Centros de costo'
    return 'Reglas automáticas'
  }, [areaKind])

  const chartData = useMemo(() => {
    if (areaKind === 'accounts') {
      if (chartKind === 'line') return toMonthlySeries(accounts)
      return toNamedCounts(accounts, (account) => ACCOUNT_TYPE_LABEL[account.type] ?? account.type)
    }

    if (areaKind === 'rules') {
      if (chartKind === 'line') return toMonthlySeries(rules)
      return toNamedCounts(rules, (rule) => EVENT_TYPE_LABEL[rule.eventType] ?? rule.eventType)
    }

    if (chartKind === 'line') return toMonthlySeries(costCenters)

    return [
      { name: 'En reglas', count: linkedCostCenters },
      { name: 'Sin regla', count: Math.max(0, costCenters.length - linkedCostCenters) },
    ] satisfies NamedCount[]
  }, [accounts, areaKind, chartKind, costCenters, linkedCostCenters, rules])

  const flowCards: QuickFlowCard[] = useMemo(() => [
    {
      title: 'Configurar',
      hint: `${accounts.length} cuentas y ${costCenters.length} centros`,
      href: '/dashboard/contabilidad/plan-de-cuentas',
      icon: Landmark,
      status: readinessScore >= 40 ? 'En marcha' : 'Pendiente',
    },
    {
      title: 'Automatizar',
      hint: `${activeRules} reglas activas`,
      href: '/dashboard/contabilidad/reglas',
      icon: Workflow,
      status: activeRules > 0 ? 'Listo' : 'Crear reglas',
    },
    {
      title: 'Registrar',
      hint: 'Comprobantes y libros',
      href: '/dashboard/contabilidad/comprobantes',
      icon: ReceiptText,
      status: 'Operar',
    },
    {
      title: 'Reportar',
      hint: 'Libros, impuestos y cierres',
      href: '/dashboard/contabilidad/libros',
      icon: FileSpreadsheet,
      status: 'Revisar',
    },
  ], [accounts.length, activeRules, costCenters.length, readinessScore])

  const moduleCards: ModuleAccessCard[] = useMemo(() => [
    {
      title: 'Comprobantes',
      href: '/dashboard/contabilidad/comprobantes',
      icon: ReceiptText,
      metric: 'Asientos diarios',
      hint: 'Registrar y aprobar',
      tone: 'from-sky-100 to-cyan-50 border-sky-200',
    },
    {
      title: 'Plan de cuentas',
      href: '/dashboard/contabilidad/plan-de-cuentas',
      icon: Landmark,
      metric: `${accounts.length}`,
      hint: 'Estructura contable',
      tone: 'from-amber-100 to-orange-50 border-amber-200',
    },
    {
      title: 'Centros',
      href: '/dashboard/contabilidad/centros-de-costo',
      icon: Building2,
      metric: `${costCenters.length}`,
      hint: 'Segmentación operativa',
      tone: 'from-emerald-100 to-teal-50 border-emerald-200',
    },
    {
      title: 'Reglas',
      href: '/dashboard/contabilidad/reglas',
      icon: Settings2,
      metric: `${activeRules}/${rules.length || 0}`,
      hint: 'Automatización',
      tone: 'from-violet-100 to-fuchsia-50 border-violet-200',
    },
    {
      title: 'Conciliaciones',
      href: '/dashboard/contabilidad/conciliaciones',
      icon: Scale,
      metric: 'Banco vs ERP',
      hint: 'Cruzar movimientos',
      tone: 'from-cyan-100 to-sky-50 border-cyan-200',
    },
    {
      title: 'Impuestos',
      href: '/dashboard/contabilidad/impuestos',
      icon: BookOpen,
      metric: 'IVA y retenciones',
      hint: 'Preparar reportes',
      tone: 'from-rose-100 to-orange-50 border-rose-200',
    },
  ], [accounts.length, activeRules, costCenters.length, rules.length])

  const fallbackQueue = useMemo(() => {
    const queue: Array<{ id: string; title: string; summary: string; href: string; severity: string }> = []

    if (accounts.length === 0) {
      queue.push({
        id: 'queue-accounts',
        title: 'Crear plan contable',
        summary: 'Sin cuentas, el flujo contable no puede arrancar.',
        href: '/dashboard/contabilidad/plan-de-cuentas',
        severity: 'HIGH',
      })
    }

    if (costCenters.length === 0) {
      queue.push({
        id: 'queue-centers',
        title: 'Definir centros de costo',
        summary: 'Ayudan a separar sedes, procesos o líneas de negocio.',
        href: '/dashboard/contabilidad/centros-de-costo',
        severity: 'MEDIUM',
      })
    }

    if (activeRules === 0) {
      queue.push({
        id: 'queue-rules',
        title: 'Encender automatización',
        summary: 'Crea reglas para pasar de evento a asiento sin fricción manual.',
        href: '/dashboard/contabilidad/reglas',
        severity: 'MEDIUM',
      })
    }

    if (queue.length === 0) {
      queue.push({
        id: 'queue-ready',
        title: 'Base contable lista',
        summary: 'La configuración actual ya soporta operación y revisión.',
        href: '/dashboard/contabilidad/comprobantes',
        severity: 'LOW',
      })
    }

    return queue
  }, [accounts.length, activeRules, costCenters.length])

  const attentionQueue = financeSummary
    ? [
        ...financeSummary.alerts.map((item) => ({ ...item, href: '/dashboard/contabilidad' })),
        ...financeSummary.risks.map((item) => ({ ...item, href: '/dashboard/contabilidad/comprobantes' })),
        ...financeSummary.recommendations.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.description,
          severity: item.priority ?? 'MEDIUM',
          href: item.href,
        })),
      ].slice(0, 4)
    : fallbackQueue

  const spotlightMetrics = useMemo(() => {
    const base = financeSummary?.kpis.slice(0, 3).map((kpi) => ({
      id: kpi.id,
      label: kpi.label,
      value: kpi.formattedValue,
      note: kpi.note ?? 'Lectura ejecutiva',
      status: kpi.status,
      icon: kpi.label.toLowerCase().includes('flujo')
        ? CircleDollarSign
        : kpi.label.toLowerCase().includes('cartera')
          ? CircleAlert
          : TrendingUp,
    })) ?? []

    return [
      ...base,
      {
        id: 'config-readiness',
        label: 'Preparación del módulo',
        value: formatPercent(readinessScore),
        note: `${postingAccounts} cuentas operativas, ${linkedCostCenters} centros enlazados`,
        status: readinessScore >= 75 ? 'POSITIVE' : readinessScore >= 45 ? 'WARNING' : 'NEGATIVE',
        icon: Sparkles,
      },
    ].slice(0, 4)
  }, [financeSummary, linkedCostCenters, postingAccounts, readinessScore])

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="ERP financiero"
        title={<span data-tour="contabilidad-title">Contabilidad</span>}
        description="Panel contable orientado a operación, lectura ejecutiva y reportes, con accesos más claros para configurar, registrar, conciliar y cerrar."
        actions={
          <>
            <Link href="/dashboard/contabilidad/comprobantes" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white">
              <ReceiptText className="h-4 w-4" />
              Nuevo comprobante
            </Link>
            <Link href="/dashboard/contabilidad/plan-de-cuentas" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white">
              <Landmark className="h-4 w-4" />
              Plan de cuentas
            </Link>
            <Link href="/dashboard/contabilidad/libros" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white">
              <BarChart3 className="h-4 w-4" />
              Ver reportes
            </Link>
          </>
        }
        stats={[
          { label: 'Cuentas', value: accounts.length, hint: 'Plan contable', tone: 'neutral' },
          { label: 'Centros', value: costCenters.length, hint: 'Segmentación', tone: 'sky' },
          { label: 'Reglas', value: activeRules, hint: 'Automatización activa', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className={cn('overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)]', healthTone.glow)}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                <CircleDollarSign className="h-3.5 w-3.5" />
                Pulso financiero
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">Estado actual de la empresa</div>
                <p className="mt-2 max-w-xl text-sm text-slate-600">
                  {financeSummary?.executiveSummary || 'La vista prioriza la salud contable, la automatización y la ruta más corta para llegar a reportes confiables.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {spotlightMetrics.map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div key={metric.id} className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.35)]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{metric.label}</span>
                        <Icon className={cn('h-4 w-4', resolveKpiTone(metric.status))} />
                      </div>
                      <div className={cn('mt-3 text-2xl font-semibold', resolveKpiTone(metric.status), metric.status === 'NEUTRAL' ? 'text-slate-950' : '')}>{metric.value}</div>
                      <div className="mt-1 text-xs text-slate-500">{metric.note}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="w-full max-w-xs rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Índice contable</div>
                  <div className="mt-1 text-4xl font-semibold tracking-tight text-slate-950">{executiveHealthScore}</div>
                </div>
                <div className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', healthTone.badge)}>
                  {executiveHealthStatus}
                </div>
              </div>

              <div className="mt-5 h-3 rounded-full bg-slate-100">
                <div className={cn('h-3 rounded-full transition-all', healthTone.progress)} style={{ width: `${Math.max(8, Math.min(100, executiveHealthScore))}%` }} />
              </div>

              <div className="mt-5 space-y-3">
                {[
                  { label: 'Cuentas operativas', value: formatPercent(postingCoverage) },
                  { label: 'Centros enlazados', value: formatPercent(centerCoverage) },
                  { label: 'Reglas activas', value: formatPercent(automationCoverage) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-semibold text-slate-950">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.32)]" data-tour="contabilidad-create-map">
            <ErpSectionHeading title="Flujo recomendado" description="Orden sugerido para que el usuario configure, opere y cierre sin perderse." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {flowCards.map((card) => {
                const Icon = card.icon
                return (
                  <Link key={card.title} href={card.href} className="group rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {card.status}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="font-medium text-slate-950">{card.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{card.hint}</div>
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      Abrir
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.32)]">
            <ErpSectionHeading title="Bandeja de atención" description="Riesgos, alertas o próximos pasos visibles desde la entrada del módulo." />
            <div className="mt-4 space-y-3">
              {attentionQueue.map((item) => (
                <Link key={item.id} href={item.href} className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 transition hover:bg-white">
                  <div className={cn(
                    'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                    item.severity === 'HIGH' ? 'bg-rose-100 text-rose-600' : item.severity === 'LOW' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600',
                  )}>
                    {item.severity === 'LOW' ? <CheckCircle2 className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-950">{item.title}</div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{item.summary}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-tour="contabilidad-areas">
        {moduleCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.title} href={card.href} className={cn('group rounded-[28px] border bg-gradient-to-br p-5 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-34px_rgba(15,23,42,0.36)]', card.tone)}>
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-slate-700 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
              </div>
              <div className="mt-5">
                <div className="text-lg font-semibold text-slate-950">{card.title}</div>
                <div className="mt-2 text-sm font-medium text-slate-700">{card.metric}</div>
                <div className="mt-1 text-sm text-slate-500">{card.hint}</div>
              </div>
            </Link>
          )
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.32)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <ErpSectionHeading title="Lectura visual" description="Gráficas rápidas para revisar estructura, automatización y crecimiento del módulo." />
            <div className="flex flex-wrap gap-2">
              <Select value={areaKind} onValueChange={(value) => setAreaKind(value as AreaKind)}>
                <SelectTrigger className="w-[220px] bg-white">
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accounts">Plan de cuentas</SelectItem>
                  <SelectItem value="cost-centers">Centros de costo</SelectItem>
                  <SelectItem value="rules">Reglas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={chartKind} onValueChange={(value) => setChartKind(value as ChartKind)}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Gráfica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barras</SelectItem>
                  <SelectItem value="line">Línea</SelectItem>
                  <SelectItem value="pie">Torta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4">
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            {loading ? (
              <div className="text-sm text-muted-foreground">Cargando lectura contable…</div>
            ) : Array.isArray(chartData) && chartData.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay datos suficientes para graficar.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/90 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vista activa</div>
                    <div className="text-sm font-medium text-slate-900">{chartTitle}</div>
                  </div>
                  <div className="text-xs text-slate-500">{chartKind === 'line' ? 'Evolución mensual' : chartKind === 'pie' ? 'Distribución visual' : 'Comparativo actual'}</div>
                </div>
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartKind === 'bar' ? (
                      <BarChart data={chartData as NamedCount[]}>
                        <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" name="Cantidad" radius={[10, 10, 0, 0]} fill={PIE_COLORS[0]} />
                      </BarChart>
                    ) : chartKind === 'line' ? (
                      <LineChart data={chartData as SeriesPoint[]}>
                        <XAxis dataKey="month" tickFormatter={formatCompactMonth} tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip labelFormatter={(value) => formatCompactMonth(String(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="count" name="Cantidad" stroke={PIE_COLORS[0]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie data={chartData as NamedCount[]} dataKey="count" nameKey="name" outerRadius={118} innerRadius={54} paddingAngle={3}>
                          {(chartData as NamedCount[]).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.32)]">
            <ErpSectionHeading title="Semáforo de configuración" description="Resumen rápido de qué tan preparado está el módulo para una operación ordenada." />
            <div className="mt-5 space-y-4">
              {[
                { label: 'Cuentas de registro', value: postingCoverage, total: `${postingAccounts}/${accounts.length || 0}`, icon: Landmark },
                { label: 'Centros conectados', value: centerCoverage, total: `${linkedCostCenters}/${costCenters.length || 0}`, icon: Building2 },
                { label: 'Reglas activas', value: automationCoverage, total: `${activeRules}/${rules.length || 0}`, icon: Workflow },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-950">{item.label}</div>
                          <div className="text-sm text-slate-500">{item.total}</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-700">{formatPercent(item.value)}</div>
                    </div>
                    <div className="mt-3 h-2.5 rounded-full bg-white">
                      <div
                        className={cn(
                          'h-2.5 rounded-full transition-all',
                          item.value >= 75 ? 'bg-emerald-500' : item.value >= 45 ? 'bg-amber-500' : 'bg-rose-500',
                        )}
                        style={{ width: `${Math.max(8, Math.min(100, item.value))}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.32)]">
            <ErpSectionHeading title="Acciones rápidas" description="Entradas directas para las tareas que más se repiten en contabilidad." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Crear cuenta', href: '/dashboard/contabilidad/plan-de-cuentas', icon: Landmark },
                { label: 'Crear centro', href: '/dashboard/contabilidad/centros-de-costo', icon: Building2 },
                { label: 'Crear regla', href: '/dashboard/contabilidad/reglas', icon: Settings2 },
                { label: 'Generar reporte', href: '/dashboard/contabilidad/libros', icon: BarChart3 },
                { label: 'Conciliar', href: '/dashboard/contabilidad/conciliaciones', icon: Scale },
                { label: 'Cerrar período', href: '/dashboard/contabilidad/cierres', icon: FileSpreadsheet },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.label} href={item.href} className="inline-flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                )
              })}
            </div>

            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
              {financeSummary
                ? 'La lectura ejecutiva usa datos del motor financiero para complementar la configuración del módulo.'
                : 'Si activas inteligencia empresarial y permisos de reportes, aquí aparecerá una lectura financiera más completa.'}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.32)]">
        <ErpSectionHeading title="Resumen de base contable" description="Indicadores simples para saber si la estructura soporta reportes y conciliación." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Activos configurados', value: accounts.filter((account) => account.type === 'ASSET').length, icon: Landmark },
            { label: 'Cuentas de gasto', value: accounts.filter((account) => account.type === 'EXPENSE').length, icon: CircleAlert },
            { label: 'Eventos con regla', value: rules.length, icon: Workflow },
            { label: 'Cobertura sugerida', value: readinessScore, icon: Sparkles, suffix: '%' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">{item.label}</span>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {item.value}
                  {item.suffix ?? ''}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
