"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatUnidadMedidaLabel } from "@/lib/utils"
import PlantillaRemisionesPage from "./plantilla/page"
import dynamic from "next/dynamic"

// Importación dinámica del PDFViewer
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center">Cargando vista previa...</div> }
)

import { RemisionPDF } from '@/lib/remision-pdf-template'
import { Download } from 'lucide-react'

type Warehouse = { id: string; nombre: string; codigo?: string | null; isDefault?: boolean }

type Material = { id: string; nombre: string; unidadMedida: string }

type RemisionItem = {
  id: string
  quantity: number
  note?: string | null
  material: { id: string; nombre: string; unidadMedida: string }
}

type Remision = {
  id: string
  numero: string
  status: "EMITIDA" | "ANULADA"
  clienteNombre?: string | null
  note?: string | null
  createdAt: string
  warehouse?: { id: string; nombre: string } | null
  items: RemisionItem[]
  createdBy?: {
    id?: string
    name?: string | null
    email?: string | null
  } | null
}

type ApiListResponse<T> = { success?: boolean; data?: T; error?: string }

type CreateItem = { materialId: string; quantity: string; note?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "")
}

export default function RemisionesPage() {
  const [activeTab, setActiveTab] = useState<"listado" | "plantillas">("listado")
  const [tabPending, setTabPending] = useState(false)
  const tabTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current)
    }
  }, [])

  const onTabChange = useCallback((v: string) => {
    const next = (v === 'plantillas' ? 'plantillas' : 'listado') as 'listado' | 'plantillas'
    if (next === activeTab) return

    setTabPending(true)
    setActiveTab(next)
    if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current)
    tabTimerRef.current = window.setTimeout(() => setTabPending(false), 180)
  }, [activeTab])

  const [loading, setLoading] = useState(true)
  const [remisiones, setRemisiones] = useState<Remision[]>([])
  const [search, setSearch] = useState("")

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [materials, setMaterials] = useState<Material[]>([])

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [previewRemision, setPreviewRemision] = useState<Remision | null>(null)
  const [previewEmpresa, setPreviewEmpresa] = useState<any>(null)

  const [form, setForm] = useState({
    warehouseId: "",
    clienteNombre: "",
    note: "",
  })

  const [itemForm, setItemForm] = useState<CreateItem>({ materialId: "", quantity: "1", note: "" })
  const [items, setItems] = useState<CreateItem[]>([])

  const exportExcel = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    const url = params.toString() ? `/api/remisiones/export?${params.toString()}` : '/api/remisiones/export'
    window.location.href = url
  }, [search])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return remisiones
    return remisiones.filter((r) =>
      r.numero.toLowerCase().includes(q) ||
      (r.clienteNombre || "").toLowerCase().includes(q) ||
      (r.warehouse?.nombre || "").toLowerCase().includes(q)
    )
  }, [remisiones, search])

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
            isDefault: typeof x.isDefault === "boolean" ? x.isDefault : false,
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

  const loadRemisiones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/remisiones?limit=200")
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<Remision[]>
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setRemisiones(json.data)
      } else {
        setRemisiones([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalogs()
    void loadRemisiones()
  }, [loadCatalogs, loadRemisiones])

  function openNew() {
    setForm({ warehouseId: "", clienteNombre: "", note: "" })
    setItemForm({ materialId: "", quantity: "1", note: "" })
    setItems([])
    setOpen(true)
  }

  function addItem() {
    const materialId = String(itemForm.materialId || "").trim()
    const qty = Number(itemForm.quantity)
    if (!materialId) {
      alert("Selecciona un producto")
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Cantidad inválida")
      return
    }

    setItems((prev) => [...prev, { materialId, quantity: String(qty), note: itemForm.note || "" }])
    setItemForm((p) => ({ ...p, materialId: "", quantity: "1", note: "" }))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function submit() {
    if (items.length === 0) {
      alert("Agrega al menos un item")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        warehouseId: form.warehouseId || null,
        clienteNombre: form.clienteNombre || null,
        note: form.note || null,
        items: items.map((it) => ({
          materialId: it.materialId,
          quantity: Number(it.quantity),
          note: it.note || null,
        })),
      }

      const res = await fetch("/api/remisiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        alert(json?.error || "No se pudo crear la remisión")
        return
      }

      setOpen(false)
      await loadRemisiones()
    } finally {
      setSubmitting(false)
    }
  }

  async function anular(remisionId: string) {
    if (!confirm("¿Anular esta remisión? Esto reversa el inventario.")) return
    const res = await fetch(`/api/remisiones/${remisionId}`, { method: "DELETE" })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      alert(json?.error || "No se pudo anular")
      return
    }
    await loadRemisiones()
  }

  async function descargarPDF(remisionId: string, numero: string) {
    try {
      const res = await fetch(`/api/remisiones/${remisionId}/pdf?download=1`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Remision-${numero}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error descargando PDF:", error)
      alert("Error al descargar el PDF")
    }
  }

  async function enviarPorEmail(remision: Remision) {
    const email = prompt(`Enviar remisión ${remision.numero} a:`, remision.clienteNombre || "")
    if (!email) return

    if (!email.includes("@")) {
      alert("Email inválido")
      return
    }

    setEnviando(remision.id)
    try {
      const res = await fetch(`/api/remisiones/${remision.id}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatarios: [email],
          mensaje: `Se adjunta remisión ${remision.numero}`,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        alert(json?.error || "No se pudo enviar el email")
        return
      }

      alert(`Email enviado exitosamente a ${email}`)
    } catch (error) {
      console.error("Error enviando email:", error)
      alert("Error al enviar email")
    } finally {
      setEnviando(null)
    }
  }

  function compartirWhatsApp(remision: Remision) {
    const mensaje = `Remisión ${remision.numero}\n\nSede: ${remision.warehouse?.nombre || "Global"}\nItems: ${remision.items.length}\n\nVer PDF: ${window.location.origin}/api/remisiones/${remision.id}/pdf`
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(url, "_blank")
  }

  async function abrirPreview(remision: Remision) {
    try {
      // Obtener datos completos de la remisión incluyendo empresaId
      const res = await fetch(`/api/remisiones/${remision.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.empresaId) {
          // Obtener datos de la empresa
          const empresaRes = await fetch(`/api/empresas/${data.empresaId}`)
          if (empresaRes.ok) {
            const empresaData = await empresaRes.json()
            setPreviewEmpresa(empresaData)
          }
        }
      }
      setPreviewRemision(remision)
    } catch (error) {
      console.error('Error al cargar datos para preview:', error)
      setPreviewRemision(remision)
    }
  }

  const materialById = useMemo(() => {
    const m = new Map<string, Material>()
    for (const it of materials) m.set(it.id, it)
    return m
  }, [materials])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Remisiones</h1>
          <p className="text-muted-foreground">Salida de inventario con trazabilidad por documento.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="listado">Listado</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
        </TabsList>

        {tabPending ? (
          <div className="mt-2 text-sm text-muted-foreground">Cargando…</div>
        ) : null}

        <TabsContent value="listado" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNew}>Nueva remisión</Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Input placeholder="Buscar por número, cliente o sede..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listado ({filtered.length})</CardTitle>
              <CardDescription>Una remisión emite una salida (OUT) por item. Puedes anular para reversar.</CardDescription>
            </CardHeader>
            <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay remisiones.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <div key={r.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold">{r.numero}</div>
                        <span
                          className={
                            "text-xs px-2 py-1 rounded border " +
                            (r.status === "EMITIDA"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-50 text-slate-700 border-slate-200")
                          }
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {r.warehouse?.nombre ? `Sede: ${r.warehouse.nombre}` : "Sede: (global)"}
                        {r.clienteNombre ? ` · Cliente: ${r.clienteNombre}` : ""}
                        {r.items?.length ? ` · Items: ${r.items.length}` : ""}
                      </div>
                      {r.note ? <div className="text-sm mt-2">{r.note}</div> : null}
                      {r.items?.length ? (
                        <div className="text-sm mt-2">
                          <div className="text-xs text-muted-foreground">Detalle:</div>
                          <ul className="list-disc pl-5">
                            {r.items.slice(0, 5).map((it) => (
                              <li key={it.id}>
                                {it.material?.nombre} — {it.quantity} {formatUnidadMedidaLabel(it.material?.unidadMedida)}
                              </li>
                            ))}
                            {r.items.length > 5 ? <li>…</li> : null}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.status === "EMITIDA" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirPreview(r)}
                            title="Vista Previa"
                          >
                            👁️ Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => descargarPDF(r.id, r.numero)}
                            title="Descargar PDF"
                          >
                            📄 PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => enviarPorEmail(r)}
                            disabled={enviando === r.id}
                            title="Enviar por Email"
                          >
                            {enviando === r.id ? "Enviando..." : "📧 Email"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => compartirWhatsApp(r)}
                            title="Compartir por WhatsApp"
                          >
                            💬 WhatsApp
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => anular(r.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Anular
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="plantillas">
          <PlantillaRemisionesPage />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nueva remisión</DialogTitle>
            <DialogDescription>Crea una salida de inventario y registra trazabilidad.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Label>Sede (opcional)</Label>
              <select
                value={form.warehouseId}
                onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">(Global / sin sede)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Recomendado: elegir sede para stock por almacén.</p>
            </div>

            <div className="md:col-span-1">
              <Label>Cliente (opcional)</Label>
              <Input value={form.clienteNombre} onChange={(e) => setForm((p) => ({ ...p, clienteNombre: e.target.value }))} />
            </div>

            <div className="md:col-span-1">
              <Label>Nota (opcional)</Label>
              <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
            </div>

            <div className="md:col-span-3">
              <div className="rounded-md border p-3">
                <div className="font-medium mb-2">Items</div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <Label>Producto</Label>
                    <select
                      value={itemForm.materialId}
                      onChange={(e) => setItemForm((p) => ({ ...p, materialId: e.target.value }))}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Seleccionar producto…</option>
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
                    <Label>Cantidad</Label>
                    <Input type="number" step="0.01" value={itemForm.quantity} onChange={(e) => setItemForm((p) => ({ ...p, quantity: e.target.value }))} />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Nota (opcional)</Label>
                    <Input value={itemForm.note} onChange={(e) => setItemForm((p) => ({ ...p, note: e.target.value }))} />
                  </div>

                  <div className="md:col-span-5">
                    <Button type="button" variant="outline" onClick={addItem}>
                      Agregar item
                    </Button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-3">Aún no hay items.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {items.map((it, idx) => {
                      const mat = materialById.get(it.materialId)
                      return (
                        <div key={`${it.materialId}-${idx}`} className="flex items-center justify-between gap-3 rounded border p-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{mat?.nombre || it.materialId}</div>
                            <div className="text-xs text-muted-foreground">
                              {it.quantity} {formatUnidadMedidaLabel(mat?.unidadMedida)}{it.note ? ` · ${it.note}` : ""}
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeItem(idx)}>
                            Quitar
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={submitting} onClick={submit}>
              {submitting ? "Creando..." : "Crear remisión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Preview */}
      <Dialog open={!!previewRemision} onOpenChange={() => setPreviewRemision(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Vista Previa - Remisión {previewRemision?.numero}</DialogTitle>
            <DialogDescription>
              Previsualización del documento PDF
            </DialogDescription>
          </DialogHeader>
          
          {previewRemision && (
            <div className="h-[600px] w-full overflow-hidden rounded border">
              <PDFViewer width="100%" height="100%">
                <RemisionPDF
                  remision={{
                    numero: previewRemision.numero,
                    createdAt: previewRemision.createdAt,
                    status: previewRemision.status,
                    clienteNombre: previewRemision.clienteNombre,
                    note: previewRemision.note,
                    warehouse: previewRemision.warehouse,
                    items: previewRemision.items.map((item) => ({
                      quantity: item.quantity,
                      note: item.note,
                      material: {
                        nombre: item.material.nombre,
                        unidadMedida: item.material.unidadMedida,
                      },
                    })),
                    createdBy: previewRemision.createdBy ? {
                      name: previewRemision.createdBy.name ?? null,
                      email: previewRemision.createdBy.email ?? null,
                    } : null,
                  }}
                  empresa={previewEmpresa ? {
                    nombre: previewEmpresa.nombre,
                    nit: previewEmpresa.nit || undefined,
                    direccion: previewEmpresa.direccion || undefined,
                    telefono: previewEmpresa.telefono || undefined,
                    logo: previewEmpresa.logo || undefined,
                  } : undefined}
                />
              </PDFViewer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
