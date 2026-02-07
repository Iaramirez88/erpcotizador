'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImportDialog } from '@/components/import/import-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
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

export default function ComprasPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [compras, setCompras] = useState<Compra[]>([])

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
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
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
      if (!res.ok || !json?.success) throw new Error(json?.error ?? 'No se pudieron cargar los pagos')
      setPagos((json.data?.pagos ?? []) as CompraPago[])
      setPagoSummary({ pagado: n(json.data?.pagado, 0), saldo: n(json.data?.saldo, 0) })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setPagoLoading(false)
    }
  }

  async function registrarPago() {
    if (!pagoCompra) return
    const monto = n(pagoForm.monto, 0)
    if (!monto || monto <= 0) {
      alert('Monto inválido')
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
      if (!res.ok || !json?.success) throw new Error(json?.error ?? 'No se pudo registrar el pago')
      setPagos((json.data?.pagos ?? []) as CompraPago[])
      setPagoSummary({ pagado: n(json.data?.pagado, 0), saldo: n(json.data?.saldo, 0) })
      setPagoForm((prev) => ({ ...prev, monto: '', referencia: '', observaciones: '', soporteFile: null }))
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setPagoLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

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

  async function createCompra() {
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

      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaCompra,
          proveedorNombre: proveedorNombre.trim(),
          proveedorTelefono: proveedorTelefono.trim() || null,
          proveedorDireccion: proveedorDireccion.trim() || null,
          recibidoPorNombre: recibidoPorNombre.trim() || null,
          numeroFactura: numeroFactura.trim() || null,
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
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? 'No se pudo crear la compra')
      }

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
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
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
        throw new Error(err?.error ?? 'No se pudo actualizar')
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    }
  }

  async function deleteCompra(compra: Compra) {
    if (!confirm('¿Eliminar esta compra?')) return
    try {
      const res = await fetch(`/api/compras/${compra.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? 'No se pudo eliminar')
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground mt-1">Registro de compras con ítems, IVA, descuentos y autorización.</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportDialog module="compras" title="Importar compras" />
          <Button variant="outline" onClick={exportExcel}>
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva compra</CardTitle>
          <CardDescription>Mínimos: fecha, proveedor, quien recibe, totales, sede y detalle.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Fecha de compra</Label>
              <Input type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Proveedor (nombre)</Label>
              <Input value={proveedorNombre} onChange={(e) => setProveedorNombre(e.target.value)} placeholder="Proveedor S.A.S" />
            </div>
            <div className="space-y-2">
              <Label>Quién recibe</Label>
              <Input value={recibidoPorNombre} onChange={(e) => setRecibidoPorNombre(e.target.value)} placeholder="Nombre" />
            </div>

            <div className="space-y-2">
              <Label>Teléfono proveedor</Label>
              <Input value={proveedorTelefono} onChange={(e) => setProveedorTelefono(e.target.value)} placeholder="3001234567" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Dirección proveedor</Label>
              <Input value={proveedorDireccion} onChange={(e) => setProveedorDireccion(e.target.value)} placeholder="Calle 123 #45-67" />
            </div>
            <div className="space-y-2">
              <Label>Sede</Label>
              <Input value={sede} onChange={(e) => setSede(e.target.value)} placeholder="Principal" />
            </div>

            <div className="space-y-2">
              <Label>Número factura</Label>
              <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="FV-001" />
            </div>
            <div className="space-y-2">
              <Label>Número orden</Label>
              <Input value={numeroOrden} onChange={(e) => setNumeroOrden(e.target.value)} placeholder="OC-001" />
            </div>
            <div className="space-y-2">
              <Label>Número pedido</Label>
              <Input value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} placeholder="P-001" />
            </div>

            <div className="space-y-2 lg:col-span-4">
              <Label>Observaciones</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas internas..." />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Detalle</h3>
              <Button type="button" variant="outline" onClick={addItem}>
                Agregar ítem
              </Button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Descripción</th>
                    <th className="py-2 text-left">Cantidad</th>
                    <th className="py-2 text-left">Precio unit.</th>
                    <th className="py-2 text-left">Descuento</th>
                    <th className="py-2 text-left">IVA</th>
                    <th className="py-2 text-left">Total línea</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b align-top">
                      <td className="py-2 pr-2 min-w-[280px]">
                        <Input
                          value={it.descripcion}
                          onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                          placeholder="Descripción"
                        />
                      </td>
                      <td className="py-2 pr-2 w-[120px]">
                        <Input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => updateItem(idx, { cantidad: n(e.target.value, 1) })}
                        />
                      </td>
                      <td className="py-2 pr-2 w-[160px]">
                        <Input
                          type="number"
                          value={it.precioUnitario}
                          onChange={(e) => updateItem(idx, { precioUnitario: n(e.target.value, 0) })}
                        />
                      </td>
                      <td className="py-2 pr-2 w-[160px]">
                        <Input
                          type="number"
                          value={it.descuento}
                          onChange={(e) => updateItem(idx, { descuento: n(e.target.value, 0) })}
                        />
                      </td>
                      <td className="py-2 pr-2 w-[160px]">
                        <Input type="number" value={it.iva} onChange={(e) => updateItem(idx, { iva: n(e.target.value, 0) })} />
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">{formatCOP(computeLineTotal(it))}</td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Subtotal sin IVA</div>
                <div className="font-semibold">{formatCOP(totals.subtotalSinIva)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">IVA</div>
                <div className="font-semibold">{formatCOP(totals.iva)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Subtotal con IVA</div>
                <div className="font-semibold">{formatCOP(totals.subtotalConIva)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold">{formatCOP(totals.total)}</div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={createCompra} disabled={saving || !proveedorNombre.trim()}>
                {saving ? 'Guardando...' : 'Crear compra'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Compras registradas</CardTitle>
              <CardDescription>Busca por proveedor, factura, pedido, orden u observaciones.</CardDescription>
            </div>
            <div className="w-full max-w-md">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Fecha</th>
                  <th className="py-2 text-left">Proveedor</th>
                  <th className="py-2 text-left">Factura</th>
                  <th className="py-2 text-left">Total</th>
                  <th className="py-2 text-left">Pagado</th>
                  <th className="py-2 text-left">Saldo</th>
                  <th className="py-2 text-left">Autorizado</th>
                  <th className="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 whitespace-nowrap">{new Date(c.fechaCompra).toLocaleDateString('es-CO')}</td>
                    <td className="py-2">{c.proveedorNombre}</td>
                    <td className="py-2">{c.numeroFactura ?? '—'}</td>
                    <td className="py-2 whitespace-nowrap">{formatCOP(c.total)}</td>
                    <td className="py-2 whitespace-nowrap">{formatCOP(n(c.pagado, 0))}</td>
                    <td className="py-2 whitespace-nowrap">{formatCOP(n(c.saldo, n(c.total, 0) - n(c.pagado, 0)))}</td>
                    <td className="py-2">{c.autorizado ? 'Sí' : 'No'}</td>
                    <td className="py-2 text-right space-x-2">
                      <Button variant="outline" onClick={() => openPagos(c)}>
                        Pagos
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline">Ver</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Compra</DialogTitle>
                            <DialogDescription>
                              {c.proveedorNombre} — {formatCOP(c.total)}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-3 text-sm md:grid-cols-2">
                            <div>
                              <div className="text-muted-foreground">Fecha</div>
                              <div>{new Date(c.fechaCompra).toLocaleDateString('es-CO')}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Sede</div>
                              <div>{c.sede ?? '—'}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Quién recibe</div>
                              <div>{c.recibidoPorNombre ?? '—'}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Factura / Orden / Pedido</div>
                              <div>
                                {(c.numeroFactura ?? '—') + ' / ' + (c.numeroOrden ?? '—') + ' / ' + (c.numeroPedido ?? '—')}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="py-2 text-left">Descripción</th>
                                  <th className="py-2 text-left">Cant.</th>
                                  <th className="py-2 text-left">P.Unit</th>
                                  <th className="py-2 text-left">Desc</th>
                                  <th className="py-2 text-left">IVA</th>
                                  <th className="py-2 text-left">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.items.map((it) => (
                                  <tr key={it.id} className="border-b">
                                    <td className="py-2">{it.descripcion}</td>
                                    <td className="py-2">{it.cantidad}</td>
                                    <td className="py-2 whitespace-nowrap">{formatCOP(it.precioUnitario)}</td>
                                    <td className="py-2 whitespace-nowrap">{formatCOP(it.descuento)}</td>
                                    <td className="py-2 whitespace-nowrap">{formatCOP(it.iva)}</td>
                                    <td className="py-2 whitespace-nowrap">{formatCOP(it.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg border p-3">
                              <div className="text-muted-foreground">Subtotal sin IVA</div>
                              <div className="font-semibold">{formatCOP(c.subtotalSinIva)}</div>
                            </div>
                            <div className="rounded-lg border p-3">
                              <div className="text-muted-foreground">IVA</div>
                              <div className="font-semibold">{formatCOP(c.iva)}</div>
                            </div>
                            <div className="rounded-lg border p-3">
                              <div className="text-muted-foreground">Subtotal con IVA</div>
                              <div className="font-semibold">{formatCOP(c.subtotalConIva)}</div>
                            </div>
                            <div className="rounded-lg border p-3">
                              <div className="text-muted-foreground">Total</div>
                              <div className="font-semibold">{formatCOP(c.total)}</div>
                            </div>
                          </div>

                          {c.observaciones && (
                            <div className="mt-4 text-sm">
                              <div className="text-muted-foreground">Observaciones</div>
                              <div className="whitespace-pre-wrap">{c.observaciones}</div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      <Button variant={c.autorizado ? 'outline' : 'default'} onClick={() => toggleAutorizar(c)}>
                        {c.autorizado ? 'Quitar autorización' : 'Autorizar'}
                      </Button>
                      <Button variant="outline" onClick={() => deleteCompra(c)}>
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}

                {!loading && compras.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={8}>
                      Sin resultados
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={8}>
                      Cargando...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pagos / Abonos</DialogTitle>
            <DialogDescription>
              {pagoCompra ? `${pagoCompra.proveedorNombre} — Total ${formatCOP(pagoCompra.total)}` : '—'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Pagado</div>
              <div className="font-semibold">{formatCOP(pagoSummary.pagado)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Saldo</div>
              <div className="font-semibold">{formatCOP(pagoSummary.saldo)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Estado</div>
              <div className="font-semibold">
                {pagoSummary.pagado <= 0 ? 'Debe' : pagoSummary.saldo > 0 ? 'Parcial' : 'Pagado'}
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={pagoForm.fecha}
                onChange={(e) => setPagoForm((p) => ({ ...p, fecha: e.target.value }))}
                disabled={pagoLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
                disabled={pagoLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <select
                value={pagoForm.metodo}
                onChange={(e) => setPagoForm((p) => ({ ...p, metodo: e.target.value as CompraPago['metodo'] }))}
                disabled={pagoLoading}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                value={pagoForm.referencia}
                onChange={(e) => setPagoForm((p) => ({ ...p, referencia: e.target.value }))}
                disabled={pagoLoading}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observaciones</Label>
              <Textarea
                value={pagoForm.observaciones}
                onChange={(e) => setPagoForm((p) => ({ ...p, observaciones: e.target.value }))}
                rows={2}
                disabled={pagoLoading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Soporte (opcional)</Label>
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
                    Adjuntado: {pagoForm.soporteFile.name}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagoLoading}
                    onClick={() => setPagoForm((p) => ({ ...p, soporteFile: null }))}
                  >
                    Quitar
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">PDF o imagen del recibo/soporte.</p>
              )}
            </div>
          </div>

          <div className="mt-2 flex justify-end">
            <Button onClick={registrarPago} disabled={pagoLoading || !pagoCompra}>
              {pagoLoading ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Fecha</th>
                  <th className="py-2 text-left">Método</th>
                  <th className="py-2 text-left">Referencia</th>
                  <th className="py-2 text-left">Soporte</th>
                  <th className="py-2 text-left">Monto</th>
                  <th className="py-2 text-left">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 whitespace-nowrap">{new Date(p.fecha).toLocaleDateString('es-CO')}</td>
                    <td className="py-2">{p.metodo}</td>
                    <td className="py-2">{p.referencia ?? '—'}</td>
                    <td className="py-2">
                      {p.soporteUrl ? (
                        <a
                          href={p.soporteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                          title={p.soporteOriginalName ?? 'Abrir soporte'}
                        >
                          Ver
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">{formatCOP(p.monto)}</td>
                    <td className="py-2">{p.user?.name || p.user?.email || '—'}</td>
                  </tr>
                ))}
                {!pagoLoading && pagos.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                      Sin pagos registrados
                    </td>
                  </tr>
                )}
                {pagoLoading && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                      Cargando...
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
