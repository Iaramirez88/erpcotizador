'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Clock3, Sparkles } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/components/providers/i18n-provider'
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
import type { PlanTier } from '@/lib/plans'

type BillingCycle = 'MONTHLY' | 'YEARLY'

type ModuleKey =
  | 'DASHBOARD'
  | 'COTIZADOR'
  | 'COTIZACIONES'
  | 'CLIENTES'
  | 'CRM'
  | 'MATERIALES'
  | 'INVENTARIO'
  | 'REMISIONES'
  | 'POS'
  | 'PROVEEDORES'
  | 'COMPRAS'
  | 'ORDENES'
  | 'ESCANEOS'
  | 'REPORTES'
  | 'CONTABILIDAD'
  | 'NOTIFICACIONES'
  | 'CONFIG'

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

function titleForModule(moduleKey: ModuleKey): string {
  switch (moduleKey) {
    case 'DASHBOARD':
      return 'Dashboard'
    case 'COTIZADOR':
      return 'Cotizador'
    case 'COTIZACIONES':
      return 'Cotizaciones'
    case 'CLIENTES':
      return 'Clientes'
    case 'CRM':
      return 'CRM'
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
      return 'Reportes'
    case 'CONTABILIDAD':
      return 'Contabilidad'
    case 'NOTIFICACIONES':
      return 'Notificaciones'
    case 'CONFIG':
      return 'Configuración'
    default:
      return moduleKey
  }
}

