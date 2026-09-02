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
import { SearchableNativeSelect, type SearchableNativeSelectOption } from '@/components/ui/searchable-native-select'
import { Textarea } from '@/components/ui/textarea'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { useCurrentUserAccess } from '@/hooks/use-current-user-access'
import { subscribeToNotificationReceivedEvent } from '@/lib/notification-browser-events'
import { cn, formatUnidadMedidaLabel } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

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

type AvailableMaterial = Material & {
  availableQuantity: number
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

const AUTO_REFRESH_MS = 15_000

function formatMaterialName(material: Material | SupplyRequest['items'][number]['material']) {
  const code = String(material.externalId ?? '').trim()
  return code ? `(${code}) ${material.nombre}` : material.nombre
}

function describeSupplyRequest(request: SupplyRequest) {
  const totalItems = request.items.length
  const totalUnits = request.items.reduce((sum, item) => sum + item.quantity, 0)
  return `${request.requestingWarehouse.nombre} -> ${request.supplyWarehouse.nombre}. ${totalItems} referencia(s), ${totalUnits.toLocaleString('es-CO')} unidad(es) solicitadas.`
}

export default function AbastecimientoInventarioPage() {
  const { hasWriteAccess } = useCurrentUserAccess()
  const canManageInventory = hasWriteAccess('INVENTARIO')
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [savingHub, setSavingHub] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [loadingAvailableMaterials, setLoadingAvailableMaterials] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [availableMaterials, setAvailableMaterials] = useState<AvailableMaterial[]>([])
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

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true)
    }
    try {
      const query = new URLSearchParams()
      if (statusFilter !== 'ALL') query.set('status', statusFilter)
      if (requestingWarehouseFilter) query.set('requestingWarehouseId', requestingWarehouseFilter)

      const [warehousesRes, requestsRes] = await Promise.all([
        fetch('/api/bodegas', { cache: 'no-store' }),
        fetch(`/api/inventario/abastecimiento${query.toString() ? `?${query.toString()}` : ''}`, { cache: 'no-store' }),
      ])

      const warehousesJson = (await warehousesRes.json().catch(() => ({}))) as ApiResponse<Warehouse[]>
      const requestsJson = (await requestsRes.json().catch(() => ({}))) as ApiResponse<SupplyRequest[]>
      const nextErrors: string[] = []

      if (!warehousesRes.ok || !warehousesJson.success || !Array.isArray(warehousesJson.data)) {
        nextErrors.push(warehousesJson.error || 'No se pudieron cargar las bodegas.')
        setWarehouses([])
      } else {
        setWarehouses(warehousesJson.data)
        const currentHub = warehousesJson.data.find((warehouse) => warehouse.isSupplyHub)
        setHubWarehouseId(currentHub?.id ?? '')
      }

      if (requestsRes.ok && requestsJson.success && Array.isArray(requestsJson.data)) {
        setRequests(requestsJson.data)
      } else {
        nextErrors.push(requestsJson.error || 'No se pudieron cargar las solicitudes.')
        setRequests([])
      }

      setError(nextErrors[0] ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error inesperado')
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [requestingWarehouseFilter, statusFilter])

  const effectiveSupplyWarehouseId = form.supplyWarehouseId || hubWarehouseId

  const loadAvailableMaterials = useCallback(async (warehouseId: string) => {
    if (!warehouseId) {
      setAvailableMaterials([])
      return
    }

    setLoadingAvailableMaterials(true)
    try {
      const query = new URLSearchParams({
        activo: 'true',
        warehouseId,
        stockMin: '0.000001',
        pageSize: 'all',
      })
      const response = await fetch(`/api/materiales?${query.toString()}`, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as ApiResponse<Array<Material & { stocks?: Array<{ quantity?: number | null }> }>>

      if (!response.ok || !json.success || !Array.isArray(json.data)) {
        setAvailableMaterials([])
        setError(json.error || 'No se pudo cargar el stock disponible de la bodega abastecedora.')
        return
      }

      setAvailableMaterials(
        json.data
          .map((material) => ({
            id: material.id,
            nombre: material.nombre,
            externalId: material.externalId ?? null,
            unidadMedida: material.unidadMedida,
            availableQuantity: Number(material.stocks?.[0]?.quantity ?? 0),
          }))
          .filter((material) => Number.isFinite(material.availableQuantity) && material.availableQuantity > 0)
      )
    } catch (loadError) {
      setAvailableMaterials([])
      setError(loadError instanceof Error ? loadError.message : 'Error inesperado')
    } finally {
      setLoadingAvailableMaterials(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void load({ silent: true })
    }, AUTO_REFRESH_MS)

    const unsubscribe = subscribeToNotificationReceivedEvent((notification) => {
      if ((notification.actionUrl || '').startsWith('/dashboard/inventario/abastecimiento')) {
        void load({ silent: true })
      }
    })

    return () => {
      window.clearInterval(intervalId)
      unsubscribe()
    }
  }, [load])

  const childWarehouses = useMemo(
    () => warehouses.filter((warehouse) => !warehouse.isSupplyHub),
    [warehouses]
  )

  const availableMaterialMap = useMemo(
    () => new Map(availableMaterials.map((material) => [material.id, material])),
    [availableMaterials]
  )

  const availableMaterialOptions = useMemo<SearchableNativeSelectOption[]>(
    () => availableMaterials.map((material) => ({
      value: material.id,
      label: `${formatMaterialName(material)} · Disponible ${material.availableQuantity.toLocaleString('es-CO')} ${formatUnidadMedidaLabel(material.unidadMedida)}`,
    })),
    [availableMaterials]
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

  useEffect(() => {
    if (!dialogOpen) return
    if (!effectiveSupplyWarehouseId) {
      setAvailableMaterials([])
      return
    }
    void loadAvailableMaterials(effectiveSupplyWarehouseId)
  }, [dialogOpen, effectiveSupplyWarehouseId, loadAvailableMaterials])

  useEffect(() => {
    if (!dialogOpen) return
    const validMaterialIds = new Set(availableMaterials.map((material) => material.id))
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (
        item.materialId && !validMaterialIds.has(item.materialId)
          ? { ...item, materialId: '' }
          : item
      )),
    }))
  }, [availableMaterials, dialogOpen])

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

  function validateRequestedStock() {
    const totals = new Map<string, number>()
    for (const item of form.items) {
      const materialId = item.materialId.trim()
      const quantity = Number(item.quantity)
      if (!materialId || !Number.isFinite(quantity) || quantity <= 0) continue
      totals.set(materialId, (totals.get(materialId) ?? 0) + quantity)
    }

    for (const [materialId, quantity] of totals.entries()) {
      const material = availableMaterialMap.get(materialId)
      if (!material) {
        const message = 'Uno de los productos ya no tiene stock disponible en la bodega abastecedora.'
        setError(message)
        toast({ title: 'Stock no disponible', description: message, variant: 'destructive' })
        return false
      }
      if (quantity > material.availableQuantity) {
        const message = `La cantidad solicitada de ${formatMaterialName(material)} supera el stock disponible (${material.availableQuantity.toLocaleString('es-CO')} ${formatUnidadMedidaLabel(material.unidadMedida)}).`
        setError(message)
        toast({ title: 'Cantidad superior al stock', description: message, variant: 'destructive' })
        return false
      }
    }

    return true
  }

  async function submitRequest() {
    if (!validateRequestedStock()) {
      return
    }

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
        const message = json.error || 'No se pudo crear la solicitud.'
        setError(message)
        toast({ title: 'No se creó la solicitud', description: message, variant: 'destructive' })
        return
      }
      setDialogOpen(false)
      if (json.data) {
        toast({
          title: `Solicitud creada ${json.data.numero}`,
          description: describeSupplyRequest(json.data),
        })
      }
      await load()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Error inesperado'
      setError(message)
      toast({ title: 'No se creó la solicitud', description: message, variant: 'destructive' })
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
        const message = json.error || 'No se pudo completar la solicitud.'
        setError(message)
        toast({ title: 'No se pudo cumplir la solicitud', description: message, variant: 'destructive' })
        return
      }
      if (json.data) {
        toast({
          title: `Solicitud cumplida ${json.data.numero}`,
          description: describeSupplyRequest(json.data),
        })
      }
      await load()
    } catch (fulfillError) {
      const message = fulfillError instanceof Error ? fulfillError.message : 'Error inesperado'
      setError(message)
      toast({ title: 'No se pudo cumplir la solicitud', description: message, variant: 'destructive' })
    } finally {
      setFulfillingId(null)
    }
  }

  async function cancelRequest(requestId: string) {
    const reason = window.prompt('Motivo opcional para marcar esta solicitud como no posible:')
    if (reason === null) return

    setCancelingId(requestId)
    setError(null)
    try {
      const response = await fetch(`/api/inventario/abastecimiento/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || null }),
      })
      const json = (await response.json().catch(() => ({}))) as ApiResponse<SupplyRequest>
      if (!response.ok || !json.success) {
        const message = json.error || 'No se pudo marcar la solicitud como no posible.'
        setError(message)
        toast({ title: 'No se actualizó la solicitud', description: message, variant: 'destructive' })
        return
      }
      if (json.data) {
        toast({
          title: `Solicitud cancelada ${json.data.numero}`,
          description: reason.trim()
            ? `Se marcó como no posible. Motivo: ${reason.trim()}`
            : 'Se marcó como no posible y quedó trazabilidad en el historial.',
        })
      }
      await load()
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : 'Error inesperado'
      setError(message)
      toast({ title: 'No se actualizó la solicitud', description: message, variant: 'destructive' })
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Compras', href: '/dashboard/compras' },
          { label: 'Solicitudes de compra' },
        ]}
        title="Solicitudes de compra"
        description="Centraliza solicitudes internas entre sedes, con prioridad, seguimiento y cumplimiento desde la bodega abastecedora."
        actions={canManageInventory ? <Button onClick={openNewDialog}>Nueva solicitud</Button> : null}
      />

      <CatalogModuleTabs group="purchases" />

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
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void fulfillRequest(request.id)} disabled={fulfillingId === request.id || cancelingId === request.id}>
                          {fulfillingId === request.id ? 'Cumpliendo…' : 'Cumplir solicitud'}
                        </Button>
                        <Button variant="outline" onClick={() => void cancelRequest(request.id)} disabled={cancelingId === request.id || fulfillingId === request.id}>
                          {cancelingId === request.id ? 'Actualizando…' : 'No es posible'}
                        </Button>
                      </div>
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
                    <SearchableNativeSelect
                      value={item.materialId}
                      onChange={(value) => updateItem(index, { materialId: value })}
                      options={availableMaterialOptions}
                      disabled={loadingAvailableMaterials || !effectiveSupplyWarehouseId}
                      includeAllOption={{ value: '', label: loadingAvailableMaterials ? 'Cargando productos…' : 'Selecciona un producto…' }}
                      emptyText="No hay referencias con stock para esta bodega"
                      searchPlaceholder="Buscar por nombre o código…"
                      searchClassName="h-10"
                      selectClassName="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    />
                    {item.materialId && availableMaterialMap.get(item.materialId) ? (
                      <p className="text-xs text-slate-500">
                        Disponible actual: {availableMaterialMap.get(item.materialId)!.availableQuantity.toLocaleString('es-CO')} {formatUnidadMedidaLabel(availableMaterialMap.get(item.materialId)!.unidadMedida)}
                      </p>
                    ) : null}
                    {!item.materialId && !loadingAvailableMaterials && effectiveSupplyWarehouseId && availableMaterialOptions.length === 0 ? (
                      <p className="text-xs text-amber-700">La bodega abastecedora no tiene referencias con stock disponible.</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} inputMode="decimal" />
                    {item.materialId && availableMaterialMap.get(item.materialId) && Number(item.quantity) > availableMaterialMap.get(item.materialId)!.availableQuantity ? (
                      <p className="text-xs text-red-600">La cantidad supera el disponible actual.</p>
                    ) : null}
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