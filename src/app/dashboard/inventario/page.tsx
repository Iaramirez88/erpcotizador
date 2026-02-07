/**
 * Página de Inventario (MVP)
 * Permite registrar entradas/salidas/ajustes sobre materiales (productos ofrecidos).
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatUnidadMedidaLabel } from "@/lib/utils"
import { Download } from 'lucide-react'

type Material = {
  id: string
  nombre: string
  stockActual: number
  stockMinimo: number
  unidadMedida: string
  proveedor?: string | null
  imagenUrl?: string | null
  activo: boolean
}

type Bodega = {
  id: string
  nombre: string
  codigo: string | null
  isDefault: boolean
}

type Movement = {
  id: string
  type: "IN" | "OUT" | "ADJUST" | string
  quantity: number
  stockBefore: number
  stockAfter: number
  note: string | null
  createdAt: string
  material: { id: string; nombre: string; unidadMedida: string }
  warehouse?: { id: string; nombre: string } | null
}

type ProveedorLite = {
  id: string
  nombre: string
  nit?: string | null
}

function n(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

export default function InventarioPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState("")

  const [warehouseFilterId, setWarehouseFilterId] = useState("")

  const exportExcel = useCallback(() => {
    const params = new URLSearchParams()
    if (warehouseFilterId) params.set('warehouseId', warehouseFilterId)
    const url = params.toString() ? `/api/inventario/export?${params.toString()}` : '/api/inventario/export'
    window.location.href = url
  }, [warehouseFilterId])

  const [form, setForm] = useState({
    materialId: "",
    type: "IN" as "IN" | "OUT" | "ADJUST",
    quantity: "",
    newStock: "",
    warehouseId: "",
    note: "",
    updateProveedor: false,
    proveedor: "",
  })

  const [proveedorMatches, setProveedorMatches] = useState<ProveedorLite[]>([])
  const [proveedorLoading, setProveedorLoading] = useState(false)
  const [proveedorCreateOpen, setProveedorCreateOpen] = useState(false)
  const [proveedorNuevoNombre, setProveedorNuevoNombre] = useState("")
  const [proveedorNuevoNit, setProveedorNuevoNit] = useState("")
  const [proveedorCreateSaving, setProveedorCreateSaving] = useState(false)
  const [proveedorError, setProveedorError] = useState("")

  const defaultBodegaId = useMemo(() => bodegas.find((b) => b.isDefault)?.id ?? "", [bodegas])

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const movementsUrl = new URL("/api/inventario", window.location.origin)
      movementsUrl.searchParams.set("limit", "25")
      if (warehouseFilterId) movementsUrl.searchParams.set("warehouseId", warehouseFilterId)

      const [resMaterials, resMovements] = await Promise.all([
        fetch(`/api/materiales?search=${encodeURIComponent(search)}`),
        fetch(movementsUrl.toString()),
      ])

      const resBodegas = await fetch("/api/bodegas")

      const jsonMaterials = (await resMaterials.json().catch(() => ({}))) as { success?: boolean; data?: Material[] }
      const jsonMovements = (await resMovements.json().catch(() => ({}))) as { success?: boolean; data?: Movement[] }
      const jsonBodegas = (await resBodegas.json().catch(() => ({}))) as { success?: boolean; data?: Bodega[] }

      if (resMaterials.ok && jsonMaterials.success && Array.isArray(jsonMaterials.data)) {
        setMaterials(jsonMaterials.data)
      }

      if (resMovements.ok && jsonMovements.success && Array.isArray(jsonMovements.data)) {
        setMovements(jsonMovements.data)
      }

      if (resBodegas.ok && jsonBodegas.success && Array.isArray(jsonBodegas.data)) {
        setBodegas(jsonBodegas.data)
      }

      if (!resMaterials.ok) setError("No se pudo cargar materiales")
      if (!resMovements.ok) setError("No se pudo cargar movimientos")
      if (!resBodegas.ok) setError("No se pudo cargar sedes")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, warehouseFilterId])

  useEffect(() => {
    if (!form.warehouseId && defaultBodegaId) {
      setForm((p) => ({ ...p, warehouseId: defaultBodegaId }))
    }
  }, [defaultBodegaId, form.warehouseId])

  const activeMaterials = useMemo(() => materials.filter((m) => m.activo !== false), [materials])

  const selectedMaterial = useMemo(
    () => activeMaterials.find((m) => m.id === form.materialId) ?? null,
    [activeMaterials, form.materialId]
  )

  const canUpdateProveedor = form.type === 'IN'

  useEffect(() => {
    // Si el tipo deja de ser entrada, desactivamos la opción.
    if (!canUpdateProveedor && form.updateProveedor) {
      setForm((p) => ({ ...p, updateProveedor: false }))
      setProveedorCreateOpen(false)
      setProveedorError("")
    }
  }, [canUpdateProveedor, form.updateProveedor])

  useEffect(() => {
    if (!isModalOpen) return
    if (!form.updateProveedor) return

    const q = String(form.proveedor || '').trim()
    if (!q) {
      setProveedorMatches([])
      setProveedorLoading(false)
      return
    }

    const ac = new AbortController()
    const t = setTimeout(async () => {
      try {
        setProveedorLoading(true)
        const url = new URL('/api/proveedores', window.location.origin)
        url.searchParams.set('search', q)
        url.searchParams.set('activo', 'true')
        const res = await fetch(url.toString(), { signal: ac.signal })
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ProveedorLite[] } | null
        if (ac.signal.aborted) return
        if (res.ok && json?.success && Array.isArray(json.data)) {
          setProveedorMatches(json.data.slice(0, 6))
        } else {
          setProveedorMatches([])
        }
      } catch {
        if (!ac.signal.aborted) setProveedorMatches([])
      } finally {
        if (!ac.signal.aborted) setProveedorLoading(false)
      }
    }, 250)

    return () => {
      ac.abort()
      clearTimeout(t)
    }
  }, [isModalOpen, form.updateProveedor, form.proveedor])

  function openModal() {
    const defaultMaterialId = activeMaterials[0]?.id ?? ""
    setForm((prev) => ({ ...prev, materialId: prev.materialId || defaultMaterialId }))
    setIsModalOpen(true)
  }

  async function createProveedor() {
    const nombre = proveedorNuevoNombre.trim()
    const nit = proveedorNuevoNit.trim()
    if (!nombre) {
      setProveedorError('El nombre del proveedor es requerido.')
      return
    }

    setProveedorError('')
    setProveedorCreateSaving(true)
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, nit: nit || null }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ProveedorLite; error?: string } | null
      if (!res.ok || !json?.success || !json.data?.nombre) {
        setProveedorError(json?.error || 'No se pudo crear el proveedor.')
        return
      }

      setForm((p) => ({ ...p, proveedor: json.data!.nombre }))
      setProveedorCreateOpen(false)
      setProveedorNuevoNombre('')
      setProveedorNuevoNit('')
      setProveedorMatches((prev) => {
        const exists = prev.some((x) => x.id === json.data!.id)
        return exists ? prev : [json.data!, ...prev].slice(0, 6)
      })
    } finally {
      setProveedorCreateSaving(false)
    }
  }

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        materialId: form.materialId,
        type: form.type,
        warehouseId: form.warehouseId || undefined,
        note: form.note || undefined,
      }

      if (form.updateProveedor && form.type === 'IN') {
        payload.updateProveedor = true
        payload.proveedor = String(form.proveedor || '').trim()
      }

      if (form.type === "ADJUST") {
        payload.newStock = Number(form.newStock)
      } else {
        payload.quantity = Number(form.quantity)
      }

      const res = await fetch("/api/inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || "No se pudo registrar el movimiento")
        return
      }

      setIsModalOpen(false)
      setForm((prev) => ({ ...prev, quantity: "", newStock: "", note: "", updateProveedor: false, proveedor: "" }))
      setProveedorMatches([])
      setProveedorCreateOpen(false)
      setProveedorNuevoNombre("")
      setProveedorNuevoNit("")
      setProveedorError("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setIsSubmitting(false)
    }
  }

  function movementLabel(type: Movement["type"]) {
    if (type === "IN") return "Entrada"
    if (type === "OUT") return "Salida"
    if (type === "ADJUST") return "Ajuste"
    return String(type)
  }

  function movementBadgeClass(type: Movement["type"]) {
    if (type === "IN") return "bg-green-50 text-green-700"
    if (type === "OUT") return "bg-red-50 text-red-700"
    if (type === "ADJUST") return "bg-blue-50 text-blue-700"
    return "bg-gray-100 text-gray-700"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-tour="inventario-title">Inventario</h1>
          <p className="text-muted-foreground">Entradas, salidas y ajustes de stock por material.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={openModal} disabled={isLoading} data-tour="inventario-movimiento">
            Registrar movimiento
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Stock por material</CardTitle>
          <CardDescription>Busca y revisa niveles de stock actuales.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              data-tour="inventario-search"
              placeholder="Buscar material…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => void load()} disabled={isLoading}>
              Refrescar
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : activeMaterials.length === 0 ? (
            <div className="text-sm text-gray-600">No hay materiales para mostrar.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3 w-12">Img</th>
                    <th className="py-2 pr-4">Material</th>
                    <th className="py-2 pr-4">Stock</th>
                    <th className="py-2 pr-4">Mínimo</th>
                    <th className="py-2 pr-4">Unidad</th>
                    <th className="py-2 pr-4">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMaterials.map((m) => {
                    const low = n(m.stockActual) <= n(m.stockMinimo)
                    return (
                      <tr key={m.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.imagenUrl || "/placeholder-product.svg"}
                            alt={m.nombre}
                            className="h-8 w-8 rounded border object-cover bg-white"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-product.svg"
                            }}
                          />
                        </td>
                        <td className="py-2 pr-4 font-medium text-gray-900">{m.nombre}</td>
                        <td className={cn("py-2 pr-4", low ? "text-red-700 font-semibold" : "text-gray-900")}>
                          {n(m.stockActual).toLocaleString("es-CO")} 
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{n(m.stockMinimo).toLocaleString("es-CO")}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatUnidadMedidaLabel(m.unidadMedida)}</td>
                        <td className="py-2 pr-4 text-gray-700">{m.proveedor || "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>Últimos movimientos registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
            <div className="text-sm text-gray-700">Filtrar por sede:</div>
            <select
              className="border border-gray-200 rounded-md px-3 py-2 text-sm max-w-sm"
              value={warehouseFilterId}
              onChange={(e) => setWarehouseFilterId(e.target.value)}
            >
              <option value="">Todas</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}{b.isDefault ? " (Principal)" : ""}
                </option>
              ))}
            </select>
          </div>

          {movements.length === 0 ? (
            <div className="text-sm text-gray-600">Sin movimientos aún.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Material</th>
                    <th className="py-2 pr-4">Sede</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">Delta</th>
                    <th className="py-2 pr-4">Antes → Después</th>
                    <th className="py-2 pr-4">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mv) => (
                    <tr key={mv.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 text-gray-700">
                        {new Date(mv.createdAt).toLocaleString("es-CO")}
                      </td>
                      <td className="py-2 pr-4 font-medium text-gray-900">{mv.material?.nombre || "—"}</td>
                      <td className="py-2 pr-4 text-gray-700">{mv.warehouse?.nombre || "—"}</td>
                      <td className="py-2 pr-4">
                        <span className={cn("text-xs font-semibold px-2 py-1 rounded", movementBadgeClass(mv.type))}>
                          {movementLabel(mv.type)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-900">{n(mv.quantity).toLocaleString("es-CO")}</td>
                      <td className="py-2 pr-4 text-gray-700">
                        {n(mv.stockBefore).toLocaleString("es-CO")} → {n(mv.stockAfter).toLocaleString("es-CO")}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{mv.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>Registra una entrada, salida o ajuste de stock.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitMovement} className="space-y-4">
            <div className="space-y-2">
              <Label>Material</Label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={form.materialId}
                onChange={(e) => setForm((p) => ({ ...p, materialId: e.target.value }))}
                required
              >
                {activeMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Sede</Label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={form.warehouseId}
                onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
              >
                <option value="">Global (sin sede)</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}{b.isDefault ? " (Principal)" : ""}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-600">
                Si eliges sede, el movimiento afecta el stock de esa sede y el global.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      type: e.target.value as "IN" | "OUT" | "ADJUST",
                      quantity: "",
                      newStock: "",
                      ...(e.target.value === 'IN' ? {} : { updateProveedor: false }),
                    }))
                  }
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Salida</option>
                  <option value="ADJUST">Ajuste</option>
                </select>
              </div>

              {form.type === "ADJUST" ? (
                <div className="space-y-2">
                  <Label>Nuevo stock</Label>
                  <Input
                    inputMode="decimal"
                    value={form.newStock}
                    onChange={(e) => setForm((p) => ({ ...p, newStock: e.target.value }))}
                    placeholder={selectedMaterial ? String(selectedMaterial.stockActual) : "0"}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                    placeholder="0"
                    required
                  />
                </div>
              )}
            </div>

            {selectedMaterial ? (
              <div className="text-xs text-gray-600">
                Stock actual: <span className="font-medium">{n(selectedMaterial.stockActual).toLocaleString("es-CO")}</span> {formatUnidadMedidaLabel(selectedMaterial.unidadMedida)}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ej: compra proveedor / ajuste por conteo físico"
              />
            </div>

            {canUpdateProveedor ? (
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.updateProveedor}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setForm((p) => ({
                        ...p,
                        updateProveedor: checked,
                        proveedor: checked ? (p.proveedor || selectedMaterial?.proveedor || '') : '',
                      }))
                      setProveedorCreateOpen(false)
                      setProveedorError("")
                      if (checked) {
                        setProveedorNuevoNombre(String(selectedMaterial?.proveedor || '').trim())
                        setProveedorNuevoNit("")
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Actualizar proveedor del producto (si cambió)</span>
                </label>

                {form.updateProveedor ? (
                  <div className="space-y-2">
                    <Label>Proveedor</Label>
                    <Input
                      value={form.proveedor}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, proveedor: e.target.value }))
                        setProveedorCreateOpen(false)
                        setProveedorError("")
                      }}
                      placeholder="Busca o escribe el nombre del proveedor"
                      required
                    />

                    {proveedorLoading ? (
                      <div className="text-xs text-muted-foreground">Buscando proveedores…</div>
                    ) : null}

                    {!proveedorCreateOpen && proveedorMatches.length > 0 ? (
                      <div className="rounded-md border border-input bg-background p-1">
                        {proveedorMatches.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left rounded-sm px-2 py-1 text-sm hover:bg-muted"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, proveedor: p.nombre }))
                              setProveedorMatches([])
                            }}
                            title={p.nit ? `${p.nombre} · ${p.nit}` : p.nombre}
                          >
                            <div className="font-medium">{p.nombre}</div>
                            {p.nit ? <div className="text-xs text-muted-foreground">{p.nit}</div> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {!proveedorCreateOpen ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProveedorCreateOpen(true)
                            setProveedorError("")
                            setProveedorNuevoNombre(String(form.proveedor || '').trim())
                            setProveedorNuevoNit("")
                          }}
                        >
                          Crear proveedor nuevo
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-md border border-input p-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input value={proveedorNuevoNombre} onChange={(e) => setProveedorNuevoNombre(e.target.value)} disabled={proveedorCreateSaving} />
                          </div>
                          <div className="space-y-2">
                            <Label>NIT (opcional)</Label>
                            <Input value={proveedorNuevoNit} onChange={(e) => setProveedorNuevoNit(e.target.value)} disabled={proveedorCreateSaving} />
                          </div>
                        </div>

                        {proveedorError ? <div className="text-sm text-red-600">{proveedorError}</div> : null}

                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setProveedorCreateOpen(false)
                              setProveedorError("")
                            }}
                            disabled={proveedorCreateSaving}
                          >
                            Cancelar
                          </Button>
                          <Button type="button" onClick={() => void createProveedor()} disabled={proveedorCreateSaving}>
                            {proveedorCreateSaving ? 'Creando…' : 'Crear'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.materialId}>
                {isSubmitting ? "Guardando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
