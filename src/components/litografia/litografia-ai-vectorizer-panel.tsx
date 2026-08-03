"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Download, ExternalLink, History, LoaderCircle, RefreshCw, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type VectorFormat = "svg" | "pdf" | "eps" | "dxf" | "png"
type VectorSvgVersion = "svg_1_0" | "svg_1_1" | "svg_tiny_1_2"
type VectorDxfCompatibilityLevel = "lines_only" | "lines_and_arcs" | "lines_arcs_and_splines"
type VectorDrawStyle = "fill_shapes" | "stroke_shapes" | "stroke_edges"
type VectorShapeStacking = "cutouts" | "stacked"
type VectorGroupBy = "none" | "color" | "parent" | "layer"

type VectorizerOutputOptions = {
  fileFormat: VectorFormat
  svgVersion: VectorSvgVersion
  svgFixedSize: boolean
  svgAdobeCompatibilityMode: boolean
  dxfCompatibilityLevel: VectorDxfCompatibilityLevel
  drawStyle: VectorDrawStyle
  shapeStacking: VectorShapeStacking
  groupBy: VectorGroupBy
  parameterizedShapesFlatten: boolean
  allowQuadraticBezier: boolean
  allowCubicBezier: boolean
  allowCircularArc: boolean
  allowEllipticalArc: boolean
  lineFitTolerance: number
  gapFillerEnabled: boolean
  gapFillerClip: boolean
  gapFillerNonScalingStroke: boolean
  gapFillerStrokeWidth: number
  strokesNonScalingStroke: boolean
  strokesUseOverrideColor: boolean
  strokesOverrideColor: string
  strokesStrokeWidth: number
}

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
  scope?: "company" | "personal"
  error?: string
}

type GeneratedVectorResult = {
  historyId?: string | null
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

const SVG_VERSION_OPTIONS: Array<{ value: VectorSvgVersion; label: string }> = [
  { value: "svg_1_0", label: "SVG 1.0" },
  { value: "svg_1_1", label: "SVG 1.1" },
  { value: "svg_tiny_1_2", label: "SVG Tiny 1.2" },
]

const DXF_COMPATIBILITY_OPTIONS: Array<{ value: VectorDxfCompatibilityLevel; label: string }> = [
  { value: "lines_only", label: "Sólo líneas" },
  { value: "lines_and_arcs", label: "Líneas y arcos" },
  { value: "lines_arcs_and_splines", label: "Líneas, arcos y splines" },
]

const DRAW_STYLE_OPTIONS: Array<{ value: VectorDrawStyle; label: string }> = [
  { value: "fill_shapes", label: "Rellenar figuras" },
  { value: "stroke_shapes", label: "Delinear la figura" },
  { value: "stroke_edges", label: "Delinear los bordes entre figuras una vez" },
]

const SHAPE_STACKING_OPTIONS: Array<{ value: VectorShapeStacking; label: string }> = [
  { value: "cutouts", label: "Colocar las figuras en los espacios recortados de las figuras abajo" },
  { value: "stacked", label: "Apilar las figuras" },
]

const GROUP_BY_OPTIONS: Array<{ value: VectorGroupBy; label: string }> = [
  { value: "none", label: "Ninguna" },
  { value: "color", label: "Color" },
  { value: "parent", label: "Primaria" },
  { value: "layer", label: "Capa" },
]

const LINE_FIT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.3, label: "Gruesa" },
  { value: 0.1, label: "Mediano" },
  { value: 0.03, label: "Fina" },
  { value: 0.01, label: "Súper fina" },
]

const DEFAULT_OUTPUT_OPTIONS: VectorizerOutputOptions = {
  fileFormat: "pdf",
  svgVersion: "svg_1_1",
  svgFixedSize: false,
  svgAdobeCompatibilityMode: false,
  dxfCompatibilityLevel: "lines_and_arcs",
  drawStyle: "fill_shapes",
  shapeStacking: "cutouts",
  groupBy: "none",
  parameterizedShapesFlatten: false,
  allowQuadraticBezier: true,
  allowCubicBezier: true,
  allowCircularArc: true,
  allowEllipticalArc: true,
  lineFitTolerance: 0.1,
  gapFillerEnabled: true,
  gapFillerClip: false,
  gapFillerNonScalingStroke: true,
  gapFillerStrokeWidth: 2,
  strokesNonScalingStroke: true,
  strokesUseOverrideColor: false,
  strokesOverrideColor: "#000000",
  strokesStrokeWidth: 1,
}

