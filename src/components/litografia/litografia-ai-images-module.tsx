"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Download, ExternalLink, History, ImagePlus, LoaderCircle, RefreshCw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type ImageQuality = "low" | "medium" | "high" | "auto"

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024"

type AiHistoryEntry = {
  id: string
  kind: "LITOGRAFIA_QUOTE" | "IMAGE_GENERATION"
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
}

type GeneratedImageResult = {
  historyId: string
  pendingId: string
  previewDataUrl: string
  revisedPrompt: string | null
  responseText: string
  source: {
    provider: string
    model: string
    mode: "LLM"
  }
}

type HistoryResponse = {
  ok?: boolean
  history?: AiHistoryEntry[]
  scope?: "company" | "personal"
  error?: string
}

type ImageResponse = {
  ok?: boolean
  image?: GeneratedImageResult | null
  saved?: {
    name: string
    path: string
    url: string | null
  } | null
  responseText?: string
  error?: string
}

type SavedImageResult = {
  name: string
  path: string
  url: string | null
}

const IMAGE_SIZE_OPTIONS: Array<{ value: ImageSize; label: string; hint: string }> = [
  { value: "1024x1024", label: "Cuadrada 1024x1024", hint: "Ideal para logos, mockups simples y piezas de redes." },
  { value: "1024x1536", label: "Vertical 1024x1536", hint: "Mejor para afiches, portadas y piezas publicitarias altas." },
  { value: "1536x1024", label: "Horizontal 1536x1024", hint: "Útil para banners, cabeceras y escenas panorámicas." },
]

const IMAGE_QUALITY_OPTIONS: Array<{ value: ImageQuality; label: string; hint: string }> = [
  { value: "low", label: "Baja", hint: "Borrador rápido y costo menor." },
  { value: "medium", label: "Media", hint: "Balance recomendado para trabajo diario." },
  { value: "high", label: "Alta", hint: "Más detalle, pero mayor costo por intento." },
  { value: "auto", label: "Auto", hint: "Deja que el proveedor ajuste calidad según el caso." },
]

const PROMPT_RECOMMENDATIONS = [
  "Define el tipo de pieza: logo, mockup, portada, banner o empaque.",
  "Indica estilo visual: minimalista, corporativo, realista, premium, editorial o infantil.",
  "Especifica colores y restricciones: verdes y azules, sin mascotas caricaturescas, fondo blanco, etc.",
  "Aclara composición y uso final: centrado, icono con texto, formato vertical, pensado para impresión o redes.",
]

const SAMPLE_PROMPTS: Array<{ title: string; prompt: string }> = [
  {
    title: "Logo corporativo",
    prompt:
      "Logo profesional para clínica veterinaria, símbolo geométrico con huella y cruz médica integradas, colores verde esmeralda y azul petróleo, tipografía sans serif moderna, composición limpia, fondo blanco, estilo corporativo premium, vectorial, sin caricatura, alta legibilidad para impresión y redes.",
  },
  {
    title: "Brochure institucional",
    prompt:
      "Brochure tríptico corporativo para empresa de tecnología, portada elegante con fotografía realista de equipo en oficina moderna, paleta azul marino y cian, diagramación editorial con amplios espacios en blanco, estilo premium, iluminación natural, enfoque comercial, listo como referencia visual para impresión litográfica.",
  },
  {
    title: "Poster promocional",
    prompt:
      "Afiche publicitario vertical para lanzamiento de evento empresarial, composición impactante con titular protagonista, fondo con degradado sobrio azul y dorado, fotografía realista del producto o servicio en primer plano, estilo moderno y premium, jerarquía visual clara, acabado de alta calidad pensado para impresión gran formato.",
  },
  {
    title: "Flyer comercial",
    prompt:
      "Flyer publicitario tamaño carta para promoción de apertura, diseño limpio y persuasivo, imagen principal realista del producto, bloques de información bien separados, colores corporativos rojo vino y crema, tipografía moderna, estilo retail premium, espacio para llamado a la acción y datos de contacto, optimizado para litografía.",
  },
]

