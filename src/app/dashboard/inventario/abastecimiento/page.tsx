'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CatalogModuleTabs } from '@/components/inventory/catalog-module-tabs'
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
import { useCurrentUserAccess } from '@/hooks/use-current-user-access'
import { cn, formatUnidadMedidaLabel } from '@/lib/utils'

type Warehouse = {
  id: string
  nombre: string
  codigo: string | null
  isDefault: boolean
  isSupplyHub: boolean
  sedeId: string | null
}

type Material = {
  id: string
  nombre: string
  externalId?: string | null
  unidadMedida: string
}

type SupplyRequest = {
  id: string
  numero: string
  status: 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO'
  priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'
  note: string | null
  taskId: string | null
  createdAt: string
  fulfilledAt: string | null
  requestingWarehouse: { id: string; nombre: string; sedeId: string | null }
  supplyWarehouse: { id: string; nombre: string; sedeId: string | null; isSupplyHub: boolean }
  requestedBy?: { id: string; name: string | null; email: string | null } | null
  fulfilledBy?: { id: string; name: string | null; email: string | null } | null
  items: Array<{
    id: string
    quantity: number
    note: string | null
    material: { id: string; nombre: string; externalId?: string | null; unidadMedida: string }
  }>
}

type ApiResponse<T> = { success?: boolean; data?: T; error?: string }

type RequestItemForm = {
  materialId: string
  quantity: string
  note: string
}

function formatMaterialName(material: Material | SupplyRequest['items'][number]['material']) {
  const code = String(material.externalId ?? '').trim()
  return code ? `(${code}) ${material.nombre}` : material.nombre
}

