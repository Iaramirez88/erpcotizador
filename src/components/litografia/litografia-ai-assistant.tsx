"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Sparkles, LoaderCircle, ClipboardCopy, ArrowRight, ExternalLink, MessageSquareText, SendHorizonal, ChevronLeft, ChevronRight, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  marginPct: number
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

type LitografiaAssistantMode = "IA" | "JSON_BASE"

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
  scope?: "company" | "personal"
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

type BriefRequirement = {
  key: string
  label: string
  met: boolean
  hint: string
}

type BriefRequirementKey = BriefRequirement["key"]

type AdvancedSelectionState = {
  product: string | null
  size: string | null
  material: string | null
  inks: string | null
  finish: string[]
}

type AdvancedSearchState = {
  product: string
  size: string
  material: string
  inks: string
  finish: string
}

type LitografiaAiKnowledgeOptions = {
  products: string[]
  inks: string[]
  papers: string[]
  sizes: string[]
  finishes: string[]
}

type LitografiaAiKnowledgeResponse = {
  ok?: boolean
  store?: {
    document?: {
      costos?: {
        planchas?: Array<{ tintas?: string | null }>
        impresion?: Array<{ tintas?: string | null }>
        papeles?: Array<{ nombre?: string | null }>
        corte_por_pliego?: Array<{ nombre?: string | null; medidas_cm?: string | null }>
        plastificado?: Array<{ nombre?: string | null }>
        terminados?: Array<{ nombre?: string | null }>
      }
    }
  }
}

const SUPPORTED_PRODUCT_OPTIONS = [
  { label: "Revista", terms: ["revista"] },
  { label: "Cartilla", terms: ["cartilla"] },
  { label: "Libro", terms: ["libro"] },
  { label: "Volante", terms: ["volante", "flyer"] },
  { label: "Plegable", terms: ["plegable", "diptico", "triptico"] },
  { label: "Tarjeta", terms: ["tarjeta"] },
  { label: "Carpeta", terms: ["carpeta", "folder"] },
  { label: "Afiche", terms: ["afiche", "poster"] },
  { label: "Etiqueta", terms: ["etiqueta", "sticker"] },
  { label: "Caja", terms: ["caja", "empaque"] },
]

const PRODUCT_ALTERNATIVE_RULES = [
  {
    matcher: /(boleta|rifa|ticket|boleto)/,
    suggestions: ["Tarjeta", "Volante", "Etiqueta"],
    note: "Si no existe exacto en la base, prueba primero como tarjeta, volante o etiqueta numerada para que la consulta cierre mejor.",
  },
  {
    matcher: /(separador|marcapagina|marcador de libro)/,
    suggestions: ["Tarjeta", "Plegable", "Volante"],
    note: "Cuando el item es especial, conviene aterrizarlo a una pieza simple compatible y luego ajustar tamaño y acabados.",
  },
]

