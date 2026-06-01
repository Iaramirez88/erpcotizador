"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Download, ExternalLink, History, LoaderCircle, RefreshCw, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type VectorFormat = "svg" | "pdf" | "eps" | "dxf" | "png"

type VectorHistoryEntry = {
  id: string
  kind: "IMAGE_VECTORIZATION"
  prompt: string
  createdAt: string
  actorLabel: string | null
  summary: string | null
  responseText: string | null
  asset: {
    name: string
    path: string
    url: string
  } | null
  availableDownloads: VectorFormat[]
}

type VectorHistoryResponse = {
  ok?: boolean
  history?: VectorHistoryEntry[]
  error?: string
}

type GeneratedVectorResult = {
  pendingId: string
  previewDataUrl: string
  responseText: string
  source: {
    provider: string
    outputFormat: "svg"
  }
}

type VectorizeResponse = {
  ok?: boolean
  vectorization?: GeneratedVectorResult | null
  saved?: {
    name: string
    path: string
    url: string | null
  } | null
  responseText?: string
  error?: string
}

type SavedVectorResult = {
  name: string
  path: string
  url: string | null
}

const DOWNLOAD_OPTIONS: Array<{ value: VectorFormat; label: string }> = [
  { value: "svg", label: "SVG" },
  { value: "pdf", label: "PDF" },
  { value: "eps", label: "EPS" },
  { value: "dxf", label: "DXF" },
  { value: "png", label: "PNG" },
]

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function fileDisplaySize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

