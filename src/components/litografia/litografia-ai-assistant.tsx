"use client"

import { useEffect, useState } from "react"
import { Sparkles, LoaderCircle, ClipboardCopy, ArrowRight, History, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { LitografiaAiHandoff } from "@/lib/litografia-ai-handoff"

type ConfidenceLevel = "ALTA" | "MEDIA" | "BAJA"

type LitografiaAiResult = {
  normalizedBrief: string
  summary: string
  confidence: ConfidenceLevel
  quoteType: string
  extracted: {
    producto: string | null
    cantidad: number | null
    anchoCm: number | null
    altoCm: number | null
    paginas: number | null
    tintas: 1 | 2 | 4 | null
    material: string | null
    acabado: string | null
    entrega: string | null
    observaciones: string[]
  }
  missingFields: string[]
  questions: string[]
  nextStep: string
  engine: {
    mode: "RULES" | "LLM"
    provider: string
    model: string | null
  }
}

type LitografiaAiConnection = {
  enabled: boolean
  provider: string
  model: string | null
}

type ConfiguredPriceSuggestion = {
  status: "MATCHED" | "PARTIAL" | "NO_MATCH"
  confidence: ConfidenceLevel
  title: string
  total: number | null
  unitPrice: number | null
  currency: "COP"
  reasoning: string[]
  matchedRateId: string | null
  matchedSize: string | null
  matchedPaper: string | null
  matchedFinish: string | null
}

type ExternalBenchmarkResult = {
  status: "CONFIGURED" | "NOT_CONFIGURED" | "UNAVAILABLE"
  provider: string | null
  summary: string | null
  suggestedTotalMin: number | null
  suggestedTotalMax: number | null
  reasoning: string[]
  references: Array<{ label: string; url: string }>
}

type CostBreakdownLine = {
  label: string
  amount: number
}

type CostBreakdown = {
  status: "AVAILABLE" | "PARTIAL" | "NOT_AVAILABLE"
  summary: string | null
  lines: CostBreakdownLine[]
  notes: string[]
  machineName: string | null
  paperName: string | null
  paperSheet: string | null
  sizeLabel: string | null
  productionCost: number | null
  utility: number | null
  subtotalBeforeIva: number | null
  ivaPct: number
  ivaValue: number | null
  totalSuggested: number | null
  unitPriceWithIva: number | null
}

type LitografiaAiPricing = {
  configuredSuggestion: ConfiguredPriceSuggestion
  costBreakdown: CostBreakdown
  externalBenchmark: ExternalBenchmarkResult
}

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

type AssistantQuoteReply = {
  title: string
  message: string
  assumptions: string[]
  copyText: string
}

const EXAMPLES = [
  "Necesito cotizar 2.000 volantes tamaño media carta en propalcote 150 gramos, impresión full color por una cara y plastificado mate.",
  "Quiero 500 tarjetas de presentación 9x5 cm en propalcote 350 g, 4x4, laminado mate y esquinas redondeadas.",
  "Cotízame una revista de 32 páginas tamaño carta, portada en propalcote 300 g, internas bond 90 g, full color, 1.000 unidades.",
]

function formatFieldValue(label: string, value: string | number | null) {
  if (value == null || value === "") return `${label}: pendiente`
  return `${label}: ${value}`
}

function compactField(label: string, value: string | number | null) {
  if (value == null || value === "") return null
  return { label, value: String(value) }
}

function formatMoney(value: number | null, formatter: Intl.NumberFormat) {
  return value != null ? formatter.format(value) : null
}

export function LitografiaAiAssistant(props: {
  onApplyToClassic?: (draft: LitografiaAiHandoff) => void
  initialBrief?: string
  openToken?: string | number
}) {
  const [brief, setBrief] = useState(EXAMPLES[0])
  const [result, setResult] = useState<LitografiaAiResult | null>(null)
  const [connection, setConnection] = useState<LitografiaAiConnection | null>(null)
  const [pricing, setPricing] = useState<LitografiaAiPricing | null>(null)
  const [handoff, setHandoff] = useState<LitografiaAiHandoff | null>(null)
  const [assistantReply, setAssistantReply] = useState<AssistantQuoteReply | null>(null)
  const [history, setHistory] = useState<AiHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [imagePrompt, setImagePrompt] = useState("")
  const [imageLoading, setImageLoading] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const currencyFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  })

  useEffect(() => {
    const seededBrief = String(props.initialBrief || "").trim()
    if (!seededBrief) return
    setBrief(seededBrief)
    setResult(null)
    setConnection(null)
    setPricing(null)
    setHandoff(null)
    setAssistantReply(null)
    setError(null)
    setCopied(false)
  }, [props.initialBrief, props.openToken])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/litografia/ia/imagenes", { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; history?: AiHistoryEntry[]; error?: string } | null

      if (!res.ok || !json?.ok || !Array.isArray(json.history)) {
        throw new Error(json?.error || "No se pudo cargar el historial IA.")
      }

      setHistory(json.history)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch("/api/litografia/ia/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      })

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; data?: LitografiaAiResult; connection?: LitografiaAiConnection; pricing?: LitografiaAiPricing; assistantReply?: AssistantQuoteReply | null; handoff?: LitografiaAiHandoff | null }
        | null

      if (!res.ok || !json?.ok || !json.data) {
        throw new Error(json?.error || "No fue posible analizar el requerimiento.")
      }

      setResult(json.data)
      setConnection(json.connection ?? null)
      setPricing(json.pricing ?? null)
      setHandoff(json.handoff ?? null)
      setAssistantReply(json.assistantReply ?? null)
      await loadHistory()
    } catch (analysisError) {
      setResult(null)
      setConnection(null)
      setPricing(null)
      setHandoff(null)
      setAssistantReply(null)
      setError(analysisError instanceof Error ? analysisError.message : "Error inesperado analizando el brief.")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateImage = async () => {
    setImageLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/litografia/ia/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: (imagePrompt || brief).trim(), size: "1024x1024", quality: "high" }),
      })

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; image?: GeneratedImageResult | null } | null
      if (!res.ok || !json?.ok || !json.image) {
        throw new Error(json?.error || "No fue posible generar la imagen.")
      }

      setGeneratedImage(json.image)
      await loadHistory()
    } catch (imageError) {
      setGeneratedImage(null)
      setError(imageError instanceof Error ? imageError.message : "Error generando la imagen.")
    } finally {
      setImageLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    const fallbackLines = [
      result.summary,
      formatFieldValue("Producto", result.extracted.producto),
      formatFieldValue("Cantidad", result.extracted.cantidad),
      formatFieldValue("Tamaño", result.extracted.anchoCm && result.extracted.altoCm ? `${result.extracted.anchoCm} x ${result.extracted.altoCm} cm` : null),
      formatFieldValue("Páginas", result.extracted.paginas),
      formatFieldValue("Tintas", result.extracted.tintas),
      formatFieldValue("Material", result.extracted.material),
      formatFieldValue("Acabado", result.extracted.acabado),
      formatFieldValue("Entrega", result.extracted.entrega),
      `Preguntas pendientes: ${result.questions.length ? result.questions.join(" | ") : "ninguna"}`,
      `Siguiente paso: ${result.nextStep}`,
    ]

    await navigator.clipboard.writeText(assistantReply?.copyText || fallbackLines.join("\n"))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handleApplyToClassic = () => {
    if ((!result && !handoff) || !props.onApplyToClassic) return

    if (handoff) {
      props.onApplyToClassic(handoff)
      return
    }

    props.onApplyToClassic({
      id: String(Date.now()),
      brief: result.normalizedBrief,
      quoteType: result.quoteType,
      producto: result.extracted.producto,
      cantidad: result.extracted.cantidad,
      anchoCm: result.extracted.anchoCm,
      altoCm: result.extracted.altoCm,
      paginas: result.extracted.paginas,
      tintas: result.extracted.tintas,
      material: result.extracted.material,
      acabado: result.extracted.acabado,
      assistantReply: assistantReply?.message ?? null,
      entrega: result.extracted.entrega,
    })
  }

  const detectedFields = result
    ? [
        compactField("Trabajo", result.extracted.producto || result.quoteType),
        compactField("Cantidad", result.extracted.cantidad),
        compactField(
          result.extracted.paginas ? "Formato final" : "Tamaño final",
          result.extracted.anchoCm && result.extracted.altoCm
            ? `${result.extracted.anchoCm} x ${result.extracted.altoCm} cm`
            : null,
        ),
        result.extracted.paginas ? compactField("Páginas", result.extracted.paginas) : null,
        compactField("Material", result.extracted.material),
        compactField("Acabado", result.extracted.acabado),
        compactField("Entrega", result.extracted.entrega),
      ].filter((item): item is { label: string; value: string } => Boolean(item))
    : []

  const estimatedTotal = pricing ? formatMoney(pricing.configuredSuggestion.total, currencyFormatter) : null
  const estimatedUnit = pricing ? formatMoney(pricing.configuredSuggestion.unitPrice, currencyFormatter) : null
  const marketMin = pricing ? formatMoney(pricing.externalBenchmark.suggestedTotalMin, currencyFormatter) : null
  const marketMax = pricing ? formatMoney(pricing.externalBenchmark.suggestedTotalMax, currencyFormatter) : null
  const breakdownTotal = pricing ? formatMoney(pricing.costBreakdown.totalSuggested, currencyFormatter) : null
  const breakdownUnit = pricing ? formatMoney(pricing.costBreakdown.unitPriceWithIva, currencyFormatter) : null
  const breakdownProduction = pricing ? formatMoney(pricing.costBreakdown.productionCost, currencyFormatter) : null
  const breakdownUtility = pricing ? formatMoney(pricing.costBreakdown.utility, currencyFormatter) : null
  const breakdownIva = pricing ? formatMoney(pricing.costBreakdown.ivaValue, currencyFormatter) : null

  const missingSummary = result?.questions.length
    ? result.questions.slice(0, 2)
    : result?.missingFields.length
      ? result.missingFields.slice(0, 3).map((item) => `Confirmar ${item}`)
      : []

  const footerReadyLabel = result?.extracted.paginas
    ? "Pasar a cotización final editorial"
    : "Pasar a cotización final"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-5 overflow-y-auto pr-1">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles className="h-5 w-5" />
            <CardTitle className="text-xl">Cotice con IA</CardTitle>
          </div>
          <CardDescription>
            Describe el trabajo como lo pediría el cliente. La lectura se resume para pasar rápido a la cotización final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="litografia-ai-brief">Brief del cliente</Label>
            <Textarea
              id="litografia-ai-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              className="min-h-36"
              placeholder="Ejemplo: 5.000 plegables media carta en propalcote 150 g, 4x4, dos cuerpos, entrega en Chapinero..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Button key={example} type="button" variant="outline" className="h-auto whitespace-normal text-left" onClick={() => setBrief(example)}>
                {example}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleAnalyze} disabled={loading || brief.trim().length < 20}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Analizar requerimiento
            </Button>
            <p className="text-sm text-muted-foreground">Te deja listos los datos clave para llenar la cotización final sin repetir información.</p>
          </div>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-slate-700">
              <ImagePlus className="h-5 w-5" />
              <CardTitle className="text-lg">ChatGPT para imágenes</CardTitle>
            </div>
            <CardDescription>
              Genera una imagen con IA y la guarda automáticamente en el administrador de archivos bajo IA/chatgpt-imagenes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="litografia-ai-image-prompt">Prompt para imagen</Label>
              <Textarea
                id="litografia-ai-image-prompt"
                value={imagePrompt}
                onChange={(event) => setImagePrompt(event.target.value)}
                className="min-h-28"
                placeholder="Ejemplo: mockup fotográfico de brochure corporativo premium sobre escritorio, iluminación natural, estilo realista"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleGenerateImage} disabled={imageLoading || (imagePrompt || brief).trim().length < 12}>
              {imageLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              Generar y guardar imagen
            </Button>

            {generatedImage ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <img src={generatedImage.previewDataUrl} alt="Imagen generada con IA" className="max-h-80 w-full object-contain" />
                </div>
                {generatedImage.revisedPrompt ? <p className="text-sm text-slate-700">Prompt revisado: {generatedImage.revisedPrompt}</p> : null}
                {generatedImage.file ? <p className="text-sm text-slate-700">Guardada en: {generatedImage.file.path}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-slate-700">
              <History className="h-5 w-5" />
              <CardTitle className="text-lg">Historial IA</CardTitle>
            </div>
            <CardDescription>
              Consultas de cotización y prompts de imágenes recientes, con rastro del usuario y del archivo generado cuando aplica.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyLoading ? <p className="text-sm text-muted-foreground">Cargando historial...</p> : null}
            {!historyLoading && !history.length ? <p className="text-sm text-muted-foreground">Aún no hay actividad IA registrada.</p> : null}
            {history.slice(0, 6).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-900">{entry.kind === "IMAGE_GENERATION" ? "Imagen" : "Cotización"}</p>
                  <span className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("es-CO")}</span>
                </div>
                <p className="mt-1 line-clamp-3">{entry.prompt}</p>
                {entry.summary ? <p className="mt-2 text-xs text-slate-500">{entry.summary}</p> : null}
                {entry.asset?.path ? <p className="mt-2 text-xs text-slate-500">Archivo: {entry.asset.path}</p> : null}
                {entry.actorLabel ? <p className="mt-1 text-xs text-slate-500">Usuario: {entry.actorLabel}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {result ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Resumen para cotizar</CardTitle>
              <CardDescription>{result.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {detectedFields.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p>{item.value}</p>
                  </div>
                ))}
              </div>

              {pricing && (estimatedTotal || estimatedUnit || marketMin || marketMax) ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">Valores guía</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {estimatedTotal ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">Valor estimado total</p>
                        <p>{estimatedTotal}</p>
                      </div>
                    ) : null}
                    {estimatedUnit ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">Valor unitario guía</p>
                        <p>{estimatedUnit}</p>
                      </div>
                    ) : null}
                    {marketMin || marketMax ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:col-span-2">
                        <p className="font-medium text-slate-900">Referencia de mercado</p>
                        <p>{marketMin && marketMax ? `${marketMin} a ${marketMax}` : marketMin || marketMax}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {assistantReply ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">Mensaje listo para cliente</p>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 whitespace-pre-line">
                    {assistantReply.message}
                  </div>
                </div>
              ) : null}

              {pricing?.costBreakdown.lines.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">Costos base</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="space-y-2">
                      {pricing.costBreakdown.lines.map((line) => (
                        <div key={`${line.label}-${line.amount}`} className="flex items-start justify-between gap-4">
                          <span>{line.label}</span>
                          <span className="font-medium text-slate-900">{currencyFormatter.format(line.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-1 border-t pt-3">
                      {breakdownProduction ? <div className="flex items-start justify-between gap-4"><span>Costo producción</span><span className="font-medium text-slate-900">{breakdownProduction}</span></div> : null}
                      {breakdownUtility ? <div className="flex items-start justify-between gap-4"><span>Utilidad 40%</span><span className="font-medium text-slate-900">{breakdownUtility}</span></div> : null}
                      {breakdownIva ? <div className="flex items-start justify-between gap-4"><span>IVA 19%</span><span className="font-medium text-slate-900">{breakdownIva}</span></div> : null}
                      {breakdownTotal ? <div className="flex items-start justify-between gap-4 text-base"><span className="font-semibold text-slate-900">Total sugerido</span><span className="font-semibold text-slate-900">{breakdownTotal}</span></div> : null}
                      {breakdownUnit ? <div className="flex items-start justify-between gap-4"><span>Unitario con IVA</span><span className="font-medium text-slate-900">{breakdownUnit}</span></div> : null}
                    </div>
                  </div>
                  {pricing.costBreakdown.notes.length ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">Notas del cálculo</p>
                      <p>{pricing.costBreakdown.notes.slice(0, 2).join(" ")}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {result.extracted.observaciones.length ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Notas útiles</p>
                  <p>{result.extracted.observaciones.slice(0, 2).join(". ")}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-amber-950">Qué falta confirmar</CardTitle>
                <CardDescription className="text-amber-900/80">
                  Con esto completo, la cotización final sale mucho más rápido.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-amber-950">
                {missingSummary.length ? (
                  missingSummary.map((question) => (
                    <div key={question} className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2">
                      {question}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                    El brief ya trae suficientes datos para pasar al cotizador litográfico.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Listo para el siguiente paso</CardTitle>
                <CardDescription>
                  {result.extracted.paginas
                    ? "Se enviará al flujo editorial para completar portada, internas y producción."
                    : "Se enviará al flujo normal con los campos principales ya diligenciados."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" variant="outline" onClick={handleCopy} className="w-full justify-between">
                  {copied ? "Resumen copiado" : "Copiar resumen"}
                  <ClipboardCopy className="h-4 w-4" />
                </Button>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Lo que sí se va a pasar</p>
                  <p>{detectedFields.map((item) => item.label.toLowerCase()).join(", ")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
      </div>

      <div className="mt-4 border-t bg-background pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {result
              ? "Pasa esto a la cotización final y termina solo los datos que aún falten."
              : "Analiza primero el pedido para preparar la cotización final."}
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button type="button" variant="outline" onClick={handleCopy} disabled={!result} className="sm:min-w-44">
              {copied ? "Resumen copiado" : "Copiar resumen"}
            </Button>
            <Button type="button" onClick={handleApplyToClassic} disabled={!result || !props.onApplyToClassic} className="sm:min-w-64">
              {footerReadyLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}