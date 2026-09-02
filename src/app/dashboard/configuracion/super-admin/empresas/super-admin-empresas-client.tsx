'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Sparkles, Zap } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/components/providers/i18n-provider'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ModuleKey } from '@prisma/client'
import type { PlanTier } from '@/lib/plans'

type BillingCycle = 'MONTHLY' | 'YEARLY'

type VerticalKey = 'ODONTOLOGIA' | 'RESTAURANTE' | 'DOTACIONES'

type InvoiceStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED' | 'FAILED'

type ListRow = {
  id: string
  workspaceCode: string
  nombre: string
  nit: string
  email: string | null
  planOwnerEmail: string | null
  planTier: PlanTier
  billingCycle: BillingCycle
  planValidUntil: string | null
  trialTier: PlanTier | null
  trialStartedAt: string | null
  trialValidUntil: string | null
  isNew: boolean
  stripeSubscriptionStatus: string | null
  stripeCurrentPeriodEnd: string | null
  createdAt: string
  updatedAt: string
  hasCompanyCode: boolean
  lastPaid: null | { paidAt: string | null; amountCOP: number; status: InvoiceStatus; paymentMethod?: string | null }
}

type ListResponse =
  | { ok: true; items: ListRow[] }
  | { ok?: false; error?: string }

type DetailInvoice = {
  id: string
  provider: string
  status: InvoiceStatus
  amountCOP: number
  currency: string
  planTier: PlanTier
  billingCycle: BillingCycle
  paidAt: string | null
  expiresAt: string | null
  externalReference: string
  boldPaymentLinkId: string | null
  paymentMethod: string | null
  quotedModules: ModuleKey[]
  createdAt: string
  updatedAt: string
}

type DetailEmpresa = {
  id: string
  workspaceCode: string
  planOwnerEmail?: string | null
  nombre: string
  nit: string
  direccion: string | null
  telefono: string | null
  whatsapp?: string | null
  email: string | null
  logo: string | null
  planTier: PlanTier
  billingCycle: BillingCycle
  planValidUntil: string | null
  trialTier: PlanTier | null
  trialStartedAt: string | null
  trialValidUntil: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  stripeSubscriptionStatus: string | null
  stripeCurrentPeriodEnd: string | null
  stripeCancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
  hasCompanyCode: boolean
  billingInvoices: DetailInvoice[]
}

type DetailResponse =
  | { ok: true; empresa: DetailEmpresa }
  | { ok?: false; error?: string }

type ModuleOverrideRow = {
  module: ModuleKey
  baseEnabled: boolean
  overrideEnabled: boolean | null
  effectiveEnabled: boolean
}

type ModuleOverridesResponse =
  | { ok: true; effectivePlanTier: PlanTier; rows: ModuleOverrideRow[] }
  | { ok?: false; error?: string }

type ModuleOverrideMutationResponse =
  | { ok: true; effectivePlanTier: PlanTier; row: ModuleOverrideRow }
  | { ok?: false; error?: string }

type VerticalOverrideRow = {
  vertical: VerticalKey
  enabled: boolean
}

type VerticalOverridesResponse =
  | { ok: true; rows: VerticalOverrideRow[] }
  | { ok?: false; error?: string }

type VerticalOverrideMutationResponse =
  | { ok: true; row: VerticalOverrideRow; appliedUsers?: number }
  | { ok?: false; error?: string }

type CompanySortKey = 'nombre' | 'lastPaidAt' | 'expiryDate' | 'planTier' | 'status'

type SortDirection = 'asc' | 'desc'

type CompanyPageSize = 5 | 10 | 25 | 50 | 100 | 'ALL'

function fmtDate(value: string | null | undefined, locale: string, naText: string): string {
  if (!value) return naText
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function moneyCOP(value: number | null | undefined, locale: string): string {
  const n = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
  } catch {
    return String(n)
  }
}

const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'CRM', label: 'CRM' },
  { value: 'BASIC', label: 'BASIC' },
  { value: 'MEDIO', label: 'MEDIO' },
  { value: 'INTERMEDIO', label: 'INTERMEDIO' },
  { value: 'FULL', label: 'FULL' },
]

type CompanyFilter = 'ALL' | 'NEW' | 'TRIAL' | 'PAID' | 'EXPIRED'

type CompanyStatusFilter = 'ALL' | 'ACTIVE' | 'CANCELLED'

type CompanyRuntimeStatus = 'ACTIVE' | 'CANCELLED'

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isFutureDate(value: string | null | undefined): boolean {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date > new Date()
}

function getCompanyExpiryDate(row: Pick<ListRow, 'planValidUntil' | 'trialValidUntil'>): string | null {
  if (row.planValidUntil) return row.planValidUntil
  if (row.trialValidUntil) return row.trialValidUntil
  return null
}

function getCompanyRuntimeStatus(row: Pick<ListRow, 'planValidUntil' | 'trialValidUntil' | 'stripeSubscriptionStatus'>): CompanyRuntimeStatus {
  const stripeStatus = (row.stripeSubscriptionStatus ?? '').toLowerCase()
  const hasActiveAccess = isFutureDate(row.planValidUntil) || isFutureDate(row.trialValidUntil)

  if (hasActiveAccess) return 'ACTIVE'
  if (['active', 'trialing', 'past_due'].includes(stripeStatus)) return 'ACTIVE'
  return 'CANCELLED'
}

function titleForModule(moduleKey: ModuleKey): string {
  switch (moduleKey) {
    case 'DASHBOARD':
      return 'Inicio y base'
    case 'COTIZADOR':
      return 'Cotizador y costos'
    case 'COTIZACIONES':
      return 'Cotizaciones'
    case 'CLIENTES':
      return 'Clientes'
    case 'CRM':
      return 'CRM comercial'
    case 'MATERIALES':
      return 'Productos'
    case 'INVENTARIO':
      return 'Inventario'
    case 'REMISIONES':
      return 'Remisiones'
    case 'POS':
      return 'POS / Facturación'
    case 'PROVEEDORES':
      return 'Proveedores'
    case 'COMPRAS':
      return 'Compras'
    case 'ORDENES':
      return 'Órdenes'
    case 'ESCANEOS':
      return 'Escaneos'
    case 'REPORTES':
      return 'Analítica e inteligencia'
    case 'CONTABILIDAD':
      return 'Finanzas / Contabilidad y nómina'
    case 'NOTIFICACIONES':
      return 'Notificaciones'
    case 'CONFIG':
      return 'Configuración'
    default:
      return moduleKey
  }
}

