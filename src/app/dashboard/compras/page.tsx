'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImportDialog } from '@/components/import/import-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { useI18n } from '@/components/providers/i18n-provider'
import { parsePurchaseOrderPrefillParam, type PurchaseWorkbenchMode } from '@/lib/purchase-order-prefill'

type CompraItem = {
  id?: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  descuento: number
  iva: number
}

type Compra = {
  id: string
  fechaCompra: string
  estado: 'BORRADOR' | 'REGISTRADA' | 'ANULADA'
  proveedorNombre: string
  proveedorTelefono: string | null
  proveedorDireccion: string | null
  recibidoPorNombre: string | null
  numeroPedido: string | null
  numeroOrden: string | null
  numeroFactura: string | null
  sede: string | null
  observaciones: string | null
  subtotalSinIva: number
  iva: number
  descuentoTotal: number
  subtotalConIva: number
  total: number
  pagado?: number
  saldo?: number
  autorizado: boolean
  items: Array<{
    id: string
    descripcion: string
    cantidad: number
    precioUnitario: number
    descuento: number
    iva: number
    total: number
    orden: number
  }>
}

type CompraPago = {
  id: string
  fecha: string
  monto: number
  metodo: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'
  referencia: string | null
  observaciones: string | null
  soporteUrl?: string | null
  soporteOriginalName?: string | null
  soporteMimeType?: string | null
  soporteSizeBytes?: number | null
  user?: { name?: string | null; email?: string | null }
}

function n(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function dateInputValue(date = new Date()) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatCOP(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    n(value, 0)
  )
}

function computeLineTotal(item: CompraItem) {
  const base = Math.max(0, n(item.cantidad, 1) * n(item.precioUnitario, 0) - n(item.descuento, 0))
  return base + n(item.iva, 0)
}

function computeTotals(items: CompraItem[]) {
  let subtotalSinIva = 0
  let iva = 0
  let descuentoTotal = 0
  let total = 0

  for (const it of items) {
    const base = Math.max(0, n(it.cantidad, 1) * n(it.precioUnitario, 0) - n(it.descuento, 0))
    subtotalSinIva += base
    iva += n(it.iva, 0)
    descuentoTotal += n(it.descuento, 0)
    total += base + n(it.iva, 0)
  }

  return { subtotalSinIva, iva, descuentoTotal, subtotalConIva: subtotalSinIva + iva, total }
}

function getCompraMode(compra: Pick<Compra, 'estado'>): PurchaseWorkbenchMode {
  return compra.estado === 'BORRADOR' ? 'order' : 'purchase'
}

function compraPdfFilename(compra: Pick<Compra, 'id' | 'numeroFactura' | 'numeroOrden' | 'numeroPedido'>) {
  return compra.numeroOrden || compra.numeroFactura || compra.numeroPedido || compra.id
}

