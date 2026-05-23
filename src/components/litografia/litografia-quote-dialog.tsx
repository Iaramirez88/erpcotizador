"use client"

import { BookOpen, ChevronDown, ChevronUp, FileText, Layers3, Package2, Sparkles } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useI18n } from "@/components/providers/i18n-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableNativeSelect } from "@/components/ui/searchable-native-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { LitografiaCutGuide } from "@/components/litografia/litografia-cut-guide"
import { LitografiaImpositionPreview } from "@/components/litografia/litografia-imposition-preview"
import { LitografiaPaperRequestDialog } from "@/components/litografia/litografia-paper-request-dialog"
import type { LitografiaAiHandoff } from "@/lib/litografia-ai-handoff"
import { computeLitografia, type LitografiaResult } from "@/lib/litografia"
import { cn, formatCurrency } from "@/lib/utils"

type PapelTipo = "bond" | "propalcote" | "periodico" | "otro"

type PrintRunMode = "4x1" | "4x4"
type PrintInkKey = string

const CUSTOM_PRINT_SIZE_KEY = "__CUSTOM_PRINT_SIZE__"

const CUSTOM_DROPDOWN_KEYS = {
  transporte: "litografia_transporte",
  tirajeTiers: "litografia_tiraje_tiers",
  editorialProducto: "litografia_editorial_producto",
} as const

const INPUT_COMPACT = "h-7 px-2 text-xs"
const SELECT_COMPACT = "mt-2 h-8 w-full rounded-md border bg-background px-2 text-xs"
const HELP_TEXT = "mt-1 text-[10px] leading-tight text-muted-foreground"

const BOX_BLUR = "border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60"
const BOX_BLUR_MUTED = "rounded-md border bg-background/40 backdrop-blur supports-[backdrop-filter]:bg-background/40"

const PRINT_INK_OPTIONS: Array<{ value: PrintInkKey; label: string }> = [
  { value: "0", label: "0 (Sin impresión)" },
  { value: "1", label: "1 (1 tinta)" },
  { value: "2", label: "2 (2 tintas)" },
  { value: "4", label: "4 (CMYK)" },
  { value: "4+P1", label: "4 + Pantone 1" },
  { value: "4+P2", label: "4 + Pantone 2" },
  { value: "4+W", label: "4 + Blanco" },
  { value: "4+G", label: "4 + Dorado" },
  { value: "4+S", label: "4 + Plata" },
  { value: "4+UV", label: "4 + Barniz UV" },
]

function inkLabel(value: PrintInkKey) {
  const v = String(value || "").trim()
  return PRINT_INK_OPTIONS.find((o) => o.value === v)?.label || v || "—"
}

function normalizeAiDraftText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function inferAiDraftPaperType(material: string | null | undefined): PapelTipo | null {
  const normalized = normalizeAiDraftText(material)
  if (!normalized) return null
  if (normalized.includes("bond")) return "bond"
  if (normalized.includes("propal") || normalized.includes("cote") || normalized.includes("couche")) return "propalcote"
  if (normalized.includes("period")) return "periodico"
  return "otro"
}

const COMMERCIAL_SIZE_ALIASES: Array<{ aliases: string[]; dimensions: Array<[number, number]> }> = [
  { aliases: ["tarjeta de presentacion", "tarjetas de presentacion", "business card"], dimensions: [[9, 5], [8.5, 5.5]] },
  { aliases: ["media carta", "medio carta", "1/2 carta", "half letter"], dimensions: [[14, 21.6], [13.97, 21.59]] },
  { aliases: ["carta", "letter"], dimensions: [[21.6, 27.9], [21.59, 27.94]] },
  { aliases: ["medio oficio", "media oficio", "1/2 oficio"], dimensions: [[16.5, 21.6], [16.51, 21.59]] },
  { aliases: ["oficio", "legal"], dimensions: [[21.6, 33], [21.59, 33.02]] },
  { aliases: ["tabloide", "doble carta", "tabloid"], dimensions: [[27.9, 43.2], [27.94, 43.18]] },
  { aliases: ["medio tabloide", "1/2 tabloide"], dimensions: [[21.6, 27.9], [21.59, 27.94]] },
  { aliases: ["a5"], dimensions: [[14.8, 21]] },
  { aliases: ["a4"], dimensions: [[21, 29.7]] },
  { aliases: ["a3"], dimensions: [[29.7, 42]] },
]

const PAPER_EQUIVALENCE_GROUPS = {
  bond: ["bond", "obra", "offset"],
  propalcote: ["propalcote", "propalcote", "propal", "couche", "couchee", "cote", "coated", "esmaltado"],
  periodico: ["periodico", "prensa", "newsprint"],
  cartulina: ["cartulina", "opalina", "bristol", "sulfatada", "sulfato", "marfil", "foldcote"],
  kraft: ["kraft"],
} as const

function extractAiDraftWeight(text: string) {
  const match = text.match(/(\d{2,3})\s*(g|gr|grs|gramos?)/)
  if (!match?.[1]) return null
  const value = Math.trunc(parseFloat(match[1]) || 0)
  return Number.isFinite(value) && value > 0 ? value : null
}

function extractAiDraftDimensions(text: string) {
  const matches = Array.from(text.matchAll(/(\d{1,2}(?:[.,]\d+)?)\s*(?:x|×|por)\s*(\d{1,2}(?:[.,]\d+)?)(?:\s*cm)?/g))
  return matches
    .map((match) => {
      const width = parseFloat(String(match[1] || "").replace(",", "."))
      const height = parseFloat(String(match[2] || "").replace(",", "."))
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
      return [width, height] as [number, number]
    })
    .filter((entry): entry is [number, number] => Boolean(entry))
}

function getCommercialAliasDimensions(text: string) {
  const dimensions: Array<[number, number]> = []
  for (const group of COMMERCIAL_SIZE_ALIASES) {
    if (group.aliases.some((alias) => text.includes(alias))) {
      dimensions.push(...group.dimensions)
    }
  }
  return dimensions
}

function scoreAiDraftTokenOverlap(source: string, candidate: string) {
  const sourceTokens = source.split(/\s+/).filter((token) => token.length >= 4)
  if (!sourceTokens.length) return 0
  return sourceTokens.reduce((acc, token) => (candidate.includes(token) ? acc + 4 : acc), 0)
}

function findBestAiDraftSizeMatch(
  sourceText: string,
  draftWidth: number | null,
  draftHeight: number | null,
  sizeOptions: Array<{ key: string; nombre: string; widthCm: number; heightCm: number }>,
) {
  const dimensionCandidates: Array<[number, number]> = []
  if (typeof draftWidth === "number" && typeof draftHeight === "number") {
    dimensionCandidates.push([draftWidth, draftHeight])
  }
  dimensionCandidates.push(...extractAiDraftDimensions(sourceText))
  dimensionCandidates.push(...getCommercialAliasDimensions(sourceText))

  let bestMatch: { key: string; score: number } | null = null
  for (const size of sizeOptions) {
    const normalizedName = normalizeAiDraftText(size.nombre)
    let score = 0

    if (sourceText.includes(normalizedName)) {
      score = Math.max(score, 80 + normalizedName.length)
    }

    for (const group of COMMERCIAL_SIZE_ALIASES) {
      const aliasInSource = group.aliases.some((alias) => sourceText.includes(alias))
      const aliasInTarget = group.aliases.some((alias) => normalizedName.includes(alias))
      if (aliasInSource && aliasInTarget) {
        const longestAlias = group.aliases.reduce((max, alias) => Math.max(max, alias.length), 0)
        score = Math.max(score, 95 + longestAlias)
      }
    }

    for (const [candidateWidth, candidateHeight] of dimensionCandidates) {
      const sameOrientation = Math.abs(size.widthCm - candidateWidth) <= 0.6 && Math.abs(size.heightCm - candidateHeight) <= 0.6
      const swappedOrientation = Math.abs(size.widthCm - candidateHeight) <= 0.6 && Math.abs(size.heightCm - candidateWidth) <= 0.6
      if (sameOrientation || swappedOrientation) {
        score = Math.max(score, 140)
      }
    }

    score += scoreAiDraftTokenOverlap(sourceText, normalizedName)
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { key: size.key, score }
    }
  }

  if (bestMatch && bestMatch.score >= 70) {
    return { kind: "preset" as const, key: bestMatch.key }
  }

  const customSize = dimensionCandidates[0] ?? null
  if (customSize) {
    return { kind: "custom" as const, widthCm: customSize[0], heightCm: customSize[1] }
  }

  return null
}

function detectPaperEquivalenceGroups(text: string) {
  return Object.entries(PAPER_EQUIVALENCE_GROUPS)
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias)))
    .map(([group]) => group)
}

function findBestAiDraftPaperMatch(material: string | null | undefined, papers: PaperRate[]) {
  const normalizedMaterial = normalizeAiDraftText(material)
  if (!normalizedMaterial) return null

  const requestedWeight = extractAiDraftWeight(normalizedMaterial)
  const inferredType = inferAiDraftPaperType(normalizedMaterial)
  const requestedGroups = detectPaperEquivalenceGroups(normalizedMaterial)

  let bestMatch: { paper: PaperRate; score: number } | null = null
  for (const paper of papers) {
    const haystack = normalizeAiDraftText(`${paper.nombre} ${paper.tipo || ""} ${paper.gramaje ?? ""}`)
    let score = 0

    if (haystack.includes(normalizedMaterial) || normalizedMaterial.includes(haystack)) {
      score += 140
    }

    const paperType = inferAiDraftPaperType(`${paper.nombre} ${paper.tipo || ""}`)
    if (inferredType && paperType === inferredType) {
      score += 35
    }

    const paperGroups = detectPaperEquivalenceGroups(haystack)
    for (const group of requestedGroups) {
      if (paperGroups.includes(group)) {
        score += 30
      }
    }

    if (requestedWeight != null && paper.gramaje != null) {
      const diff = Math.abs(paper.gramaje - requestedWeight)
      if (diff === 0) score += 40
      else if (diff <= 10) score += 25
      else if (diff <= 25) score += 12
    }

    score += scoreAiDraftTokenOverlap(normalizedMaterial, haystack)

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { paper, score }
    }
  }

  return bestMatch && bestMatch.score >= 35 ? bestMatch.paper : null
}

function isEditorialAiDraft(draft: LitografiaAiHandoff | null | undefined) {
  if (!draft) return false
  if ((draft.paginas ?? 0) > 0) return true
  const source = normalizeAiDraftText(`${draft.quoteType || ""} ${draft.producto || ""} ${draft.brief || ""}`)
  return source.includes("revista") || source.includes("cartilla") || source.includes("libro")
}

function findBestEditorialOptionFromDraft(
  draft: LitografiaAiHandoff,
  options: EditorialOptionItem[],
) {
  const source = normalizeAiDraftText(`${draft.quoteType || ""} ${draft.producto || ""} ${draft.brief || ""}`)
  let bestMatch: EditorialOptionItem | null = null
  let bestScore = -1

  for (const option of options) {
    const label = normalizeAiDraftText(`${option.label} ${option.value}`)
    let score = 0
    if (source.includes(label) || label.includes(source)) score += 100
    if (source.includes("cartilla") && label.includes("cartilla")) score += 80
    if (source.includes("revista") && label.includes("revista")) score += 80
    if (source.includes("libro") && label.includes("libro")) score += 80
    score += scoreAiDraftTokenOverlap(source, label)
    if (score > bestScore) {
      bestScore = score
      bestMatch = option
    }
  }

  return bestScore >= 20 ? bestMatch : options[0] ?? null
}

function hasSpecialInk(value: PrintInkKey) {
  const v = String(value || "").trim()
  return v.includes("+")
}

