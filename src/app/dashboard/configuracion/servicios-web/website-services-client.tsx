"use client"

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Globe, HardDrive, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'

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
  loginPassword: string | null
  contactName: string | null
  contactPhone: string | null
  notes: string | null
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
  notes: string
}

const EMPTY_FORM: ServiceForm = {
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
  notes: '',
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
  if (info.kind === 'warning') return `Vence en ${info.days ?? 0} días`
  return `Vence en ${info.days ?? 0} días`
}

function expiryBadgeClass(info: ExpiryInfo) {
  if (info.kind === 'expired') return 'bg-rose-100 text-rose-800 border-rose-200'
  if (info.kind === 'warning') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (info.kind === 'ok') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export default function WebsiteServicesClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [services, setServices] = useState<WebsiteServiceItem[]>([])
  const [summary, setSummary] = useState<WebsiteServicesResponse['summary'] | null>(null)
  const [alerts, setAlerts] = useState<NonNullable<WebsiteServicesResponse['alerts']>>([])
  const [canManageAssignments, setCanManageAssignments] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: string; name: string | null; email: string | null; role: string }>>([])
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [editing, setEditing] = useState<WebsiteServiceItem | null>(null)
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/servicios-web', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as WebsiteServicesResponse | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo cargar la vista de servicios web.')
        return
      }

      setServices(json.items ?? [])
      setSummary(json.summary ?? null)
      setAlerts(json.alerts ?? [])
      setCanManageAssignments(Boolean(json.access?.canManageAssignments))

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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [search, services])

  function openCreateDialog() {
    setEditing(null)
    setForm(EMPTY_FORM)
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
      loginPassword: item.loginPassword ?? '',
      contactName: item.contactName ?? '',
      contactPhone: item.contactPhone ?? '',
      notes: item.notes ?? '',
    })
    setDialogOpen(true)
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
      setForm(EMPTY_FORM)
      setEditing(null)
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
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Centraliza fecha de creación, dominio, hosting, URL, alojamiento, valor vendido, estado de pago, credenciales y contactos en una sola pantalla privada.</p>
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

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <Card className="rounded-[26px] border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle>Servicios centralizados</CardTitle>
            <CardDescription>Busca por nombre, dominio, URL, hosting o contacto.</CardDescription>
            <div className="pt-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar servicio, dominio, URL o contacto..." className="rounded-xl" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-5">
            {loading ? <p className="text-sm text-slate-500">Cargando servicios web...</p> : null}
            {!loading && filteredServices.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">No hay servicios registrados con ese filtro.</p> : null}
            {filteredServices.map((item) => {
              const showPassword = Boolean(visiblePasswords[item.id])
              return (
                <div key={item.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-950">{item.nombre}</h3>
                        {item.isPaid ? <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Pagado</span> : <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Pendiente</span>}
                        {item.isCancelled ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Cancelado</span> : null}
                      </div>
                      <p className="text-sm text-slate-600">{item.descripcion || 'Sin descripción comercial.'}</p>
                      <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-3">
                        <div><span className="font-medium text-slate-900">URL:</span> {item.websiteUrl ? <a href={item.websiteUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline underline-offset-4">{item.websiteUrl}</a> : 'Sin URL'}</div>
                        <div><span className="font-medium text-slate-900">Dominio:</span> {item.domainName || 'Sin dominio'}</div>
                        <div><span className="font-medium text-slate-900">Alojado en:</span> {item.hostedAt || 'Sin dato'}</div>
                        <div><span className="font-medium text-slate-900">Creado:</span> {formatDate(item.startedAt)}</div>
                        <div><span className="font-medium text-slate-900">Valor vendido:</span> {formatCurrency(item.soldAmount || 0)}</div>
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
                        <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setVisiblePasswords((current) => ({ ...current, [item.id]: !current[item.id] }))}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-900">Usuario:</span> {item.loginUsername || 'Sin usuario'}</p>
                      <p className="mt-1 break-all text-sm text-slate-600"><span className="font-medium text-slate-900">Contraseña:</span> {showPassword ? (item.loginPassword || 'Sin contraseña') : '••••••••'}</p>
                    </div>
                  </div>

                  {item.notes ? <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><span className="font-medium text-slate-900">Notas:</span> {item.notes}</div> : null}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-amber-600" /> Alertas de vencimiento</CardTitle>
              <CardDescription>Dominios y hosting que ya vencieron o que vencen en los próximos 30 días.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
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
            </CardContent>
          </Card>

          {canManageAssignments ? (
            <Card className="rounded-[26px] border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle>Usuarios con acceso al módulo</CardTitle>
                <CardDescription>Solo el superusuario puede asignar quién más puede ver y usar esta vista.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
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
                <Button className="w-full rounded-xl" onClick={() => void saveAccessUsers()} disabled={savingAccess}>
                  {savingAccess ? 'Guardando acceso...' : 'Guardar accesos'}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar servicio web' : 'Nuevo servicio web'}</DialogTitle>
            <DialogDescription>Registra dominio, hosting, URL, estado comercial, credenciales y datos de contacto en una sola ficha.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-2 md:grid-cols-2">
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
              <Input value={form.loginPassword} onChange={(e) => setForm((current) => ({ ...current, loginPassword: e.target.value }))} placeholder="Contraseña cifrada al guardar" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveService()} disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear servicio'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}