export default function ComprasPage() {
  const { t, language } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')
  const appliedPrefillRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [compras, setCompras] = useState<Compra[]>([])
  const [activeMode, setActiveMode] = useState<PurchaseWorkbenchMode>('purchase')
  const [editingCompraId, setEditingCompraId] = useState<string | null>(null)

  function paymentMethodLabel(method: CompraPago['metodo'] | string): string {
    if (method === 'TRANSFER') return t('purchases.payments.method.transfer')
    if (method === 'CASH') return t('purchases.payments.method.cash')
    if (method === 'CARD') return t('purchases.payments.method.card')
    if (method === 'OTHER') return t('purchases.payments.method.other')
    return String(method)
  }

  function paymentStatusLabel(summary: { pagado: number; saldo: number }): string {
    if (summary.pagado <= 0) return t('purchases.payments.status.due')
    if (summary.saldo > 0) return t('purchases.payments.status.partial')
    return t('purchases.payments.status.paid')
  }

  const [pagoOpen, setPagoOpen] = useState(false)
  const [pagoCompra, setPagoCompra] = useState<Compra | null>(null)
  const [pagoLoading, setPagoLoading] = useState(false)
  const [pagos, setPagos] = useState<CompraPago[]>([])
  const [pagoSummary, setPagoSummary] = useState<{ pagado: number; saldo: number }>({ pagado: 0, saldo: 0 })
  const [pagoForm, setPagoForm] = useState({
    fecha: (() => {
      const d = new Date()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    })(),
    monto: '',
    metodo: 'TRANSFER' as CompraPago['metodo'],
    referencia: '',
    observaciones: '',
    soporteFile: null as File | null,
  })

  const [fechaCompra, setFechaCompra] = useState<string>(() => {
    return dateInputValue()
  })
  const [proveedorNombre, setProveedorNombre] = useState('')
  const [proveedorTelefono, setProveedorTelefono] = useState('')
  const [proveedorDireccion, setProveedorDireccion] = useState('')
  const [recibidoPorNombre, setRecibidoPorNombre] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [numeroOrden, setNumeroOrden] = useState('')
  const [numeroPedido, setNumeroPedido] = useState('')
  const [sede, setSede] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<CompraItem[]>([{ descripcion: '', cantidad: 1, precioUnitario: 0, descuento: 0, iva: 0 }])

  const query = useMemo(() => search.trim(), [search])
  const filteredCompras = useMemo(
    () => compras.filter((compra) => activeMode === 'order' ? compra.estado === 'BORRADOR' : compra.estado !== 'BORRADOR'),
    [activeMode, compras]
  )
  const draftOrdersCount = useMemo(() => compras.filter((compra) => compra.estado === 'BORRADOR').length, [compras])
  const recordedPurchasesCount = useMemo(() => compras.filter((compra) => compra.estado !== 'BORRADOR').length, [compras])

  function resetForm(nextMode: PurchaseWorkbenchMode = activeMode) {
    setEditingCompraId(null)
    setFechaCompra(dateInputValue())
    setProveedorNombre('')
    setProveedorTelefono('')
    setProveedorDireccion('')
    setRecibidoPorNombre('')
    setNumeroFactura('')
    setNumeroOrden('')
    setNumeroPedido('')
    setSede('')
    setObservaciones('')
    setItems([{ descripcion: '', cantidad: 1, precioUnitario: 0, descuento: 0, iva: 0 }])
    setActiveMode(nextMode)
  }

  function applyPrefill(prefill: ReturnType<typeof parsePurchaseOrderPrefillParam>) {
    if (!prefill) return
    const nextMode = prefill.mode === 'purchase' ? 'purchase' : 'order'
    setEditingCompraId(null)
    setActiveMode(nextMode)
    setFechaCompra(dateInputValue())
    setProveedorNombre(prefill.supplierName ?? '')
    setProveedorTelefono(prefill.supplierPhone ?? '')
    setProveedorDireccion(prefill.supplierAddress ?? '')
    setRecibidoPorNombre('')
    setNumeroFactura('')
    setNumeroOrden(prefill.orderNumber ?? '')
    setNumeroPedido(prefill.requestNumber ?? '')
    setSede(prefill.site ?? '')
    setObservaciones(prefill.notes ?? '')
    setItems(
      prefill.items?.length
        ? prefill.items.map((item) => ({
            descripcion: item.descripcion,
            cantidad: n(item.cantidad, 1),
            precioUnitario: n(item.precioUnitario, 0),
            descuento: n(item.descuento, 0),
            iva: n(item.iva, 0),
          }))
        : [{ descripcion: '', cantidad: 1, precioUnitario: 0, descuento: 0, iva: 0 }]
    )
  }

  function loadCompraIntoForm(compra: Compra, nextMode: PurchaseWorkbenchMode = getCompraMode(compra)) {
    setEditingCompraId(compra.id)
    setActiveMode(nextMode)
    setFechaCompra(String(compra.fechaCompra).slice(0, 10))
    setProveedorNombre(compra.proveedorNombre || '')
    setProveedorTelefono(compra.proveedorTelefono || '')
    setProveedorDireccion(compra.proveedorDireccion || '')
    setRecibidoPorNombre(compra.recibidoPorNombre || '')
    setNumeroFactura(compra.numeroFactura || '')
    setNumeroOrden(compra.numeroOrden || '')
    setNumeroPedido(compra.numeroPedido || '')
    setSede(compra.sede || '')
    setObservaciones(compra.observaciones || '')
    setItems(
      compra.items.length
        ? compra.items.map((item) => ({
            id: item.id,
            descripcion: item.descripcion,
            cantidad: n(item.cantidad, 1),
            precioUnitario: n(item.precioUnitario, 0),
            descuento: n(item.descuento, 0),
            iva: n(item.iva, 0),
          }))
        : [{ descripcion: '', cantidad: 1, precioUnitario: 0, descuento: 0, iva: 0 }]
    )
  }

  function getStatusLabel(compra: Compra) {
    if (compra.estado === 'BORRADOR') return t('purchases.status.draft')
    if (compra.estado === 'ANULADA') return t('purchases.status.cancelled')
    return t('purchases.status.recorded')
  }

  function getListDocumentValue(compra: Compra) {
    if (activeMode === 'order') return compra.numeroOrden || compra.numeroPedido || naText
    return compra.numeroFactura || compra.numeroOrden || compra.numeroPedido || naText
  }

  const exportExcel = () => {
    const params = new URLSearchParams()
    if (query) params.set('search', query)
    const url = params.toString() ? `/api/compras/export?${params.toString()}` : '/api/compras/export'
    window.location.href = url
  }

  async function load() {
    setLoading(true)
    try {
      const url = new URL('/api/compras', window.location.origin)
      if (query) url.searchParams.set('search', query)
      const res = await fetch(url.toString())
      const json = await res.json().catch(() => null)
      setCompras(json?.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function openPagos(compra: Compra) {
    setPagoCompra(compra)
    setPagoOpen(true)
    setPagoLoading(true)
    try {
      const res = await fetch(`/api/compras/${compra.id}/pagos`)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error ?? t('purchases.payments.errors.loadFailed'))
      setPagos((json.data?.pagos ?? []) as CompraPago[])
      setPagoSummary({ pagado: n(json.data?.pagado, 0), saldo: n(json.data?.saldo, 0) })
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setPagoLoading(false)
    }
  }

  async function registrarPago() {
    if (!pagoCompra) return
    const monto = n(pagoForm.monto, 0)
    if (!monto || monto <= 0) {
      alert(t('purchases.payments.errors.invalidAmount'))
      return
    }
    setPagoLoading(true)
    try {
      const hasFile = !!pagoForm.soporteFile
      const res = await fetch(`/api/compras/${pagoCompra.id}/pagos`,
        hasFile
          ? {
              method: 'POST',
              body: (() => {
                const fd = new FormData()
                fd.set('fecha', pagoForm.fecha)
                fd.set('monto', String(monto))
                fd.set('metodo', pagoForm.metodo)
                fd.set('referencia', pagoForm.referencia.trim() || '')
                fd.set('observaciones', pagoForm.observaciones.trim() || '')
                if (pagoForm.soporteFile) fd.set('file', pagoForm.soporteFile)
                return fd
              })(),
            }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fecha: pagoForm.fecha,
                monto,
                metodo: pagoForm.metodo,
                referencia: pagoForm.referencia.trim() || null,
                observaciones: pagoForm.observaciones.trim() || null,
              }),
            }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error ?? t('purchases.payments.errors.registerFailed'))
      setPagos((json.data?.pagos ?? []) as CompraPago[])
      setPagoSummary({ pagado: n(json.data?.pagado, 0), saldo: n(json.data?.saldo, 0) })
      setPagoForm((prev) => ({ ...prev, monto: '', referencia: '', observaciones: '', soporteFile: null }))
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setPagoLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    const encoded = searchParams?.get('prefill')
    if (!encoded || appliedPrefillRef.current === encoded) return

    const parsed = parsePurchaseOrderPrefillParam(encoded)
    if (!parsed) return

    appliedPrefillRef.current = encoded
    applyPrefill(parsed)
    router.replace('/dashboard/compras')
  }, [router, searchParams])

  const totals = useMemo(() => computeTotals(items.filter((it) => it.descripcion.trim())), [items])

  function updateItem(index: number, patch: Partial<CompraItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { descripcion: '', cantidad: 1, precioUnitario: 0, descuento: 0, iva: 0 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function saveCompra() {
    if (!proveedorNombre.trim()) return

    setSaving(true)
    try {
      const cleanItems = items
        .map((it) => ({
          descripcion: it.descripcion.trim(),
          cantidad: n(it.cantidad, 1),
          precioUnitario: n(it.precioUnitario, 0),
          descuento: n(it.descuento, 0),
          iva: n(it.iva, 0),
          total: computeLineTotal(it),
        }))
        .filter((it) => it.descripcion)

      const payload = {
        fechaCompra,
        estado: activeMode === 'order' ? 'BORRADOR' : 'REGISTRADA',
        proveedorNombre: proveedorNombre.trim(),
        proveedorTelefono: proveedorTelefono.trim() || null,
        proveedorDireccion: proveedorDireccion.trim() || null,
        recibidoPorNombre: activeMode === 'purchase' ? (recibidoPorNombre.trim() || null) : null,
        numeroFactura: activeMode === 'purchase' ? (numeroFactura.trim() || null) : null,
        numeroOrden: numeroOrden.trim() || null,
        numeroPedido: numeroPedido.trim() || null,
        sede: sede.trim() || null,
        observaciones: observaciones.trim() || null,
        items: cleanItems,
        subtotalSinIva: totals.subtotalSinIva,
        iva: totals.iva,
        descuentoTotal: totals.descuentoTotal,
        subtotalConIva: totals.subtotalConIva,
        total: totals.total,
      }

      const res = await fetch(editingCompraId ? `/api/compras/${editingCompraId}` : '/api/compras', {
        method: editingCompraId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? t('purchases.errors.createFailed'))
      }

      resetForm(activeMode)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleAutorizar(compra: Compra) {
    try {
      const res = await fetch(`/api/compras/${compra.id}/autorizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autorizado: !compra.autorizado }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? t('purchases.errors.updateFailed'))
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    }
  }

  async function deleteCompra(compra: Compra) {
    if (!confirm(t('purchases.confirm.deletePurchase'))) return
    try {
      const res = await fetch(`/api/compras/${compra.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? t('purchases.errors.deleteFailed'))
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    }
  }

  async function downloadCompraPdf(compra: Compra) {
    try {
      const res = await fetch(`/api/compras/${compra.id}/pdf?download=1`)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? t('purchases.errors.downloadPdf'))
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${compraPdfFilename(compra)}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(anchor)
    } catch (error) {
      console.error('Error descargando PDF de compra:', error)
      alert(error instanceof Error ? error.message : t('purchases.errors.downloadPdf'))
    }
  }

  function openCompraPdf(compra: Compra) {
    window.open(`/api/compras/${compra.id}/pdf`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="ERP de abastecimiento"
        title={t('purchases.title')}
        description={t('purchases.subtitle')}
        actions={
          <>
            <ImportDialog module="compras" title={t('purchases.actions.import')} />
            <Button variant="outline" asChild>
              <Link href="/dashboard/compras/plantilla">{t('purchases.actions.template')}</Link>
            </Button>
            <Button variant="outline" onClick={exportExcel}>
              {t('purchases.actions.exportExcel')}
            </Button>
          </>
        }
        stats={[
          { label: 'Compras', value: recordedPurchasesCount, hint: 'Registros ya formalizados', tone: 'neutral' },
          { label: 'Órdenes', value: draftOrdersCount, hint: 'Pendientes por registrar o facturar', tone: 'amber' },
          { label: 'Formulario activo', value: formatCOP(totals.total, locale), hint: activeMode === 'order' ? t('purchases.modes.order') : t('purchases.modes.purchase'), tone: 'sky' },
        ]}
      />

      <Tabs
        value={activeMode}
        onValueChange={(value) => resetForm(value as PurchaseWorkbenchMode)}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-xl grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="purchase" className="rounded-xl">{t('purchases.modes.purchase')}</TabsTrigger>
          <TabsTrigger value="order" className="rounded-xl">{t('purchases.modes.order')}</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{editingCompraId ? t('purchases.actions.updatePurchase') : t('purchases.new.title')}</CardTitle>
              <CardDescription>{t('purchases.new.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {t('purchases.mode.purchase.hint')}
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>{t('purchases.fields.purchaseDate')}</Label>
                  <Input type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>{t('purchases.fields.supplierName')}</Label>
                  <Input value={proveedorNombre} onChange={(e) => setProveedorNombre(e.target.value)} placeholder={t('purchases.placeholders.supplierName')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('purchases.fields.receivedBy')}</Label>
                  <Input value={recibidoPorNombre} onChange={(e) => setRecibidoPorNombre(e.target.value)} placeholder={t('purchases.placeholders.receivedBy')} />
                </div>

                <div className="space-y-2">
                  <Label>{t('purchases.fields.supplierPhone')}</Label>
                  <Input value={proveedorTelefono} onChange={(e) => setProveedorTelefono(e.target.value)} placeholder={t('purchases.placeholders.supplierPhone')} />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>{t('purchases.fields.supplierAddress')}</Label>
                  <Input value={proveedorDireccion} onChange={(e) => setProveedorDireccion(e.target.value)} placeholder={t('purchases.placeholders.supplierAddress')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('purchases.fields.site')}</Label>
                  <Input value={sede} onChange={(e) => setSede(e.target.value)} placeholder={t('purchases.placeholders.site')} />
                </div>

                <div className="space-y-2">
                  <Label>{t('purchases.fields.invoiceNumber')}</Label>
                  <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder={t('purchases.placeholders.invoiceNumber')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('purchases.fields.orderNumber')}</Label>
                  <Input value={numeroOrden} onChange={(e) => setNumeroOrden(e.target.value)} placeholder={t('purchases.placeholders.orderNumber')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('purchases.fields.requestNumber')}</Label>
                  <Input value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} placeholder={t('purchases.placeholders.requestNumber')} />
                </div>

                <div className="space-y-2 lg:col-span-4">
                  <Label>{t('purchases.fields.notes')}</Label>
                  <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder={t('purchases.placeholders.notes')} />
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('purchases.items.title')}</h3>
                  <Button type="button" variant="outline" onClick={addItem}>
                    {t('purchases.items.add')}
                  </Button>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">{t('purchases.items.columns.description')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.quantity')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.unitPrice')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.discount')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.vat')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.lineTotal')}</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={idx} className="border-b align-top">
                          <td className="py-2 pr-2 min-w-[280px]">
                            <Input value={it.descripcion} onChange={(e) => updateItem(idx, { descripcion: e.target.value })} placeholder={t('purchases.items.placeholders.description')} />
                          </td>
                          <td className="py-2 pr-2 w-[120px]">
                            <Input type="number" value={it.cantidad} onChange={(e) => updateItem(idx, { cantidad: n(e.target.value, 1) })} />
                          </td>
                          <td className="py-2 pr-2 w-[160px]">
                            <Input type="number" value={it.precioUnitario} onChange={(e) => updateItem(idx, { precioUnitario: n(e.target.value, 0) })} />
                          </td>
                          <td className="py-2 pr-2 w-[160px]">
                            <Input type="number" value={it.descuento} onChange={(e) => updateItem(idx, { descuento: n(e.target.value, 0) })} />
                          </td>
                          <td className="py-2 pr-2 w-[160px]">
                            <Input type="number" value={it.iva} onChange={(e) => updateItem(idx, { iva: n(e.target.value, 0) })} />
                          </td>
                          <td className="py-3 pr-2 whitespace-nowrap">{formatCOP(computeLineTotal(it), locale)}</td>
                          <td className="py-2 text-right">
                            <Button type="button" variant="outline" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                              {t('common.remove')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.subtotalWithoutVat')}</div>
                    <div className="font-semibold">{formatCOP(totals.subtotalSinIva, locale)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.vat')}</div>
                    <div className="font-semibold">{formatCOP(totals.iva, locale)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.subtotalWithVat')}</div>
                    <div className="font-semibold">{formatCOP(totals.subtotalConIva, locale)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.total')}</div>
                    <div className="font-semibold">{formatCOP(totals.total, locale)}</div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  {editingCompraId ? <Button variant="outline" onClick={() => resetForm('purchase')}>{t('purchases.actions.cancelEdit')}</Button> : null}
                  <Button onClick={saveCompra} disabled={saving || !proveedorNombre.trim()}>
                    {saving ? t('common.saving') : editingCompraId ? t('purchases.actions.updatePurchase') : t('purchases.actions.create')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="order" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{editingCompraId ? t('purchases.actions.updateOrder') : t('purchases.order.title')}</CardTitle>
              <CardDescription>{t('purchases.order.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {t('purchases.mode.order.hint')}
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>{t('purchases.fields.purchaseDate')}</Label>
                  <Input type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>{t('purchases.fields.supplierName')}</Label>
                  <Input value={proveedorNombre} onChange={(e) => setProveedorNombre(e.target.value)} placeholder={t('purchases.placeholders.supplierName')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('purchases.fields.site')}</Label>
                  <Input value={sede} onChange={(e) => setSede(e.target.value)} placeholder={t('purchases.placeholders.site')} />
                </div>

                <div className="space-y-2">
                  <Label>{t('purchases.fields.supplierPhone')}</Label>
                  <Input value={proveedorTelefono} onChange={(e) => setProveedorTelefono(e.target.value)} placeholder={t('purchases.placeholders.supplierPhone')} />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>{t('purchases.fields.supplierAddress')}</Label>
                  <Input value={proveedorDireccion} onChange={(e) => setProveedorDireccion(e.target.value)} placeholder={t('purchases.placeholders.supplierAddress')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('purchases.fields.orderNumber')}</Label>
                  <Input value={numeroOrden} onChange={(e) => setNumeroOrden(e.target.value)} placeholder={t('purchases.placeholders.orderNumber')} />
                </div>

                <div className="space-y-2">
                  <Label>{t('purchases.fields.requestNumber')}</Label>
                  <Input value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} placeholder={t('purchases.placeholders.requestNumber')} />
                </div>

                <div className="space-y-2 lg:col-span-4">
                  <Label>{t('purchases.fields.notes')}</Label>
                  <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder={t('purchases.placeholders.notes')} />
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('purchases.items.title')}</h3>
                  <Button type="button" variant="outline" onClick={addItem}>
                    {t('purchases.items.add')}
                  </Button>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">{t('purchases.items.columns.description')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.quantity')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.unitPrice')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.discount')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.vat')}</th>
                        <th className="py-2 text-left">{t('purchases.items.columns.lineTotal')}</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={idx} className="border-b align-top">
                          <td className="py-2 pr-2 min-w-[280px]">
                            <Input value={it.descripcion} onChange={(e) => updateItem(idx, { descripcion: e.target.value })} placeholder={t('purchases.items.placeholders.description')} />
                          </td>
                          <td className="py-2 pr-2 w-[120px]">
                            <Input type="number" value={it.cantidad} onChange={(e) => updateItem(idx, { cantidad: n(e.target.value, 1) })} />
                          </td>
                          <td className="py-2 pr-2 w-[160px]">
                            <Input type="number" value={it.precioUnitario} onChange={(e) => updateItem(idx, { precioUnitario: n(e.target.value, 0) })} />
                          </td>
                          <td className="py-2 pr-2 w-[160px]">
                            <Input type="number" value={it.descuento} onChange={(e) => updateItem(idx, { descuento: n(e.target.value, 0) })} />
                          </td>
                          <td className="py-2 pr-2 w-[160px]">
                            <Input type="number" value={it.iva} onChange={(e) => updateItem(idx, { iva: n(e.target.value, 0) })} />
                          </td>
                          <td className="py-3 pr-2 whitespace-nowrap">{formatCOP(computeLineTotal(it), locale)}</td>
                          <td className="py-2 text-right">
                            <Button type="button" variant="outline" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                              {t('common.remove')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.subtotalWithoutVat')}</div>
                    <div className="font-semibold">{formatCOP(totals.subtotalSinIva, locale)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.vat')}</div>
                    <div className="font-semibold">{formatCOP(totals.iva, locale)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.subtotalWithVat')}</div>
                    <div className="font-semibold">{formatCOP(totals.subtotalConIva, locale)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground">{t('purchases.totals.total')}</div>
                    <div className="font-semibold">{formatCOP(totals.total, locale)}</div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  {editingCompraId ? <Button variant="outline" onClick={() => resetForm('order')}>{t('purchases.actions.cancelEdit')}</Button> : null}
                  <Button onClick={saveCompra} disabled={saving || !proveedorNombre.trim()}>
                    {saving ? t('common.saving') : editingCompraId ? t('purchases.actions.updateOrder') : t('purchases.actions.createOrder')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{activeMode === 'order' ? t('purchases.list.ordersTitle') : t('purchases.list.title')}</CardTitle>
                <CardDescription>{activeMode === 'order' ? t('purchases.list.ordersDescription') : t('purchases.list.description')}</CardDescription>
              </div>
              <div className="w-full max-w-md">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('purchases.list.searchPlaceholder')} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">{t('purchases.list.columns.date')}</th>
                    <th className="py-2 text-left">{t('purchases.list.columns.supplier')}</th>
                    <th className="py-2 text-left">{t('purchases.list.columns.document')}</th>
                    <th className="py-2 text-left">{t('purchases.list.columns.status')}</th>
                    <th className="py-2 text-left">{t('purchases.list.columns.total')}</th>
                    <th className="py-2 text-left">{t('purchases.list.columns.paid')}</th>
                    <th className="py-2 text-left">{t('purchases.list.columns.balance')}</th>
                    <th className="py-2 text-left">{t('purchases.list.columns.authorized')}</th>
                    <th className="py-2 text-right">{t('purchases.list.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompras.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 whitespace-nowrap">{new Date(c.fechaCompra).toLocaleDateString(locale)}</td>
                      <td className="py-2">{c.proveedorNombre}</td>
                      <td className="py-2">{getListDocumentValue(c)}</td>
                      <td className="py-2">{getStatusLabel(c)}</td>
                      <td className="py-2 whitespace-nowrap">{formatCOP(c.total, locale)}</td>
                      <td className="py-2 whitespace-nowrap">{formatCOP(n(c.pagado, 0), locale)}</td>
                      <td className="py-2 whitespace-nowrap">{formatCOP(n(c.saldo, n(c.total, 0) - n(c.pagado, 0)), locale)}</td>
                      <td className="py-2">{c.autorizado ? t('common.yes') : t('common.no')}</td>
                      <td className="py-2 text-right space-x-2">
                        {c.estado !== 'BORRADOR' ? <Button variant="outline" onClick={() => openPagos(c)}>{t('purchases.actions.payments')}</Button> : null}
                        <Button variant="outline" onClick={() => openCompraPdf(c)}>{t('purchases.actions.print')}</Button>
                        <Button variant="outline" onClick={() => void downloadCompraPdf(c)}>{t('purchases.actions.downloadPdf')}</Button>
                        <Button variant="outline" onClick={() => loadCompraIntoForm(c, getCompraMode(c))}>{t('purchases.actions.edit')}</Button>
                        {c.estado === 'BORRADOR' ? <Button variant="outline" onClick={() => loadCompraIntoForm(c, 'purchase')}>{t('purchases.actions.registerPurchase')}</Button> : null}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline">{t('purchases.actions.view')}</Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>{t('purchases.view.title')}</DialogTitle>
                              <DialogDescription>
                                {t('purchases.view.description', { supplier: c.proveedorNombre, total: formatCOP(c.total, locale) })}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-3 text-sm md:grid-cols-2">
                              <div>
                                <div className="text-muted-foreground">{t('purchases.view.fields.date')}</div>
                                <div>{new Date(c.fechaCompra).toLocaleDateString(locale)}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">{t('purchases.list.columns.status')}</div>
                                <div>{getStatusLabel(c)}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">{t('purchases.view.fields.site')}</div>
                                <div>{c.sede ?? naText}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">{t('purchases.view.fields.receivedBy')}</div>
                                <div>{c.recibidoPorNombre ?? naText}</div>
                              </div>
                              <div className="md:col-span-2">
                                <div className="text-muted-foreground">{t('purchases.view.fields.docs')}</div>
                                <div>{(c.numeroFactura ?? naText) + ' / ' + (c.numeroOrden ?? naText) + ' / ' + (c.numeroPedido ?? naText)}</div>
                              </div>
                            </div>

                            <div className="mt-4 overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="py-2 text-left">{t('purchases.view.items.columns.description')}</th>
                                    <th className="py-2 text-left">{t('purchases.view.items.columns.qty')}</th>
                                    <th className="py-2 text-left">{t('purchases.view.items.columns.unitPrice')}</th>
                                    <th className="py-2 text-left">{t('purchases.view.items.columns.discount')}</th>
                                    <th className="py-2 text-left">{t('purchases.view.items.columns.vat')}</th>
                                    <th className="py-2 text-left">{t('purchases.view.items.columns.total')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.items.map((it) => (
                                    <tr key={it.id} className="border-b">
                                      <td className="py-2">{it.descripcion}</td>
                                      <td className="py-2">{it.cantidad}</td>
                                      <td className="py-2 whitespace-nowrap">{formatCOP(it.precioUnitario, locale)}</td>
                                      <td className="py-2 whitespace-nowrap">{formatCOP(it.descuento, locale)}</td>
                                      <td className="py-2 whitespace-nowrap">{formatCOP(it.iva, locale)}</td>
                                      <td className="py-2 whitespace-nowrap">{formatCOP(it.total, locale)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-lg border p-3">
                                <div className="text-muted-foreground">{t('purchases.totals.subtotalWithoutVat')}</div>
                                <div className="font-semibold">{formatCOP(c.subtotalSinIva, locale)}</div>
                              </div>
                              <div className="rounded-lg border p-3">
                                <div className="text-muted-foreground">{t('purchases.totals.vat')}</div>
                                <div className="font-semibold">{formatCOP(c.iva, locale)}</div>
                              </div>
                              <div className="rounded-lg border p-3">
                                <div className="text-muted-foreground">{t('purchases.totals.subtotalWithVat')}</div>
                                <div className="font-semibold">{formatCOP(c.subtotalConIva, locale)}</div>
                              </div>
                              <div className="rounded-lg border p-3">
                                <div className="text-muted-foreground">{t('purchases.totals.total')}</div>
                                <div className="font-semibold">{formatCOP(c.total, locale)}</div>
                              </div>
                            </div>

                            {c.observaciones && (
                              <div className="mt-4 text-sm">
                                <div className="text-muted-foreground">{t('purchases.view.fields.notes')}</div>
                                <div className="whitespace-pre-wrap">{c.observaciones}</div>
                              </div>
                            )}

                            <div className="mt-6 flex justify-end gap-2">
                              <Button variant="outline" onClick={() => openCompraPdf(c)}>
                                {t('purchases.actions.print')}
                              </Button>
                              <Button variant="outline" onClick={() => void downloadCompraPdf(c)}>
                                {t('purchases.actions.downloadPdf')}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button variant={c.autorizado ? 'outline' : 'default'} onClick={() => toggleAutorizar(c)}>
                          {c.autorizado ? t('purchases.actions.removeAuthorization') : t('purchases.actions.authorize')}
                        </Button>
                        <Button variant="outline" onClick={() => deleteCompra(c)}>
                          {t('common.delete')}
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {!loading && filteredCompras.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={9}>
                        {t('common.noResults')}
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={9}>
                        {t('common.loading')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Tabs>

      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('purchases.payments.title')}</DialogTitle>
            <DialogDescription>
              {pagoCompra
                ? t('purchases.payments.description', {
                    supplier: pagoCompra.proveedorNombre,
                    total: formatCOP(pagoCompra.total, locale),
                  })
                : naText}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{t('purchases.payments.summary.paid')}</div>
              <div className="font-semibold">{formatCOP(pagoSummary.pagado, locale)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{t('purchases.payments.summary.balance')}</div>
              <div className="font-semibold">{formatCOP(pagoSummary.saldo, locale)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{t('purchases.payments.summary.status')}</div>
              <div className="font-semibold">
                {paymentStatusLabel(pagoSummary)}
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('purchases.payments.fields.date')}</Label>
              <Input
                type="date"
                value={pagoForm.fecha}
                onChange={(e) => setPagoForm((p) => ({ ...p, fecha: e.target.value }))}
                disabled={pagoLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('purchases.payments.fields.amount')}</Label>
              <Input
                type="number"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
                disabled={pagoLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('purchases.payments.fields.method')}</Label>
              <select
                value={pagoForm.metodo}
                onChange={(e) => setPagoForm((p) => ({ ...p, metodo: e.target.value as CompraPago['metodo'] }))}
                disabled={pagoLoading}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="TRANSFER">{t('purchases.payments.method.transfer')}</option>
                <option value="CASH">{t('purchases.payments.method.cash')}</option>
                <option value="CARD">{t('purchases.payments.method.card')}</option>
                <option value="OTHER">{t('purchases.payments.method.other')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('purchases.payments.fields.reference')}</Label>
              <Input
                value={pagoForm.referencia}
                onChange={(e) => setPagoForm((p) => ({ ...p, referencia: e.target.value }))}
                disabled={pagoLoading}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t('purchases.payments.fields.notes')}</Label>
              <Textarea
                value={pagoForm.observaciones}
                onChange={(e) => setPagoForm((p) => ({ ...p, observaciones: e.target.value }))}
                rows={2}
                disabled={pagoLoading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('purchases.payments.fields.supportOptional')}</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                disabled={pagoLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setPagoForm((p) => ({ ...p, soporteFile: file }))
                }}
              />
              {pagoForm.soporteFile ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {t('purchases.payments.support.attached')}: {pagoForm.soporteFile.name}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagoLoading}
                    onClick={() => setPagoForm((p) => ({ ...p, soporteFile: null }))}
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('purchases.payments.support.hint')}</p>
              )}
            </div>
          </div>

          <div className="mt-2 flex justify-end">
            <Button onClick={registrarPago} disabled={pagoLoading || !pagoCompra}>
              {pagoLoading ? t('common.saving') : t('purchases.payments.actions.recordPayment')}
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">{t('purchases.payments.table.columns.date')}</th>
                  <th className="py-2 text-left">{t('purchases.payments.table.columns.method')}</th>
                  <th className="py-2 text-left">{t('purchases.payments.table.columns.reference')}</th>
                  <th className="py-2 text-left">{t('purchases.payments.table.columns.support')}</th>
                  <th className="py-2 text-left">{t('purchases.payments.table.columns.amount')}</th>
                  <th className="py-2 text-left">{t('purchases.payments.table.columns.user')}</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 whitespace-nowrap">{new Date(p.fecha).toLocaleDateString(locale)}</td>
                    <td className="py-2">{paymentMethodLabel(p.metodo)}</td>
                    <td className="py-2">{p.referencia ?? naText}</td>
                    <td className="py-2">
                      {p.soporteUrl ? (
                        <a
                          href={p.soporteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                          title={p.soporteOriginalName ?? t('purchases.payments.support.openTitle')}
                        >
                          {t('purchases.actions.view')}
                        </a>
                      ) : (
                        naText
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">{formatCOP(p.monto, locale)}</td>
                    <td className="py-2">{p.user?.name || p.user?.email || naText}</td>
                  </tr>
                ))}
                {!pagoLoading && pagos.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                      {t('purchases.payments.table.empty')}
                    </td>
                  </tr>
                )}
                {pagoLoading && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                      {t('common.loading')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