function normalizeBrief(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function uniqueStrings(values: Array<string | null | undefined>, limit?: number) {
  const seen = new Set<string>()
  const items: string[] = []

  for (const rawValue of values) {
    const value = String(rawValue || "").trim()
    if (!value) continue
    const key = normalizeBrief(value)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(value)
    if (limit && items.length >= limit) break
  }

  return items
}

function findSupportedProductLabel(value: string) {
  const normalized = normalizeBrief(value)
  if (!normalized) return null

  for (const option of SUPPORTED_PRODUCT_OPTIONS) {
    if (option.terms.some((term) => normalized.includes(term))) {
      return option.label
    }
  }

  return null
}

function extractQuickFieldsFromBrief(value: string) {
  const quantityMatch = value.match(/(?:^|\s)(\d{1,3}(?:[.,]\d{3})+|\d{2,6})(?=\s+unidades|\s+unds?|\s+ejemplares|\s+piezas|\s+volantes|\s+tarjetas|\s+revistas|\s+libros|\s+carpetas|\s|$)/i)

  return {
    quantity: quantityMatch?.[1]?.trim() || "",
    product: findSupportedProductLabel(value) || "",
  }
}

function composeAssistantBrief(args: { brief: string; quantity: string; product: string }) {
  const sections = [
    args.quantity.trim() ? `Cantidad: ${args.quantity.trim()}` : null,
    args.product.trim() ? `Producto: ${args.product.trim()}` : null,
    args.brief.trim(),
  ].filter((item): item is string => Boolean(item))

  return sections.join("\n")
}

function clampMarginPct(value: number) {
  if (!Number.isFinite(value)) return 40
  return Math.min(500, Math.max(40, Math.round(value)))
}

function parseMarginInput(value: string) {
  const parsed = Number(String(value || "").replace(',', '.').trim())
  return clampMarginPct(parsed)
}

function composeAdvancedSelectionsBrief(selections: AdvancedSelectionState) {
  const sections = [
    selections.size ? `Tamaño o formato: ${selections.size}` : null,
    selections.material ? `Papel o material: ${selections.material}` : null,
    selections.inks ? `Tintas: ${selections.inks}` : null,
    selections.finish.length ? `Acabados: ${selections.finish.join(", ")}` : null,
  ].filter((item): item is string => Boolean(item))

  return sections.join("\n")
}

function pickRelevantOptions(options: string[], query: string, limit: number) {
  if (!options.length) return []

  const terms = Array.from(new Set(
    normalizeBrief(query)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  ))

  if (!terms.length) return options.slice(0, limit)

  const ranked = options
    .map((option, index) => {
      const haystack = normalizeBrief(option)
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
      return { option, index, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)

  return ranked.length ? ranked.slice(0, limit).map((item) => item.option) : options.slice(0, limit)
}

function filterAndSortOptions(args: {
  options: string[]
  query: string
  selected: string[]
}) {
  const terms = normalizeBrief(args.query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
  const selectedKeys = new Set(args.selected.map((item) => normalizeBrief(item)))

  return args.options
    .filter((option) => {
      if (!terms.length) return true
      const haystack = normalizeBrief(option)
      return terms.every((term) => haystack.includes(term))
    })
    .sort((left, right) => {
      const leftSelected = selectedKeys.has(normalizeBrief(left))
      const rightSelected = selectedKeys.has(normalizeBrief(right))
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1
      return left.localeCompare(right, "es", { sensitivity: "base" })
    })
}

function getProductSuggestionState(value: string) {
  const supported = findSupportedProductLabel(value)
  const normalized = normalizeBrief(value)
  const fallback = PRODUCT_ALTERNATIVE_RULES.find((item) => item.matcher.test(normalized))

  return {
    supported,
    alternatives: fallback?.suggestions ?? [],
    note: fallback?.note ?? null,
  }
}

function evaluateBriefRequirements(args: {
  brief: string
  quickQuantity: string
  quickProduct: string
  advancedSelections: AdvancedSelectionState
}): BriefRequirement[] {
  const brief = args.brief
  const normalized = normalizeBrief(brief)
  const hasFolderLetter = /(carpeta).*(carta)|(carta).*(carpeta)|(folder).*(letter)/.test(normalized)
  const hasProduct = Boolean(args.quickProduct.trim() || args.advancedSelections.product)
    || /(volante|flyer|tarjeta|revista|cartilla|libro|carpeta|folder|plegable|diptico|triptico|afiche|poster|etiqueta|sticker|caja|empaque)/.test(normalized)
  const hasQuantity = Boolean(args.quickQuantity.trim())
    || /cantidad:\s*(\d{1,3}(?:[.,]\d{3})+|\d{1,7})(?:\b|\s)/.test(normalized)
    || /(?:^|\s)(\d{1,3}(?:[.,]\d{3})+|\d{2,6})(?:\s+unidades|\s+unds?|\s+ejemplares|\s+piezas|\s+volantes|\s+tarjetas|\s+revistas|\s+libros|\s+carpetas|\s*$)/.test(normalized)
  const hasSize = Boolean(args.advancedSelections.size)
    || /(\d{1,3}(?:[.,]\d{1,2})?\s*(?:x|por)\s*\d{1,3}(?:[.,]\d{1,2})?\s*cm)|media carta|carta|oficio|a4|cuarto|octavo|doble carta|pliego/.test(normalized)
  const hasMaterial = Boolean(args.advancedSelections.material)
    || /(propalcote|bond|cartulina|opalina|adhesivo|kimberly|periodico)/.test(normalized)
  const hasTintas = Boolean(args.advancedSelections.inks)
    || /\b([124])x([014])\b|full color|policromia|cuatricromia|cmyk|\b[124]\s*tintas?\b/.test(normalized)
  const hasFinish = Boolean(args.advancedSelections.finish.length)
    || /(plastificad|laminad|barniz uv|uv parcial|parcial uv|troquelad|grafad|plegad|perforad|esquinas redondeadas)/.test(normalized)

  return [
    {
      key: "product",
      label: "Producto",
      met: hasProduct,
      hint: hasProduct ? "Producto detectado." : "Indica qué producto es: volante, carpeta, revista, tarjeta o similar.",
    },
    {
      key: "quantity",
      label: "Cantidad",
      met: hasQuantity,
      hint: hasQuantity ? "Cantidad detectada." : "Incluye la cantidad exacta de piezas o ejemplares.",
    },
    {
      key: "size",
      label: "Tamaño o formato",
      met: hasSize,
      hint: hasFolderLetter
        ? "Si dices carpeta carta, la IA la toma como carpeta abierta aproximada para escoger plancha y plastificado." 
        : hasSize
          ? "Tamaño o referencia comercial detectada."
          : "Escribe la medida en cm o una referencia comercial como carta, oficio, A4 o cuarto.",
    },
    {
      key: "material",
      label: "Papel o material",
      met: hasMaterial,
      hint: hasMaterial ? "Material detectado." : "Indica el papel base y, si puedes, el gramaje.",
    },
    {
      key: "inks",
      label: "Tintas",
      met: hasTintas,
      hint: hasTintas ? "Configuración de tintas detectada." : "Aclara si va 1x0, 2x0, 4x0, 4x4 o full color.",
    },
    {
      key: "finish",
      label: "Acabados",
      met: hasFinish,
      hint: hasFinish ? "Acabado detectado." : "Si lleva laminado, plastificado, troquel, UV u otro acabado, inclúyelo.",
    },
  ]
}

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

function buildQuotedItemDescription(args: {
  result: LitografiaAiResult
  pricing: LitografiaAiPricing | null
}) {
  const { result, pricing } = args
  const parts: string[] = []
  const productLabel = String(result.extracted.producto || result.quoteType || 'Ítem de litografía').trim()
  parts.push(productLabel)

  if (pricing?.costBreakdown.sizeLabel) parts.push(pricing.costBreakdown.sizeLabel)
  if (result.extracted.paginas && result.extracted.paginas > 0) parts.push(`${result.extracted.paginas} páginas`)
  if (result.extracted.tintas) parts.push(result.extracted.tintas === 4 ? 'Policromía' : `${result.extracted.tintas} tinta${result.extracted.tintas > 1 ? 's' : ''}`)
  if (pricing?.costBreakdown.paperName) parts.push(`Papel: ${pricing.costBreakdown.paperName}`)

  return parts.filter(Boolean).join(' • ')
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
  mode?: LitografiaAssistantMode
}) {
  const conversationViewportRef = useRef<HTMLDivElement | null>(null)
  const responseSectionRef = useRef<HTMLDivElement | null>(null)
  const [brief, setBrief] = useState("")
  const [quickMarginPct, setQuickMarginPct] = useState("40")
  const [quickQuantity, setQuickQuantity] = useState("")
  const [quickProduct, setQuickProduct] = useState("")
  const [guideMode, setGuideMode] = useState<"natural" | "advanced">("natural")
  const [advancedSelections, setAdvancedSelections] = useState<AdvancedSelectionState>({
    product: null,
    size: null,
    material: null,
    inks: null,
    finish: [],
  })
  const [advancedSearch, setAdvancedSearch] = useState<AdvancedSearchState>({
    product: "",
    size: "",
    material: "",
    inks: "",
    finish: "",
  })
  const [result, setResult] = useState<LitografiaAiResult | null>(null)
  const [connection, setConnection] = useState<LitografiaAiConnection | null>(null)
  const [knowledgeSource, setKnowledgeSource] = useState<LitografiaAiKnowledgeSource | null>(null)
  const [knowledgeOptions, setKnowledgeOptions] = useState<LitografiaAiKnowledgeOptions>({
    products: SUPPORTED_PRODUCT_OPTIONS.map((item) => item.label),
    inks: [],
    papers: [],
    sizes: [],
    finishes: [],
  })
  const [pricing, setPricing] = useState<LitografiaAiPricing | null>(null)
  const [handoff, setHandoff] = useState<LitografiaAiHandoff | null>(null)
  const [assistantReply, setAssistantReply] = useState<AssistantQuoteReply | null>(null)
  const [conversationMessages, setConversationMessages] = useState<LitografiaAiConversationMessage[]>([])
  const [followUp, setFollowUp] = useState("")
  const [historyEntries, setHistoryEntries] = useState<QuoteHistoryEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyScope, setHistoryScope] = useState<"company" | "personal">("personal")
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<QuoteHistoryEntry | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showResponsePanel, setShowResponsePanel] = useState(false)
  const assistantMode = props.mode === "JSON_BASE" ? "JSON_BASE" : "IA"

  const currencyFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  })

  const seedBriefComposer = (value: string) => {
    const seeded = extractQuickFieldsFromBrief(value)
    setBrief(value)
    setQuickMarginPct("40")
    setQuickQuantity(seeded.quantity)
    setQuickProduct(seeded.product)
    setAdvancedSelections({
      product: seeded.product || null,
      size: null,
      material: null,
      inks: null,
      finish: [],
    })
    setAdvancedSearch({
      product: "",
      size: "",
      material: "",
      inks: "",
      finish: "",
    })
  }

  useEffect(() => {
    const seededBrief = String(props.initialBrief || "").trim()
    if (!seededBrief) return
    seedBriefComposer(seededBrief)
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
    const controller = new AbortController()

    const loadKnowledgeOptions = async () => {
      try {
        const response = await fetch("/api/litografia/ia/conocimiento", {
          cache: "no-store",
          signal: controller.signal,
        })
        const json = (await response.json().catch(() => null)) as LitografiaAiKnowledgeResponse | null
        if (!response.ok || !json?.ok) return

        const costos = json.store?.document?.costos
        if (!costos) return

        setKnowledgeOptions({
          products: SUPPORTED_PRODUCT_OPTIONS.map((item) => item.label),
          inks: uniqueStrings([
            ...(costos.planchas ?? []).map((item) => item.tintas ?? null),
            ...(costos.impresion ?? []).map((item) => item.tintas ?? null),
          ], 8),
          papers: uniqueStrings((costos.papeles ?? []).map((item) => item.nombre ?? null), 12),
          sizes: uniqueStrings((costos.corte_por_pliego ?? []).map((item) => {
            const name = String(item.nombre || "").trim()
            const size = String(item.medidas_cm || "").trim()
            if (name && size) return `${name} (${size})`
            return size || name || null
          }), 10),
          finishes: uniqueStrings([
            ...(costos.plastificado ?? []).map((item) => item.nombre ?? null),
            ...(costos.terminados ?? []).map((item) => item.nombre ?? null),
          ], 14),
        })
      } catch {
        if (controller.signal.aborted) return
      }
    }

    void loadKnowledgeOptions()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const viewport = conversationViewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [conversationMessages, loading])

  useEffect(() => {
    if (!showResponsePanel) return
    responseSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [showResponsePanel, loading, result, error])

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
        setHistoryScope(json.scope === "company" ? "company" : "personal")
        setHistoryPage(json.page ?? historyPage)
        setHistoryTotalPages(Math.max(1, json.totalPages ?? 1))
      } catch (historyLoadError) {
        if (controller.signal.aborted) return
        setHistoryEntries([])
        setHistoryTotal(0)
        setHistoryScope("personal")
        setHistoryTotalPages(1)
        setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : "No fue posible cargar el historial del cotizador IA.")
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false)
      }
    }

    void loadHistory()
    return () => controller.abort()
  }, [historyPage])

  const submitAnalysis = async (args: { userMessage: string; resetConversation?: boolean; autoApply?: boolean }) => {
    setShowResponsePanel(true)
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
        body: JSON.stringify({
          brief: args.userMessage,
          conversation: nextConversation,
          mode: assistantMode,
          marginPct: parseMarginInput(quickMarginPct),
        }),
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

      if (args.autoApply && json.handoff && props.onApplyToClassic) {
        props.onApplyToClassic(json.handoff)
      }
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
    await submitAnalysis({ userMessage: composedBrief.trim(), resetConversation: true })
  }

  const handleBriefKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()
    if (loading || composedBrief.trim().length < 20) return
    void handleAnalyze()
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

    const quantity = Math.max(1, Math.trunc(Number(result.extracted.cantidad) || 0))
    const subtotalWithIva = Number(pricing?.costBreakdown.totalSuggested)
    const unitPriceWithIva = Number(pricing?.costBreakdown.unitPriceWithIva)
    const hasQuotedItem = Number.isFinite(subtotalWithIva) && subtotalWithIva > 0

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
      quotedItem: hasQuotedItem
        ? {
            description: buildQuotedItemDescription({ result, pricing }),
            quantity,
            unit: 'unidad',
            subtotalWithIva,
            subtotalBeforeIva: pricing?.costBreakdown.subtotalBeforeIva ?? null,
            unitPriceWithIva: Number.isFinite(unitPriceWithIva) && unitPriceWithIva > 0
              ? unitPriceWithIva
              : (quantity > 0 ? subtotalWithIva / quantity : subtotalWithIva),
            ivaPct: pricing?.costBreakdown.ivaPct ?? 19,
            machineName: pricing?.costBreakdown.machineName ?? null,
            paperName: pricing?.costBreakdown.paperName ?? null,
            sizeLabel: pricing?.costBreakdown.sizeLabel ?? null,
            summary: pricing?.costBreakdown.summary ?? null,
          }
        : undefined,
    })
  }

  const handleApplyHistoryEntry = async (entry: QuoteHistoryEntry) => {
    if (!props.onApplyToClassic || loading) return
    seedBriefComposer(entry.prompt)
    await submitAnalysis({ userMessage: entry.prompt.trim(), resetConversation: true, autoApply: true })
  }

  const handleSingleAdvancedSelection = (key: "product" | "size" | "material" | "inks", option: string) => {
    setAdvancedSelections((current) => {
      const nextValue = current[key] === option ? null : option
      if (key === "product") {
        setQuickProduct(nextValue || "")
      }
      return {
        ...current,
        [key]: nextValue,
      }
    })
  }

  const handleFinishToggle = (option: string) => {
    setAdvancedSelections((current) => {
      const exists = current.finish.includes(option)
      return {
        ...current,
        finish: exists
          ? current.finish.filter((item) => item !== option)
          : [option, ...current.finish],
      }
    })
  }

  const composedAdvancedBrief = composeAdvancedSelectionsBrief(advancedSelections)
  const composedBrief = composeAssistantBrief({
    brief,
    quantity: quickQuantity,
    product: advancedSelections.product || quickProduct,
  })
  const finalBrief = [composedBrief, composedAdvancedBrief].filter(Boolean).join("\n")
  const currentMarginPct = parseMarginInput(quickMarginPct)

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
  const briefRequirements = evaluateBriefRequirements({
    brief: finalBrief,
    quickQuantity,
    quickProduct,
    advancedSelections,
  })
  const readyRequirements = briefRequirements.filter((item) => item.met).length
  const productSuggestion = getProductSuggestionState(quickProduct || brief)
  const productOptions = pickRelevantOptions(
    productSuggestion.alternatives.length ? productSuggestion.alternatives : knowledgeOptions.products,
    quickProduct || brief,
    6,
  )
  const sizeOptions = pickRelevantOptions(knowledgeOptions.sizes, composedBrief, 6)
  const paperOptions = pickRelevantOptions(knowledgeOptions.papers, composedBrief, 6)
  const inkOptions = pickRelevantOptions(knowledgeOptions.inks, composedBrief, 4)
  const finishOptions = pickRelevantOptions(knowledgeOptions.finishes, composedBrief, 6)
  const requirementOptionsByKey: Record<string, string[]> = {
    product: productOptions,
    quantity: [],
    size: sizeOptions,
    material: paperOptions,
    inks: inkOptions,
    finish: finishOptions,
  }
  const advancedOptionLists = {
    product: filterAndSortOptions({
      options: uniqueStrings([...knowledgeOptions.products, ...productSuggestion.alternatives]),
      query: advancedSearch.product,
      selected: advancedSelections.product ? [advancedSelections.product] : [],
    }),
    size: filterAndSortOptions({
      options: knowledgeOptions.sizes,
      query: advancedSearch.size,
      selected: advancedSelections.size ? [advancedSelections.size] : [],
    }),
    material: filterAndSortOptions({
      options: knowledgeOptions.papers,
      query: advancedSearch.material,
      selected: advancedSelections.material ? [advancedSelections.material] : [],
    }),
    inks: filterAndSortOptions({
      options: knowledgeOptions.inks,
      query: advancedSearch.inks,
      selected: advancedSelections.inks ? [advancedSelections.inks] : [],
    }),
    finish: filterAndSortOptions({
      options: knowledgeOptions.finishes,
      query: advancedSearch.finish,
      selected: advancedSelections.finish,
    }),
  }
  const selectionSummaryByKey: Record<BriefRequirementKey, string[]> = {
    product: advancedSelections.product ? [advancedSelections.product] : (quickProduct ? [quickProduct] : []),
    quantity: quickQuantity ? [quickQuantity] : [],
    size: advancedSelections.size ? [advancedSelections.size] : [],
    material: advancedSelections.material ? [advancedSelections.material] : [],
    inks: advancedSelections.inks ? [advancedSelections.inks] : [],
    finish: advancedSelections.finish,
  }
  const modeTitle = assistantMode === "JSON_BASE" ? "Cotizar base JSON" : "Cotice con IA"
  const modeDescription = assistantMode === "JSON_BASE"
    ? "Describe el trabajo con la misma interfaz, pero esta prueba fuerza reglas internas y base JSON sin pasar por la interpretación IA del flujo actual."
    : "Describe el trabajo como lo pediría el cliente. La lectura se resume para pasar rápido a la cotización final."
  const loadingDescription = assistantMode === "JSON_BASE"
    ? "Leyendo formato, material, tintas, acabados y costos desde reglas internas más la base JSON para compararlo contra el flujo IA."
    : "Interpretando formato, material, tintas, acabados y costos base para llevarte a la respuesta final."
  const historyTitle = assistantMode === "JSON_BASE" ? "Historial de cotizaciones base JSON" : "Historial de cotizaciones IA"
  const historyEmpty = assistantMode === "JSON_BASE"
    ? "Todavía no hay cotizaciones registradas en este flujo comparativo."
    : "Todavía no hay cotizaciones IA guardadas para esta empresa."

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-5 overflow-y-auto pr-1">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Sparkles className="h-5 w-5" />
              <CardTitle className="text-xl">{modeTitle}</CardTitle>
            </div>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/dashboard/imagenes-ia/generador">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ir a imágenes IA
              </Link>
            </Button>
          </div>
          <CardDescription>
            {modeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="litografia-ai-brief">Brief del cliente</Label>
            <Textarea
              id="litografia-ai-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              onKeyDown={handleBriefKeyDown}
              className="min-h-36"
              placeholder="Ejemplo: 5.000 plegables media carta en propalcote 150 g, 4x4, dos cuerpos, entrega en Chapinero..."
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Guía básica del requerimiento</p>
                <p className="text-sm text-slate-500">Cumplidos {readyRequirements} de {briefRequirements.length}. Enter analiza y Shift+Enter agrega salto de línea.</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                {finalBrief.trim().length} caracteres
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={guideMode === "natural" ? "default" : "outline"}
                onClick={() => setGuideMode("natural")}
              >
                Consulta natural
              </Button>
              <Button
                type="button"
                size="sm"
                variant={guideMode === "advanced" ? "default" : "outline"}
                onClick={() => setGuideMode("advanced")}
              >
                Consulta manual avanzada
              </Button>
              <p className="self-center text-xs text-slate-500">Puedes escribir libremente y, si quieres afinar, apoyar la consulta con selecciones del JSON actual.</p>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">Ajuste de utilidad</p>
                <p className="mt-1 text-sm text-slate-600">Empieza en 40% y puedes subirlo para esta cotización IA antes de analizar o pasarla a la cotización final.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="w-full max-w-[220px]">
                    <Label htmlFor="litografia-ai-margin" className="sr-only">Utilidad</Label>
                    <Input
                      id="litografia-ai-margin"
                      type="number"
                      min="40"
                      step="1"
                      value={quickMarginPct}
                      onChange={(event) => setQuickMarginPct(event.target.value)}
                      className="bg-white text-base font-semibold"
                    />
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                    Utilidad aplicada: {currentMarginPct}%
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
              <div className={`rounded-2xl border px-4 py-4 ${quickQuantity.trim() ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="text-sm font-semibold text-slate-900">Indique cantidad</p>
                <p className="mt-1 text-sm text-slate-600">Ponga acá cuántas piezas, unidades o ejemplares necesita el cliente.</p>
                <Label htmlFor="litografia-ai-quick-quantity" className="sr-only">Cantidad</Label>
                <Textarea
                  id="litografia-ai-quick-quantity"
                  value={quickQuantity}
                  onChange={(event) => setQuickQuantity(event.target.value)}
                  className="mt-3 min-h-[72px] resize-none border-0 bg-white/70 px-0 py-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                  placeholder="Ejemplo: 300 unidades"
                />
              </div>
              <div className={`rounded-2xl border px-4 py-4 ${quickProduct.trim() ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="text-sm font-semibold text-slate-900">Indique producto</p>
                <p className="mt-1 text-sm text-slate-600">Ponga acá el nombre base del trabajo para orientar mejor la lectura del brief.</p>
                <Label htmlFor="litografia-ai-quick-product" className="sr-only">Producto</Label>
                <Textarea
                  id="litografia-ai-quick-product"
                  value={quickProduct}
                  onChange={(event) => setQuickProduct(event.target.value)}
                  className="mt-3 min-h-[72px] resize-none border-0 bg-white/70 px-0 py-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                  placeholder="Ejemplo: separador de libro, volante, tarjeta"
                />
                {productSuggestion.note ? <p className="mt-3 text-xs text-slate-600">{productSuggestion.note}</p> : null}
                {guideMode === "natural" && productOptions.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {productOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setQuickProduct(option)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            </div>
            {guideMode === "advanced" ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Opciones actuales del JSON</p>
                    <p className="text-sm text-slate-500">Marca opciones reales del catálogo. La escritura libre sigue activa y estas selecciones solo refuerzan la consulta.</p>
                  </div>
                  <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    Selección manual opcional
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className={`flex h-[22rem] flex-col rounded-xl border px-3 py-3 text-sm ${briefRequirements.find((item) => item.key === "product")?.met ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                    <p className="font-medium">Producto</p>
                    <p className="mt-1 text-current/80">Opciones actuales del JSON para orientar el tipo base del trabajo.</p>
                    {selectionSummaryByKey.product.length ? <p className="mt-2 text-xs font-semibold">Seleccionado: {selectionSummaryByKey.product.join(", ")}</p> : null}
                    <Input
                      value={advancedSearch.product}
                      onChange={(event) => setAdvancedSearch((current) => ({ ...current, product: event.target.value }))}
                      placeholder="Buscar producto"
                      className="mt-3 bg-white"
                    />
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {advancedOptionLists.product.map((option) => {
                        const checked = selectionSummaryByKey.product.includes(option)
                        return (
                          <label key={`product-${option}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${checked ? "border-emerald-300 bg-white" : "border-white/70 bg-white/70"}`}>
                            <input type="checkbox" checked={checked} onChange={() => handleSingleAdvancedSelection("product", option)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                            <span className="text-sm">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className={`flex h-[22rem] flex-col rounded-xl border px-3 py-3 text-sm ${briefRequirements.find((item) => item.key === "quantity")?.met ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                    <p className="font-medium">Cantidad</p>
                    <p className="mt-1 text-current/80">Este dato sigue siendo manual para no encerrar la consulta en cantidades fijas.</p>
                    {selectionSummaryByKey.quantity.length ? <p className="mt-2 text-xs font-semibold">Seleccionado: {selectionSummaryByKey.quantity.join(", ")}</p> : null}
                    <Textarea
                      value={quickQuantity}
                      onChange={(event) => setQuickQuantity(event.target.value)}
                      className="mt-3 min-h-[120px] bg-white"
                      placeholder="Ejemplo: 5.000 unidades"
                    />
                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/70 bg-white/70 px-3 py-3 text-xs text-current/80">
                      La cantidad seleccionada aquí también cuenta para poner esta caja en verde y complementar la consulta natural.
                    </div>
                  </div>

                  <div className={`flex h-[22rem] flex-col rounded-xl border px-3 py-3 text-sm ${briefRequirements.find((item) => item.key === "size")?.met ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                    <p className="font-medium">Tamaño o formato</p>
                    <p className="mt-1 text-current/80">Opciones actuales del JSON para medidas y referencias comerciales.</p>
                    {selectionSummaryByKey.size.length ? <p className="mt-2 text-xs font-semibold">Seleccionado: {selectionSummaryByKey.size.join(", ")}</p> : null}
                    <Input
                      value={advancedSearch.size}
                      onChange={(event) => setAdvancedSearch((current) => ({ ...current, size: event.target.value }))}
                      placeholder="Buscar tamaño"
                      className="mt-3 bg-white"
                    />
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {advancedOptionLists.size.map((option) => {
                        const checked = selectionSummaryByKey.size.includes(option)
                        return (
                          <label key={`size-${option}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${checked ? "border-emerald-300 bg-white" : "border-white/70 bg-white/70"}`}>
                            <input type="checkbox" checked={checked} onChange={() => handleSingleAdvancedSelection("size", option)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                            <span className="text-sm">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className={`flex h-[22rem] flex-col rounded-xl border px-3 py-3 text-sm ${briefRequirements.find((item) => item.key === "material")?.met ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                    <p className="font-medium">Papel o material</p>
                    <p className="mt-1 text-current/80">Opciones actuales del JSON para papel base y gramajes existentes.</p>
                    {selectionSummaryByKey.material.length ? <p className="mt-2 text-xs font-semibold">Seleccionado: {selectionSummaryByKey.material.join(", ")}</p> : null}
                    <Input
                      value={advancedSearch.material}
                      onChange={(event) => setAdvancedSearch((current) => ({ ...current, material: event.target.value }))}
                      placeholder="Buscar papel o material"
                      className="mt-3 bg-white"
                    />
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {advancedOptionLists.material.map((option) => {
                        const checked = selectionSummaryByKey.material.includes(option)
                        return (
                          <label key={`material-${option}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${checked ? "border-emerald-300 bg-white" : "border-white/70 bg-white/70"}`}>
                            <input type="checkbox" checked={checked} onChange={() => handleSingleAdvancedSelection("material", option)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                            <span className="text-sm">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className={`flex h-[22rem] flex-col rounded-xl border px-3 py-3 text-sm ${briefRequirements.find((item) => item.key === "inks")?.met ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                    <p className="font-medium">Tintas</p>
                    <p className="mt-1 text-current/80">Opciones actuales del JSON para configuraciones de impresión.</p>
                    {selectionSummaryByKey.inks.length ? <p className="mt-2 text-xs font-semibold">Seleccionado: {selectionSummaryByKey.inks.join(", ")}</p> : null}
                    <Input
                      value={advancedSearch.inks}
                      onChange={(event) => setAdvancedSearch((current) => ({ ...current, inks: event.target.value }))}
                      placeholder="Buscar tintas"
                      className="mt-3 bg-white"
                    />
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {advancedOptionLists.inks.map((option) => {
                        const checked = selectionSummaryByKey.inks.includes(option)
                        return (
                          <label key={`inks-${option}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${checked ? "border-emerald-300 bg-white" : "border-white/70 bg-white/70"}`}>
                            <input type="checkbox" checked={checked} onChange={() => handleSingleAdvancedSelection("inks", option)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                            <span className="text-sm">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className={`flex h-[22rem] flex-col rounded-xl border px-3 py-3 text-sm ${briefRequirements.find((item) => item.key === "finish")?.met ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                    <p className="font-medium">Acabados</p>
                    <p className="mt-1 text-current/80">Opciones actuales del JSON para plastificados y terminados disponibles.</p>
                    {selectionSummaryByKey.finish.length ? <p className="mt-2 text-xs font-semibold">Seleccionado: {selectionSummaryByKey.finish.join(", ")}</p> : null}
                    <Input
                      value={advancedSearch.finish}
                      onChange={(event) => setAdvancedSearch((current) => ({ ...current, finish: event.target.value }))}
                      placeholder="Buscar acabado"
                      className="mt-3 bg-white"
                    />
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {advancedOptionLists.finish.map((option) => {
                        const checked = selectionSummaryByKey.finish.includes(option)
                        return (
                          <label key={`finish-${option}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${checked ? "border-emerald-300 bg-white" : "border-white/70 bg-white/70"}`}>
                            <input type="checkbox" checked={checked} onChange={() => handleFinishToggle(option)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                            <span className="text-sm">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {briefRequirements.map((item) => (
                <div key={item.key} className={`rounded-xl border px-3 py-3 text-sm ${item.met ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                  <p className="font-medium">{item.label}</p>
                  <p className="mt-1">{item.hint}</p>
                  {selectionSummaryByKey[item.key]?.length ? <p className="mt-2 text-xs font-semibold">Seleccionado: {selectionSummaryByKey[item.key].join(", ")}</p> : null}
                  {requirementOptionsByKey[item.key]?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {requirementOptionsByKey[item.key].map((option) => (
                        <span key={`${item.key}-${option}`} className="rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          {option}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleAnalyze} disabled={loading || finalBrief.trim().length < 20}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Analizar requerimiento
            </Button>
            <p className="text-sm text-muted-foreground">Te deja listos los datos clave para llenar la cotización final sin repetir información.</p>
          </div>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </CardContent>
      </Card>
      {showResponsePanel ? (
        <div ref={responseSectionRef} className="space-y-4">
          {loading ? (
            <Card className="border-sky-200 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                  <LoaderCircle className="h-10 w-10 animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-slate-900">Consultando...</p>
                  <p className="text-sm text-slate-600">{loadingDescription}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

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
                        {breakdownUtility ? <div className="flex items-start justify-between gap-4"><span>Utilidad {pricing?.costBreakdown.marginPct ?? currentMarginPct}%</span><span className="font-medium text-slate-900">{breakdownUtility}</span></div> : null}
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
      ) : null}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-800">
            <History className="h-5 w-5" />
            <CardTitle className="text-lg">{historyTitle}</CardTitle>
          </div>
          <CardDescription>
            {historyScope === "company"
              ? "Consulta el historial general de cotizaciones del equipo sin traer todo de una sola vez."
              : "Consulta únicamente tu historial personal de cotizaciones sin traer todo de una sola vez."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
            <span>{historyLoading ? "Cargando historial..." : `${historyTotal} consultas registradas`}</span>
            <span>Página {historyPage} de {historyTotalPages}</span>
          </div>

          {historyError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{historyError}</p> : null}

          {!historyError && !historyLoading && !historyEntries.length ? (
            <p className="text-sm text-muted-foreground">{historyEmpty}</p>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => seedBriefComposer(entry.prompt)}>
                    Usar brief
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleApplyHistoryEntry(entry)} disabled={loading || !props.onApplyToClassic}>
                    Pasar a cotización
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedHistoryEntry(entry)}>
                    Ver consulta
                  </Button>
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

      <Dialog open={!!selectedHistoryEntry} onOpenChange={(open) => {
        if (!open) {
          setSelectedHistoryEntry(null)
        }
      }}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedHistoryEntry?.quoteType || "Consulta IA"}</DialogTitle>
            <DialogDescription>
              {selectedHistoryEntry
                ? `${formatDateTimeLabel(selectedHistoryEntry.createdAt)}${selectedHistoryEntry.actorLabel ? ` · ${selectedHistoryEntry.actorLabel}` : ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedHistoryEntry ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-2 text-sm text-slate-700">
              <div className="space-y-4 pb-1">
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedHistoryEntry.confidence ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Confianza</p>
                    <p className="mt-1 font-medium text-slate-900">{selectedHistoryEntry.confidence}</p>
                  </div>
                ) : null}
                {selectedHistoryEntry.totalSuggested != null ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total guía</p>
                    <p className="mt-1 font-medium text-slate-900">{currencyFormatter.format(selectedHistoryEntry.totalSuggested)}</p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Brief original</p>
                <p className="mt-2 whitespace-pre-line text-slate-900">{selectedHistoryEntry.prompt}</p>
              </div>

              {selectedHistoryEntry.summary ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Resumen guardado</p>
                  <p className="mt-2 whitespace-pre-line text-slate-900">{selectedHistoryEntry.summary}</p>
                </div>
              ) : null}

              {selectedHistoryEntry.responseText ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Respuesta completa</p>
                  <p className="mt-2 whitespace-pre-line text-emerald-950">{selectedHistoryEntry.responseText}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => seedBriefComposer(selectedHistoryEntry.prompt)}>
                  Usar brief
                </Button>
                <Button type="button" onClick={() => void handleApplyHistoryEntry(selectedHistoryEntry)} disabled={loading || !props.onApplyToClassic}>
                  Pasar a cotización
                </Button>
              </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}