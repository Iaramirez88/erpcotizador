'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

type PlanTier = 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'

type BillingCycle = 'MONTHLY' | 'YEARLY'

type InvoiceStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED' | 'FAILED'

type ListRow = {
  id: string
  workspaceCode: string
  nombre: string
  nit: string
  email: string | null
  planTier: PlanTier
  billingCycle: BillingCycle
  planValidUntil: string | null
  stripeSubscriptionStatus: string | null
  stripeCurrentPeriodEnd: string | null
  createdAt: string
  updatedAt: string
  hasCompanyCode: boolean
  lastPaid: null | { paidAt: string | null; amountCOP: number; status: InvoiceStatus }
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

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function moneyCOP(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
  } catch {
    return String(n)
  }
}

const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'BASIC', label: 'BASIC' },
  { value: 'MEDIO', label: 'MEDIO' },
  { value: 'INTERMEDIO', label: 'INTERMEDIO' },
  { value: 'FULL', label: 'FULL' },
]

const BILLING_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'YEARLY', label: 'Anual' },
]

export default function SuperAdminEmpresasClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ListRow[]>([])
  const [search, setSearch] = useState('')

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
    isPaid: false,
    isPaidTouched: false,
  })

  const [generatingForId, setGeneratingForId] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState<Record<string, string>>({})

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
        setError(('error' in json && json.error) || 'No se pudo cargar')
        return
      }
      setItems(json.items)
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => items, [items])

  async function openDetail(id: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    setEditMode(false)
    setEditError(null)
    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as DetailResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setDetailError(('error' in json && json.error) || 'No se pudo cargar')
        return
      }
      setDetail(json.empresa)

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
        isPaid: Boolean(json.empresa.planValidUntil && new Date(json.empresa.planValidUntil) > new Date()),
        isPaidTouched: false,
      })
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setDetailLoading(false)
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
        setCreateError(json.error || 'No se pudo crear la empresa')
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
      setCreateError(e instanceof Error ? e.message : 'Error inesperado')
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
      }
      if (editForm.isPaidTouched) payload.isPaid = editForm.isPaid

      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(detail.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setEditError(json.error || 'No se pudo guardar')
        return
      }
      setEditMode(false)
      await load()
      await openDetail(detail.id)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Error inesperado')
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
        setError(json.error || 'No se pudo generar el código')
        return
      }
      setGeneratedCode((prev) => ({ ...prev, [empresaId]: json.code! }))
      await load()
    } finally {
      setGeneratingForId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin · Empresas</h1>
          <p className="text-sm text-gray-600">Plan, vigencia, pagos y ID de empresa (EMP-...) por empresa.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setCreateOpen(true)}>Crear empresa</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/super-admin/modulos-por-plan">Módulos por plan</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/super-admin/usuarios">Usuarios</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar</CardTitle>
          <CardDescription>Filtra por nombre, NIT o ID.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SGDigital / WS-... / 900... / cuid..." className="max-w-md" />
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </CardContent>
      </Card>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-600">Cargando…</div> : null}

      {!loading && !filtered.length ? <div className="text-sm text-gray-600">Sin resultados.</div> : null}

      {!loading && filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((e) => (
            <Card key={e.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{e.nombre}</CardTitle>
                <CardDescription>
                  Código: <span className="font-mono">{e.workspaceCode}</span> · NIT: {e.nit} · ID: <span className="font-mono">{e.id}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  Plan: <b>{e.planTier}</b> · {e.billingCycle} · Vigente hasta: <b>{fmtDate(e.planValidUntil)}</b>
                </div>
                <div>
                  Creada: <b>{fmtDate(e.createdAt)}</b> · Última actualización: <b>{fmtDate(e.updatedAt)}</b>
                </div>
                <div>
                  Último pago: <b>{fmtDate(e.lastPaid?.paidAt ?? null)}</b> · Monto: <b>{moneyCOP(e.lastPaid?.amountCOP ?? null)}</b>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-2">
                  <Button variant="outline" size="sm" onClick={() => void openDetail(e.id)}>
                    Ver detalle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void generateCode(e.id)}
                    disabled={generatingForId === e.id}
                  >
                    {generatingForId === e.id ? 'Generando…' : 'Generar ID'}
                  </Button>
                  {generatedCode[e.id] ? (
                    <div className="text-xs">
                      <span className="text-muted-foreground">ID de empresa: </span>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de empresa</DialogTitle>
            <DialogDescription>Historial básico: creación, plan y facturación reciente.</DialogDescription>
          </DialogHeader>

          {detailLoading ? <div className="text-sm text-gray-600">Cargando…</div> : null}
          {detailError ? <div className="text-sm text-red-600">{detailError}</div> : null}

          {editError ? <div className="text-sm text-red-600">{editError}</div> : null}

          {detail ? (
            <div className="space-y-4 text-sm">
              {!editMode ? (
                <>
                  <div>
                    <b>{detail.nombre}</b> · NIT: {detail.nit}
                  </div>
                  <div>
                    Código: <span className="font-mono">{detail.workspaceCode}</span> · ID: <span className="font-mono">{detail.id}</span>
                  </div>
                  <div>
                    Propietario (email): <b>{detail.planOwnerEmail || '—'}</b>
                  </div>
                  <div>
                    Dirección: <b>{detail.direccion || '—'}</b> · Teléfono: <b>{detail.telefono || '—'}</b> · WhatsApp: <b>{detail.whatsapp || '—'}</b>
                  </div>
                  <div>
                    Email empresa: <b>{detail.email || '—'}</b>
                  </div>
                  <div>
                    Creada: <b>{fmtDate(detail.createdAt)}</b> · Actualizada: <b>{fmtDate(detail.updatedAt)}</b>
                  </div>
                  <div>
                    Plan: <b>{detail.planTier}</b> · {detail.billingCycle} · Vigencia: <b>{fmtDate(detail.planValidUntil)}</b>
                  </div>
                  <div>
                    Stripe: {detail.stripeSubscriptionStatus || '—'} · Periodo fin: {fmtDate(detail.stripeCurrentPeriodEnd)}
                  </div>

                  <div>
                    <div className="font-medium">Últimas facturas</div>
                    {detail.billingInvoices.length ? (
                      <div className="space-y-1">
                        {detail.billingInvoices.map((inv) => (
                          <div key={inv.id} className="border rounded-md p-2">
                            <div>
                              {inv.status} · {moneyCOP(inv.amountCOP)} · Pagada: <b>{fmtDate(inv.paidAt)}</b>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Ref: {inv.externalReference} · Creada: {fmtDate(inv.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Sin facturas registradas.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nombre</Label>
                    <Input value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>NIT</Label>
                    <Input value={editForm.nit} onChange={(e) => setEditForm((p) => ({ ...p, nit: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Dirección</Label>
                    <Input value={editForm.direccion} onChange={(e) => setEditForm((p) => ({ ...p, direccion: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono</Label>
                    <Input value={editForm.telefono} onChange={(e) => setEditForm((p) => ({ ...p, telefono: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>WhatsApp</Label>
                    <Input value={editForm.whatsapp} onChange={(e) => setEditForm((p) => ({ ...p, whatsapp: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email empresa</Label>
                    <Input value={editForm.companyEmail} onChange={(e) => setEditForm((p) => ({ ...p, companyEmail: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Logo (URL)</Label>
                    <Input value={editForm.logo} onChange={(e) => setEditForm((p) => ({ ...p, logo: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Owner email</Label>
                    <Input value={editForm.planOwnerEmail} onChange={(e) => setEditForm((p) => ({ ...p, planOwnerEmail: e.target.value }))} placeholder="owner@empresa.com" />
                  </div>

                  <div className="space-y-1">
                    <Label>Plan</Label>
                    <Select value={editForm.planTier} onValueChange={(v) => setEditForm((p) => ({ ...p, planTier: v as PlanTier }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona plan" />
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
                    <Label>Ciclo</Label>
                    <Select value={editForm.billingCycle} onValueChange={(v) => setEditForm((p) => ({ ...p, billingCycle: v as BillingCycle }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona ciclo" />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <div className="font-medium">Ya pagó</div>
                      <div className="text-xs text-muted-foreground">Si lo activas, la vigencia se recalcula desde hoy (según ciclo).</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            {!editMode ? (
              <>
                <Button variant="outline" onClick={() => setDetailOpen(false)} disabled={detailLoading}>
                  Cerrar
                </Button>
                <Button onClick={() => setEditMode(true)} disabled={detailLoading || !detail}>
                  Editar
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
                  Cancelar
                </Button>
                <Button onClick={() => void saveEmpresaEdits()} disabled={editLoading}>
                  {editLoading ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(v) => (!createLoading ? setCreateOpen(v) : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear empresa</DialogTitle>
            <DialogDescription>Registro administrable desde SuperAdmin.</DialogDescription>
          </DialogHeader>

          {createError ? <div className="text-sm text-red-600">{createError}</div> : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={createForm.nombre} onChange={(e) => setCreateForm((p) => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>NIT</Label>
              <Input value={createForm.nit} onChange={(e) => setCreateForm((p) => ({ ...p, nit: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input value={createForm.direccion} onChange={(e) => setCreateForm((p) => ({ ...p, direccion: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={createForm.telefono} onChange={(e) => setCreateForm((p) => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <Input value={createForm.whatsapp} onChange={(e) => setCreateForm((p) => ({ ...p, whatsapp: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email empresa</Label>
              <Input value={createForm.companyEmail} onChange={(e) => setCreateForm((p) => ({ ...p, companyEmail: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Logo (URL)</Label>
              <Input value={createForm.logo} onChange={(e) => setCreateForm((p) => ({ ...p, logo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Owner email</Label>
              <Input value={createForm.planOwnerEmail} onChange={(e) => setCreateForm((p) => ({ ...p, planOwnerEmail: e.target.value }))} placeholder="owner@empresa.com" />
            </div>

            <div className="space-y-1">
              <Label>Plan inicial</Label>
              <Select value={createForm.planTier} onValueChange={(v) => setCreateForm((p) => ({ ...p, planTier: v as PlanTier }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona plan" />
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
              <Label>Ciclo</Label>
              <Select value={createForm.billingCycle} onValueChange={(v) => setCreateForm((p) => ({ ...p, billingCycle: v as BillingCycle }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 sm:col-span-2 pt-2">
              <Switch checked={createForm.isPaid} onCheckedChange={(checked) => setCreateForm((p) => ({ ...p, isPaid: Boolean(checked) }))} disabled={createLoading} />
              <div>
                <div className="font-medium">Ya pagó</div>
                <div className="text-xs text-muted-foreground">Si está activo, se setea la vigencia (mensual/anual) desde hoy.</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancelar
            </Button>
            <Button onClick={() => void createEmpresa()} disabled={createLoading}>
              {createLoading ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
