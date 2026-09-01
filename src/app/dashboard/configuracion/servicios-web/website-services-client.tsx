"use client"

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, Eye, EyeOff, FileText, Globe, HardDrive, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import {
  createWebsiteServiceFieldId,
  formatWebsiteServiceAttachmentSize,
  normalizeWebsiteServiceCustomFields,
  websiteServiceAttachmentAccept,
  type WebsiteServiceAttachment,
  type WebsiteServiceCustomField,
  type WebsiteServiceCustomFieldType,
} from '@/lib/website-service-fields'
import { cn, formatCurrency } from '@/lib/utils'

type ExpiryInfo = {
  kind: 'none' | 'ok' | 'warning' | 'expired'
  days: number | null
}

type WebsiteServiceItem = {
  id: string
  nombre: string
  descripcion: string | null
  websiteUrl: string | null
  domainName: string | null
  hostedAt: string | null
  startedAt: string | null
  domainExpiresAt: string | null
  hostingExpiresAt: string | null
  soldAmount: number
  isPaid: boolean
  isCancelled: boolean
  loginUsername: string | null
  hasPassword: boolean
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  notes: string | null
  customFieldsJson: WebsiteServiceCustomField[]
  createdAt: string
  updatedAt: string
  createdByUser: { id: string; name: string | null; email: string | null } | null
  updatedByUser: { id: string; name: string | null; email: string | null } | null
  domainExpiry: ExpiryInfo
  hostingExpiry: ExpiryInfo
}

type WebsiteServicesResponse = {
  ok: boolean
  error?: string
  access?: {
    canAccess: boolean
    canManageAssignments: boolean
    isSuperAdmin: boolean
  }
  summary?: {
    total: number
    paid: number
    cancelled: number
    domainDueSoon: number
    hostingDueSoon: number
    expiredDomains: number
    expiredHosting: number
  }
  alerts?: Array<{
    serviceId: string
    serviceName: string
    kind: 'DOMAIN' | 'HOSTING'
    status: 'warning' | 'expired'
    days: number
    dueDate: string
  }>
  items?: WebsiteServiceItem[]
}

type AccessUsersResponse = {
  ok: boolean
  error?: string
  assignedUserIds?: string[]
  users?: Array<{ id: string; name: string | null; email: string | null; role: string }>
}

type ServiceForm = {
  nombre: string
  descripcion: string
  websiteUrl: string
  domainName: string
  hostedAt: string
  startedAt: string
  domainExpiresAt: string
  hostingExpiresAt: string
  soldAmount: string
  isPaid: boolean
  isCancelled: boolean
  loginUsername: string
  loginPassword: string
  contactName: string
  contactPhone: string
  contactEmail: string
  notes: string
  customFieldsJson: WebsiteServiceCustomField[]
}

type CustomFieldDraft = {
  label: string
  type: WebsiteServiceCustomFieldType
  textValue: string
  file: WebsiteServiceAttachment | null
}

type ExpirySortOrder = 'default' | 'asc' | 'desc'

function createEmptyForm(): ServiceForm {
  return {
    nombre: '',
    descripcion: '',
    websiteUrl: '',
    domainName: '',
    hostedAt: '',
    startedAt: '',
    domainExpiresAt: '',
    hostingExpiresAt: '',
    soldAmount: '',
    isPaid: false,
    isCancelled: false,
    loginUsername: '',
    loginPassword: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
    customFieldsJson: [],
  }
}

