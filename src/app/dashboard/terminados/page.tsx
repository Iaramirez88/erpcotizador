/**
 * Página de Terminados
 * Catálogo de acabados para cotizaciones
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"

type Terminado = {
  id: string
  nombre: string
  unidadAplicacion: string
  precioUnitario: number
  activo: boolean
  createdAt: string
}

const UNIDADES = [
  { value: "m2", label: "Metro cuadrado (m²)" },
  { value: "ml", label: "Metro lineal (ml)" },
  { value: "unidad", label: "Unidad" },
]

function normalizeUnidad(value: string) {
  const v = String(value || "").trim().toLowerCase()
  if (v === "m2" || v === "m²") return "m2"
  if (v === "ml" || v === "m" || v === "metro") return "ml"
  return "unidad"
}

export default function TerminadosPage() {
  const { mode: dataViewMode, setMode: setDataViewMode } = useDataViewMode('terminados.history', 'list')
  const [terminados, setTerminados] = useState<Terminado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Terminado | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    unidadAplicacion: "m2",
    precioUnitario: "0",
    activo: true,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return terminados
    return terminados.filter((t) => t.nombre.toLowerCase().includes(q))
  }, [terminados, search])

  async function fetchTerminados() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      const url = params.toString() ? `/api/terminados?${params.toString()}` : "/api/terminados"
      const res = await fetch(url)
      const json = await res.json().catch(() => null)
      if (json?.success) setTerminados(json.data as Terminado[])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchTerminados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function resetForm() {
    setEditing(null)
    setFormData({ nombre: "", unidadAplicacion: "m2", precioUnitario: "0", activo: true })
  }

  function openNew() {
    resetForm()
    setIsModalOpen(true)
  }

  function openEdit(t: Terminado) {
    setEditing(t)
    setFormData({
      nombre: t.nombre,
      unidadAplicacion: normalizeUnidad(t.unidadAplicacion),
      precioUnitario: String(t.precioUnitario ?? 0),
      activo: t.activo !== false,
    })
    setIsModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        nombre: String(formData.nombre || "").trim(),
        unidadAplicacion: normalizeUnidad(formData.unidadAplicacion),
        precioUnitario: Number(formData.precioUnitario || 0),
        activo: formData.activo,
      }

      const url = editing ? `/api/terminados/${editing.id}` : "/api/terminados"
      const method = editing ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        alert(json?.error || "No se pudo guardar")
        return
      }

      setIsModalOpen(false)
      resetForm()
      await fetchTerminados()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este terminado?")) return
    const res = await fetch(`/api/terminados/${id}`, { method: "DELETE" })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      alert(json?.error || "No se pudo eliminar")
      return
    }
    await fetchTerminados()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Terminados</h1>
          <p className="text-muted-foreground">Catálogo de acabados (laminado, UV, argollado, etc.).</p>
        </div>
        <Button onClick={openNew}>Nuevo terminado</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Input placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Lista de Terminados ({filtered.length})</CardTitle>
              <CardDescription>Se aplican en el cotizador según unidad (m²/ml/unidad).</CardDescription>
            </div>
            <DataViewToggle mode={dataViewMode} onChange={setDataViewMode} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay terminados. Crea el primero.
            </div>
          ) : dataViewMode === 'grid' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((t) => (
                <Card key={t.id} className="rounded-2xl border bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{t.nombre}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{t.unidadAplicacion}</p>
                      </div>
                      <span className={"text-xs px-2 py-1 rounded border " + (t.activo ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-700 border-slate-200")}>
                        {t.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="mt-4 text-sm">
                      <p className="text-muted-foreground">Precio</p>
                      <p className="font-medium text-foreground">{formatCurrency(t.precioUnitario || 0)}</p>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 font-medium">Nombre</th>
                    <th className="pb-3 font-medium">Unidad</th>
                    <th className="pb-3 font-medium">Precio</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-4 font-medium">{t.nombre}</td>
                      <td className="py-4 text-sm">{t.unidadAplicacion}</td>
                      <td className="py-4 text-sm">{formatCurrency(t.precioUnitario || 0)}</td>
                      <td className="py-4 text-sm">
                        <span className={"text-xs px-2 py-1 rounded border " + (t.activo ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-700 border-slate-200")}>
                          {t.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(t.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Eliminar
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar terminado" : "Nuevo terminado"}</DialogTitle>
            <DialogDescription>Define unidad de aplicación y precio.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={formData.nombre} onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidad de aplicación</Label>
                <select
                  value={formData.unidadAplicacion}
                  onChange={(e) => setFormData((p) => ({ ...p, unidadAplicacion: e.target.value }))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {UNIDADES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Precio unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.precioUnitario}
                  onChange={(e) => setFormData((p) => ({ ...p, precioUnitario: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Ej: por m², ml o unidad.</p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData((p) => ({ ...p, activo: e.target.checked }))}
              />
              Activo
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); resetForm() }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nota</CardTitle>
          <CardDescription>
            Este catálogo complementa los checkboxes rápidos (laminado/troquelado/instalación) del cotizador.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div>Ejemplos: UV sectorizado (m²), ojalado (unidad), sellado (ml).</div>
        </CardContent>
      </Card>

    </div>
  )
}
