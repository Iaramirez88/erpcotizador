"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatUnidadMedidaLabel } from "@/lib/utils"

type Warehouse = { id: string; nombre: string; codigo?: string | null }

type Material = { id: string; nombre: string; unidadMedida: string }

type Traslado = {
  id: string
  numero: string
  status: "PENDIENTE" | "COMPLETADO" | "CANCELADO"
  quantity: number
  note?: string | null
  createdAt: string
  completedAt?: string | null
  fromWarehouse: { id: string; nombre: string }
  toWarehouse: { id: string; nombre: string }
  material: { id: string; nombre: string; unidadMedida: string }
  createdBy?: { id: string; name: string | null } | null
  completedBy?: { id: string; name: string | null } | null
}

type ApiListResponse<T> = { success?: boolean; data?: T; error?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "")
}

export default function TrasladosPage() {
  const [loading, setLoading] = useState(true)
  const [traslados, setTraslados] = useState<Traslado[]>([])
  const [search, setSearch] = useState("")

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [materials, setMaterials] = useState<Material[]>([])

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    fromWarehouseId: "",
    toWarehouseId: "",
    materialId: "",
    quantity: "1",
    note: "",
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return traslados
    return traslados.filter(
      (t) =>
        t.numero.toLowerCase().includes(q) ||
        t.fromWarehouse.nombre.toLowerCase().includes(q) ||
        t.toWarehouse.nombre.toLowerCase().includes(q) ||
        t.material.nombre.toLowerCase().includes(q)
    )
  }, [traslados, search])

  const loadCatalogs = useCallback(async () => {
    const [wRaw, mRaw] = await Promise.all([
      fetch("/api/bodegas")
        .then((r) => r.json().catch(() => null) as Promise<unknown>)
        .catch(() => null),
      fetch("/api/materiales?activo=true")
        .then((r) => r.json().catch(() => null) as Promise<unknown>)
        .catch(() => null),
    ])

    if (isRecord(wRaw) && wRaw.success === true && Array.isArray(wRaw.data)) {
      const list: Warehouse[] = wRaw.data
        .map((x): Warehouse | null => {
          if (!isRecord(x)) return null
          return {
            id: asString(x.id),
            nombre: asString(x.nombre),
            codigo: typeof x.codigo === "string" ? x.codigo : null,
          }
        })
        .filter((x): x is Warehouse => Boolean(x && x.id && x.nombre))
      setWarehouses(list)
    }

    if (isRecord(mRaw) && mRaw.success === true && Array.isArray(mRaw.data)) {
      const list: Material[] = mRaw.data
        .map((x): Material | null => {
          if (!isRecord(x)) return null
          return {
            id: asString(x.id),
            nombre: asString(x.nombre),
            unidadMedida: typeof x.unidadMedida === "string" ? x.unidadMedida : "",
          }
        })
        .filter((x): x is Material => Boolean(x && x.id && x.nombre))
      setMaterials(list)
    }
  }, [])

  const loadTraslados = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/inventario/traslados?limit=200")
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<Traslado[]>
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setTraslados(json.data)
      } else {
        setTraslados([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalogs()
    void loadTraslados()
  }, [loadCatalogs, loadTraslados])

  function openNew() {
    setForm({ fromWarehouseId: "", toWarehouseId: "", materialId: "", quantity: "1", note: "" })
    setOpen(true)
  }

  async function submit() {
    const qty = Number(form.quantity)
    if (!form.fromWarehouseId) {
      alert("Selecciona la sede origen")
      return
    }
    if (!form.toWarehouseId) {
      alert("Selecciona la sede destino")
      return
    }
    if (form.fromWarehouseId === form.toWarehouseId) {
      alert("La sede origen y destino no pueden ser iguales")
      return
    }
    if (!form.materialId) {
      alert("Selecciona un material")
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Cantidad inválida")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId: form.toWarehouseId,
        materialId: form.materialId,
        quantity: qty,
        note: form.note || null,
      }

      const res = await fetch("/api/inventario/traslados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        alert(json?.error || "No se pudo crear el traslado")
        return
      }

      setOpen(false)
      await loadTraslados()
    } finally {
      setSubmitting(false)
    }
  }

  const materialById = useMemo(() => {
    const m = new Map<string, Material>()
    for (const it of materials) m.set(it.id, it)
    return m
  }, [materials])

  const warehouseById = useMemo(() => {
    const w = new Map<string, Warehouse>()
    for (const it of warehouses) w.set(it.id, it)
    return w
  }, [warehouses])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Traslados de Inventario</h1>
          <p className="text-muted-foreground">Mueve productos entre sedes con trazabilidad completa.</p>
        </div>
        <Button onClick={openNew}>Nuevo traslado</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Buscar por número, sede origen/destino o material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado ({filtered.length})</CardTitle>
          <CardDescription>
            Los traslados se completan automáticamente al crearlos, descontando de origen y sumando en destino.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay traslados registrados.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <div key={t.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold">{t.numero}</div>
                        <span
                          className={
                            "text-xs px-2 py-1 rounded border " +
                            (t.status === "COMPLETADO"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : t.status === "PENDIENTE"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : "bg-slate-50 text-slate-700 border-slate-200")
                          }
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <strong>{t.material.nombre}</strong> — {t.quantity} {formatUnidadMedidaLabel(t.material.unidadMedida)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        De: <strong>{t.fromWarehouse.nombre}</strong> → A: <strong>{t.toWarehouse.nombre}</strong>
                      </div>
                      {t.note ? <div className="text-sm mt-2">{t.note}</div> : null}
                      <div className="text-xs text-muted-foreground mt-2">
                        Creado: {new Date(t.createdAt).toLocaleString("es-CO")}
                        {t.createdBy?.name ? ` por ${t.createdBy.name}` : ""}
                        {t.completedAt
                          ? ` · Completado: ${new Date(t.completedAt).toLocaleString("es-CO")}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo traslado de inventario</DialogTitle>
            <DialogDescription>
              Traslada productos entre sedes. El stock se descuenta de origen y se suma a destino inmediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Sede origen *</Label>
              <select
                value={form.fromWarehouseId}
                onChange={(e) => setForm((p) => ({ ...p, fromWarehouseId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Seleccionar sede origen...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Sede destino *</Label>
              <select
                value={form.toWarehouseId}
                onChange={(e) => setForm((p) => ({ ...p, toWarehouseId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Seleccionar sede destino...</option>
                {warehouses
                  .filter((w) => w.id !== form.fromWarehouseId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>Material *</Label>
              <select
                value={form.materialId}
                onChange={(e) => setForm((p) => ({ ...p, materialId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Seleccionar material...</option>
                {materials
                  .slice()
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>Cantidad *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="1"
              />
              {form.materialId && materialById.get(form.materialId) ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Unidad: {formatUnidadMedidaLabel(materialById.get(form.materialId)!.unidadMedida)}
                </p>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <Label>Nota (opcional)</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ej: Traslado por faltante en sede principal"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Creando..." : "Crear traslado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
