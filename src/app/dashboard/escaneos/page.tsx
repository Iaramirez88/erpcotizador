/**
 * Módulo: Escaneos (OCR + IA)
 * - Subir PDF/imagen
 * - Historial paginado
 * - Aprobación
 * - % de captación
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"

type ScanStatus = "PENDIENTE" | "PROCESADO" | "FALLIDO" | "APROBADO"

type ScanTipo = "FACTURA" | "COTIZACION"

type WorkflowTarget = "COMPRA" | "VENTA" | "COTIZACION" | "OTRO"

type DocumentScanListItem = {
  id: string
  tipo: ScanTipo
  provider: string
  status: ScanStatus
  capturePercent: number
  pageCount: number
  approved: boolean
  approvedAt: string | null
  fileUrl: string
  originalFileName: string | null
  createdAt: string
  updatedAt: string
}

type ConfirmationEntry = {
  value: unknown
  confirmed?: boolean
  confirmedAt?: string
  confirmedById?: string
}

type HighlightBox = { x: number; y: number; w: number; h: number }
type FieldHighlight = { pageIndex: number; pageWidth?: number; pageHeight?: number; boxes: HighlightBox[] }

type PreviewWidth = 0 | 25 | 50

const PREVIEW_WIDTH_STORAGE_KEY = "sgdigital.escaneos.previewWidth"

const BASIC_FIELD_DEFS: Array<{ path: string; label: string }> = [
  { path: "vendor.name", label: "Proveedor / Emisor" },
  { path: "vendor.nit", label: "NIT Proveedor" },
  { path: "invoice.number", label: "Número de factura" },
  { path: "invoice.date", label: "Fecha" },
  { path: "monetary.total", label: "Total" },
]

const FISCAL_FIELD_DEFS: Array<{ path: string; label: string }> = [
  { path: "customer.name", label: "Cliente / Receptor" },
  { path: "customer.nit", label: "NIT Cliente" },
  { path: "invoice.dueDate", label: "Vencimiento" },
  { path: "dian.cufe", label: "CUFE (DIAN)" },
  { path: "dian.resolutionNumber", label: "Resolución DIAN" },
  { path: "monetary.subtotal", label: "Subtotal" },
  { path: "monetary.taxTotal", label: "Impuestos (IVA)" },
  { path: "monetary.withholdingTotal", label: "Retenciones" },
  { path: "payment.method", label: "Medio de pago" },
]

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function n(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

function formatMoneyCop(value: number): string {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value)
  } catch {
    return value.toLocaleString("es-CO")
  }
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

export default function EscaneosPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [tipo, setTipo] = useState<ScanTipo>("FACTURA")
  const [useLlm, setUseLlm] = useState(true)
  const [autoDetect, setAutoDetect] = useState(true)

  const [items, setItems] = useState<DocumentScanListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanModalState, setScanModalState] = useState<"scanning" | "success" | "error">("scanning")
  const [scanModalMessage, setScanModalMessage] = useState<string>("")

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsScanId, setDetailsScanId] = useState<string | null>(null)
  const [detailsScan, setDetailsScan] = useState<Record<string, unknown> | null>(null)
  const [detailsJson, setDetailsJson] = useState<string>("")
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({})
  const [confirmingFields, setConfirmingFields] = useState<Record<string, boolean>>({})
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [showFiscalFields, setShowFiscalFields] = useState(false)

  const [detailsDestino, setDetailsDestino] = useState<WorkflowTarget>("OTRO")
  const [savingDestino, setSavingDestino] = useState(false)
  const [creatingCompra, setCreatingCompra] = useState(false)
  const [creatingCotizacion, setCreatingCotizacion] = useState(false)
  const [creatingOrden, setCreatingOrden] = useState(false)

  const [pdfZoom, setPdfZoom] = useState(120)
  const [imgZoom, setImgZoom] = useState(1)
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>(25)
  const [activeField, setActiveField] = useState<string | null>(null)
  const [imgMeta, setImgMeta] = useState<{ naturalW: number; naturalH: number; clientW: number; clientH: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY)
      if (raw === "0" || raw === "25" || raw === "50") setPreviewWidth(Number(raw) as PreviewWidth)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_WIDTH_STORAGE_KEY, String(previewWidth))
    } catch {
      // ignore
    }
  }, [previewWidth])

  const fetchList = async () => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (debouncedQuery.trim()) qs.set("q", debouncedQuery.trim())

      const resp = await fetch(`/api/escaneos?${qs.toString()}`)
      const data = await resp.json()
      if (data?.success) {
        setItems(data.data.items)
        setTotal(data.data.total)
      }
    } catch (e) {
      console.error("Error cargando escaneos:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    // Al cambiar la búsqueda, volvemos a la página 1.
    setPage(1)
  }, [debouncedQuery])

  const selectedList = useMemo(() => Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k), [selectedIds])

  const requestDelete = (ids: string[]) => {
    setDeleteIds(ids)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (deleteIds.length === 0) return
    setIsDeleting(true)
    try {
      if (deleteIds.length === 1) {
        const resp = await fetch(`/api/escaneos/${deleteIds[0]}`, { method: "DELETE" })
        const data = await resp.json().catch(() => null)
        if (!resp.ok || !data?.success) {
          alert(data?.error || "No se pudo eliminar")
          return
        }
      } else {
        const resp = await fetch(`/api/escaneos`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: deleteIds }),
        })
        const data = await resp.json().catch(() => null)
        if (!resp.ok || !data?.success) {
          alert(data?.error || "No se pudo eliminar")
          return
        }
      }

      setSelectedIds((prev) => {
        const next = { ...prev }
        for (const id of deleteIds) delete next[id]
        return next
      })
      setDeleteOpen(false)
      setDeleteIds([])
      await fetchList()
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQuery])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setIsSubmitting(true)
    setScanModalOpen(true)
    setScanModalState("scanning")
    setScanModalMessage("Escaneando documento…")
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("tipo", tipo)
      form.append("useLlm", useLlm ? "true" : "false")
      form.append("autoDetect", autoDetect ? "true" : "false")

      const resp = await fetch("/api/escaneos", { method: "POST", body: form })
      const data = await resp.json()

      if (!resp.ok || !data?.success) {
        const msg = data?.details || data?.data?.error || data?.error || "Error al escanear"
        setScanModalState("error")
        setScanModalMessage(msg)
        return
      }

      setScanModalState("success")
      setScanModalMessage(String(data?.message || "Escaneo en cola para procesamiento"))

      // Limpiar input file para permitir re-subir el mismo archivo sin refrescar.
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      await fetchList()

      // Cerrar modal luego de un breve feedback visual.
      setTimeout(() => setScanModalOpen(false), 900)
    } catch (err) {
      console.error(err)
      setScanModalState("error")
      setScanModalMessage("Error al escanear")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openDetails = async (id: string) => {
    setDetailsOpen(true)
    setDetailsScanId(id)
    setDetailsLoading(true)
    setDetailsJson("")
    setDetailsScan(null)
    setFieldDrafts({})
    setPdfZoom(120)
    setImgZoom(1)
    setActiveField(null)
    setImgMeta(null)

    try {
      const resp = await fetch(`/api/escaneos/${id}`)
      const data = await resp.json()
      if (data?.success) {
        setDetailsScan(data.data)
        setDetailsJson(JSON.stringify(data.data, null, 2))

        const extractedData = asObject(data.data?.extractedData)
        const workflow = asObject(extractedData.workflow)
        const semantic = asObject(extractedData.semantic)
        const structured = asObject(semantic.structured)
        const confirmation = asObject(extractedData.confirmation)
        const fields = asObject(confirmation.fields)

        const classification = asObject(extractedData.classification)
        const detected = String(classification.detected || extractedData.documentType || "").toUpperCase()
        const savedTarget = String(workflow.target || "").toUpperCase()
        const nextTarget: WorkflowTarget =
          savedTarget === "COMPRA" || savedTarget === "VENTA" || savedTarget === "COTIZACION" || savedTarget === "OTRO"
            ? (savedTarget as WorkflowTarget)
            : detected.includes("COTIZ")
              ? "COTIZACION"
              : "OTRO"
        setDetailsDestino(nextTarget)

        const drafts: Record<string, string> = {}
        for (const f of [...BASIC_FIELD_DEFS, ...FISCAL_FIELD_DEFS]) {
          const confirmed = fields[f.path]
          const confirmedValue = confirmed && typeof confirmed === "object" ? (confirmed as ConfirmationEntry).value : undefined
          const current = getAtPath(structured, f.path)
          const value = confirmedValue ?? current ?? ""
          drafts[f.path] = typeof value === "string" || typeof value === "number" ? String(value) : ""
        }
        setFieldDrafts(drafts)
      } else {
        setDetailsJson(JSON.stringify({ error: data?.error || "No se pudo cargar" }, null, 2))
      }
    } catch {
      setDetailsJson(JSON.stringify({ error: "No se pudo cargar" }, null, 2))
    } finally {
      setDetailsLoading(false)
    }
  }

  const approveScan = async (id: string) => {
    try {
      const resp = await fetch(`/api/escaneos/${id}/approve`, { method: "POST" })
      const data = await resp.json()
      if (!data?.success) {
        alert(data?.error || "No se pudo aprobar")
        return
      }
      await fetchList()
    } catch (e) {
      console.error(e)
      alert("No se pudo aprobar")
    }
  }

  const canEditFields = session?.user?.role === "ADMIN" || session?.user?.role === "USER"

  const saveDestino = async (target: WorkflowTarget) => {
    if (!detailsScanId) return
    if (!canEditFields) return
    setSavingDestino(true)
    try {
      const resp = await fetch(`/api/escaneos/${detailsScanId}/destino`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.success) {
        alert(data?.error || "No se pudo guardar el destino")
        return
      }

      setDetailsScan(data.data)
      setDetailsJson(JSON.stringify(data.data, null, 2))
      await fetchList()
    } finally {
      setSavingDestino(false)
    }
  }

  const createCompraFromScan = async () => {
    if (!detailsScanId) return
    setCreatingCompra(true)
    try {
      const resp = await fetch(`/api/escaneos/${detailsScanId}/to-compra`, { method: "POST" })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.success) {
        alert(data?.error || "No se pudo crear la compra")
        return
      }
      await fetchList()
      router.push("/dashboard/compras")
    } finally {
      setCreatingCompra(false)
    }
  }

  const createCotizacionFromScan = async () => {
    if (!detailsScanId) return
    setCreatingCotizacion(true)
    try {
      const resp = await fetch(`/api/escaneos/${detailsScanId}/to-cotizacion`, { method: "POST" })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.success) {
        alert(data?.error || "No se pudo crear la cotización")
        return
      }
      await fetchList()
      router.push("/dashboard/cotizaciones")
    } finally {
      setCreatingCotizacion(false)
    }
  }

  const createOrdenFromScan = async () => {
    if (!detailsScanId) return
    setCreatingOrden(true)
    try {
      const resp = await fetch(`/api/escaneos/${detailsScanId}/to-orden`, { method: "POST" })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.success) {
        alert(data?.error || "No se pudo crear la orden")
        return
      }
      await fetchList()
      router.push("/dashboard/ordenes")
    } finally {
      setCreatingOrden(false)
    }
  }

  const patchField = async (path: string, value: unknown) => {
    if (!detailsScanId) return
    setConfirmingFields((prev) => ({ ...prev, [path]: true }))
    try {
      const resp = await fetch(`/api/escaneos/${detailsScanId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, value, confirm: true }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.success) {
        alert(data?.error || "No se pudo confirmar el campo")
        return
      }

      // Actualizar el scan confirmado, pero NO tocar los drafts de otros campos.
      setDetailsScan(data.data)
      setDetailsJson(JSON.stringify(data.data, null, 2))
      setFieldDrafts((prev) => ({
        ...prev,
        [path]: typeof value === "string" || typeof value === "number" ? String(value) : "",
      }))

      await fetchList()
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo confirmar el campo")
    } finally {
      setConfirmingFields((prev) => ({ ...prev, [path]: false }))
    }
  }

  const confirmAllFields = async (onlyWithValue: boolean) => {
    if (!detailsScanId) return
    if (!canEditFields) return
    setConfirmingAll(true)
    try {
      const allDefs = [...BASIC_FIELD_DEFS, ...FISCAL_FIELD_DEFS]
      const payload: Record<string, unknown> = {}
      for (const f of allDefs) {
        const raw = fieldDrafts[f.path]
        const v = raw === undefined ? "" : String(raw)
        if (onlyWithValue && !v.trim()) continue
        payload[f.path] = v.trim() ? v : null
      }

      const resp = await fetch(`/api/escaneos/${detailsScanId}/fields/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: payload, confirm: true }),
      })

      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.success) {
        alert(data?.error || "No se pudo confirmar todo")
        return
      }

      setDetailsScan(data.data)
      setDetailsJson(JSON.stringify(data.data, null, 2))
      await fetchList()
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo confirmar todo")
    } finally {
      setConfirmingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Escaneos</h1>
        <p className="text-muted-foreground">Escanea facturas/cotizaciones y valida coherencia contable</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo escaneo</CardTitle>
          <CardDescription>Sube una imagen o PDF</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as ScanTipo)}
                >
                  <option value="FACTURA">Factura</option>
                  <option value="COTIZACION">Cotización</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Archivo</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="use-llm"
                type="checkbox"
                className="h-4 w-4"
                checked={useLlm}
                onChange={(e) => setUseLlm(e.target.checked)}
              />
              <Label htmlFor="use-llm">Usar IA semántica (LLM) para estructurar campos</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="auto-detect"
                type="checkbox"
                className="h-4 w-4"
                checked={autoDetect}
                onChange={(e) => setAutoDetect(e.target.checked)}
              />
              <Label htmlFor="auto-detect">Auto-detectar tipo (Factura / Nota crédito / Recibo / Pago)</Label>
            </div>

            <Button
              type="submit"
              disabled={!file || isSubmitting}
              className={
                file && !isSubmitting
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : ""
              }
            >
              {isSubmitting ? "Escaneando…" : file ? "Escanear" : "Selecciona un archivo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={scanModalOpen} onOpenChange={(open) => {
        // permitir cerrar solo si no está escaneando
        if (scanModalState === "scanning" && !open) return
        setScanModalOpen(open)
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {scanModalState === "scanning" ? "Procesando" : scanModalState === "success" ? "Listo" : "Error"}
            </DialogTitle>
            <DialogDescription>
              {scanModalMessage || (scanModalState === "scanning" ? "Escaneando documento…" : "")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex items-center justify-center">
            {scanModalState === "scanning" ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Esto puede tardar unos segundos</p>
              </div>
            ) : scanModalState === "success" ? (
              <CheckCircle2 className="h-16 w-16 text-emerald-600" />
            ) : (
              <XCircle className="h-16 w-16 text-red-600" />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={scanModalState === "scanning"}
              onClick={() => setScanModalOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>
            {isLoading ? "Cargando..." : `Mostrando ${items.length} de ${total}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:max-w-md">
              <Label>Buscar</Label>
              <Input
                placeholder="Buscar por nombre, número, total…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {debouncedQuery.trim() ? `Filtro: ${debouncedQuery.trim()}` : ""}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pb-3">
            <div className="text-sm text-muted-foreground">
              Seleccionados: {selectedList.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={selectedList.length === 0 || isDeleting}
                onClick={() => requestDelete(selectedList)}
              >
                {isDeleting ? "Eliminando..." : "Eliminar seleccionados"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={items.length === 0}
                onClick={() => {
                  const all = Object.fromEntries(items.map((it) => [it.id, true])) as Record<string, boolean>
                  setSelectedIds((prev) => ({ ...prev, ...all }))
                }}
              >
                Seleccionar todo (página)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={selectedList.length === 0}
                onClick={() => setSelectedIds({})}
              >
                Limpiar
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Aún no hay escaneos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 font-medium w-[40px]">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        checked={items.length > 0 && items.every((it) => selectedIds[it.id])}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSelectedIds((prev) => {
                            const next = { ...prev }
                            for (const it of items) next[it.id] = checked
                            return next
                          })
                        }}
                      />
                    </th>
                    <th className="pb-3 font-medium">Documento</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium">Captación</th>
                    <th className="pb-3 font-medium">Páginas</th>
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="py-4 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${it.id}`}
                          checked={!!selectedIds[it.id]}
                          onChange={(e) => setSelectedIds((prev) => ({ ...prev, [it.id]: e.target.checked }))}
                        />
                      </td>
                      <td className="py-4">
                        <div>
                          <p className="font-medium">{it.tipo}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[360px]">
                            {it.originalFileName || it.fileUrl}
                          </p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm">
                          <p className="font-medium">{it.status}</p>
                          <p className="text-muted-foreground">{it.approved ? "Aprobado" : "No aprobado"}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm">
                          <p className="font-medium">{Math.round(it.capturePercent)}%</p>
                        </div>
                      </td>
                      <td className="py-4 text-sm">{it.pageCount}</td>
                      <td className="py-4 text-sm">{new Date(it.createdAt).toLocaleString()}</td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => openDetails(it.id)}>
                            Ver
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => requestDelete([it.id])}
                          >
                            Eliminar
                          </Button>
                          {!it.approved && it.status === "PROCESADO" && (
                            <Button type="button" onClick={() => approveScan(it.id)}>
                              Aprobar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] grid-rows-[auto_1fr_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalle del escaneo</DialogTitle>
            <DialogDescription>{detailsScanId}</DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          ) : detailsScan ? (
            (() => {
              const extractedData = asObject(detailsScan.extractedData)
              const classification = asObject(extractedData.classification)
              const workflow = asObject(extractedData.workflow)
              const semantic = asObject(extractedData.semantic)
              const structured = asObject(semantic.structured)
              const confirmation = asObject(extractedData.confirmation)
              const fields = asObject(confirmation.fields)

              const structuredItemsRaw = asArray((structured as Record<string, unknown>).items)
              const structuredItems = structuredItemsRaw
                .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>) : null))
                .filter(Boolean) as Array<Record<string, unknown>>

              const totalExtracted = String(getAtPath(structured, "monetary.total") ?? "")
              const totalFromItems = structuredItems.reduce((sum, it) => sum + n(it.amount), 0)

              const fileUrl = String(detailsScan.fileUrl || "")
              const mimeType = String(detailsScan.mimeType || "")
              const isPdf = mimeType.includes("pdf") || fileUrl.toLowerCase().endsWith(".pdf")
              const isImage = mimeType.startsWith("image/")

              const evidenceSnippets = asObject(semantic.evidenceSnippets)
              const highlightsByField = asObject(semantic.highlights)

              const activeHighlightRaw = activeField ? highlightsByField[activeField] : null
              const activeHighlight: FieldHighlight | null =
                activeHighlightRaw && typeof activeHighlightRaw === "object" ? (activeHighlightRaw as FieldHighlight) : null

              const scaleX = imgMeta?.naturalW ? (imgMeta.clientW / imgMeta.naturalW) * imgZoom : imgZoom
              const scaleY = imgMeta?.naturalH ? (imgMeta.clientH / imgMeta.naturalH) * imgZoom : imgZoom

              const getConfirmed = (path: string): ConfirmationEntry | null => {
                const e = fields[path]
                return e && typeof e === "object" ? (e as ConfirmationEntry) : null
              }

              const layoutColsClass =
                previewWidth === 0
                  ? "md:grid-cols-1"
                  : previewWidth === 25
                    ? "md:grid-cols-[1fr_3fr]"
                    : "md:grid-cols-[1fr_1fr]"

              return (
                <div className={`grid gap-4 min-h-0 ${layoutColsClass}`}>
                  {previewWidth === 0 ? null : (
                  <div className="space-y-3 min-h-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Vista previa</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={previewWidth === 25 ? "default" : "outline"}
                            onClick={() => setPreviewWidth(25)}
                          >
                            25%
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={previewWidth === 50 ? "default" : "outline"}
                            onClick={() => setPreviewWidth(50)}
                          >
                            50%
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewWidth(0)}>
                            Ocultar
                          </Button>
                        </div>

                        {isPdf ? (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => setPdfZoom((z) => Math.max(50, z - 10))}>
                              -
                            </Button>
                            <span className="text-xs text-muted-foreground">Zoom: {pdfZoom}%</span>
                            <Button type="button" size="sm" variant="outline" onClick={() => setPdfZoom((z) => Math.min(250, z + 10))}>
                              +
                            </Button>
                          </>
                        ) : isImage ? (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => setImgZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}>
                              -
                            </Button>
                            <span className="text-xs text-muted-foreground">Zoom: {Math.round(imgZoom * 100)}%</span>
                            <Button type="button" size="sm" variant="outline" onClick={() => setImgZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}>
                              +
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setImgZoom(1)}>
                              Reset
                            </Button>
                          </>
                        ) : null}

                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground underline underline-offset-4"
                          >
                            Abrir
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-md border bg-background overflow-hidden h-full min-h-0">
                      {fileUrl ? (
                        isPdf ? (
                          <iframe
                            key={`${fileUrl}#z=${pdfZoom}`}
                            src={`${fileUrl}#zoom=${pdfZoom}`}
                            className="w-full h-[80vh] md:h-[82vh]"
                            title="Vista previa PDF"
                          />
                        ) : isImage ? (
                          <div className="relative overflow-auto h-[80vh] md:h-[82vh]">
                            <div className="relative inline-block" style={{ transform: `scale(${imgZoom})`, transformOrigin: "top left" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                ref={imgRef}
                                src={fileUrl}
                                alt="Vista previa"
                                className="block max-w-none"
                                onLoad={(e) => {
                                  const el = e.currentTarget
                                  setImgMeta({
                                    naturalW: el.naturalWidth,
                                    naturalH: el.naturalHeight,
                                    clientW: el.clientWidth,
                                    clientH: el.clientHeight,
                                  })
                                }}
                              />

                              {/* Resaltado tipo Odoo (solo imagen): cajas OCR */}
                              {activeField && activeHighlight && Array.isArray(activeHighlight.boxes) ? (
                                <div className="absolute inset-0 pointer-events-none">
                                  {activeHighlight.boxes.map((b, idx) => (
                                    <div
                                      key={idx}
                                      className="absolute border-2 border-amber-400 bg-amber-300/20"
                                      style={{
                                        left: `${b.x * scaleX}px`,
                                        top: `${b.y * scaleY}px`,
                                        width: `${b.w * scaleX}px`,
                                        height: `${b.h * scaleY}px`,
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 text-sm text-muted-foreground">
                            Tipo de archivo no soportado para vista previa ({mimeType || "desconocido"}).
                          </div>
                        )
                      ) : (
                        <div className="p-3 text-sm text-muted-foreground">No hay archivo asociado.</div>
                      )}
                    </div>
                  </div>
                  )}

                  <div className="space-y-4 min-h-0 overflow-auto">
                  {previewWidth === 0 ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border p-3">
                      <p className="text-sm text-muted-foreground">Vista previa oculta</p>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewWidth(25)}>
                          Mostrar 25%
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewWidth(50)}>
                          Mostrar 50%
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Tipo detectado</p>
                      <p className="text-sm text-muted-foreground">
                        {String(classification.detected || extractedData.documentType || "-")}
                        {classification.confidence ? ` (${Math.round(Number(classification.confidence) * 100)}%)` : ""}
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Archivo</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {String(detailsScan.originalFileName || detailsScan.fileUrl || "-")}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Destino (flujo)</p>
                        <p className="text-xs text-muted-foreground">
                          Define a qué módulo se dirige este escaneo una vez verificado.
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">Guardado: {String(workflow.target || "-")}</span>
                    </div>

                    <div className="grid gap-2 md:grid-cols-[240px_1fr] md:items-center">
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={detailsDestino}
                        disabled={!canEditFields || savingDestino}
                        onChange={(e) => {
                          const v = e.target.value as WorkflowTarget
                          setDetailsDestino(v)
                          void saveDestino(v)
                        }}
                      >
                        <option value="OTRO">Otro / No clasificar</option>
                        <option value="COMPRA">Factura de compra (Compras)</option>
                        <option value="VENTA">Factura de venta (Ventas)</option>
                        <option value="COTIZACION">Cotización</option>
                      </select>

                      <div className="flex items-center gap-2">
                        {detailsDestino === "COMPRA" ? (
                          String(workflow.createdCompraId || "").trim() ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate">Compra creada: {String(workflow.createdCompraId)}</span>
                              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/compras")} disabled={savingDestino}>
                                Ver compras
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" disabled={!detailsScan.approved || creatingCompra || savingDestino} onClick={() => void createCompraFromScan()}>
                              {creatingCompra ? "Creando compra…" : detailsScan.approved ? "Crear compra" : "Aprueba primero"}
                            </Button>
                          )
                        ) : detailsDestino === "COTIZACION" ? (
                          String(workflow.createdCotizacionId || "").trim() ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate">Cotización creada: {String(workflow.createdCotizacionId)}</span>
                              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/cotizaciones")} disabled={savingDestino}>
                                Ver cotizaciones
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" disabled={!detailsScan.approved || creatingCotizacion || savingDestino} onClick={() => void createCotizacionFromScan()}>
                              {creatingCotizacion ? "Creando cotización…" : detailsScan.approved ? "Crear cotización" : "Aprueba primero"}
                            </Button>
                          )
                        ) : detailsDestino === "VENTA" ? (
                          String(workflow.createdOrdenId || "").trim() ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate">Orden creada: {String(workflow.createdOrdenId)}</span>
                              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/ordenes")} disabled={savingDestino}>
                                Ver órdenes
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" disabled={!detailsScan.approved || creatingOrden || savingDestino} onClick={() => void createOrdenFromScan()}>
                              {creatingOrden ? "Creando orden…" : detailsScan.approved ? "Crear orden" : "Aprueba primero"}
                            </Button>
                          )
                        ) : (
                          <p className="text-xs text-muted-foreground">(Acciones específicas aparecerán según el destino.)</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Campos (confirmables)</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!canEditFields || confirmingAll}
                          onClick={() => {
                            if (confirmingAll) return
                            confirmAllFields(true)
                          }}
                        >
                          {confirmingAll ? "Confirmando…" : "Confirmar todo"}
                        </Button>
                      </div>
                    </div>

                    {structuredItems.length ? (
                      <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Ítems detectados</p>
                          <div className="text-xs text-muted-foreground">
                            Total ítems: <span className="font-medium">{formatMoneyCop(totalFromItems)}</span>
                            {totalExtracted ? (
                              <>
                                {" "}· Total extraído: <span className="font-medium">{formatMoneyCop(n(totalExtracted))}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-3">Descripción</th>
                                <th className="py-2 pr-3">Cant.</th>
                                <th className="py-2 pr-3">Precio</th>
                                <th className="py-2 pr-2">Importe</th>
                              </tr>
                            </thead>
                            <tbody>
                              {structuredItems.slice(0, 50).map((it, idx) => (
                                <tr key={idx} className="border-b last:border-b-0">
                                  <td className="py-2 pr-3 text-gray-900">{String(it.description ?? "") || "—"}</td>
                                  <td className="py-2 pr-3 text-gray-700">{String(it.qty ?? "") || "—"}</td>
                                  <td className="py-2 pr-3 text-gray-700">
                                    {it.unitPrice != null && String(it.unitPrice).trim() ? formatMoneyCop(n(it.unitPrice)) : "—"}
                                  </td>
                                  <td className="py-2 pr-2 font-medium">{formatMoneyCop(n(it.amount))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {structuredItems.length > 50 ? (
                          <p className="text-xs text-muted-foreground">Mostrando 50 ítems (hay más).</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      {BASIC_FIELD_DEFS.map((f) => {
                        const current = getAtPath(structured, f.path)
                        const confirmed = getConfirmed(f.path)
                        const value = confirmed?.value ?? current ?? ""
                        const isConfirmed = confirmed?.confirmed === true
                        const isConfirming = confirmingFields[f.path] === true
                        const evidence = evidenceSnippets[f.path]
                        const evidenceText = typeof evidence === "string" ? evidence : ""

                        return (
                          <div
                            key={f.path}
                            className="group space-y-1 rounded-md border p-2"
                            onMouseEnter={() => setActiveField(f.path)}
                            onMouseLeave={() => setActiveField((cur) => (cur === f.path ? null : cur))}
                            onFocus={() => setActiveField(f.path)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Label className="truncate">{f.label}</Label>
                                <span
                                  className={
                                    "text-[11px] px-2 py-0.5 rounded-full border shrink-0 " +
                                    (isConfirmed
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200")
                                  }
                                  title={
                                    isConfirmed
                                      ? `Confirmado${confirmed?.confirmedAt ? `: ${new Date(confirmed.confirmedAt).toLocaleString()}` : ""}`
                                      : "Pendiente"
                                  }
                                >
                                  {isConfirmed ? "Confirmado" : "Pendiente"}
                                </span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                disabled={!canEditFields || isConfirming}
                                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                                onClick={() => {
                                  if (isConfirming) return
                                  patchField(f.path, fieldDrafts[f.path] ?? "")
                                }}
                              >
                                {isConfirming ? "Confirmando…" : isConfirmed ? "Reconfirmar" : "Confirmar"}
                              </Button>
                            </div>
                            <Input
                              value={fieldDrafts[f.path] ?? (typeof value === "string" || typeof value === "number" ? String(value) : "")}
                              disabled={!canEditFields}
                              onChange={(e) => {
                                if (!canEditFields) return
                                setFieldDrafts((prev) => ({ ...prev, [f.path]: e.target.value }))
                              }}
                            />

                            {evidenceText ? (
                              <p className="hidden group-hover:block text-xs text-muted-foreground line-clamp-2">
                                Evidencia: <span className="font-mono">{evidenceText}</span>
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <p className="text-sm font-medium">Campos fiscales</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowFiscalFields((v) => !v)}
                      >
                        {showFiscalFields ? "Ocultar" : "Mostrar"}
                      </Button>
                    </div>

                    {showFiscalFields ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {FISCAL_FIELD_DEFS.map((f) => {
                          const current = getAtPath(structured, f.path)
                          const confirmed = getConfirmed(f.path)
                          const value = confirmed?.value ?? current ?? ""
                          const isConfirmed = confirmed?.confirmed === true
                          const isConfirming = confirmingFields[f.path] === true
                          const evidence = evidenceSnippets[f.path]
                          const evidenceText = typeof evidence === "string" ? evidence : ""

                          return (
                            <div
                              key={f.path}
                              className="group space-y-1 rounded-md border p-2"
                              onMouseEnter={() => setActiveField(f.path)}
                              onMouseLeave={() => setActiveField((cur) => (cur === f.path ? null : cur))}
                              onFocus={() => setActiveField(f.path)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Label className="truncate">{f.label}</Label>
                                  <span
                                    className={
                                      "text-[11px] px-2 py-0.5 rounded-full border shrink-0 " +
                                      (isConfirmed
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200")
                                    }
                                    title={
                                      isConfirmed
                                        ? `Confirmado${confirmed?.confirmedAt ? `: ${new Date(confirmed.confirmedAt).toLocaleString()}` : ""}`
                                        : "Pendiente"
                                    }
                                  >
                                    {isConfirmed ? "Confirmado" : "Pendiente"}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!canEditFields || isConfirming}
                                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                                  onClick={() => {
                                    if (isConfirming) return
                                    patchField(f.path, fieldDrafts[f.path] ?? "")
                                  }}
                                >
                                  {isConfirming ? "Confirmando…" : isConfirmed ? "Reconfirmar" : "Confirmar"}
                                </Button>
                              </div>
                              <Input
                                value={
                                  fieldDrafts[f.path] ??
                                  (typeof value === "string" || typeof value === "number" ? String(value) : "")
                                }
                                disabled={!canEditFields}
                                onChange={(e) => {
                                  if (!canEditFields) return
                                  setFieldDrafts((prev) => ({ ...prev, [f.path]: e.target.value }))
                                }}
                              />

                              {evidenceText ? (
                                <p className="hidden group-hover:block text-xs text-muted-foreground line-clamp-2">
                                  Evidencia: <span className="font-mono">{evidenceText}</span>
                                </p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        (Oculto para mantener la vista compacta)
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>JSON (DB + extractedData)</Label>
                    <Textarea value={detailsJson} readOnly className="min-h-[240px] font-mono" />
                  </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="space-y-2">
              <Label>JSON (DB + extractedData)</Label>
              <Textarea value={detailsJson} readOnly className="min-h-[420px] font-mono" />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailsOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              {deleteIds.length === 1
                ? "¿Seguro que deseas eliminar este escaneo?"
                : `¿Seguro que deseas eliminar ${deleteIds.length} escaneos?`}
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isDeleting} onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