function subtitleForModule(moduleKey: ModuleKey): string | null {
  switch (moduleKey) {
    case 'DASHBOARD':
      return 'Incluye Inicio, Red operativa, Mapa de producto y Plantillas base.'
    case 'COTIZADOR':
      return 'Incluye Cotizador, Costos e IA operativa ligada a ventas.'
    case 'CRM':
      return 'Incluye oportunidades, agenda, DRIVE y automatización comercial.'
    case 'REPORTES':
      return 'Incluye Reportes y Motor de inteligencia empresarial.'
    case 'CONTABILIDAD':
      return 'Incluye contabilidad, nómina y portal laboral.'
    case 'POS':
      return 'Incluye facturación POS y base operativa de restaurante.'
    default:
      return null
  }
}

function resolveAccessSourceLabel(detail: DetailEmpresa | null, effectivePlanTier: PlanTier, t: (key: string) => string) {
  if (detail?.planValidUntil && new Date(detail.planValidUntil) > new Date()) {
    return `${t('superAdmin.companies.labels.activePaidPlan')} ${detail.planTier}`
  }

  if (detail?.trialValidUntil && new Date(detail.trialValidUntil) > new Date()) {
    return `${t('superAdmin.companies.labels.activeTrial')} ${detail.trialTier ?? effectivePlanTier}`
  }

  return `${t('superAdmin.companies.labels.activeBasePlan')} ${effectivePlanTier}`
}

function titleForVertical(verticalKey: VerticalKey): string {
  switch (verticalKey) {
    case 'ODONTOLOGIA':
      return 'Odontología'
    case 'RESTAURANTE':
      return 'Restaurante'
    case 'DOTACIONES':
      return 'Dotaciones'
    default:
      return verticalKey
  }
}