export default function SuperAdminEmpresasClient() {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')

  const billingCycleLabel = (cycle: BillingCycle) => t(`superAdmin.companies.billing.${cycle}`)
  const invoiceStatusLabel = (status: InvoiceStatus) => t(`superAdmin.companies.invoiceStatus.${status}`)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ListRow[]>([])
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('ALL')

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
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setModuleOverrides(previous)
        setModuleOverridesError(json.error || t('superAdmin.companies.errors.saveModuleOverridesFailed'))
        return
      }
    } catch (e) {
      setModuleOverrides(previous)
      setModuleOverridesError(e instanceof Error ? e.message : t('superAdmin.companies.errors.saveModuleOverridesFailed'))
    } finally {
      setModuleOverrideSavingKey(null)
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
      if (companyFilter === 'NEW') return item.isNew
      if (companyFilter === 'TRIAL') return trialActive
      if (companyFilter === 'PAID') return paidActive
      if (companyFilter === 'EXPIRED') return !trialActive && !paidActive
      return true
    })
  }, [companyFilter, items])

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
    try {
      const [detailRes, overridesRes] = await Promise.all([
        fetch(`/api/super-admin/empresas/${encodeURIComponent(id)}`, { cache: 'no-store' }),
        fetch(`/api/super-admin/empresas/${encodeURIComponent(id)}/module-overrides`, { cache: 'no-store' }),
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

      {!loading && !filtered.length ? <div className="text-sm text-gray-600">{t('common.noResults')}</div> : null}

      {!loading && filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((e) => (
            <Card key={e.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{e.nombre}</CardTitle>
                <CardDescription>
                  {t('superAdmin.companies.labels.code')}: <span className="font-mono">{e.workspaceCode}</span> · {t('superAdmin.companies.labels.nit')}: {e.nit} · {t('superAdmin.companies.labels.id')}: <span className="font-mono">{e.id}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  {t('superAdmin.companies.labels.plan')}: <b>{e.planTier}</b> · {billingCycleLabel(e.billingCycle)} · {t('superAdmin.companies.labels.validUntil')}: <b>{fmtDate(e.planValidUntil, locale, naText)}</b>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {e.isNew ? <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"><Sparkles className="h-3 w-3" />{t('superAdmin.companies.labels.newAccount')}</span> : null}
                  {isFutureDate(e.trialValidUntil) ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><Clock3 className="h-3 w-3" />{t('superAdmin.companies.labels.trialUntil')}: {fmtDate(e.trialValidUntil, locale, naText)}</span> : null}
                </div>
                <div>
                  {t('superAdmin.companies.labels.createdAt')}: <b>{fmtDate(e.createdAt, locale, naText)}</b> · {t('superAdmin.companies.labels.updatedAt')}: <b>{fmtDate(e.updatedAt, locale, naText)}</b>
                </div>
                <div>
                  {t('superAdmin.companies.labels.lastPayment')}: <b>{fmtDate(e.lastPaid?.paidAt ?? null, locale, naText)}</b> · {t('superAdmin.companies.labels.amount')}: <b>{moneyCOP(e.lastPaid?.amountCOP ?? null, locale)}</b> · {t('superAdmin.companies.labels.paymentMethod')}: <b>{e.lastPaid?.paymentMethod || naText}</b>
                </div>
                <div>
                  {t('superAdmin.companies.labels.ownerEmail')}: <b>{e.planOwnerEmail || naText}</b>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-2">
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
                  {generatedCode[e.id] ? (
                    <div className="text-xs">
                      <span className="text-muted-foreground">{t('superAdmin.companies.labels.companyId')}: </span>
                      <span className="font-mono">{generatedCode[e.id]}</span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={detailOpen} onOpenChange={(v) => (!detailLoading ? setDetailOpen(v) : null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
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
                    <div>
                      <b>{detail.nombre}</b> · {t('superAdmin.companies.labels.nit')}: {detail.nit}
                    </div>
                    <div>
                      {t('superAdmin.companies.labels.code')}: <span className="font-mono">{detail.workspaceCode}</span> · {t('superAdmin.companies.labels.id')}: <span className="font-mono">{detail.id}</span>
                    </div>
                    <div>
                      {t('superAdmin.companies.labels.ownerEmail')}: <b>{detail.planOwnerEmail || naText}</b>
                    </div>
                    <div>
                      {t('superAdmin.companies.fields.address')}: <b>{detail.direccion || naText}</b> · {t('superAdmin.companies.fields.phone')}: <b>{detail.telefono || naText}</b> · {t('superAdmin.companies.fields.whatsapp')}: <b>{detail.whatsapp || naText}</b>
                    </div>
                    <div>
                      {t('superAdmin.companies.fields.companyEmail')}: <b>{detail.email || naText}</b>
                    </div>
                    <div>
                      {t('superAdmin.companies.labels.createdAt')}: <b>{fmtDate(detail.createdAt, locale, naText)}</b> · {t('superAdmin.companies.labels.updatedAt')}: <b>{fmtDate(detail.updatedAt, locale, naText)}</b>
                    </div>
                    <div>
                      {t('superAdmin.companies.labels.plan')}: <b>{detail.planTier}</b> · {billingCycleLabel(detail.billingCycle)} · {t('superAdmin.companies.labels.validUntil')}: <b>{fmtDate(detail.planValidUntil, locale, naText)}</b>
                    </div>
                    <div>
                      {t('superAdmin.companies.labels.trialUntil')}: <b>{fmtDate(detail.trialValidUntil, locale, naText)}</b> · Trial tier: <b>{detail.trialTier || naText}</b>
                    </div>
                    <div>
                      {t('superAdmin.companies.labels.stripe')}: {detail.stripeSubscriptionStatus || naText} · {t('superAdmin.companies.labels.periodEnd')}: {fmtDate(detail.stripeCurrentPeriodEnd, locale, naText)}
                    </div>

                    <div className="space-y-2 rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{t('superAdmin.companies.labels.moduleOverrides')}</div>
                        <div className="text-xs text-muted-foreground">
                          {t('superAdmin.companies.fields.moduleOverridesHelp')} {moduleOverrides.length ? `(${moduleOverridesPlanTier})` : ''}
                        </div>
                      </div>
                      {moduleOverridesError ? <div className="text-xs text-red-600">{moduleOverridesError}</div> : null}
                      {moduleOverridesLoading ? <div className="text-xs text-muted-foreground">{t('common.loading')}</div> : null}
                      {!moduleOverridesLoading ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {moduleOverrides.map((row) => {
                            const selectValue = row.overrideEnabled == null ? 'inherit' : row.overrideEnabled ? 'enabled' : 'disabled'
                            const statusLabel = row.overrideEnabled == null
                              ? t('superAdmin.companies.labels.inherited')
                              : row.overrideEnabled
                                ? t('superAdmin.companies.labels.forceEnabled')
                                : t('superAdmin.companies.labels.forceDisabled')

                            return (
                              <div key={row.module} className="rounded-md border p-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-medium leading-none">{titleForModule(row.module)}</div>
                                    <div className="mt-1 text-[11px] text-muted-foreground">{row.module}</div>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">{statusLabel}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <Select
                                    value={selectValue}
                                    onValueChange={(value) => void saveModuleOverride(row.module, value as 'inherit' | 'enabled' | 'disabled')}
                                    disabled={moduleOverrideSavingKey === row.module}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="inherit">{t('superAdmin.companies.labels.inherited')}</SelectItem>
                                      <SelectItem value="enabled">{t('superAdmin.companies.labels.forceEnabled')}</SelectItem>
                                      <SelectItem value="disabled">{t('superAdmin.companies.labels.forceDisabled')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <span className={`text-[11px] font-medium ${row.effectiveEnabled ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {row.effectiveEnabled ? 'ON' : 'OFF'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
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