const HISTORY_PAGE_SIZE = 5

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function LitografiaAiImagesModule() {
  const [prompt, setPrompt] = useState("")
  const [imageQuality, setImageQuality] = useState<ImageQuality>("medium")
  const [imageSize, setImageSize] = useState<ImageSize>("1024x1024")
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<AiHistoryEntry[]>([])
  const [historyScope, setHistoryScope] = useState<"company" | "personal">("personal")
  const [selectedHistory, setSelectedHistory] = useState<AiHistoryEntry | null>(null)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageResult | null>(null)
  const [savedImage, setSavedImage] = useState<SavedImageResult | null>(null)
  const [lastGeneratedConfig, setLastGeneratedConfig] = useState<{ size: ImageSize; quality: ImageQuality } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationModalOpen, setGenerationModalOpen] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [generationResponse, setGenerationResponse] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)

  const historyCountLabel = useMemo(() => {
    if (historyLoading) return "Cargando historial..."
    if (!history.length) return "Sin consultas registradas"
    return `${history.length} registros recientes`
  }, [history, historyLoading])

  const selectedSizeLabel = IMAGE_SIZE_OPTIONS.find((option) => option.value === imageSize)?.label ?? imageSize
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return history.slice(start, start + HISTORY_PAGE_SIZE)
  }, [history, historyPage])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/litografia/ia/imagenes", { cache: "no-store" })
      const json = (await response.json().catch(() => null)) as HistoryResponse | null
      if (!response.ok || !json?.ok || !Array.isArray(json.history)) {
        throw new Error(json?.error || "No se pudo cargar el historial IA.")
      }
      setHistory(json.history)
      setHistoryScope(json.scope === "company" ? "company" : "personal")
      setHistoryPage(1)
    } catch (historyError) {
      setHistory([])
      setHistoryScope("personal")
      setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial IA.")
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

  const handleGenerateImage = async () => {
    setGenerationModalOpen(true)
    setLoading(true)
    setApprovalLoading(false)
    setError(null)
    setGenerationResponse(null)
    setSavedImage(null)
    try {
      const response = await fetch("/api/litografia/ia/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", prompt: prompt.trim(), size: imageSize, quality: imageQuality }),
      })

      const json = (await response.json().catch(() => null)) as ImageResponse | null
      if (!response.ok || !json?.ok || !json.image) {
        throw new Error(json?.error || "No fue posible generar la imagen.")
      }

      setGeneratedImage(json.image)
      setGenerationResponse(json.image.responseText)
      setLastGeneratedConfig({ size: imageSize, quality: imageQuality })
    } catch (imageError) {
      setGeneratedImage(null)
      setError(imageError instanceof Error ? imageError.message : "Error generando la imagen.")
    } finally {
      setLoading(false)
    }
  }

  const handleApproveSave = async () => {
    if (!generatedImage) return
    setApprovalLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", pendingId: generatedImage.pendingId, historyId: generatedImage.historyId }),
      })

      const json = (await response.json().catch(() => null)) as ImageResponse | null
      if (!response.ok || !json?.ok || !json.saved) {
        throw new Error(json?.error || "No fue posible guardar la imagen en el administrador de archivos.")
      }

      setSavedImage(json.saved)
      setGenerationResponse(json.responseText || "Imagen aprobada y guardada correctamente.")
      await loadHistory()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar la imagen.")
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleDownloadGenerated = () => {
    if (!generatedImage) return
    const anchor = document.createElement("a")
    anchor.href = generatedImage.previewDataUrl
    anchor.download = `${prompt.trim().slice(0, 48).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "imagen-ia"}.png`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleRetryFromModal = async () => {
    setGeneratedImage(null)
    setSavedImage(null)
    await handleGenerateImage()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imágenes IA para litografía</h1>
          <p className="text-muted-foreground">Módulo independiente para crear imágenes con IA, guardarlas directo en el administrador de archivos y revisar el historial consulta por consulta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/crm/archivos?path=ia%2Fchatgpt-imagenes">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir carpeta guardada
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Ver historial de consultas
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-700">
            <ImagePlus className="h-5 w-5" />
            <CardTitle className="text-lg">Generador de imágenes</CardTitle>
          </div>
          <CardDescription>
            Genera primero una vista previa en modal, luego decide si la guardas en el administrador de archivos dentro de IA/chatgpt-imagenes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="litografia-ai-images-prompt">Prompt para imagen</Label>
            <Textarea
              id="litografia-ai-images-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-32"
              placeholder="Ejemplo: mockup fotográfico de brochure corporativo premium sobre escritorio, iluminación natural, estilo realista"
            />
            <p className="text-xs text-slate-500">
              Ejemplo sólido: logo profesional para veterinaria, colores verde y azul, símbolo limpio con huella y cruz médica, tipografía moderna, fondo blanco, estilo corporativo, sin caricatura.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
            <div className="space-y-2">
              <Label>Calidad de imagen</Label>
              <Select value={imageQuality} onValueChange={(value) => setImageQuality(value as ImageQuality)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona calidad" />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_QUALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{IMAGE_QUALITY_OPTIONS.find((option) => option.value === imageQuality)?.hint}</p>
            </div>

            <div className="space-y-2">
              <Label>Tamaño final</Label>
              <Select value={imageSize} onValueChange={(value) => setImageSize(value as ImageSize)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tamaño" />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{IMAGE_SIZE_OPTIONS.find((option) => option.value === imageSize)?.hint}</p>
            </div>

            <div className="space-y-2 md:pt-7">
              <Button type="button" onClick={handleGenerateImage} disabled={loading || prompt.trim().length < 12} className="w-full md:w-auto">
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                Generar imagen
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-medium">Prompts de muestra para piezas litográficas</p>
              <div className="mt-3 space-y-3">
                {SAMPLE_PROMPTS.map((sample) => (
                  <details key={sample.title} className="group rounded-lg border border-emerald-200 bg-white/70 p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-emerald-950">
                      <span>{sample.title}</span>
                      <ChevronDown className="h-4 w-4 text-emerald-700 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-xs leading-5 text-emerald-900">{sample.prompt}</p>
                  </details>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Cómo pedir mejores imágenes y evitar varios intentos</p>
              <div className="mt-3 space-y-2">
                {PROMPT_RECOMMENDATIONS.map((recommendation) => (
                  <p key={recommendation}>{recommendation}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{historyCountLabel}</p>
          </div>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {savedImage ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img src={generatedImage?.previewDataUrl || savedImage.url || ""} alt="Imagen generada con IA" className="max-h-[28rem] w-full object-contain" />
              </div>
              {lastGeneratedConfig ? (
                <p className="text-sm text-slate-700">
                  Configuración usada: {lastGeneratedConfig.quality} · {IMAGE_SIZE_OPTIONS.find((option) => option.value === lastGeneratedConfig.size)?.label ?? lastGeneratedConfig.size}
                </p>
              ) : null}
              {generationResponse ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{generationResponse}</p> : null}
              {generatedImage?.revisedPrompt ? <p className="text-sm text-slate-700">Prompt revisado: {generatedImage.revisedPrompt}</p> : null}
              {savedImage ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <span>Guardada en: {savedImage.path}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/chatgpt-imagenes")}&preview=${encodeURIComponent(savedImage.path)}`}>
                      Ver en administrador
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{historyScope === "company" ? "Últimas consultas del equipo" : "Tus últimas consultas"}</CardTitle>
          <CardDescription>{historyScope === "company" ? "Vista rápida de la actividad reciente del equipo. El botón superior abre el historial completo item por item." : "Vista rápida de tu actividad reciente. El botón superior abre tu historial completo item por item."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyLoading ? <p className="text-sm text-muted-foreground">Cargando historial...</p> : null}
          {!historyLoading && !history.length ? <p className="text-sm text-muted-foreground">Aún no hay actividad IA registrada.</p> : null}
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
                <p className="font-medium text-slate-900">{entry.kind === "IMAGE_GENERATION" ? "Imagen" : "Cotización"}</p>
                <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2">{entry.prompt}</p>
              {entry.asset?.path ? <p className="mt-2 text-xs text-slate-500">Archivo: {entry.asset.path}</p> : null}
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{historyScope === "company" ? "Historial general de consultas IA" : "Tu historial de consultas IA"}</DialogTitle>
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
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-900">{entry.kind === "IMAGE_GENERATION" ? "Imagen" : "Cotización"}</p>
                    <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-slate-700">{entry.prompt}</p>
                  {entry.actorLabel ? <p className="mt-2 text-xs text-slate-500">Usuario: {entry.actorLabel}</p> : null}
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
              {!selectedHistory ? <p className="text-sm text-slate-500">Selecciona un registro para revisar la consulta item por item.</p> : (
                <div className="space-y-4 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">Tipo</p>
                    <p>{selectedHistory.kind === "IMAGE_GENERATION" ? "Generación de imagen" : "Cotización IA"}</p>
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
                    <p className="font-medium text-slate-900">Prompt</p>
                    <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.prompt}</p>
                  </div>
                  {selectedHistory.summary ? (
                    <div>
                      <p className="font-medium text-slate-900">Resumen</p>
                      <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.summary}</p>
                    </div>
                  ) : null}
                  {selectedHistory.responseText ? (
                    <div>
                      <p className="font-medium text-slate-900">Respuesta</p>
                      <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.responseText}</p>
                    </div>
                  ) : null}
                  {selectedHistory.asset?.path ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Archivo asociado</p>
                      <p className="rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.asset.path}</p>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/chatgpt-imagenes")}&preview=${encodeURIComponent(selectedHistory.asset.path)}`}>
                          Abrir en administrador de archivos
                        </Link>
                      </Button>
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
            <DialogTitle className="text-xl text-white">{loading ? "Generando imagen" : savedImage ? "Imagen lista y guardada" : "Revisión de imagen generada"}</DialogTitle>
            <p className="text-sm text-slate-300">
              {loading
                ? "Estamos procesando tu prompt con IA. Cuando termine verás la vista previa aquí mismo antes de guardarla."
                : generationResponse || "Revisa el resultado, descárgalo si quieres y apruébalo para guardarlo en archivos."}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto py-4">
            {loading ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-3xl border border-slate-800 bg-black/40 px-6 text-center">
                <LoaderCircle className="h-14 w-14 animate-spin text-white" />
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-white">Generando imagen...</p>
                  <p className="max-w-2xl text-sm text-slate-300">La pantalla queda en foco sobre el resultado. No se guardará nada hasta que la apruebes.</p>
                </div>
              </div>
            ) : generatedImage ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="overflow-hidden rounded-3xl border border-slate-800 bg-white p-3">
                    <img src={generatedImage.previewDataUrl} alt="Vista previa de imagen IA" className="max-h-[68vh] w-full rounded-2xl object-contain" />
                  </div>
                  <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-200">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Origen de la respuesta</p>
                      <p className="mt-2 text-base font-medium text-white">IA real</p>
                      <p className="mt-1">Proveedor: {generatedImage.source.provider}</p>
                      <p>Modelo: {generatedImage.source.model}</p>
                    </div>

                    {lastGeneratedConfig ? (
                      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Configuración usada</p>
                        <p className="mt-2 text-white">{IMAGE_QUALITY_OPTIONS.find((option) => option.value === lastGeneratedConfig.quality)?.label} · {IMAGE_SIZE_OPTIONS.find((option) => option.value === lastGeneratedConfig.size)?.label}</p>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Respuesta concreta</p>
                      <p className="mt-2 whitespace-pre-line text-slate-100">{generationResponse}</p>
                    </div>

                    {generatedImage.revisedPrompt ? (
                      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Prompt revisado</p>
                        <p className="mt-2 whitespace-pre-line text-slate-100">{generatedImage.revisedPrompt}</p>
                      </div>
                    ) : null}

                    {savedImage ? (
                      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-50">
                        <p className="font-medium">Guardada correctamente</p>
                        <p className="mt-1 text-sm">Ruta: {savedImage.path}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-black/30 px-6 text-center text-sm text-slate-400">
                No se pudo preparar una vista previa. Ajusta el prompt y vuelve a intentarlo.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-800 pt-4 sm:justify-between sm:space-x-0">
            <div className="flex flex-wrap gap-2">
              {generatedImage ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={handleDownloadGenerated} disabled={loading || approvalLoading}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </Button>
              ) : null}
              {savedImage ? (
                <Button asChild type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/chatgpt-imagenes")}&preview=${encodeURIComponent(savedImage.path)}`}>
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
              {generatedImage && !savedImage ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => void handleRetryFromModal()} disabled={loading || approvalLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Volver a intentarlo
                </Button>
              ) : null}
              {generatedImage && !savedImage ? (
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