function createEmptyFieldDraft(): CustomFieldDraft {
  return {
    label: '',
    type: 'TEXT',
    textValue: '',
    file: null,
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function toDateInput(value: string | null | undefined) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function expiryLabel(info: ExpiryInfo) {
  if (info.kind === 'none') return 'Sin fecha'
  if (info.kind === 'expired') return `Vencido hace ${Math.abs(info.days ?? 0)} días`
  return `Vence en ${info.days ?? 0} días`
}

function expiryBadgeClass(info: ExpiryInfo) {
  if (info.kind === 'expired') return 'bg-rose-100 text-rose-800 border-rose-200'
  if (info.kind === 'warning') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (info.kind === 'ok') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function normalizeServiceItem(item: WebsiteServiceItem): WebsiteServiceItem {
  return {
    ...item,
    customFieldsJson: normalizeWebsiteServiceCustomFields(item.customFieldsJson),
  }
}

function fieldSummary(field: WebsiteServiceCustomField) {
  if (field.type === 'TEXT') return field.textValue || 'Sin valor'
  return field.file?.name || 'Sin archivo'
}

function renderFieldValue(field: WebsiteServiceCustomField) {
  if (field.type === 'TEXT') {
    return <p className="text-sm text-slate-600">{field.textValue || 'Sin valor'}</p>
  }

  if (!field.file) {
    return <p className="text-sm text-slate-400">Sin archivo</p>
  }

  return (
    <div className="space-y-2">
      {field.file.type === 'image' ? (
        <div className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <Image src={field.file.url} alt={field.file.name} fill className="object-cover" unoptimized sizes="240px" />
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
          <FileText className="h-6 w-6" />
        </div>
      )}
      <a href={field.file.url} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">
        {field.file.name}
      </a>
      <p className="text-xs text-slate-500">{formatWebsiteServiceAttachmentSize(field.file.sizeBytes)}</p>
    </div>
  )
}

function getServiceNextExpiryTimestamp(item: WebsiteServiceItem) {
  const timestamps = [item.domainExpiresAt, item.hostingExpiresAt]
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => Number.isFinite(value))

  if (timestamps.length === 0) return null
  return Math.min(...timestamps)
}

function getNextExpirySortLabel(order: ExpirySortOrder) {
  if (order === 'asc') return 'Más próximos primero'
  if (order === 'desc') return 'Más lejanos primero'
  return 'Orden normal'
}

export default function WebsiteServicesClient() {
  const { mode: dataViewMode, setMode: setDataViewMode } = useDataViewMode('website-services.history', 'list')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expirySortOrder, setExpirySortOrder] = useState<ExpirySortOrder>('default')
  const [services, setServices] = useState<WebsiteServiceItem[]>([])
  const [summary, setSummary] = useState<WebsiteServicesResponse['summary'] | null>(null)
  const [alerts, setAlerts] = useState<NonNullable<WebsiteServicesResponse['alerts']>>([])
  const [canManageAssignments, setCanManageAssignments] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: string; name: string | null; email: string | null; role: string }>>([])
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [editing, setEditing] = useState<WebsiteServiceItem | null>(null)
  const [form, setForm] = useState<ServiceForm>(createEmptyForm())
  const [customFieldDraft, setCustomFieldDraft] = useState<CustomFieldDraft>(createEmptyFieldDraft())
  const [customFieldUploadTarget, setCustomFieldUploadTarget] = useState<string | 'new' | null>(null)
  const [uploadingFieldFile, setUploadingFieldFile] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [revealDialogOpen, setRevealDialogOpen] = useState(false)
  const [serviceToReveal, setServiceToReveal] = useState<WebsiteServiceItem | null>(null)
  const [userPasswordConfirmation, setUserPasswordConfirmation] = useState('')
  const [revealingPasswordId, setRevealingPasswordId] = useState<string | null>(null)
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false)
  const [accessDialogOpen, setAccessDialogOpen] = useState(false)
  const customFieldFileInputRef = useRef<HTMLInputElement | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/servicios-web', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as WebsiteServicesResponse | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo cargar la vista de sitios web.')
        return
      }

      setServices((json.items ?? []).map(normalizeServiceItem))
      setSummary(json.summary ?? null)
      setAlerts(json.alerts ?? [])
      setCanManageAssignments(Boolean(json.access?.canManageAssignments))
      setRevealedPasswords({})

      if (json.access?.canManageAssignments) {
        const accessRes = await fetch('/api/servicios-web/access', { cache: 'no-store' })
        const accessJson = (await accessRes.json().catch(() => null)) as AccessUsersResponse | null
        if (accessRes.ok && accessJson?.ok) {
          setAssignableUsers(accessJson.users ?? [])
          setAssignedUserIds(accessJson.assignedUserIds ?? [])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return services
    return services.filter((item) => {
      const haystack = [
        item.nombre,
        item.websiteUrl,
        item.domainName,
        item.hostedAt,
        item.contactName,
        item.contactPhone,
        item.contactEmail,
        ...item.customFieldsJson.map((field) => `${field.label} ${fieldSummary(field)}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [search, services])

  const visibleServices = useMemo(() => {
    if (expirySortOrder === 'default') return filteredServices

    const sorted = [...filteredServices]
    sorted.sort((left, right) => {
      const leftExpiry = getServiceNextExpiryTimestamp(left)
      const rightExpiry = getServiceNextExpiryTimestamp(right)

      if (leftExpiry === null && rightExpiry === null) return left.nombre.localeCompare(right.nombre)
      if (leftExpiry === null) return 1
      if (rightExpiry === null) return -1

      return expirySortOrder === 'asc' ? leftExpiry - rightExpiry : rightExpiry - leftExpiry
    })

    return sorted
  }, [expirySortOrder, filteredServices])

  function cycleExpirySortOrder() {
    setExpirySortOrder((current) => {
      if (current === 'default') return 'asc'
      if (current === 'asc') return 'desc'
      return 'default'
    })
  }

  function resetDialogState() {
    setCustomFieldDraft(createEmptyFieldDraft())
    setCustomFieldUploadTarget(null)
  }

  function openCreateDialog() {
    setEditing(null)
    setForm(createEmptyForm())
    resetDialogState()
    setDialogOpen(true)
  }

  function openEditDialog(item: WebsiteServiceItem) {
    setEditing(item)
    setForm({
      nombre: item.nombre ?? '',
      descripcion: item.descripcion ?? '',
      websiteUrl: item.websiteUrl ?? '',
      domainName: item.domainName ?? '',
      hostedAt: item.hostedAt ?? '',
      startedAt: toDateInput(item.startedAt),
      domainExpiresAt: toDateInput(item.domainExpiresAt),
      hostingExpiresAt: toDateInput(item.hostingExpiresAt),
      soldAmount: String(item.soldAmount ?? ''),
      isPaid: Boolean(item.isPaid),
      isCancelled: Boolean(item.isCancelled),
      loginUsername: item.loginUsername ?? '',
      loginPassword: '',
      contactName: item.contactName ?? '',
      contactPhone: item.contactPhone ?? '',
      contactEmail: item.contactEmail ?? '',
      notes: item.notes ?? '',
      customFieldsJson: normalizeWebsiteServiceCustomFields(item.customFieldsJson),
    })
    resetDialogState()
    setDialogOpen(true)
  }

  function requestRevealPassword(item: WebsiteServiceItem) {
    if (revealedPasswords[item.id] !== undefined) {
      setRevealedPasswords((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      return
    }

    setServiceToReveal(item)
    setUserPasswordConfirmation('')
    setRevealDialogOpen(true)
  }

  async function confirmRevealPassword() {
    if (!serviceToReveal) return
    if (!userPasswordConfirmation.trim()) {
      alert('Debes escribir tu contraseña de usuario para revelar la clave guardada.')
      return
    }

    setRevealingPasswordId(serviceToReveal.id)
    try {
      const res = await fetch(`/api/servicios-web/${serviceToReveal.id}/reveal-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPassword: userPasswordConfirmation }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; password?: string | null } | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo revelar la contraseña guardada.')
        return
      }

      setRevealedPasswords((current) => ({ ...current, [serviceToReveal.id]: json.password ?? '' }))
      setRevealDialogOpen(false)
      setServiceToReveal(null)
      setUserPasswordConfirmation('')
    } finally {
      setRevealingPasswordId(null)
    }
  }

  async function uploadCustomFieldFile(file: File) {
    setUploadingFieldFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/servicios-web/uploads', {
        method: 'POST',
        body: formData,
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: WebsiteServiceAttachment } | null
      if (!res.ok || !json?.ok || !json.data) {
        alert(json?.error || 'No se pudo subir el archivo del campo.')
        return null
      }

      return json.data
    } finally {
      setUploadingFieldFile(false)
    }
  }

  async function handleCustomFieldFile(file: File | null) {
    if (!file) return
    const uploaded = await uploadCustomFieldFile(file)
    if (!uploaded) return

    if (!customFieldUploadTarget || customFieldUploadTarget === 'new') {
      setCustomFieldDraft((current) => ({ ...current, type: 'FILE', file: uploaded }))
      setCustomFieldUploadTarget(null)
      return
    }

    setForm((current) => ({
      ...current,
      customFieldsJson: current.customFieldsJson.map((field) => (
        field.id === customFieldUploadTarget ? { ...field, type: 'FILE', file: uploaded, textValue: null } : field
      )),
    }))
    setCustomFieldUploadTarget(null)
  }

  function addCustomField() {
    const label = customFieldDraft.label.trim()
    if (!label) {
      alert('El campo especial debe tener un nombre.')
      return
    }
    if (customFieldDraft.type === 'FILE' && !customFieldDraft.file) {
      alert('Sube el archivo o imagen para este campo especial.')
      return
    }

    setForm((current) => ({
      ...current,
      customFieldsJson: [
        ...current.customFieldsJson,
        {
          id: createWebsiteServiceFieldId('field'),
          label,
          type: customFieldDraft.type,
          textValue: customFieldDraft.type === 'TEXT' ? customFieldDraft.textValue.trim() || null : null,
          file: customFieldDraft.type === 'FILE' ? customFieldDraft.file : null,
        },
      ],
    }))
    setCustomFieldDraft(createEmptyFieldDraft())
  }

  async function saveService() {
    if (!form.nombre.trim()) {
      alert('El nombre del servicio es obligatorio.')
      return
    }

    setSaving(true)
    try {
      const target = editing ? `/api/servicios-web/${editing.id}` : '/api/servicios-web'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(target, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo guardar el servicio web.')
        return
      }
      setDialogOpen(false)
      setForm(createEmptyForm())
      setEditing(null)
      resetDialogState()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deleteService(item: WebsiteServiceItem) {
    if (!window.confirm(`Se eliminará el servicio web ${item.nombre}. Esta acción no se puede deshacer.`)) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/servicios-web/${item.id}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo eliminar el servicio web.')
        return
      }
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  async function saveAccessUsers() {
    setSavingAccess(true)
    try {
      const res = await fetch('/api/servicios-web/access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: assignedUserIds }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo guardar el acceso del módulo.')
        return
      }
      await load()
    } finally {
      setSavingAccess(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#fffdf8_0%,_#f4fbff_55%,_#eef8f1_100%)] p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Vista privada</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Servicios de páginas web</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Centraliza dominios, hosting, credenciales, contactos y ahora también campos especiales por servicio en una sola pantalla privada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar
          </Button>
          <Button className="rounded-xl" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo servicio
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Total</div><div className="mt-2 text-2xl font-semibold text-slate-950">{summary?.total ?? 0}</div></CardContent></Card>
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Pagados</div><div className="mt-2 text-2xl font-semibold text-emerald-700">{summary?.paid ?? 0}</div></CardContent></Card>
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Cancelados</div><div className="mt-2 text-2xl font-semibold text-slate-700">{summary?.cancelled ?? 0}</div></CardContent></Card>
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Dominios por vencer</div><div className="mt-2 text-2xl font-semibold text-amber-700">{summary?.domainDueSoon ?? 0}</div></CardContent></Card>
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Hosting por vencer</div><div className="mt-2 text-2xl font-semibold text-amber-700">{summary?.hostingDueSoon ?? 0}</div></CardContent></Card>
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Vencidos</div><div className="mt-2 text-2xl font-semibold text-rose-700">{(summary?.expiredDomains ?? 0) + (summary?.expiredHosting ?? 0)}</div></CardContent></Card>
      </div>

      <Card className="rounded-[26px] border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Servicios centralizados</CardTitle>
                <CardDescription>Busca por nombre, dominio, URL, hosting, contacto o campos especiales.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <DataViewToggle mode={dataViewMode} onChange={setDataViewMode} />
                <Button variant="outline" className="rounded-xl" onClick={() => setAlertsDialogOpen(true)}>
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
                  Alertas
                  {alerts.length ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{alerts.length}</span> : null}
                </Button>
                {canManageAssignments ? (
                  <Button variant="outline" className="rounded-xl" onClick={() => setAccessDialogOpen(true)}>
                    <ShieldCheck className="mr-2 h-4 w-4 text-sky-700" />
                    Usuarios de acceso
                    <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">{assignedUserIds.length}</span>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="pt-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar servicio, dominio, URL, contacto o campo..." className="rounded-xl" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-5">
            {loading ? <p className="text-sm text-slate-500">Cargando sitios web...</p> : null}
            {!loading && visibleServices.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">No hay servicios registrados con ese filtro.</p> : null}

            {!loading && visibleServices.length > 0 && dataViewMode === 'grid' ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {visibleServices.map((item) => {
                  const revealedPassword = revealedPasswords[item.id]
                  const showPassword = revealedPassword !== undefined
                  return (
                    <div key={item.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 shadow-sm">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-950">{item.nombre}</h3>
                            <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', item.isPaid ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : 'border-amber-200 bg-amber-100 text-amber-800')}>
                              {item.isPaid ? 'Pagado' : 'Pendiente'}
                            </span>
                            {item.isCancelled ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Cancelado</span> : null}
                          </div>
                          <p className="line-clamp-2 text-sm text-slate-600">{item.descripcion || 'Sin descripción comercial.'}</p>
                          <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                            <div><span className="font-medium text-slate-900">URL:</span> {item.websiteUrl ? <a href={item.websiteUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline underline-offset-4">{item.websiteUrl}</a> : 'Sin URL'}</div>
                            <div><span className="font-medium text-slate-900">Dominio:</span> {item.domainName || 'Sin dominio'}</div>
                            <div><span className="font-medium text-slate-900">Hosting:</span> {item.hostedAt || 'Sin dato'}</div>
                            <div><span className="font-medium text-slate-900">Valor:</span> {formatCurrency(item.soldAmount || 0)}</div>
                            <div><span className="font-medium text-slate-900">Creado:</span> {formatDate(item.startedAt)}</div>
                            <div><span className="font-medium text-slate-900">Contacto:</span> {item.contactName || 'Sin contacto'}{item.contactPhone ? ` · ${item.contactPhone}` : ''}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <Button variant="outline" className="rounded-xl" onClick={() => openEditDialog(item)}>Editar</Button>
                          <Button variant="outline" className="rounded-xl text-rose-700 hover:text-rose-800" onClick={() => void deleteService(item)} disabled={deletingId === item.id}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingId === item.id ? 'Eliminando...' : 'Eliminar'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Globe className="h-4 w-4 text-sky-700" /> Dominio</div>
                          <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${expiryBadgeClass(item.domainExpiry)}`}>{expiryLabel(item.domainExpiry)}</div>
                          <p className="mt-2 text-sm text-slate-600">Fecha: {formatDate(item.domainExpiresAt)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><HardDrive className="h-4 w-4 text-sky-700" /> Hosting</div>
                          <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${expiryBadgeClass(item.hostingExpiry)}`}>{expiryLabel(item.hostingExpiry)}</div>
                          <p className="mt-2 text-sm text-slate-600">Fecha: {formatDate(item.hostingExpiresAt)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-sky-700" /> Credenciales</span>
                            <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => requestRevealPassword(item)} disabled={!item.hasPassword || revealingPasswordId === item.id}>
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-900">Usuario:</span> {item.loginUsername || 'Sin usuario'}</p>
                          <p className="mt-1 break-all text-sm text-slate-600"><span className="font-medium text-slate-900">Contraseña:</span> {!item.hasPassword ? 'Sin contraseña' : showPassword ? (revealedPassword || 'Sin contraseña') : '••••••••'}</p>
                        </div>
                      </div>

                      {item.customFieldsJson.length ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">Campos especiales</p>
                            <span className="text-xs text-slate-500">{item.customFieldsJson.length} elemento(s)</span>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {item.customFieldsJson.slice(0, 4).map((field) => (
                              <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</p>
                                <div className="mt-2">{renderFieldValue(field)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {item.notes ? <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><span className="font-medium text-slate-900">Notas:</span> {item.notes}</div> : null}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {!loading && visibleServices.length > 0 && dataViewMode === 'list' ? (
              <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 px-4 py-4 md:px-5 md:py-5">
                  <table className="min-w-[1320px] w-full bg-white">
                  <thead className="border-b border-slate-200">
                    <tr className="text-left text-sm text-slate-500">
                      <th className="px-4 pb-4 font-medium first:pl-2">Servicio</th>
                      <th className="px-4 pb-4 font-medium">Dominio y URL</th>
                      <th className="px-4 pb-4 font-medium">Hosting</th>
                      <th className="px-4 pb-4 font-medium">Fechas</th>
                      <th className="px-4 pb-4 font-medium">Contacto</th>
                      <th className="px-4 pb-4 font-medium">Campos</th>
                      <th className="px-4 pb-4 font-medium">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-1 text-left transition hover:border-slate-200 hover:bg-slate-50"
                          onClick={cycleExpirySortOrder}
                          title={getNextExpirySortLabel(expirySortOrder)}
                        >
                          <span>Estado</span>
                          {expirySortOrder === 'asc' ? <ArrowUpAZ className="h-4 w-4 text-sky-700" /> : null}
                          {expirySortOrder === 'desc' ? <ArrowDownAZ className="h-4 w-4 text-sky-700" /> : null}
                          {expirySortOrder === 'default' ? <span className="text-[11px] text-slate-400">Normal</span> : null}
                        </button>
                      </th>
                      <th className="px-4 pb-4 font-medium text-right last:pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleServices.map((item) => {
                      const revealedPassword = revealedPasswords[item.id]
                      const showPassword = revealedPassword !== undefined
                      return (
                        <tr key={item.id} className="border-b border-slate-100 align-top last:border-0">
                          <td className="px-4 py-5 pr-5 first:pl-2">
                            <div className="min-w-[220px] space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-950">{item.nombre}</p>
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', item.isPaid ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : 'border-amber-200 bg-amber-100 text-amber-800')}>
                                  {item.isPaid ? 'Pagado' : 'Pendiente'}
                                </span>
                                {item.isCancelled ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">Cancelado</span> : null}
                              </div>
                              <p className="line-clamp-2 text-sm text-slate-600">{item.descripcion || 'Sin descripción comercial.'}</p>
                              <p className="text-sm font-medium text-slate-900">{formatCurrency(item.soldAmount || 0)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-5 pr-5 text-sm text-slate-600">
                            <div className="min-w-[220px] space-y-1">
                              <p><span className="font-medium text-slate-900">Dominio:</span> {item.domainName || 'Sin dominio'}</p>
                              <p className="break-all"><span className="font-medium text-slate-900">URL:</span> {item.websiteUrl ? <a href={item.websiteUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline underline-offset-4">{item.websiteUrl}</a> : 'Sin URL'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-5 pr-5 text-sm text-slate-600">
                            <div className="min-w-[180px] space-y-1">
                              <p><span className="font-medium text-slate-900">Proveedor:</span> {item.hostedAt || 'Sin dato'}</p>
                              <p><span className="font-medium text-slate-900">Usuario:</span> {item.loginUsername || 'Sin usuario'}</p>
                              <button type="button" className="inline-flex items-center gap-2 text-sky-700 hover:text-sky-900" onClick={() => requestRevealPassword(item)} disabled={!item.hasPassword || revealingPasswordId === item.id}>
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                {!item.hasPassword ? 'Sin contraseña' : showPassword ? (revealedPassword || 'Sin contraseña') : 'Ver contraseña'}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-5 pr-5 text-sm text-slate-600">
                            <div className="min-w-[170px] space-y-1">
                              <p><span className="font-medium text-slate-900">Alta:</span> {formatDate(item.startedAt)}</p>
                              <p><span className="font-medium text-slate-900">Dominio:</span> {formatDate(item.domainExpiresAt)}</p>
                              <p><span className="font-medium text-slate-900">Hosting:</span> {formatDate(item.hostingExpiresAt)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-5 pr-5 text-sm text-slate-600">
                            <div className="min-w-[190px] space-y-1">
                              <p className="font-medium text-slate-900">{item.contactName || 'Sin contacto'}</p>
                              <p>{item.contactPhone || 'Sin teléfono'}</p>
                              <p className="break-all">{item.contactEmail || 'Sin correo'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-5 pr-5 text-sm text-slate-600">
                            <div className="min-w-[210px] space-y-2">
                              <p className="font-medium text-slate-900">{item.customFieldsJson.length} campo(s)</p>
                              {item.customFieldsJson.length ? item.customFieldsJson.slice(0, 2).map((field) => (
                                <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</p>
                                  <p className="text-sm text-slate-700">{fieldSummary(field)}</p>
                                </div>
                              )) : <p className="text-slate-400">Sin campos especiales</p>}
                            </div>
                          </td>
                          <td className="px-4 py-5 pr-5 text-sm text-slate-600">
                            <div className="min-w-[180px] space-y-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${expiryBadgeClass(item.domainExpiry)}`}>Dominio: {expiryLabel(item.domainExpiry)}</span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${expiryBadgeClass(item.hostingExpiry)}`}>Hosting: {expiryLabel(item.hostingExpiry)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-5 text-right last:pr-2">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>Editar</Button>
                              <Button variant="outline" size="sm" className="text-rose-700 hover:text-rose-800" onClick={() => void deleteService(item)} disabled={deletingId === item.id}>
                                {deletingId === item.id ? 'Eliminando...' : 'Eliminar'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
      </Card>

      <Dialog open={alertsDialogOpen} onOpenChange={setAlertsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-amber-600" /> Alertas de vencimiento</DialogTitle>
            <DialogDescription>Dominios y hosting que ya vencieron o que vencen en los próximos 30 días.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {alerts.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-500">No hay vencimientos cercanos en este momento.</p> : null}
            {alerts.map((alert) => (
              <div key={`${alert.kind}-${alert.serviceId}-${alert.dueDate}`} className={alert.status === 'expired' ? 'rounded-2xl border border-rose-200 bg-rose-50 p-3' : 'rounded-2xl border border-amber-200 bg-amber-50 p-3'}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{alert.serviceName}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-600">{alert.kind === 'DOMAIN' ? 'Dominio' : 'Hosting'}</p>
                  </div>
                  <span className={alert.status === 'expired' ? 'rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'}>
                    {alert.status === 'expired' ? `Vencido ${Math.abs(alert.days)}d` : `Vence ${alert.days}d`}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Fecha: {formatDate(alert.dueDate)}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {canManageAssignments ? (
        <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Usuarios con acceso al módulo</DialogTitle>
              <DialogDescription>Solo el superusuario puede asignar quién más puede ver y usar esta vista.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              <div className="space-y-2">
                {assignableUsers.map((user) => {
                  const selected = assignedUserIds.includes(user.id)
                  return (
                    <label key={user.id} className={selected ? 'flex cursor-pointer items-start gap-3 rounded-2xl border border-sky-300 bg-sky-50/80 p-3' : 'flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3'}>
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected}
                        onChange={(event) => {
                          setAssignedUserIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-950">{user.name || user.email || user.id}</p>
                        <p className="text-xs text-slate-500">{user.email || 'Sin correo'} · {user.role}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full rounded-xl sm:w-auto" onClick={() => void saveAccessUsers()} disabled={savingAccess}>
                {savingAccess ? 'Guardando acceso...' : 'Guardar accesos'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={(nextOpen) => {
        setDialogOpen(nextOpen)
        if (!nextOpen) resetDialogState()
      }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar servicio web' : 'Nuevo servicio web'}</DialogTitle>
            <DialogDescription>Registra dominio, hosting, URL, credenciales y también campos especiales como texto, imágenes o archivos propios del servicio.</DialogDescription>
          </DialogHeader>

          <input
            ref={customFieldFileInputRef}
            type="file"
            accept={websiteServiceAttachmentAccept()}
            className="hidden"
            onChange={(event) => {
              void handleCustomFieldFile(event.target.files?.[0] || null)
              event.currentTarget.value = ''
            }}
          />

          <div className="grid max-h-[78vh] gap-4 overflow-y-auto py-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Nombre del servicio</Label>
              <Input value={form.nombre} onChange={(e) => setForm((current) => ({ ...current, nombre: e.target.value }))} placeholder="Ejemplo: Web corporativa SGDigital" />
            </div>
            <div className="grid gap-2">
              <Label>URL del sitio</Label>
              <Input value={form.websiteUrl} onChange={(e) => setForm((current) => ({ ...current, websiteUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="grid gap-2">
              <Label>Dominio</Label>
              <Input value={form.domainName} onChange={(e) => setForm((current) => ({ ...current, domainName: e.target.value }))} placeholder="midominio.com" />
            </div>
            <div className="grid gap-2">
              <Label>Alojado en</Label>
              <Input value={form.hostedAt} onChange={(e) => setForm((current) => ({ ...current, hostedAt: e.target.value }))} placeholder="Hostinger, cPanel, DigitalOcean, VPS..." />
            </div>
            <div className="grid gap-2">
              <Label>Fecha de creación</Label>
              <Input type="date" value={form.startedAt} onChange={(e) => setForm((current) => ({ ...current, startedAt: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Valor vendido</Label>
              <Input type="number" min="0" value={form.soldAmount} onChange={(e) => setForm((current) => ({ ...current, soldAmount: e.target.value }))} placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label>Vence dominio</Label>
              <Input type="date" value={form.domainExpiresAt} onChange={(e) => setForm((current) => ({ ...current, domainExpiresAt: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Vence hosting</Label>
              <Input type="date" value={form.hostingExpiresAt} onChange={(e) => setForm((current) => ({ ...current, hostingExpiresAt: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Usuario</Label>
              <Input value={form.loginUsername} onChange={(e) => setForm((current) => ({ ...current, loginUsername: e.target.value }))} placeholder="Usuario de acceso" />
            </div>
            <div className="grid gap-2">
              <Label>Contraseña</Label>
              <Input value={form.loginPassword} onChange={(e) => setForm((current) => ({ ...current, loginPassword: e.target.value }))} placeholder={editing ? 'Escribe una nueva o déjala vacía para conservar la actual' : 'Contraseña de acceso al servicio'} />
            </div>
            <div className="grid gap-2">
              <Label>Nombre de contacto</Label>
              <Input value={form.contactName} onChange={(e) => setForm((current) => ({ ...current, contactName: e.target.value }))} placeholder="Responsable o cliente" />
            </div>
            <div className="grid gap-2">
              <Label>Número de contacto</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm((current) => ({ ...current, contactPhone: e.target.value }))} placeholder="Celular o WhatsApp" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Correo del contacto</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm((current) => ({ ...current, contactEmail: e.target.value }))} placeholder="correo@cliente.com" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm((current) => ({ ...current, descripcion: e.target.value }))} rows={2} placeholder="Qué servicio se vendió y qué incluye" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={4} placeholder="Renovaciones, observaciones, proveedor, panel de acceso, pendientes..." />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input id="website-service-paid" type="checkbox" checked={form.isPaid} onChange={(e) => setForm((current) => ({ ...current, isPaid: e.target.checked }))} />
              <Label htmlFor="website-service-paid">Servicio pagado</Label>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input id="website-service-cancelled" type="checkbox" checked={form.isCancelled} onChange={(e) => setForm((current) => ({ ...current, isCancelled: e.target.checked }))} />
              <Label htmlFor="website-service-cancelled">Servicio finalizado o cancelado por el cliente</Label>
            </div>

            <Card className="md:col-span-2 rounded-[28px] border-dashed border-slate-300 bg-slate-50/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Campos especiales</CardTitle>
                <CardDescription>Agrega datos flexibles dentro del servicio: texto, valor, una imagen, un PDF, una hoja de cálculo o cualquier archivo soportado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_160px_1fr_140px] md:items-end">
                  <div className="grid gap-2">
                    <Label>Nombre del campo</Label>
                    <Input value={customFieldDraft.label} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Ejemplo: Logo, ficha técnica, observación, acceso cPanel" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <select
                      value={customFieldDraft.type}
                      onChange={(event) => setCustomFieldDraft((current) => ({
                        ...current,
                        type: event.target.value as WebsiteServiceCustomFieldType,
                        textValue: event.target.value === 'TEXT' ? current.textValue : '',
                        file: event.target.value === 'FILE' ? current.file : null,
                      }))}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="TEXT">Texto</option>
                      <option value="FILE">Archivo o imagen</option>
                    </select>
                  </div>
                  {customFieldDraft.type === 'TEXT' ? (
                    <div className="grid gap-2">
                      <Label>Valor</Label>
                      <Input value={customFieldDraft.textValue} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, textValue: event.target.value }))} placeholder="Contenido del campo" />
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <Label>Archivo</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={() => { setCustomFieldUploadTarget('new'); customFieldFileInputRef.current?.click() }} disabled={uploadingFieldFile}>
                          {customFieldDraft.file ? 'Reemplazar archivo' : uploadingFieldFile ? 'Subiendo...' : 'Subir archivo'}
                        </Button>
                        {customFieldDraft.file ? <span className="text-xs text-slate-500">{customFieldDraft.file.name}</span> : null}
                      </div>
                    </div>
                  )}
                  <Button onClick={addCustomField}>Agregar campo</Button>
                </div>

                <div className="space-y-3">
                  {form.customFieldsJson.map((field) => (
                    <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-3 lg:grid-cols-[1fr_170px_1fr_110px] lg:items-start">
                        <div className="grid gap-2">
                          <Label>Nombre del campo</Label>
                          <Input value={field.label} onChange={(event) => setForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item) }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Tipo</Label>
                          <select
                            value={field.type}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? {
                                ...item,
                                type: event.target.value as WebsiteServiceCustomFieldType,
                                textValue: event.target.value === 'TEXT' ? item.textValue || '' : null,
                                file: event.target.value === 'FILE' ? item.file || null : null,
                              } : item),
                            }))}
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="TEXT">Texto</option>
                            <option value="FILE">Archivo o imagen</option>
                          </select>
                        </div>
                        {field.type === 'TEXT' ? (
                          <div className="grid gap-2">
                            <Label>Valor</Label>
                            <Input value={field.textValue || ''} onChange={(event) => setForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, textValue: event.target.value } : item) }))} />
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            <Label>Archivo</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="outline" onClick={() => { setCustomFieldUploadTarget(field.id); customFieldFileInputRef.current?.click() }} disabled={uploadingFieldFile}>
                                {field.file ? 'Reemplazar' : uploadingFieldFile ? 'Subiendo...' : 'Subir'}
                              </Button>
                              {field.file ? <Button variant="outline" onClick={() => setForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, file: null } : item) }))}>Quitar archivo</Button> : null}
                            </div>
                            {field.file ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                                {renderFieldValue(field)}
                              </div>
                            ) : <span className="text-sm text-slate-400">Sin archivo</span>}
                          </div>
                        )}
                        <div className="pt-0 lg:pt-7">
                          <Button variant="outline" onClick={() => setForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.filter((item) => item.id !== field.id) }))}>Quitar</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!form.customFieldsJson.length ? <p className="text-sm text-slate-400">No hay campos especiales todavía.</p> : null}
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveService()} disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear servicio'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revealDialogOpen} onOpenChange={(nextOpen) => {
        setRevealDialogOpen(nextOpen)
        if (!nextOpen) {
          setServiceToReveal(null)
          setUserPasswordConfirmation('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar contraseña de usuario</DialogTitle>
            <DialogDescription>
              {serviceToReveal ? `Para ver la contraseña guardada de ${serviceToReveal.nombre}, confirma tu contraseña de acceso al sistema.` : 'Confirma tu contraseña para continuar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="website-service-user-password">Tu contraseña</Label>
            <Input
              id="website-service-user-password"
              type="password"
              value={userPasswordConfirmation}
              onChange={(event) => setUserPasswordConfirmation(event.target.value)}
              placeholder="Contraseña de usuario"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevealDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void confirmRevealPassword()} disabled={revealingPasswordId === serviceToReveal?.id}>
              {revealingPasswordId === serviceToReveal?.id ? 'Validando...' : 'Ver contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}