export default function SuperAdminEmpresasClient() {
  const { t, language } = useI18n()
  const { toast } = useToast()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')

  const billingCycleLabel = (cycle: BillingCycle) => t(`superAdmin.companies.billing.${cycle}`)
  const invoiceStatusLabel = (status: InvoiceStatus) => t(`superAdmin.companies.invoiceStatus.${status}`)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ListRow[]>([])
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('ALL')
  const [planFilter, setPlanFilter] = useState<'ALL' | PlanTier>('ALL')
  const [statusFilter, setStatusFilter] = useState<CompanyStatusFilter>('ALL')
  const [sortKey, setSortKey] = useState<CompanySortKey>('expiryDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [pageSize, setPageSize] = useState<CompanyPageSize>(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    nombre: '',
    nit: '',
    direccion: '',
    telefono: '',
    whatsapp: '',
    companyEmail: '',
    logo: '',
    planOwnerEmail: '',
    planTier: 'FULL' as PlanTier,
    billingCycle: 'MONTHLY' as BillingCycle,
    isPaid: false,
  })

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailEmpresa | null>(null)
  const [moduleOverrides, setModuleOverrides] = useState<ModuleOverrideRow[]>([])
  const [moduleOverridesPlanTier, setModuleOverridesPlanTier] = useState<PlanTier>('FULL')
  const [moduleOverridesLoading, setModuleOverridesLoading] = useState(false)
  const [moduleOverridesError, setModuleOverridesError] = useState<string | null>(null)
  const [moduleOverrideSavingKey, setModuleOverrideSavingKey] = useState<ModuleKey | null>(null)
  const [verticalOverrides, setVerticalOverrides] = useState<VerticalOverrideRow[]>([])
  const [verticalOverridesLoading, setVerticalOverridesLoading] = useState(false)
  const [verticalOverridesError, setVerticalOverridesError] = useState<string | null>(null)
  const [verticalOverrideSavingKey, setVerticalOverrideSavingKey] = useState<VerticalKey | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    nombre: '',
    nit: '',
    direccion: '',
    telefono: '',
    whatsapp: '',
    companyEmail: '',
    logo: '',
    planOwnerEmail: '',
    planTier: 'FULL' as PlanTier,
    billingCycle: 'MONTHLY' as BillingCycle,
    planValidUntil: '',
    clearTrial: false,
    isPaid: false,
    isPaidTouched: false,
  })

  const [generatingForId, setGeneratingForId] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState<Record<string, string>>({})
  const pageSizeOptions: CompanyPageSize[] = [5, 10, 25, 50, 100, 'ALL']

  const statusFilterOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: language === 'en' ? 'All states' : 'Todos los estados' },
      { value: 'ACTIVE' as const, label: language === 'en' ? 'Active' : 'Activas' },
      { value: 'CANCELLED' as const, label: language === 'en' ? 'Cancelled' : 'Canceladas' },
    ],
    [language]
  )

  const planFilterOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: language === 'en' ? 'All plans' : 'Todos los planes' },
      ...PLAN_OPTIONS,
    ],
    [language]
  )

  const moduleOverrideOptions = useMemo(
    () => [
      { value: 'inherit' as const, label: t('superAdmin.companies.labels.inherited') },
      { value: 'enabled' as const, label: t('superAdmin.companies.labels.forceEnabled') },
      { value: 'disabled' as const, label: t('superAdmin.companies.labels.forceDisabled') },
    ],
    [t]
  )

  const moduleOverridesEnabledCount = useMemo(
    () => moduleOverrides.filter((row) => row.effectiveEnabled).length,
    [moduleOverrides]
  )

  function replaceModuleOverrideRow(rows: ModuleOverrideRow[], nextRow: ModuleOverrideRow) {
    return rows.map((row) => (row.module === nextRow.module ? nextRow : row))
  }

  function moduleFinalStateLabel(enabled: boolean) {
    return language === 'en' ? (enabled ? 'Active' : 'Inactive') : enabled ? 'Activo' : 'Apagado'
  }

  function moduleOverrideStatusLabel(value: boolean | null) {
    if (value == null) return t('superAdmin.companies.labels.inherited')
    return value ? t('superAdmin.companies.labels.forceEnabled') : t('superAdmin.companies.labels.forceDisabled')
  }

  function moduleOverrideToastDescription(moduleName: string, row: ModuleOverrideRow) {
    if (language === 'en') {
      return `${moduleName} was validated in the database and is now ${row.effectiveEnabled ? 'active' : 'inactive'} for the company. Final user access still depends on profile and branch permissions.`
    }

    return `${moduleName} quedó validado en la base de datos y ahora está ${row.effectiveEnabled ? 'activo' : 'apagado'} para la empresa. El acceso del usuario final todavía depende de sus permisos de perfil y sede.`
  }

  function verticalOverrideToastDescription(verticalName: string, enabled: boolean) {
    if (language === 'en') {
      return `${verticalName} was validated in the database and is now ${enabled ? 'active' : 'inactive'} for the company. Final user access still depends on assigned permissions.`
    }

    return `${verticalName} quedó validado en la base de datos y ahora está ${enabled ? 'activo' : 'apagado'} para la empresa. El acceso final del usuario todavía depende de sus permisos asignados.`
  }

  function getComparableDate(value: string | null | undefined) {
    if (!value) return 0
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
  }

  function compareCompanies(a: ListRow, b: ListRow, key: CompanySortKey) {
    const aStatus = getCompanyRuntimeStatus(a)
    const bStatus = getCompanyRuntimeStatus(b)

    switch (key) {
      case 'nombre':
        return a.nombre.localeCompare(b.nombre, locale)
      case 'lastPaidAt':
        return getComparableDate(a.lastPaid?.paidAt) - getComparableDate(b.lastPaid?.paidAt)
      case 'expiryDate':
        return getComparableDate(getCompanyExpiryDate(a)) - getComparableDate(getCompanyExpiryDate(b))
      case 'planTier':
        return a.planTier.localeCompare(b.planTier, locale)
      case 'status':
        return aStatus.localeCompare(bStatus, locale)
      default:
        return 0
    }
  }

  function toggleSort(nextKey: CompanySortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === 'expiryDate' || nextKey === 'lastPaidAt' ? 'desc' : 'asc')
  }

  function sortIconFor(key: CompanySortKey) {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5" />
    return sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  async function loadModuleOverrides(empresaId: string) {
    setModuleOverridesLoading(true)
    setModuleOverridesError(null)
    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(empresaId)}/module-overrides`, {
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => ({}))) as ModuleOverridesResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setModuleOverrides([])
        setModuleOverridesError(('error' in json && json.error) || t('superAdmin.companies.errors.loadModuleOverridesFailed'))
        return
      }

      setModuleOverrides(json.rows)
      setModuleOverridesPlanTier(json.effectivePlanTier)
    } catch (e) {
      setModuleOverrides([])
      setModuleOverridesError(e instanceof Error ? e.message : t('superAdmin.companies.errors.loadModuleOverridesFailed'))
    } finally {
      setModuleOverridesLoading(false)
    }
  }

  async function saveModuleOverride(moduleKey: ModuleKey, nextValue: 'inherit' | 'enabled' | 'disabled') {
    if (!detail?.id) return

    const previous = moduleOverrides
    const enabled = nextValue === 'inherit' ? null : nextValue === 'enabled'
    setModuleOverrideSavingKey(moduleKey)
    setModuleOverridesError(null)
    setModuleOverrides((prev) =>
      prev.map((row) =>
        row.module === moduleKey
          ? {
              ...row,
              overrideEnabled: enabled,
              effectiveEnabled: typeof enabled === 'boolean' ? enabled : row.baseEnabled,
            }
          : row
      )
    )

    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(detail.id)}/module-overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleKey, enabled }),
      })
      const json = (await res.json().catch(() => ({}))) as ModuleOverrideMutationResponse
      if (!res.ok || !json.ok) {
        const message = ('error' in json && json.error) || t('superAdmin.companies.errors.saveModuleOverridesFailed')
        setModuleOverrides(previous)
        setModuleOverridesError(message)
        toast({
          title: language === 'en' ? 'Module update failed' : 'No se pudo actualizar el módulo',
          description: message,
          variant: 'destructive',
        })
        return
      }

      setModuleOverrides((prev) => replaceModuleOverrideRow(prev, json.row))
      setModuleOverridesPlanTier(json.effectivePlanTier)
      toast({
        title: json.row.effectiveEnabled
          ? language === 'en'
            ? 'Module activated'
            : 'Módulo activado'
          : language === 'en'
            ? 'Module deactivated'
            : 'Módulo desactivado',
        description: moduleOverrideToastDescription(titleForModule(json.row.module), json.row),
      })
    } catch (e) {
      setModuleOverrides(previous)
      setModuleOverridesError(e instanceof Error ? e.message : t('superAdmin.companies.errors.saveModuleOverridesFailed'))
      toast({
        title: language === 'en' ? 'Module update failed' : 'No se pudo actualizar el módulo',
        description: e instanceof Error ? e.message : t('superAdmin.companies.errors.saveModuleOverridesFailed'),
        variant: 'destructive',
      })
    } finally {
      setModuleOverrideSavingKey(null)
    }
  }

  async function saveVerticalOverride(verticalKey: VerticalKey, enabled: boolean) {
    if (!detail?.id) return

    const previous = verticalOverrides
    setVerticalOverrideSavingKey(verticalKey)
    setVerticalOverridesError(null)
    setVerticalOverrides((prev) => prev.map((row) => (row.vertical === verticalKey ? { ...row, enabled } : row)))

    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(detail.id)}/vertical-overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical: verticalKey, enabled }),
      })
      const json = (await res.json().catch(() => ({}))) as VerticalOverrideMutationResponse
      if (!res.ok || !json.ok) {
        const message = ('error' in json && json.error) || t('superAdmin.companies.errors.saveVerticalOverridesFailed')
        setVerticalOverrides(previous)
        setVerticalOverridesError(message)
        toast({
          title: language === 'en' ? 'Vertical update failed' : 'No se pudo actualizar la vertical',
          description: message,
          variant: 'destructive',
        })
        return
      }

      setVerticalOverrides((prev) => prev.map((row) => (row.vertical === json.row.vertical ? json.row : row)))
      toast({
        title: json.row.enabled
          ? language === 'en'
            ? 'Vertical activated'
            : 'Vertical activada'
          : language === 'en'
            ? 'Vertical deactivated'
            : 'Vertical desactivada',
        description: `${verticalOverrideToastDescription(titleForVertical(json.row.vertical), json.row.enabled)} ${language === 'en' ? `Permissions synced for ${json.appliedUsers ?? 0} user(s).` : `Permisos sincronizados para ${json.appliedUsers ?? 0} usuario(s).`}`,
      })
    } catch (e) {
      setVerticalOverrides(previous)
      setVerticalOverridesError(e instanceof Error ? e.message : t('superAdmin.companies.errors.saveVerticalOverridesFailed'))
      toast({
        title: language === 'en' ? 'Vertical update failed' : 'No se pudo actualizar la vertical',
        description: e instanceof Error ? e.message : t('superAdmin.companies.errors.saveVerticalOverridesFailed'),
        variant: 'destructive',
      })
    } finally {
      setVerticalOverrideSavingKey(null)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/super-admin/empresas?${params.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as ListResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setItems([])
        setError(('error' in json && json.error) || t('superAdmin.companies.errors.loadFailed'))
        return
      }
      setItems(json.items)
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const trialActive = isFutureDate(item.trialValidUntil)
      const paidActive = isFutureDate(item.planValidUntil)
      const runtimeStatus = getCompanyRuntimeStatus(item)
      if (companyFilter === 'NEW' && !item.isNew) return false
      if (companyFilter === 'TRIAL' && !trialActive) return false
      if (companyFilter === 'PAID' && !paidActive) return false
      if (companyFilter === 'EXPIRED' && (trialActive || paidActive)) return false
      if (planFilter !== 'ALL' && item.planTier !== planFilter) return false
      if (statusFilter !== 'ALL' && runtimeStatus !== statusFilter) return false
      return true
    })
  }, [companyFilter, items, planFilter, statusFilter])

  const filteredAndSorted = useMemo(() => {
    const next = [...filtered]
    next.sort((a, b) => {
      const result = compareCompanies(a, b, sortKey)
      if (result !== 0) return sortDirection === 'asc' ? result : -result
      return a.nombre.localeCompare(b.nombre, locale)
    })
    return next
  }, [filtered, locale, sortDirection, sortKey])

  const totalPages = useMemo(() => {
    if (pageSize === 'ALL') return 1
    return Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  }, [filteredAndSorted.length, pageSize])

  const paginatedItems = useMemo(() => {
    if (pageSize === 'ALL') return filteredAndSorted
    const start = (currentPage - 1) * pageSize
    return filteredAndSorted.slice(start, start + pageSize)
  }, [currentPage, filteredAndSorted, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [companyFilter, pageSize, planFilter, search, sortDirection, sortKey, statusFilter])

  useEffect(() => {
    if (currentPage <= totalPages) return
    setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  async function openDetail(id: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    setEditMode(false)
    setEditError(null)
    setModuleOverrides([])
    setModuleOverridesError(null)
    setModuleOverridesLoading(true)
    setVerticalOverrides([])
    setVerticalOverridesError(null)
    setVerticalOverridesLoading(true)
    try {
      const [detailRes, overridesRes, verticalOverridesRes] = await Promise.all([
        fetch(`/api/super-admin/empresas/${encodeURIComponent(id)}`, { cache: 'no-store' }),
        fetch(`/api/super-admin/empresas/${encodeURIComponent(id)}/module-overrides`, { cache: 'no-store' }),
        fetch(`/api/super-admin/empresas/${encodeURIComponent(id)}/vertical-overrides`, { cache: 'no-store' }),
      ])
      const json = (await detailRes.json().catch(() => ({}))) as DetailResponse
      if (!detailRes.ok || !('ok' in json) || !json.ok) {
        setDetailError(('error' in json && json.error) || t('superAdmin.companies.errors.loadFailed'))
        return
      }
      setDetail(json.empresa)

      const overridesJson = (await overridesRes.json().catch(() => ({}))) as ModuleOverridesResponse
      if (!overridesRes.ok || !('ok' in overridesJson) || !overridesJson.ok) {
        setModuleOverrides([])
        setModuleOverridesError(
          ('error' in overridesJson && overridesJson.error) || t('superAdmin.companies.errors.loadModuleOverridesFailed')
        )
      } else {
        setModuleOverrides(overridesJson.rows)
        setModuleOverridesPlanTier(overridesJson.effectivePlanTier)
      }

      const verticalsJson = (await verticalOverridesRes.json().catch(() => ({}))) as VerticalOverridesResponse
      if (!verticalOverridesRes.ok || !('ok' in verticalsJson) || !verticalsJson.ok) {
        setVerticalOverrides([])
        setVerticalOverridesError(
          ('error' in verticalsJson && verticalsJson.error) || t('superAdmin.companies.errors.loadVerticalOverridesFailed')
        )
      } else {
        setVerticalOverrides(verticalsJson.rows)
      }

      setEditForm({
        nombre: json.empresa.nombre ?? '',
        nit: json.empresa.nit ?? '',
        direccion: json.empresa.direccion ?? '',
        telefono: json.empresa.telefono ?? '',
        whatsapp: json.empresa.whatsapp ?? '',
        companyEmail: json.empresa.email ?? '',
        logo: json.empresa.logo ?? '',
        planOwnerEmail: json.empresa.planOwnerEmail ?? '',
        planTier: json.empresa.planTier,
        billingCycle: json.empresa.billingCycle,
        planValidUntil: toDateInputValue(json.empresa.planValidUntil),
        clearTrial: false,
        isPaid: Boolean(json.empresa.planValidUntil && new Date(json.empresa.planValidUntil) > new Date()),
        isPaidTouched: false,
      })
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setDetailLoading(false)
      setModuleOverridesLoading(false)
      setVerticalOverridesLoading(false)
    }
  }

  async function createEmpresa() {
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/super-admin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: createForm.nombre,
          nit: createForm.nit,
          direccion: createForm.direccion,
          telefono: createForm.telefono,
          whatsapp: createForm.whatsapp,
          companyEmail: createForm.companyEmail,
          logo: createForm.logo,
          planOwnerEmail: createForm.planOwnerEmail,
          planTier: createForm.planTier,
          billingCycle: createForm.billingCycle,
          isPaid: createForm.isPaid,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; empresaId?: string }
      if (!res.ok || !json.ok) {
        setCreateError(json.error || t('superAdmin.companies.errors.createFailed'))
        return
      }
      setCreateOpen(false)
      setCreateForm({
        nombre: '',
        nit: '',
        direccion: '',
        telefono: '',
        whatsapp: '',
        companyEmail: '',
        logo: '',
        planOwnerEmail: '',
        planTier: 'FULL',
        billingCycle: 'MONTHLY',
        isPaid: false,
      })
      await load()
      if (json.empresaId) {
        await openDetail(json.empresaId)
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setCreateLoading(false)
    }
  }

  async function saveEmpresaEdits() {
    if (!detail?.id) return
    setEditLoading(true)
    setEditError(null)
    try {
      const payload: Record<string, unknown> = {
        nombre: editForm.nombre,
        nit: editForm.nit,
        direccion: editForm.direccion,
        telefono: editForm.telefono,
        whatsapp: editForm.whatsapp,
        companyEmail: editForm.companyEmail,
        logo: editForm.logo,
        planOwnerEmail: editForm.planOwnerEmail,
        planTier: editForm.planTier,
        billingCycle: editForm.billingCycle,
        planValidUntil: editForm.planValidUntil || null,
        clearTrial: editForm.clearTrial,
      }
      if (editForm.isPaidTouched && !editForm.planValidUntil) payload.isPaid = editForm.isPaid

      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(detail.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setEditError(json.error || t('superAdmin.companies.errors.saveFailed'))
        return
      }
      setEditMode(false)
      await load()
      await openDetail(detail.id)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setEditLoading(false)
    }
  }

  async function generateCode(empresaId: string) {
    setGeneratingForId(empresaId)
    try {
      const res = await fetch('/api/super-admin/empresa-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string }
      if (!res.ok || !json.ok || !json.code) {
        setError(json.error || t('superAdmin.companies.errors.generateCodeFailed'))
        return
      }
      setGeneratedCode((prev) => ({ ...prev, [empresaId]: json.code! }))
      await load()
    } finally {
      setGeneratingForId(null)
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Administración' }, { label: t('superAdmin.companies.title') }]}
        eyebrow="Super admin"
        title={t('superAdmin.companies.title')}
        description={t('superAdmin.companies.subtitle')}
        actions={
          <>
            <Button onClick={() => setCreateOpen(true)}>{t('superAdmin.companies.actions.create')}</Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/configuracion/super-admin/modulos-por-plan">{t('superAdmin.nav.modulesByPlan')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/configuracion/super-admin/usuarios">{t('superAdmin.nav.users')}</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('superAdmin.companies.search.title')}</CardTitle>
          <CardDescription>{t('superAdmin.companies.search.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('superAdmin.companies.search.placeholder')}
            className="max-w-md"
          />
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? t('superAdmin.companies.search.searching') : t('superAdmin.companies.search.action')}
          </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={planFilter} onValueChange={(value) => setPlanFilter(value as 'ALL' | PlanTier)}>
              <SelectTrigger className="h-9 w-[190px] bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CompanyStatusFilter)}>
              <SelectTrigger className="h-9 w-[190px] bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'NEW', 'TRIAL', 'PAID', 'EXPIRED'] as CompanyFilter[]).map((filter) => (
              <Button
                key={filter}
                type="button"
                variant={companyFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompanyFilter(filter)}
              >
                {t(`superAdmin.companies.filters.${filter}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-600">{t('common.loading')}</div> : null}

      {!loading && !filteredAndSorted.length ? <div className="text-sm text-gray-600">{t('common.noResults')}</div> : null}

      {!loading && filteredAndSorted.length ? (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{language === 'en' ? 'Company list' : 'Listado de empresas'}</CardTitle>
                <CardDescription>
                  {language === 'en'
                    ? 'Compact operational view with payment, validity, plan and current status.'
                    : 'Vista operacional compacta con pago, vigencia, plan y estado actual.'}
                </CardDescription>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                {filteredAndSorted.length} {language === 'en' ? 'results' : 'resultados'}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div>
                  {language === 'en'
                    ? `Showing ${paginatedItems.length} of ${filteredAndSorted.length}`
                    : `Mostrando ${paginatedItems.length} de ${filteredAndSorted.length}`}
                </div>
                <div className="flex items-center gap-2">
                  <span>{language === 'en' ? 'Rows' : 'Filas'}</span>
                  <Select value={String(pageSize)} onValueChange={(value) => setPageSize(value === 'ALL' ? 'ALL' : Number(value) as CompanyPageSize)}>
                    <SelectTrigger className="h-8 w-[92px] bg-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizeOptions.map((option) => (
                        <SelectItem key={String(option)} value={String(option)}>
                          {option === 'ALL' ? (language === 'en' ? 'All' : 'Todos') : option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="max-h-[68vh] overflow-auto">
              <div className="sticky top-0 z-10 hidden border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/90 lg:grid lg:grid-cols-[minmax(280px,2.2fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(150px,0.9fr)_minmax(140px,0.8fr)_minmax(220px,1.2fr)] lg:gap-4">
                <button type="button" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" onClick={() => toggleSort('nombre')}>
                  <span>{language === 'en' ? 'Company' : 'Empresa'}</span>
                  {sortIconFor('nombre')}
                </button>
                <button type="button" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" onClick={() => toggleSort('lastPaidAt')}>
                  <span>{language === 'en' ? 'Last payment' : 'Último pago'}</span>
                  {sortIconFor('lastPaidAt')}
                </button>
                <button type="button" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" onClick={() => toggleSort('expiryDate')}>
                  <span>{language === 'en' ? 'Expiration' : 'Vencimiento'}</span>
                  {sortIconFor('expiryDate')}
                </button>
                <button type="button" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" onClick={() => toggleSort('planTier')}>
                  <span>{language === 'en' ? 'Plan' : 'Plan'}</span>
                  {sortIconFor('planTier')}
                </button>
                <button type="button" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" onClick={() => toggleSort('status')}>
                  <span>{language === 'en' ? 'Status' : 'Estado'}</span>
                  {sortIconFor('status')}
                </button>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Actions' : 'Acciones'}</div>
              </div>
              <div className="divide-y divide-slate-200">
                {paginatedItems.map((e) => {
                const companyStatus = getCompanyRuntimeStatus(e)
                const expiryDate = getCompanyExpiryDate(e)
                const statusLabel = companyStatus === 'ACTIVE'
                  ? language === 'en'
                    ? 'Active'
                    : 'Activo'
                  : language === 'en'
                    ? 'Cancelled'
                    : 'Cancelado'
                const statusClassName = companyStatus === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                  : 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'

                return (
                  <div key={e.id} className="px-4 py-4 transition hover:bg-slate-50/80">
                    <div className="grid gap-4 lg:grid-cols-[minmax(280px,2.2fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(150px,0.9fr)_minmax(140px,0.8fr)_minmax(220px,1.2fr)] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-slate-900">{e.nombre}</div>
                          {e.isNew ? <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"><Sparkles className="h-3 w-3" />{t('superAdmin.companies.labels.newAccount')}</span> : null}
                          {isFutureDate(e.trialValidUntil) ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"><Clock3 className="h-3 w-3" />Trial</span> : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {t('superAdmin.companies.labels.code')}: <span className="font-mono text-slate-700">{e.workspaceCode}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {t('superAdmin.companies.labels.ownerEmail')}: <span className="text-slate-700">{e.planOwnerEmail || naText}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">{moneyCOP(e.lastPaid?.amountCOP ?? null, locale)}</div>
                        <div className="text-xs text-slate-500">{fmtDate(e.lastPaid?.paidAt ?? null, locale, naText)}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">{fmtDate(expiryDate, locale, naText)}</div>
                        <div className="text-xs text-slate-500">
                          {isFutureDate(e.trialValidUntil) && !e.planValidUntil
                            ? language === 'en'
                              ? 'Trial in progress'
                              : 'Trial en curso'
                            : language === 'en'
                              ? 'Current validity'
                              : 'Vigencia actual'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">{e.planTier}</div>
                        <div className="text-xs text-slate-500">{billingCycleLabel(e.billingCycle)}</div>
                      </div>

                      <div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button variant="outline" size="sm" onClick={() => void openDetail(e.id)}>
                          {t('superAdmin.companies.actions.viewDetail')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void generateCode(e.id)}
                          disabled={generatingForId === e.id}
                        >
                          {generatingForId === e.id ? t('superAdmin.companies.actions.generating') : t('superAdmin.companies.actions.generateId')}
                        </Button>
                      </div>
                    </div>
                    {generatedCode[e.id] ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <span className="text-muted-foreground">{t('superAdmin.companies.labels.companyId')}: </span>
                        <span className="font-mono text-slate-800">{generatedCode[e.id]}</span>
                      </div>
                    ) : null}
                  </div>
                )
                })}
              </div>
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {pageSize === 'ALL'
                    ? (language === 'en' ? 'All companies visible in one page.' : 'Todas las empresas visibles en una sola página.')
                    : (language === 'en' ? `Page ${currentPage} of ${totalPages}` : `Página ${currentPage} de ${totalPages}`)}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={pageSize === 'ALL' || currentPage <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={pageSize === 'ALL' || currentPage >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={detailOpen} onOpenChange={(v) => (!detailLoading ? setDetailOpen(v) : null)}>
        <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden border-slate-200 bg-white p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4">
            <DialogTitle>{t('superAdmin.companies.detail.title')}</DialogTitle>
            <DialogDescription>{t('superAdmin.companies.detail.subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {detailLoading ? <div className="text-sm text-gray-600">{t('common.loading')}</div> : null}
            {detailError ? <div className="text-sm text-red-600">{detailError}</div> : null}

            {editError ? <div className="text-sm text-red-600">{editError}</div> : null}

            {detail ? (
              <div className="space-y-4 text-sm">
                {!editMode ? (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/60 p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-slate-900">{detail.nombre}</div>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              {t('superAdmin.companies.labels.plan')}: {detail.planTier}
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                              {billingCycleLabel(detail.billingCycle)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600">
                            {t('superAdmin.companies.labels.code')}: <span className="font-mono text-slate-900">{detail.workspaceCode}</span> · {t('superAdmin.companies.labels.id')}: <span className="font-mono text-slate-900">{detail.id}</span>
                          </div>
                          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                              {t('superAdmin.companies.labels.ownerEmail')}: <span className="font-medium text-slate-900">{detail.planOwnerEmail || naText}</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                              {t('superAdmin.companies.fields.companyEmail')}: <span className="font-medium text-slate-900">{detail.email || naText}</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                              {t('superAdmin.companies.labels.nit')}: <span className="font-medium text-slate-900">{detail.nit}</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 sm:col-span-2 xl:col-span-1">
                              {t('superAdmin.companies.fields.address')}: <span className="font-medium text-slate-900">{detail.direccion || naText}</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                              {t('superAdmin.companies.fields.phone')}: <span className="font-medium text-slate-900">{detail.telefono || naText}</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                              {t('superAdmin.companies.fields.whatsapp')}: <span className="font-medium text-slate-900">{detail.whatsapp || naText}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid min-w-[220px] gap-2 text-xs text-slate-600">
                          <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2">
                            {t('superAdmin.companies.labels.validUntil')}: <span className="font-medium text-slate-900">{fmtDate(detail.planValidUntil, locale, naText)}</span>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2">
                            {t('superAdmin.companies.labels.trialUntil')}: <span className="font-medium text-slate-900">{fmtDate(detail.trialValidUntil, locale, naText)}</span>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2">
                            {t('superAdmin.companies.labels.stripe')}: <span className="font-medium text-slate-900">{detail.stripeSubscriptionStatus || naText}</span>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2">
                            {t('superAdmin.companies.labels.updatedAt')}: <span className="font-medium text-slate-900">{fmtDate(detail.updatedAt, locale, naText)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{t('superAdmin.companies.labels.moduleOverrides')}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('superAdmin.companies.fields.moduleOverridesHelp')} {moduleOverrides.length ? `(${resolveAccessSourceLabel(detail, moduleOverridesPlanTier, t)})` : ''}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                              {moduleOverridesEnabledCount}/{moduleOverrides.length || 0} {language === 'en' ? 'active' : 'activos'}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                              {language === 'en' ? 'Validated against DB' : 'Validado contra BD'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                          {language === 'en'
                            ? 'This panel updates the company module state in the database. Final user access still depends on branch membership and assigned permissions.'
                            : 'Este panel actualiza el estado del módulo por empresa en la base de datos. El acceso final del usuario todavía depende de su sede y permisos asignados.'}
                        </div>
                      </div>
                      {moduleOverridesError ? <div className="text-xs text-red-600">{moduleOverridesError}</div> : null}
                      {moduleOverridesLoading ? <div className="text-xs text-muted-foreground">{t('common.loading')}</div> : null}
                      {!moduleOverridesLoading ? (
                        <div className="grid gap-3 xl:grid-cols-2">
                          {moduleOverrides.map((row) => {
                            const selectedValue = row.overrideEnabled == null ? 'inherit' : row.overrideEnabled ? 'enabled' : 'disabled'
                            const subtitle = subtitleForModule(row.module)
                            const isSaving = moduleOverrideSavingKey === row.module

                            return (
                              <div
                                key={row.module}
                                className={`rounded-2xl border p-4 shadow-sm transition ${row.effectiveEnabled ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60' : 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/60'}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="font-medium leading-none text-slate-900">{titleForModule(row.module)}</div>
                                      {row.effectiveEnabled ? <Zap className="h-4 w-4 text-emerald-600" /> : null}
                                    </div>
                                    {subtitle ? <div className="mt-1 text-[11px] text-slate-600">{subtitle}</div> : null}
                                    <div className="mt-2 text-[11px] font-medium tracking-wide text-slate-500">{row.module}</div>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.effectiveEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {moduleFinalStateLabel(row.effectiveEnabled)}
                                  </span>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                  {moduleOverrideOptions.map((option) => {
                                    const active = selectedValue === option.value
                                    return (
                                      <Button
                                        key={option.value}
                                        type="button"
                                        variant={active ? 'default' : 'outline'}
                                        size="sm"
                                        className="justify-between"
                                        disabled={isSaving}
                                        onClick={() => void saveModuleOverride(row.module, option.value)}
                                      >
                                        <span className="truncate">{option.label}</span>
                                        {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                                      </Button>
                                    )
                                  })}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className={`rounded-full px-2.5 py-1 font-medium ${row.baseEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                                    {language === 'en' ? 'Base' : 'Base'}: {row.baseEnabled ? 'ON' : 'OFF'}
                                  </span>
                                  <span className="rounded-full bg-white/90 px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                                    {language === 'en' ? 'Override' : 'Override'}: {moduleOverrideStatusLabel(row.overrideEnabled)}
                                  </span>
                                  <span className={`rounded-full px-2.5 py-1 font-medium ${row.effectiveEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}`}>
                                    {language === 'en' ? 'Final' : 'Final'}: {row.effectiveEnabled ? 'ON' : 'OFF'}
                                  </span>
                                  {isSaving ? (
                                    <span className="inline-flex items-center gap-1 text-slate-500">
                                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      {language === 'en' ? 'Saving' : 'Guardando'}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-[11px] text-slate-600">
                                  {row.baseEnabled ? t('superAdmin.companies.labels.baseIncluded') : t('superAdmin.companies.labels.baseExcluded')}
                                  {' · '}
                                  {row.overrideEnabled == null
                                    ? language === 'en'
                                      ? 'Uses the current plan state.'
                                      : 'Usa el estado actual del plan.'
                                    : row.overrideEnabled
                                      ? language === 'en'
                                        ? 'Forced on and revalidated for the company.'
                                        : 'Quedó forzado en activo y revalidado para la empresa.'
                                      : language === 'en'
                                        ? 'Forced off and revalidated for the company.'
                                        : 'Quedó forzado en apagado y revalidado para la empresa.'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div>
                        <div className="font-medium text-slate-900">{t('superAdmin.companies.labels.verticalOverrides')}</div>
                        <div className="text-xs text-muted-foreground">{t('superAdmin.companies.fields.verticalOverridesHelp')}</div>
                      </div>
                      {verticalOverridesError ? <div className="text-xs text-red-600">{verticalOverridesError}</div> : null}
                      {verticalOverridesLoading ? <div className="text-xs text-muted-foreground">{t('common.loading')}</div> : null}
                      {!verticalOverridesLoading ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {verticalOverrides.map((row) => (
                            <div key={row.vertical} className={`rounded-2xl border p-3 shadow-sm ${row.enabled ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/70'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium leading-none text-slate-900">{titleForVertical(row.vertical)}</div>
                                  <div className="mt-1 text-[11px] text-slate-500">{row.vertical}</div>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                  {row.enabled ? 'ON' : 'OFF'}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-slate-200/70">
                                <Label htmlFor={`vertical-${row.vertical}`} className="text-xs text-muted-foreground">
                                  {row.enabled ? t('superAdmin.companies.labels.forceEnabled') : t('superAdmin.companies.labels.forceDisabled')}
                                </Label>
                                <Switch
                                  id={`vertical-${row.vertical}`}
                                  checked={row.enabled}
                                  onCheckedChange={(checked) => void saveVerticalOverride(row.vertical, checked)}
                                  disabled={verticalOverrideSavingKey === row.vertical}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <div className="font-medium">{t('superAdmin.companies.invoices.title')}</div>
                      {detail.billingInvoices.length ? (
                        <div className="space-y-1">
                          {detail.billingInvoices.map((inv) => (
                            <div key={inv.id} className="border rounded-md p-2">
                              <div>
                                {invoiceStatusLabel(inv.status)} · {moneyCOP(inv.amountCOP, locale)} · {t('superAdmin.companies.invoices.paidAt')}: <b>{fmtDate(inv.paidAt, locale, naText)}</b>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t('superAdmin.companies.invoices.reference')}: {inv.externalReference} · {t('superAdmin.companies.labels.createdAt')}: {fmtDate(inv.createdAt, locale, naText)} · {t('superAdmin.companies.labels.paymentMethod')}: {inv.paymentMethod || naText}
                              </div>
                              {inv.quotedModules.length ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {inv.quotedModules.map((moduleKey) => (
                                    <span key={moduleKey} className="rounded-full bg-muted px-2 py-1 text-[11px]">
                                      {titleForModule(moduleKey)}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">{t('superAdmin.companies.invoices.empty')}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.name')}</Label>
                    <Input value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.nit')}</Label>
                    <Input value={editForm.nit} onChange={(e) => setEditForm((p) => ({ ...p, nit: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.address')}</Label>
                    <Input value={editForm.direccion} onChange={(e) => setEditForm((p) => ({ ...p, direccion: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.phone')}</Label>
                    <Input value={editForm.telefono} onChange={(e) => setEditForm((p) => ({ ...p, telefono: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.whatsapp')}</Label>
                    <Input value={editForm.whatsapp} onChange={(e) => setEditForm((p) => ({ ...p, whatsapp: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.companyEmail')}</Label>
                    <Input value={editForm.companyEmail} onChange={(e) => setEditForm((p) => ({ ...p, companyEmail: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.logoUrl')}</Label>
                    <Input value={editForm.logo} onChange={(e) => setEditForm((p) => ({ ...p, logo: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.ownerEmail')}</Label>
                    <Input value={editForm.planOwnerEmail} onChange={(e) => setEditForm((p) => ({ ...p, planOwnerEmail: e.target.value }))} placeholder={t('superAdmin.companies.placeholders.ownerEmail')} />
                  </div>

                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.plan')}</Label>
                    <Select value={editForm.planTier} onValueChange={(v) => setEditForm((p) => ({ ...p, planTier: v as PlanTier }))}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('superAdmin.companies.placeholders.selectPlan')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PLAN_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>{t('superAdmin.companies.fields.billingCycle')}</Label>
                    <Select value={editForm.billingCycle} onValueChange={(v) => setEditForm((p) => ({ ...p, billingCycle: v as BillingCycle }))}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('superAdmin.companies.placeholders.selectBillingCycle')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">{billingCycleLabel('MONTHLY')}</SelectItem>
                        <SelectItem value="YEARLY">{billingCycleLabel('YEARLY')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label>{t('superAdmin.companies.fields.planValidUntil')}</Label>
                    <Input type="date" value={editForm.planValidUntil} onChange={(e) => setEditForm((p) => ({ ...p, planValidUntil: e.target.value, isPaidTouched: false }))} />
                    <p className="text-xs text-muted-foreground">{t('superAdmin.companies.fields.planValidUntilHelp')}</p>
                  </div>

                  <div className="flex items-center gap-3 sm:col-span-2 pt-2">
                    <Switch
                      checked={editForm.isPaid}
                      onCheckedChange={(checked) =>
                        setEditForm((p) => ({ ...p, isPaid: Boolean(checked), isPaidTouched: true }))
                      }
                      disabled={editLoading}
                    />
                    <div>
                      <div className="font-medium">{t('superAdmin.companies.fields.isPaid')}</div>
                      <div className="text-xs text-muted-foreground">{t('superAdmin.companies.fields.isPaidHelp')}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:col-span-2 pt-2">
                    <Switch
                      checked={editForm.clearTrial}
                      onCheckedChange={(checked) => setEditForm((p) => ({ ...p, clearTrial: Boolean(checked) }))}
                      disabled={editLoading}
                    />
                    <div>
                      <div className="font-medium">{t('superAdmin.companies.fields.clearTrial')}</div>
                      <div className="text-xs text-muted-foreground">{t('superAdmin.companies.fields.clearTrialHelp')}</div>
                    </div>
                  </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 px-5 py-4">
            {!editMode ? (
              <>
                <Button variant="outline" onClick={() => setDetailOpen(false)} disabled={detailLoading}>
                  {t('common.close')}
                </Button>
                <Button onClick={() => setEditMode(true)} disabled={detailLoading || !detail}>
                  {t('common.edit')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMode(false)
                    setEditError(null)
                  }}
                  disabled={editLoading}
                >
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void saveEmpresaEdits()} disabled={editLoading}>
                  {editLoading ? t('common.saving') : t('common.save')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(v) => (!createLoading ? setCreateOpen(v) : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('superAdmin.companies.create.title')}</DialogTitle>
            <DialogDescription>{t('superAdmin.companies.create.subtitle')}</DialogDescription>
          </DialogHeader>

          {createError ? <div className="text-sm text-red-600">{createError}</div> : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.name')}</Label>
              <Input value={createForm.nombre} onChange={(e) => setCreateForm((p) => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.nit')}</Label>
              <Input value={createForm.nit} onChange={(e) => setCreateForm((p) => ({ ...p, nit: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.address')}</Label>
              <Input value={createForm.direccion} onChange={(e) => setCreateForm((p) => ({ ...p, direccion: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.phone')}</Label>
              <Input value={createForm.telefono} onChange={(e) => setCreateForm((p) => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.whatsapp')}</Label>
              <Input value={createForm.whatsapp} onChange={(e) => setCreateForm((p) => ({ ...p, whatsapp: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.companyEmail')}</Label>
              <Input value={createForm.companyEmail} onChange={(e) => setCreateForm((p) => ({ ...p, companyEmail: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.logoUrl')}</Label>
              <Input value={createForm.logo} onChange={(e) => setCreateForm((p) => ({ ...p, logo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.ownerEmail')}</Label>
              <Input value={createForm.planOwnerEmail} onChange={(e) => setCreateForm((p) => ({ ...p, planOwnerEmail: e.target.value }))} placeholder={t('superAdmin.companies.placeholders.ownerEmail')} />
            </div>

            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.initialPlan')}</Label>
              <Select value={createForm.planTier} onValueChange={(v) => setCreateForm((p) => ({ ...p, planTier: v as PlanTier }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('superAdmin.companies.placeholders.selectPlan')} />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t('superAdmin.companies.fields.billingCycle')}</Label>
              <Select value={createForm.billingCycle} onValueChange={(v) => setCreateForm((p) => ({ ...p, billingCycle: v as BillingCycle }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('superAdmin.companies.placeholders.selectBillingCycle')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">{billingCycleLabel('MONTHLY')}</SelectItem>
                  <SelectItem value="YEARLY">{billingCycleLabel('YEARLY')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 sm:col-span-2 pt-2">
              <Switch checked={createForm.isPaid} onCheckedChange={(checked) => setCreateForm((p) => ({ ...p, isPaid: Boolean(checked) }))} disabled={createLoading} />
              <div>
                <div className="font-medium">{t('superAdmin.companies.fields.isPaid')}</div>
                <div className="text-xs text-muted-foreground">{t('superAdmin.companies.create.isPaidHelp')}</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void createEmpresa()} disabled={createLoading}>
              {createLoading ? t('superAdmin.companies.create.creating') : t('superAdmin.companies.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
