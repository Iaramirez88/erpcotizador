/**
 * Página de facturación (MVP)
 * - Listar facturas
 * - Crear factura (PAID por defecto)
 * - Ver detalle básico
 * - Anular factura (si aplica)
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatUnidadMedidaLabel } from '@/lib/utils'
import { Download } from 'lucide-react'

type Bodega = {
  id: string
  nombre: string
  codigo: string | null
  isDefault: boolean
}

type Material = {
  id: string
  nombre: string
  unidadMedida: string
  precioUnidad?: number | null
  precioMetro?: number | null
  precioM2?: number | null
}

type InvoiceListItem = {
  id: string
  numero: string
  status: string
  clienteNombre: string
  total: number
  createdAt: string
  warehouse?: { id: string; nombre: string } | null
}

type InvoiceDetail = {
  id: string
  numero: string
  status: string
  clienteNombre: string
  clienteDocumento: string | null
  ivaPct: number
  subtotal: number
  iva: number
  total: number
  note: string | null
  createdAt: string
  warehouse?: { id: string; nombre: string; codigo: string | null } | null
  items: Array<{
    id: string
    descripcion: string
    quantity: number
    unitPrice: number
    total: number
    material?: { id: string; nombre: string; unidadMedida: string } | null
  }>
}

type ReturnListItem = {
  id: string
  numero: string
  total: number
  createdAt: string
  invoice?: { id: string; numero: string } | null
  warehouse?: { id: string; nombre: string } | null
}

type ReturnDetail = {
  id: string
  numero: string
  motivo: string | null
  ivaPct: number
  subtotal: number
  iva: number
  total: number
  createdAt: string
  invoice?: { id: string; numero: string } | null
  warehouse?: { id: string; nombre: string; codigo: string | null } | null
  items: Array<{
    id: string
    descripcion: string
    quantity: number
    unitPrice: number
    total: number
    material?: { id: string; nombre: string; unidadMedida: string } | null
  }>
}

type StockRow = {
  id: string
  quantity: number
  updatedAt: string
  material: { id: string; nombre: string; unidadMedida: string }
}

type ApiListResponse<T> = { success?: boolean; data?: T; error?: string }

function n(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function priceSuggestion(m: Material | undefined | null): number {
  if (!m) return 0
  return n(m.precioUnidad ?? m.precioMetro ?? m.precioM2 ?? 0)
}

type DraftItem = {
  materialId: string
  descripcion: string
  quantity: string
  unitPrice: string
}

export default function PosPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [returns, setReturns] = useState<ReturnListItem[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [materials, setMaterials] = useState<Material[]>([])

  const [materialSearch, setMaterialSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [finalizeSubmitting, setFinalizeSubmitting] = useState(false)
  const [createAsDraft, setCreateAsDraft] = useState(false)

  const [returnSubmitting, setReturnSubmitting] = useState(false)

  const [returnDetailOpen, setReturnDetailOpen] = useState(false)
  const [returnDetailLoading, setReturnDetailLoading] = useState(false)
  const [returnDetailError, setReturnDetailError] = useState<string | null>(null)
  const [returnDetail, setReturnDetail] = useState<ReturnDetail | null>(null)

  const [selectedWarehouseForStock, setSelectedWarehouseForStock] = useState('')
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [stockRows, setStockRows] = useState<StockRow[]>([])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<InvoiceDetail | null>(null)

  const [form, setForm] = useState({
    clienteNombre: '',
    clienteDocumento: '',
    ivaPct: '0',
    note: '',
    warehouseId: '',
    items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }] as DraftItem[],
  })

  const [returnForm, setReturnForm] = useState({
    invoiceId: '',
    motivo: '',
    ivaPct: '0',
    warehouseId: '',
    items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }] as DraftItem[],
  })

  const defaultBodegaId = useMemo(() => bodegas.find((b) => b.isDefault)?.id ?? '', [bodegas])

  const computedReturn = useMemo(() => {
    const ivaPct = Math.max(0, n(returnForm.ivaPct, 0))
    const lines = returnForm.items
      .map((it) => {
        const quantity = Math.max(0, n(it.quantity, 0))
        const unitPrice = Math.max(0, n(it.unitPrice, 0))
        const total = quantity * unitPrice
        return { ...it, quantity, unitPrice, total }
      })
      .filter((it) => it.quantity > 0)

    const subtotal = lines.reduce((sum, it) => sum + it.total, 0)
    const iva = subtotal * (ivaPct / 100)
    const total = subtotal + iva

    return { ivaPct, lines, subtotal, iva, total }
  }, [returnForm.items, returnForm.ivaPct])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [resInvoices, resReturns, resBodegas, resMaterials] = await Promise.all([
        fetch('/api/pos/facturas?limit=50'),
        fetch('/api/pos/devoluciones?limit=50'),
        fetch('/api/bodegas'),
        fetch(`/api/materiales?search=${encodeURIComponent(materialSearch)}`),
      ])

      const jsonInvoices = (await resInvoices.json().catch(() => ({}))) as ApiListResponse<InvoiceListItem[]>
      const jsonReturns = (await resReturns.json().catch(() => ({}))) as ApiListResponse<ReturnListItem[]>
      const jsonBodegas = (await resBodegas.json().catch(() => ({}))) as ApiListResponse<Bodega[]>
      const jsonMaterials = (await resMaterials.json().catch(() => ({}))) as ApiListResponse<Material[]>

      if (resInvoices.ok && jsonInvoices.success && Array.isArray(jsonInvoices.data)) {
        setInvoices(jsonInvoices.data)
      } else if (!resInvoices.ok) {
        setError(jsonInvoices.error || 'No se pudieron cargar facturas')
      }

      if (resReturns.ok && jsonReturns.success && Array.isArray(jsonReturns.data)) {
        setReturns(jsonReturns.data)
      } else if (!resReturns.ok) {
        setError((prev) => prev || jsonReturns.error || 'No se pudieron cargar devoluciones')
      }

      if (resBodegas.ok && jsonBodegas.success && Array.isArray(jsonBodegas.data)) {
        setBodegas(jsonBodegas.data)
      } else if (!resBodegas.ok) {
        setError((prev) => prev || jsonBodegas.error || 'No se pudieron cargar sedes')
      }

      if (resMaterials.ok && jsonMaterials.success && Array.isArray(jsonMaterials.data)) {
        setMaterials(jsonMaterials.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }, [materialSearch])

  const exportExcel = useCallback(() => {
    window.location.href = '/api/pos/export'
  }, [])

  useEffect(() => {
    if (!selectedWarehouseForStock && defaultBodegaId) {
      setSelectedWarehouseForStock(defaultBodegaId)
    }
  }, [defaultBodegaId, selectedWarehouseForStock])

  async function loadStock(warehouseId: string) {
    if (!warehouseId) {
      setStockRows([])
      return
    }

    setStockLoading(true)
    setStockError(null)
    try {
      const res = await fetch(`/api/bodegas/${warehouseId}/stock`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<StockRow[]>
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setStockError(json.error || 'No se pudo cargar el stock de sede')
        setStockRows([])
        return
      }
      setStockRows(json.data)
    } catch (e) {
      setStockError(e instanceof Error ? e.message : 'Error inesperado')
      setStockRows([])
    } finally {
      setStockLoading(false)
    }
  }

  useEffect(() => {
    void loadStock(selectedWarehouseForStock)
  }, [selectedWarehouseForStock])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  function openCreate() {
    setError(null)
    setCreateAsDraft(false)
    setForm({
      clienteNombre: '',
      clienteDocumento: '',
      ivaPct: '0',
      note: '',
      warehouseId: defaultBodegaId,
      items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    })
    setCreateOpen(true)
  }

  function openReturn() {
    setError(null)
    setReturnForm({
      invoiceId: '',
      motivo: '',
      ivaPct: '0',
      warehouseId: defaultBodegaId,
      items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    })
    setReturnOpen(true)
  }

  async function onReturnInvoiceChange(invoiceId: string) {
    setReturnForm((p) => ({ ...p, invoiceId }))
    if (!invoiceId) return

    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<InvoiceDetail>
      if (!res.ok || !json.success || !json.data) {
        setError(json.error || 'No se pudo cargar la factura para prellenar la devolución')
        return
      }

      const inv = json.data
      const nextWarehouseId = inv.warehouse?.id ?? defaultBodegaId
      const nextIvaPct = String(Math.max(0, n(inv.ivaPct, 0)))

      const nextItems: DraftItem[] = (inv.items || []).map((it) => ({
        materialId: it.material?.id ?? '',
        descripcion: it.descripcion ?? it.material?.nombre ?? 'Ítem',
        quantity: String(Math.max(0, n(it.quantity, 0)) || 1),
        unitPrice: String(Math.max(0, n(it.unitPrice, 0))),
      }))

      setReturnForm((p) => ({
        ...p,
        ivaPct: p.ivaPct !== '0' ? p.ivaPct : nextIvaPct,
        warehouseId: p.warehouseId || nextWarehouseId,
        items: nextItems.length ? nextItems : p.items,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }

  function updateReturnItem(idx: number, patch: Partial<DraftItem>) {
    setReturnForm((prev) => {
      const next = [...prev.items]
      const current = next[idx]
      if (!current) return prev
      const updated = { ...current, ...patch }

      if (patch.materialId !== undefined) {
        const m = materials.find((x) => x.id === patch.materialId) ?? null
        if (m) {
          if (!updated.descripcion) updated.descripcion = m.nombre
          if (!updated.unitPrice) updated.unitPrice = String(priceSuggestion(m))
        }
      }

      next[idx] = updated
      return { ...prev, items: next }
    })
  }

  function addReturnItem() {
    setReturnForm((prev) => ({
      ...prev,
      items: [...prev.items, { materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    }))
  }

  function removeReturnItem(idx: number) {
    setReturnForm((prev) => {
      const next = prev.items.filter((_, i) => i !== idx)
      return {
        ...prev,
        items: next.length ? next : [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
      }
    })
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setForm((prev) => {
      const next = [...prev.items]
      const current = next[idx]
      if (!current) return prev
      const updated = { ...current, ...patch }

      if (patch.materialId !== undefined) {
        const m = materials.find((x) => x.id === patch.materialId) ?? null
        if (m) {
          if (!updated.descripcion) updated.descripcion = m.nombre
          if (!updated.unitPrice) updated.unitPrice = String(priceSuggestion(m))
        }
      }

      next[idx] = updated
      return { ...prev, items: next }
    })
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    }))
  }

  function removeItem(idx: number) {
    setForm((prev) => {
      const next = prev.items.filter((_, i) => i !== idx)
      return { ...prev, items: next.length ? next : [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }] }
    })
  }

  const computed = useMemo(() => {
    const ivaPct = Math.max(0, n(form.ivaPct, 0))
    const lines = form.items
      .map((it) => {
        const quantity = Math.max(0, n(it.quantity, 0))
        const unitPrice = Math.max(0, n(it.unitPrice, 0))
        const total = quantity * unitPrice
        return { ...it, quantity, unitPrice, total }
      })
      .filter((it) => it.quantity > 0)

    const subtotal = lines.reduce((sum, it) => sum + it.total, 0)
    const iva = subtotal * (ivaPct / 100)
    const total = subtotal + iva

    return { ivaPct, lines, subtotal, iva, total }
  }, [form.items, form.ivaPct])

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!form.clienteNombre.trim()) {
        setError('clienteNombre es requerido')
        return
      }

      if (computed.lines.length === 0) {
        setError('Agrega al menos un ítem con cantidad > 0')
        return
      }

      const payload = {
        clienteNombre: form.clienteNombre.trim(),
        clienteDocumento: form.clienteDocumento.trim() || undefined,
        ivaPct: computed.ivaPct,
        note: form.note.trim() || undefined,
        warehouseId: form.warehouseId || undefined,
        asDraft: createAsDraft,
        items: computed.lines.map((it) => ({
          materialId: it.materialId || undefined,
          descripcion: it.descripcion?.trim() || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      }

      const res = await fetch('/api/pos/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        if (!createAsDraft && json.error === 'Stock insuficiente') {
          setError('Stock insuficiente. Marca "Guardar como borrador" para registrarla sin descontar inventario.')
          setCreateAsDraft(true)
          return
        }

        setError(json.error || 'No se pudo crear la factura')
        return
      }

      setCreateOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function openDetail(invoiceId: string) {
    setDetailOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)

    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<InvoiceDetail>
      if (!res.ok || !json.success || !json.data) {
        setDetailError(json.error || 'No se pudo cargar el detalle')
        return
      }
      setDetail(json.data)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setDetailLoading(false)
    }
  }

  async function anular(invoiceId: string) {
    const ok = window.confirm('¿Anular esta factura? Si estaba pagada, se revertirá inventario.')
    if (!ok) return

    setError(null)
    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}/anular`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || 'No se pudo anular')
        return
      }
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }

  async function finalizar(invoiceId: string) {
    const ok = window.confirm('¿Finalizar esta factura? Se descontará inventario y quedará como pagada.')
    if (!ok) return

    setError(null)
    setDetailError(null)
    setFinalizeSubmitting(true)

    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        const msg = json.error || 'No se pudo finalizar la factura'
        setError(msg)
        setDetailError(msg)
        return
      }

      await loadAll()
      if (detailOpen && detail?.id === invoiceId) {
        await openDetail(invoiceId)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error inesperado'
      setError(msg)
      setDetailError(msg)
    } finally {
      setFinalizeSubmitting(false)
    }
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault()
    setReturnSubmitting(true)
    setError(null)

    try {
      if (computedReturn.lines.length === 0) {
        setError('Agrega al menos un ítem de devolución con cantidad > 0')
        return
      }

      const payload = {
        invoiceId: returnForm.invoiceId.trim() || undefined,
        warehouseId: returnForm.warehouseId || undefined,
        motivo: returnForm.motivo.trim() || undefined,
        ivaPct: computedReturn.ivaPct,
        items: computedReturn.lines.map((it) => ({
          materialId: it.materialId || undefined,
          descripcion: it.descripcion?.trim() || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      }

      const res = await fetch('/api/pos/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || 'No se pudo crear la devolución')
        return
      }

      setReturnOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setReturnSubmitting(false)
    }
  }

  async function openReturnDetail(returnId: string) {
    setReturnDetailOpen(true)
    setReturnDetail(null)
    setReturnDetailError(null)
    setReturnDetailLoading(true)

    try {
      const res = await fetch(`/api/pos/devoluciones/${returnId}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<ReturnDetail>
      if (!res.ok || !json.success || !json.data) {
        setReturnDetailError(json.error || 'No se pudo cargar el detalle')
        return
      }
      setReturnDetail(json.data)
    } catch (e) {
      setReturnDetailError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setReturnDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
          <p className="text-muted-foreground">Facturación interna (sin DIAN por ahora).</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void loadAll()} variant="secondary" disabled={isLoading}>
            Refrescar
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={openReturn} variant="outline" disabled={isLoading}>
            Nueva devolución
          </Button>
          <Button onClick={openCreate} disabled={isLoading}>
            Nueva factura
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Facturas recientes</CardTitle>
          <CardDescription>Últimas facturas generadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : invoices.length === 0 ? (
            <div className="text-sm text-gray-600">Aún no hay facturas.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Número</th>
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 pr-4">Sede</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 text-gray-700">{new Date(inv.createdAt).toLocaleString('es-CO')}</td>
                      <td className="py-2 pr-4">
                        <button className="text-blue-700 hover:underline" onClick={() => void openDetail(inv.id)}>
                          {inv.numero}
                        </button>
                      </td>
                      <td className="py-2 pr-4 text-gray-900">{inv.clienteNombre}</td>
                      <td className="py-2 pr-4 text-gray-700">{inv.warehouse?.nombre || '—'}</td>
                      <td className="py-2 pr-4 text-gray-700">{inv.status}</td>
                      <td className="py-2 pr-4 font-medium">{formatCurrency(n(inv.total, 0))}</td>
                      <td className="py-2 pr-2">
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(inv.id)}>
                            Ver
                          </Button>
                          {inv.status === 'DRAFT' ? (
                            <Button type="button" size="sm" onClick={() => void finalizar(inv.id)} disabled={finalizeSubmitting}>
                              {finalizeSubmitting ? 'Finalizando…' : 'Finalizar'}
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="destructive" onClick={() => void anular(inv.id)}>
                            Anular
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devoluciones recientes</CardTitle>
          <CardDescription>Últimas devoluciones registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : returns.length === 0 ? (
            <div className="text-sm text-gray-600">Aún no hay devoluciones.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Número</th>
                    <th className="py-2 pr-4">Factura</th>
                    <th className="py-2 pr-4">Sede</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 text-gray-700">{new Date(r.createdAt).toLocaleString('es-CO')}</td>
                      <td className="py-2 pr-4">
                        <button className="text-blue-700 hover:underline" onClick={() => void openReturnDetail(r.id)}>
                          {r.numero}
                        </button>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{r.invoice?.numero || '—'}</td>
                      <td className="py-2 pr-4 text-gray-700">{r.warehouse?.nombre || '—'}</td>
                      <td className="py-2 pr-4 font-medium">{formatCurrency(n(r.total, 0))}</td>
                      <td className="py-2 pr-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => void openReturnDetail(r.id)}>
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock por sede</CardTitle>
          <CardDescription>Vista rápida del inventario en la sede seleccionada.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-3">
            <div className="sm:w-80">
              <Label>Sede</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={selectedWarehouseForStock}
                onChange={(e) => setSelectedWarehouseForStock(e.target.value)}
              >
                <option value="">(Selecciona)</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}{b.isDefault ? ' (Pred.)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:pt-6">
              <Button type="button" variant="secondary" onClick={() => void loadStock(selectedWarehouseForStock)} disabled={stockLoading}>
                Refrescar stock
              </Button>
            </div>
          </div>

          {stockError ? <div className="text-sm text-red-600 mb-2">{stockError}</div> : null}

          {stockLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : !selectedWarehouseForStock ? (
            <div className="text-sm text-gray-600">Selecciona una sede.</div>
          ) : stockRows.length === 0 ? (
            <div className="text-sm text-gray-600">No hay stock registrado en esta sede.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Material</th>
                    <th className="py-2 pr-4">Cantidad</th>
                    <th className="py-2 pr-4">Unidad</th>
                    <th className="py-2 pr-4">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 text-gray-900">{row.material.nombre}</td>
                      <td className="py-2 pr-4 text-gray-700">{n(row.quantity, 0).toLocaleString('es-CO')}</td>
                      <td className="py-2 pr-4 text-gray-700">{formatUnidadMedidaLabel(row.material.unidadMedida)}</td>
                      <td className="py-2 pr-4 text-gray-700">{new Date(row.updatedAt).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nueva devolución</DialogTitle>
            <DialogDescription>
              Registra una devolución y devuelve inventario. Puedes asociarla a una factura existente (opcional).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitReturn(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label>Factura (opcional)</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={returnForm.invoiceId}
                  onChange={(e) => void onReturnInvoiceChange(e.target.value)}
                >
                  <option value="">(Sin asociar)</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.numero} — {inv.clienteNombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Sede</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={returnForm.warehouseId}
                  onChange={(e) => setReturnForm((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">(Auto)</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}{b.isDefault ? ' (Pred.)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>IVA %</Label>
                <Input value={returnForm.ivaPct} onChange={(e) => setReturnForm((p) => ({ ...p, ivaPct: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Motivo (opcional)</Label>
                <Input value={returnForm.motivo} onChange={(e) => setReturnForm((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Ítems devueltos</div>
                <Button type="button" size="sm" variant="outline" onClick={addReturnItem}>
                  + Agregar ítem
                </Button>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">Material</th>
                      <th className="py-2 pr-3">Descripción</th>
                      <th className="py-2 pr-3">Cant.</th>
                      <th className="py-2 pr-3">Precio</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnForm.items.map((it, idx) => {
                      const qty = Math.max(0, n(it.quantity, 0))
                      const unit = Math.max(0, n(it.unitPrice, 0))
                      const lineTotal = qty * unit
                      return (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="py-2 pr-3">
                            <select
                              className="w-56 h-10 rounded-md border px-2 text-sm"
                              value={it.materialId}
                              onChange={(e) => updateReturnItem(idx, { materialId: e.target.value })}
                            >
                              <option value="">(Manual)</option>
                              {materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <Input value={it.descripcion} onChange={(e) => updateReturnItem(idx, { descripcion: e.target.value })} />
                          </td>
                          <td className="py-2 pr-3">
                            <Input value={it.quantity} onChange={(e) => updateReturnItem(idx, { quantity: e.target.value })} className="w-24" />
                          </td>
                          <td className="py-2 pr-3">
                            <Input value={it.unitPrice} onChange={(e) => updateReturnItem(idx, { unitPrice: e.target.value })} className="w-32" />
                          </td>
                          <td className="py-2 pr-3 font-medium">{formatCurrency(lineTotal)}</td>
                          <td className="py-2 pr-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => removeReturnItem(idx)}>
                              Quitar
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="sm:col-span-2">
                <Label>Nota interna (opcional)</Label>
                <Textarea value={returnForm.motivo} onChange={(e) => setReturnForm((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(computedReturn.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA</span>
                  <span className="font-medium">{formatCurrency(computedReturn.iva)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>Total</span>
                  <span className="font-semibold">{formatCurrency(computedReturn.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReturnOpen(false)} disabled={returnSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={returnSubmitting}>
                {returnSubmitting ? 'Creando…' : 'Crear devolución'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nueva factura</DialogTitle>
            <DialogDescription>
              Por defecto se crea como pagada (y descuenta inventario). Si no hay stock, guárdala como borrador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitInvoice(e)} className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Guardar como borrador</div>
                <div className="text-xs text-muted-foreground">No descuenta inventario; úsalo si aún no hay stock.</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createAsDraft}
                  onChange={(e) => setCreateAsDraft(e.target.checked)}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label>Cliente</Label>
                <Input value={form.clienteNombre} onChange={(e) => setForm((p) => ({ ...p, clienteNombre: e.target.value }))} />
              </div>
              <div>
                <Label>Documento (opcional)</Label>
                <Input value={form.clienteDocumento} onChange={(e) => setForm((p) => ({ ...p, clienteDocumento: e.target.value }))} />
              </div>

              <div>
                <Label>Sede</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={form.warehouseId}
                  onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">(Auto)</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}{b.isDefault ? ' (Pred.)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>IVA %</Label>
                <Input value={form.ivaPct} onChange={(e) => setForm((p) => ({ ...p, ivaPct: e.target.value }))} />
              </div>
              <div className="sm:col-span-1">
                <Label>Buscar material</Label>
                <Input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder="Filtrar…" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Ítems</div>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  + Agregar ítem
                </Button>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">Material</th>
                      <th className="py-2 pr-3">Descripción</th>
                      <th className="py-2 pr-3">Cant.</th>
                      <th className="py-2 pr-3">Precio</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) => {
                      const qty = Math.max(0, n(it.quantity, 0))
                      const unit = Math.max(0, n(it.unitPrice, 0))
                      const lineTotal = qty * unit

                      return (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="py-2 pr-3">
                            <select
                              className="w-56 h-10 rounded-md border px-2 text-sm"
                              value={it.materialId}
                              onChange={(e) => updateItem(idx, { materialId: e.target.value })}
                            >
                              <option value="">(Manual)</option>
                              {materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              value={it.descripcion}
                              onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                              placeholder="Descripción"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              value={it.quantity}
                              onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                              className="w-24"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              value={it.unitPrice}
                              onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                              className="w-32"
                            />
                          </td>
                          <td className="py-2 pr-3 font-medium">{formatCurrency(lineTotal)}</td>
                          <td className="py-2 pr-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => removeItem(idx)}>
                              Quitar
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="sm:col-span-2">
                <Label>Nota (opcional)</Label>
                <Textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(computed.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA</span>
                  <span className="font-medium">{formatCurrency(computed.iva)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>Total</span>
                  <span className="font-semibold">{formatCurrency(computed.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creando…' : 'Crear factura'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de factura</DialogTitle>
            <DialogDescription>Información y líneas de la factura seleccionada.</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : detailError ? (
            <div className="text-sm text-red-600">{detailError}</div>
          ) : !detail ? (
            <div className="text-sm text-gray-600">Sin datos.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Número</div>
                  <div className="font-medium">{detail.numero}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Cliente</div>
                  <div className="font-medium">{detail.clienteNombre}</div>
                  <div className="text-xs text-gray-500">{detail.clienteDocumento || '—'}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Sede</div>
                  <div className="font-medium">{detail.warehouse?.nombre || '—'}</div>
                  <div className="text-xs text-gray-500">Estado: {detail.status}</div>
                </div>
              </div>

              {detail.note ? <div className="text-sm text-gray-700">Nota: {detail.note}</div> : null}

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">Descripción</th>
                      <th className="py-2 pr-4">Cant.</th>
                      <th className="py-2 pr-4">Precio</th>
                      <th className="py-2 pr-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 text-gray-900">{it.descripcion}</td>
                        <td className="py-2 pr-4 text-gray-700">{n(it.quantity, 0).toLocaleString('es-CO')}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatCurrency(n(it.unitPrice, 0))}</td>
                        <td className="py-2 pr-4 font-medium">{formatCurrency(n(it.total, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Subtotal:</span> <span className="font-medium">{formatCurrency(detail.subtotal)}</span>
                </div>
                <div>
                  <span className="text-gray-500">IVA:</span> <span className="font-medium">{formatCurrency(detail.iva)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(detail.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {detail && detail.status === 'DRAFT' ? (
              <Button type="button" onClick={() => void finalizar(detail.id)} disabled={finalizeSubmitting || detailLoading}>
                {finalizeSubmitting ? 'Finalizando…' : 'Finalizar'}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDetailOpen} onOpenChange={setReturnDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de devolución</DialogTitle>
            <DialogDescription>Información y líneas de la devolución seleccionada.</DialogDescription>
          </DialogHeader>

          {returnDetailLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : returnDetailError ? (
            <div className="text-sm text-red-600">{returnDetailError}</div>
          ) : !returnDetail ? (
            <div className="text-sm text-gray-600">Sin datos.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Número</div>
                  <div className="font-medium">{returnDetail.numero}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Factura</div>
                  <div className="font-medium">{returnDetail.invoice?.numero || '—'}</div>
                  <div className="text-xs text-gray-500">{new Date(returnDetail.createdAt).toLocaleString('es-CO')}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Sede</div>
                  <div className="font-medium">{returnDetail.warehouse?.nombre || '—'}</div>
                </div>
              </div>

              {returnDetail.motivo ? <div className="text-sm text-gray-700">Motivo: {returnDetail.motivo}</div> : null}

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">Descripción</th>
                      <th className="py-2 pr-4">Cant.</th>
                      <th className="py-2 pr-4">Precio</th>
                      <th className="py-2 pr-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnDetail.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 text-gray-900">{it.descripcion}</td>
                        <td className="py-2 pr-4 text-gray-700">{n(it.quantity, 0).toLocaleString('es-CO')}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatCurrency(n(it.unitPrice, 0))}</td>
                        <td className="py-2 pr-4 font-medium">{formatCurrency(n(it.total, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Subtotal:</span> <span className="font-medium">{formatCurrency(returnDetail.subtotal)}</span>
                </div>
                <div>
                  <span className="text-gray-500">IVA:</span> <span className="font-medium">{formatCurrency(returnDetail.iva)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(returnDetail.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReturnDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