export default function AbastecimientoInventarioPage() {
  const { hasWriteAccess } = useCurrentUserAccess()
  const canManageInventory = hasWriteAccess('INVENTARIO')

  const [loading, setLoading] = useState(true)
  const [savingHub, setSavingHub] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [requests, setRequests] = useState<SupplyRequest[]>([])

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO'>('ALL')
  const [requestingWarehouseFilter, setRequestingWarehouseFilter] = useState('')

  const [hubWarehouseId, setHubWarehouseId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    requestingWarehouseId: '',
    supplyWarehouseId: '',
    priority: 'MEDIA' as 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE',
    note: '',
    items: [{ materialId: '', quantity: '1', note: '' }] as RequestItemForm[],
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (statusFilter !== 'ALL') query.set('status', statusFilter)
      if (requestingWarehouseFilter) query.set('requestingWarehouseId', requestingWarehouseFilter)

      const [warehousesRes, materialsRes, requestsRes] = await Promise.all([
        fetch('/api/bodegas', { cache: 'no-store' }),
        fetch('/api/materiales?activo=true', { cache: 'no-store' }),
        fetch(`/api/inventario/abastecimiento${query.toString() ? `?${query.toString()}` : ''}`, { cache: 'no-store' }),
      ])

      const warehousesJson = (await warehousesRes.json().catch(() => ({}))) as ApiResponse<Warehouse[]>
      const materialsJson = (await materialsRes.json().catch(() => ({}))) as ApiResponse<Material[]>
      const requestsJson = (await requestsRes.json().catch(() => ({}))) as ApiResponse<SupplyRequest[]>

      if (!warehousesRes.ok || !warehousesJson.success || !Array.isArray(warehousesJson.data)) {
        setError(warehousesJson.error || 'No se pudieron cargar las bodegas.')
        setWarehouses([])
      } else {
        setWarehouses(warehousesJson.data)
        const currentHub = warehousesJson.data.find((warehouse) => warehouse.isSupplyHub)
        setHubWarehouseId(currentHub?.id ?? '')
      }

      if (materialsRes.ok && materialsJson.success && Array.isArray(materialsJson.data)) {
        setMaterials(materialsJson.data)
      } else {
        setMaterials([])
      }

      if (requestsRes.ok && requestsJson.success && Array.isArray(requestsJson.data)) {
        setRequests(requestsJson.data)
      } else if (!error) {
        setError(requestsJson.error || 'No se pudieron cargar las solicitudes.')
        setRequests([])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [error, requestingWarehouseFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const childWarehouses = useMemo(
    () => warehouses.filter((warehouse) => !warehouse.isSupplyHub),
    [warehouses]
  )

  useEffect(() => {
    if (!dialogOpen) return
    if (form.requestingWarehouseId) return
    const fallback = childWarehouses.find((warehouse) => warehouse.isDefault)?.id || childWarehouses[0]?.id || ''
    const hubId = warehouses.find((warehouse) => warehouse.isSupplyHub)?.id || hubWarehouseId
    setForm((current) => ({
      ...current,
      requestingWarehouseId: fallback,
      supplyWarehouseId: current.supplyWarehouseId || hubId,
    }))
  }, [childWarehouses, dialogOpen, form.requestingWarehouseId, hubWarehouseId, warehouses])

  function openNewDialog() {
    setForm({
      requestingWarehouseId: childWarehouses.find((warehouse) => warehouse.isDefault)?.id || childWarehouses[0]?.id || '',
      supplyWarehouseId: hubWarehouseId,
      priority: 'MEDIA',
      note: '',
      items: [{ materialId: '', quantity: '1', note: '' }],
    })
    setDialogOpen(true)
  }

  async function saveSupplyHub() {
    if (!hubWarehouseId) {
      setError('Selecciona la bodega abastecedora principal.')
      return
    }

    setSavingHub(true)
    setError(null)
    try {
      const response = await fetch('/api/bodegas/supply-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId: hubWarehouseId }),
      })
      const json = (await response.json().catch(() => ({}))) as ApiResponse<null>
      if (!response.ok || !json.success) {
        setError(json.error || 'No se pudo guardar la bodega abastecedora.')
        return
      }
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error inesperado')
    } finally {
      setSavingHub(false)
    }
  }

  function updateItem(index: number, next: Partial<RequestItemForm>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)),
    }))
  }

  async function submitRequest() {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/inventario/abastecimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestingWarehouseId: form.requestingWarehouseId,
          supplyWarehouseId: form.supplyWarehouseId || hubWarehouseId,
          priority: form.priority,
          note: form.note || null,
          items: form.items,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as ApiResponse<SupplyRequest>
      if (!response.ok || !json.success) {
        setError(json.error || 'No se pudo crear la solicitud.')
        return
      }
      setDialogOpen(false)
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  async function fulfillRequest(requestId: string) {
    setFulfillingId(requestId)
    setError(null)
    try {
      const response = await fetch(`/api/inventario/abastecimiento/${requestId}/fulfill`, { method: 'POST' })
      const json = (await response.json().catch(() => ({}))) as ApiResponse<SupplyRequest>
      if (!response.ok || !json.success) {
        setError(json.error || 'No se pudo completar la solicitud.')
        return
      }
      await load()
    } catch (fulfillError) {
      setError(fulfillError instanceof Error ? fulfillError.message : 'Error inesperado')
    } finally {
      setFulfillingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <CatalogModuleTabs />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Abastecimiento entre sedes</h1>
          <p className="text-muted-foreground">
            Centraliza solicitudes de las sedes hijas hacia la bodega padre, con prioridad, seguimiento y cumplimiento desde inventario.
          </p>
        </div>
        {canManageInventory ? <Button onClick={openNewDialog}>Nueva solicitud</Button> : null}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Bodega abastecedora</CardTitle>
            <CardDescription>
              Define la sede padre que surtirá a las demás sedes cuando creen requerimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Sede padre / bodega general</Label>
              <select
                value={hubWarehouseId}
                onChange={(event) => setHubWarehouseId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Selecciona una bodega…</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.nombre}{warehouse.codigo ? ` (${warehouse.codigo})` : ''}{warehouse.isDefault ? ' · Principal' : ''}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => void saveSupplyHub()} disabled={!canManageInventory || savingHub || !hubWarehouseId}>
              {savingHub ? 'Guardando…' : 'Guardar sede padre'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial por sede</CardTitle>
            <CardDescription>
              Filtra quién solicitó, prioridad, fechas y lo que se pidió a la bodega abastecedora.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <option value="ALL">Todos</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="COMPLETADO">Completadas</option>
                <option value="CANCELADO">Canceladas</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sede solicitante</Label>
              <select
                value={requestingWarehouseFilter}
                onChange={(event) => setRequestingWarehouseFilter(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Todas</option>
                {childWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes registradas</CardTitle>
          <CardDescription>
            Cada solicitud conserva el detalle de productos, cantidades, prioridad y su seguimiento operativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando solicitudes…</div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay solicitudes para los filtros actuales.</div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-900">{request.numero}</span>
                        <span className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          request.status === 'COMPLETADO'
                            ? 'bg-emerald-50 text-emerald-700'
                            : request.status === 'CANCELADO'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                        )}>
                          {request.status}
                        </span>
                        <span className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium',
                          request.priority === 'URGENTE'
                            ? 'bg-rose-100 text-rose-700'
                            : request.priority === 'ALTA'
                              ? 'bg-orange-100 text-orange-700'
                              : request.priority === 'BAJA'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-sky-100 text-sky-700'
                        )}>
                          Prioridad {request.priority.toLowerCase()}
                        </span>
                        {request.taskId ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">Seguimiento creado</span> : null}
                      </div>
                      <p className="text-sm text-slate-600">
                        {request.requestingWarehouse.nombre} solicitó a {request.supplyWarehouse.nombre} el {new Date(request.createdAt).toLocaleString('es-CO')}.
                      </p>
                      {request.note ? <p className="text-sm text-slate-600">Nota: {request.note}</p> : null}
                    </div>

                    {canManageInventory && request.status === 'PENDIENTE' ? (
                      <Button onClick={() => void fulfillRequest(request.id)} disabled={fulfillingId === request.id}>
                        {fulfillingId === request.id ? 'Cumpliendo…' : 'Cumplir solicitud'}
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {request.items.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                        <div className="font-medium text-slate-900">{formatMaterialName(item.material)}</div>
                        <div className="text-sm text-slate-600">
                          {item.quantity.toLocaleString('es-CO')} {formatUnidadMedidaLabel(item.material.unidadMedida)}
                        </div>
                        {item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span>Solicitó: {request.requestedBy?.name || request.requestedBy?.email || 'Sistema'}</span>
                    <span>Cant. de ítems: {request.items.length}</span>
                    {request.fulfilledAt ? <span>Completada: {new Date(request.fulfilledAt).toLocaleString('es-CO')}</span> : null}
                    {request.fulfilledBy?.name ? <span>Atendida por: {request.fulfilledBy.name}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de abastecimiento</DialogTitle>
            <DialogDescription>
              La sede hija puede pedir varios productos aunque hoy no tenga stock. La sede padre la surtirá después desde su inventario general.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Sede solicitante</Label>
              <select
                value={form.requestingWarehouseId}
                onChange={(event) => setForm((current) => ({ ...current, requestingWarehouseId: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Selecciona una sede…</option>
                {childWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Bodega abastecedora</Label>
              <select
                value={form.supplyWarehouseId || hubWarehouseId}
                onChange={(event) => setForm((current) => ({ ...current, supplyWarehouseId: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Selecciona una bodega…</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}{warehouse.isSupplyHub ? ' · Padre actual' : ''}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as typeof current.priority }))}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Nota general</Label>
              <Textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Contexto adicional para la sede padre o el equipo de seguimiento"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Productos solicitados</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm((current) => ({ ...current, items: [...current.items, { materialId: '', quantity: '1', note: '' }] }))}
              >
                Agregar producto
              </Button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={`${index}-${item.materialId}`} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1.4fr)_150px_minmax(0,1fr)_auto]">
                  <div className="space-y-2">
                    <Label>Producto</Label>
                    <select
                      value={item.materialId}
                      onChange={(event) => updateItem(index, { materialId: event.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">Selecciona un producto…</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>{formatMaterialName(material)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} inputMode="decimal" />
                  </div>

                  <div className="space-y-2">
                    <Label>Detalle</Label>
                    <Input value={item.note} onChange={(event) => updateItem(index, { note: event.target.value })} placeholder="Opcional" />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={form.items.length === 1}
                      onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button type="button" onClick={() => void submitRequest()} disabled={submitting || !canManageInventory}>
              {submitting ? 'Guardando…' : 'Crear solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}