function baseInkCount(value: PrintInkKey) {
  const v = String(value || "").trim()
  const m = v.match(/^([0-4])/)
  if (!m) return 0
  const n = Math.trunc(parseFloat(m[1] || "0") || 0)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function toPerColorCost(total: number, colors: 1 | 2 | 4) {
  const t = Number(total) || 0
  const c = Math.max(1, Math.trunc(Number(colors) || 0) || 1)
  return t / c
}

type PrintProfile = {
  id: string
  nombre: string
  costoPlanchaPorColor: number
  costoTintaPorColor: number
  anchoUtilCm: number
  altoUtilCm: number
  separacionPiezasCm: number
  activo: boolean
}

type PaperRate = {
  id: string
  nombre: string
  tipo: string | null
  gramaje: number | null
  pliegoWidthCm: number
  pliegoHeightCm: number
  costoPliego: number
  activo: boolean
}

type FinishOption = {
  id: string
  key: string
  nombre: string
  grupo?: "ACABADO" | "PLASTIFICADO" | "TROQUELADO" | "CORTE"
  especial?: boolean
  valor: number
  activo: boolean
}

type PrintSize = {
  id: string
  key: string
  nombre: string
  widthCm: number
  heightCm: number
  activo: boolean
}

type CustomDropdownItem = {
  id: string
  value: string
  label: string
  meta: unknown
  sortOrder: number
  activo: boolean
}

type CustomDropdown = {
  id: string
  key: string
  nombre: string
  descripcion: string | null
  items?: CustomDropdownItem[]
}

type EditorialOptionItem = {
  value: string
  label: string
  totalPaginas: number
  paginasPortadaContraportada: number
  cartasPorPlancha: number
  paginasPorPliego: number
}

type ApiEnvelope = { ok?: unknown; data?: unknown; error?: unknown }

function asApiEnvelope(value: unknown): ApiEnvelope {
  return value && typeof value === "object" ? (value as ApiEnvelope) : {}
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function metaNumber(meta: unknown, key: string): number | null {
  if (!isRecord(meta)) return null
  const raw = meta[key]
  const n = parseFloat(String(raw ?? "").trim())
  return Number.isFinite(n) ? n : null
}

function parseCopNumber(value: unknown): number {
  const raw = String(value ?? "").trim()
  if (!raw) return 0
  const digits = raw.replace(/[^0-9-]/g, "")
  const n = Math.trunc(parseFloat(digits) || 0)
  return Number.isFinite(n) ? n : 0
}

function parsePositiveCm(value: unknown): number | null {
  const n = parseFloat(String(value ?? "").trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function formatCm(value: number | null | undefined) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function nearlyEqualCm(a: number, b: number, tolerance = 0.35) {
  return Math.abs(a - b) <= tolerance
}

function deriveFoldedSize(widthCm: number, heightCm: number, foldParts: number) {
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) return null
  if (!Number.isFinite(foldParts) || foldParts < 2) return null

  const larger = Math.max(widthCm, heightCm)
  const smaller = Math.min(widthCm, heightCm)
  const foldedLarger = larger / 2
  const foldedWidth = Math.min(smaller, foldedLarger)
  const foldedHeight = Math.max(smaller, foldedLarger)

  return {
    widthCm: foldedWidth,
    heightCm: foldedHeight,
  }
}

function deriveOpenSizeFromFinal(widthCm: number, heightCm: number, foldParts: number) {
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) return null
  const parts = Math.max(1, Math.trunc(Number(foldParts) || 0) || 1)

  let smaller = Math.min(widthCm, heightCm)
  let larger = Math.max(widthCm, heightCm)
  let remaining = parts

  while (remaining > 1) {
    smaller *= 2
    const nextSmaller = Math.min(smaller, larger)
    const nextLarger = Math.max(smaller, larger)
    smaller = nextSmaller
    larger = nextLarger
    remaining = Math.ceil(remaining / 2)
  }

  return {
    widthCm: Math.min(smaller, larger),
    heightCm: Math.max(smaller, larger),
  }
}

function computeEditorialProductionQty(args: {
  runQty: number
  pliegosPorUnidad: number
  partKey: "cover" | "inner"
  piezasFinalesPorHojaAbierta?: number
}) {
  const runQty = Math.max(0, Math.trunc(Number(args.runQty) || 0))
  const pliegosPorUnidad = Math.max(1, Math.trunc(Number(args.pliegosPorUnidad) || 0) || 1)
  if (runQty <= 0) return 0

  const piezasFinalesPorHojaAbierta = Math.max(1, Math.trunc(Number(args.piezasFinalesPorHojaAbierta) || 0) || 1)
  const piezasBase = args.partKey === "cover"
    ? Math.ceil(runQty / piezasFinalesPorHojaAbierta)
    : runQty

  return piezasBase * pliegosPorUnidad
}

function computeEditorialSheetsPerUnit(totalPages: number, pagesPerSheetFront: number, printInkBack?: PrintInkKey) {
  const pages = Math.max(0, Math.trunc(Number(totalPages) || 0))
  const frontCapacity = Math.max(1, Math.trunc(Number(pagesPerSheetFront) || 0) || 1)
  const isTwoSided = baseInkCount(printInkBack || "0") > 0
  const effectiveCapacity = frontCapacity * (isTwoSided ? 2 : 1)
  return pages > 0 ? Math.ceil(pages / effectiveCapacity) : 0
}

function findSizeNameByDimensions(
  options: Array<{ nombre: string; widthCm: number; heightCm: number }>,
  widthCm: number,
  heightCm: number
) {
  return options.find((option) => {
    return (
      (nearlyEqualCm(option.widthCm, widthCm) && nearlyEqualCm(option.heightCm, heightCm)) ||
      (nearlyEqualCm(option.widthCm, heightCm) && nearlyEqualCm(option.heightCm, widthCm))
    )
  })?.nombre || null
}

function normalizeFinishText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function getEditorialProductKind(option: Pick<EditorialOptionItem, "value" | "label"> | null | undefined) {
  const normalized = normalizeFinishText(`${option?.value || ""} ${option?.label || ""}`)
  if (normalized.includes("cartilla")) return "cartilla" as const
  if (normalized.includes("revista")) return "revista" as const
  if (normalized.includes("libro")) return "libro" as const
  return "otro" as const
}

function getEditorialProductCopy(option: EditorialOptionItem | null | undefined) {
  const kind = getEditorialProductKind(option)
  switch (kind) {
    case "libro":
      return {
        badge: "Lomo y lectura continua",
        summary: "Pensado para interiores extensos y portada diferenciada.",
        detail: `${Math.max(0, option?.totalPaginas ?? 0)} págs internas sugeridas`,
      }
    case "cartilla":
      return {
        badge: "Pocas páginas, salida ágil",
        summary: "Ideal para material breve, educativo o institucional.",
        detail: `${Math.max(0, option?.totalPaginas ?? 0)} págs internas sugeridas`,
      }
    case "revista":
      return {
        badge: "Visual y editorial",
        summary: "Útil cuando portada e internas comparten ritmo comercial.",
        detail: `${Math.max(0, option?.totalPaginas ?? 0)} págs internas sugeridas`,
      }
    default:
      return {
        badge: "Plantilla editorial",
        summary: "Base rápida para configurar portada e internas.",
        detail: `${Math.max(0, option?.totalPaginas ?? 0)} págs internas sugeridas`,
      }
  }
}

function scoreEditorialFormat(kind: ReturnType<typeof getEditorialProductKind>, option: { key: string; nombre: string; widthCm: number; heightCm: number }) {
  const normalized = normalizeFinishText(`${option.key} ${option.nombre}`)
  const area = Math.max(0.01, option.widthCm * option.heightCm)
  const targetArea =
    kind === "cartilla"
      ? 440
      : kind === "libro"
        ? 520
        : kind === "revista"
          ? 620
          : 520

  const priorityKeywords =
    kind === "cartilla"
      ? ["media carta", "a5", "cuarto", "carta", "17x24", "a4"]
      : kind === "libro"
        ? ["17x24", "media carta", "a5", "21x28", "carta", "a4"]
        : kind === "revista"
          ? ["carta", "a4", "21x28", "oficio", "17x24", "tabloide"]
          : ["carta", "a4", "17x24", "21x28", "media carta"]

  let score = 0
  const keywordIndex = priorityKeywords.findIndex((keyword) => normalized.includes(keyword))
  if (keywordIndex >= 0) score += 200 - (keywordIndex * 20)
  score -= Math.abs(area - targetArea) / 10
  if (normalized.includes("personalizado")) score -= 400
  return score
}

function isTroquelLikeFinish(finish: Pick<FinishOption, "key" | "nombre">) {
  return normalizeFinishText(`${finish.key} ${finish.nombre}`).includes("troquel")
}

function isTroqueladaFinish(finish: Pick<FinishOption, "key" | "nombre">) {
  const normalized = normalizeFinishText(`${finish.key} ${finish.nombre}`)
  return normalized.includes("troquelada") || normalized.includes("troquelar")
}

function isCompaginadoFinish(finish: Pick<FinishOption, "key" | "nombre">) {
  return normalizeFinishText(`${finish.key} ${finish.nombre}`).includes("compagin")
}

function getDefaultCostoPliego(tipo: PapelTipo) {
  switch (tipo) {
    case "bond":
      return 4500
    case "propalcote":
      return 6500
    case "periodico":
      return 3000
    case "otro":
    default:
      return 0
  }
}

type PaperRow = { paperId: string; qty: string; formatoKey?: string }
type SpecialFinishRow = { finishId: string; qty: string }

type EditorialPartState = {
  formatoKey: string
  customFormatoWidthCm: string
  customFormatoHeightCm: string
  machineProfileId: string
  paperId: string
  planchas: string
  planchaProfileId: string
  planchaProfileQty: string
  planchaProfileIds: string[]
  planchaProfileQtys: string[]
  tintaProfileId: string
  tintaProfileQty: string
  tintaProfileIds: string[]
  tintaProfileQtys: string[]
  sobranteMinimo: string
  finishId: string
  specialFinishId: string
  specialFinishQty: string
  plastificadoId: string
  plastificadoQty: string
  troqueladoId: string
  troqueladoQty: string
  troqueladaId?: string
  troqueladaQty?: string
  corteId: string
  corteQty: string
  printInkFront: PrintInkKey
  printInkBack: PrintInkKey
  desperdicioPct?: string
}

function normalizeProfileRowIds(values: unknown, legacyValue = "") {
  const normalized = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean)
    : []
  if (normalized.length) return normalized
  const legacy = String(legacyValue || "").trim()
  return legacy ? [legacy] : [""]
}

function normalizeProfileRowQty(value: unknown, min = 1) {
  const n = Math.trunc(parseFloat(String(value ?? "").trim()) || 0)
  return String(Math.max(min, Number.isFinite(n) ? n : min))
}

function normalizeProfileRowQtys(values: unknown, rowCount: number, legacyValue = "1") {
  const normalized = Array.isArray(values)
    ? values.map((value) => normalizeProfileRowQty(value)).slice(0, rowCount)
    : []
  while (normalized.length < rowCount) {
    normalized.push(normalized.length === 0 ? normalizeProfileRowQty(legacyValue) : "1")
  }
  return normalized.length ? normalized : ["1"]
}

function createDefaultEditorialPart(partKey: "cover" | "inner" = "cover"): EditorialPartState {
  return {
    formatoKey: "",
    customFormatoWidthCm: "",
    customFormatoHeightCm: "",
    machineProfileId: "",
    paperId: "",
    planchas: "",
    planchaProfileId: "",
    planchaProfileQty: "1",
    planchaProfileIds: [""],
    planchaProfileQtys: ["1"],
    tintaProfileId: "",
    tintaProfileQty: "1",
    tintaProfileIds: [""],
    tintaProfileQtys: ["1"],
    sobranteMinimo: "120",
    finishId: "",
    specialFinishId: "",
    specialFinishQty: "0",
    plastificadoId: "",
    plastificadoQty: "1",
    troqueladoId: "",
    troqueladoQty: "1",
    troqueladaId: "",
    troqueladaQty: "1",
    corteId: "",
    corteQty: "1",
    printInkFront: "4",
    printInkBack: partKey === "inner" ? "4" : "1",
    desperdicioPct: "0",
  }
}

function createNormalizedEditorialPart(
  partKey: "cover" | "inner",
  value?: Partial<EditorialPartState> | null,
): EditorialPartState {
  const base = createDefaultEditorialPart(partKey)
  const merged = { ...base, ...(value ?? {}) }
  const planchaProfileIds = normalizeProfileRowIds(merged.planchaProfileIds, merged.planchaProfileId)
  const tintaProfileIds = normalizeProfileRowIds(merged.tintaProfileIds, merged.tintaProfileId)

  return {
    ...merged,
    customFormatoWidthCm: String(merged.customFormatoWidthCm ?? ""),
    customFormatoHeightCm: String(merged.customFormatoHeightCm ?? ""),
    machineProfileId: String(merged.machineProfileId || merged.planchaProfileId || planchaProfileIds[0] || ""),
    planchaProfileId: String(merged.planchaProfileId || planchaProfileIds[0] || ""),
    planchaProfileQty: normalizeProfileRowQty(merged.planchaProfileQty),
    planchaProfileIds,
    planchaProfileQtys: normalizeProfileRowQtys(merged.planchaProfileQtys, planchaProfileIds.length, merged.planchaProfileQty),
    tintaProfileId: String(merged.tintaProfileId || tintaProfileIds[0] || ""),
    tintaProfileQty: normalizeProfileRowQty(merged.tintaProfileQty),
    tintaProfileIds,
    tintaProfileQtys: normalizeProfileRowQtys(merged.tintaProfileQtys, tintaProfileIds.length, merged.tintaProfileQty),
    sobranteMinimo: String(merged.sobranteMinimo || base.sobranteMinimo),
    specialFinishQty: String(merged.specialFinishQty || base.specialFinishQty),
    plastificadoQty: normalizeProfileRowQty(merged.plastificadoQty),
    troqueladoQty: normalizeProfileRowQty(merged.troqueladoQty),
    troqueladaQty: normalizeProfileRowQty(merged.troqueladaQty),
    corteQty: normalizeProfileRowQty(merged.corteQty),
    printInkFront: String(merged.printInkFront || base.printInkFront) as PrintInkKey,
    printInkBack: String(merged.printInkBack || base.printInkBack) as PrintInkKey,
    desperdicioPct: String(merged.desperdicioPct || base.desperdicioPct || "0"),
  }
}

type CustomField = { id: string; label: string; value: string }

const LITOGRAFIA_ITEM_IVA_PCT = 19

export type LitografiaMeta = {
  version?: number
  titulo: string
  descripcion: string
  margenPct?: string
  cantidad: string
  cantidadItems?: string
  // Compat (viejo selector 4x1/4x4)
  printRunMode?: PrintRunMode

  // Nuevo: selector completo por Frente/Reverso (ej. 4 / 1, 4+P1 / 4+P1, 1 / 1)
  printInkFront?: string
  printInkBack?: string
  numeroCaras?: string
  desperdicioPct: string
  sobranteMinimo?: string
  pricingSource: "tarifario" | "calculo"
  formatoKey: string
  colores: string
  costoPlanchaPorColor: string
  costoTintaPorColor: string
  costoPapelUnidad: string
  papelPorPliego: boolean
  papelTipo: PapelTipo
  costoPliego: string
  pliegoW: string
  pliegoH: string
  selectedPlanchaProfileId: string
  selectedTintaProfileId: string
  selectedMachineProfileId?: string
  selectedPaperId: string
  selectedPlanchaProfileIds?: string[]
  selectedPlanchaProfileQtys?: string[]
  selectedTintaProfileIds?: string[]
  selectedTintaProfileQtys?: string[]
  selectedPaperIds?: string[]
  paperItems?: Array<{ paperId: string; qty: string; formatoKey?: string }>
  selectedFinishId: string
  selectedFinishIds?: string[]
  specialFinishItems?: Array<{ finishId: string; qty: string }>
  selectedPlastificadoId?: string
  selectedPlastificadoQty?: string
  selectedTroqueladoId?: string
  selectedTroqueladoQty?: string
  selectedTroqueladaId?: string
  selectedTroqueladaQty?: string
  selectedCorteId?: string
  selectedCorteQty?: string
  selectedPaperTipo: string
  selectedPaperGramaje: string
  selectedTransporteKey: string
  costoCorte: string
  costoAcabados: string
  costoTransporte: string
  customFields: CustomField[]
  itemSubtotalIncludesIva?: boolean
  itemIvaPct?: number
  subtotalSinIva?: number
  subtotalConIva?: number

  quoteMode?: QuoteMode

  editorialProductoKey?: string
  editorialTotalPaginas?: string
  editorialPaginasPortadaContraportada?: string
  editorialCartasPorPlancha?: string
  editorialPaginasPorPliego?: string
  editorialFinalFormatoKey?: string
  editorialFinalCustomWidthCm?: string
  editorialFinalCustomHeightCm?: string

  editorialParts?: {
    cover: EditorialPartState
    inner: EditorialPartState
  }

  costoProduccion?: number
  precioVenta?: number
  selectedMachineName?: string
  selectedMachineWidthCm?: string
  selectedMachineHeightCm?: string
  selectedMachineGapCm?: string
  selectedFinalSizeName?: string
  customFormatoWidthCm?: string
  customFormatoHeightCm?: string
  impositionShort?: string
  impositionSummary?: string
}

type AddLitografiaItemPayload = {
  descripcion: string
  cantidad: number
  unidad: string
  desperdicioPct: number
  precioUnitario: number
  subtotal: number
  meta?: LitografiaMeta
}

type QuoteMode = "normal" | "editorial"

export function LitografiaQuoteDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddItem: (payload: AddLitografiaItemPayload) => void
  edit?: { itemId: string; meta: LitografiaMeta } | null
  onUpdateItem?: (payload: AddLitografiaItemPayload & { itemId: string }) => void
  aiDraft?: LitografiaAiHandoff | null
}) {
  const { t, language } = useI18n()
  const appliedAiDraftIdRef = useRef<string | null>(null)
  const [appliedAiDraftId, setAppliedAiDraftId] = useState<string | null>(null)

  const [meLoaded, setMeLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canConfigWrite, setCanConfigWrite] = useState(false)

  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")

  const [cantidad, setCantidad] = useState("1000")
  const [colores, setColores] = useState("1")
  const [sobranteMinimo, setSobranteMinimo] = useState("100")

  const [printInkFront, setPrintInkFront] = useState<PrintInkKey>("4")
  const [printInkBack, setPrintInkBack] = useState<PrintInkKey>("1")

  const [costoPlanchaPorColor, setCostoPlanchaPorColor] = useState("25000")
  const [costoTintaPorColor, setCostoTintaPorColor] = useState("15000")
  const [costoPapelUnidad, setCostoPapelUnidad] = useState("80")

  const [papelPorPliego, setPapelPorPliego] = useState(true)
  const [papelTipo, setPapelTipo] = useState<PapelTipo>("propalcote")
  const [costoPliego, setCostoPliego] = useState(String(getDefaultCostoPliego("propalcote")))
  const [pliegoW, setPliegoW] = useState("70")
  const [pliegoH, setPliegoH] = useState("100")
  const [formatoKey, setFormatoKey] = useState("")
  const [customFormatoWidthCm, setCustomFormatoWidthCm] = useState("")
  const [customFormatoHeightCm, setCustomFormatoHeightCm] = useState("")

  const [profiles, setProfiles] = useState<PrintProfile[]>([])
  const [papers, setPapers] = useState<PaperRate[]>([])
  const [finishes, setFinishes] = useState<FinishOption[]>([])
  const [sizes, setSizes] = useState<PrintSize[]>([])
  const [paperRequestOpen, setPaperRequestOpen] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [selectedMachineProfileId, setSelectedMachineProfileId] = useState<string>("")
  const [selectedPlanchaProfileIds, setSelectedPlanchaProfileIds] = useState<string[]>([""])
  const [selectedPlanchaProfileQtys, setSelectedPlanchaProfileQtys] = useState<string[]>(["1"])
  const [selectedTintaProfileIds, setSelectedTintaProfileIds] = useState<string[]>([""])
  const [selectedTintaProfileQtys, setSelectedTintaProfileQtys] = useState<string[]>(["1"])
  const [paperRows, setPaperRows] = useState<PaperRow[]>([{ paperId: "", qty: "1", formatoKey: "" }])
  const [selectedFinishIds, setSelectedFinishIds] = useState<string[]>([""])
  const [specialFinishRows, setSpecialFinishRows] = useState<SpecialFinishRow[]>([{ finishId: "", qty: "1" }])

  const [selectedPlastificadoId, setSelectedPlastificadoId] = useState<string>("")
  const [selectedTroqueladoId, setSelectedTroqueladoId] = useState<string>("")
  const [selectedTroqueladaId, setSelectedTroqueladaId] = useState<string>("")
  const [selectedCorteId, setSelectedCorteId] = useState<string>("")

  const [selectedPlastificadoQty, setSelectedPlastificadoQty] = useState<string>("1")
  const [selectedTroqueladoQty, setSelectedTroqueladoQty] = useState<string>("1")
  const [selectedTroqueladaQty, setSelectedTroqueladaQty] = useState<string>("1")
  const [selectedCorteQty, setSelectedCorteQty] = useState<string>("1")

  const [selectedPaperTipo, setSelectedPaperTipo] = useState<string>("")
  const [selectedPaperGramaje, setSelectedPaperGramaje] = useState<string>("")

  const [selectedTransporteKey, setSelectedTransporteKey] = useState<string>("")
  const [transporteOptions, setTransporteOptions] = useState<Array<{ value: string; label: string; total: number }>>([])
  const [transporteOptionsLoading, setTransporteOptionsLoading] = useState(false)

  const [selectedEditorialProductoKey, setSelectedEditorialProductoKey] = useState<string>("")
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("normal")
  const [editorialOptions, setEditorialOptions] = useState<
    Array<{
      value: string
      label: string
      totalPaginas: number
      paginasPortadaContraportada: number
      cartasPorPlancha: number
      paginasPorPliego: number
    }>
  >([])
  const [editorialOptionsLoading, setEditorialOptionsLoading] = useState(false)
  const [editorialTotalPaginas, setEditorialTotalPaginas] = useState("32")
  const [editorialPaginasPortadaContraportada, setEditorialPaginasPortadaContraportada] = useState("2")
  const [editorialCartasPorPlancha, setEditorialCartasPorPlancha] = useState("2")
  const [editorialPaginasPorPliego, setEditorialPaginasPorPliego] = useState("4")
  const [editorialFinalFormatoKey, setEditorialFinalFormatoKey] = useState("")
  const [editorialFinalCustomWidthCm, setEditorialFinalCustomWidthCm] = useState("")
  const [editorialFinalCustomHeightCm, setEditorialFinalCustomHeightCm] = useState("")

  const [editorialCover, setEditorialCover] = useState<EditorialPartState>(() => createDefaultEditorialPart("cover"))
  const [editorialInner, setEditorialInner] = useState<EditorialPartState>(() => createDefaultEditorialPart("inner"))

  const [costoCorte, setCostoCorte] = useState("0")
  const [costoAcabados, setCostoAcabados] = useState("0")
  const [costoTransporte, setCostoTransporte] = useState("0")

  // Utilidad/Margen opcional (en litografía la utilidad varía)
  const [margenPct, setMargenPct] = useState<string>("40")

  // En SGDigital se cotiza siempre en policromía (4).
  const tintas: 1 | 2 | 4 = 4
  const [pricingError, setPricingError] = useState<string | null>(null)

  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const [showAdvanced, setShowAdvanced] = useState(true)
  const [showRunQtyDetails, setShowRunQtyDetails] = useState(false)

  const [customFields, setCustomFields] = useState<CustomField[]>([])

  const planchaIdsNormalized = useMemo(() => {
    const ids = selectedPlanchaProfileIds.map((x) => String(x || "").trim()).filter(Boolean)
    return ids
  }, [selectedPlanchaProfileIds])
  const tintaIdsNormalized = useMemo(() => {
    const ids = selectedTintaProfileIds.map((x) => String(x || "").trim()).filter(Boolean)
    return ids
  }, [selectedTintaProfileIds])

  const primaryPlanchaProfileId = planchaIdsNormalized[0] ?? ""
  const primaryTintaProfileId = tintaIdsNormalized[0] ?? ""
  const primaryPaperId = String(paperRows[0]?.paperId ?? "").trim()

  const updateEditorialPart = useCallback(
    (partKey: "cover" | "inner", updater: (prev: EditorialPartState) => EditorialPartState) => {
      const setter = partKey === "cover" ? setEditorialCover : setEditorialInner
      setter((prev) => createNormalizedEditorialPart(partKey, updater(prev)))
    },
    [],
  )

  const addEditorialProfileRow = useCallback(
    (partKey: "cover" | "inner", profileType: "plancha" | "tinta") => {
      updateEditorialPart(partKey, (prev) => {
        if (profileType === "plancha") {
          return {
            ...prev,
            planchaProfileIds: [...prev.planchaProfileIds, ""],
            planchaProfileQtys: [...prev.planchaProfileQtys, "1"],
          }
        }
        return {
          ...prev,
          tintaProfileIds: [...prev.tintaProfileIds, ""],
          tintaProfileQtys: [...prev.tintaProfileQtys, "1"],
        }
      })
    },
    [updateEditorialPart],
  )

  const removeEditorialProfileRow = useCallback(
    (partKey: "cover" | "inner", profileType: "plancha" | "tinta", index: number) => {
      updateEditorialPart(partKey, (prev) => {
        if (profileType === "plancha") {
          const nextIds = prev.planchaProfileIds.filter((_, idx) => idx !== index)
          const nextQtys = prev.planchaProfileQtys.filter((_, idx) => idx !== index)
          return {
            ...prev,
            planchaProfileIds: nextIds.length ? nextIds : [""],
            planchaProfileQtys: nextQtys.length ? nextQtys : ["1"],
          }
        }
        const nextIds = prev.tintaProfileIds.filter((_, idx) => idx !== index)
        const nextQtys = prev.tintaProfileQtys.filter((_, idx) => idx !== index)
        return {
          ...prev,
          tintaProfileIds: nextIds.length ? nextIds : [""],
          tintaProfileQtys: nextQtys.length ? nextQtys : ["1"],
        }
      })
    },
    [updateEditorialPart],
  )

  const updateEditorialProfileRow = useCallback(
    (partKey: "cover" | "inner", profileType: "plancha" | "tinta", index: number, value: string) => {
      updateEditorialPart(partKey, (prev) => {
        const normalized = String(value || "").trim()
        if (profileType === "plancha") {
          const nextIds = [...prev.planchaProfileIds]
          nextIds[index] = normalized
          return { ...prev, planchaProfileIds: nextIds }
        }
        const nextIds = [...prev.tintaProfileIds]
        nextIds[index] = normalized
        return { ...prev, tintaProfileIds: nextIds }
      })
    },
    [updateEditorialPart],
  )

  const updateEditorialProfileQty = useCallback(
    (partKey: "cover" | "inner", profileType: "plancha" | "tinta", index: number, qty: string) => {
      updateEditorialPart(partKey, (prev) => {
        if (profileType === "plancha") {
          const nextQtys = [...prev.planchaProfileQtys]
          nextQtys[index] = qty
          return { ...prev, planchaProfileQtys: nextQtys }
        }
        const nextQtys = [...prev.tintaProfileQtys]
        nextQtys[index] = qty
        return { ...prev, tintaProfileQtys: nextQtys }
      })
    },
    [updateEditorialPart],
  )

  const editorialMode = quoteMode === "editorial"
  const editorialEnabled = editorialMode && Boolean(String(selectedEditorialProductoKey || "").trim())
  const selectedEditorialOption = useMemo(
    () => editorialOptions.find((option) => option.value === selectedEditorialProductoKey) || null,
    [editorialOptions, selectedEditorialProductoKey]
  )
  const editorialProductKind = useMemo(
    () => getEditorialProductKind(selectedEditorialOption),
    [selectedEditorialOption]
  )
  const isEditorialCartilla = useMemo(() => {
    if (!editorialEnabled || !selectedEditorialOption) return false
    return normalizeFinishText(`${selectedEditorialOption.value} ${selectedEditorialOption.label}`).includes("cartilla")
  }, [editorialEnabled, selectedEditorialOption])

  const prevQuoteModeRef = useRef<QuoteMode>(quoteMode)

  useEffect(() => {
    if (!props.open) {
      prevQuoteModeRef.current = quoteMode
      return
    }

    setShowAdvanced(true)
    setShowRunQtyDetails(false)

    const prev = prevQuoteModeRef.current
    if (prev !== quoteMode) {
      // Al cambiar de modo, arrancar limpio para evitar herencia entre modos.
      setTitulo("")
      setDescripcion("")

      setCantidad("1000")
      setColores("1")
      setSobranteMinimo("120")
      setPrintInkFront("4")
      setPrintInkBack("1")

      setCostoPlanchaPorColor("25000")
      setCostoTintaPorColor("15000")
      setCostoPapelUnidad("80")

      setMargenPct("40")

      setConfigError(null)

      setSelectedMachineProfileId("")
      setSelectedPlanchaProfileIds([""])
      setSelectedPlanchaProfileQtys(["1"])
      setSelectedTintaProfileIds([""])
      setSelectedTintaProfileQtys(["1"])

      setPaperRows([{ paperId: "", qty: "1", formatoKey: "" }])
      setFormatoKey("")
      setPapelPorPliego(true)
      setPapelTipo("propalcote")
      setCostoPliego(String(getDefaultCostoPliego("propalcote")))
      setPliegoW("70")
      setPliegoH("100")
      setCustomFormatoWidthCm("")
      setCustomFormatoHeightCm("")
      setCostoPapelUnidad("80")
      setSelectedPaperTipo("")
      setSelectedPaperGramaje("")
      setSobranteMinimo("120")

      setSelectedFinishIds([""])
      setSpecialFinishRows([{ finishId: "", qty: "1" }])
      setSelectedPlastificadoId("")
      setSelectedTroqueladoId("")
      setSelectedTroqueladaId("")
      setSelectedCorteId("")
      setSelectedPlastificadoQty("1")
      setSelectedTroqueladoQty("1")
      setSelectedTroqueladaQty("1")
      setSelectedCorteQty("1")
      setSelectedTransporteKey("")
      setCostoTransporte("0")
      setCostoCorte("0")
      setCostoAcabados("0")
      setCustomFields([])
      setPricingError(null)
      setAttemptedSubmit(false)
      setAppliedAiDraftId(null)

      setSelectedEditorialProductoKey("")
      setEditorialTotalPaginas("32")
      setEditorialPaginasPortadaContraportada("2")
      setEditorialCartasPorPlancha("2")
      setEditorialPaginasPorPliego("4")
      setEditorialFinalFormatoKey("")
      setEditorialFinalCustomWidthCm("")
      setEditorialFinalCustomHeightCm("")
      setEditorialCover(createDefaultEditorialPart("cover"))
      setEditorialInner(createDefaultEditorialPart("inner"))
    }

    prevQuoteModeRef.current = quoteMode
  }, [props.open, quoteMode])

  const SOBRANTE_MINIMO_BASE_DEFAULT = 120

  const isTwoSided = useMemo(() => baseInkCount(printInkBack) > 0, [printInkBack])
  const isCmykFront = useMemo(() => baseInkCount(printInkFront) >= 4, [printInkFront])
  const isCmykBack = useMemo(() => baseInkCount(printInkBack) >= 4, [printInkBack])
  const isPolicromiaAmbasCaras = useMemo(() => isCmykFront && isCmykBack, [isCmykFront, isCmykBack])

  const getDefaultSobranteMinimoForSpec = (policromiaAmbasCaras: boolean) =>
    policromiaAmbasCaras ? SOBRANTE_MINIMO_BASE_DEFAULT * 2 : SOBRANTE_MINIMO_BASE_DEFAULT

  const isDefaultSobranteMinimoValue = (value: string) => {
    const n = Math.trunc(parseFloat(String(value || "").trim()) || 0)
    return n === SOBRANTE_MINIMO_BASE_DEFAULT || n === SOBRANTE_MINIMO_BASE_DEFAULT * 2
  }

  const getDefaultProfileMultiplierForSpec = (twoSided: boolean) => (twoSided ? 2 : 1)

  useEffect(() => {
    if (!props.open) return

    const nextSobrante = String(getDefaultSobranteMinimoForSpec(isPolicromiaAmbasCaras))
    setSobranteMinimo((prev) => (isDefaultSobranteMinimoValue(prev) ? nextSobrante : prev))

    const multiplier = String(getDefaultProfileMultiplierForSpec(isTwoSided))
    setSelectedPlanchaProfileQtys((prev) => {
      if (prev.length !== 1) return prev
      const current = prev[0] ?? "1"
      return (current === "1" || current === "2") ? [multiplier] : prev
    })
    setSelectedTintaProfileQtys((prev) => {
      if (prev.length !== 1) return prev
      const current = prev[0] ?? "1"
      return (current === "1" || current === "2") ? [multiplier] : prev
    })

  }, [props.open, isPolicromiaAmbasCaras, isTwoSided])

  useEffect(() => {
    if (!props.open) return
    if (!editorialMode) return

    const adjustPart = (prev: EditorialPartState): EditorialPartState => {
      const twoSided = baseInkCount(prev.printInkBack) > 0
      const cmykFront = baseInkCount(prev.printInkFront) >= 4
      const cmykBack = baseInkCount(prev.printInkBack) >= 4
      const policromiaAmbasCaras = cmykFront && cmykBack

      const nextSobrante = String(getDefaultSobranteMinimoForSpec(policromiaAmbasCaras))
      const multiplier = String(getDefaultProfileMultiplierForSpec(twoSided))

      const next: EditorialPartState = { ...prev }
      if (isDefaultSobranteMinimoValue(next.sobranteMinimo)) next.sobranteMinimo = nextSobrante
      if (next.planchaProfileQty === "1" || next.planchaProfileQty === "2") next.planchaProfileQty = multiplier
      if (next.tintaProfileQty === "1" || next.tintaProfileQty === "2") next.tintaProfileQty = multiplier
      return next
    }

    setEditorialCover(adjustPart)
    setEditorialInner(adjustPart)
  }, [
    props.open,
    editorialMode,
    editorialCover.printInkFront,
    editorialCover.printInkBack,
    editorialInner.printInkFront,
    editorialInner.printInkBack,
  ])

  const editorialCoverIsPolicromiaAmbasCaras = useMemo(() => {
    const cmykFront = baseInkCount(editorialCover.printInkFront) >= 4
    const cmykBack = baseInkCount(editorialCover.printInkBack) >= 4
    return cmykFront && cmykBack
  }, [editorialCover.printInkFront, editorialCover.printInkBack])

  const editorialInnerIsPolicromiaAmbasCaras = useMemo(() => {
    const cmykFront = baseInkCount(editorialInner.printInkFront) >= 4
    const cmykBack = baseInkCount(editorialInner.printInkBack) >= 4
    return cmykFront && cmykBack
  }, [editorialInner.printInkFront, editorialInner.printInkBack])

  useEffect(() => {
    if (!props.open) return
    if (!editorialMode && selectedEditorialProductoKey) setSelectedEditorialProductoKey("")
  }, [props.open, editorialMode, selectedEditorialProductoKey])

  const finishIdsNormalized = useMemo(() => {
    const ids = selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean)
    return ids
  }, [selectedFinishIds])

  const addPlanchaRow = () => {
    setSelectedPlanchaProfileIds((prev) => [...prev, ""])
    setSelectedPlanchaProfileQtys((prev) => [...prev, "1"])
  }
  const removePlanchaRow = (index: number) => {
    setSelectedPlanchaProfileIds((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [""]
    })
    setSelectedPlanchaProfileQtys((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : ["1"]
    })
  }
  const updatePlanchaRow = (index: number, value: string) => {
    setSelectedPlanchaProfileIds((prev) => {
      const normalized = String(value || "").trim()
      const next = [...prev]
      next[index] = normalized
      if (!next.length) return [""]
      return next
    })
  }

  const updatePlanchaQty = (index: number, qty: string) => {
    setSelectedPlanchaProfileQtys((prev) => {
      const next = [...prev]
      next[index] = qty
      if (!next.length) return ["1"]
      return next
    })
  }

  const addTintaRow = () => {
    setSelectedTintaProfileIds((prev) => [...prev, ""])
    setSelectedTintaProfileQtys((prev) => [...prev, "1"])
  }
  const removeTintaRow = (index: number) => {
    setSelectedTintaProfileIds((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [""]
    })
    setSelectedTintaProfileQtys((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : ["1"]
    })
  }
  const updateTintaRow = (index: number, value: string) => {
    setSelectedTintaProfileIds((prev) => {
      const normalized = String(value || "").trim()
      const next = [...prev]
      next[index] = normalized
      if (!next.length) return [""]
      return next
    })
  }

  const updateTintaQty = (index: number, qty: string) => {
    setSelectedTintaProfileQtys((prev) => {
      const next = [...prev]
      next[index] = qty
      if (!next.length) return ["1"]
      return next
    })
  }

  const addPaperRow = () => setPaperRows((prev) => [...prev, { paperId: "", qty: "1", formatoKey }])
  const removePaperRow = (index: number) => {
    setPaperRows((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [{ paperId: "", qty: "1", formatoKey: "" }]
    })
  }
  const updatePaperRow = (index: number, paperId: string) => {
    setPaperRows((prev) => {
      const normalized = String(paperId || "").trim()
      const next = [...prev]
      const current = next[index] ?? { paperId: "", qty: "", formatoKey: "" }
      next[index] = { ...current, paperId: normalized }
      if (!next.length) return [{ paperId: "", qty: "", formatoKey: "" }]
      return next
    })
  }

  const updatePaperQty = (index: number, qty: string) => {
    setPaperRows((prev) => {
      const next = [...prev]
      const current = next[index] ?? { paperId: "", qty: "", formatoKey: "" }
      next[index] = { ...current, qty }
      if (!next.length) return [{ paperId: "", qty: "", formatoKey: "" }]
      return next
    })
  }

  const updatePaperFormato = (index: number, nextFormatoKey: string) => {
    setPaperRows((prev) => {
      const next = [...prev]
      const current = next[index] ?? { paperId: "", qty: "", formatoKey: "" }
      next[index] = { ...current, formatoKey: nextFormatoKey }
      if (!next.length) return [{ paperId: "", qty: "", formatoKey: "" }]
      return next
    })
  }

  const handlePaperSubmitted = useCallback((result: { mode: 'created' | 'requested'; paper?: PaperRate | null }) => {
    if (result.mode !== 'created' || !result.paper) return
    setPapers((prev) => {
      const next = [...prev.filter((paper) => paper.id !== result.paper!.id), result.paper!]
      next.sort((left, right) => {
        if (left.activo !== right.activo) return left.activo ? -1 : 1
        return left.nombre.localeCompare(right.nombre)
      })
      return next
    })
    updatePaperRow(0, result.paper.id)
  }, [updatePaperRow])

  const addFinishRow = () => {
    setSelectedFinishIds((prev) => [...prev, ""])
  }

  const removeFinishRow = (index: number) => {
    setSelectedFinishIds((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [""]
    })
  }

  const updateFinishRow = (index: number, value: string) => {
    setSelectedFinishIds((prev) => {
      const next = [...prev]
      next[index] = value
      if (!next.length) return [""]
      return next
    })
  }

  const addSpecialFinishRow = () => {
    setSpecialFinishRows((prev) => [...prev, { finishId: "", qty: "1" }])
  }

  const removeSpecialFinishRow = (index: number) => {
    setSpecialFinishRows((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [{ finishId: "", qty: "1" }]
    })
  }

  const updateSpecialFinishRow = (index: number, finishId: string) => {
    setSpecialFinishRows((prev) => {
      const normalized = String(finishId || "").trim()
      const next = [...prev]
      const current = next[index] ?? { finishId: "", qty: "1" }
      next[index] = { ...current, finishId: normalized }
      if (!next.length) return [{ finishId: "", qty: "1" }]
      return next
    })
  }

  const updateSpecialFinishQty = (index: number, qty: string) => {
    setSpecialFinishRows((prev) => {
      const next = [...prev]
      const current = next[index] ?? { finishId: "", qty: "1" }
      next[index] = { ...current, qty }
      if (!next.length) return [{ finishId: "", qty: "1" }]
      return next
    })
  }

  const customFieldsTotal = useMemo(() => {
    return customFields.reduce((acc, f) => acc + parseCopNumber(f.value), 0)
  }, [customFields])

  const margenMultiplier = useMemo(() => {
    const n = parseFloat(String(margenPct))
    const pct = Number.isFinite(n) ? Math.min(500, Math.max(40, n)) : 40
    return 1 + pct / 100
  }, [margenPct])

  const buildLitografiaQuoteAmounts = (computed: LitografiaResult | null) => {
    if (!computed) return null

    const ignoreNormalExtras = editorialEnabled
    const addFinishesCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : selectedFinishesCost)
    const addSpecialFinishesCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : specialFinishesCost)
    const addPlastificadoCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : plastificadoCostTotal)
    const addTroqueladoCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : troqueladoCostTotal)
    const addTroqueladaCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : troqueladaCostTotal)
    const addCorteCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : corteCostTotal)

    const baseValue = computed.costoProduccion ?? computed.precioVenta ?? 0
    const subtotalAntesUtilidad =
      baseValue +
      addFinishesCost +
      addSpecialFinishesCost +
      addPlastificadoCost +
      addTroqueladoCost +
      addTroqueladaCost +
      addCorteCost +
      customFieldsTotal
    const subtotalSinIva = subtotalAntesUtilidad * margenMultiplier
    const ivaValue = subtotalSinIva * (LITOGRAFIA_ITEM_IVA_PCT / 100)
    const subtotalConIva = subtotalSinIva + ivaValue

    return {
      baseValue,
      addFinishesCost,
      addSpecialFinishesCost,
      addPlastificadoCost,
      addTroqueladoCost,
      addTroqueladaCost,
      addCorteCost,
      extras: customFieldsTotal,
      subtotalAntesUtilidad,
      subtotalSinIva,
      ivaPct: LITOGRAFIA_ITEM_IVA_PCT,
      ivaValue,
      subtotalConIva,
    }
  }

  const buildMeta = (): LitografiaMeta => {
    const finishIds = selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean)
    const primaryFinishId = finishIds[0] ?? ""
    const qtyBySpecialFinishId = new Map<string, number>()
    for (const row of specialFinishRows) {
      const finishId = String(row.finishId || "").trim()
      if (!finishId) continue
      const qty = Math.max(0, Math.trunc(parseFloat(String(row.qty ?? "0")) || 0))
      if (qty <= 0) continue
      qtyBySpecialFinishId.set(finishId, (qtyBySpecialFinishId.get(finishId) ?? 0) + qty)
    }
    const specialFinishItems = Array.from(qtyBySpecialFinishId.entries()).map(([finishId, qty]) => ({ finishId, qty: String(qty) }))
    const paperItems = paperRows
      .map((row, idx) => {
        const paperId = String(row.paperId || "").trim()
        if (!paperId) return null
        if (idx === 0) return { paperId, qty: "" }
        const qty = String(row.qty ?? "").trim()
        const rowFormatoKey = String(row.formatoKey ?? "").trim()
        return { paperId, qty, formatoKey: rowFormatoKey || undefined }
      })
      .filter(Boolean) as Array<{ paperId: string; qty: string; formatoKey?: string }>
    const selectedPaperIds = paperRows.map((r) => String(r.paperId || "").trim())
    const computed = isAdmin ? calc : fallbackCalc
    const quoteAmounts = buildLitografiaQuoteAmounts(computed)
    return {
      version: 2,
      titulo,
      descripcion,
      margenPct,
      cantidad,
      printInkFront,
      printInkBack,
      desperdicioPct: "0",
      sobranteMinimo,
      pricingSource: "calculo",
      formatoKey,
      colores,
      costoPlanchaPorColor,
      costoTintaPorColor,
      costoPapelUnidad,
      papelPorPliego,
      papelTipo,
      costoPliego,
      pliegoW,
      pliegoH,
      selectedPlanchaProfileId: primaryPlanchaProfileId,
      selectedTintaProfileId: primaryTintaProfileId,
      selectedMachineProfileId,
      selectedPaperId: primaryPaperId,
      selectedPlanchaProfileIds,
      selectedPlanchaProfileQtys,
      selectedTintaProfileIds,
      selectedTintaProfileQtys,
      selectedPaperIds,
      paperItems,
      selectedFinishId: primaryFinishId,
      selectedFinishIds: finishIds,
      specialFinishItems,
      selectedPlastificadoId,
      selectedPlastificadoQty,
      selectedTroqueladoId,
      selectedTroqueladoQty,
      selectedTroqueladaId,
      selectedTroqueladaQty,
      selectedCorteId,
      selectedCorteQty,
      selectedPaperTipo,
      selectedPaperGramaje,
      selectedTransporteKey,
      costoCorte,
      costoAcabados,
      costoTransporte,
      customFields,
      itemSubtotalIncludesIva: true,
      itemIvaPct: quoteAmounts?.ivaPct,
      subtotalSinIva: quoteAmounts?.subtotalSinIva,
      subtotalConIva: quoteAmounts?.subtotalConIva,

      editorialProductoKey: editorialEnabled ? selectedEditorialProductoKey : undefined,
      editorialTotalPaginas: editorialEnabled ? editorialTotalPaginas : undefined,
      editorialPaginasPortadaContraportada: editorialEnabled ? editorialPaginasPortadaContraportada : undefined,
      editorialCartasPorPlancha: editorialEnabled ? editorialCartasPorPlancha : undefined,
      editorialPaginasPorPliego: editorialEnabled ? editorialPaginasPorPliego : undefined,
      editorialFinalFormatoKey: editorialEnabled ? editorialFinalFormatoKey : undefined,
      editorialFinalCustomWidthCm: editorialEnabled ? editorialFinalCustomWidthCm : undefined,
      editorialFinalCustomHeightCm: editorialEnabled ? editorialFinalCustomHeightCm : undefined,

      editorialParts: editorialEnabled
        ? {
          cover: { ...editorialCover, desperdicioPct: "0" },
          inner: { ...editorialInner, desperdicioPct: "0" },
        }
        : undefined,
      costoProduccion: computed?.costoProduccion,
      precioVenta: quoteAmounts?.subtotalSinIva ?? computed?.precioVenta,
      selectedMachineName: primaryMachineProfile?.nombre,
      selectedMachineWidthCm: primaryMachineProfile ? String(primaryMachineWidth) : undefined,
      selectedMachineHeightCm: primaryMachineProfile ? String(primaryMachineHeight) : undefined,
      selectedMachineGapCm: primaryMachineProfile ? String(primaryMachineGap) : undefined,
      selectedFinalSizeName: editorialEnabled ? editorialFinalPreset?.nombre : selectedPreset?.nombre,
      customFormatoWidthCm,
      customFormatoHeightCm,
      impositionShort: activeProductionSummary?.short,
      impositionSummary: activeProductionSummary?.detail,
    }
  }

  const applyMeta = (meta: LitografiaMeta) => {
    setTitulo(meta.titulo ?? "")
    setDescripcion(meta.descripcion ?? "")
    {
      const raw = String(meta.margenPct ?? "40")
      const n = parseFloat(raw)
      const pct = Number.isFinite(n) ? Math.min(500, Math.max(40, Math.trunc(n))) : 40
      setMargenPct(String(pct))
    }
    setCantidad(meta.cantidad ?? "")
    setSobranteMinimo(meta.sobranteMinimo ?? "100")

    {
      const front = String(meta.printInkFront || "").trim()
      const back = String(meta.printInkBack || "").trim()
      if (front || back) {
        setPrintInkFront(front || "4")
        setPrintInkBack(back || "1")
      } else {
        // Compat (viejo)
        const legacy = meta.printRunMode
        if (legacy === "4x4") {
          setPrintInkFront("4")
          setPrintInkBack("4")
        } else {
          setPrintInkFront("4")
          setPrintInkBack("1")
        }
      }
    }
    setFormatoKey(meta.formatoKey ?? "")
    setCustomFormatoWidthCm(String(meta.customFormatoWidthCm ?? ""))
    setCustomFormatoHeightCm(String(meta.customFormatoHeightCm ?? ""))
    setColores(meta.colores ?? "1")
    setCostoPlanchaPorColor(meta.costoPlanchaPorColor ?? "")
    setCostoTintaPorColor(meta.costoTintaPorColor ?? "")
    setCostoPapelUnidad(meta.costoPapelUnidad ?? "")
    setPapelPorPliego(Boolean(meta.papelPorPliego))
    setPapelTipo((meta.papelTipo as PapelTipo) ?? "propalcote")
    setCostoPliego(meta.costoPliego ?? "")
    setPliegoW(meta.pliegoW ?? "")
    setPliegoH(meta.pliegoH ?? "")

    const planchaLegacy = String(meta.selectedPlanchaProfileId ?? "").trim()
    const tintaLegacy = String(meta.selectedTintaProfileId ?? "").trim()
    const machineLegacy = String(meta.selectedMachineProfileId ?? "").trim()
    const paperLegacy = String(meta.selectedPaperId ?? "").trim()

    const planchaIds = Array.isArray(meta.selectedPlanchaProfileIds) ? meta.selectedPlanchaProfileIds : []
    const tintaIds = Array.isArray(meta.selectedTintaProfileIds) ? meta.selectedTintaProfileIds : []
    const paperIds = Array.isArray(meta.selectedPaperIds) ? meta.selectedPaperIds : []

    const planchaQtys = Array.isArray(meta.selectedPlanchaProfileQtys) ? meta.selectedPlanchaProfileQtys : []
    const tintaQtys = Array.isArray(meta.selectedTintaProfileQtys) ? meta.selectedTintaProfileQtys : []

    const nextPlanchas = planchaIds.map((x) => String(x || "").trim()).filter(Boolean)
    const nextTintas = tintaIds.map((x) => String(x || "").trim()).filter(Boolean)

    const nextPlanchasIds = nextPlanchas.length ? nextPlanchas : (planchaLegacy ? [planchaLegacy] : [""])
    const nextTintasIds = nextTintas.length ? nextTintas : (tintaLegacy ? [tintaLegacy] : [""])

    const normalizeQty = (value: unknown) => {
      const raw = String(value ?? "1").trim()
      const n = Math.trunc(parseFloat(raw) || 0)
      return String(Math.max(1, Number.isFinite(n) ? n : 1))
    }

    setSelectedPlanchaProfileIds(nextPlanchasIds)
    setSelectedTintaProfileIds(nextTintasIds)
    setSelectedMachineProfileId(machineLegacy || nextPlanchasIds[0] || "")
    setSelectedPlanchaProfileQtys(nextPlanchasIds.map((_, i) => normalizeQty(planchaQtys[i] ?? "1")))
    setSelectedTintaProfileQtys(nextTintasIds.map((_, i) => normalizeQty(tintaQtys[i] ?? "1")))

    const paperItems = Array.isArray(meta.paperItems) ? meta.paperItems : []
    const rowsFromItems: PaperRow[] = []
    for (let i = 0; i < paperItems.length; i++) {
      const it = paperItems[i]
      const id = String((it as { paperId?: unknown }).paperId ?? "").trim()
      const qty = String((it as { qty?: unknown }).qty ?? "").trim()
      const rowFormato = String((it as { formatoKey?: unknown }).formatoKey ?? "").trim()
      if (!id) continue
      if (i === 0) {
        rowsFromItems.push({ paperId: id, qty: "", formatoKey: "" })
        continue
      }
      rowsFromItems.push({ paperId: id, qty, formatoKey: rowFormato || undefined })
    }
    const paperIdsNormalized = paperIds.map((x) => String(x || "").trim()).filter(Boolean)
    const rowsFromLegacy: PaperRow[] = (paperIdsNormalized.length ? paperIdsNormalized : (paperLegacy ? [paperLegacy] : [""]))
      .map((id, idx) => ({ paperId: id, qty: idx === 0 ? "" : "", formatoKey: idx === 0 ? "" : formatoKey }))
    const finalRows = rowsFromItems.length ? rowsFromItems : rowsFromLegacy
    setPaperRows(finalRows.length ? finalRows : [{ paperId: "", qty: "1", formatoKey: "" }])
    const finishIdsRaw = Array.isArray(meta.selectedFinishIds) ? meta.selectedFinishIds : []
    const fromList = finishIdsRaw.map((x) => String(x || "").trim()).filter(Boolean)
    const fromLegacy = String(meta.selectedFinishId ?? "").trim()
    const nextFinishIds = fromList.length ? fromList : (fromLegacy ? [fromLegacy] : [])
    setSelectedFinishIds(nextFinishIds.length ? nextFinishIds : [""])
    const items = Array.isArray(meta.specialFinishItems) ? meta.specialFinishItems : []
    const qtyById = new Map<string, number>()
    for (const it of items) {
      const finishId = String((it as { finishId?: unknown }).finishId ?? "").trim()
      const qty = String((it as { qty?: unknown }).qty ?? "").trim()
      if (!finishId) continue
      if (!qty) continue
      const n = Math.max(0, Math.trunc(parseFloat(qty) || 0))
      if (n <= 0) continue
      qtyById.set(finishId, (qtyById.get(finishId) ?? 0) + n)
    }
    const rows: SpecialFinishRow[] = Array.from(qtyById.entries()).map(([finishId, n]) => ({ finishId, qty: String(n) }))
    setSpecialFinishRows(rows.length ? rows : [{ finishId: "", qty: "1" }])
    setSelectedPaperTipo(meta.selectedPaperTipo ?? "")
    setSelectedPaperGramaje(meta.selectedPaperGramaje ?? "")
    setSelectedTransporteKey(String(meta.selectedTransporteKey || ""))
    setSelectedPlastificadoId(meta.selectedPlastificadoId ?? "")
    setSelectedTroqueladoId(meta.selectedTroqueladoId ?? "")
    setSelectedTroqueladaId(meta.selectedTroqueladaId ?? "")
    setSelectedCorteId(meta.selectedCorteId ?? "")
    setSelectedPlastificadoQty(String(meta.selectedPlastificadoQty ?? "1"))
    setSelectedTroqueladoQty(String(meta.selectedTroqueladoQty ?? "1"))
    setSelectedTroqueladaQty(String(meta.selectedTroqueladaQty ?? "1"))
    setSelectedCorteQty(String(meta.selectedCorteQty ?? "1"))
    setCostoCorte(meta.costoCorte ?? "0")
    setCostoAcabados(meta.costoAcabados ?? "0")
    setCostoTransporte(meta.costoTransporte ?? "0")
    setCustomFields(Array.isArray(meta.customFields) ? meta.customFields : [])

    {
      const nextEditorialKey = String(meta.editorialProductoKey || "")
      setQuoteMode(nextEditorialKey ? "editorial" : "normal")
      setSelectedEditorialProductoKey(nextEditorialKey)
    }
    setEditorialTotalPaginas(String(meta.editorialTotalPaginas || "32"))
    setEditorialPaginasPortadaContraportada(String(meta.editorialPaginasPortadaContraportada || "2"))
    setEditorialCartasPorPlancha(String(meta.editorialCartasPorPlancha || "2"))
    setEditorialPaginasPorPliego(String(meta.editorialPaginasPorPliego || "4"))
    setEditorialFinalFormatoKey(String(meta.editorialFinalFormatoKey || ""))
    setEditorialFinalCustomWidthCm(String(meta.editorialFinalCustomWidthCm || ""))
    setEditorialFinalCustomHeightCm(String(meta.editorialFinalCustomHeightCm || ""))

    const parts = meta.editorialParts
    if (parts?.cover) setEditorialCover(createNormalizedEditorialPart("cover", parts.cover))
    else setEditorialCover(createDefaultEditorialPart("cover"))
    if (parts?.inner) setEditorialInner(createNormalizedEditorialPart("inner", parts.inner))
    else setEditorialInner(createDefaultEditorialPart("inner"))
  }

  useEffect(() => {
    if (!props.open) return
    if (props.edit?.meta) applyMeta(props.edit.meta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.edit?.itemId])

  const activeSizes = useMemo(() => sizes.filter((s) => s.activo), [sizes])

  const sizeOptions = useMemo(() => {
    return activeSizes.map((s) => ({ key: s.key, nombre: s.nombre, widthCm: s.widthCm, heightCm: s.heightCm }))
  }, [activeSizes])

  const editorialQuickFormats = useMemo(() => {
    return sizeOptions
      .map((option) => ({ option, score: scoreEditorialFormat(editorialProductKind, option) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((entry) => entry.option)
  }, [editorialProductKind, sizeOptions])

  const customSizeOption = useMemo(() => {
    const widthCm = parsePositiveCm(customFormatoWidthCm)
    const heightCm = parsePositiveCm(customFormatoHeightCm)
    if (widthCm == null || heightCm == null) return null
    return {
      key: CUSTOM_PRINT_SIZE_KEY,
      nombre: "Tamaño personalizado",
      widthCm,
      heightCm,
    }
  }, [customFormatoWidthCm, customFormatoHeightCm])

  const editorialFinalCustomSizeOption = useMemo(() => {
    const widthCm = parsePositiveCm(editorialFinalCustomWidthCm)
    const heightCm = parsePositiveCm(editorialFinalCustomHeightCm)
    if (widthCm == null || heightCm == null) return null
    return {
      key: CUSTOM_PRINT_SIZE_KEY,
      nombre: "Tamaño personalizado",
      widthCm,
      heightCm,
    }
  }, [editorialFinalCustomWidthCm, editorialFinalCustomHeightCm])

  const allSizeOptions = useMemo(() => {
    return [
      ...sizeOptions,
      {
        key: CUSTOM_PRINT_SIZE_KEY,
        nombre: customSizeOption
          ? `Tamaño personalizado (${formatCm(customSizeOption.widthCm)}×${formatCm(customSizeOption.heightCm)} cm)`
          : "Tamaño personalizado",
        widthCm: customSizeOption?.widthCm ?? 0,
        heightCm: customSizeOption?.heightCm ?? 0,
      },
    ]
  }, [sizeOptions, customSizeOption])

  const resolveEditorialPartSizeOption = useCallback(
    (part: EditorialPartState) => {
      const normalizedKey = String(part.formatoKey || "").trim()
      if (!normalizedKey) return null
      if (normalizedKey === CUSTOM_PRINT_SIZE_KEY) {
        const widthCm = parsePositiveCm(part.customFormatoWidthCm)
        const heightCm = parsePositiveCm(part.customFormatoHeightCm)
        if (widthCm == null || heightCm == null) return null
        return {
          key: CUSTOM_PRINT_SIZE_KEY,
          nombre: `Tamaño personalizado (${formatCm(widthCm)}×${formatCm(heightCm)} cm)`,
          widthCm,
          heightCm,
        }
      }
      return sizeOptions.find((option) => option.key === normalizedKey) || null
    },
    [sizeOptions],
  )

  const resolveSizeOption = useCallback((key: string) => {
    const normalizedKey = String(key || "").trim()
    if (!normalizedKey) return null
    if (normalizedKey === CUSTOM_PRINT_SIZE_KEY) return customSizeOption
    return sizeOptions.find((p) => p.key === normalizedKey) || null
  }, [customSizeOption, sizeOptions])

  const resolveEditorialFinalSizeOption = useCallback((key: string) => {
    const normalizedKey = String(key || "").trim()
    if (!normalizedKey) return null
    if (normalizedKey === CUSTOM_PRINT_SIZE_KEY) return editorialFinalCustomSizeOption
    return sizeOptions.find((p) => p.key === normalizedKey) || null
  }, [editorialFinalCustomSizeOption, sizeOptions])

  const selectedPreset = useMemo(() => {
    return resolveSizeOption(formatoKey)
  }, [formatoKey, resolveSizeOption])

  const editorialFinalPreset = useMemo(() => {
    return resolveEditorialFinalSizeOption(editorialFinalFormatoKey)
  }, [editorialFinalFormatoKey, resolveEditorialFinalSizeOption])

  const editorialFoldParts = useMemo(() => {
    return Math.max(1, Math.trunc(parseFloat(editorialCartasPorPlancha) || 0) || 1)
  }, [editorialCartasPorPlancha])

  const editorialRecommendedOpenSize = useMemo(() => {
    if (!editorialFinalPreset) return null
    return deriveOpenSizeFromFinal(editorialFinalPreset.widthCm, editorialFinalPreset.heightCm, editorialFoldParts)
  }, [editorialFinalPreset, editorialFoldParts])

  const editorialRecommendedOpenPreset = useMemo(() => {
    if (!editorialRecommendedOpenSize) return null
    const found = sizeOptions.find((option) => {
      return (
        (nearlyEqualCm(option.widthCm, editorialRecommendedOpenSize.widthCm) && nearlyEqualCm(option.heightCm, editorialRecommendedOpenSize.heightCm)) ||
        (nearlyEqualCm(option.widthCm, editorialRecommendedOpenSize.heightCm) && nearlyEqualCm(option.heightCm, editorialRecommendedOpenSize.widthCm))
      )
    })
    if (found) return found
    return {
      key: CUSTOM_PRINT_SIZE_KEY,
      nombre: "Tamaño abierto recomendado",
      widthCm: editorialRecommendedOpenSize.widthCm,
      heightCm: editorialRecommendedOpenSize.heightCm,
    }
  }, [editorialRecommendedOpenSize, sizeOptions])

  const activeProfiles = useMemo(() => profiles.filter((p) => p.activo), [profiles])
  const activePlanchaProfiles = useMemo(() => {
    const filtered = activeProfiles.filter((p) => (p.costoPlanchaPorColor ?? 0) > 0)
    return filtered.length ? filtered : activeProfiles
  }, [activeProfiles])
  const activeTintaProfiles = useMemo(() => {
    const filtered = activeProfiles.filter((p) => (p.costoTintaPorColor ?? 0) > 0)
    return filtered.length ? filtered : activeProfiles
  }, [activeProfiles])
  const activePapers = useMemo(() => papers.filter((p) => p.activo), [papers])
  const getGrupo = (f: FinishOption) => (f.grupo ?? "ACABADO")

  const activeFinishes = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "ACABADO" && !f.especial && !isTroquelLikeFinish(f)),
    [finishes]
  )
  const activeSpecialFinishes = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "ACABADO" && Boolean(f.especial) && !isTroquelLikeFinish(f)),
    [finishes]
  )

  const activePlastificados = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "PLASTIFICADO"),
    [finishes]
  )
  const activeTroquelados = useMemo(
    () => finishes.filter((f) => f.activo && (getGrupo(f) === "TROQUELADO" || isTroquelLikeFinish(f)) && !isTroqueladaFinish(f)),
    [finishes]
  )
  const activeTroqueladas = useMemo(
    () => finishes.filter((f) => f.activo && ((getGrupo(f) === "TROQUELADO" && isTroqueladaFinish(f)) || isTroqueladaFinish(f))),
    [finishes]
  )
  const activeCortes = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "CORTE"),
    [finishes]
  )
  const compaginadoFinish = useMemo(
    () => activeFinishes.find((finish) => isCompaginadoFinish(finish)) || null,
    [activeFinishes]
  )
  const editorialCoverFinishes = useMemo(() => {
    if (!isEditorialCartilla) return activeFinishes
    return activeFinishes.filter((finish) => !isCompaginadoFinish(finish))
  }, [activeFinishes, isEditorialCartilla])
  const editorialInnerFinishes = useMemo(() => {
    if (!isEditorialCartilla) return activeFinishes
    const withoutCompaginado = activeFinishes.filter((finish) => !isCompaginadoFinish(finish))
    return compaginadoFinish ? [compaginadoFinish, ...withoutCompaginado] : withoutCompaginado
  }, [activeFinishes, compaginadoFinish, isEditorialCartilla])

  const selectedPlastificado = useMemo(() => {
    if (!selectedPlastificadoId) return null
    return activePlastificados.find((f) => f.id === selectedPlastificadoId) || null
  }, [activePlastificados, selectedPlastificadoId])

  const selectedTroquelado = useMemo(() => {
    if (!selectedTroqueladoId) return null
    return activeTroquelados.find((f) => f.id === selectedTroqueladoId) || null
  }, [activeTroquelados, selectedTroqueladoId])

  const selectedTroquelada = useMemo(() => {
    if (!selectedTroqueladaId) return null
    return activeTroqueladas.find((f) => f.id === selectedTroqueladaId) || null
  }, [activeTroqueladas, selectedTroqueladaId])

  const selectedCorte = useMemo(() => {
    if (!selectedCorteId) return null
    return activeCortes.find((f) => f.id === selectedCorteId) || null
  }, [activeCortes, selectedCorteId])

  const selectedTransporte = useMemo(() => {
    if (!selectedTransporteKey) return null
    return transporteOptions.find((o) => o.value === selectedTransporteKey) || null
  }, [transporteOptions, selectedTransporteKey])

  const plastificadoCost = Number(selectedPlastificado?.valor) || 0
  const troqueladoCost = Number(selectedTroquelado?.valor) || 0
  const troqueladaCost = Number(selectedTroquelada?.valor) || 0
  const corteCost = Number(selectedCorte?.valor) || 0

  const plastificadoQty = useMemo(() => {
    const n = Math.trunc(parseFloat(String(selectedPlastificadoQty)) || 0)
    return Math.max(1, Number.isFinite(n) ? n : 1)
  }, [selectedPlastificadoQty])
  const troqueladoQty = useMemo(() => {
    const n = Math.trunc(parseFloat(String(selectedTroqueladoQty)) || 0)
    return Math.max(1, Number.isFinite(n) ? n : 1)
  }, [selectedTroqueladoQty])
  const troqueladaQty = useMemo(() => {
    const n = Math.trunc(parseFloat(String(selectedTroqueladaQty)) || 0)
    return Math.max(1, Number.isFinite(n) ? n : 1)
  }, [selectedTroqueladaQty])
  const corteQty = useMemo(() => {
    const n = Math.trunc(parseFloat(String(selectedCorteQty)) || 0)
    return Math.max(1, Number.isFinite(n) ? n : 1)
  }, [selectedCorteQty])

  const plastificadoCostTotal = plastificadoCost * plastificadoQty
  const troqueladoCostTotal = troqueladoCost * troqueladoQty
  const troqueladaCostTotal = troqueladaCost * troqueladaQty
  const corteCostTotal = corteCost * corteQty

  const selectedPlanchaProfiles = useMemo(() => {
    if (!planchaIdsNormalized.length) return [] as PrintProfile[]
    const byId = new Map(profiles.map((p) => [p.id, p] as const))
    return planchaIdsNormalized.map((id) => byId.get(id)).filter(Boolean) as PrintProfile[]
  }, [profiles, planchaIdsNormalized])

  const selectedTintaProfiles = useMemo(() => {
    if (!tintaIdsNormalized.length) return [] as PrintProfile[]
    const byId = new Map(profiles.map((p) => [p.id, p] as const))
    return tintaIdsNormalized.map((id) => byId.get(id)).filter(Boolean) as PrintProfile[]
  }, [profiles, tintaIdsNormalized])

  const primaryPlanchaProfile = selectedPlanchaProfiles[0] ?? null
  const primaryTintaProfile = selectedTintaProfiles[0] ?? null
  const primaryMachineProfile = selectedMachineProfileId
    ? profiles.find((profile) => profile.id === selectedMachineProfileId) || null
    : null
  const primaryPaper = (primaryPaperId ? papers.find((p) => p.id === primaryPaperId) || null : null)
  const primaryMachineWidth = Number(primaryMachineProfile?.anchoUtilCm) || 0
  const primaryMachineHeight = Number(primaryMachineProfile?.altoUtilCm) || 0
  const primaryMachineGap = 0

  const planchaCostConfigured = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p] as const))
    let total = 0
    for (let i = 0; i < selectedPlanchaProfileIds.length; i++) {
      const id = String(selectedPlanchaProfileIds[i] || "").trim()
      if (!id) continue
      const profile = byId.get(id)
      if (!profile) continue
      const rawQty = String(selectedPlanchaProfileQtys[i] ?? "1")
      const qty = Math.max(1, Math.trunc(parseFloat(rawQty) || 0) || 1)
      total += (Number(profile.costoPlanchaPorColor) || 0) * qty
    }
    return total
  }, [profiles, selectedPlanchaProfileIds, selectedPlanchaProfileQtys])
  const tintaCostConfigured = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p] as const))
    let total = 0
    for (let i = 0; i < selectedTintaProfileIds.length; i++) {
      const id = String(selectedTintaProfileIds[i] || "").trim()
      if (!id) continue
      const profile = byId.get(id)
      if (!profile) continue
      const rawQty = String(selectedTintaProfileQtys[i] ?? "1")
      const qty = Math.max(1, Math.trunc(parseFloat(rawQty) || 0) || 1)
      total += (Number(profile.costoTintaPorColor) || 0) * qty
    }
    return total
  }, [profiles, selectedTintaProfileIds, selectedTintaProfileQtys])

  const selectedFinishes = useMemo(() => {
    const byId = new Map(finishes.map((f) => [f.id, f] as const))
    return selectedFinishIds
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .map((id) => byId.get(id))
        .filter((f): f is FinishOption => f != null && !f.especial)
  }, [finishes, selectedFinishIds])

  const selectedFinishesCost = useMemo(() => {
    return selectedFinishes.reduce((acc, f) => acc + (Number(f.valor) || 0), 0)
  }, [selectedFinishes])

  const selectedSpecialFinishNames = useMemo(() => {
    if (!specialFinishRows.length) return [] as string[]
    const byId = new Map(finishes.filter((f) => Boolean(f.especial)).map((f) => [f.id, f.nombre] as const))
    const names = specialFinishRows
      .map((row) => byId.get(String(row.finishId || "").trim()) || "")
      .map((x) => String(x || "").trim())
      .filter(Boolean)
    return Array.from(new Set(names))
  }, [finishes, specialFinishRows])

  const specialFinishesCost = useMemo(() => {
    if (!specialFinishRows.length) return 0
    const byId = new Map(finishes.filter((f) => Boolean(f.especial)).map((f) => [f.id, f] as const))
    const qtyById = new Map<string, number>()
    for (const row of specialFinishRows) {
      const finishId = String(row.finishId || "").trim()
      if (!finishId) continue
      const rawQty = String(row.qty ?? "0")
      const qty = Math.max(0, Math.trunc(parseFloat(rawQty) || 0))
      if (qty <= 0) continue
      qtyById.set(finishId, (qtyById.get(finishId) ?? 0) + qty)
    }
    let total = 0
    for (const [finishId, qty] of qtyById.entries()) {
      const f = byId.get(finishId)
      if (!f) continue
      total += (Number(f.valor) || 0) * qty
    }
    return total
  }, [finishes, specialFinishRows])

  const aiDraftId = props.aiDraft?.id ?? null
  const aiDraftEditId = props.edit?.itemId ?? null
  const sizeOptionsSignature = useMemo(
    () => sizeOptions.map((size) => `${size.key}:${size.widthCm}x${size.heightCm}`).join("|"),
    [sizeOptions],
  )
  const activePapersSignature = useMemo(
    () => activePapers.map((paper) => `${paper.id}:${paper.nombre}:${paper.gramaje ?? ""}`).join("|"),
    [activePapers],
  )
  const activeFinishesSignature = useMemo(
    () => activeFinishes.map((finish) => `${finish.id}:${finish.nombre}`).join("|"),
    [activeFinishes],
  )
  const transporteOptionsSignature = useMemo(
    () => transporteOptions.map((option) => `${option.value}:${option.total}`).join("|"),
    [transporteOptions],
  )
  const editorialOptionsSignature = useMemo(
    () => editorialOptions.map((option) => `${option.value}:${option.totalPaginas}`).join("|"),
    [editorialOptions],
  )

  useEffect(() => {
    if (!props.open) return
    if (!selectedMachineProfileId && activePlanchaProfiles.length) {
      setSelectedMachineProfileId(activePlanchaProfiles[0]!.id)
    }
  }, [props.open, activePlanchaProfiles, selectedMachineProfileId])

  useEffect(() => {
    if (!props.open) return
    if (!primaryPlanchaProfileId && activePlanchaProfiles.length) {
      setSelectedPlanchaProfileIds([activePlanchaProfiles[0]!.id])
      setSelectedPlanchaProfileQtys(["1"])
    }
  }, [props.open, activePlanchaProfiles, primaryPlanchaProfileId])

  useEffect(() => {
    if (!props.open) return
    if (!primaryTintaProfileId && activeTintaProfiles.length) {
      setSelectedTintaProfileIds([activeTintaProfiles[0]!.id])
      setSelectedTintaProfileQtys(["1"])
    }
  }, [props.open, activeTintaProfiles, primaryTintaProfileId])

  useEffect(() => {
    if (!props.open) return
    if (!sizeOptions.length) {
      if (formatoKey && formatoKey !== CUSTOM_PRINT_SIZE_KEY) setFormatoKey("")
      return
    }
    if (formatoKey === CUSTOM_PRINT_SIZE_KEY) return
    const exists = sizeOptions.some((p) => p.key === formatoKey)
    if (exists) return
    const first = sizeOptions[0]
    if (!first) return
    setFormatoKey(first.key)
  }, [props.open, sizeOptions, formatoKey])

  useEffect(() => {
    if (!props.open) return
    if (!primaryPaperId && activePapers.length) {
      setPaperRows([{ paperId: activePapers[0]!.id, qty: "1", formatoKey: "" }])
    }
  }, [props.open, activePapers, primaryPaperId])

  useEffect(() => {
    if (!props.open) return
    if (!editorialMode) return

    if (activePlanchaProfiles.length) {
      setEditorialCover((prev) => createNormalizedEditorialPart("cover", prev.machineProfileId || prev.planchaProfileIds[0]
        ? prev
        : {
          ...prev,
          machineProfileId: activePlanchaProfiles[0]!.id,
          planchaProfileIds: [activePlanchaProfiles[0]!.id],
          planchaProfileQtys: ["1"],
        }))
      setEditorialInner((prev) => createNormalizedEditorialPart("inner", prev.machineProfileId || prev.planchaProfileIds[0]
        ? prev
        : {
          ...prev,
          machineProfileId: activePlanchaProfiles[0]!.id,
          planchaProfileIds: [activePlanchaProfiles[0]!.id],
          planchaProfileQtys: ["1"],
        }))
    }
    if (activeTintaProfiles.length) {
      setEditorialCover((prev) => createNormalizedEditorialPart("cover", prev.tintaProfileIds[0]
        ? prev
        : {
          ...prev,
          tintaProfileIds: [activeTintaProfiles[0]!.id],
          tintaProfileQtys: ["1"],
        }))
      setEditorialInner((prev) => createNormalizedEditorialPart("inner", prev.tintaProfileIds[0]
        ? prev
        : {
          ...prev,
          tintaProfileIds: [activeTintaProfiles[0]!.id],
          tintaProfileQtys: ["1"],
        }))
    }
    if (activePapers.length) {
      setEditorialCover((prev) => (prev.paperId ? prev : { ...prev, paperId: activePapers[0]!.id }))
      setEditorialInner((prev) => (prev.paperId ? prev : { ...prev, paperId: activePapers[0]!.id }))
    }
  }, [props.open, editorialMode, activePlanchaProfiles, activeTintaProfiles, activePapers])

  useEffect(() => {
    if (!props.open) return
    if (props.edit) return
    if (!props.aiDraft) return
    if (appliedAiDraftIdRef.current === props.aiDraft.id) return
    if (!sizeOptions.length && !activePapers.length && !activeFinishes.length) return

    const draft = props.aiDraft
    const matchingSource = normalizeAiDraftText(`${draft.quoteType || ""} ${draft.brief || ""} ${draft.material || ""}`)
    const editorialDraft = isEditorialAiDraft(draft)

    if (editorialDraft) {
      setQuoteMode("editorial")
      if ((draft.paginas ?? 0) > 0) {
        setEditorialTotalPaginas(String(draft.paginas))
      }

      if (!editorialOptions.length) {
        return
      }

      const bestEditorialOption = findBestEditorialOptionFromDraft(draft, editorialOptions)
      if (bestEditorialOption) {
        setSelectedEditorialProductoKey(bestEditorialOption.value)
      }
    } else {
      setQuoteMode("normal")
      setSelectedEditorialProductoKey("")
    }

    if (draft.brief.trim()) {
      setDescripcion(draft.brief.trim())
    }

    if (draft.cantidad && draft.cantidad > 0) {
      setCantidad(String(draft.cantidad))
    }

    const matchedSize = findBestAiDraftSizeMatch(matchingSource, draft.anchoCm, draft.altoCm, sizeOptions)
    if (matchedSize?.kind === "preset") {
      setFormatoKey(matchedSize.key)
      setCustomFormatoWidthCm("")
      setCustomFormatoHeightCm("")
    } else if (matchedSize?.kind === "custom") {
      setFormatoKey(CUSTOM_PRINT_SIZE_KEY)
      setCustomFormatoWidthCm(String(matchedSize.widthCm))
      setCustomFormatoHeightCm(String(matchedSize.heightCm))
    }

    if (!matchedSize && typeof draft.anchoCm === "number" && typeof draft.altoCm === "number") {
      setFormatoKey(CUSTOM_PRINT_SIZE_KEY)
      setCustomFormatoWidthCm(String(draft.anchoCm))
      setCustomFormatoHeightCm(String(draft.altoCm))
    }

    const inferredPaperType = inferAiDraftPaperType(draft.material)
    if (inferredPaperType) {
      setPapelTipo(inferredPaperType)
    }

    const normalizedMaterial = normalizeAiDraftText(draft.material)
    const requestedWeight = extractAiDraftWeight(normalizedMaterial)
    if (requestedWeight != null) {
      setSelectedPaperGramaje(String(requestedWeight))
    }

    const matchedPaper = findBestAiDraftPaperMatch(draft.material, activePapers)

    if (matchedPaper) {
      setPaperRows([{ paperId: matchedPaper.id, qty: "1", formatoKey: "" }])
      setSelectedPaperTipo(String(matchedPaper.tipo || "").trim())
      setSelectedPaperGramaje(matchedPaper.gramaje != null ? String(matchedPaper.gramaje) : "")
    }

    const normalizedFinish = normalizeAiDraftText(draft.acabado)
    if (normalizedFinish) {
      const matchedFinish = activeFinishes.find((finish) => {
        const haystack = normalizeAiDraftText(finish.nombre)
        return haystack.includes(normalizedFinish) || normalizedFinish.includes(haystack)
      })

      if (matchedFinish) {
        setSelectedFinishIds([matchedFinish.id])
      }
    }

    const normalizedEntrega = normalizeAiDraftText(draft.entrega)
    if (normalizedEntrega) {
      const matchedTransport = transporteOptions.find((option) => {
        const haystack = normalizeAiDraftText(`${option.value} ${option.label}`)
        return haystack.includes(normalizedEntrega) || normalizedEntrega.includes(haystack)
      })
      if (matchedTransport) {
        setSelectedTransporteKey(matchedTransport.value)
      }
    }

    appliedAiDraftIdRef.current = draft.id
    setAppliedAiDraftId(draft.id)
  }, [props.open, aiDraftEditId, aiDraftId, sizeOptionsSignature, activePapersSignature, activeFinishesSignature, transporteOptionsSignature, editorialOptionsSignature])

  useEffect(() => {
    if (!props.open) return
    const load = async () => {
      setTransporteOptionsLoading(true)
      setEditorialOptionsLoading(true)
      try {
        const res = await fetch("/api/configuracion/dropdowns?includeItems=1", { cache: "no-store" })
        const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
        const dropdowns = Array.isArray(env.data) ? (env.data as Array<{ key?: unknown; items?: unknown }>) : []
        const transporte = dropdowns.find((d) => String(d.key || "") === CUSTOM_DROPDOWN_KEYS.transporte) || null
        const items = transporte && Array.isArray(transporte.items) ? transporte.items : []

        const mapped = items
          .filter((it) => isRecord(it) && Boolean(it.activo))
          .map((it) => {
            const value = String(it.value || "").trim()
            const label = String(it.label || value).trim() || value
            const total = Math.max(0, metaNumber(it.meta, "total") ?? 0)
            return value ? { value, label, total } : null
          })
          .filter(Boolean) as Array<{ value: string; label: string; total: number }>

        setTransporteOptions(mapped.sort((a, b) => a.label.localeCompare(b.label)))

        const editorial = dropdowns.find((d) => String(d.key || "") === CUSTOM_DROPDOWN_KEYS.editorialProducto) || null
        const editorialItems = editorial && Array.isArray(editorial.items) ? editorial.items : []
        const mappedEditorial = editorialItems
          .filter((it) => isRecord(it) && Boolean(it.activo))
          .map((it) => {
            const value = String(it.value || "").trim()
            const label = String(it.label || value).trim() || value
            const meta = it.meta
            const totalPaginas = Math.max(0, Math.trunc(metaNumber(meta, "totalPaginas") ?? 0))
            const paginasPortadaContraportada = Math.max(0, Math.trunc(metaNumber(meta, "paginasPortadaContraportada") ?? 0))
            const cartasPorPlancha = Math.max(1, Math.trunc(metaNumber(meta, "cartasPorPlancha") ?? 2))
            const paginasPorPliego = Math.max(1, Math.trunc(metaNumber(meta, "paginasPorPliego") ?? 4))
            return value ? { value, label, totalPaginas, paginasPortadaContraportada, cartasPorPlancha, paginasPorPliego } : null
          })
          .filter(Boolean) as Array<{
            value: string
            label: string
            totalPaginas: number
            paginasPortadaContraportada: number
            cartasPorPlancha: number
            paginasPorPliego: number
          }>

        setEditorialOptions(mappedEditorial.sort((a, b) => a.label.localeCompare(b.label)))
      } catch {
        setTransporteOptions([])
        setEditorialOptions([])
      } finally {
        setTransporteOptionsLoading(false)
        setEditorialOptionsLoading(false)
      }
    }

    void load()
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    const opt = transporteOptions.find((o) => o.value === selectedTransporteKey) || null
    const next = opt ? String(opt.total) : "0"
    if (costoTransporte !== next) setCostoTransporte(next)
  }, [props.open, selectedTransporteKey, costoTransporte, transporteOptions])

  useEffect(() => {
    if (!props.open) return
    if (!selectedEditorialProductoKey) return
    const opt = editorialOptions.find((o) => o.value === selectedEditorialProductoKey) || null
    if (!opt) return
    setEditorialTotalPaginas(String(opt.totalPaginas || 32))
    setEditorialPaginasPortadaContraportada(String(opt.paginasPortadaContraportada || 0))
    setEditorialCartasPorPlancha(String(opt.cartasPorPlancha || 2))
    setEditorialPaginasPorPliego(String(opt.paginasPorPliego || 4))
  }, [props.open, selectedEditorialProductoKey, editorialOptions])

  const editorialSplitCalc = useMemo(() => {
    if (!props.open) return null
    if (!selectedEditorialProductoKey) return null

    const totalPaginas = Math.max(0, Math.trunc(parseFloat(editorialTotalPaginas) || 0))
    const coverPaginas = Math.max(0, Math.trunc(parseFloat(editorialPaginasPortadaContraportada) || 0))
    const paginasPorPliego = Math.max(1, Math.trunc(parseFloat(editorialPaginasPorPliego) || 0))

    // Nota: el selector Frente/Reverso ajusta automáticamente multiplicadores y sobrante mínimo.
    // En Editorial, puedes seguir ajustando manualmente “Cantidad” en Plancha/Tinta si lo necesitas.
    const innerPliegosPorUnidad = computeEditorialSheetsPerUnit(totalPaginas, paginasPorPliego, editorialInner.printInkBack)
    const coverPliegosPorUnidad = computeEditorialSheetsPerUnit(coverPaginas, paginasPorPliego, editorialCover.printInkBack)
    const innerPlanchas = totalPaginas > 0 ? 1 : 0
    const coverPlanchas = coverPaginas > 0 ? 1 : 0

    return {
      innerPlanchas,
      coverPlanchas,
      innerPliegosPorUnidad,
      coverPliegosPorUnidad,
    }
  }, [
    props.open,
    selectedEditorialProductoKey,
    editorialTotalPaginas,
    editorialPaginasPortadaContraportada,
    editorialPaginasPorPliego,
    editorialInner.printInkBack,
    editorialCover.printInkBack,
  ])

  const editorialInnerCompaginadoQty = useMemo(() => {
    if (!editorialEnabled) return 0
    const runQty = Math.max(0, Math.trunc(parseFloat(cantidad) || 0))
    const hojasInternasPorUnidad = Math.max(0, Math.ceil((Math.max(0, Math.trunc(parseFloat(editorialTotalPaginas) || 0))) / 2))
    if (runQty <= 0 || hojasInternasPorUnidad <= 0) return 0
    return runQty * hojasInternasPorUnidad
  }, [cantidad, editorialEnabled, editorialTotalPaginas])

  useEffect(() => {
    if (!props.open) return

    setSelectedFinishIds((prev) => {
      const next = prev.filter((id) => {
        const finish = finishes.find((item) => item.id === String(id || "").trim())
        return !finish || !isTroquelLikeFinish(finish)
      })
      return next.length ? next : [""]
    })

    setSpecialFinishRows((prev) => {
      const next = prev.filter((row) => {
        const finish = finishes.find((item) => item.id === String(row.finishId || "").trim())
        return !finish || !isTroquelLikeFinish(finish)
      })
      return next.length ? next : [{ finishId: "", qty: "1" }]
    })
  }, [props.open, finishes])

  useEffect(() => {
    if (!props.open || !editorialEnabled || !isEditorialCartilla) return

    setEditorialCover((prev) => {
      if (!compaginadoFinish || prev.finishId !== compaginadoFinish.id) return prev
      return { ...prev, finishId: "" }
    })

    if (!compaginadoFinish) return

    setEditorialInner((prev) => {
      if (String(prev.finishId || "").trim()) return prev
      return { ...prev, finishId: compaginadoFinish.id }
    })
  }, [props.open, editorialEnabled, isEditorialCartilla, compaginadoFinish])

  const computeEditorialSheetsPreview = useCallback((partKey: "cover" | "inner", part: EditorialPartState, pliegosPorUnidad: number) => {
    const runQty = Math.max(0, Math.trunc(parseFloat(cantidad) || 0))
    if (runQty <= 0) return null
    const paper = papers.find((p) => p.id === String(part.paperId || "").trim()) || null
    if (!paper) return null
    const preset = resolveEditorialPartSizeOption(part)
    if (!preset) return null
    const machineProfile = profiles.find((p) => p.id === String(part.machineProfileId || part.planchaProfileId || "").trim()) || null

    const sobranteDefault = parseFloat(sobranteMinimo) || 0
    const sobranteLocal = parseFloat(String(part.sobranteMinimo))
    const sobranteInput = Number.isFinite(sobranteLocal) ? sobranteLocal : sobranteDefault

    const qtyForCompute = computeEditorialProductionQty({
      runQty,
      pliegosPorUnidad,
      partKey,
      piezasFinalesPorHojaAbierta: editorialFoldParts,
    })
    const r = computeLitografia({
      cantidad: qtyForCompute,
      colores: 1,
      desperdicioPct: 0,
      sobranteMinimo: sobranteInput,
      sobranteMinimoUnidad: "hoja_maquina",
      costoPlanchaPorColor: 0,
      costoTintaPorColor: 0,
      costoPapelUnidad: 0,
      papelModo: "pliego",
      papelTipo: "otro",
      papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
      papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
      papelFormatoWidthCm: preset.widthCm ?? 0,
      papelFormatoHeightCm: preset.heightCm ?? 0,
      maquinaPliegoWidthCm: Number(machineProfile?.anchoUtilCm) || 0,
      maquinaPliegoHeightCm: Number(machineProfile?.altoUtilCm) || 0,
      maquinaSeparacionCm: 0,
      costoPliego: 1,
      costoCorte: 0,
      costoAcabados: 0,
      costoTransporte: 0,
      margenPct: 0,
    })

    return {
      runQty,
      pliegosPorUnidad: Math.max(1, Math.trunc(Number(pliegosPorUnidad) || 0) || 1),
      qtyForCompute,
      sobranteInput,
      sobranteUnidad: "hoja_maquina" as const,
      sobrantePiezas: r.sobranteMinimo,
      paperLabel: `${paper.nombre}${paper.gramaje ? ` ${paper.gramaje}g` : ""} • ${formatCm(paper.pliegoWidthCm)}×${formatCm(paper.pliegoHeightCm)} cm`,
      formatLabel: `${preset.nombre} (${formatCm(preset.widthCm)}×${formatCm(preset.heightCm)} cm)`,
      machineLabel: machineProfile
        ? `${machineProfile.nombre} (${formatCm(machineProfile.anchoUtilCm)}×${formatCm(machineProfile.altoUtilCm)} cm)`
        : "Maquina sin perfil",
      sheetWidthCm: paper.pliegoWidthCm ?? 0,
      sheetHeightCm: paper.pliegoHeightCm ?? 0,
      machineSheetWidthCm: r.hojaMaquinaWidthCm ?? (Number(machineProfile?.anchoUtilCm) || 0),
      machineSheetHeightCm: r.hojaMaquinaHeightCm ?? (Number(machineProfile?.altoUtilCm) || 0),
      utilWidthCm: Number(machineProfile?.anchoUtilCm) || paper.pliegoWidthCm || 0,
      utilHeightCm: Number(machineProfile?.altoUtilCm) || paper.pliegoHeightCm || 0,
      pieceWidthCm: preset.widthCm ?? 0,
      pieceHeightCm: preset.heightCm ?? 0,
      piezasPorPliego: r.piezasPorPliego,
      pliegosNecesarios: r.pliegosNecesarios,
      piezasPorHojaMaquina: r.piezasPorHojaMaquina,
      hojasMaquinaPorPliego: r.hojasMaquinaPorPliego,
      hojasMaquinaNecesarias: r.hojasMaquinaNecesarias,
      hojasMaquinaHorizontal: r.hojasMaquinaHorizontal,
      hojasMaquinaVertical: r.hojasMaquinaVertical,
      piezasHorizontal: r.piezasHorizontal,
      piezasVertical: r.piezasVertical,
      piezasHojaMaquinaHorizontal: r.piezasHojaMaquinaHorizontal,
      piezasHojaMaquinaVertical: r.piezasHojaMaquinaVertical,
      orientacionImpresion: r.orientacionImpresion,
      orientacionCorte: r.orientacionCorte,
    }
  }, [cantidad, papers, profiles, sobranteMinimo, resolveEditorialPartSizeOption, editorialFoldParts])

  const editorialCoverSheetsPreview = useMemo(() => {
    if (!editorialEnabled) return null
    const pliegos = editorialSplitCalc?.coverPliegosPorUnidad ?? 0
    return computeEditorialSheetsPreview("cover", editorialCover, pliegos)
  }, [editorialEnabled, editorialSplitCalc?.coverPliegosPorUnidad, computeEditorialSheetsPreview, editorialCover])

  const editorialInnerSheetsPreview = useMemo(() => {
    if (!editorialEnabled) return null
    const pliegos = editorialSplitCalc?.innerPliegosPorUnidad ?? 0
    return computeEditorialSheetsPreview("inner", editorialInner, pliegos)
  }, [editorialEnabled, editorialSplitCalc?.innerPliegosPorUnidad, computeEditorialSheetsPreview, editorialInner])

  const editorialCoverPreset = useMemo(
    () => resolveEditorialPartSizeOption(editorialCover),
    [editorialCover, resolveEditorialPartSizeOption]
  )

  const editorialInnerPreset = useMemo(
    () => resolveEditorialPartSizeOption(editorialInner),
    [editorialInner, resolveEditorialPartSizeOption]
  )

  const editorialCoverPlanchaProfile = useMemo(
    () => profiles.find((p) => p.id === String(editorialCover.machineProfileId || editorialCover.planchaProfileId || "").trim()) || null,
    [editorialCover.machineProfileId, editorialCover.planchaProfileId, profiles]
  )

  const editorialInnerPlanchaProfile = useMemo(
    () => profiles.find((p) => p.id === String(editorialInner.machineProfileId || editorialInner.planchaProfileId || "").trim()) || null,
    [editorialInner.machineProfileId, editorialInner.planchaProfileId, profiles]
  )

  const editorialCoverPaper = useMemo(
    () => papers.find((p) => p.id === String(editorialCover.paperId || "").trim()) || null,
    [editorialCover.paperId, papers]
  )

  const editorialInnerPaper = useMemo(
    () => papers.find((p) => p.id === String(editorialInner.paperId || "").trim()) || null,
    [editorialInner.paperId, papers]
  )

  const editorialTotalCustomerPages = useMemo(() => {
    const innerPages = Math.max(0, Math.trunc(parseFloat(editorialTotalPaginas) || 0))
    const coverPages = Math.max(0, Math.trunc(parseFloat(editorialPaginasPortadaContraportada) || 0))
    return innerPages + coverPages
  }, [editorialPaginasPortadaContraportada, editorialTotalPaginas])

  const editorialOpenSize = useMemo(() => {
    return editorialCoverPreset || editorialInnerPreset || null
  }, [editorialCoverPreset, editorialInnerPreset])

  const editorialPrimaryPlanchaProfile = editorialCoverPlanchaProfile || editorialInnerPlanchaProfile || null

  const editorialClosedSize = useMemo(() => {
    if (editorialFinalPreset) {
      return {
        widthCm: editorialFinalPreset.widthCm,
        heightCm: editorialFinalPreset.heightCm,
      }
    }
    return null
  }, [editorialFinalPreset])

  const editorialClosedSizeName = useMemo(() => {
    if (editorialFinalPreset?.nombre) return editorialFinalPreset.nombre
    if (!editorialClosedSize) return null
    return findSizeNameByDimensions(sizeOptions, editorialClosedSize.widthCm, editorialClosedSize.heightCm)
  }, [editorialFinalPreset, editorialClosedSize, sizeOptions])

  const editorialOpenSizeLabel = useMemo(() => {
    const coverLabel = editorialCoverPreset
      ? `Portada ${editorialCoverPreset.nombre} (${formatCm(editorialCoverPreset.widthCm)}×${formatCm(editorialCoverPreset.heightCm)} cm)`
      : null
    const innerLabel = editorialInnerPreset
      ? `Internas ${editorialInnerPreset.nombre} (${formatCm(editorialInnerPreset.widthCm)}×${formatCm(editorialInnerPreset.heightCm)} cm)`
      : null
    if (coverLabel && innerLabel) {
      if (
        nearlyEqualCm(editorialCoverPreset!.widthCm, editorialInnerPreset!.widthCm) &&
        nearlyEqualCm(editorialCoverPreset!.heightCm, editorialInnerPreset!.heightCm)
      ) {
        return `${editorialCoverPreset!.nombre} (${formatCm(editorialCoverPreset!.widthCm)}×${formatCm(editorialCoverPreset!.heightCm)} cm)`
      }
      return `${coverLabel} • ${innerLabel}`
    }
    return coverLabel || innerLabel
  }, [editorialCoverPreset, editorialInnerPreset])

  const editorialClosedSizeLabel = useMemo(() => {
    if (!editorialClosedSize) return null
    const name = editorialClosedSizeName ? `${editorialClosedSizeName} ` : ""
    return `${name}(${formatCm(editorialClosedSize.widthCm)}×${formatCm(editorialClosedSize.heightCm)} cm)`
  }, [editorialClosedSize, editorialClosedSizeName])

  useEffect(() => {
    if (!props.open) return
    if (!selectedEditorialProductoKey) return
    if (String(editorialFinalFormatoKey || "").trim()) return
    const nextFinalKey = editorialQuickFormats[0]?.key || sizeOptions[0]?.key || ""
    if (nextFinalKey) setEditorialFinalFormatoKey(nextFinalKey)
  }, [props.open, selectedEditorialProductoKey, editorialFinalFormatoKey, editorialQuickFormats, sizeOptions])

  useEffect(() => {
    if (!props.open) return
    if (!selectedEditorialProductoKey) return

    const defaultPaperId = activePapers[0]?.id || ""
    const defaultFormatoKey = editorialRecommendedOpenPreset?.key || editorialQuickFormats[0]?.key || sizeOptions[0]?.key || ""
    const defaults = editorialSplitCalc

    setEditorialCover((prev) => {
      const next: EditorialPartState = { ...prev }
      if (!String(next.paperId || "").trim()) next.paperId = defaultPaperId
      if (!String(next.formatoKey || "").trim()) next.formatoKey = defaultFormatoKey
      if (!String(next.sobranteMinimo || "").trim()) next.sobranteMinimo = sobranteMinimo
      if (!String(next.machineProfileId || "").trim()) next.machineProfileId = activePlanchaProfiles[0]?.id || ""
      if (!String(next.planchaProfileIds[0] || "").trim()) next.planchaProfileIds = [activePlanchaProfiles[0]?.id || ""]
      if (!String(next.tintaProfileIds[0] || "").trim()) next.tintaProfileIds = [activeTintaProfiles[0]?.id || ""]
      if (!String(next.planchas || "").trim() && defaults) next.planchas = String(defaults.coverPlanchas || 0)
      next.desperdicioPct = "0"
      return createNormalizedEditorialPart("cover", next)
    })

    setEditorialInner((prev) => {
      const next: EditorialPartState = { ...prev }
      if (!String(next.paperId || "").trim()) next.paperId = defaultPaperId
      if (!String(next.formatoKey || "").trim()) next.formatoKey = defaultFormatoKey
      if (!String(next.sobranteMinimo || "").trim()) next.sobranteMinimo = sobranteMinimo
      if (!String(next.machineProfileId || "").trim()) next.machineProfileId = activePlanchaProfiles[0]?.id || ""
      if (!String(next.planchaProfileIds[0] || "").trim()) next.planchaProfileIds = [activePlanchaProfiles[0]?.id || ""]
      if (!String(next.tintaProfileIds[0] || "").trim()) next.tintaProfileIds = [activeTintaProfiles[0]?.id || ""]
      if (!String(next.planchas || "").trim() && defaults) next.planchas = String(defaults.innerPlanchas || 0)
      if (next.printInkFront === "4" && next.printInkBack === "1") next.printInkBack = "4"
      next.desperdicioPct = "0"
      return createNormalizedEditorialPart("inner", next)
    })
  }, [props.open, selectedEditorialProductoKey, editorialSplitCalc, activePapers, activePlanchaProfiles, activeTintaProfiles, sobranteMinimo, editorialQuickFormats, sizeOptions, editorialRecommendedOpenPreset])

  useEffect(() => {
    const load = async () => {
      setConfigError(null)
      setPricingError(null)
      setAttemptedSubmit(false)
      try {
        const [meRes, r1, r2, r3] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/litografia/perfiles", { cache: "no-store" }),
          fetch("/api/litografia/papeles", { cache: "no-store" }),
          fetch("/api/litografia/acabados", { cache: "no-store" }),
        ])
        const meEnv = asApiEnvelope((await meRes.json().catch(() => null)) as unknown)
        const meData = (meEnv.data && typeof meEnv.data === "object" ? (meEnv.data as Record<string, unknown>) : {})
        const role = String(meData.role || "").toUpperCase()
        setIsAdmin(role === "ADMIN")
        setCanConfigWrite(Boolean(meData.canConfigWrite))
        setMeLoaded(true)

        const env1 = asApiEnvelope((await r1.json().catch(() => null)) as unknown)
        const env2 = asApiEnvelope((await r2.json().catch(() => null)) as unknown)
        const env3 = asApiEnvelope((await r3.json().catch(() => null)) as unknown)
        if (r1.ok && env1.ok === true) setProfiles(Array.isArray(env1.data) ? (env1.data as PrintProfile[]) : [])
        if (r2.ok && env2.ok === true) setPapers(Array.isArray(env2.data) ? (env2.data as PaperRate[]) : [])
        if (r3.ok && env3.ok === true) setFinishes(Array.isArray(env3.data) ? (env3.data as FinishOption[]) : [])

        const sizesRes = await fetch("/api/litografia/tamanos", { cache: "no-store" })
        const sizesEnv = asApiEnvelope((await sizesRes.json().catch(() => null)) as unknown)
        if (sizesRes.ok && sizesEnv.ok === true) setSizes(Array.isArray(sizesEnv.data) ? (sizesEnv.data as PrintSize[]) : [])
      } catch (e) {
        setConfigError(e instanceof Error ? e.message : t('printshopQuote.errors.loadConfigFailed'))
        setMeLoaded(true)
      }
    }

    if (props.open) void load()
  }, [props.open, language, t])

  useEffect(() => {
    setCostoPlanchaPorColor(String(planchaCostConfigured || 0))
  }, [planchaCostConfigured])

  useEffect(() => {
    setCostoTintaPorColor(String(tintaCostConfigured || 0))
  }, [tintaCostConfigured])

  useEffect(() => {
    const paper = papers.find((p) => p.id === primaryPaperId)
    if (!paper) return
    setPapelPorPliego(true)
    setCostoPliego(String(paper.costoPliego ?? 0))
    setPliegoW(String(paper.pliegoWidthCm ?? 70))
    setPliegoH(String(paper.pliegoHeightCm ?? 100))

    setSelectedPaperTipo(String(paper.tipo || "").trim())
    setSelectedPaperGramaje(paper.gramaje != null ? String(paper.gramaje) : "")

    const t = (paper.tipo || "").toLowerCase()
    if (t.includes("bond")) setPapelTipo("bond")
    else if (t.includes("propal") || t.includes("cote") || t.includes("couche")) setPapelTipo("propalcote")
    else if (t.includes("period")) setPapelTipo("periodico")
    else setPapelTipo("otro")

    setSobranteMinimo((prev) => (String(prev || "").trim() ? prev : "100"))
  }, [papers, primaryPaperId])

  const calc = useMemo<LitografiaResult | null>(() => {
    if (!isAdmin) return null
    const qtyBase = parseFloat(cantidad) || 0
    const sobrante = parseFloat(sobranteMinimo) || 0

    if (editorialEnabled) {
      const defaults = editorialSplitCalc
      if (!defaults) return null

      const profileById = new Map(profiles.map((p) => [p.id, p] as const))

      const transporte = parseFloat(costoTransporte) || 0

      const inferPapelTipo = (paperTipoRaw: string | null | undefined): PapelTipo => {
        const tt = String(paperTipoRaw || "").toLowerCase()
        if (tt.includes("bond")) return "bond"
        if (tt.includes("propal") || tt.includes("cote") || tt.includes("couche")) return "propalcote"
        if (tt.includes("period")) return "periodico"
        return "otro"
      }

      const computePart = (
        partKey: "cover" | "inner",
        part: EditorialPartState,
        pliegosPorUnidad: number,
        planchasPorUnidad: number
      ) => {
        const runQty = Math.max(0, Math.trunc(qtyBase))
        if (runQty <= 0) return null
        const paper = papers.find((p) => p.id === String(part.paperId || "").trim()) || null
        if (!paper) return null

        const preset = resolveEditorialPartSizeOption(part)
        if (!preset) return null

        const machineProfile = part.machineProfileId ? profileById.get(String(part.machineProfileId || "").trim()) || null : null
        const planchaCostPorColor = part.planchaProfileIds.reduce((total, id, index) => {
          const profile = profileById.get(String(id || "").trim())
          if (!profile) return total
          const qty = Math.max(1, Math.trunc(parseFloat(String(part.planchaProfileQtys[index] || "1")) || 0) || 1)
          return total + ((Number(profile.costoPlanchaPorColor) || 0) * qty)
        }, 0)
        const tintaCostPorColor = part.tintaProfileIds.reduce((total, id, index) => {
          const profile = profileById.get(String(id || "").trim())
          if (!profile) return total
          const qty = Math.max(1, Math.trunc(parseFloat(String(part.tintaProfileQtys[index] || "1")) || 0) || 1)
          return total + ((Number(profile.costoTintaPorColor) || 0) * qty)
        }, 0)

        const tintasLocal: 1 | 2 | 4 = 4
        const planchasLocal = Math.max(0, Math.trunc(Number(planchasPorUnidad) || 0))
        const sobranteLocal = parseFloat(String(part.sobranteMinimo))

        const finish = part.finishId ? finishes.find((f) => f.id === part.finishId) || null : null
        const finishMultiplier = finish && partKey === "inner" && isCompaginadoFinish(finish)
          ? Math.max(1, editorialInnerCompaginadoQty)
          : 1
        const finishesCost = finish && !finish.especial && getGrupo(finish) === "ACABADO"
          ? (Number(finish.valor) || 0) * finishMultiplier
          : 0

        const special = part.specialFinishId ? finishes.find((f) => f.id === part.specialFinishId) || null : null
        const specialQty = Math.max(0, Math.trunc(parseFloat(String(part.specialFinishQty)) || 0))
        const specialCost = special && Boolean(special.especial) ? (Number(special.valor) || 0) * specialQty : 0

        const plast = part.plastificadoId ? finishes.find((f) => f.id === part.plastificadoId) || null : null
        const plastQty = Math.max(1, Math.trunc(parseFloat(String(part.plastificadoQty)) || 0) || 1)
        const plastCost = plast && getGrupo(plast) === "PLASTIFICADO" ? (Number(plast.valor) || 0) * plastQty : 0

        const troq = part.troqueladoId ? finishes.find((f) => f.id === part.troqueladoId) || null : null
        const troqQty = Math.max(1, Math.trunc(parseFloat(String(part.troqueladoQty)) || 0) || 1)
        const troqCost = troq && getGrupo(troq) === "TROQUELADO" ? (Number(troq.valor) || 0) * troqQty : 0

        const troquelada = part.troqueladaId ? finishes.find((f) => f.id === part.troqueladaId) || null : null
        const troqueladaQty = Math.max(1, Math.trunc(parseFloat(String(part.troqueladaQty)) || 0) || 1)
        const troqueladaCost = troquelada && getGrupo(troquelada) === "TROQUELADO" ? (Number(troquelada.valor) || 0) * troqueladaQty : 0

        const corteOpt = part.corteId ? finishes.find((f) => f.id === part.corteId) || null : null
        const corteQtyLocal = Math.max(1, Math.trunc(parseFloat(String(part.corteQty)) || 0) || 1)
        const corteCostLocal = corteOpt && getGrupo(corteOpt) === "CORTE" ? (Number(corteOpt.valor) || 0) * corteQtyLocal : 0

        const qtyForCompute = computeEditorialProductionQty({
          runQty,
          pliegosPorUnidad,
          partKey,
          piezasFinalesPorHojaAbierta: editorialFoldParts,
        })
        return computeLitografia({
          cantidad: qtyForCompute,
          colores: tintasLocal,
          desperdicioPct: 0,
          sobranteMinimo: Number.isFinite(sobranteLocal) ? sobranteLocal : sobrante,
          sobranteMinimoUnidad: "hoja_maquina",
          costoPlanchaPorColor: toPerColorCost(((planchaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoTintaPorColor: toPerColorCost(((tintaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoPapelUnidad: 0,
          papelModo: "pliego",
          papelTipo: inferPapelTipo(paper.tipo),
          papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
          papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
          papelFormatoWidthCm: preset.widthCm ?? 0,
          papelFormatoHeightCm: preset.heightCm ?? 0,
          maquinaPliegoWidthCm: Number(machineProfile?.anchoUtilCm) || 0,
          maquinaPliegoHeightCm: Number(machineProfile?.altoUtilCm) || 0,
          maquinaSeparacionCm: 0,
          costoPliego: paper.costoPliego ?? 0,
          costoCorte: corteCostLocal,
          costoAcabados: finishesCost + specialCost + plastCost + troqCost + troqueladaCost,
          costoTransporte: 0,
          margenPct: 0,
        })
      }

      const cover = defaults.coverPliegosPorUnidad > 0
        ? computePart("cover", editorialCover, defaults.coverPliegosPorUnidad, defaults.coverPlanchas)
        : null
      const inner = defaults.innerPliegosPorUnidad > 0
        ? computePart("inner", editorialInner, defaults.innerPliegosPorUnidad, defaults.innerPlanchas)
        : null

      if (!cover && !inner) return null

      const plancha = (cover?.plancha ?? 0) + (inner?.plancha ?? 0)
      const tinta = (cover?.tinta ?? 0) + (inner?.tinta ?? 0)
      const papel = (cover?.papel ?? 0) + (inner?.papel ?? 0)
      const corte = (cover?.corte ?? 0) + (inner?.corte ?? 0)
      const acabados = (cover?.acabados ?? 0) + (inner?.acabados ?? 0)
      const costoProduccion = plancha + tinta + papel + corte + acabados + transporte
      const precioVenta = costoProduccion

      const qty = Math.max(1, Math.trunc(qtyBase) || 1)
      return {
        qty,
        k: 4,
        waste: Math.max(cover?.waste ?? 0, inner?.waste ?? 0),
        sobranteMinimo: Math.max(cover?.sobranteMinimo ?? 0, inner?.sobranteMinimo ?? 0),
        papelModo: "pliego",
        qtyConDesperdicio: (cover?.qtyConDesperdicio ?? 0) + (inner?.qtyConDesperdicio ?? 0),
        piezasPorPliego: (cover?.piezasPorPliego ?? inner?.piezasPorPliego) || undefined,
        pliegosNecesarios: ((cover?.pliegosNecesarios ?? 0) + (inner?.pliegosNecesarios ?? 0)) || undefined,
        plancha,
        tinta,
        papel,
        corte,
        acabados,
        transporte,
        costoProduccion,
        precioVenta,
        costoUnitario: costoProduccion / qty,
        precioUnitario: precioVenta / qty,
      } as LitografiaResult
    }

    const qtyForCompute = qtyBase
    const planchaCostForCompute = planchaCostConfigured
    const tintaCostForCompute = tintaCostConfigured

    const addAcabadosExtras = selectedFinishesCost + specialFinishesCost + plastificadoCostTotal + troqueladoCostTotal + troqueladaCostTotal
    const addCorteExtra = corteCostTotal

    const base = computeLitografia({
      cantidad: qtyForCompute,
      colores: tintas,
      desperdicioPct: 0,
      sobranteMinimo: sobrante,
      sobranteMinimoUnidad: papelPorPliego ? "hoja_maquina" : "pieza_final",
      costoPlanchaPorColor: toPerColorCost(planchaCostForCompute, tintas),
      costoTintaPorColor: toPerColorCost(tintaCostForCompute, tintas),
      costoPapelUnidad: parseFloat(costoPapelUnidad) || 0,
      papelModo: papelPorPliego ? "pliego" : "unidad",
      papelTipo,
      papelPliegoWidthCm: parseFloat(pliegoW) || 0,
      papelPliegoHeightCm: parseFloat(pliegoH) || 0,
      papelFormatoWidthCm: selectedPreset?.widthCm ?? 0,
      papelFormatoHeightCm: selectedPreset?.heightCm ?? 0,
      maquinaPliegoWidthCm: primaryMachineWidth,
      maquinaPliegoHeightCm: primaryMachineHeight,
      maquinaSeparacionCm: primaryMachineGap,
      costoPliego: parseFloat(costoPliego) || 0,
      costoCorte: parseFloat(costoCorte) || 0,
      costoAcabados: parseFloat(costoAcabados) || 0,
      costoTransporte: parseFloat(costoTransporte) || 0,
      margenPct: 0,
    })

    const withExtras = (() => {
      const qty = Math.max(1, Math.trunc(base.qty) || 1)
      const corte = (base.corte || 0) + addCorteExtra
      const acabados = (base.acabados || 0) + addAcabadosExtras
      const transporte = base.transporte || 0
      const costoProduccion = (base.plancha || 0) + (base.tinta || 0) + (base.papel || 0) + corte + acabados + transporte
      const precioVenta = costoProduccion
      return {
        ...base,
        corte,
        acabados,
        costoProduccion,
        precioVenta,
        costoUnitario: costoProduccion / qty,
        precioUnitario: precioVenta / qty,
      } as LitografiaResult
    })()

    if (papelPorPliego && selectedPreset) {
      const byPaperId = new Map(papers.map((p) => [p.id, p] as const))
      const presetByKey = new Map(allSizeOptions.map((s) => [s.key, resolveSizeOption(s.key)] as const))

      const baseNoPaper = computeLitografia({
        cantidad: qtyForCompute,
        colores: tintas,
        desperdicioPct: 0,
        sobranteMinimo: sobrante,
        sobranteMinimoUnidad: "hoja_maquina",
        costoPlanchaPorColor: toPerColorCost(planchaCostForCompute, tintas),
        costoTintaPorColor: toPerColorCost(tintaCostForCompute, tintas),
        costoPapelUnidad: 0,
        papelModo: "pliego",
        papelTipo,
        papelPliegoWidthCm: (primaryPaper?.pliegoWidthCm ?? parseFloat(pliegoW)) || 0,
        papelPliegoHeightCm: (primaryPaper?.pliegoHeightCm ?? parseFloat(pliegoH)) || 0,
        papelFormatoWidthCm: selectedPreset.widthCm ?? 0,
        papelFormatoHeightCm: selectedPreset.heightCm ?? 0,
        maquinaPliegoWidthCm: primaryMachineWidth,
        maquinaPliegoHeightCm: primaryMachineHeight,
        maquinaSeparacionCm: primaryMachineGap,
        costoPliego: 0,
        costoCorte: parseFloat(costoCorte) || 0,
        costoAcabados: parseFloat(costoAcabados) || 0,
        costoTransporte: parseFloat(costoTransporte) || 0,
        margenPct: 0,
      })

      let paperTotal = 0
      for (let idx = 0; idx < paperRows.length; idx++) {
        const row = paperRows[idx]
        const paperId = String(row?.paperId || "").trim()
        if (!paperId) continue
        const paper = byPaperId.get(paperId)
        if (!paper) continue

        const rowPreset = idx === 0
          ? selectedPreset
          : (presetByKey.get(String(row.formatoKey || "").trim()) || selectedPreset)

        const rowQty = idx === 0 ? qtyForCompute : (parseFloat(String(row.qty || "0")) || 0)
        if (rowQty <= 0) continue

        const r = computeLitografia({
          cantidad: rowQty,
          colores: tintas,
          desperdicioPct: 0,
          sobranteMinimo: sobrante,
          sobranteMinimoUnidad: "hoja_maquina",
          costoPlanchaPorColor: 0,
          costoTintaPorColor: 0,
          costoPapelUnidad: 0,
          papelModo: "pliego",
          papelTipo,
          papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
          papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
          papelFormatoWidthCm: rowPreset?.widthCm ?? 0,
          papelFormatoHeightCm: rowPreset?.heightCm ?? 0,
          maquinaPliegoWidthCm: primaryMachineWidth,
          maquinaPliegoHeightCm: primaryMachineHeight,
          maquinaSeparacionCm: primaryMachineGap,
          costoPliego: paper.costoPliego ?? 0,
          costoCorte: 0,
          costoAcabados: 0,
          costoTransporte: 0,
          margenPct: 0,
        })
        paperTotal += r.papel
      }

      if (paperTotal > 0) {
        const qty = Math.max(1, Math.trunc(baseNoPaper.qty) || 1)
        const corte = (baseNoPaper.corte || 0) + addCorteExtra
        const acabados = (baseNoPaper.acabados || 0) + addAcabadosExtras
        const transporte = baseNoPaper.transporte || 0
        const costoProduccion = (baseNoPaper.plancha || 0) + (baseNoPaper.tinta || 0) + paperTotal + corte + acabados + transporte
        const precioVenta = costoProduccion
        return {
          ...baseNoPaper,
          papel: paperTotal,
          corte,
          acabados,
          costoProduccion,
          precioVenta,
          costoUnitario: costoProduccion / qty,
          precioUnitario: precioVenta / qty,
        } as LitografiaResult
      }
    }
    return withExtras
  }, [
    isAdmin,
    cantidad,
    editorialEnabled,
    editorialSplitCalc,
    editorialCover,
    editorialInner,
    sobranteMinimo,
    planchaCostConfigured,
    tintaCostConfigured,
    costoPapelUnidad,
    papelPorPliego,
    papelTipo,
    costoPliego,
    pliegoW,
    pliegoH,
    selectedPreset,
    costoCorte,
    costoAcabados,
    selectedFinishesCost,
    specialFinishesCost,
    plastificadoCostTotal,
    troqueladoCostTotal,
    troqueladaCostTotal,
    corteCostTotal,
    costoTransporte,
    paperRows,
    primaryPaper,
    primaryMachineWidth,
    primaryMachineHeight,
    primaryMachineGap,
    papers,
    profiles,
    finishes,
    sizeOptions,
    allSizeOptions,
    resolveSizeOption,
    editorialFoldParts,
    tintas,
  ])

  const fallbackCalc = useMemo<LitografiaResult | null>(() => {
    if (isAdmin) return null
    if (!props.open) return null

    const qty = Math.trunc(parseFloat(cantidad) || 0)
    if (qty <= 0) return null

    // Estimación (cuando el usuario no es admin). Usa costos del perfil y papel seleccionado.
    if (editorialEnabled) {
      const defaults = editorialSplitCalc
      if (!defaults) return null

      const profileById = new Map(profiles.map((p) => [p.id, p] as const))

      const transporte = parseFloat(costoTransporte) || 0

      const inferPapelTipo = (paperTipoRaw: string | null | undefined): PapelTipo => {
        const tt = String(paperTipoRaw || "").toLowerCase()
        if (tt.includes("bond")) return "bond"
        if (tt.includes("propal") || tt.includes("cote") || tt.includes("couche")) return "propalcote"
        if (tt.includes("period")) return "periodico"
        return "otro"
      }

      const computePart = (
        partKey: "cover" | "inner",
        part: EditorialPartState,
        pliegosPorUnidad: number,
        planchasPorUnidad: number
      ) => {
        const runQty = Math.max(0, Math.trunc(qty))
        if (runQty <= 0) return null
        const paper = papers.find((p) => p.id === String(part.paperId || "").trim()) || null
        if (!paper) return null

        const preset = resolveEditorialPartSizeOption(part)
        if (!preset) return null

        const machineProfile = part.machineProfileId ? profileById.get(String(part.machineProfileId || "").trim()) || null : null
        const planchaCostPorColor = part.planchaProfileIds.reduce((total, id, index) => {
          const profile = profileById.get(String(id || "").trim())
          if (!profile) return total
          const qty = Math.max(1, Math.trunc(parseFloat(String(part.planchaProfileQtys[index] || "1")) || 0) || 1)
          return total + ((Number(profile.costoPlanchaPorColor) || 0) * qty)
        }, 0)
        const tintaCostPorColor = part.tintaProfileIds.reduce((total, id, index) => {
          const profile = profileById.get(String(id || "").trim())
          if (!profile) return total
          const qty = Math.max(1, Math.trunc(parseFloat(String(part.tintaProfileQtys[index] || "1")) || 0) || 1)
          return total + ((Number(profile.costoTintaPorColor) || 0) * qty)
        }, 0)

        const tintasLocal: 1 | 2 | 4 = 4
        const planchasLocal = Math.max(0, Math.trunc(Number(planchasPorUnidad) || 0))
        const sobranteLocal = parseFloat(String(part.sobranteMinimo))

        const finish = part.finishId ? finishes.find((f) => f.id === part.finishId) || null : null
        const finishMultiplier = finish && partKey === "inner" && isCompaginadoFinish(finish)
          ? Math.max(1, editorialInnerCompaginadoQty)
          : 1
        const finishesCost = finish && !finish.especial && getGrupo(finish) === "ACABADO"
          ? (Number(finish.valor) || 0) * finishMultiplier
          : 0

        const special = part.specialFinishId ? finishes.find((f) => f.id === part.specialFinishId) || null : null
        const specialQty = Math.max(0, Math.trunc(parseFloat(String(part.specialFinishQty)) || 0))
        const specialCost = special && Boolean(special.especial) ? (Number(special.valor) || 0) * specialQty : 0

        const plast = part.plastificadoId ? finishes.find((f) => f.id === part.plastificadoId) || null : null
        const plastQty = Math.max(1, Math.trunc(parseFloat(String(part.plastificadoQty)) || 0) || 1)
        const plastCost = plast && getGrupo(plast) === "PLASTIFICADO" ? (Number(plast.valor) || 0) * plastQty : 0

        const troq = part.troqueladoId ? finishes.find((f) => f.id === part.troqueladoId) || null : null
        const troqQty = Math.max(1, Math.trunc(parseFloat(String(part.troqueladoQty)) || 0) || 1)
        const troqCost = troq && getGrupo(troq) === "TROQUELADO" ? (Number(troq.valor) || 0) * troqQty : 0

        const troquelada = part.troqueladaId ? finishes.find((f) => f.id === part.troqueladaId) || null : null
        const troqueladaQty = Math.max(1, Math.trunc(parseFloat(String(part.troqueladaQty)) || 0) || 1)
        const troqueladaCost = troquelada && getGrupo(troquelada) === "TROQUELADO" ? (Number(troquelada.valor) || 0) * troqueladaQty : 0

        const corteOpt = part.corteId ? finishes.find((f) => f.id === part.corteId) || null : null
        const corteQtyLocal = Math.max(1, Math.trunc(parseFloat(String(part.corteQty)) || 0) || 1)
        const corteCostLocal = corteOpt && getGrupo(corteOpt) === "CORTE" ? (Number(corteOpt.valor) || 0) * corteQtyLocal : 0

        const qtyForCompute = computeEditorialProductionQty({
          runQty,
          pliegosPorUnidad,
          partKey,
          piezasFinalesPorHojaAbierta: editorialFoldParts,
        })
        return computeLitografia({
          cantidad: qtyForCompute,
          colores: tintasLocal,
          desperdicioPct: 0,
          sobranteMinimo: Number.isFinite(sobranteLocal) ? sobranteLocal : (parseFloat(sobranteMinimo) || 0),
          sobranteMinimoUnidad: "hoja_maquina",
          costoPlanchaPorColor: toPerColorCost(((planchaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoTintaPorColor: toPerColorCost(((tintaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoPapelUnidad: 0,
          papelModo: "pliego",
          papelTipo: inferPapelTipo(paper.tipo),
          papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
          papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
          papelFormatoWidthCm: preset.widthCm ?? 0,
          papelFormatoHeightCm: preset.heightCm ?? 0,
          maquinaPliegoWidthCm: Number(machineProfile?.anchoUtilCm) || 0,
          maquinaPliegoHeightCm: Number(machineProfile?.altoUtilCm) || 0,
          maquinaSeparacionCm: 0,
          costoPliego: paper.costoPliego ?? 0,
          costoCorte: corteCostLocal,
          costoAcabados: finishesCost + specialCost + plastCost + troqCost + troqueladaCost,
          costoTransporte: 0,
          margenPct: 0,
        })
      }

      const cover = defaults.coverPliegosPorUnidad > 0
        ? computePart("cover", editorialCover, defaults.coverPliegosPorUnidad, defaults.coverPlanchas)
        : null
      const inner = defaults.innerPliegosPorUnidad > 0
        ? computePart("inner", editorialInner, defaults.innerPliegosPorUnidad, defaults.innerPlanchas)
        : null

      if (!cover && !inner) return null

      const plancha = (cover?.plancha ?? 0) + (inner?.plancha ?? 0)
      const tinta = (cover?.tinta ?? 0) + (inner?.tinta ?? 0)
      const papel = (cover?.papel ?? 0) + (inner?.papel ?? 0)
      const corte = (cover?.corte ?? 0) + (inner?.corte ?? 0)
      const acabados = (cover?.acabados ?? 0) + (inner?.acabados ?? 0)
      const costoProduccion = plancha + tinta + papel + corte + acabados + transporte
      const precioVenta = costoProduccion

      return {
        qty,
        k: 4,
        waste: Math.max(cover?.waste ?? 0, inner?.waste ?? 0),
        sobranteMinimo: Math.max(cover?.sobranteMinimo ?? 0, inner?.sobranteMinimo ?? 0),
        papelModo: "pliego",
        qtyConDesperdicio: (cover?.qtyConDesperdicio ?? 0) + (inner?.qtyConDesperdicio ?? 0),
        piezasPorPliego: (cover?.piezasPorPliego ?? inner?.piezasPorPliego) || undefined,
        pliegosNecesarios: ((cover?.pliegosNecesarios ?? 0) + (inner?.pliegosNecesarios ?? 0)) || undefined,
        plancha,
        tinta,
        papel,
        corte,
        acabados,
        transporte,
        costoProduccion,
        precioVenta,
        costoUnitario: costoProduccion / qty,
        precioUnitario: precioVenta / qty,
      } as LitografiaResult
    }

    if (!selectedPreset) return null

    const planchaCostForCompute = planchaCostConfigured
    const tintaCostForCompute = tintaCostConfigured

    if (!primaryPaper) return null
    const paper = primaryPaper
    const qtyForCompute = qty

    const base = computeLitografia({
      cantidad: qtyForCompute,
      colores: tintas,
      desperdicioPct: 0,
      sobranteMinimo: parseFloat(sobranteMinimo) || 0,
      sobranteMinimoUnidad: "hoja_maquina",
        costoPlanchaPorColor: toPerColorCost(planchaCostForCompute, tintas),
        costoTintaPorColor: toPerColorCost(tintaCostForCompute, tintas),
      costoPapelUnidad: 0,
      papelModo: "pliego",
      papelTipo,
      papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
      papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
      papelFormatoWidthCm: selectedPreset.widthCm ?? 0,
      papelFormatoHeightCm: selectedPreset.heightCm ?? 0,
      maquinaPliegoWidthCm: primaryMachineWidth,
      maquinaPliegoHeightCm: primaryMachineHeight,
      maquinaSeparacionCm: primaryMachineGap,
      costoPliego: paper.costoPliego ?? 0,
      costoCorte: 0,
      costoAcabados: 0,
      costoTransporte: parseFloat(costoTransporte) || 0,
      // Margen 0: se deja como estimación base.
      margenPct: 0,
    })

    if (selectedPreset) {
      const byPaperId = new Map(papers.map((p) => [p.id, p] as const))
      const presetByKey = new Map(allSizeOptions.map((s) => [s.key, resolveSizeOption(s.key)] as const))

      const baseNoPaper = computeLitografia({
        cantidad: qtyForCompute,
        colores: tintas,
        desperdicioPct: 0,
        sobranteMinimo: parseFloat(sobranteMinimo) || 0,
        sobranteMinimoUnidad: "hoja_maquina",
        costoPlanchaPorColor: toPerColorCost(planchaCostForCompute, tintas),
        costoTintaPorColor: toPerColorCost(tintaCostForCompute, tintas),
        costoPapelUnidad: 0,
        papelModo: "pliego",
        papelTipo,
        papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
        papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
        papelFormatoWidthCm: selectedPreset.widthCm ?? 0,
        papelFormatoHeightCm: selectedPreset.heightCm ?? 0,
        maquinaPliegoWidthCm: primaryMachineWidth,
        maquinaPliegoHeightCm: primaryMachineHeight,
        maquinaSeparacionCm: primaryMachineGap,
        costoPliego: 0,
        costoCorte: 0,
        costoAcabados: 0,
        costoTransporte: parseFloat(costoTransporte) || 0,
        margenPct: 0,
      })

      let paperTotal = 0
      for (let idx = 0; idx < paperRows.length; idx++) {
        const row = paperRows[idx]
        const paperId = String(row?.paperId || "").trim()
        if (!paperId) continue
        const p = byPaperId.get(paperId)
        if (!p) continue

        const rowPreset = idx === 0
          ? selectedPreset
          : (presetByKey.get(String(row.formatoKey || "").trim()) || selectedPreset)

        const rowQty = idx === 0 ? qtyForCompute : (parseFloat(String(row.qty || "0")) || 0)
        if (rowQty <= 0) continue

        const r = computeLitografia({
          cantidad: rowQty,
          colores: tintas,
          desperdicioPct: 0,
          sobranteMinimo: parseFloat(sobranteMinimo) || 0,
          sobranteMinimoUnidad: "hoja_maquina",
          costoPlanchaPorColor: 0,
          costoTintaPorColor: 0,
          costoPapelUnidad: 0,
          papelModo: "pliego",
          papelTipo,
          papelPliegoWidthCm: p.pliegoWidthCm ?? 0,
          papelPliegoHeightCm: p.pliegoHeightCm ?? 0,
          papelFormatoWidthCm: rowPreset?.widthCm ?? 0,
          papelFormatoHeightCm: rowPreset?.heightCm ?? 0,
          maquinaPliegoWidthCm: primaryMachineWidth,
          maquinaPliegoHeightCm: primaryMachineHeight,
          maquinaSeparacionCm: primaryMachineGap,
          costoPliego: p.costoPliego ?? 0,
          costoCorte: 0,
          costoAcabados: 0,
          costoTransporte: 0,
          margenPct: 0,
        })
        paperTotal += r.papel
      }

      if (paperTotal > 0) {
        const costoProduccion = baseNoPaper.plancha + baseNoPaper.tinta + paperTotal + baseNoPaper.corte + baseNoPaper.acabados + baseNoPaper.transporte
        const precioVenta = costoProduccion
        return {
          ...baseNoPaper,
          papel: paperTotal,
          costoProduccion,
          precioVenta,
          costoUnitario: costoProduccion / baseNoPaper.qty,
          precioUnitario: precioVenta / baseNoPaper.qty,
        } as LitografiaResult
      }
    }
    return base
  }, [
    isAdmin,
    props.open,
    cantidad,
    editorialEnabled,
    editorialSplitCalc,
    editorialCover,
    editorialInner,
    sobranteMinimo,
    planchaCostConfigured,
    tintaCostConfigured,
    papelTipo,
    costoTransporte,
    selectedPreset,
    primaryPaper,
    primaryMachineWidth,
    primaryMachineHeight,
    primaryMachineGap,
    paperRows,
    papers,
    profiles,
    finishes,
    sizeOptions,
    allSizeOptions,
    resolveSizeOption,
    editorialFoldParts,
    tintas,
  ])

  const currentComputed = isAdmin ? calc : fallbackCalc

  const currentImpositionSummary = useMemo(() => {
    if (editorialEnabled) return null
    if (!currentComputed || currentComputed.papelModo !== "pliego") return null

    const runQty = Math.max(0, Math.trunc(parseFloat(cantidad) || 0))
    const sobrante = Math.max(0, Math.trunc(parseFloat(sobranteMinimo) || 0))
    const piezas = Math.max(0, Math.trunc(Number(currentComputed.qtyConDesperdicio) || 0))
    const formatoLabel = selectedPreset
      ? `${selectedPreset.nombre} (${formatCm(selectedPreset.widthCm)}×${formatCm(selectedPreset.heightCm)} cm)`
      : (formatoKey ? String(formatoKey) : "—")
    const paperLabel = primaryPaper
      ? `${primaryPaper.nombre} ${formatCm(primaryPaper.pliegoWidthCm)}×${formatCm(primaryPaper.pliegoHeightCm)} cm`
      : `${formatCm(currentComputed.papelPliegoWidthCm)}×${formatCm(currentComputed.papelPliegoHeightCm)} cm`
    const machineLabel = primaryMachineProfile
      ? `${primaryMachineProfile.nombre} (${formatCm(primaryMachineWidth)}×${formatCm(primaryMachineHeight)} cm)`
      : "Perfil no configurado"
    const hojasMaquinaPorPliego = Math.max(0, Math.trunc(Number(currentComputed.hojasMaquinaPorPliego) || 0))
    const hojasMaquinaNecesarias = Math.max(0, Math.trunc(Number(currentComputed.hojasMaquinaNecesarias) || 0))
    const arrangement = (currentComputed.piezasHorizontal ?? 0) > 0 && (currentComputed.piezasVertical ?? 0) > 0
      ? `${currentComputed.piezasHorizontal} × ${currentComputed.piezasVertical}`
      : null
    const orientation = currentComputed.orientacionImpresion === "girada" ? "girado" : "normal"
    const short = arrangement && (currentComputed.piezasPorPliego ?? 0) > 0
      ? `Cliente recibe ${formatoLabel}; impresión en ${primaryMachineProfile?.nombre ?? "Máquina"}: ${currentComputed.piezasPorPliego} pzas por pliego base (${arrangement}, ${orientation}), ${currentComputed.pliegosNecesarios ?? "—"} pliegos.`
      : `Cliente recibe ${formatoLabel}; impresión en ${primaryMachineProfile?.nombre ?? "Máquina"}: ${currentComputed.piezasPorPliego ?? "—"} pzas por pliego base, ${currentComputed.pliegosNecesarios ?? "—"} pliegos.`
    const detail = [
      `cliente recibe ${formatoLabel}`,
      `papel ${paperLabel}`,
      `impresión ${machineLabel}`,
      hojasMaquinaPorPliego > 1 ? `del pliego salen ${hojasMaquinaPorPliego} hojas de máquina` : null,
      arrangement ? `imposición ${arrangement} (${orientation})` : null,
      `producción = tiraje cliente ${runQty} + sobrante ${sobrante} = ${piezas} piezas finales`,
      `pliegos papel = ⌈${piezas} / ${currentComputed.piezasPorPliego ?? "—"}⌉ = ${currentComputed.pliegosNecesarios ?? "—"}`,
      hojasMaquinaPorPliego > 1 ? `hojas de máquina referenciales = ${hojasMaquinaNecesarias || "—"}` : null,
    ].filter(Boolean).join(" • ")

    return {
      short,
      detail,
      arrangement,
      orientation,
      machineLabel,
    }
  }, [
    editorialEnabled,
    currentComputed,
    cantidad,
    sobranteMinimo,
    selectedPreset,
    formatoKey,
    primaryPaper,
    primaryMachineProfile,
    primaryMachineWidth,
    primaryMachineHeight,
  ])

  const currentEditorialSummary = useMemo(() => {
    if (!editorialEnabled) return null

    const productLabel = selectedEditorialOption?.label || "Producto editorial"
    const coverSheets = editorialCoverSheetsPreview?.pliegosNecesarios ?? 0
    const innerSheets = editorialInnerSheetsPreview?.pliegosNecesarios ?? 0
    const totalSheets = coverSheets + innerSheets

    const coverFormatLabel = editorialCoverPreset
      ? `${editorialCoverPreset.nombre} (${formatCm(editorialCoverPreset.widthCm)}×${formatCm(editorialCoverPreset.heightCm)} cm)`
      : null
    const innerFormatLabel = editorialInnerPreset
      ? `${editorialInnerPreset.nombre} (${formatCm(editorialInnerPreset.widthCm)}×${formatCm(editorialInnerPreset.heightCm)} cm)`
      : null
    const coverPaperLabel = editorialCoverPaper
      ? `${editorialCoverPaper.nombre}${editorialCoverPaper.gramaje ? ` ${editorialCoverPaper.gramaje}g` : ""} ${formatCm(editorialCoverPaper.pliegoWidthCm)}×${formatCm(editorialCoverPaper.pliegoHeightCm)} cm`
      : null
    const innerPaperLabel = editorialInnerPaper
      ? `${editorialInnerPaper.nombre}${editorialInnerPaper.gramaje ? ` ${editorialInnerPaper.gramaje}g` : ""} ${formatCm(editorialInnerPaper.pliegoWidthCm)}×${formatCm(editorialInnerPaper.pliegoHeightCm)} cm`
      : null

    const shortParts = [productLabel]
    if (editorialClosedSizeLabel) shortParts.push(`Cliente: ${editorialClosedSizeLabel}`)
    if (editorialOpenSizeLabel) shortParts.push(`Impresión abierta: ${editorialOpenSizeLabel}`)
    if (coverPaperLabel || coverFormatLabel) {
      shortParts.push(`Portada: ${[coverFormatLabel, coverPaperLabel, coverSheets > 0 ? `${coverSheets} pliegos` : null].filter(Boolean).join(" • ")}`)
    }
    if (innerPaperLabel || innerFormatLabel) {
      shortParts.push(`Internas: ${[innerFormatLabel, innerPaperLabel, innerSheets > 0 ? `${innerSheets} pliegos` : null].filter(Boolean).join(" • ")}`)
    }

    const detailParts = [
      `cliente recibe ${productLabel.toLowerCase()} de ${editorialTotalCustomerPages} páginas${editorialClosedSizeLabel ? ` en tamaño final ${editorialClosedSizeLabel}` : ""}`,
      editorialOpenSizeLabel ? `tamaño abierto de impresión ${editorialOpenSizeLabel}` : null,
      editorialCoverSheetsPreview
        ? `portada: ${[coverFormatLabel, coverPaperLabel].filter(Boolean).join(" • ")}; producción = ⌈tiraje ${editorialCoverSheetsPreview.runQty} / ${editorialFoldParts}⌉ × pliegos/unidad ${editorialCoverSheetsPreview.pliegosPorUnidad} = ${editorialCoverSheetsPreview.qtyForCompute}; pliegos papel = ${editorialCoverSheetsPreview.pliegosNecesarios ?? "—"}`
        : null,
      editorialInnerSheetsPreview
        ? `internas: ${[innerFormatLabel, innerPaperLabel].filter(Boolean).join(" • ")}; producción = tiraje ${editorialInnerSheetsPreview.runQty} × pliegos/unidad ${editorialInnerSheetsPreview.pliegosPorUnidad} = ${editorialInnerSheetsPreview.qtyForCompute}; pliegos papel = ${editorialInnerSheetsPreview.pliegosNecesarios ?? "—"}`
        : null,
      totalSheets > 0 ? `total pliegos papel = portada ${coverSheets} + internas ${innerSheets} = ${totalSheets}` : null,
    ].filter(Boolean)

    if (shortParts.length <= 1 && detailParts.length <= 1) return null

    return {
      short: shortParts.join(" • "),
      detail: detailParts.join(" • "),
    }
  }, [
    editorialEnabled,
    selectedEditorialOption,
    editorialTotalCustomerPages,
    editorialClosedSizeLabel,
    editorialOpenSizeLabel,
    editorialCoverSheetsPreview,
    editorialInnerSheetsPreview,
    editorialCoverPreset,
    editorialInnerPreset,
    editorialCoverPaper,
    editorialInnerPaper,
    editorialFoldParts,
  ])

  const activeProductionSummary = editorialEnabled ? currentEditorialSummary : currentImpositionSummary

  const estimatedQuoteAmounts = buildLitografiaQuoteAmounts(fallbackCalc)
  const adminQuoteAmounts = buildLitografiaQuoteAmounts(calc)

  const validation = useMemo(() => {
    const qty = Math.trunc(parseFloat(cantidad) || 0)
    const missingCantidad = qty <= 0
    const missingEditorialTemplate = Boolean(editorialMode && !String(selectedEditorialProductoKey || "").trim())
    const coverRequired = Boolean(editorialEnabled && (editorialSplitCalc?.coverPliegosPorUnidad ?? 0) > 0)
    const innerRequired = Boolean(editorialEnabled && (editorialSplitCalc?.innerPliegosPorUnidad ?? 0) > 0)

    const coverPreset = coverRequired ? resolveEditorialPartSizeOption(editorialCover) : null
    const innerPreset = innerRequired ? resolveEditorialPartSizeOption(editorialInner) : null
    const missingEditorialFormato = (coverRequired && !coverPreset) || (innerRequired && !innerPreset)
    const missingFormato = editorialMode
      ? (editorialEnabled ? missingEditorialFormato : true)
      : (!formatoKey || !selectedPreset)
    const missingEditorialPaper =
      (coverRequired && !String(editorialCover.paperId || "").trim()) ||
      (innerRequired && !String(editorialInner.paperId || "").trim())

    const missingPaper = missingEditorialTemplate
      ? true
      : editorialEnabled
        ? missingEditorialPaper
        : (!primaryPaperId && activePapers.length > 0)
    const missingPlancha = editorialEnabled
      ? (activePlanchaProfiles.length > 0 && (
        (coverRequired && (!String(editorialCover.machineProfileId || "").trim() || !String(editorialCover.planchaProfileIds[0] || "").trim())) ||
        (innerRequired && (!String(editorialInner.machineProfileId || "").trim() || !String(editorialInner.planchaProfileIds[0] || "").trim()))
      ))
      : ((!selectedMachineProfileId || !primaryPlanchaProfileId) && activePlanchaProfiles.length > 0)
    const missingTinta = editorialEnabled
      ? (activeTintaProfiles.length > 0 && ((coverRequired && !String(editorialCover.tintaProfileIds[0] || "").trim()) || (innerRequired && !String(editorialInner.tintaProfileIds[0] || "").trim())))
      : (!primaryTintaProfileId && activeTintaProfiles.length > 0)
    const missingPricing = !isAdmin && !fallbackCalc

    const hasMissing = missingCantidad || missingFormato || missingPaper || missingPlancha || missingTinta || missingPricing
    return {
      qty,
      missingCantidad,
      missingFormato,
      missingPaper,
      missingPlancha,
      missingTinta,
      missingPricing,
      missingEditorialTemplate,
      hasMissing,
    }
  }, [
    isAdmin,
    cantidad,
    formatoKey,
    selectedPreset,
    sizeOptions,
    allSizeOptions,
    resolveSizeOption,
    resolveEditorialPartSizeOption,
    primaryPaperId,
    activePapers.length,
    selectedEditorialProductoKey,
    editorialMode,
    editorialEnabled,
    editorialSplitCalc,
    editorialCover.paperId,
    editorialInner.paperId,
    editorialCover.formatoKey,
    editorialInner.formatoKey,
    editorialCover.machineProfileId,
    editorialInner.machineProfileId,
    editorialCover.planchaProfileIds,
    editorialInner.planchaProfileIds,
    editorialCover.tintaProfileIds,
    editorialInner.tintaProfileIds,
    selectedMachineProfileId,
    primaryPlanchaProfileId,
    activePlanchaProfiles.length,
    primaryTintaProfileId,
    activeTintaProfiles.length,
    fallbackCalc,
  ])

  const requiredLabelClass = (missing: boolean) => (attemptedSubmit && missing ? "text-red-600" : "")
  const requiredFieldClass = (missing: boolean) =>
    attemptedSubmit && missing ? "border-red-500 focus-visible:ring-red-500" : ""

  const canAdd = useMemo(() => {
    if (validation.hasMissing) return false
    if (isAdmin) return Boolean(calc)
    return Boolean(fallbackCalc)
  }, [validation.hasMissing, isAdmin, calc, fallbackCalc])

  const aiProposalNotice = useMemo(() => {
    if (!props.aiDraft) return null
    if (appliedAiDraftId !== props.aiDraft.id) return null
    if (canAdd) return { tone: "ready" as const, message: t('printshopQuote.aiProposal.ready') }
    return { tone: "pending" as const, message: t('printshopQuote.aiProposal.pending') }
  }, [props.aiDraft, appliedAiDraftId, canAdd, t])

  const runQtyHelp = useMemo(() => {
    const computed = isAdmin ? calc : fallbackCalc
    if (!computed) return null

    const runQty = Math.max(0, Math.trunc(parseFloat(cantidad) || 0))
    const sobrante = Math.max(0, Math.trunc(parseFloat(sobranteMinimo) || 0))
    const piezas = Math.max(0, Math.trunc(Number(computed.qtyConDesperdicio) || 0))

    const formatoLabel = selectedPreset
      ? `${selectedPreset.nombre} (${formatCm(selectedPreset.widthCm)}×${formatCm(selectedPreset.heightCm)} cm)`
      : (formatoKey ? String(formatoKey) : "—")
    const pliegoLabel = primaryPaper
      ? `${formatCm(primaryPaper.pliegoWidthCm)}×${formatCm(primaryPaper.pliegoHeightCm)} cm`
      : `${String(pliegoW || "—")}×${String(pliegoH || "—")} cm`

    if (computed.papelModo !== "pliego") {
      return {
        line1: `Cliente recibe: ${formatoLabel}.`,
        line2: `Producción: tiraje cliente (${runQty}) + sobrante (${sobrante}) = ${piezas} piezas finales.`,
        line3: null as string | null,
      }
    }

    const pzasPorPliego = Math.max(0, Math.trunc(Number(computed.piezasPorPliego) || 0))
    const hojasMaquinaPorPliego = Math.max(0, Math.trunc(Number(computed.hojasMaquinaPorPliego) || 0))
    const hojasMaquinaNecesarias = Math.max(0, Math.trunc(Number(computed.hojasMaquinaNecesarias) || 0))
    const pliegos = Math.max(0, Math.trunc(Number(computed.pliegosNecesarios) || 0))
    const arrangement = (computed.piezasHorizontal ?? 0) > 0 && (computed.piezasVertical ?? 0) > 0
      ? `${computed.piezasHorizontal} × ${computed.piezasVertical}`
      : null
    const orientation = computed.orientacionImpresion === "girada" ? "girado" : "normal"
    const machineLabel = primaryMachineProfile
      ? `${primaryMachineProfile.nombre} (${formatCm(primaryMachineWidth)}×${formatCm(primaryMachineHeight)} cm)`
      : "sin perfil configurado"

    return {
      line1: `Cliente recibe: ${formatoLabel}. Papel base: ${pliegoLabel}.`,
      line2: `Impresión en: ${machineLabel}. Aprovechamiento del pliego base: ${arrangement ? `${arrangement} (${orientation}) = ${pzasPorPliego} piezas finales por pliego.` : `${pzasPorPliego || "—"} piezas finales por pliego.`}`,
      line3: `Cálculo interno: producción = tiraje cliente (${runQty}) + sobrante (${sobrante}) = ${piezas}; pliegos papel = ⌈${piezas} / ${pzasPorPliego || "—"}⌉ = ${pliegos}.${hojasMaquinaPorPliego > 1 ? ` Hojas de máquina referenciales: ${hojasMaquinaNecesarias || "—"}.` : ""}`,
    }
  }, [isAdmin, calc, fallbackCalc, cantidad, sobranteMinimo, selectedPreset, formatoKey, pliegoW, pliegoH, primaryPaper, primaryMachineProfile, primaryMachineWidth, primaryMachineHeight])

  const defaultDescripcion = useMemo(() => {
    const defaultTitle = t('printshopQuote.defaultTitle')
    const base = (titulo || defaultTitle).trim() || defaultTitle

    const qtyShown = Math.trunc(parseFloat(String(cantidad)) || 0)

    if (!isAdmin) {
      const presetLabel = selectedPreset
        ? `${selectedPreset.nombre} (${selectedPreset.widthCm}×${selectedPreset.heightCm} cm)`
        : (formatoKey || t('printshopQuote.sizeFallback'))
      const tintasLabel =
        tintas === 4
          ? t('printshopQuote.inks.fullColor')
          : tintas === 1
            ? t('printshopQuote.inks.single', { n: tintas })
            : t('printshopQuote.inks.plural', { n: tintas })
      const parts = [base, presetLabel, tintasLabel]
      if (editorialEnabled) {
        const opt = editorialOptions.find((o) => o.value === selectedEditorialProductoKey) || null
        if (opt?.label) parts.push(opt.label)
        if (editorialClosedSizeLabel) parts.push(`Tamaño final ${editorialClosedSizeLabel}`)
        if (editorialOpenSizeLabel) parts.push(`Impresión abierta ${editorialOpenSizeLabel}`)
      } else {
        if (primaryPaper) parts.push(`${t('printshopQuote.desc.paper')} ${primaryPaper.nombre}${primaryPaper.gramaje ? ` ${primaryPaper.gramaje}g` : ""}`)
        if (selectedFinishes.length) parts.push(`${t('printshopQuote.desc.finishes')} ${selectedFinishes.map((f) => f.nombre).join(", ")}`)
        if (selectedPlastificado) parts.push(`${t('printshopQuote.desc.lamination')} ${selectedPlastificado.nombre}`)
        if (selectedTroquelado) parts.push(`${t('printshopQuote.desc.dieCut')} ${selectedTroquelado.nombre}`)
        if (selectedTroquelada) parts.push(`Troquelada ${selectedTroquelada.nombre}`)
        if (selectedCorte) parts.push(`${t('printshopQuote.desc.cut')} ${selectedCorte.nombre}`)
        if (selectedSpecialFinishNames.length) parts.push(`${t('printshopQuote.desc.specialFinishes')} ${selectedSpecialFinishNames.join(", ")}`)
      }
      if (selectedTransporteKey) {
        const opt = transporteOptions.find((o) => o.value === selectedTransporteKey)
        parts.push(`${t('printshopQuote.desc.transport')} ${opt?.label ?? ""}`.trim())
      }
      return parts.join(" • ")
    }

    if (!calc) return base

    const parts = [
      `${base}`,
      t('printshopQuote.desc.colors', { n: calc.k }),
      t('printshopQuote.desc.run', { qty: qtyShown > 0 ? qtyShown : Math.round(calc.qty) }),
    ]

    if (!editorialEnabled && calc.papelModo === "pliego") {
      const formatoLabel = selectedPreset
        ? `${selectedPreset.nombre} (${selectedPreset.widthCm}×${selectedPreset.heightCm} cm)`
        : t('printshopQuote.formatFallback')
      const pl = calc.pliegosNecesarios ?? 0
      const pzas = calc.piezasPorPliego ?? 0
      parts.push(`${t('printshopQuote.desc.paper')} ${papelTipo}`)
      parts.push(`${formatoLabel}`)
      if (pl > 0 && pzas > 0) parts.push(t('printshopQuote.desc.sheetsSummary', { pl, pzas }))
    }

    if (editorialEnabled && selectedEditorialOption?.label) {
      parts.push(selectedEditorialOption.label)
    }
    if (editorialEnabled && editorialClosedSizeLabel) parts.push(`Tamaño final ${editorialClosedSizeLabel}`)
    if (editorialEnabled && editorialOpenSizeLabel) parts.push(`Impresión abierta ${editorialOpenSizeLabel}`)

    return parts.join(" • ")
  }, [titulo, isAdmin, selectedPreset, formatoKey, tintas, cantidad, calc, papelTipo, primaryPaper, selectedFinishes, selectedSpecialFinishNames, selectedTransporteKey, selectedPlastificado, selectedTroquelado, selectedTroquelada, selectedCorte, transporteOptions, t, editorialEnabled, editorialOptions, selectedEditorialProductoKey, selectedEditorialOption, editorialClosedSizeLabel, editorialOpenSizeLabel])


  const buildDescripcion = () => {
    const notas = descripcion.trim()
    const extra = customFields
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label && f.value)

    if (!notas && extra.length === 0) return defaultDescripcion

    const lines = [defaultDescripcion]
    if (notas) lines.push("", t('printshopQuote.notes.label'), notas)
    if (extra.length) lines.push("", t('printshopQuote.customFields.sectionLabel'), ...extra.map((f) => `- ${f.label}: ${f.value}`))
    return lines.join("\n")
  }

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, label: "", value: "" },
    ])
  }

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id))
  }

  const updateCustomField = (id: string, patch: Partial<CustomField>) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const handleAddToCotizacion = () => {
    {
      setAttemptedSubmit(true)
      setPricingError(null)
      const runQty = Math.trunc(parseFloat(cantidad) || 0)
      if (runQty <= 0) {
        setPricingError(t('printshopQuote.errors.invalidQuantity'))
        return
      }

      if (validation.hasMissing) {
        setPricingError(t('printshopQuote.errors.completeRequired'))
        return
      }

      const computed = isAdmin ? calc : fallbackCalc

      if (!computed) {
        setPricingError(t('printshopQuote.errors.noRateOrEstimate'))
        return
      }

      const quoteAmounts = buildLitografiaQuoteAmounts(computed)
      if (!quoteAmounts) {
        setPricingError(t('printshopQuote.errors.noRateOrEstimate'))
        return
      }

      const meta = buildMeta()
      const subtotal = quoteAmounts.subtotalConIva
      const precioUnitario = runQty > 0 ? subtotal / runQty : subtotal
      const payload: AddLitografiaItemPayload = {
        descripcion: buildDescripcion(),
        cantidad: runQty,
        unidad: "unidad",
        desperdicioPct: computed.waste ?? 0,
        precioUnitario,
        subtotal,
        meta,
      }

      if (props.edit?.itemId && props.onUpdateItem) {
        props.onUpdateItem({ ...payload, itemId: props.edit.itemId })
      } else {
        props.onAddItem(payload)
      }
      props.onOpenChange(false)
      return
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1700px] p-0">
        <LitografiaPaperRequestDialog
          open={paperRequestOpen}
          onOpenChange={setPaperRequestOpen}
          canCreateDirectly={canConfigWrite}
          onSubmitted={handlePaperSubmitted}
        />
        <div className="flex flex-col max-h-[90vh]">
          <div className="p-6 pb-3">
            <DialogHeader>
              <DialogTitle>{t('printshopQuote.dialog.title')}</DialogTitle>
              <DialogDescription>
                {isAdmin
                  ? t('printshopQuote.dialog.descriptionAdmin')
                  : t('printshopQuote.dialog.descriptionUser')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <Tabs
              value={quoteMode}
              onValueChange={(v) => setQuoteMode(v === "editorial" ? "editorial" : "normal")}
              className="mb-4"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="normal"
                  className="bg-primary/15 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                >
                  Cotización personalizada
                </TabsTrigger>
                <TabsTrigger
                  value="editorial"
                  className="bg-primary/15 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                >
                  Libros / Cartillas / Revistas
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,8fr)_minmax(360px,4fr)] gap-4">
              <Card className={BOX_BLUR}>
                <CardHeader>
                  <CardTitle>{t('printshopQuote.sections.parameters')}</CardTitle>
                  <CardDescription>
                    {isAdmin ? t('printshopQuote.sections.parametersDescAdmin') : t('printshopQuote.sections.parametersDescUser')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label>{t('printshopQuote.fields.nameRef')}</Label>
                          <Input
                            className={INPUT_COMPACT}
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder={t('printshopQuote.placeholders.nameRef')}
                          />
                          <p className={HELP_TEXT}>
                            Identifica el ítem en la cotización.
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className={requiredLabelClass(validation.missingCantidad)}>{t('printshopQuote.fields.runQty')}</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-muted-foreground"
                              onClick={() => setShowRunQtyDetails((value) => !value)}
                            >
                              {showRunQtyDetails ? 'Ocultar detalle' : 'Ver detalle'}
                              {showRunQtyDetails ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                            </Button>
                          </div>
                          <Input
                            className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingCantidad)}`}
                            type="number"
                            step="1"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                          />
                          {showRunQtyDetails ? (
                            <div className="mt-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                              {runQtyHelp?.line1 ? (
                                <p className={HELP_TEXT}>
                                  {runQtyHelp.line1}
                                </p>
                              ) : null}
                              {runQtyHelp?.line2 ? (
                                <p className={HELP_TEXT}>
                                  {runQtyHelp.line2}
                                </p>
                              ) : null}
                              {runQtyHelp?.line3 ? (
                                <p className={HELP_TEXT}>
                                  {runQtyHelp.line3}
                                </p>
                              ) : null}
                              <p className={HELP_TEXT}>
                                Este valor es la cantidad final que verá el cliente en la cotización, no las hojas que se le piden al impresor.
                              </p>
                              {!editorialEnabled ? (
                                (isAdmin ? calc : fallbackCalc) && (isAdmin ? calc : fallbackCalc)!.papelModo === "pliego" ? (
                                  <p className={HELP_TEXT}>
                                    Internamente se imprimen {(isAdmin ? calc : fallbackCalc)!.hojasMaquinaNecesarias ?? "—"} hojas de máquina para entregar {Math.max(0, Math.trunc(parseFloat(cantidad) || 0))} piezas al cliente; eso consume {(isAdmin ? calc : fallbackCalc)!.pliegosNecesarios ?? "—"} pliegos de papel ({(isAdmin ? calc : fallbackCalc)!.piezasPorPliego ?? "—"} pzas finales/hoja).
                                  </p>
                                ) : (
                                  <p className={HELP_TEXT}>
                                    El papel requerido se calcula aparte según tamaño + papel (pliegos = ⌈(piezas + sobrante) / pzasPorPliego⌉).
                                  </p>
                                )
                              ) : (
                                editorialCoverSheetsPreview || editorialInnerSheetsPreview ? (
                                  <>
                                    <p className={HELP_TEXT}>
                                      Papel requerido (pliegos) no cambia el tiraje: se deduce por imposición.
                                    </p>
                                    {editorialInnerSheetsPreview ? (
                                      <p className={HELP_TEXT}>
                                        Internas: piezas impresas = tiraje ({editorialInnerSheetsPreview.runQty}) × pliegos/unidad ({editorialInnerSheetsPreview.pliegosPorUnidad}) = {editorialInnerSheetsPreview.qtyForCompute}. Compaginado = hojas internas finales por libro ({Math.max(0, Math.ceil((Math.max(0, Math.trunc(parseFloat(editorialTotalPaginas) || 0))) / 2))}) × tiraje = {editorialInnerCompaginadoQty}. Sobrante = {Math.max(0, Math.trunc(editorialInnerSheetsPreview.sobranteInput || 0))} hojas de máquina = {Math.max(0, Math.trunc(editorialInnerSheetsPreview.sobrantePiezas || 0))} piezas. Pliegos = ⌈(piezas + sobrante {Math.max(0, Math.trunc(editorialInnerSheetsPreview.sobrantePiezas || 0))}) / {editorialInnerSheetsPreview.piezasPorPliego ?? "—"}⌉ = {editorialInnerSheetsPreview.pliegosNecesarios ?? "—"}.
                                      </p>
                                    ) : null}
                                    {editorialCoverSheetsPreview ? (
                                      <p className={HELP_TEXT}>
                                        Portada: piezas impresas = ⌈tiraje ({editorialCoverSheetsPreview.runQty}) / {editorialFoldParts}⌉ × pliegos/unidad ({editorialCoverSheetsPreview.pliegosPorUnidad}) = {editorialCoverSheetsPreview.qtyForCompute}. Sobrante = {Math.max(0, Math.trunc(editorialCoverSheetsPreview.sobranteInput || 0))} hojas de máquina = {Math.max(0, Math.trunc(editorialCoverSheetsPreview.sobrantePiezas || 0))} piezas. Pliegos = ⌈(piezas + sobrante {Math.max(0, Math.trunc(editorialCoverSheetsPreview.sobrantePiezas || 0))}) / {editorialCoverSheetsPreview.piezasPorPliego ?? "—"}⌉ = {editorialCoverSheetsPreview.pliegosNecesarios ?? "—"}.
                                      </p>
                                    ) : null}
                                    <p className={HELP_TEXT}>
                                      Total pliegos = portada {editorialCoverSheetsPreview?.pliegosNecesarios ?? 0} + internas {editorialInnerSheetsPreview?.pliegosNecesarios ?? 0}.
                                    </p>
                                  </>
                                ) : null
                              )}
                            </div>
                          ) : null}
                        </div>

                        {!editorialMode ? (
                          <div>
                            <Label>Cómo vas a imprimir</Label>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Frente</Label>
                                <select
                                  className={`${SELECT_COMPACT} mt-1`}
                                  value={printInkFront}
                                  onChange={(e) => setPrintInkFront(e.target.value)}
                                >
                                  {PRINT_INK_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Reverso</Label>
                                <select
                                  className={`${SELECT_COMPACT} mt-1`}
                                  value={printInkBack}
                                  onChange={(e) => setPrintInkBack(e.target.value)}
                                >
                                  {PRINT_INK_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <p className={HELP_TEXT}>
                              Prellena planchas/impresión y ajusta el sobrante mínimo recomendado.
                            </p>
                            <p className={HELP_TEXT}>
                              Selección: {inkLabel(printInkFront)} / {inkLabel(printInkBack)}
                            </p>
                            {hasSpecialInk(printInkFront) || hasSpecialInk(printInkBack) ? (
                              <p className={HELP_TEXT}>
                                Si usas tintas especiales (Pantone, Dorado, Blanco, Barniz UV), ajusta manualmente el multiplicador de planchas/impresión si aplica.
                              </p>
                            ) : null}
                            {isPolicromiaAmbasCaras ? (
                              <p className={HELP_TEXT}>
                                Para policromía ambas caras (4/4) se duplica el sobrante mínimo (2×) por tiro y retiro.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {editorialMode && (
                        <div className="sm:col-span-2">
                          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 p-4 shadow-sm">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Paso 1</p>
                                <Label className={cn("mt-1 block text-sm font-semibold text-slate-950", requiredLabelClass(validation.missingEditorialTemplate))}>Elige el producto editorial</Label>
                                <p className="mt-1 text-xs text-slate-600">Primero define si vas a cotizar libro, cartilla o revista. Luego eliges formato y revisas portada vs internas.</p>
                              </div>
                              {selectedEditorialOption ? (
                                <div className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-medium text-sky-800 shadow-sm">
                                  {getEditorialProductCopy(selectedEditorialOption).badge}
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                              {editorialOptions.map((option) => {
                                const selected = option.value === selectedEditorialProductoKey
                                const productKind = getEditorialProductKind(option)
                                const copy = getEditorialProductCopy(option)
                                const Icon = productKind === "libro" ? BookOpen : productKind === "revista" ? FileText : Layers3
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setSelectedEditorialProductoKey(option.value)}
                                    className={cn(
                                      "rounded-2xl border p-4 text-left transition-all",
                                      selected
                                        ? "border-sky-400 bg-sky-50 shadow-[0_12px_30px_-18px_rgba(14,165,233,0.65)]"
                                        : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-xl border",
                                        selected ? "border-sky-300 bg-white text-sky-700" : "border-slate-200 bg-slate-50 text-slate-700"
                                      )}>
                                        <Icon className="h-4 w-4" />
                                      </div>
                                      <span className={cn(
                                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                        selected ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"
                                      )}>
                                        {copy.badge}
                                      </span>
                                    </div>
                                    <p className="mt-4 text-base font-semibold text-slate-950">{option.label}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-600">{copy.summary}</p>
                                    <div className="mt-4 text-xs text-slate-700">
                                      <span>{copy.detail}</span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>

                            <div className="mt-4">
                              <SearchableNativeSelect
                                value={selectedEditorialProductoKey}
                                onChange={(v) => setSelectedEditorialProductoKey(v)}
                                disabled={editorialOptionsLoading}
                                searchClassName={INPUT_COMPACT}
                                selectClassName={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingEditorialTemplate)}`}
                                includeAllOption={{ value: "", label: "Seleccionar…" }}
                                options={editorialOptions.map((o) => ({ value: o.value, label: o.label }))}
                                searchPlaceholder="Buscar…"
                                emptyText={editorialOptions.length ? t('common.noResults') : 'Sin dropdown editorial configurado'}
                              />
                            </div>
                          </div>
                          {!editorialOptions.length ? (
                            <p className={HELP_TEXT}>
                              Crea la plantilla en Configuración de Litografía → Dropdowns personalizados → “Crear plantilla Editorial”.
                            </p>
                          ) : null}

                          {editorialEnabled && (
                          <div className="mt-3 space-y-4">
                            <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Paso 2
                                  </div>
                                  <h3 className="mt-3 text-base font-semibold text-slate-950">
                                    {selectedEditorialOption?.label || "Producto editorial"}
                                  </h3>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Ajusta la estructura global y valida de inmediato cómo se reparten portada e internas. La lectura operativa queda separada del cálculo de papel.
                                  </p>
                                </div>
                                {selectedEditorialOption ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditorialTotalPaginas(String(selectedEditorialOption.totalPaginas || 32))
                                      setEditorialPaginasPortadaContraportada(String(selectedEditorialOption.paginasPortadaContraportada || 0))
                                      setEditorialCartasPorPlancha(String(selectedEditorialOption.cartasPorPlancha || 2))
                                      setEditorialPaginasPorPliego(String(selectedEditorialOption.paginasPorPliego || 4))
                                    }}
                                  >
                                    Usar valores sugeridos
                                  </Button>
                                ) : null}
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="rounded-lg border border-sky-100 bg-white p-3 shadow-sm">
                                  <div className="flex items-center gap-2 text-sky-700">
                                    <BookOpen className="h-4 w-4" />
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Producto</p>
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedEditorialOption?.label || "Sin plantilla"}</p>
                                  <p className="mt-1 text-xs text-slate-600">Plantilla base para libros, cartillas o revistas.</p>
                                </div>
                                <div className="rounded-lg border border-sky-100 bg-white p-3 shadow-sm">
                                  <div className="flex items-center gap-2 text-sky-700">
                                    <Package2 className="h-4 w-4" />
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Tiraje</p>
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-slate-950">{Math.max(0, Math.trunc(parseFloat(cantidad) || 0))} unidades</p>
                                  <p className="mt-1 text-xs text-slate-600">Cantidad final que recibirá el cliente.</p>
                                </div>
                                <div className="rounded-lg border border-sky-100 bg-white p-3 shadow-sm">
                                  <div className="flex items-center gap-2 text-sky-700">
                                    <Layers3 className="h-4 w-4" />
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Páginas</p>
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-slate-950">{editorialTotalCustomerPages} páginas totales</p>
                                  <p className="mt-1 text-xs text-slate-600">Portada {Math.max(0, Math.trunc(parseFloat(editorialPaginasPortadaContraportada) || 0))} + internas {Math.max(0, Math.trunc(parseFloat(editorialTotalPaginas) || 0))}.</p>
                                </div>
                              </div>

                              <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Paso 3</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-950">Elige el formato final</p>
                                    <p className="mt-1 text-xs text-slate-600">Este es el tamaño final que verá el cliente en la cotización. El tamaño abierto de impresión se define aparte más abajo.</p>
                                  </div>
                                  {editorialFinalPreset ? (
                                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                                      Tamaño final cliente: {editorialFinalPreset.nombre} ({formatCm(editorialFinalPreset.widthCm)}×{formatCm(editorialFinalPreset.heightCm)} cm)
                                    </div>
                                  ) : null}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                                  {editorialQuickFormats.map((option) => {
                                    const selected = editorialFinalFormatoKey === option.key
                                    return (
                                      <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setEditorialFinalFormatoKey(option.key)}
                                        className={cn(
                                          "rounded-xl border p-3 text-left transition-all",
                                          selected
                                            ? "border-sky-400 bg-sky-50 shadow-[0_10px_26px_-18px_rgba(14,165,233,0.7)]"
                                            : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-semibold text-slate-950">{option.nombre}</span>
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                            {formatCm(option.widthCm)}×{formatCm(option.heightCm)}
                                          </span>
                                        </div>
                                        <div className="mt-3 flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
                                          <div
                                            className={cn(
                                              "rounded-md border",
                                              selected ? "border-sky-500 bg-sky-100" : "border-slate-400 bg-white"
                                            )}
                                            style={{
                                              width: `${Math.max(28, Math.min(78, option.widthCm * 3))}px`,
                                              height: `${Math.max(28, Math.min(78, option.heightCm * 3))}px`,
                                            }}
                                          />
                                        </div>
                                        <p className="mt-3 text-[11px] leading-5 text-slate-600">Define el tamaño final del producto que compra el cliente.</p>
                                      </button>
                                    )
                                  })}

                                  <button
                                    type="button"
                                    onClick={() => setEditorialFinalFormatoKey(CUSTOM_PRINT_SIZE_KEY)}
                                    className={cn(
                                      "rounded-xl border p-3 text-left transition-all",
                                      editorialFinalFormatoKey === CUSTOM_PRINT_SIZE_KEY
                                        ? "border-sky-400 bg-sky-50 shadow-[0_10px_26px_-18px_rgba(14,165,233,0.7)]"
                                        : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold text-slate-950">Tamaño personalizado</span>
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">manual</span>
                                    </div>
                                    <div className="mt-3 flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
                                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                        <span className="rounded border border-slate-300 bg-white px-2 py-1">W</span>
                                        <ChevronUp className="h-3 w-3 rotate-90" />
                                        <span className="rounded border border-slate-300 bg-white px-2 py-1">H</span>
                                      </div>
                                    </div>
                                    <p className="mt-3 text-[11px] leading-5 text-slate-600">Úsalo cuando el tamaño final del cliente no coincide con un formato estándar.</p>
                                  </button>
                                </div>
                                {editorialFinalFormatoKey === CUSTOM_PRINT_SIZE_KEY ? (
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div>
                                      <Label>Ancho final cliente (cm)</Label>
                                      <Input
                                        className={INPUT_COMPACT}
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={editorialFinalCustomWidthCm}
                                        onChange={(e) => setEditorialFinalCustomWidthCm(e.target.value)}
                                        placeholder="14"
                                      />
                                    </div>
                                    <div>
                                      <Label>Alto final cliente (cm)</Label>
                                      <Input
                                        className={INPUT_COMPACT}
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={editorialFinalCustomHeightCm}
                                        onChange={(e) => setEditorialFinalCustomHeightCm(e.target.value)}
                                        placeholder="21"
                                      />
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                  <Label>Páginas internas</Label>
                                  <Input
                                    className={INPUT_COMPACT}
                                    type="number"
                                    step="1"
                                    min={1}
                                    value={editorialTotalPaginas}
                                    onChange={(e) => setEditorialTotalPaginas(e.target.value)}
                                  />
                                  <p className={HELP_TEXT}>Solo internas, sin portada ni contraportada.</p>
                                </div>
                                <div>
                                  <Label>Portada + contraportada</Label>
                                  <Input
                                    className={INPUT_COMPACT}
                                    type="number"
                                    step="1"
                                    min={0}
                                    value={editorialPaginasPortadaContraportada}
                                    onChange={(e) => setEditorialPaginasPortadaContraportada(e.target.value)}
                                  />
                                  <p className={HELP_TEXT}>Normalmente 2 o 4 páginas según el proyecto.</p>
                                </div>
                                <div>
                                  <Label>Libros finales que salen de una portada abierta</Label>
                                  <Input
                                    className={INPUT_COMPACT}
                                    type="number"
                                    step="1"
                                    min={1}
                                    value={editorialCartasPorPlancha}
                                    onChange={(e) => setEditorialCartasPorPlancha(e.target.value)}
                                  />
                                  <p className={HELP_TEXT}>Si una portada abierta al doblarse entrega 2 libros finales, usa 2. Ejemplo: 500 libros y factor 2 requieren 250 portadas abiertas antes de sumar sobrante.</p>
                                </div>
                              </div>
                            </div>

                            {(editorialCoverPreset && editorialCoverPaper) || (editorialInnerPreset && editorialInnerPaper) ? (
                              <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">Guía visual rápida</p>
                                    <p className="text-xs text-slate-600">Se dejó una lectura corta: pliego comprado, corte de máquina y hoja activa. El detalle fino aparece dentro de portada e internas.</p>
                                  </div>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                                    Simplificada
                                  </span>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  {editorialCoverPreset && editorialCoverPaper ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-xs text-slate-700">
                                      <p className="font-semibold text-slate-950">Portada</p>
                                      <p className="mt-1">Impresión abierta: {editorialCoverPreset.nombre} · {formatCm(editorialCoverPreset.widthCm)}×{formatCm(editorialCoverPreset.heightCm)} cm</p>
                                      {editorialClosedSizeLabel ? <p className="mt-1">Cliente: {editorialClosedSizeLabel}</p> : null}
                                      {editorialCoverPlanchaProfile ? <p className="mt-1">Hoja máquina/corte: {editorialCoverPlanchaProfile.nombre} · {formatCm(editorialCoverPlanchaProfile.anchoUtilCm)}×{formatCm(editorialCoverPlanchaProfile.altoUtilCm)} cm</p> : null}
                                      <p className="mt-1">Papel: {editorialCoverPaper.nombre} · {formatCm(editorialCoverPaper.pliegoWidthCm)}×{formatCm(editorialCoverPaper.pliegoHeightCm)} cm</p>
                                      {editorialCoverSheetsPreview ? <p className="mt-1">Despiece: {editorialCoverSheetsPreview.piezasPorPliego ?? "—"} pzas/pliego • {editorialCoverSheetsPreview.piezasPorHojaMaquina ?? "—"} pzas/hoja • {editorialCoverSheetsPreview.hojasMaquinaPorPliego ?? "—"} cortes/pliego</p> : null}
                                    </div>
                                  ) : null}
                                  {editorialInnerPreset && editorialInnerPaper ? (
                                    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 text-xs text-slate-700">
                                      <p className="font-semibold text-slate-950">Internas</p>
                                      <p className="mt-1">Impresión abierta: {editorialInnerPreset.nombre} · {formatCm(editorialInnerPreset.widthCm)}×{formatCm(editorialInnerPreset.heightCm)} cm</p>
                                      {editorialClosedSizeLabel ? <p className="mt-1">Cliente: {editorialClosedSizeLabel}</p> : null}
                                      {editorialInnerPlanchaProfile ? <p className="mt-1">Hoja máquina/corte: {editorialInnerPlanchaProfile.nombre} · {formatCm(editorialInnerPlanchaProfile.anchoUtilCm)}×{formatCm(editorialInnerPlanchaProfile.altoUtilCm)} cm</p> : null}
                                      <p className="mt-1">Papel: {editorialInnerPaper.nombre} · {formatCm(editorialInnerPaper.pliegoWidthCm)}×{formatCm(editorialInnerPaper.pliegoHeightCm)} cm</p>
                                      {editorialInnerSheetsPreview ? <p className="mt-1">Despiece: {editorialInnerSheetsPreview.piezasPorPliego ?? "—"} pzas/pliego • {editorialInnerSheetsPreview.piezasPorHojaMaquina ?? "—"} pzas/hoja • {editorialInnerSheetsPreview.hojasMaquinaPorPliego ?? "—"} cortes/pliego</p> : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Paso 4</p>
                                <p className="mt-1 text-sm font-semibold text-slate-950">Configura portada e internas por separado</p>
                                <p className="mt-1 text-xs text-slate-600">Cada bloque ya resume tamaño, papel y salida operativa para que el impresor lea rápido qué va en portada y qué va en internas.</p>
                              </div>
                            </div>
                            <div className="sm:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <div>
                                <Label className={requiredLabelClass(validation.missingFormato)}>Tamaño abierto de portada</Label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant={editorialCover.formatoKey === CUSTOM_PRINT_SIZE_KEY ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => updateEditorialPart("cover", (prev) => ({ ...prev, formatoKey: CUSTOM_PRINT_SIZE_KEY }))}
                                  >
                                    Personalizado
                                  </Button>
                                  {editorialCover.formatoKey === CUSTOM_PRINT_SIZE_KEY ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => updateEditorialPart("cover", (prev) => ({ ...prev, formatoKey: sizeOptions[0]?.key || "" }))}
                                    >
                                      Volver a predefinidos
                                    </Button>
                                  ) : null}
                                </div>
                                <select
                                  className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                  value={editorialCover.formatoKey}
                                  onChange={(e) => updateEditorialPart("cover", (prev) => ({ ...prev, formatoKey: e.target.value }))}
                                  disabled={!allSizeOptions.length}
                                >
                                  <option value="" disabled>
                                    {allSizeOptions.length ? t('printshopQuote.select.size') : t('printshopQuote.select.noSizesConfigured')}
                                  </option>
                                  {allSizeOptions.map((p) => (
                                    <option key={p.key} value={p.key}>
                                      {p.key === CUSTOM_PRINT_SIZE_KEY ? p.nombre : `${p.nombre} (${p.widthCm}×${p.heightCm} cm)`}
                                    </option>
                                  ))}
                                </select>
                                <p className={HELP_TEXT}>Define la pieza abierta de portada que realmente se imprime.</p>
                                {editorialCover.formatoKey === CUSTOM_PRINT_SIZE_KEY ? (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <div>
                                      <Label>Ancho abierto portada (cm)</Label>
                                      <Input
                                        className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={editorialCover.customFormatoWidthCm}
                                        onChange={(e) => updateEditorialPart("cover", (prev) => ({ ...prev, customFormatoWidthCm: e.target.value }))}
                                        placeholder="21.6"
                                      />
                                    </div>
                                    <div>
                                      <Label>Alto abierto portada (cm)</Label>
                                      <Input
                                        className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={editorialCover.customFormatoHeightCm}
                                        onChange={(e) => updateEditorialPart("cover", (prev) => ({ ...prev, customFormatoHeightCm: e.target.value }))}
                                        placeholder="27.9"
                                      />
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div>
                                <Label className={requiredLabelClass(validation.missingFormato)}>Tamaño abierto de internas</Label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant={editorialInner.formatoKey === CUSTOM_PRINT_SIZE_KEY ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => updateEditorialPart("inner", (prev) => ({ ...prev, formatoKey: CUSTOM_PRINT_SIZE_KEY }))}
                                  >
                                    Personalizado
                                  </Button>
                                  {editorialInner.formatoKey === CUSTOM_PRINT_SIZE_KEY ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => updateEditorialPart("inner", (prev) => ({ ...prev, formatoKey: editorialRecommendedOpenPreset?.key || sizeOptions[0]?.key || "" }))}
                                    >
                                      Volver a predefinidos
                                    </Button>
                                  ) : null}
                                </div>
                                <select
                                  className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                  value={editorialInner.formatoKey}
                                  onChange={(e) => updateEditorialPart("inner", (prev) => ({ ...prev, formatoKey: e.target.value }))}
                                  disabled={!allSizeOptions.length}
                                >
                                  <option value="" disabled>
                                    {allSizeOptions.length ? t('printshopQuote.select.size') : t('printshopQuote.select.noSizesConfigured')}
                                  </option>
                                  {allSizeOptions.map((p) => (
                                    <option key={p.key} value={p.key}>
                                      {p.key === CUSTOM_PRINT_SIZE_KEY ? p.nombre : `${p.nombre} (${p.widthCm}×${p.heightCm} cm)`}
                                    </option>
                                  ))}
                                </select>
                                <p className={HELP_TEXT}>Define la pieza abierta de internas. Aquí puede ser distinta a portada.</p>
                                {editorialInner.formatoKey === CUSTOM_PRINT_SIZE_KEY ? (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <div>
                                      <Label>Ancho abierto internas (cm)</Label>
                                      <Input
                                        className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={editorialInner.customFormatoWidthCm}
                                        onChange={(e) => updateEditorialPart("inner", (prev) => ({ ...prev, customFormatoWidthCm: e.target.value }))}
                                        placeholder="21.6"
                                      />
                                    </div>
                                    <div>
                                      <Label>Alto abierto internas (cm)</Label>
                                      <Input
                                        className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={editorialInner.customFormatoHeightCm}
                                        onChange={(e) => updateEditorialPart("inner", (prev) => ({ ...prev, customFormatoHeightCm: e.target.value }))}
                                        placeholder="27.9"
                                      />
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              {editorialClosedSizeLabel ? (
                                <p className={`${HELP_TEXT} lg:col-span-2`}>
                                  Tamaño final cerrado para el cliente: {editorialClosedSizeLabel}.
                                </p>
                              ) : null}
                              {editorialRecommendedOpenPreset ? (
                                <p className={`${HELP_TEXT} lg:col-span-2`}>
                                  Tamaño abierto recomendado para las internas según el tamaño final y el doblez: {editorialRecommendedOpenPreset.nombre} ({formatCm(editorialRecommendedOpenPreset.widthCm)}×{formatCm(editorialRecommendedOpenPreset.heightCm)} cm).
                                </p>
                              ) : null}
                              {editorialPrimaryPlanchaProfile ? (
                                <p className={`${HELP_TEXT} lg:col-span-2`}>
                                  El área útil de máquina se define aparte. Referencia actual: {editorialPrimaryPlanchaProfile.nombre} ({formatCm(editorialPrimaryPlanchaProfile.anchoUtilCm)}×{formatCm(editorialPrimaryPlanchaProfile.altoUtilCm)} cm).
                                </p>
                              ) : null}
                            </div>

                            {showAdvanced ? (
                              <div className="sm:col-span-2">
                                <p className="text-xs text-muted-foreground">
                                  Planchas (CMYK): portada <span className="font-medium">{(editorialSplitCalc?.coverPlanchas ?? 0) * 4}</span> • internas <span className="font-medium">{(editorialSplitCalc?.innerPlanchas ?? 0) * 4}</span> • total <span className="font-medium">{((editorialSplitCalc?.coverPlanchas ?? 0) + (editorialSplitCalc?.innerPlanchas ?? 0)) * 4}</span>
                                  {" "}• Pliegos por unidad: portada <span className="font-medium">{editorialSplitCalc?.coverPliegosPorUnidad ?? 0}</span> • internas <span className="font-medium">{editorialSplitCalc?.innerPliegosPorUnidad ?? 0}</span> • total <span className="font-medium">{(editorialSplitCalc?.coverPliegosPorUnidad ?? 0) + (editorialSplitCalc?.innerPliegosPorUnidad ?? 0)}</span>
                                </p>
                              </div>
                            ) : null}

                            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className={`${BOX_BLUR_MUTED} p-3`}>
                                <p className="text-sm font-medium">Portada / Contraportada</p>
                                  <p className={HELP_TEXT}>
                                    {(() => {
                                      const formato = resolveEditorialPartSizeOption(editorialCover)
                                      const paper = papers.find((p) => p.id === String(editorialCover.paperId || "").trim())
                                      const machine = profiles.find((p) => p.id === String(editorialCover.machineProfileId || editorialCover.planchaProfileId || "").trim())
                                      const pliegos = editorialSplitCalc?.coverPliegosPorUnidad ?? 0
                                      const caras = editorialSplitCalc?.coverPlanchas ?? 0
                                      const formatoLabel = formato ? `${formato.nombre} (${formato.widthCm}×${formato.heightCm} cm)` : "—"
                                      const finalLabel = editorialClosedSizeLabel || "—"
                                      const machineLabel = machine ? `${machine.nombre} (${formatCm(machine.anchoUtilCm)}×${formatCm(machine.altoUtilCm)} cm)` : "—"
                                      const paperLabel = paper ? `${paper.nombre}${paper.gramaje ? ` ${paper.gramaje}g` : ""}` : "—"
                                      const preview = editorialCoverSheetsPreview
                                      const despiece = preview
                                        ? ` • Despiece: ${preview.piezasPorPliego ?? "—"} pzas/pliego · ${preview.piezasPorHojaMaquina ?? "—"} pzas/hoja · ${preview.hojasMaquinaPorPliego ?? "—"} cortes/pliego`
                                        : ""
                                      return `Pieza abierta: ${formatoLabel} • Cliente: ${finalLabel} • Área útil: ${machineLabel} • Papel: ${paperLabel} • Planchas CMYK base: ${caras * 4} • Pliegos/unidad: ${pliegos}${despiece}`
                                    })()}
                                  </p>
                                <div className="mt-3 grid grid-cols-1 gap-3">
                                  <div>
                                    <Label>Cómo vas a imprimir</Label>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Frente</Label>
                                        <select
                                          className={`${SELECT_COMPACT} mt-1`}
                                          value={editorialCover.printInkFront}
                                          onChange={(e) => setEditorialCover((prev) => ({ ...prev, printInkFront: e.target.value }))}
                                        >
                                          {PRINT_INK_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Reverso</Label>
                                        <select
                                          className={`${SELECT_COMPACT} mt-1`}
                                          value={editorialCover.printInkBack}
                                          onChange={(e) => setEditorialCover((prev) => ({ ...prev, printInkBack: e.target.value }))}
                                        >
                                          {PRINT_INK_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <p className={HELP_TEXT}>
                                      Prellena planchas/impresión y ajusta el sobrante mínimo recomendado.
                                    </p>
                                    <p className={HELP_TEXT}>
                                      Selección: {inkLabel(editorialCover.printInkFront)} / {inkLabel(editorialCover.printInkBack)}
                                    </p>
                                    {hasSpecialInk(editorialCover.printInkFront) || hasSpecialInk(editorialCover.printInkBack) ? (
                                      <p className={HELP_TEXT}>
                                        Si usas tintas especiales (Pantone, Dorado, Blanco, Barniz UV), ajusta manualmente el multiplicador de planchas/impresión si aplica.
                                      </p>
                                    ) : null}
                                    {editorialCoverIsPolicromiaAmbasCaras ? (
                                      <p className={HELP_TEXT}>
                                        Para policromía ambas caras (4/4) se duplica el sobrante mínimo (2×) por tiro y retiro.
                                      </p>
                                    ) : null}
                                  </div>

                                  <div>
                                    <Label>Portada + contraportada (páginas)</Label>
                                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                                      {Math.max(0, Math.trunc(parseFloat(editorialPaginasPortadaContraportada) || 0))} páginas
                                    </div>
                                    <p className={HELP_TEXT}>
                                      Defínelas arriba en la guía rápida. Aquí solo ves su efecto en portada y contraportada.
                                    </p>
                                    {editorialCoverSheetsPreview ? (
                                      <div className="mt-2 space-y-2 rounded-md border border-sky-200 bg-sky-50/60 p-3">
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 xl:grid-cols-4">
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Papel</p>
                                            <p>{editorialCoverSheetsPreview.piezasPorPliego ?? "—"} pzas/pliego</p>
                                          </div>
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Maquina</p>
                                            <p>{editorialCoverSheetsPreview.piezasPorHojaMaquina ?? "—"} pzas/hoja</p>
                                          </div>
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Cortes/pliego</p>
                                            <p>{editorialCoverSheetsPreview.hojasMaquinaPorPliego ?? "—"} hojas</p>
                                          </div>
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Papel total</p>
                                            <p>{editorialCoverSheetsPreview.pliegosNecesarios ?? "—"} pliegos</p>
                                          </div>
                                        </div>
                                        <p className={HELP_TEXT}>
                                          Para {editorialCoverSheetsPreview.runQty} unidades: la portada imprime {editorialCoverSheetsPreview.qtyForCompute} hojas abiertas usando ⌈tiraje / {editorialFoldParts}⌉. El papel se calcula con {editorialCoverSheetsPreview.piezasPorPliego ?? "—"} piezas por pliego; la maquina trabaja a {editorialCoverSheetsPreview.piezasPorHojaMaquina ?? "—"} piezas por hoja y no debe reemplazar ese rendimiento.
                                        </p>
                                        <LitografiaImpositionPreview
                                          sheetWidthCm={editorialCoverSheetsPreview.sheetWidthCm}
                                          sheetHeightCm={editorialCoverSheetsPreview.sheetHeightCm}
                                          machineSheetWidthCm={editorialCoverSheetsPreview.machineSheetWidthCm}
                                          machineSheetHeightCm={editorialCoverSheetsPreview.machineSheetHeightCm}
                                          machineSheetsAcross={editorialCoverSheetsPreview.hojasMaquinaHorizontal}
                                          machineSheetsDown={editorialCoverSheetsPreview.hojasMaquinaVertical}
                                          machineSheetsPerParent={editorialCoverSheetsPreview.hojasMaquinaPorPliego}
                                          utilWidthCm={editorialCoverSheetsPreview.utilWidthCm}
                                          utilHeightCm={editorialCoverSheetsPreview.utilHeightCm}
                                          pieceWidthCm={editorialCoverSheetsPreview.pieceWidthCm}
                                          pieceHeightCm={editorialCoverSheetsPreview.pieceHeightCm}
                                          sheetPiecesAcross={editorialCoverSheetsPreview.piezasHorizontal ?? 0}
                                          sheetPiecesDown={editorialCoverSheetsPreview.piezasVertical ?? 0}
                                          machinePiecesAcross={editorialCoverSheetsPreview.piezasHojaMaquinaHorizontal ?? 0}
                                          machinePiecesDown={editorialCoverSheetsPreview.piezasHojaMaquinaVertical ?? 0}
                                          sheetPiecesPerParent={editorialCoverSheetsPreview.piezasPorPliego}
                                          machinePiecesPerSheet={editorialCoverSheetsPreview.piezasPorHojaMaquina}
                                          paperLabel={editorialCoverSheetsPreview.paperLabel}
                                          formatLabel={editorialCoverSheetsPreview.formatLabel}
                                          machineLabel={editorialCoverSheetsPreview.machineLabel}
                                          sheetArrangementLabel={`${editorialCoverSheetsPreview.piezasHorizontal ?? 0} × ${editorialCoverSheetsPreview.piezasVertical ?? 0}`}
                                          machineArrangementLabel={`${editorialCoverSheetsPreview.piezasHojaMaquinaHorizontal ?? 0} × ${editorialCoverSheetsPreview.piezasHojaMaquinaVertical ?? 0}`}
                                          sheetOrientationLabel={editorialCoverSheetsPreview.orientacionImpresion === "girada" ? "girado" : "normal"}
                                          machineOrientationLabel={editorialCoverSheetsPreview.orientacionCorte === "girada" ? "girado" : "normal"}
                                        />
                                      </div>
                                    ) : null}
                                  </div>

                                  {!showAdvanced ? null : (
                                    <>
                                      <div>
                                        <Label className={requiredLabelClass(validation.missingPlancha)}>Área útil de impresión</Label>
                                        <select
                                          className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                          value={editorialCover.machineProfileId}
                                          onChange={(e) => updateEditorialPart("cover", (prev) => ({ ...prev, machineProfileId: e.target.value }))}
                                          disabled={!activePlanchaProfiles.length}
                                        >
                                          <option value="">Seleccionar área…</option>
                                          {activePlanchaProfiles.map((p) => (
                                            <option key={p.id} value={p.id}>
                                              {p.nombre} ({formatCm(p.anchoUtilCm)}×{formatCm(p.altoUtilCm)} cm)
                                            </option>
                                          ))}
                                        </select>
                                        <p className={HELP_TEXT}>Esta área útil manda el rendimiento sobre el papel. Las planchas se cargan aparte como costo.</p>
                                      </div>

                                      <div>
                                        <div className="flex items-center justify-between gap-2">
                                          <Label className={requiredLabelClass(validation.missingPlancha)}>{t('printshopQuote.fields.platesCost')}</Label>
                                          <Button type="button" variant="outline" size="sm" onClick={() => addEditorialProfileRow("cover", "plancha")}>Agregar otra</Button>
                                        </div>
                                        <div className="mt-2 space-y-2">
                                          {editorialCover.planchaProfileIds.map((id, idx) => (
                                            <div key={`cover-plancha-${idx}-${id}`} className="flex items-center gap-2">
                                              <select
                                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                                value={id}
                                                onChange={(e) => updateEditorialProfileRow("cover", "plancha", idx, e.target.value)}
                                                disabled={!activePlanchaProfiles.length}
                                              >
                                                <option value="">{t('printshopQuote.select.nonePlates')}</option>
                                                {activePlanchaProfiles.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.nombre}</option>
                                                ))}
                                              </select>
                                              <Input
                                                className={`${INPUT_COMPACT} w-24 shrink-0`}
                                                type="number"
                                                min={1}
                                                step="1"
                                                value={editorialCover.planchaProfileQtys[idx] ?? "1"}
                                                onChange={(e) => updateEditorialProfileQty("cover", "plancha", idx, e.target.value)}
                                              />
                                              {editorialCover.planchaProfileIds.length > 1 ? (
                                                <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeEditorialProfileRow("cover", "plancha", idx)}>
                                                  {t('common.remove')}
                                                </Button>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div>
                                        <div className="flex items-center justify-between gap-2">
                                          <Label className={requiredLabelClass(validation.missingTinta)}>{t('printshopQuote.fields.inkCost')}</Label>
                                          <Button type="button" variant="outline" size="sm" onClick={() => addEditorialProfileRow("cover", "tinta")}>Agregar otra</Button>
                                        </div>
                                        <div className="mt-2 space-y-2">
                                          {editorialCover.tintaProfileIds.map((id, idx) => (
                                            <div key={`cover-tinta-${idx}-${id}`} className="flex items-center gap-2">
                                              <select
                                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingTinta)}`}
                                                value={id}
                                                onChange={(e) => updateEditorialProfileRow("cover", "tinta", idx, e.target.value)}
                                                disabled={!activeTintaProfiles.length}
                                              >
                                                <option value="">{t('printshopQuote.select.noneInks')}</option>
                                                {activeTintaProfiles.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.nombre}</option>
                                                ))}
                                              </select>
                                              <Input
                                                className={`${INPUT_COMPACT} w-24 shrink-0`}
                                                type="number"
                                                min={1}
                                                step="1"
                                                value={editorialCover.tintaProfileQtys[idx] ?? "1"}
                                                onChange={(e) => updateEditorialProfileQty("cover", "tinta", idx, e.target.value)}
                                              />
                                              {editorialCover.tintaProfileIds.length > 1 ? (
                                                <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeEditorialProfileRow("cover", "tinta", idx)}>
                                                  {t('common.remove')}
                                                </Button>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  <div>
                                    <Label className={requiredLabelClass(validation.missingPaper)}>{t('printshopQuote.fields.paper')}</Label>
                                    <select
                                      className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPaper)}`}
                                      value={editorialCover.paperId}
                                      onChange={(e) => setEditorialCover((prev) => ({ ...prev, paperId: e.target.value }))}
                                      disabled={!activePapers.length}
                                    >
                                      <option value="">Seleccionar…</option>
                                      {activePapers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.nombre}{p.gramaje ? ` ${p.gramaje}g` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    <p className={HELP_TEXT}>
                                      Define el costo de papel. Papel total ≈ pliegos/unidad × tiraje.
                                    </p>
                                  </div>

                                    {showAdvanced ? (
                                      <>
                                        <div className="grid grid-cols-1 gap-3">
                                          <div>
                                            <Label>Sobrante mínimo (hojas de máquina)</Label>
                                            <Input
                                              className={INPUT_COMPACT}
                                              type="number"
                                              step="1"
                                              min={0}
                                              value={editorialCover.sobranteMinimo}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, sobranteMinimo: e.target.value }))}
                                            />
                                            <p className={HELP_TEXT}>
                                              En editorial este valor se interpreta en hojas de máquina. Si una hoja de máquina saca 2 impresos abiertos, 100 sobrantes equivalen a 200 piezas adicionales.
                                            </p>
                                            {editorialCoverIsPolicromiaAmbasCaras ? (
                                              <p className={HELP_TEXT}>
                                                En policromía ambas caras (4/4) se recomienda duplicar este sobrante (2×) por doble pasada.
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div>
                                          <Label>Acabado (opcional)</Label>
                                          <select
                                            className={SELECT_COMPACT}
                                            value={editorialCover.finishId}
                                            onChange={(e) => setEditorialCover((prev) => ({ ...prev, finishId: e.target.value }))}
                                            disabled={!editorialCoverFinishes.length}
                                          >
                                            <option value="">Ninguno</option>
                                            {editorialCoverFinishes.map((f) => (
                                              <option key={f.id} value={f.id}>
                                                {f.nombre}
                                              </option>
                                            ))}
                                          </select>
                                          <p className={HELP_TEXT}>
                                            Se suma al total (valor fijo del acabado).
                                          </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <Label>Acabado especial</Label>
                                            <select
                                              className={SELECT_COMPACT}
                                              value={editorialCover.specialFinishId}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, specialFinishId: e.target.value }))}
                                              disabled={!activeSpecialFinishes.length}
                                            >
                                              <option value="">Ninguno</option>
                                              {activeSpecialFinishes.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.nombre}
                                                </option>
                                              ))}
                                            </select>
                                            <p className={HELP_TEXT}>
                                              Se suma como valor × cantidad.
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Cantidad</Label>
                                            <Input
                                              className={INPUT_COMPACT}
                                              type="number"
                                              step="1"
                                              min={1}
                                              value={editorialCover.specialFinishQty}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, specialFinishQty: e.target.value }))}
                                            />
                                            <p className={HELP_TEXT}>
                                              Total = valor × cantidad (x{Math.max(0, Math.trunc(parseFloat(String(editorialCover.specialFinishQty || "0")) || 0))}).
                                            </p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <Label>Plastificado</Label>
                                            <select
                                              className={SELECT_COMPACT}
                                              value={editorialCover.plastificadoId}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, plastificadoId: e.target.value }))}
                                              disabled={!activePlastificados.length}
                                            >
                                              <option value="">Ninguno</option>
                                              {activePlastificados.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.nombre}
                                                </option>
                                              ))}
                                            </select>
                                            <p className={HELP_TEXT}>
                                              Se suma como valor × cantidad.
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Cantidad</Label>
                                            <Input
                                              className={INPUT_COMPACT}
                                              type="number"
                                              step="1"
                                              min={1}
                                              value={editorialCover.plastificadoQty}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, plastificadoQty: e.target.value }))}
                                            />
                                            <p className={HELP_TEXT}>
                                              Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialCover.plastificadoQty || "1")) || 0) || 1)}).
                                            </p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <Label>Troquel</Label>
                                            <select
                                              className={SELECT_COMPACT}
                                              value={editorialCover.troqueladoId}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, troqueladoId: e.target.value }))}
                                              disabled={!activeTroquelados.length}
                                            >
                                              <option value="">Ninguno</option>
                                              {activeTroquelados.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.nombre}
                                                </option>
                                              ))}
                                            </select>
                                            <p className={HELP_TEXT}>
                                              Se suma como valor × cantidad.
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Cantidad</Label>
                                            <Input
                                              className={INPUT_COMPACT}
                                              type="number"
                                              step="1"
                                              min={1}
                                              value={editorialCover.troqueladoQty}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, troqueladoQty: e.target.value }))}
                                            />
                                            <p className={HELP_TEXT}>
                                              Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialCover.troqueladoQty || "1")) || 0) || 1)}).
                                            </p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <Label>Troquelada</Label>
                                            <select
                                              className={SELECT_COMPACT}
                                              value={editorialCover.troqueladaId}
                                              onChange={(e) => updateEditorialPart("cover", (prev) => ({ ...prev, troqueladaId: e.target.value }))}
                                              disabled={!activeTroqueladas.length}
                                            >
                                              <option value="">Ninguna</option>
                                              {activeTroqueladas.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.nombre}
                                                </option>
                                              ))}
                                            </select>
                                            <p className={HELP_TEXT}>Se suma como valor × cantidad.</p>
                                          </div>
                                          <div>
                                            <Label>Cantidad</Label>
                                            <Input
                                              className={INPUT_COMPACT}
                                              type="number"
                                              step="1"
                                              min={1}
                                              value={editorialCover.troqueladaQty}
                                              onChange={(e) => updateEditorialPart("cover", (prev) => ({ ...prev, troqueladaQty: e.target.value }))}
                                            />
                                            <p className={HELP_TEXT}>
                                              Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialCover.troqueladaQty || "1")) || 0) || 1)}).
                                            </p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <Label>Corte</Label>
                                            <select
                                              className={SELECT_COMPACT}
                                              value={editorialCover.corteId}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, corteId: e.target.value }))}
                                              disabled={!activeCortes.length}
                                            >
                                              <option value="">Ninguno</option>
                                              {activeCortes.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.nombre}
                                                </option>
                                              ))}
                                            </select>
                                            <p className={HELP_TEXT}>
                                              Se suma como valor × cantidad.
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Cantidad</Label>
                                            <Input
                                              className={INPUT_COMPACT}
                                              type="number"
                                              step="1"
                                              min={1}
                                              value={editorialCover.corteQty}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, corteQty: e.target.value }))}
                                            />
                                            <p className={HELP_TEXT}>
                                              Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialCover.corteQty || "1")) || 0) || 1)}).
                                            </p>
                                          </div>
                                        </div>
                                      </>
                                    ) : null}
                                </div>
                              </div>

                              <div className={`${BOX_BLUR_MUTED} p-3`}>
                                <p className="text-sm font-medium">Internas</p>
                                <p className={HELP_TEXT}>
                                  {(() => {
                                    const formato = resolveEditorialPartSizeOption(editorialInner)
                                    const paper = papers.find((p) => p.id === String(editorialInner.paperId || "").trim())
                                      const machine = profiles.find((p) => p.id === String(editorialInner.machineProfileId || editorialInner.planchaProfileId || "").trim())
                                    const pliegos = editorialSplitCalc?.innerPliegosPorUnidad ?? 0
                                    const caras = editorialSplitCalc?.innerPlanchas ?? 0
                                    const formatoLabel = formato ? `${formato.nombre} (${formato.widthCm}×${formato.heightCm} cm)` : "—"
                                      const finalLabel = editorialClosedSizeLabel || "—"
                                      const machineLabel = machine ? `${machine.nombre} (${formatCm(machine.anchoUtilCm)}×${formatCm(machine.altoUtilCm)} cm)` : "—"
                                    const paperLabel = paper ? `${paper.nombre}${paper.gramaje ? ` ${paper.gramaje}g` : ""}` : "—"
                                      const preview = editorialInnerSheetsPreview
                                      const despiece = preview
                                        ? ` • Despiece: ${preview.piezasPorPliego ?? "—"} pzas/pliego · ${preview.piezasPorHojaMaquina ?? "—"} pzas/hoja · ${preview.hojasMaquinaPorPliego ?? "—"} cortes/pliego`
                                        : ""
                                      return `Pieza abierta: ${formatoLabel} • Cliente: ${finalLabel} • Área útil: ${machineLabel} • Papel: ${paperLabel} • Planchas CMYK base: ${caras * 4} • Pliegos/unidad: ${pliegos}${despiece}`
                                  })()}
                                </p>
                                <div className="mt-3 grid grid-cols-1 gap-3">
                                  <div>
                                    <Label>Cómo vas a imprimir</Label>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Frente</Label>
                                        <select
                                          className={`${SELECT_COMPACT} mt-1`}
                                          value={editorialInner.printInkFront}
                                          onChange={(e) => setEditorialInner((prev) => ({ ...prev, printInkFront: e.target.value }))}
                                        >
                                          {PRINT_INK_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Reverso</Label>
                                        <select
                                          className={`${SELECT_COMPACT} mt-1`}
                                          value={editorialInner.printInkBack}
                                          onChange={(e) => setEditorialInner((prev) => ({ ...prev, printInkBack: e.target.value }))}
                                        >
                                          {PRINT_INK_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <p className={HELP_TEXT}>
                                      Prellena planchas/impresión y ajusta el sobrante mínimo recomendado.
                                    </p>
                                    <p className={HELP_TEXT}>
                                      Selección: {inkLabel(editorialInner.printInkFront)} / {inkLabel(editorialInner.printInkBack)}
                                    </p>
                                    {hasSpecialInk(editorialInner.printInkFront) || hasSpecialInk(editorialInner.printInkBack) ? (
                                      <p className={HELP_TEXT}>
                                        Si usas tintas especiales (Pantone, Dorado, Blanco, Barniz UV), ajusta manualmente el multiplicador de planchas/impresión si aplica.
                                      </p>
                                    ) : null}
                                    {editorialInnerIsPolicromiaAmbasCaras ? (
                                      <p className={HELP_TEXT}>
                                        Para policromía ambas caras (4/4) se duplica el sobrante mínimo (2×) por tiro y retiro.
                                      </p>
                                    ) : null}
                                  </div>

                                  <div>
                                    <Label>Páginas internas</Label>
                                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                                      {Math.max(0, Math.trunc(parseFloat(editorialTotalPaginas) || 0))} páginas
                                    </div>
                                    <p className={HELP_TEXT}>
                                      Defínelas arriba en la guía rápida. Aquí ves su impacto sobre pliegos y papel de internas.
                                    </p>
                                    {editorialInnerSheetsPreview ? (
                                      <div className="mt-2 space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 xl:grid-cols-4">
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Papel</p>
                                            <p>{editorialInnerSheetsPreview.piezasPorPliego ?? "—"} pzas/pliego</p>
                                          </div>
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Maquina</p>
                                            <p>{editorialInnerSheetsPreview.piezasPorHojaMaquina ?? "—"} pzas/hoja</p>
                                          </div>
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Cortes/pliego</p>
                                            <p>{editorialInnerSheetsPreview.hojasMaquinaPorPliego ?? "—"} hojas</p>
                                          </div>
                                          <div className="rounded-md border border-white/70 bg-white/80 p-2">
                                            <p className="font-medium text-slate-900">Papel total</p>
                                            <p>{editorialInnerSheetsPreview.pliegosNecesarios ?? "—"} pliegos</p>
                                          </div>
                                        </div>
                                        <p className={HELP_TEXT}>
                                          Para {editorialInnerSheetsPreview.runQty} unidades: {editorialInnerSheetsPreview.qtyForCompute} piezas finales. El papel se calcula con {editorialInnerSheetsPreview.piezasPorPliego ?? "—"} piezas por pliego; la maquina trabaja a {editorialInnerSheetsPreview.piezasPorHojaMaquina ?? "—"} piezas por hoja y no debe reemplazar ese rendimiento.
                                        </p>
                                        <LitografiaImpositionPreview
                                          sheetWidthCm={editorialInnerSheetsPreview.sheetWidthCm}
                                          sheetHeightCm={editorialInnerSheetsPreview.sheetHeightCm}
                                          machineSheetWidthCm={editorialInnerSheetsPreview.machineSheetWidthCm}
                                          machineSheetHeightCm={editorialInnerSheetsPreview.machineSheetHeightCm}
                                          machineSheetsAcross={editorialInnerSheetsPreview.hojasMaquinaHorizontal}
                                          machineSheetsDown={editorialInnerSheetsPreview.hojasMaquinaVertical}
                                          machineSheetsPerParent={editorialInnerSheetsPreview.hojasMaquinaPorPliego}
                                          utilWidthCm={editorialInnerSheetsPreview.utilWidthCm}
                                          utilHeightCm={editorialInnerSheetsPreview.utilHeightCm}
                                          pieceWidthCm={editorialInnerSheetsPreview.pieceWidthCm}
                                          pieceHeightCm={editorialInnerSheetsPreview.pieceHeightCm}
                                          sheetPiecesAcross={editorialInnerSheetsPreview.piezasHorizontal ?? 0}
                                          sheetPiecesDown={editorialInnerSheetsPreview.piezasVertical ?? 0}
                                          machinePiecesAcross={editorialInnerSheetsPreview.piezasHojaMaquinaHorizontal ?? 0}
                                          machinePiecesDown={editorialInnerSheetsPreview.piezasHojaMaquinaVertical ?? 0}
                                          sheetPiecesPerParent={editorialInnerSheetsPreview.piezasPorPliego}
                                          machinePiecesPerSheet={editorialInnerSheetsPreview.piezasPorHojaMaquina}
                                          paperLabel={editorialInnerSheetsPreview.paperLabel}
                                          formatLabel={editorialInnerSheetsPreview.formatLabel}
                                          machineLabel={editorialInnerSheetsPreview.machineLabel}
                                          sheetArrangementLabel={`${editorialInnerSheetsPreview.piezasHorizontal ?? 0} × ${editorialInnerSheetsPreview.piezasVertical ?? 0}`}
                                          machineArrangementLabel={`${editorialInnerSheetsPreview.piezasHojaMaquinaHorizontal ?? 0} × ${editorialInnerSheetsPreview.piezasHojaMaquinaVertical ?? 0}`}
                                          sheetOrientationLabel={editorialInnerSheetsPreview.orientacionImpresion === "girada" ? "girado" : "normal"}
                                          machineOrientationLabel={editorialInnerSheetsPreview.orientacionCorte === "girada" ? "girado" : "normal"}
                                        />
                                      </div>
                                    ) : null}
                                  </div>

                                  {!showAdvanced ? null : (
                                    <>
                                      <div>
                                        <Label className={requiredLabelClass(validation.missingPlancha)}>Área útil de impresión</Label>
                                        <select
                                          className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                          value={editorialInner.machineProfileId}
                                          onChange={(e) => updateEditorialPart("inner", (prev) => ({ ...prev, machineProfileId: e.target.value }))}
                                          disabled={!activePlanchaProfiles.length}
                                        >
                                          <option value="">Seleccionar área…</option>
                                          {activePlanchaProfiles.map((p) => (
                                            <option key={p.id} value={p.id}>
                                              {p.nombre} ({formatCm(p.anchoUtilCm)}×{formatCm(p.altoUtilCm)} cm)
                                            </option>
                                          ))}
                                        </select>
                                        <p className={HELP_TEXT}>Esta área útil manda el rendimiento de internas sobre el papel. Las planchas van aparte como costo.</p>
                                      </div>

                                      <div>
                                        <div className="flex items-center justify-between gap-2">
                                          <Label className={requiredLabelClass(validation.missingPlancha)}>{t('printshopQuote.fields.platesCost')}</Label>
                                          <Button type="button" variant="outline" size="sm" onClick={() => addEditorialProfileRow("inner", "plancha")}>Agregar otra</Button>
                                        </div>
                                        <div className="mt-2 space-y-2">
                                          {editorialInner.planchaProfileIds.map((id, idx) => (
                                            <div key={`inner-plancha-${idx}-${id}`} className="flex items-center gap-2">
                                              <select
                                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                                value={id}
                                                onChange={(e) => updateEditorialProfileRow("inner", "plancha", idx, e.target.value)}
                                                disabled={!activePlanchaProfiles.length}
                                              >
                                                <option value="">{t('printshopQuote.select.nonePlates')}</option>
                                                {activePlanchaProfiles.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.nombre}</option>
                                                ))}
                                              </select>
                                              <Input
                                                className={`${INPUT_COMPACT} w-24 shrink-0`}
                                                type="number"
                                                min={1}
                                                step="1"
                                                value={editorialInner.planchaProfileQtys[idx] ?? "1"}
                                                onChange={(e) => updateEditorialProfileQty("inner", "plancha", idx, e.target.value)}
                                              />
                                              {editorialInner.planchaProfileIds.length > 1 ? (
                                                <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeEditorialProfileRow("inner", "plancha", idx)}>
                                                  {t('common.remove')}
                                                </Button>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div>
                                        <div className="flex items-center justify-between gap-2">
                                          <Label className={requiredLabelClass(validation.missingTinta)}>{t('printshopQuote.fields.inkCost')}</Label>
                                          <Button type="button" variant="outline" size="sm" onClick={() => addEditorialProfileRow("inner", "tinta")}>Agregar otra</Button>
                                        </div>
                                        <div className="mt-2 space-y-2">
                                          {editorialInner.tintaProfileIds.map((id, idx) => (
                                            <div key={`inner-tinta-${idx}-${id}`} className="flex items-center gap-2">
                                              <select
                                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingTinta)}`}
                                                value={id}
                                                onChange={(e) => updateEditorialProfileRow("inner", "tinta", idx, e.target.value)}
                                                disabled={!activeTintaProfiles.length}
                                              >
                                                <option value="">{t('printshopQuote.select.noneInks')}</option>
                                                {activeTintaProfiles.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.nombre}</option>
                                                ))}
                                              </select>
                                              <Input
                                                className={`${INPUT_COMPACT} w-24 shrink-0`}
                                                type="number"
                                                min={1}
                                                step="1"
                                                value={editorialInner.tintaProfileQtys[idx] ?? "1"}
                                                onChange={(e) => updateEditorialProfileQty("inner", "tinta", idx, e.target.value)}
                                              />
                                              {editorialInner.tintaProfileIds.length > 1 ? (
                                                <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeEditorialProfileRow("inner", "tinta", idx)}>
                                                  {t('common.remove')}
                                                </Button>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  <div>
                                    <Label className={requiredLabelClass(validation.missingPaper)}>{t('printshopQuote.fields.paper')}</Label>
                                    <select
                                      className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPaper)}`}
                                      value={editorialInner.paperId}
                                      onChange={(e) => setEditorialInner((prev) => ({ ...prev, paperId: e.target.value }))}
                                      disabled={!activePapers.length}
                                    >
                                      <option value="">Seleccionar…</option>
                                      {activePapers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.nombre}{p.gramaje ? ` ${p.gramaje}g` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    <p className={HELP_TEXT}>
                                      Define el costo de papel. Papel total ≈ pliegos/unidad × tiraje.
                                    </p>
                                  </div>

                                  {showAdvanced ? (
                                    <>
                                      <div className="grid grid-cols-1 gap-3">
                                        <div>
                                          <Label>Sobrante mínimo (hojas de máquina)</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            step="1"
                                            min={0}
                                            value={editorialInner.sobranteMinimo}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, sobranteMinimo: e.target.value }))}
                                          />
                                          <p className={HELP_TEXT}>
                                            En editorial este valor se interpreta en hojas de máquina. Si una hoja de máquina saca 2 impresos abiertos, 100 sobrantes equivalen a 200 piezas adicionales.
                                          </p>
                                          {editorialInnerIsPolicromiaAmbasCaras ? (
                                            <p className={HELP_TEXT}>
                                              En policromía ambas caras (4/4) se recomienda duplicar este sobrante (2×) por doble pasada.
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div>
                                        <Label>Acabado (opcional)</Label>
                                        <select
                                          className={SELECT_COMPACT}
                                          value={editorialInner.finishId}
                                          onChange={(e) => setEditorialInner((prev) => ({ ...prev, finishId: e.target.value }))}
                                            disabled={!editorialInnerFinishes.length}
                                        >
                                          <option value="">Ninguno</option>
                                            {editorialInnerFinishes.map((f) => (
                                            <option key={f.id} value={f.id}>
                                              {f.nombre}
                                            </option>
                                          ))}
                                        </select>
                                        <p className={HELP_TEXT}>
                                          Se suma al total (valor fijo del acabado).
                                        </p>
                                          {compaginadoFinish?.id === editorialInner.finishId ? (
                                            <p className={HELP_TEXT}>
                                              Compaginado automático: {Math.max(0, Math.ceil((Math.max(0, Math.trunc(parseFloat(editorialTotalPaginas) || 0))) / 2))} hojas internas finales por ejemplar × {Math.max(0, Math.trunc(parseFloat(cantidad) || 0))} ejemplares = {editorialInnerCompaginadoQty}.
                                            </p>
                                          ) : null}
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Acabado especial</Label>
                                          <select
                                            className={SELECT_COMPACT}
                                            value={editorialInner.specialFinishId}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, specialFinishId: e.target.value }))}
                                            disabled={!activeSpecialFinishes.length}
                                          >
                                            <option value="">Ninguno</option>
                                            {activeSpecialFinishes.map((f) => (
                                              <option key={f.id} value={f.id}>
                                                {f.nombre}
                                              </option>
                                            ))}
                                          </select>
                                          <p className={HELP_TEXT}>
                                            Se suma como valor × cantidad.
                                          </p>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            step="1"
                                            min={1}
                                            value={editorialInner.specialFinishQty}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, specialFinishQty: e.target.value }))}
                                          />
                                          <p className={HELP_TEXT}>
                                            Total = valor × cantidad (x{Math.max(0, Math.trunc(parseFloat(String(editorialInner.specialFinishQty || "0")) || 0))}).
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Plastificado</Label>
                                          <select
                                            className={SELECT_COMPACT}
                                            value={editorialInner.plastificadoId}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, plastificadoId: e.target.value }))}
                                            disabled={!activePlastificados.length}
                                          >
                                            <option value="">Ninguno</option>
                                            {activePlastificados.map((f) => (
                                              <option key={f.id} value={f.id}>
                                                {f.nombre}
                                              </option>
                                            ))}
                                          </select>
                                          <p className={HELP_TEXT}>
                                            Se suma como valor × cantidad.
                                          </p>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            step="1"
                                            min={1}
                                            value={editorialInner.plastificadoQty}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, plastificadoQty: e.target.value }))}
                                          />
                                          <p className={HELP_TEXT}>
                                            Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialInner.plastificadoQty || "1")) || 0) || 1)}).
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Troquel</Label>
                                          <select
                                            className={SELECT_COMPACT}
                                            value={editorialInner.troqueladoId}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, troqueladoId: e.target.value }))}
                                            disabled={!activeTroquelados.length}
                                          >
                                            <option value="">Ninguno</option>
                                            {activeTroquelados.map((f) => (
                                              <option key={f.id} value={f.id}>
                                                {f.nombre}
                                              </option>
                                            ))}
                                          </select>
                                          <p className={HELP_TEXT}>
                                            Se suma como valor × cantidad.
                                          </p>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            step="1"
                                            min={1}
                                            value={editorialInner.troqueladoQty}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, troqueladoQty: e.target.value }))}
                                          />
                                          <p className={HELP_TEXT}>
                                            Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialInner.troqueladoQty || "1")) || 0) || 1)}).
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Troquelada</Label>
                                          <select
                                            className={SELECT_COMPACT}
                                            value={editorialInner.troqueladaId}
                                            onChange={(e) => updateEditorialPart("inner", (prev) => ({ ...prev, troqueladaId: e.target.value }))}
                                            disabled={!activeTroqueladas.length}
                                          >
                                            <option value="">Ninguna</option>
                                            {activeTroqueladas.map((f) => (
                                              <option key={f.id} value={f.id}>
                                                {f.nombre}
                                              </option>
                                            ))}
                                          </select>
                                          <p className={HELP_TEXT}>Se suma como valor × cantidad.</p>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            step="1"
                                            min={1}
                                            value={editorialInner.troqueladaQty}
                                            onChange={(e) => updateEditorialPart("inner", (prev) => ({ ...prev, troqueladaQty: e.target.value }))}
                                          />
                                          <p className={HELP_TEXT}>
                                            Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialInner.troqueladaQty || "1")) || 0) || 1)}).
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Corte</Label>
                                          <select
                                            className={SELECT_COMPACT}
                                            value={editorialInner.corteId}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, corteId: e.target.value }))}
                                            disabled={!activeCortes.length}
                                          >
                                            <option value="">Ninguno</option>
                                            {activeCortes.map((f) => (
                                              <option key={f.id} value={f.id}>
                                                {f.nombre}
                                              </option>
                                            ))}
                                          </select>
                                          <p className={HELP_TEXT}>
                                            Se suma como valor × cantidad.
                                          </p>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            step="1"
                                            min={1}
                                            value={editorialInner.corteQty}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, corteQty: e.target.value }))}
                                          />
                                          <p className={HELP_TEXT}>
                                            Total = valor × cantidad (x{Math.max(1, Math.trunc(parseFloat(String(editorialInner.corteQty || "1")) || 0) || 1)}).
                                          </p>
                                        </div>
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!editorialMode ? (
                      <div className="sm:col-span-2">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label className={requiredLabelClass(validation.missingPlancha)}>Área útil de impresión</Label>
                            <select
                              className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                              value={selectedMachineProfileId}
                              onChange={(e) => setSelectedMachineProfileId(e.target.value)}
                              disabled={!activePlanchaProfiles.length}
                            >
                              <option value="">Seleccionar formato…</option>
                              {activePlanchaProfiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre} ({formatCm(p.anchoUtilCm)}×{formatCm(p.altoUtilCm)} cm)
                                </option>
                              ))}
                            </select>
                            <p className={HELP_TEXT}>
                              Aquí defines solamente el área útil de impresión de la máquina. El cálculo de papel usa esta área contra el papel elegido; el costo de planchas se configura aparte más abajo.
                            </p>
                          </div>

                          <div>
                            <Label className={requiredLabelClass(validation.missingFormato)}>{t('printshopQuote.fields.printSize')}</Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant={formatoKey === CUSTOM_PRINT_SIZE_KEY ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormatoKey(CUSTOM_PRINT_SIZE_KEY)}
                              >
                                Usar tamaño personalizado
                              </Button>
                              {formatoKey === CUSTOM_PRINT_SIZE_KEY ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFormatoKey(sizeOptions[0]?.key || "")}
                                >
                                  Volver a tamaños predefinidos
                                </Button>
                              ) : null}
                            </div>
                            <select
                              className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                              value={formatoKey}
                              onChange={(e) => setFormatoKey(e.target.value)}
                              disabled={!allSizeOptions.length}
                            >
                              <option value="" disabled>
                                {allSizeOptions.length ? t('printshopQuote.select.size') : t('printshopQuote.select.noSizesConfigured')}
                              </option>
                              {allSizeOptions.map((p) => (
                                <option key={p.key} value={p.key}>
                                  {p.key === CUSTOM_PRINT_SIZE_KEY ? p.nombre : `${p.nombre} (${p.widthCm}×${p.heightCm} cm)`}
                                </option>
                              ))}
                            </select>
                            {!sizeOptions.length ? (
                              <p className={HELP_TEXT}>
                                {t('printshopQuote.help.createSizes')}
                              </p>
                            ) : null}
                            <p className={HELP_TEXT}>
                              Este es el tamaño final que compra el cliente: carta, media carta, cuarto, octavo, medio pliego o pliego.
                            </p>
                            {formatoKey === CUSTOM_PRINT_SIZE_KEY ? (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <div>
                                  <Label>Ancho final (cm)</Label>
                                  <Input
                                    className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={customFormatoWidthCm}
                                    onChange={(e) => setCustomFormatoWidthCm(e.target.value)}
                                    placeholder="21.6"
                                  />
                                </div>
                                <div>
                                  <Label>Alto final (cm)</Label>
                                  <Input
                                    className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={customFormatoHeightCm}
                                    onChange={(e) => setCustomFormatoHeightCm(e.target.value)}
                                    placeholder="27.9"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {selectedPreset && primaryPaper ? (
                          <div className="mt-3">
                            <LitografiaCutGuide
                              parentWidthCm={primaryPaper.pliegoWidthCm}
                              parentHeightCm={primaryPaper.pliegoHeightCm}
                              finalWidthCm={selectedPreset.widthCm}
                              finalHeightCm={selectedPreset.heightCm}
                              finalLabel={`${selectedPreset.nombre} ${formatCm(selectedPreset.widthCm)}x${formatCm(selectedPreset.heightCm)} cm`}
                              printSheetLabel={primaryMachineProfile?.nombre}
                              runQty={Math.max(0, Math.trunc(parseFloat(cantidad) || 0))}
                              extraQty={Math.max(0, Math.trunc(parseFloat(sobranteMinimo) || 0))}
                              gapCm={primaryMachineGap}
                              machineWidthCm={primaryMachineWidth}
                              machineHeightCm={primaryMachineHeight}
                            />
                          </div>
                        ) : null}
                      </div>
                      ) : null}

                      {!editorialMode && showAdvanced ? (
                      <div className="sm:col-span-2">
                        <Label className={requiredLabelClass(validation.missingPlancha)}>Planchas (avanzado)</Label>
                        <div className="mt-2 space-y-2">
                          {selectedPlanchaProfileIds.map((id, idx) => (
                            <div key={`${idx}-${id}`} className="flex items-center gap-2">
                              <select
                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                value={id}
                                onChange={(e) => updatePlanchaRow(idx, e.target.value)}
                                disabled={!activePlanchaProfiles.length}
                              >
                                <option value="">{t('printshopQuote.select.nonePlates')}</option>
                                {activePlanchaProfiles.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>

                              <Input
                                className={`${INPUT_COMPACT} w-24 shrink-0`}
                                type="number"
                                min={1}
                                step="1"
                                value={selectedPlanchaProfileQtys[idx] ?? "1"}
                                onChange={(e) => updatePlanchaQty(idx, e.target.value)}
                                placeholder={t('printshopQuote.placeholders.qtyShort')}
                              />

                              {selectedPlanchaProfileIds.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => removePlanchaRow(idx)}
                                >
                                  {t('common.remove')}
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] leading-tight text-muted-foreground">{t('printshopQuote.help.multiplePlateProfiles')}</span>
                          <Button type="button" variant="outline" size="sm" onClick={addPlanchaRow}>
                            {t('common.addAnother')}
                          </Button>
                        </div>
                        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                          {primaryPlanchaProfile ? (
                            <>
                              {t('printshopQuote.summary.totalPlates', { total: formatCurrency(planchaCostConfigured) })} Área útil elegida: {formatCm(primaryMachineWidth)}×{formatCm(primaryMachineHeight)} cm.
                            </>
                          ) : (
                            <>{t('printshopQuote.help.selectPlates')}</>
                          )}
                        </p>
                        <p className={HELP_TEXT}>
                          Estas filas solo suman costo de planchas. El área útil de impresión se define arriba y ya no depende de esta primera fila.
                        </p>
                      </div>
                      ) : null}

                      {!editorialMode && showAdvanced ? (
                      <div className="sm:col-span-2">
                        <Label className={requiredLabelClass(validation.missingTinta)}>{t('printshopQuote.fields.inkCost')}</Label>
                        <div className="mt-2 space-y-2">
                          {selectedTintaProfileIds.map((id, idx) => (
                            <div key={`${idx}-${id}`} className="flex items-center gap-2">
                              <select
                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingTinta)}`}
                                value={id}
                                onChange={(e) => updateTintaRow(idx, e.target.value)}
                                disabled={!activeTintaProfiles.length}
                              >
                                <option value="">{t('printshopQuote.select.noneInks')}</option>
                                {activeTintaProfiles.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>

                              <Input
                                className={`${INPUT_COMPACT} w-24 shrink-0`}
                                type="number"
                                min={1}
                                step="1"
                                value={selectedTintaProfileQtys[idx] ?? "1"}
                                onChange={(e) => updateTintaQty(idx, e.target.value)}
                                placeholder={t('printshopQuote.placeholders.qtyShort')}
                              />

                              {selectedTintaProfileIds.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => removeTintaRow(idx)}
                                >
                                  {t('common.remove')}
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] leading-tight text-muted-foreground">{t('printshopQuote.help.multipleInkProfiles')}</span>
                          <Button type="button" variant="outline" size="sm" onClick={addTintaRow}>
                            {t('common.addAnother')}
                          </Button>
                        </div>
                        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                          {primaryTintaProfile ? (
                            <>{t('printshopQuote.summary.totalInks', { total: formatCurrency(tintaCostConfigured) })}</>
                          ) : (
                            <>{t('printshopQuote.help.selectInks')}</>
                          )}
                        </p>
                        <p className={HELP_TEXT}>
                          Si agregas varias filas, se suman. Cada “Cantidad” multiplica ese perfil.
                        </p>
                      </div>
                      ) : null}

                      {!editorialMode ? (
                        <>
                        <div className="sm:col-span-2">
                          <Label className={requiredLabelClass(validation.missingPaper)}>{t('printshopQuote.fields.paper')}</Label>

                          {showAdvanced ? (
                            <>
                              <div className="mt-2 space-y-2">
                                {paperRows.map((row, idx) => (
                                  <div key={`${idx}-${row.paperId}`} className="flex items-center gap-2">
                                    <select
                                      className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPaper)}`}
                                      value={row.paperId}
                                      onChange={(e) => updatePaperRow(idx, e.target.value)}
                                      disabled={!activePapers.length}
                                    >
                                      <option value="">{t('printshopQuote.select.nonePaper')}</option>
                                      {activePapers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.nombre}{p.gramaje ? ` • ${p.gramaje}g` : ""} • {formatCurrency(p.costoPliego)}/pliego
                                        </option>
                                      ))}
                                    </select>
                                    {idx === 0 ? (
                                      <div className="min-w-[120px] text-[10px] leading-tight text-muted-foreground">
                                        {t('printshopQuote.paper.runLabel', { qty: String(cantidad || "0") })}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="w-24">
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            min={0}
                                            step="1"
                                            value={row.qty}
                                            onChange={(e) => updatePaperQty(idx, e.target.value)}
                                            placeholder={t('printshopQuote.paper.qtyPlaceholder')}
                                          />
                                        </div>
                                        <div className="w-28">
                                          <select
                                            className={SELECT_COMPACT}
                                            value={row.formatoKey || formatoKey}
                                            onChange={(e) => updatePaperFormato(idx, e.target.value)}
                                            disabled={!allSizeOptions.length}
                                          >
                                            {allSizeOptions.map((s) => (
                                              <option key={s.key} value={s.key}>
                                                {s.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </>
                                    )}
                                    {idx > 0 ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600"
                                        onClick={() => removePaperRow(idx)}
                                      >
                                        {t('common.remove')}
                                      </Button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] leading-tight text-muted-foreground">
                                  {t('printshopQuote.help.paperRows')}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Button type="button" variant="outline" size="sm" onClick={() => setPaperRequestOpen(true)}>
                                    Agregar papel
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={addPaperRow}>
                                    {t('common.addAnother')}
                                  </Button>
                                </div>
                              </div>
                              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                                {primaryPaper ? (
                                  <>{t('printshopQuote.paper.primarySheet', { w: primaryPaper.pliegoWidthCm, h: primaryPaper.pliegoHeightCm })}</>
                                ) : (
                                  <>{t('printshopQuote.help.selectPaper')}</>
                                )}
                              </p>
                              <p className={HELP_TEXT}>
                                Fila principal: usa el tiraje. Filas adicionales: usan su propia cantidad y se suman.
                              </p>

                              <div className="mt-2">
                                <Label>{t('printshopQuote.fields.minExtraUnits')}</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  type="number"
                                  min={0}
                                  step="1"
                                  value={sobranteMinimo}
                                  onChange={(e) => setSobranteMinimo(e.target.value)}
                                  placeholder="100"
                                />
                                <p className={HELP_TEXT}>
                                  {t('printshopQuote.help.minExtraUnits')}
                                </p>
                                {isPolicromiaAmbasCaras ? (
                                  <p className={HELP_TEXT}>
                                    Como es policromía ambas caras (4/4), aquí se aplica un sobrante mínimo 2× por tiro y retiro.
                                  </p>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="mt-2 flex items-center gap-2">
                                <select
                                  className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPaper)}`}
                                  value={paperRows[0]?.paperId ?? ""}
                                  onChange={(e) => updatePaperRow(0, e.target.value)}
                                  disabled={!activePapers.length}
                                >
                                  <option value="">{t('printshopQuote.select.nonePaper')}</option>
                                  {activePapers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nombre}{p.gramaje ? ` • ${p.gramaje}g` : ""} • {formatCurrency(p.costoPliego)}/pliego
                                    </option>
                                  ))}
                                </select>
                                <div className="min-w-[120px] text-[10px] leading-tight text-muted-foreground">
                                  {t('printshopQuote.paper.runLabel', { qty: String(cantidad || "0") })}
                                </div>
                              </div>
                              <div className="mt-2 flex justify-end">
                                <Button type="button" variant="outline" size="sm" onClick={() => setPaperRequestOpen(true)}>
                                  Agregar papel
                                </Button>
                              </div>
                              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                                {primaryPaper ? (
                                  <>{t('printshopQuote.paper.primarySheet', { w: primaryPaper.pliegoWidthCm, h: primaryPaper.pliegoHeightCm })}</>
                                ) : (
                                  <>{t('printshopQuote.help.selectPaper')}</>
                                )}
                              </p>
                              <p className={HELP_TEXT}>
                                Costos prellenados automáticamente. Abre “Opciones avanzadas” para sobrante mínimo y varias filas de papel.
                              </p>
                            </>
                          )}
                        </div>

                        {showAdvanced ? (
                          <>
                            <div className="sm:col-span-2">
                              <Label>{t('printshopQuote.fields.finishes')}</Label>
                              <div className="mt-2 space-y-2">
                                {selectedFinishIds.map((id, idx) => (
                                  <div key={`${idx}-${id}`} className="flex items-center gap-2">
                                    <select
                                      className={SELECT_COMPACT}
                                      value={id}
                                      onChange={(e) => updateFinishRow(idx, e.target.value)}
                                    >
                                      <option value="">{t('printshopQuote.select.noneFinish')}</option>
                                      {activeFinishes.map((f) => (
                                        <option key={f.id} value={f.id}>
                                          {f.nombre}
                                        </option>
                                      ))}
                                    </select>
                                    {selectedFinishIds.length > 1 ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600"
                                        onClick={() => removeFinishRow(idx)}
                                      >
                                        {t('common.remove')}
                                      </Button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] leading-tight text-muted-foreground">{t('printshopQuote.help.multipleFinishes')}</span>
                                <Button type="button" variant="outline" size="sm" onClick={addFinishRow}>
                                  {t('common.addAnother')}
                                </Button>
                              </div>
                              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                                {finishIdsNormalized.length
                                  ? <>{t('printshopQuote.selectedList', { list: selectedFinishes.map((f) => f.nombre).join(", ") })}</>
                                  : <>{t('printshopQuote.examples.finish')}</>}
                              </p>
                              <p className={HELP_TEXT}>
                                Se suman al total. Si seleccionas varias filas, se acumulan.
                              </p>
                            </div>

                            <div className="sm:col-span-2">
                              <Label>{t('printshopQuote.fields.lamination')}</Label>
                              <div className="mt-2 flex items-center gap-2">
                                <select
                                  className={`${SELECT_COMPACT} mt-0`}
                                  value={selectedPlastificadoId}
                                  onChange={(e) => setSelectedPlastificadoId(e.target.value)}
                                  disabled={!activePlastificados.length}
                                >
                                  <option value="">{t('printshopQuote.select.noneLamination')}</option>
                                  {activePlastificados.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.nombre}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  className={`${INPUT_COMPACT} w-24 shrink-0`}
                                  type="number"
                                  min={1}
                                  step="1"
                                  value={selectedPlastificadoQty}
                                  onChange={(e) => setSelectedPlastificadoQty(e.target.value)}
                                  placeholder={t('printshopQuote.placeholders.qtyShort')}
                                />
                              </div>
                              {!activePlastificados.length ? (
                                <p className={HELP_TEXT}>
                                  {t('printshopQuote.help.configureLamination')}
                                </p>
                              ) : null}
                              {selectedPlastificado ? (
                                <p className={HELP_TEXT}>
                                  Total = {formatCurrency(plastificadoCost)} × {plastificadoQty} = {formatCurrency(plastificadoCostTotal)}.
                                </p>
                              ) : (
                                <p className={HELP_TEXT}>Opcional. Si eliges uno, se multiplica por la cantidad.</p>
                              )}
                            </div>

                            <div className="sm:col-span-2">
                              <Label>{t('printshopQuote.fields.dieCut')}</Label>
                              <div className="mt-2 flex items-center gap-2">
                                <select
                                  className={`${SELECT_COMPACT} mt-0`}
                                  value={selectedTroqueladoId}
                                  onChange={(e) => setSelectedTroqueladoId(e.target.value)}
                                  disabled={!activeTroquelados.length}
                                >
                                  <option value="">{t('printshopQuote.select.noneDieCut')}</option>
                                  {activeTroquelados.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.nombre}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  className={`${INPUT_COMPACT} w-24 shrink-0`}
                                  type="number"
                                  min={1}
                                  step="1"
                                  value={selectedTroqueladoQty}
                                  onChange={(e) => setSelectedTroqueladoQty(e.target.value)}
                                  placeholder={t('printshopQuote.placeholders.qtyShort')}
                                />
                              </div>
                              {!activeTroquelados.length ? (
                                <p className={HELP_TEXT}>
                                  {t('printshopQuote.help.configureDieCut')}
                                </p>
                              ) : null}
                              {selectedTroquelado ? (
                                <p className={HELP_TEXT}>
                                  Total = {formatCurrency(troqueladoCost)} × {troqueladoQty} = {formatCurrency(troqueladoCostTotal)}.
                                </p>
                              ) : (
                                <p className={HELP_TEXT}>Opcional. Si eliges uno, se multiplica por la cantidad.</p>
                              )}
                            </div>

                            <div className="sm:col-span-2">
                              <Label>Troquelada</Label>
                              <div className="mt-2 flex items-center gap-2">
                                <select
                                  className={`${SELECT_COMPACT} mt-0`}
                                  value={selectedTroqueladaId}
                                  onChange={(e) => setSelectedTroqueladaId(e.target.value)}
                                  disabled={!activeTroqueladas.length}
                                >
                                  <option value="">Sin troquelada</option>
                                  {activeTroqueladas.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.nombre}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  className={`${INPUT_COMPACT} w-24 shrink-0`}
                                  type="number"
                                  min={1}
                                  step="1"
                                  value={selectedTroqueladaQty}
                                  onChange={(e) => setSelectedTroqueladaQty(e.target.value)}
                                  placeholder={t('printshopQuote.placeholders.qtyShort')}
                                />
                              </div>
                              {!activeTroqueladas.length ? (
                                <p className={HELP_TEXT}>
                                  Configura opciones de troquelada en Configuración.
                                </p>
                              ) : null}
                              {selectedTroquelada ? (
                                <p className={HELP_TEXT}>
                                  Total = {formatCurrency(troqueladaCost)} × {troqueladaQty} = {formatCurrency(troqueladaCostTotal)}.
                                </p>
                              ) : (
                                <p className={HELP_TEXT}>Opcional. Este valor corresponde a troquelar el producto con un troquel existente.</p>
                              )}
                            </div>

                            <div className="sm:col-span-2">
                              <Label>{t('printshopQuote.fields.cut')}</Label>
                              <div className="mt-2 flex items-center gap-2">
                                <select
                                  className={`${SELECT_COMPACT} mt-0`}
                                  value={selectedCorteId}
                                  onChange={(e) => setSelectedCorteId(e.target.value)}
                                  disabled={!activeCortes.length}
                                >
                                  <option value="">{t('printshopQuote.select.noneCut')}</option>
                                  {activeCortes.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.nombre}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  className={`${INPUT_COMPACT} w-24 shrink-0`}
                                  type="number"
                                  min={1}
                                  step="1"
                                  value={selectedCorteQty}
                                  onChange={(e) => setSelectedCorteQty(e.target.value)}
                                  placeholder={t('printshopQuote.placeholders.qtyShort')}
                                />
                              </div>
                              {!activeCortes.length ? (
                                <p className={HELP_TEXT}>
                                  {t('printshopQuote.help.configureCut')}
                                </p>
                              ) : null}
                              {selectedCorte ? (
                                <p className={HELP_TEXT}>
                                  Total = {formatCurrency(corteCost)} × {corteQty} = {formatCurrency(corteCostTotal)}.
                                </p>
                              ) : (
                                <p className={HELP_TEXT}>Opcional. Si eliges uno, se multiplica por la cantidad.</p>
                              )}
                            </div>

                            <div className="sm:col-span-2">
                              <Label>{t('printshopQuote.fields.specialFinishes')}</Label>
                              <p className={HELP_TEXT}>
                                Cada fila: valor del acabado especial × cantidad. Se acumulan entre filas.
                              </p>
                              <div className="mt-2 space-y-2">
                                {specialFinishRows.map((row, idx) => {
                                  const finishId = String(row.finishId || "").trim()
                                  const selected = finishId ? activeSpecialFinishes.find((f) => f.id === finishId) || null : null

                                  return (
                                    <div key={`${idx}-${finishId}`} className="flex items-center gap-2">
                                      <select
                                        className={SELECT_COMPACT}
                                        value={finishId}
                                        onChange={(e) => updateSpecialFinishRow(idx, e.target.value)}
                                      >
                                        <option value="">{t('common.select')}</option>
                                        {activeSpecialFinishes.map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.nombre}
                                          </option>
                                        ))}
                                      </select>

                                      <span className="text-[10px] leading-tight text-muted-foreground whitespace-nowrap">
                                        {selected ? `${formatCurrency(selected.valor || 0)} ${t('quoteBuilder.items.each')}` : ""}
                                      </span>

                                      <Input
                                        className={`${INPUT_COMPACT} w-24 shrink-0`}
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={row.qty ?? "1"}
                                        onChange={(e) => updateSpecialFinishQty(idx, e.target.value)}
                                        placeholder={t('printshopQuote.placeholders.qtyShort')}
                                      />

                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600"
                                        onClick={() => removeSpecialFinishRow(idx)}
                                      >
                                        {t('common.remove')}
                                      </Button>
                                    </div>
                                  )
                                })}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] leading-tight text-muted-foreground">{t('printshopQuote.help.multipleSpecialFinishes')}</span>
                                <Button type="button" variant="outline" size="sm" onClick={addSpecialFinishRow}>
                                  {t('printshopQuote.actions.addAnotherSpecialFinish')}
                                </Button>
                              </div>
                              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                                {selectedSpecialFinishNames.length
                                  ? <>{t('printshopQuote.selectedList', { list: selectedSpecialFinishNames.join(", ") })}</>
                                  : <>{t('printshopQuote.examples.specialFinishes')}</>}
                              </p>

                              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                                {t('printshopQuote.summary.totalSpecialFinishes', { total: formatCurrency(specialFinishesCost) })}
                              </p>
                            </div>
                          </>
                        ) : null}
                        </>

                      ) : null}

                      {showAdvanced ? (
                        <>
                          <div className="sm:col-span-2">
                            <Label>
                              {t('printshopQuote.fields.margin')} <small>{t('printshopQuote.fields.optionalPctHint')}</small>
                            </Label>
                            <Input
                              className={INPUT_COMPACT}
                              type="number"
                              min={40}
                              max={500}
                              step="1"
                              value={margenPct}
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === "") {
                                  setMargenPct("")
                                  return
                                }
                                const n = parseFloat(v)
                                if (!Number.isFinite(n)) {
                                  setMargenPct(v)
                                  return
                                }

                                // No clampa al teclear un solo dígito (para no romper 45, 400, etc.)
                                if (String(v).trim().length >= 2 && n < 40) {
                                  setMargenPct("40")
                                  return
                                }
                                if (n > 500) {
                                  setMargenPct("500")
                                  return
                                }
                                setMargenPct(v)
                              }}
                              onBlur={() => {
                                const n = parseFloat(String(margenPct))
                                if (!Number.isFinite(n) || n < 40) {
                                  setMargenPct("40")
                                  return
                                }
                                if (n > 500) {
                                  setMargenPct("500")
                                  return
                                }
                                setMargenPct(String(Math.trunc(n)))
                              }}
                              placeholder="40"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">{t('printshopQuote.margin.help')}</p>
                            <p className={HELP_TEXT}>
                              Precio final = precio base × (1 + %/100).
                            </p>
                            <p className={HELP_TEXT}>
                              IVA del ítem litografía: +{LITOGRAFIA_ITEM_IVA_PCT}% sobre el precio final de este ítem.
                            </p>
                          </div>

                          <div className="sm:col-span-2">
                            <Label>{t('printshopQuote.fields.transport')}</Label>
                            <SearchableNativeSelect
                              value={selectedTransporteKey}
                              onChange={(v) => setSelectedTransporteKey(v)}
                              disabled={transporteOptionsLoading}
                              searchClassName={INPUT_COMPACT}
                              selectClassName={SELECT_COMPACT}
                              includeAllOption={{ value: "", label: t('printshopQuote.select.noneTransport') }}
                              options={transporteOptions.map((o) => ({ value: o.value, label: `${o.label} • ${formatCurrency(o.total)}` }))}
                              searchPlaceholder={t('printshopQuote.placeholders.searchTransport')}
                              emptyText={transporteOptions.length ? t('common.noResults') : t('printshopQuote.select.noTransportConfigured')}
                            />
                            <p className={HELP_TEXT}>{t('printshopQuote.help.transportOptional')}</p>
                            {selectedTransporte ? (
                              <p className={HELP_TEXT}>
                                Zona: {selectedTransporte.label} • Se suma {formatCurrency(selectedTransporte.total)} al total.
                              </p>
                            ) : null}
                          </div>
                        </>
                      ) : null}

                      <div className="sm:col-span-2">
                        <Label>{t('printshopQuote.fields.notes')}</Label>
                        <Textarea
                          className="mt-2 min-h-[72px] text-sm"
                          value={descripcion}
                          onChange={(e) => setDescripcion(e.target.value)}
                          placeholder={t('printshopQuote.placeholders.notes')}
                          rows={3}
                        />
                        <p className={HELP_TEXT}>
                          Notas internas para la descripción del ítem (no afectan costos).
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        {pricingError ? <p className="text-sm text-red-600">{pricingError}</p> : null}
                        {!pricingError && configError ? <p className="text-sm text-red-600">{configError}</p> : null}
                      </div>

                      {showAdvanced ? (
                        <div className={`sm:col-span-2 ${BOX_BLUR_MUTED} p-3`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{t('printshopQuote.customFields.title')}</p>
                              <p className="text-xs text-muted-foreground">{t('printshopQuote.customFields.description')}</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                              {t('printshopQuote.customFields.addField')}
                            </Button>
                          </div>

                          <div className="mt-3 space-y-3">
                            {customFields.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t('printshopQuote.customFields.empty')}</p>
                            ) : (
                              customFields.map((f) => (
                                <div key={f.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">{t('printshopQuote.customFields.label')}</Label>
                                    <Input
                                      className={INPUT_COMPACT}
                                      value={f.label}
                                      onChange={(e) => updateCustomField(f.id, { label: e.target.value })}
                                      placeholder={t('printshopQuote.customFields.labelPlaceholder')}
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">{t('printshopQuote.customFields.value')}</Label>
                                    <Input
                                      className={INPUT_COMPACT}
                                      value={f.value}
                                      onChange={(e) => updateCustomField(f.id, { value: e.target.value })}
                                      placeholder={t('printshopQuote.customFields.valuePlaceholder')}
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="text-red-600"
                                      onClick={() => removeCustomField(f.id)}
                                    >
                                      {t('common.remove')}
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                          ) : null}
                        </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className={`${BOX_BLUR} lg:sticky lg:top-4 self-start`}>
                  <CardHeader>
                    <CardTitle>{t('printshopQuote.sections.result')}</CardTitle>
                    <CardDescription className="text-xs">
                      {fallbackCalc
                        ? t('printshopQuote.result.estimated')
                        : isAdmin && calc
                          ? t('printshopQuote.result.adminCalc')
                          : t('printshopQuote.result.estimated')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <>
                      {fallbackCalc ? (
                        <>
                          <div className={`${BOX_BLUR_MUTED} bg-muted/20 p-3 text-xs text-muted-foreground space-y-1`}>
                            <div className="flex justify-between">
                              <span>{t('printshopQuote.estimate.mode')}</span>
                              <span className="font-medium">{t('printshopQuote.estimate.value')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t('printshopQuote.estimate.sheets')}</span>
                              <span className="font-medium">{fallbackCalc.pliegosNecesarios ?? "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Pliegos base</span>
                              <span className="font-medium">{fallbackCalc.hojasMaquinaNecesarias ?? "—"}</span>
                            </div>
                          </div>

                          {activeProductionSummary ? (
                            <div className={`${BOX_BLUR_MUTED} bg-muted/10 p-3 text-xs text-muted-foreground`}>
                              {activeProductionSummary.detail}
                            </div>
                          ) : null}

                          <div className="border-t pt-3">
                            {(() => {
                              const quote = estimatedQuoteAmounts
                              if (!quote) return null
                              return (
                                <>
                                  <div className="space-y-1">
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.admin.plate')}</span><span className="font-medium">{formatCurrency(fallbackCalc.plancha || 0)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.admin.ink')}</span><span className="font-medium">{formatCurrency(fallbackCalc.tinta || 0)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.desc.paper')}</span><span className="font-medium">{formatCurrency(fallbackCalc.papel || 0)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.breakdown.transport')}</span><span className="font-medium">{formatCurrency(fallbackCalc.transporte || 0)}</span></div>
                                  </div>

                                  <div className="flex justify-between mt-2"><span className="text-muted-foreground">{t('printshopQuote.breakdown.baseEstimated')}</span><span className="font-medium">{formatCurrency(quote.baseValue)}</span></div>
                                  {quote.addFinishesCost ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.finishes')}</span><span className="font-medium">{formatCurrency(quote.addFinishesCost)}</span></div> : null}
                                  {quote.addSpecialFinishesCost ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.specialFinishes')}</span><span className="font-medium">{formatCurrency(quote.addSpecialFinishesCost)}</span></div> : null}
                                  {quote.addPlastificadoCost ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.lamination')}{plastificadoQty > 1 ? ` (x${plastificadoQty})` : ""}</span><span className="font-medium">{formatCurrency(quote.addPlastificadoCost)}</span></div> : null}
                                  {quote.addTroqueladoCost ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.dieCut')}{troqueladoQty > 1 ? ` (x${troqueladoQty})` : ""}</span><span className="font-medium">{formatCurrency(quote.addTroqueladoCost)}</span></div> : null}
                                  {quote.addTroqueladaCost ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">Troquelada{troqueladaQty > 1 ? ` (x${troqueladaQty})` : ""}</span><span className="font-medium">{formatCurrency(quote.addTroqueladaCost)}</span></div> : null}
                                  {quote.addCorteCost ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.cut')}{corteQty > 1 ? ` (x${corteQty})` : ""}</span><span className="font-medium">{formatCurrency(quote.addCorteCost)}</span></div> : null}
                                  {quote.extras ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.extraFields')}</span><span className="font-medium">{formatCurrency(quote.extras)}</span></div> : null}
                                  <div className="flex justify-between mt-2"><span className="text-muted-foreground">Precio ítem sin IVA</span><span className="font-medium">{formatCurrency(quote.subtotalSinIva)}</span></div>
                                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">IVA ítem ({quote.ivaPct}%)</span><span className="font-medium">{formatCurrency(quote.ivaValue)}</span></div>
                                  <div className="flex justify-between mt-2"><span className="font-medium">Total ítem</span><span className="font-bold text-blue-700">{formatCurrency(quote.subtotalConIva)}</span></div>
                                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.unit')}</span><span className="font-medium">{formatCurrency(quote.subtotalConIva)}</span></div>
                                </>
                              )
                            })()}
                          </div>
                        </>
                      ) : isAdmin && calc ? (
                        <>
                          <>
                          {calc.papelModo === "pliego" ? (
                            <div className={`${BOX_BLUR_MUTED} bg-muted/20 p-3 text-xs text-muted-foreground space-y-1`}>
                              <div className="flex justify-between">
                                <span>{t('printshopQuote.admin.wasteRun')}</span>
                                <span className="font-medium">{Math.ceil(calc.qtyConDesperdicio)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Piezas por pliego base</span>
                                <span className="font-medium">{calc.piezasPorPliego ?? "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Pliegos requeridos</span>
                                <span className="font-medium">{calc.hojasMaquinaNecesarias ?? "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Pliegos de papel requeridos</span>
                                <span className="font-medium">{calc.pliegosNecesarios ?? "—"}</span>
                              </div>
                            </div>
                          ) : null}

                          {activeProductionSummary ? (
                            <div className={`${BOX_BLUR_MUTED} bg-muted/10 p-3 text-xs text-muted-foreground`}>
                              {activeProductionSummary.detail}
                            </div>
                          ) : null}

                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printshopQuote.admin.plate')}</span>
                            <span className="font-medium">{formatCurrency(calc.plancha || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printshopQuote.admin.ink')}</span>
                            <span className="font-medium">{formatCurrency(calc.tinta || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printshopQuote.desc.paper')}</span>
                            <span className="font-medium">{formatCurrency(calc.papel || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printshopQuote.desc.cut')}</span>
                            <span className="font-medium">{formatCurrency(calc.corte || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printshopQuote.desc.finishes')}</span>
                            <span className="font-medium">{formatCurrency(calc.acabados || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printshopQuote.desc.transport')}</span>
                            <span className="font-medium">{formatCurrency(calc.transporte || 0)}</span>
                          </div>

                          <div className="border-t pt-3">
                            <div className="flex justify-between">
                              <span className="font-medium">{t('printshopQuote.admin.productionCost')}</span>
                              <span className="font-bold">{formatCurrency(calc.costoProduccion || 0)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-muted-foreground">{t('printshopQuote.admin.unitCost')}</span>
                              <span className="font-medium">{formatCurrency(calc.costoUnitario)}</span>
                            </div>
                          </div>

                          <div className="border-t pt-3">
                            {(() => {
                              const quote = adminQuoteAmounts
                              if (!quote) return null
                              return (
                                <>
                                  <div className="flex justify-between">
                                    <span className="font-medium">{t('printshopQuote.admin.salePrice')}</span>
                                    <span className="font-bold">{formatCurrency(quote.subtotalSinIva)}</span>
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-muted-foreground">IVA ítem ({quote.ivaPct}%)</span>
                                    <span className="font-medium">{formatCurrency(quote.ivaValue)}</span>
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="font-medium">Total ítem con IVA</span>
                                    <span className="font-bold text-blue-700">{formatCurrency(quote.subtotalConIva)}</span>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                          </>
                        </>
                      ) : null}

                      <div className="border-t pt-3">
                        <Label className="text-xs">{t('printshopQuote.customFields.preview')}</Label>
                        <pre className={`mt-1 whitespace-pre-wrap ${BOX_BLUR_MUTED} bg-muted/30 p-3 text-xs leading-relaxed`}>
                          {buildDescripcion()}
                        </pre>
                      </div>
                    </>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="border-t bg-background p-4">
            {aiProposalNotice ? (
              <div
                className={cn(
                  "mb-3 rounded-md border px-3 py-2 text-sm",
                  aiProposalNotice.tone === "ready"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}
              >
                {aiProposalNotice.message}
              </div>
            ) : null}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                {t('common.close')}
              </Button>
              <Button
                type="button"
                onClick={handleAddToCotizacion}
                disabled={!canAdd}
              >
                {props.edit?.itemId
                  ? t('printshopQuote.actions.updateItem')
                  : aiProposalNotice?.tone === "ready"
                    ? t('printshopQuote.actions.addAiProposal')
                    : t('printshopQuote.actions.addToQuote')}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
