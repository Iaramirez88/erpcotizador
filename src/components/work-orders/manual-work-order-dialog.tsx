'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

type ClienteOption = {
  id: string
  nombre: string
  documento?: string | null
}

type ResponsableOption = {
  id: string
  name: string | null
  email: string | null
}

type ManualItem = {
  id: string
  descripcion: string
  cantidad: string
  especificaciones: string
}

function emptyItem(): ManualItem {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    descripcion: '',
    cantidad: '1',
    especificaciones: '',
  }
}

export function ManualWorkOrderDialog({
  open,
  onOpenChange,
  responsables,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  responsables: ResponsableOption[]
  onCreated: (numero: string) => void | Promise<void>
}) {
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [areaResponsable, setAreaResponsable] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<ManualItem[]>([emptyItem()])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadClients() {
      setLoadingClients(true)
      setError('')
      try {
        const response = await fetch('/api/ordenes/clients', { cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.success) throw new Error(json?.error || 'No se pudieron cargar los clientes.')
        if (!cancelled) setClientes(Array.isArray(json.data) ? json.data : [])
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los clientes.')
      } finally {
        if (!cancelled) setLoadingClients(false)
      }
    }

    void loadClients()
    return () => {
      cancelled = true
    }
  }, [open])

  function resetForm() {
    setClienteId('')
    setAssignedToUserId('')
    setPriority('NORMAL')
    setFechaEntrega('')
    setAreaResponsable('')
    setObservaciones('')
    setItems([emptyItem()])
    setError('')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !submitting) resetForm()
    onOpenChange(nextOpen)
  }

  function updateItem(id: string, patch: Partial<ManualItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const validItems = items.filter((item) => item.descripcion.trim() && Number(item.cantidad) > 0)
    if (!clienteId || !validItems.length) {
      setError('Selecciona un cliente y agrega al menos un ítem válido.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'manual',
          clienteId,
          assignedToUserId: assignedToUserId || null,
          priority,
          fechaEntrega: fechaEntrega || null,
          areaResponsable,
          observaciones,
          items: validItems.map((item) => ({
            descripcion: item.descripcion.trim(),
            cantidad: Number(item.cantidad),
            especificaciones: item.especificaciones.trim(),
          })),
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) throw new Error(json?.error || 'No se pudo crear la orden de trabajo.')

      const numero = String(json.data?.numero || 'OT creada')
      resetForm()
      onOpenChange(false)
      await onCreated(numero)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo crear la orden de trabajo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva orden de trabajo</DialogTitle>
          <DialogDescription>Crea una ejecución directa para venta, garantía, mantenimiento o producción interna.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="manual-order-client">Cliente</Label>
              <select
                id="manual-order-client"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={clienteId}
                onChange={(event) => setClienteId(event.target.value)}
                disabled={loadingClients}
                required
              >
                <option value="">{loadingClients ? 'Cargando clientes...' : 'Seleccionar cliente'}</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}{cliente.documento ? ` · ${cliente.documento}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-order-priority">Prioridad</Label>
              <select
                id="manual-order-priority"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-order-assignee">Responsable</Label>
              <select
                id="manual-order-assignee"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={assignedToUserId}
                onChange={(event) => setAssignedToUserId(event.target.value)}
              >
                <option value="">Sin asignar</option>
                {responsables.map((responsable) => (
                  <option key={responsable.id} value={responsable.id}>
                    {responsable.name || responsable.email || 'Usuario'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-order-due">Fecha de entrega</Label>
              <Input id="manual-order-due" type="datetime-local" value={fechaEntrega} onChange={(event) => setFechaEntrega(event.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-order-area">Área responsable</Label>
              <Input id="manual-order-area" value={areaResponsable} onChange={(event) => setAreaResponsable(event.target.value)} placeholder="Producción, taller, soporte..." />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Productos o servicios a ejecutar</h3>
                <p className="text-xs text-muted-foreground">Las especificaciones quedan en el expediente operativo de la OT.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, emptyItem()])}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar ítem
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={item.id} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_110px_40px]">
                <div className="grid gap-2">
                  <Label htmlFor={`manual-item-${item.id}`}>Descripción {index + 1}</Label>
                  <Input id={`manual-item-${item.id}`} value={item.descripcion} onChange={(event) => updateItem(item.id, { descripcion: event.target.value })} placeholder="Ej. 1.000 volantes" required={index === 0} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`manual-quantity-${item.id}`}>Cantidad</Label>
                  <Input id={`manual-quantity-${item.id}`} type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(event) => updateItem(item.id, { cantidad: event.target.value })} />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="icon" title="Eliminar ítem" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:col-span-3">
                  <Label htmlFor={`manual-spec-${item.id}`}>Especificaciones</Label>
                  <Textarea id={`manual-spec-${item.id}`} value={item.especificaciones} onChange={(event) => updateItem(item.id, { especificaciones: event.target.value })} placeholder="Medidas, material, acabado, equipo, ubicación u otros datos necesarios para ejecutar el trabajo." rows={2} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-order-notes">Observaciones generales</Label>
            <Textarea id="manual-order-notes" value={observaciones} onChange={(event) => setObservaciones(event.target.value)} rows={3} />
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting || loadingClients}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear orden
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}