const HISTORY_PAGE_SIZE = 5

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

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function getFormatLabel(format: VectorFormat) {
  return DOWNLOAD_OPTIONS.find((option) => option.value === format)?.label || format.toUpperCase()
}

export function LitografiaAiVectorizerPanel() {
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null)
  const [outputOptions, setOutputOptions] = useState<VectorizerOutputOptions>(DEFAULT_OUTPUT_OPTIONS)
  const [loading, setLoading] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<VectorHistoryEntry[]>([])
  const [historyScope, setHistoryScope] = useState<"company" | "personal">("personal")
  const [selectedHistory, setSelectedHistory] = useState<VectorHistoryEntry | null>(null)
  const [generatedVector, setGeneratedVector] = useState<GeneratedVectorResult | null>(null)
  const [savedVector, setSavedVector] = useState<SavedVectorResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationModalOpen, setGenerationModalOpen] = useState(false)
  const [generationResponse, setGenerationResponse] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)

  const historyCountLabel = useMemo(() => {
    if (historyLoading) return "Cargando historial..."
    if (!history.length) return "Sin vectorizaciones registradas"
    return `${history.length} vectores recientes`
  }, [history, historyLoading])
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return history.slice(start, start + HISTORY_PAGE_SIZE)
  }, [history, historyPage])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", { cache: "no-store" })
      const json = (await response.json().catch(() => null)) as VectorHistoryResponse | null
      if (!response.ok || !json?.ok || !Array.isArray(json.history)) {
        throw new Error(json?.error || "No se pudo cargar el historial de vectorización.")
      }
      setHistory(json.history)
      setHistoryScope(json.scope === "company" ? "company" : "personal")
      setHistoryPage(1)
      setSelectedHistory((current) => json.history?.find((entry) => entry.id === current?.id) ?? json.history?.[0] ?? null)
    } catch (historyError) {
      setHistory([])
      setHistoryScope("personal")
      setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial de vectorización.")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages)
    }
  }, [historyPage, totalHistoryPages])

  useEffect(() => {
    if (!historyOpen) return
    if (selectedHistory && paginatedHistory.some((entry) => entry.id === selectedHistory.id)) return
    setSelectedHistory(paginatedHistory[0] ?? null)
  }, [historyOpen, paginatedHistory, selectedHistory])

  useEffect(() => {
    if (!sourceFile) {
      setSourcePreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(sourceFile)
    setSourcePreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [sourceFile])

  function setVectorizerOption<K extends keyof VectorizerOutputOptions>(key: K, value: VectorizerOutputOptions[K]) {
    setOutputOptions((current) => ({ ...current, [key]: value }))
  }

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
      body.append("options", JSON.stringify(outputOptions))

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
        body: JSON.stringify({ action: "save", pendingId: generatedVector.pendingId, historyId: generatedVector.historyId }),
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

  const downloadVectorByHistoryId = async ({
    historyId,
    pendingId,
    format,
    fileName,
    downloadKey,
  }: {
    historyId?: string
    pendingId?: string
    format: VectorFormat
    fileName: string
    downloadKey: string
  }) => {
    const key = downloadKey
    setDownloadingKey(key)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/vectorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", historyId, pendingId, format, options: { ...outputOptions, fileFormat: format } }),
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(json?.error || `No se pudo descargar el formato ${format.toUpperCase()}.`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${fileName.replace(/\.[a-z0-9]+$/i, "")}.${format}`
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

  const handleDownloadGenerated = async () => {
    if (!generatedVector || !sourceFile) return

    if (outputOptions.fileFormat === "svg") {
      const anchor = document.createElement("a")
      anchor.href = generatedVector.previewDataUrl
      anchor.download = `${sourceFile.name.replace(/\.[a-z0-9]+$/i, "") || "vector"}.svg`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      return
    }

    await downloadVectorByHistoryId({
      pendingId: generatedVector.pendingId,
      format: outputOptions.fileFormat,
      fileName: sourceFile.name || "vector",
      downloadKey: `generated:${outputOptions.fileFormat}`,
    })
  }

  const handleDownloadFromHistory = async (entry: VectorHistoryEntry, format: VectorFormat) => {
    await downloadVectorByHistoryId({
      historyId: entry.id,
      format,
      fileName: entry.asset?.name || "vector",
      downloadKey: `${entry.id}:${format}`,
    })
  }

  const handleRetryFromModal = async () => {
    setGeneratedVector(null)
    setSavedVector(null)
    await handleVectorize()
  }

  const handleOpenGenerationModal = () => {
    if (!sourceFile) return
    setError(null)
    setGeneratedVector(null)
    setSavedVector(null)
    setGenerationResponse(null)
    setGenerationModalOpen(true)
  }

  const advancedOptionsContent = (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900/90 p-4 pr-3 text-sm text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Opciones avanzadas de exportación</p>
          <p className="mt-1 text-xs text-slate-400">La vista previa se revisa en SVG, pero el formato de descarga y las opciones técnicas se controlan desde aquí.</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
          Formato actual: {getFormatLabel(outputOptions.fileFormat)}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">Salida y compatibilidad</p>
          <p className="text-xs text-slate-400">PDF queda seleccionado por defecto para que la descarga del modal responda al formato elegido.</p>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-slate-200">Formato de archivo</Label>
          <Select value={outputOptions.fileFormat} onValueChange={(value) => setVectorizerOption("fileFormat", value as VectorFormat)}>
            <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950 text-sm text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOWNLOAD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {outputOptions.fileFormat === "svg" ? (
          <>
            <div className="grid gap-1.5">
              <Label className="text-slate-200">Versión SVG</Label>
              <Select value={outputOptions.svgVersion} onValueChange={(value) => setVectorizerOption("svgVersion", value as VectorSvgVersion)}>
                <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950 text-sm text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SVG_VERSION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Tamaño fijo</p>
                  <p className="text-xs text-slate-400">Mantiene width y height explícitos en el SVG.</p>
                </div>
                <Switch checked={outputOptions.svgFixedSize} onCheckedChange={(checked) => setVectorizerOption("svgFixedSize", checked)} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Compatibilidad Adobe</p>
                  <p className="text-xs text-slate-400">Recorta opciones que Illustrator suele importar mal.</p>
                </div>
                <Switch checked={outputOptions.svgAdobeCompatibilityMode} onCheckedChange={(checked) => setVectorizerOption("svgAdobeCompatibilityMode", checked)} />
              </div>
            </div>
          </>
        ) : null}

        {outputOptions.fileFormat === "dxf" ? (
          <div className="grid gap-1.5">
            <Label className="text-slate-200">Compatibilidad DXF</Label>
            <Select value={outputOptions.dxfCompatibilityLevel} onValueChange={(value) => setVectorizerOption("dxfCompatibilityLevel", value as VectorDxfCompatibilityLevel)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950 text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DXF_COMPATIBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
          <span>Trazado y geometría</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-1.5">
            <Label className="text-slate-200">Estilo de dibujo</Label>
            <Select value={outputOptions.drawStyle} onValueChange={(value) => setVectorizerOption("drawStyle", value as VectorDrawStyle)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950 text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRAW_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-slate-200">Tolerancia de ajuste de línea</Label>
            <Select value={String(outputOptions.lineFitTolerance)} onValueChange={(value) => setVectorizerOption("lineFitTolerance", Number(value))}>
              <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950 text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_FIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-slate-200">Apilar figuras</Label>
            <Select value={outputOptions.shapeStacking} onValueChange={(value) => setVectorizerOption("shapeStacking", value as VectorShapeStacking)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950 text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHAPE_STACKING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-slate-200">Agrupar por</Label>
            <Select value={outputOptions.groupBy} onValueChange={(value) => setVectorizerOption("groupBy", value as VectorGroupBy)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950 text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-white">Figuras parametrizadas</p>
              <p className="text-xs text-slate-400">Aplana círculos, rectángulos y formas detectadas a curvas normales.</p>
            </div>
            <Switch checked={outputOptions.parameterizedShapesFlatten} onCheckedChange={(checked) => setVectorizerOption("parameterizedShapesFlatten", checked)} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Curvas permitidas</p>
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Líneas</p>
                  <p className="text-xs text-slate-400">Siempre activas como fallback mínimo.</p>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">Siempre</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Bézier cuadrática</p>
                  <p className="text-xs text-slate-400">Mantiene trayectorias compactas donde aplica.</p>
                </div>
                <Switch checked={outputOptions.allowQuadraticBezier} onCheckedChange={(checked) => setVectorizerOption("allowQuadraticBezier", checked)} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Bézier cúbica</p>
                  <p className="text-xs text-slate-400">Compatible con todos los formatos de salida.</p>
                </div>
                <Switch checked={outputOptions.allowCubicBezier} onCheckedChange={(checked) => setVectorizerOption("allowCubicBezier", checked)} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Arcos circulares</p>
                  <p className="text-xs text-slate-400">Útiles para DXF, SVG y geometrías más limpias.</p>
                </div>
                <Switch checked={outputOptions.allowCircularArc} onCheckedChange={(checked) => setVectorizerOption("allowCircularArc", checked)} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Arcos elípticos</p>
                  <p className="text-xs text-slate-400">Preservan curvas complejas con menos nodos.</p>
                </div>
                <Switch checked={outputOptions.allowEllipticalArc} onCheckedChange={(checked) => setVectorizerOption("allowEllipticalArc", checked)} />
              </div>
            </div>
          </div>
        </div>
      </details>

      <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
          <span>Acabado visual</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">Rellenar espacios</p>
                <p className="text-xs text-slate-400">Corrige líneas blancas entre figuras adyacentes.</p>
              </div>
              <Switch checked={outputOptions.gapFillerEnabled} onCheckedChange={(checked) => setVectorizerOption("gapFillerEnabled", checked)} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">Recortar sobrante</p>
                <p className="text-xs text-slate-400">Recorta el reborde del gap filler en apilado stacked.</p>
              </div>
              <Switch checked={outputOptions.gapFillerClip} onCheckedChange={(checked) => setVectorizerOption("gapFillerClip", checked)} disabled={!outputOptions.gapFillerEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">Gap filler sin escala</p>
                <p className="text-xs text-slate-400">Mantiene ancho constante en SVG, DXF y PNG.</p>
              </div>
              <Switch checked={outputOptions.gapFillerNonScalingStroke} onCheckedChange={(checked) => setVectorizerOption("gapFillerNonScalingStroke", checked)} disabled={!outputOptions.gapFillerEnabled} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vector-gap-width" className="text-slate-200">Ancho del gap filler</Label>
            <Input
              id="vector-gap-width"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={outputOptions.gapFillerStrokeWidth}
              className="h-10 rounded-xl border-slate-700 bg-slate-950 text-white"
              disabled={!outputOptions.gapFillerEnabled}
              onChange={(event) => setVectorizerOption("gapFillerStrokeWidth", clampNumber(Number.parseFloat(event.target.value), 0, 5, 2))}
            />
          </div>

          {outputOptions.drawStyle !== "fill_shapes" ? (
            <div className="space-y-3 border-t border-slate-800 pt-3">
              <p className="text-sm font-medium text-white">Estilo del delineado</p>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Delineado sin escala</p>
                  <p className="text-xs text-slate-400">Evita que el grosor crezca al escalar.</p>
                </div>
                <Switch checked={outputOptions.strokesNonScalingStroke} onCheckedChange={(checked) => setVectorizerOption("strokesNonScalingStroke", checked)} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">Color de reemplazo</p>
                  <p className="text-xs text-slate-400">Fuerza un solo color para el contorno exportado.</p>
                </div>
                <Switch checked={outputOptions.strokesUseOverrideColor} onCheckedChange={(checked) => setVectorizerOption("strokesUseOverrideColor", checked)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="vector-stroke-color" className="text-slate-200">Color</Label>
                  <Input
                    id="vector-stroke-color"
                    value={outputOptions.strokesOverrideColor}
                    className="h-10 rounded-xl border-slate-700 bg-slate-950 text-white"
                    disabled={!outputOptions.strokesUseOverrideColor}
                    onChange={(event) => setVectorizerOption("strokesOverrideColor", event.target.value.toUpperCase())}
                    placeholder="#000000"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="vector-stroke-width" className="text-slate-200">Ancho</Label>
                  <Input
                    id="vector-stroke-width"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={outputOptions.strokesStrokeWidth}
                    className="h-10 rounded-xl border-slate-700 bg-slate-950 text-white"
                    onChange={(event) => setVectorizerOption("strokesStrokeWidth", clampNumber(Number.parseFloat(event.target.value), 0, 5, 1))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-400">
              El estilo de delineado se habilita cuando el modo de dibujo es delinear figura o delinear bordes.
            </div>
          )}
        </div>
      </details>
    </div>
  )

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
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="litografia-vectorizer-file">Imagen raster</Label>
              <Input id="litografia-vectorizer-file" type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp" onChange={(event) => setSourceFile(event.target.files?.[0] ?? null)} />
              <p className="text-xs text-slate-500">Formatos recomendados: PNG o JPG limpios. Vectorizer.AI también acepta GIF, BMP y WebP.</p>
            </div>

            <Button type="button" onClick={handleOpenGenerationModal} disabled={!sourceFile} className="w-full lg:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              Abrir vectorizador
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Antes de vectorizar</p>
              <p className="mt-2">Evita fotos muy comprimidas o con fondo sucio si el objetivo es sacar un logo limpio.</p>
              <p className="mt-2">Si el cliente trae una pieza compleja, empieza sin límite de color y luego afina una segunda pasada.</p>
              <p className="mt-2">La API permite descargar SVG, PDF, EPS, DXF y PNG desde el mismo historial sin reprocesar mientras el token siga retenido.</p>
              <p className="mt-2">Los botones de descarga del historial usan la configuración avanzada actual y sólo cambian el formato según el botón elegido.</p>
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
          <CardTitle className="text-lg">{historyScope === "company" ? "Últimas vectorizaciones del equipo" : "Tus últimas vectorizaciones"}</CardTitle>
          <CardDescription>{historyScope === "company" ? "Consulta rápida del historial guardado del equipo. Desde cada registro puedes descargar otros formatos desde la plataforma." : "Consulta rápida de tu historial guardado. Desde cada registro puedes descargar otros formatos desde la plataforma."}</CardDescription>
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
              <div className="flex items-start gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {entry.asset?.url ? (
                    <img src={entry.asset.url} alt="Miniatura de vectorización" className="h-full w-full object-contain" />
                  ) : (
                    <span className="px-2 text-center text-[11px] text-slate-400">Sin vista previa</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-900">Vectorización</p>
                    <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2">{entry.summary || entry.prompt}</p>
                  {entry.asset?.path ? <p className="mt-2 text-xs text-slate-500">Archivo: {entry.asset.path}</p> : null}
                  <p className="mt-2 text-xs font-medium text-sky-700">Abrir en modal</p>
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{historyScope === "company" ? "Historial general de vectorización" : "Tu historial de vectorización"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {paginatedHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedHistory(entry)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition ${selectedHistory?.id === entry.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {entry.asset?.url ? (
                        <img src={entry.asset.url} alt="Miniatura de vectorización" className="h-full w-full object-contain" />
                      ) : (
                        <span className="px-2 text-center text-[11px] text-slate-400">Sin preview</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-slate-900">Vectorización</p>
                        <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-slate-700">{entry.summary || entry.prompt}</p>
                      {entry.actorLabel ? <p className="mt-2 text-xs text-slate-500">Usuario: {entry.actorLabel}</p> : null}
                    </div>
                  </div>
                </button>
              ))}
              {history.length > HISTORY_PAGE_SIZE ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="text-slate-500">Página {historyPage} de {totalHistoryPages}</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} disabled={historyPage === 1}>
                      Anterior
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))} disabled={historyPage === totalHistoryPages}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!selectedHistory ? <p className="text-sm text-slate-500">Selecciona un registro para revisar el detalle y descargar otros formatos.</p> : (
                <div className="space-y-4 text-sm text-slate-700">
                  {selectedHistory.asset?.url ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
                      <img src={selectedHistory.asset.url} alt="Vista previa de vectorización guardada" className="max-h-[18rem] w-full object-contain" />
                    </div>
                  ) : null}
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
        <DialogContent hideClose={loading || approvalLoading} className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden border-slate-800 bg-slate-950 text-white">
          <DialogHeader className="space-y-2 border-b border-slate-800 pb-4 text-left">
            <DialogTitle className="text-xl text-white">{loading ? "Vectorizando imagen" : savedVector ? "Vector listo y guardado" : "Revisión del vector generado"}</DialogTitle>
            <p className="text-sm text-slate-300">
              {loading
                ? "Estamos enviando la imagen a Vectorizer.AI. Cuando termine verás el SVG aquí mismo antes de guardarlo."
                : generationResponse || "Revisa el SVG resultante, descárgalo si quieres y apruébalo para guardarlo en archivos."}
            </p>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden py-4">
            <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="min-h-0 overflow-y-auto pr-2">
                {loading ? (
                  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-3xl border border-slate-800 bg-black/40 px-6 text-center">
                    <LoaderCircle className="h-14 w-14 animate-spin text-white" />
                    <div className="space-y-2">
                      <p className="text-2xl font-semibold text-white">Vectorizando...</p>
                      <p className="max-w-2xl text-sm text-slate-300">El SVG de salida se mostrará aquí antes de guardarse en CRM.</p>
                    </div>
                  </div>
                ) : generatedVector ? (
                  <div className="overflow-hidden rounded-3xl border border-slate-800 bg-white p-3">
                    <img src={generatedVector.previewDataUrl} alt="Vista previa de vector SVG" className="max-h-[68vh] w-full rounded-2xl object-contain" />
                  </div>
                ) : sourcePreviewUrl ? (
                  <div className="overflow-hidden rounded-3xl border border-slate-800 bg-white p-3">
                    <img src={sourcePreviewUrl} alt="Vista previa de la imagen origen" className="max-h-[68vh] w-full rounded-2xl object-contain" />
                  </div>
                ) : (
                  <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-black/30 px-6 text-center text-sm text-slate-400">
                    Selecciona una imagen antes de abrir el modal para revisar la vista previa y configurar la exportación.
                  </div>
                )}
              </div>

              <div className="min-h-0 overflow-y-auto pr-1">
                <div className="flex min-h-full flex-col gap-4 pr-2">
                  {advancedOptionsContent}

                  <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-200">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Origen de la respuesta</p>
                      <p className="mt-2 text-base font-medium text-white">Vectorizer.AI</p>
                      <p className="mt-1">Proveedor: {generatedVector?.source.provider || "Vectorizer.AI"}</p>
                      <p>Formato base de revisión: SVG</p>
                      <p>Formato elegido para descarga: {getFormatLabel(outputOptions.fileFormat)}</p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Respuesta concreta</p>
                      <p className="mt-2 whitespace-pre-line text-slate-100">{generationResponse || "Ajusta las opciones de exportación y ejecuta la vectorización desde este modal."}</p>
                    </div>

                    {savedVector ? (
                      <div className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-50">
                        <p className="font-medium">Guardado correctamente</p>
                        <p className="mt-1 text-sm">Ruta: {savedVector.path}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-800 bg-slate-950 pt-4 sm:justify-between sm:space-x-0">
            <div className="flex flex-wrap gap-2">
              {generatedVector ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => void handleDownloadGenerated()} disabled={loading || approvalLoading || downloadingKey === `generated:${outputOptions.fileFormat}`}>
                  {downloadingKey === `generated:${outputOptions.fileFormat}` ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Descargar {getFormatLabel(outputOptions.fileFormat)}
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
              {!generatedVector ? (
                <Button type="button" className="bg-white text-slate-950 hover:bg-slate-200" onClick={() => void handleVectorize()} disabled={loading || approvalLoading || !sourceFile}>
                  {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Vectorizar ahora
                </Button>
              ) : null}
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