export function LitografiaAiVectorizerPanel() {
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [maxColors, setMaxColors] = useState("")
  const [loading, setLoading] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<VectorHistoryEntry[]>([])
  const [selectedHistory, setSelectedHistory] = useState<VectorHistoryEntry | null>(null)
  const [generatedVector, setGeneratedVector] = useState<GeneratedVectorResult | null>(null)
  const [savedVector, setSavedVector] = useState<SavedVectorResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationModalOpen, setGenerationModalOpen] = useState(false)
  const [generationResponse, setGenerationResponse] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  const historyCountLabel = useMemo(() => {
    if (historyLoading) return "Cargando historial..."
    if (!history.length) return "Sin vectorizaciones registradas"
    return `${history.length} vectores recientes`
  }, [history, historyLoading])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", { cache: "no-store" })
      const json = (await response.json().catch(() => null)) as VectorHistoryResponse | null
      if (!response.ok || !json?.ok || !Array.isArray(json.history)) {
        throw new Error(json?.error || "No se pudo cargar el historial de vectorización.")
      }
      setHistory(json.history)
      setSelectedHistory((current) => json.history?.find((entry) => entry.id === current?.id) ?? json.history?.[0] ?? null)
    } catch (historyError) {
      setHistory([])
      setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial de vectorización.")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const handleVectorize = async () => {
    if (!sourceFile) return
    setGenerationModalOpen(true)
    setLoading(true)
    setApprovalLoading(false)
    setError(null)
    setSavedVector(null)
    setGenerationResponse(null)

    try {
      const body = new FormData()
      body.append("action", "vectorize")
      body.append("file", sourceFile)
      if (maxColors.trim()) body.append("maxColors", maxColors.trim())

      const response = await fetch("/api/litografia/ia/vectorizar", {
        method: "POST",
        body,
      })

      const json = (await response.json().catch(() => null)) as VectorizeResponse | null
      if (!response.ok || !json?.ok || !json.vectorization) {
        throw new Error(json?.error || "No fue posible vectorizar la imagen.")
      }

      setGeneratedVector(json.vectorization)
      setGenerationResponse(json.vectorization.responseText)
    } catch (vectorError) {
      setGeneratedVector(null)
      setError(vectorError instanceof Error ? vectorError.message : "Error vectorizando la imagen.")
    } finally {
      setLoading(false)
    }
  }

  const handleApproveSave = async () => {
    if (!generatedVector) return
    setApprovalLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", pendingId: generatedVector.pendingId }),
      })

      const json = (await response.json().catch(() => null)) as VectorizeResponse | null
      if (!response.ok || !json?.ok || !json.saved) {
        throw new Error(json?.error || "No fue posible guardar el vector en el administrador de archivos.")
      }

      setSavedVector(json.saved)
      setGenerationResponse(json.responseText || "Vector guardado correctamente.")
      await loadHistory()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el vector.")
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleDownloadGenerated = () => {
    if (!generatedVector || !sourceFile) return
    const anchor = document.createElement("a")
    anchor.href = generatedVector.previewDataUrl
    anchor.download = `${sourceFile.name.replace(/\.[a-z0-9]+$/i, "") || "vector"}.svg`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleDownloadFromHistory = async (entry: VectorHistoryEntry, format: VectorFormat) => {
    const key = `${entry.id}:${format}`
    setDownloadingKey(key)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", historyId: entry.id, format }),
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(json?.error || `No se pudo descargar el formato ${format.toUpperCase()}.`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${(entry.asset?.name || "vector").replace(/\.[a-z0-9]+$/i, "")}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "No fue posible descargar el archivo desde Vectorizer.AI.")
    } finally {
      setDownloadingKey(null)
    }
  }

  const handleRetryFromModal = async () => {
    setGeneratedVector(null)
    setSavedVector(null)
    await handleVectorize()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vectorizador con Vectorizer.AI</h2>
          <p className="text-muted-foreground">Sube una imagen raster, conviértela a SVG con tu licencia de Vectorizer.AI, guárdala en CRM y conserva historial con descargas por formato.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/crm/archivos?path=ia%2Fvectorizer-ai">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir carpeta guardada
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Ver historial
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-700">
            <Upload className="h-5 w-5" />
            <CardTitle className="text-lg">Vectorizar imagen</CardTitle>
          </div>
          <CardDescription>
            El flujo genera un SVG de producción, lo deja listo para revisión y conserva un token para descargar más formatos desde la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-2">
              <Label htmlFor="litografia-vectorizer-file">Imagen raster</Label>
              <Input id="litografia-vectorizer-file" type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp" onChange={(event) => setSourceFile(event.target.files?.[0] ?? null)} />
              <p className="text-xs text-slate-500">Formatos recomendados: PNG o JPG limpios. Vectorizer.AI también acepta GIF, BMP y WebP.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="litografia-vectorizer-max-colors">Máximo de colores (opcional)</Label>
              <Input
                id="litografia-vectorizer-max-colors"
                inputMode="numeric"
                value={maxColors}
                onChange={(event) => setMaxColors(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Ejemplo: 8"
              />
              <p className="text-xs text-slate-500">Úsalo cuando quieras simplificar logotipos o artes planas. Déjalo vacío para no limitar colores.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Antes de vectorizar</p>
              <p className="mt-2">Evita fotos muy comprimidas o con fondo sucio si el objetivo es sacar un logo limpio.</p>
              <p className="mt-2">Si el cliente trae una pieza compleja, empieza sin límite de color y luego afina una segunda pasada.</p>
              <p className="mt-2">La API permite descargar SVG, PDF, EPS, DXF y PNG desde el mismo historial sin reprocesar mientras el token siga retenido.</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-medium">Archivo seleccionado</p>
              {sourceFile ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-semibold">{sourceFile.name}</p>
                  <p>Tamaño: {fileDisplaySize(sourceFile.size)}</p>
                  <p>Tipo: {sourceFile.type || "No informado"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-900">Aún no has seleccionado una imagen para vectorizar.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleVectorize} disabled={loading || !sourceFile}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Vectorizar ahora
            </Button>
            <p className="text-sm text-muted-foreground">{historyCountLabel}</p>
          </div>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {savedVector ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
                <img src={generatedVector?.previewDataUrl || savedVector.url || ""} alt="Vista previa de vector" className="max-h-[28rem] w-full object-contain" />
              </div>
              {generationResponse ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{generationResponse}</p> : null}
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span>Guardado en: {savedVector.path}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/vectorizer-ai")}&preview=${encodeURIComponent(savedVector.path)}`}>
                    Ver en administrador
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Últimas vectorizaciones</CardTitle>
          <CardDescription>Consulta rápida del historial guardado. Desde cada registro puedes descargar otros formatos desde la plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyLoading ? <p className="text-sm text-muted-foreground">Cargando historial...</p> : null}
          {!historyLoading && !history.length ? <p className="text-sm text-muted-foreground">Aún no hay vectorizaciones registradas.</p> : null}
          {history.slice(0, 5).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setSelectedHistory(entry)
                setHistoryOpen(true)
              }}
              className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">Vectorización</p>
                <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2">{entry.summary || entry.prompt}</p>
              {entry.asset?.path ? <p className="mt-2 text-xs text-slate-500">Archivo: {entry.asset.path}</p> : null}
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Historial de vectorización</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedHistory(entry)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition ${selectedHistory?.id === entry.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-900">Vectorización</p>
                    <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-slate-700">{entry.summary || entry.prompt}</p>
                  {entry.actorLabel ? <p className="mt-2 text-xs text-slate-500">Usuario: {entry.actorLabel}</p> : null}
                </button>
              ))}
            </div>

            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!selectedHistory ? <p className="text-sm text-slate-500">Selecciona un registro para revisar el detalle y descargar otros formatos.</p> : (
                <div className="space-y-4 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">Tipo</p>
                    <p>Vectorización IA</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Fecha</p>
                    <p>{formatDate(selectedHistory.createdAt)}</p>
                  </div>
                  {selectedHistory.actorLabel ? (
                    <div>
                      <p className="font-medium text-slate-900">Usuario</p>
                      <p>{selectedHistory.actorLabel}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="font-medium text-slate-900">Detalle</p>
                    <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.responseText || selectedHistory.summary || selectedHistory.prompt}</p>
                  </div>
                  {selectedHistory.asset?.path ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Archivo guardado</p>
                      <p className="rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.asset.path}</p>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/vectorizer-ai")}&preview=${encodeURIComponent(selectedHistory.asset.path)}`}>
                          Abrir en administrador de archivos
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                  {selectedHistory.availableDownloads.length ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Descargar desde Vectorizer.AI</p>
                      <div className="flex flex-wrap gap-2">
                        {DOWNLOAD_OPTIONS.filter((option) => selectedHistory.availableDownloads.includes(option.value)).map((option) => {
                          const key = `${selectedHistory.id}:${option.value}`
                          return (
                            <Button key={option.value} type="button" variant="outline" size="sm" onClick={() => void handleDownloadFromHistory(selectedHistory, option.value)} disabled={downloadingKey === key}>
                              {downloadingKey === key ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                              {option.label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={generationModalOpen}
        onOpenChange={(open) => {
          if (loading || approvalLoading) return
          setGenerationModalOpen(open)
        }}
      >
        <DialogContent hideClose={loading || approvalLoading} className="max-h-[92vh] max-w-6xl overflow-hidden border-slate-800 bg-slate-950 text-white">
          <DialogHeader className="space-y-2 border-b border-slate-800 pb-4 text-left">
            <DialogTitle className="text-xl text-white">{loading ? "Vectorizando imagen" : savedVector ? "Vector listo y guardado" : "Revisión del vector generado"}</DialogTitle>
            <p className="text-sm text-slate-300">
              {loading
                ? "Estamos enviando la imagen a Vectorizer.AI. Cuando termine verás el SVG aquí mismo antes de guardarlo."
                : generationResponse || "Revisa el SVG resultante, descárgalo si quieres y apruébalo para guardarlo en archivos."}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto py-4">
            {loading ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-3xl border border-slate-800 bg-black/40 px-6 text-center">
                <LoaderCircle className="h-14 w-14 animate-spin text-white" />
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-white">Vectorizando...</p>
                  <p className="max-w-2xl text-sm text-slate-300">El SVG de salida se mostrará aquí antes de guardarse en CRM.</p>
                </div>
              </div>
            ) : generatedVector ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="overflow-hidden rounded-3xl border border-slate-800 bg-white p-3">
                    <img src={generatedVector.previewDataUrl} alt="Vista previa de vector SVG" className="max-h-[68vh] w-full rounded-2xl object-contain" />
                  </div>
                  <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-200">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Origen de la respuesta</p>
                      <p className="mt-2 text-base font-medium text-white">Vectorizer.AI</p>
                      <p className="mt-1">Proveedor: {generatedVector.source.provider}</p>
                      <p>Formato base: {generatedVector.source.outputFormat.toUpperCase()}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Respuesta concreta</p>
                      <p className="mt-2 whitespace-pre-line text-slate-100">{generationResponse}</p>
                    </div>

                    {savedVector ? (
                      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-50">
                        <p className="font-medium">Guardado correctamente</p>
                        <p className="mt-1 text-sm">Ruta: {savedVector.path}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-black/30 px-6 text-center text-sm text-slate-400">
                No se pudo preparar la vista previa del SVG. Ajusta la imagen y vuelve a intentarlo.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-800 pt-4 sm:justify-between sm:space-x-0">
            <div className="flex flex-wrap gap-2">
              {generatedVector ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={handleDownloadGenerated} disabled={loading || approvalLoading}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar SVG
                </Button>
              ) : null}
              {savedVector ? (
                <Button asChild type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/vectorizer-ai")}&preview=${encodeURIComponent(savedVector.path)}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir en archivos
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setGenerationModalOpen(false)} disabled={loading || approvalLoading}>
                Cerrar
              </Button>
              {generatedVector && !savedVector ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => void handleRetryFromModal()} disabled={loading || approvalLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Volver a intentarlo
                </Button>
              ) : null}
              {generatedVector && !savedVector ? (
                <Button type="button" className="bg-white text-slate-950 hover:bg-slate-200" onClick={handleApproveSave} disabled={loading || approvalLoading}>
                  {approvalLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Aprobar para guardar
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Download, ExternalLink, History, LoaderCircle, RefreshCw, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type VectorFormat = "svg" | "pdf" | "eps" | "dxf" | "png"

type VectorHistoryEntry = {
  id: string
  kind: "IMAGE_VECTORIZATION"
  prompt: string
  createdAt: string
  actorLabel: string | null
  summary: string | null
  responseText: string | null
  asset: {
    name: string
    path: string
    url: string
  } | null
  availableDownloads: VectorFormat[]
}

type VectorHistoryResponse = {
  ok?: boolean
  history?: VectorHistoryEntry[]
  error?: string
}

type GeneratedVectorResult = {
  pendingId: string
  previewDataUrl: string
  responseText: string
  source: {
    provider: string
    outputFormat: "svg"
  }
}

type VectorizeResponse = {
  ok?: boolean
  vectorization?: GeneratedVectorResult | null
  saved?: {
    name: string
    path: string
    url: string | null
  } | null
  responseText?: string
  error?: string
}

type SavedVectorResult = {
  name: string
  path: string
  url: string | null
}

const DOWNLOAD_OPTIONS: Array<{ value: VectorFormat; label: string }> = [
  { value: "svg", label: "SVG" },
  { value: "pdf", label: "PDF" },
  { value: "eps", label: "EPS" },
  { value: "dxf", label: "DXF" },
  { value: "png", label: "PNG" },
]

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function fileDisplaySize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

export function LitografiaAiVectorizerPanel() {
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [maxColors, setMaxColors] = useState("")
  const [loading, setLoading] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<VectorHistoryEntry[]>([])
  const [selectedHistory, setSelectedHistory] = useState<VectorHistoryEntry | null>(null)
  const [generatedVector, setGeneratedVector] = useState<GeneratedVectorResult | null>(null)
  const [savedVector, setSavedVector] = useState<SavedVectorResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationModalOpen, setGenerationModalOpen] = useState(false)
  const [generationResponse, setGenerationResponse] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  const historyCountLabel = useMemo(() => {
    if (historyLoading) return "Cargando historial..."
    if (!history.length) return "Sin vectorizaciones registradas"
    return `${history.length} vectores recientes`
  }, [history, historyLoading])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", { cache: "no-store" })
      const json = (await response.json().catch(() => null)) as VectorHistoryResponse | null
      if (!response.ok || !json?.ok || !Array.isArray(json.history)) {
        throw new Error(json?.error || "No se pudo cargar el historial de vectorización.")
      }
      setHistory(json.history)
      setSelectedHistory((current) => json.history?.find((entry) => entry.id === current?.id) ?? json.history?.[0] ?? null)
    } catch (historyError) {
      setHistory([])
      setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial de vectorización.")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const handleVectorize = async () => {
    if (!sourceFile) return
    setGenerationModalOpen(true)
    setLoading(true)
    setApprovalLoading(false)
    setError(null)
    setSavedVector(null)
    setGenerationResponse(null)

    try {
      const body = new FormData()
      body.append("action", "vectorize")
      body.append("file", sourceFile)
      if (maxColors.trim()) body.append("maxColors", maxColors.trim())

      const response = await fetch("/api/litografia/ia/vectorizar", {
        method: "POST",
        body,
      })

      const json = (await response.json().catch(() => null)) as VectorizeResponse | null
      if (!response.ok || !json?.ok || !json.vectorization) {
        throw new Error(json?.error || "No fue posible vectorizar la imagen.")
      }

      setGeneratedVector(json.vectorization)
      setGenerationResponse(json.vectorization.responseText)
    } catch (vectorError) {
      setGeneratedVector(null)
      setError(vectorError instanceof Error ? vectorError.message : "Error vectorizando la imagen.")
    } finally {
      setLoading(false)
    }
  }

  const handleApproveSave = async () => {
    if (!generatedVector) return
    setApprovalLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", pendingId: generatedVector.pendingId }),
      })

      const json = (await response.json().catch(() => null)) as VectorizeResponse | null
      if (!response.ok || !json?.ok || !json.saved) {
        throw new Error(json?.error || "No fue posible guardar el vector en el administrador de archivos.")
      }

      setSavedVector(json.saved)
      setGenerationResponse(json.responseText || "Vector guardado correctamente.")
      await loadHistory()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el vector.")
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleDownloadGenerated = () => {
    if (!generatedVector || !sourceFile) return
    const anchor = document.createElement("a")
    anchor.href = generatedVector.previewDataUrl
    anchor.download = `${sourceFile.name.replace(/\.[a-z0-9]+$/i, "") || "vector"}.svg`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleDownloadFromHistory = async (entry: VectorHistoryEntry, format: VectorFormat) => {
    const key = `${entry.id}:${format}`
    setDownloadingKey(key)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", historyId: entry.id, format }),
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(json?.error || `No se pudo descargar el formato ${format.toUpperCase()}.`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${(entry.asset?.name || "vector").replace(/\.[a-z0-9]+$/i, "")}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "No fue posible descargar el archivo desde Vectorizer.AI.")
    } finally {
      setDownloadingKey(null)
    }
  }

  const handleRetryFromModal = async () => {
    setGeneratedVector(null)
    setSavedVector(null)
    await handleVectorize()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vectorizador con Vectorizer.AI</h2>
          <p className="text-muted-foreground">Sube una imagen raster, conviértela a SVG con tu licencia de Vectorizer.AI, guárdala en CRM y conserva historial con descargas por formato.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/crm/archivos?path=ia%2Fvectorizer-ai">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir carpeta guardada
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Ver historial
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-700">
            <Upload className="h-5 w-5" />
            <CardTitle className="text-lg">Vectorizar imagen</CardTitle>
          </div>
          <CardDescription>
            El flujo genera un SVG de producción, lo deja listo para revisión y conserva un token para descargar más formatos desde la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-2">
              <Label htmlFor="litografia-vectorizer-file">Imagen raster</Label>
              <Input id="litografia-vectorizer-file" type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp" onChange={(event) => setSourceFile(event.target.files?.[0] ?? null)} />
              <p className="text-xs text-slate-500">Formatos recomendados: PNG o JPG limpios. Vectorizer.AI también acepta GIF, BMP y WebP.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="litografia-vectorizer-max-colors">Máximo de colores (opcional)</Label>
              <Input
                id="litografia-vectorizer-max-colors"
                inputMode="numeric"
                value={maxColors}
                onChange={(event) => setMaxColors(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Ejemplo: 8"
              />
              <p className="text-xs text-slate-500">Úsalo cuando quieras simplificar logotipos o artes planas. Déjalo vacío para no limitar colores.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Antes de vectorizar</p>
              <p className="mt-2">Evita fotos muy comprimidas o con fondo sucio si el objetivo es sacar un logo limpio.</p>
              <p className="mt-2">Si el cliente trae una pieza compleja, empieza sin límite de color y luego afina una segunda pasada.</p>
              <p className="mt-2">La API permite descargar SVG, PDF, EPS, DXF y PNG desde el mismo historial sin reprocesar mientras el token siga retenido.</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-medium">Archivo seleccionado</p>
              {sourceFile ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-semibold">{sourceFile.name}</p>
                  <p>Tamaño: {fileDisplaySize(sourceFile.size)}</p>
                  <p>Tipo: {sourceFile.type || "No informado"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-900">Aún no has seleccionado una imagen para vectorizar.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleVectorize} disabled={loading || !sourceFile}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Vectorizar ahora
            </Button>
            <p className="text-sm text-muted-foreground">{historyCountLabel}</p>
          </div>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {savedVector ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
                <img src={generatedVector?.previewDataUrl || savedVector.url || ""} alt="Vista previa de vector" className="max-h-[28rem] w-full object-contain" />
              </div>
              {generationResponse ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{generationResponse}</p> : null}
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span>Guardado en: {savedVector.path}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/vectorizer-ai")}&preview=${encodeURIComponent(savedVector.path)}`}>
                    Ver en administrador
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Últimas vectorizaciones</CardTitle>
          <CardDescription>Consulta rápida del historial guardado. Desde cada registro puedes descargar otros formatos desde la plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyLoading ? <p className="text-sm text-muted-foreground">Cargando historial...</p> : null}
          {!historyLoading && !history.length ? <p className="text-sm text-muted-foreground">Aún no hay vectorizaciones registradas.</p> : null}
          {history.slice(0, 5).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setSelectedHistory(entry)
                setHistoryOpen(true)
              }}
              className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">Vectorización</p>
                <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2">{entry.summary || entry.prompt}</p>
              {entry.asset?.path ? <p className="mt-2 text-xs text-slate-500">Archivo: {entry.asset.path}</p> : null}
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Historial de vectorización</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedHistory(entry)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition ${selectedHistory?.id === entry.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-900">Vectorización</p>
                    <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-slate-700">{entry.summary || entry.prompt}</p>
                  {entry.actorLabel ? <p className="mt-2 text-xs text-slate-500">Usuario: {entry.actorLabel}</p> : null}
                </button>
              ))}
            </div>

            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!selectedHistory ? <p className="text-sm text-slate-500">Selecciona un registro para revisar el detalle y descargar otros formatos.</p> : (
                <div className="space-y-4 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">Tipo</p>
                    <p>Vectorización IA</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Fecha</p>
                    <p>{formatDate(selectedHistory.createdAt)}</p>
                  </div>
                  {selectedHistory.actorLabel ? (
                    <div>
                      <p className="font-medium text-slate-900">Usuario</p>
                      <p>{selectedHistory.actorLabel}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="font-medium text-slate-900">Detalle</p>
                    <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.responseText || selectedHistory.summary || selectedHistory.prompt}</p>
                  </div>
                  {selectedHistory.asset?.path ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Archivo guardado</p>
                      <p className="rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.asset.path}</p>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/vectorizer-ai")}&preview=${encodeURIComponent(selectedHistory.asset.path)}`}>
                          Abrir en administrador de archivos
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                  {selectedHistory.availableDownloads.length ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Descargar desde Vectorizer.AI</p>
                      <div className="flex flex-wrap gap-2">
                        {DOWNLOAD_OPTIONS.filter((option) => selectedHistory.availableDownloads.includes(option.value)).map((option) => {
                          const key = `${selectedHistory.id}:${option.value}`
                          return (
                            <Button key={option.value} type="button" variant="outline" size="sm" onClick={() => void handleDownloadFromHistory(selectedHistory, option.value)} disabled={downloadingKey === key}>
                              {downloadingKey === key ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                              {option.label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={generationModalOpen}
        onOpenChange={(open) => {
          if (loading || approvalLoading) return
          setGenerationModalOpen(open)
        }}
      >
        <DialogContent hideClose={loading || approvalLoading} className="max-h-[92vh] max-w-6xl overflow-hidden border-slate-800 bg-slate-950 text-white">
          <DialogHeader className="space-y-2 border-b border-slate-800 pb-4 text-left">
            <DialogTitle className="text-xl text-white">{loading ? "Vectorizando imagen" : savedVector ? "Vector listo y guardado" : "Revisión del vector generado"}</DialogTitle>
            <p className="text-sm text-slate-300">
              {loading
                ? "Estamos enviando la imagen a Vectorizer.AI. Cuando termine verás el SVG aquí mismo antes de guardarlo."
                : generationResponse || "Revisa el SVG resultante, descárgalo si quieres y apruébalo para guardarlo en archivos."}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto py-4">
            {loading ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-3xl border border-slate-800 bg-black/40 px-6 text-center">
                <LoaderCircle className="h-14 w-14 animate-spin text-white" />
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-white">Vectorizando...</p>
                  <p className="max-w-2xl text-sm text-slate-300">El SVG de salida se mostrará aquí antes de guardarse en CRM.</p>
                </div>
              </div>
            ) : generatedVector ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="overflow-hidden rounded-3xl border border-slate-800 bg-white p-3">
                    <img src={generatedVector.previewDataUrl} alt="Vista previa de vector SVG" className="max-h-[68vh] w-full rounded-2xl object-contain" />
                  </div>
                  <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-200">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Origen de la respuesta</p>
                      <p className="mt-2 text-base font-medium text-white">Vectorizer.AI</p>
                      <p className="mt-1">Proveedor: {generatedVector.source.provider}</p>
                      <p>Formato base: {generatedVector.source.outputFormat.toUpperCase()}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Respuesta concreta</p>
                      <p className="mt-2 whitespace-pre-line text-slate-100">{generationResponse}</p>
                    </div>

                    {savedVector ? (
                      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-50">
                        <p className="font-medium">Guardado correctamente</p>
                        <p className="mt-1 text-sm">Ruta: {savedVector.path}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-black/30 px-6 text-center text-sm text-slate-400">
                No se pudo preparar la vista previa del SVG. Ajusta la imagen y vuelve a intentarlo.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-800 pt-4 sm:justify-between sm:space-x-0">
            <div className="flex flex-wrap gap-2">
              {generatedVector ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={handleDownloadGenerated} disabled={loading || approvalLoading}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar SVG
                </Button>
              ) : null}
              {savedVector ? (
                <Button asChild type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/vectorizer-ai")}&preview=${encodeURIComponent(savedVector.path)}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir en archivos
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setGenerationModalOpen(false)} disabled={loading || approvalLoading}>
                Cerrar
              </Button>
              {generatedVector && !savedVector ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => void handleRetryFromModal()} disabled={loading || approvalLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Volver a intentarlo
                </Button>
              ) : null}
              {generatedVector && !savedVector ? (
                <Button type="button" className="bg-white text-slate-950 hover:bg-slate-200" onClick={handleApproveSave} disabled={loading || approvalLoading}>
                  {approvalLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Aprobar para guardar
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}