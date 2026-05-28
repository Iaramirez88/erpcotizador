"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ExternalLink, History, ImagePlus, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
  previewDataUrl: string
  revisedPrompt: string | null
  file: {
    name: string
    path: string
    url: string | null
  } | null
}

type HistoryResponse = {
  ok?: boolean
  history?: AiHistoryEntry[]
  error?: string
}

type ImageResponse = {
  ok?: boolean
  image?: GeneratedImageResult | null
  error?: string
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function LitografiaAiImagesModule() {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<AiHistoryEntry[]>([])
  const [selectedHistory, setSelectedHistory] = useState<AiHistoryEntry | null>(null)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const historyCountLabel = useMemo(() => {
    if (historyLoading) return "Cargando historial..."
    if (!history.length) return "Sin consultas registradas"
    return `${history.length} registros recientes`
  }, [history, historyLoading])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/litografia/ia/imagenes", { cache: "no-store" })
      const json = (await response.json().catch(() => null)) as HistoryResponse | null
      if (!response.ok || !json?.ok || !Array.isArray(json.history)) {
        throw new Error(json?.error || "No se pudo cargar el historial IA.")
      }
      setHistory(json.history)
    } catch (historyError) {
      setHistory([])
      setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial IA.")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const handleGenerateImage = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), size: "1024x1024", quality: "high" }),
      })

      const json = (await response.json().catch(() => null)) as ImageResponse | null
      if (!response.ok || !json?.ok || !json.image) {
        throw new Error(json?.error || "No fue posible generar la imagen.")
      }

      setGeneratedImage(json.image)
      await loadHistory()
    } catch (imageError) {
      setGeneratedImage(null)
      setError(imageError instanceof Error ? imageError.message : "Error generando la imagen.")
    } finally {
      setLoading(false)
    }
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
            Cada imagen se guarda automáticamente en el administrador de archivos dentro de IA/chatgpt-imagenes.
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleGenerateImage} disabled={loading || prompt.trim().length < 12}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              Generar y guardar imagen
            </Button>
            <p className="text-sm text-muted-foreground">{historyCountLabel}</p>
          </div>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {generatedImage ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img src={generatedImage.previewDataUrl} alt="Imagen generada con IA" className="max-h-[28rem] w-full object-contain" />
              </div>
              {generatedImage.revisedPrompt ? <p className="text-sm text-slate-700">Prompt revisado: {generatedImage.revisedPrompt}</p> : null}
              {generatedImage.file ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <span>Guardada en: {generatedImage.file.path}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("ia/chatgpt-imagenes")}&preview=${encodeURIComponent(generatedImage.file.path)}`}>
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
          <CardTitle className="text-lg">Últimas consultas</CardTitle>
          <CardDescription>Vista rápida de la actividad reciente. El botón superior abre el historial completo item por item.</CardDescription>
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
            <DialogTitle>Historial de consultas IA</DialogTitle>
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
                    <p className="font-medium text-slate-900">{entry.kind === "IMAGE_GENERATION" ? "Imagen" : "Cotización"}</p>
                    <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-slate-700">{entry.prompt}</p>
                  {entry.actorLabel ? <p className="mt-2 text-xs text-slate-500">Usuario: {entry.actorLabel}</p> : null}
                </button>
              ))}
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
                        <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("ia/chatgpt-imagenes")}&preview=${encodeURIComponent(selectedHistory.asset.path)}`}>
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
    </div>
  )
}