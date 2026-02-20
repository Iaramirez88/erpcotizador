'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  nombre: string
  nit: string
  direccion: string | null
  telefono: string | null
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

export default function SuperAdminEmpresasClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ListRow[]>([])
  const [search, setSearch] = useState('')

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailEmpresa | null>(null)

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
    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as DetailResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setDetailError(('error' in json && json.error) || 'No se pudo cargar')
        return
      }
      setDetail(json.empresa)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setDetailLoading(false)
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
          <p className="text-sm text-gray-600">Plan, vigencia, pagos y código de acceso por empresa.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
                    {generatingForId === e.id ? 'Generando…' : 'Generar código'}
                  </Button>
                  {generatedCode[e.id] ? (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Código: </span>
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

          {detail ? (
            <div className="space-y-2 text-sm">
              <div>
                <b>{detail.nombre}</b> · NIT: {detail.nit}
              </div>
              <div>
                Código: <span className="font-mono">{detail.workspaceCode}</span> · ID: <span className="font-mono">{detail.id}</span>
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

              <div className="pt-2">
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
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)} disabled={detailLoading}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
