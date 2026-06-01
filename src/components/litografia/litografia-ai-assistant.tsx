"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Sparkles, LoaderCircle, ClipboardCopy, ArrowRight, ExternalLink, MessageSquareText, SendHorizonal, ChevronLeft, ChevronRight, History } from "lucide-react"
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

type LitografiaAiKnowledgeSource = {
  enabled: boolean
  source: "default" | "custom"
  updatedAt: string | null
  updatedByLabel: string | null
  label: string
  description: string
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

type AssistantQuoteReply = {
  title: string
  message: string
  assumptions: string[]
  copyText: string
}

type LitografiaAiAnalyzeResponse = {
  ok?: boolean
  error?: string
  data?: LitografiaAiResult
  connection?: LitografiaAiConnection
  knowledgeSource?: LitografiaAiKnowledgeSource | null
  pricing?: LitografiaAiPricing
  assistantReply?: AssistantQuoteReply | null
  handoff?: LitografiaAiHandoff | null
}

type QuoteHistoryEntry = {
  id: string
  prompt: string
  summary: string | null
  responseText: string | null
  createdAt: string
  actorLabel: string | null
  quoteType: string | null
  confidence: string | null
  totalSuggested: number | null
}

type QuoteHistoryResponse = {
  ok?: boolean
  error?: string
  history?: QuoteHistoryEntry[]
  total?: number
  page?: number
  pageSize?: number
  totalPages?: number
  hasNext?: boolean
  hasPrevious?: boolean
}

type LitografiaAiConversationMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  meta?: string[]
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

function buildAssistantFallbackMessage(args: {
  result: LitografiaAiResult
  detectedFields: Array<{ label: string; value: string }>
  estimatedTotal: string | null
  estimatedUnit: string | null
}) {
  const { result, detectedFields, estimatedTotal, estimatedUnit } = args
  const detectedSummary = detectedFields.length
    ? detectedFields.map((item) => `${item.label}: ${item.value}`).join("\n")
    : "No se detectaron suficientes datos estructurados en el brief."

  const openQuestions = result.questions.length
    ? result.questions.join(" ")
    : result.missingFields.length
      ? `Falta confirmar: ${result.missingFields.join(", ")}.`
      : "El brief ya trae suficientes datos para pasar al siguiente paso."

  const guideValues = [
    estimatedTotal ? `Valor guía total: ${estimatedTotal}` : null,
    estimatedUnit ? `Valor guía unitario: ${estimatedUnit}` : null,
  ].filter((item): item is string => Boolean(item))

  return [
    result.summary,
    "",
    "Datos detectados:",
    detectedSummary,
    "",
    ...guideValues,
    openQuestions,
    `Siguiente paso: ${result.nextStep}`,
  ].filter(Boolean).join("\n")
}

function buildDisplayAssistantMessage(args: {
  result: LitografiaAiResult
  pricing: LitografiaAiPricing | null
  assistantReply: AssistantQuoteReply | null
  formatter: Intl.NumberFormat
}) {
  const estimatedTotal = args.pricing ? formatMoney(args.pricing.configuredSuggestion.total, args.formatter) : null
  const estimatedUnit = args.pricing ? formatMoney(args.pricing.configuredSuggestion.unitPrice, args.formatter) : null
  const detectedFields = [
    compactField("Trabajo", args.result.extracted.producto || args.result.quoteType),
    compactField("Cantidad", args.result.extracted.cantidad),
    compactField(
      args.result.extracted.paginas ? "Formato final" : "Tamaño final",
      args.result.extracted.anchoCm && args.result.extracted.altoCm
        ? `${args.result.extracted.anchoCm} x ${args.result.extracted.altoCm} cm`
        : null,
    ),
    args.result.extracted.paginas ? compactField("Páginas", args.result.extracted.paginas) : null,
    compactField("Material", args.result.extracted.material),
    compactField("Acabado", args.result.extracted.acabado),
    compactField("Entrega", args.result.extracted.entrega),
  ].filter((item): item is { label: string; value: string } => Boolean(item))

  return args.assistantReply?.message || buildAssistantFallbackMessage({
    result: args.result,
    detectedFields,
    estimatedTotal,
    estimatedUnit,
  })
}

function buildConversationMeta(args: {
  result: LitografiaAiResult
  pricing: LitografiaAiPricing | null
  knowledgeSource: LitografiaAiKnowledgeSource | null
}) {
  const origin = args.result.engine.mode === "LLM" ? "IA" : "Reglas internas"
  const pricingOrigin = args.pricing?.configuredSuggestion.status === "MATCHED"
    ? "Tarifa ERP exacta"
    : args.pricing?.costBreakdown.status === "AVAILABLE"
      ? "Cálculo interno"
      : "Referencia parcial"
  const knowledgeOrigin = args.knowledgeSource?.enabled
    ? args.knowledgeSource.source === "custom"
      ? "JSON personalizado"
      : "JSON base"
    : "Sin JSON"

  return [origin, pricingOrigin, knowledgeOrigin]
}

function getAnalysisSourceLabel(args: { result: LitografiaAiResult; connection: LitografiaAiConnection | null }) {
  if (args.result.engine.mode === "LLM") {
    const modelLabel = args.result.engine.model || args.connection?.model || "modelo configurado"
    return {
      title: "Interpretación hecha por IA",
      description: `El brief se procesó con ${args.result.engine.provider} usando ${modelLabel}.`,
      tone: "emerald",
    }
  }

  return {
    title: "Interpretación hecha por reglas internas",
    description: "El sistema respondió con la preconfiguración interna del ERP porque no usó un modelo externo para esta lectura.",
    tone: "amber",
  }
}

function getPricingSourceLabel(pricing: LitografiaAiPricing | null) {
  if (!pricing) {
    return {
      title: "Sin valores configurados cargados",
      description: "La consulta no devolvió una coincidencia de valores preconfigurados en esta ejecución.",
      tone: "slate",
    }
  }

  if (pricing.configuredSuggestion.status === "MATCHED") {
    return {
      title: "Valores tomados de configuraciones del sistema",
      description: "La respuesta encontró coincidencia en tarifas o configuraciones predefinidas del ERP.",
      tone: "emerald",
    }
  }

  if (pricing.costBreakdown.status === "AVAILABLE") {
    return {
      title: "Valores estimados con reglas y costos configurados",
      description: "La respuesta armó el valor con el motor interno y costos base configurados en el sistema.",
      tone: "sky",
    }
  }

  return {
    title: "Valores incompletos o parciales",
    description: "La consulta no encontró una coincidencia cerrada y dejó la cotización como referencia preliminar.",
    tone: "amber",
  }
}

function getKnowledgeSourceLabel(knowledgeSource: LitografiaAiKnowledgeSource | null) {
  if (!knowledgeSource?.enabled) {
    return {
      title: "Sin base JSON aplicada",
      description: "Esta respuesta no reportó apoyo de la base de conocimiento JSON.",
      tone: "slate",
    }
  }

  if (knowledgeSource.source === "custom") {
    return {
      title: "Apoyado por entrenador JSON personalizado",
      description: knowledgeSource.description,
      tone: "violet",
    }
  }

  return {
    title: "Apoyado por JSON base por defecto",
    description: knowledgeSource.description,
    tone: "sky",
  }
}

function formatDateTime(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

function getConversationMessageLabel(role: "user" | "assistant") {
  return role === "user" ? "Tú" : "Asistente IA"
}

function formatDateTimeLabel(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

export function LitografiaAiAssistant(props: {
  onApplyToClassic?: (draft: LitografiaAiHandoff) => void
  initialBrief?: string
  openToken?: string | number
}) {
  const conversationViewportRef = useRef<HTMLDivElement | null>(null)
  const [brief, setBrief] = useState(EXAMPLES[0])
  const [result, setResult] = useState<LitografiaAiResult | null>(null)
  const [connection, setConnection] = useState<LitografiaAiConnection | null>(null)
  const [knowledgeSource, setKnowledgeSource] = useState<LitografiaAiKnowledgeSource | null>(null)
  const [pricing, setPricing] = useState<LitografiaAiPricing | null>(null)
  const [handoff, setHandoff] = useState<LitografiaAiHandoff | null>(null)
  const [assistantReply, setAssistantReply] = useState<AssistantQuoteReply | null>(null)
  const [conversationMessages, setConversationMessages] = useState<LitografiaAiConversationMessage[]>([])
  const [followUp, setFollowUp] = useState("")
  const [historyEntries, setHistoryEntries] = useState<QuoteHistoryEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
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
    setKnowledgeSource(null)
    setPricing(null)
    setHandoff(null)
    setAssistantReply(null)
    setConversationMessages([])
    setFollowUp("")
    setError(null)
    setCopied(false)
  }, [props.initialBrief, props.openToken])

  useEffect(() => {
    const viewport = conversationViewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [conversationMessages, loading])

  useEffect(() => {
    const controller = new AbortController()

    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const response = await fetch(`/api/litografia/ia/cotizar?page=${historyPage}&pageSize=6`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const json = (await response.json().catch(() => null)) as QuoteHistoryResponse | null
        if (!response.ok || !json?.ok || !Array.isArray(json.history)) {
          throw new Error(json?.error || "No fue posible cargar el historial del cotizador IA.")
        }
        setHistoryEntries(json.history)
        setHistoryTotal(json.total ?? json.history.length)
        setHistoryPage(json.page ?? historyPage)
        setHistoryTotalPages(Math.max(1, json.totalPages ?? 1))
      } catch (historyLoadError) {
        if (controller.signal.aborted) return
        setHistoryEntries([])
        setHistoryTotal(0)
        setHistoryTotalPages(1)
        setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : "No fue posible cargar el historial del cotizador IA.")
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false)
      }
    }

    void loadHistory()
    return () => controller.abort()
  }, [historyPage])

  const submitAnalysis = async (args: { userMessage: string; resetConversation?: boolean }) => {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const nextConversation = args.resetConversation
        ? []
        : conversationMessages.map((message) => ({ role: message.role, content: message.content }))

      const res = await fetch("/api/litografia/ia/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: args.userMessage, conversation: nextConversation }),
      })

      const json = (await res.json().catch(() => null)) as LitografiaAiAnalyzeResponse | null

      if (!res.ok || !json?.ok || !json.data) {
        throw new Error(json?.error || "No fue posible analizar el requerimiento.")
      }

      setResult(json.data)
      setConnection(json.connection ?? null)
      setKnowledgeSource(json.knowledgeSource ?? null)
      setPricing(json.pricing ?? null)
      setHandoff(json.handoff ?? null)
      setAssistantReply(json.assistantReply ?? null)
      const assistantMessage = buildDisplayAssistantMessage({
        result: json.data,
        pricing: json.pricing ?? null,
        assistantReply: json.assistantReply ?? null,
        formatter: currencyFormatter,
      })
      const assistantMeta = buildConversationMeta({
        result: json.data,
        pricing: json.pricing ?? null,
        knowledgeSource: json.knowledgeSource ?? null,
      })
      setConversationMessages((current) => {
        const base = args.resetConversation ? [] : current
        return [
          ...base,
          { id: `${Date.now()}-user`, role: "user", content: args.userMessage },
          { id: `${Date.now()}-assistant`, role: "assistant", content: assistantMessage, meta: assistantMeta },
        ]
      })
      setHistoryPage(1)
      setFollowUp("")
    } catch (analysisError) {
      if (args.resetConversation) {
        setResult(null)
        setConnection(null)
        setKnowledgeSource(null)
        setPricing(null)
        setHandoff(null)
        setAssistantReply(null)
        setConversationMessages([])
      }
      setError(analysisError instanceof Error ? analysisError.message : "Error inesperado analizando el brief.")
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    await submitAnalysis({ userMessage: brief.trim(), resetConversation: true })
  }

  const handleSendFollowUp = async () => {
    const message = followUp.trim()
    if (message.length < 3) return
    await submitAnalysis({ userMessage: message, resetConversation: false })
  }

  const handleFollowUpKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()
    if (loading || followUp.trim().length < 3 || !conversationMessages.length) return
    void handleSendFollowUp()
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

    if (!result) return

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

  const displayAssistantMessage = result
    ? buildDisplayAssistantMessage({
        result,
        pricing,
        assistantReply,
        formatter: currencyFormatter,
      })
    : null

  const analysisSource = result ? getAnalysisSourceLabel({ result, connection }) : null
  const pricingSource = result ? getPricingSourceLabel(pricing) : null
  const knowledgeSourceLabel = result ? getKnowledgeSourceLabel(knowledgeSource) : null
  const knowledgeUpdatedAt = formatDateTime(knowledgeSource?.updatedAt ?? null)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-5 overflow-y-auto pr-1">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Sparkles className="h-5 w-5" />
              <CardTitle className="text-xl">Cotice con IA</CardTitle>
            </div>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/dashboard/litografia/imagenes-ia">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ir a imágenes IA
              </Link>
            </Button>
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

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-800">
            <History className="h-5 w-5" />
            <CardTitle className="text-lg">Historial de cotizaciones IA</CardTitle>
          </div>
          <CardDescription>Consulta lo que ya han cotizado los usuarios sin traer el historial completo de una sola vez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
            <span>{historyLoading ? "Cargando historial..." : `${historyTotal} consultas registradas`}</span>
            <span>Página {historyPage} de {historyTotalPages}</span>
          </div>

          {historyError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{historyError}</p> : null}

          {!historyError && !historyLoading && !historyEntries.length ? (
            <p className="text-sm text-muted-foreground">Todavía no hay cotizaciones IA guardadas para esta empresa.</p>
          ) : null}

          <div className="space-y-3">
            {historyEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{entry.quoteType || "Cotización IA"}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTimeLabel(entry.createdAt)}{entry.actorLabel ? ` · ${entry.actorLabel}` : ""}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {entry.confidence ? <p>Confianza: {entry.confidence}</p> : null}
                    {entry.totalSuggested != null ? <p>Total guía: {currencyFormatter.format(entry.totalSuggested)}</p> : null}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-slate-800">{entry.summary || entry.prompt}</p>
                {entry.responseText ? <p className="mt-2 line-clamp-3 text-slate-600">{entry.responseText}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setBrief(entry.prompt)}>
                    Usar brief
                  </Button>
                  {entry.responseText ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setFollowUp(`Toma como referencia esta consulta previa: ${entry.prompt}`)}>
                      Tomar referencia
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-500">El chat puede reutilizar estos briefs como punto de partida sin reescribir todo.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} disabled={historyLoading || historyPage <= 1}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPage((current) => Math.min(historyTotalPages, current + 1))} disabled={historyLoading || historyPage >= historyTotalPages}>
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Respuesta y origen de la consulta</CardTitle>
              <CardDescription>Primero te mostramos la respuesta concreta y de dónde salió, antes del resto del detalle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysisSource && pricingSource && knowledgeSourceLabel ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className={`rounded-xl border px-3 py-3 text-sm ${analysisSource.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                    <p className="font-medium">{analysisSource.title}</p>
                    <p className="mt-1">{analysisSource.description}</p>
                  </div>
                  <div className={`rounded-xl border px-3 py-3 text-sm ${pricingSource.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : pricingSource.tone === "sky" ? "border-sky-200 bg-sky-50 text-sky-950" : pricingSource.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
                    <p className="font-medium">{pricingSource.title}</p>
                    <p className="mt-1">{pricingSource.description}</p>
                  </div>
                  <div className={`rounded-xl border px-3 py-3 text-sm ${knowledgeSourceLabel.tone === "violet" ? "border-violet-200 bg-violet-50 text-violet-950" : knowledgeSourceLabel.tone === "sky" ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
                    <p className="font-medium">{knowledgeSourceLabel.title}</p>
                    <p className="mt-1">{knowledgeSourceLabel.description}</p>
                    {knowledgeUpdatedAt ? <p className="mt-2 text-xs opacity-80">Actualizado: {knowledgeUpdatedAt}</p> : null}
                    {knowledgeSource?.updatedByLabel ? <p className="mt-1 text-xs opacity-80">Por: {knowledgeSource.updatedByLabel}</p> : null}
                  </div>
                </div>
              ) : null}

              {displayAssistantMessage ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">Respuesta de la consulta</p>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 whitespace-pre-line">
                    {displayAssistantMessage}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 text-slate-800">
                <MessageSquareText className="h-5 w-5" />
                <CardTitle className="text-lg">Conversación del requerimiento</CardTitle>
              </div>
              <CardDescription>Mantén el hilo de este requerimiento para refinar materiales, cantidades, soluciones posibles y escenarios alternos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              <div className="border-t border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef7f3_100%)] px-4 py-4 sm:px-5">
                <div ref={conversationViewportRef} className="max-h-[34rem] space-y-4 overflow-y-auto pr-1">
                  {conversationMessages.map((message) => (
                    <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-900 text-xs font-semibold text-white shadow-sm">IA</div> : null}
                      <div className={`max-w-[90%] space-y-2 ${message.role === "user" ? "items-end" : "items-start"}`}>
                        <div className={`text-xs font-medium ${message.role === "user" ? "text-right text-slate-500" : "text-slate-600"}`}>
                          {getConversationMessageLabel(message.role)}
                        </div>
                        <div className={`rounded-[24px] px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
                          <p className="whitespace-pre-line">{message.content}</p>
                          {message.meta?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.meta.map((item) => (
                                <span
                                  key={`${message.id}-${item}`}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${message.role === "user" ? "bg-white/10 text-slate-100" : "border border-slate-200 bg-slate-50 text-slate-600"}`}
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {message.role === "user" ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-xs font-semibold text-slate-700 shadow-sm">Tú</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-3 shadow-sm">
                  <Label htmlFor="litografia-ai-follow-up" className="sr-only">Seguir conversación</Label>
                  <Textarea
                    id="litografia-ai-follow-up"
                    value={followUp}
                    onChange={(event) => setFollowUp(event.target.value)}
                    onKeyDown={handleFollowUpKeyDown}
                    className="min-h-[104px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                    placeholder="Escribe como si siguieras hablando con el asistente: pide una opción más económica, agrega un acabado, pregunta qué falta o solicita dos soluciones posibles."
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <p className="text-sm text-slate-500">El hilo mantiene el contexto de este requerimiento mientras sigas dentro de esta conversación. Enter envía y Shift+Enter hace salto de línea.</p>
                    <Button type="button" onClick={handleSendFollowUp} disabled={loading || followUp.trim().length < 3 || !conversationMessages.length} className="rounded-2xl px-5">
                      {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizonal className="mr-2 h-4 w-4" />}
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
              </CardContent>
            </Card>
          </div>
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