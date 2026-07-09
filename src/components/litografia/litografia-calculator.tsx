"use client"

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LitografiaPaperRequestsAdminDialog } from "@/components/litografia/litografia-paper-requests-admin-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SearchableNativeSelect } from "@/components/ui/searchable-native-select"
import { computeLitografia } from "@/lib/litografia"
import type { LitografiaAiHandoff } from "@/lib/litografia-ai-handoff"
import { buildLitografiaVisualCatalogTemplateItems } from "@/lib/litografia-visual-products"
import { formatCurrency } from "@/lib/utils"

type PapelTipo = "bond" | "propalcote" | "periodico" | "otro"

const CUSTOM_DROPDOWN_KEYS = {
  transporte: "litografia_transporte",
  tirajeTiers: "litografia_tiraje_tiers",
  editorialProducto: "litografia_editorial_producto",
  visualCatalog: "litografia_visual_catalog",
} as const

// Plantillas para bootstrap (se copian a BD por empresa y luego son editables)
const TRANSPORTE_TEMPLATE_ITEMS = [
  { value: "norte", label: "Norte", meta: { total: 20000 } },
  { value: "sur", label: "Sur", meta: { total: 40000 } },
  { value: "fuera_bogota", label: "Fuera de Bogotá", meta: { total: 60000 } },
]

const TIRAJE_TIER_TEMPLATE_ITEMS = [
  { value: "1_500", label: "1–500", meta: { min: 1, max: 500 } },
  { value: "501_1000", label: "501–1000", meta: { min: 501, max: 1000 } },
  { value: "1001_2000", label: "1001–2000", meta: { min: 1001, max: 2000 } },
  { value: "2001_5000", label: "2001–5000", meta: { min: 2001, max: 5000 } },
  { value: "5001_10000", label: "5001–10000", meta: { min: 5001, max: 10000 } },
]

const EDITORIAL_PRODUCTO_TEMPLATE_ITEMS = [
  {
    value: "revista",
    label: "Revista",
    meta: { kind: "REVISTA", totalPaginas: 32, paginasPortadaContraportada: 2, cartasPorPlancha: 2, paginasPorPliego: 4 },
  },
  {
    value: "cartilla",
    label: "Cartilla",
    meta: { kind: "CARTILLA", totalPaginas: 16, paginasPortadaContraportada: 0, cartasPorPlancha: 2, paginasPorPliego: 4 },
  },
  {
    value: "libro",
    label: "Libro",
    meta: { kind: "LIBRO", totalPaginas: 100, paginasPortadaContraportada: 0, cartasPorPlancha: 2, paginasPorPliego: 4 },
  },
]

const VISUAL_CATALOG_TEMPLATE_ITEMS = buildLitografiaVisualCatalogTemplateItems()

const INPUT_COMPACT = "h-7 px-2 text-xs"
const SELECT_COMPACT = "mt-2 h-8 w-full rounded-md border bg-background px-2 text-xs"
const SELECT_INLINE = "h-8 rounded-md border bg-background px-2 text-xs"

function MoneyInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
      <Input {...props} className={`${className ?? ""} pl-5`} />
    </div>
  )
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

type LitografiaProducto = {
  id: string
  nombre: string
  descripcion: string | null
  formatoKey: string
  tintas: 1 | 2 | 4
  paperRateId: string
  finishOptionId: string | null
  activo: boolean
}

type FlyerRate = {
  id: string
  productoId: string | null
  producto?: { id: string; nombre: string } | null
  formatoKey: string
  tintas: 1 | 2 | 4
  tirajeMin: number
  tirajeMax: number
  paperRateId: string | null
  finishOptionId: string | null
  precioTotal: number
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

type ApiEnvelope = { ok?: unknown; data?: unknown; error?: unknown }

function asApiEnvelope(value: unknown): ApiEnvelope {
  return value && typeof value === "object" ? (value as ApiEnvelope) : {}
}

function getApiErrorMessage(env: ApiEnvelope, fallback: string) {
  return typeof env.error === "string" ? env.error : fallback
}

function normalizePaperName(value: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getDefaultCostoPliego(tipo: PapelTipo) {
  // Valores por defecto (ajustables por el usuario)
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

function normalizeFinishText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function isTroqueladaFinish(finish: Pick<FinishOption, "key" | "nombre">) {
  const normalized = normalizeFinishText(`${finish.key} ${finish.nombre}`)
  return normalized.includes("troquelada") || normalized.includes("troquelar")
}

function toFinishKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
}

function getSizeDisplayName(sizes: Array<{ key: string; nombre: string }>, key: string) {
  return sizes.find((s) => s.key === key)?.nombre || key
}

function normalizeHandoffText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function inferPaperTypeFromMaterial(material: string | null | undefined): PapelTipo | null {
  const normalized = normalizeHandoffText(material)
  if (!normalized) return null
  if (normalized.includes("bond")) return "bond"
  if (normalized.includes("propal") || normalized.includes("cote") || normalized.includes("couche")) return "propalcote"
  if (normalized.includes("period")) return "periodico"
  return "otro"
}

export function LitografiaCalculator(props: { aiHandoffDraft?: LitografiaAiHandoff | null } = {}) {
  const searchParams = useSearchParams()
  const PAGE_SIZE = 5
  const [tab] = useState<"config">("config")
  const appliedAiDraftIdRef = useRef<string | null>(null)

  const [meLoaded, setMeLoaded] = useState(false)
  const [canConfigWrite, setCanConfigWrite] = useState(false)
  const [paperRequestsOpen, setPaperRequestsOpen] = useState(false)

  useEffect(() => {
    if (!searchParams) return
    if (searchParams.get('notif') === 'paper-requests') {
      setPaperRequestsOpen(true)
    }
  }, [searchParams])

  const [cantidad, setCantidad] = useState("1000")
  const [colores] = useState("4")
  const [desperdicioPct] = useState("0")

  const [costoPlanchaPorColor, setCostoPlanchaPorColor] = useState("25000")
  const [costoTintaPorColor, setCostoTintaPorColor] = useState("15000")
  const [costoPapelUnidad] = useState("80")

  const [papelPorPliego, setPapelPorPliego] = useState(true)
  const [papelTipo, setPapelTipo] = useState<PapelTipo>("propalcote")
  const [costoPliego, setCostoPliego] = useState(String(getDefaultCostoPliego("propalcote")))
  const [pliegoW, setPliegoW] = useState("70")
  const [pliegoH, setPliegoH] = useState("100")
  const [formatoKey, setFormatoKey] = useState("")
  const [formatoW, setFormatoW] = useState("")
  const [formatoH, setFormatoH] = useState("")

  const [costoCorte, setCostoCorte] = useState("0")
  const [costoAcabados, setCostoAcabados] = useState("0")
  const [costoTransporte, setCostoTransporte] = useState("0")
  const [descripcion, setDescripcion] = useState("")
  const [aiPrefillNotice, setAiPrefillNotice] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<PrintProfile[]>([])
  const [papers, setPapers] = useState<PaperRate[]>([])
  const [finishes, setFinishes] = useState<FinishOption[]>([])
  const [sizes, setSizes] = useState<PrintSize[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [papersLoading, setPapersLoading] = useState(false)
  const [finishesLoading, setFinishesLoading] = useState(false)
  const [sizesLoading, setSizesLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  const [selectedPlanchaProfileId, setSelectedPlanchaProfileId] = useState<string>("")
  const [selectedTintaProfileId, setSelectedTintaProfileId] = useState<string>("")
  const [selectedPaperId, setSelectedPaperId] = useState<string>("")
  const [selectedFinishId, setSelectedFinishId] = useState<string>("")

  const [selectedPaperTipo, setSelectedPaperTipo] = useState<string>("")
  const [selectedPaperGramaje, setSelectedPaperGramaje] = useState<string>("")

  const [selectedTransporteKey, setSelectedTransporteKey] = useState<string>("")

  // Dropdowns personalizados (por empresa)
  const [customDropdowns, setCustomDropdowns] = useState<CustomDropdown[]>([])
  const [customDropdownsLoading, setCustomDropdownsLoading] = useState(false)
  const [customDropdownsError, setCustomDropdownsError] = useState<string | null>(null)

  const [dropdownsSearch, setDropdownsSearch] = useState("")
  const [newDropdownNombre, setNewDropdownNombre] = useState("")

  const [dropdownEdits, setDropdownEdits] = useState<Record<string, { nombre?: string }>>({})
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({})
  const [newItemDraft, setNewItemDraft] = useState<
    Record<
      string,
      {
        label: string
        value?: string
        metaJson?: string
        costo?: string
        min?: string
        max?: string
        categoryId?: string
        categoryLabel?: string
        categoryDescription?: string
        categoryIcon?: string
        shortTitle?: string
        description?: string
        imageUrl?: string
        finalWidthCm?: string
        finalHeightCm?: string
        operationalWidthCm?: string
        operationalHeightCm?: string
        frontInk?: string
        backInk?: string
        paperTypeHint?: string
        paperWeightHint?: string
        finishHints?: string
        extraNote?: string
        suggestedExtraQty?: string
        totalPaginas?: string
        paginasPortadaContraportada?: string
        cartasPorPlancha?: string
        paginasPorPliego?: string
      }
    >
  >({})
  const [itemEdits, setItemEdits] = useState<
    Record<
      string,
      {
        label?: string
        value?: string
        metaJson?: string
        costo?: string
        min?: string
        max?: string
        categoryId?: string
        categoryLabel?: string
        categoryDescription?: string
        categoryIcon?: string
        shortTitle?: string
        description?: string
        imageUrl?: string
        finalWidthCm?: string
        finalHeightCm?: string
        operationalWidthCm?: string
        operationalHeightCm?: string
        frontInk?: string
        backInk?: string
        paperTypeHint?: string
        paperWeightHint?: string
        finishHints?: string
        extraNote?: string
        suggestedExtraQty?: string
        totalPaginas?: string
        paginasPortadaContraportada?: string
        cartasPorPlancha?: string
        paginasPorPliego?: string
        activo?: boolean
      }
    >
  >({})

  // Formularios independientes (usuarios escriben en ambos módulos)
  const [newPlanchaProfileNombre, setNewPlanchaProfileNombre] = useState("")
  const [newPlanchaProfilePlancha, setNewPlanchaProfilePlancha] = useState("0")
  const [newPlanchaProfileAnchoUtil, setNewPlanchaProfileAnchoUtil] = useState("70")
  const [newPlanchaProfileAltoUtil, setNewPlanchaProfileAltoUtil] = useState("100")

  const [newTintaProfileNombre, setNewTintaProfileNombre] = useState("")
  const [newTintaProfileTinta, setNewTintaProfileTinta] = useState("0")

  const [profileEdits, setProfileEdits] = useState<Record<string, { nombre: string; plancha: string; tinta: string; anchoUtil?: string; altoUtil?: string; separacion?: string }>>({})

  const [newPaperNombre, setNewPaperNombre] = useState("")
  const [newPaperTipo, setNewPaperTipo] = useState("")
  const [newPaperGramaje, setNewPaperGramaje] = useState("")
  const [newPaperPliegoW, setNewPaperPliegoW] = useState("70")
  const [newPaperPliegoH, setNewPaperPliegoH] = useState("100")
  const [newPaperCostoPliego, setNewPaperCostoPliego] = useState("0")

  const [paperEdits, setPaperEdits] = useState<
    Record<
      string,
      {
        nombre: string
        tipo: string
        gramaje: string
        costoPliego: string
        pliegoW: string
        pliegoH: string
      }
    >
  >({})

  const [newFinishNombre, setNewFinishNombre] = useState("")
  const [newFinishValor, setNewFinishValor] = useState("0")

  const [newPlastificadoNombre, setNewPlastificadoNombre] = useState("")
  const [newPlastificadoValor, setNewPlastificadoValor] = useState("0")

  const [newTroqueladoNombre, setNewTroqueladoNombre] = useState("")
  const [newTroqueladoValor, setNewTroqueladoValor] = useState("0")

  const [newTroqueladaNombre, setNewTroqueladaNombre] = useState("")
  const [newTroqueladaValor, setNewTroqueladaValor] = useState("0")

  const [newCorteNombre, setNewCorteNombre] = useState("")
  const [newCorteValor, setNewCorteValor] = useState("0")

  const [newSpecialFinishNombre, setNewSpecialFinishNombre] = useState("")
  const [newSpecialFinishValor, setNewSpecialFinishValor] = useState("0")

  const [finishEdits, setFinishEdits] = useState<Record<string, { nombre: string; valor: string }>>({})

  const [newSizeKey, setNewSizeKey] = useState("")
  const [newSizeNombre, setNewSizeNombre] = useState("")
  const [newSizeW, setNewSizeW] = useState("14")
  const [newSizeH, setNewSizeH] = useState("21.6")

  const [sizeEdits, setSizeEdits] = useState<Record<string, { nombre: string; key: string; w: string; h: string }>>({})

  const [planchaProfilesPage, setPlanchaProfilesPage] = useState(0)
  const [tintaProfilesPage, setTintaProfilesPage] = useState(0)
  const [planchaProfilesSearch, setPlanchaProfilesSearch] = useState("")
  const [tintaProfilesSearch, setTintaProfilesSearch] = useState("")
  const [papersSearch, setPapersSearch] = useState("")
  const [sizesSearch, setSizesSearch] = useState("")
  const [acabadosSearch, setAcabadosSearch] = useState("")
  const [specialAcabadosSearch, setSpecialAcabadosSearch] = useState("")
  const [plastificadosSearch, setPlastificadosSearch] = useState("")
  const [troqueladosSearch, setTroqueladosSearch] = useState("")
  const [troqueladasSearch, setTroqueladasSearch] = useState("")
  const [cortesSearch, setCortesSearch] = useState("")
  const [flyerRatesSearch, setFlyerRatesSearch] = useState("")
  const [papersPage, setPapersPage] = useState(0)
  const [finishesPage, setFinishesPage] = useState(0)
  const [plastificadosPage, setPlastificadosPage] = useState(0)
  const [troqueladosPage, setTroqueladosPage] = useState(0)
  const [troqueladasPage, setTroqueladasPage] = useState(0)
  const [cortesPage, setCortesPage] = useState(0)
  const [specialFinishesPage, setSpecialFinishesPage] = useState(0)
  const [sizesPage, setSizesPage] = useState(0)
  const [ratesPage, setRatesPage] = useState(0)

  const [ratesFilterFormatoKey, setRatesFilterFormatoKey] = useState<string>("")
  const [ratesFilterTintas, setRatesFilterTintas] = useState<"" | 1 | 2 | 4>("")
  const [ratesFilterPaperId, setRatesFilterPaperId] = useState<string>("")
  const [ratesFilterFinishId, setRatesFilterFinishId] = useState<string>("")

  const [flyerRates, setFlyerRates] = useState<FlyerRate[]>([])
  const [flyerRatesLoading, setFlyerRatesLoading] = useState(false)

  const [productos, setProductos] = useState<LitografiaProducto[]>([])
  const [productosLoading, setProductosLoading] = useState(false)

  const [groupProductoSelection, setGroupProductoSelection] = useState<Record<string, string>>({})
  const [groupNewProductoNombre, setGroupNewProductoNombre] = useState<Record<string, string>>({})
  const [groupAssignLoadingKey, setGroupAssignLoadingKey] = useState<string>("")

  const [newFlyerFormatoKey, setNewFlyerFormatoKey] = useState("")
  const [newFlyerTintas, setNewFlyerTintas] = useState<1 | 2 | 4>(4)
  const [newFlyerMin, setNewFlyerMin] = useState("500")
  const [newFlyerMax, setNewFlyerMax] = useState("1000")
  const [newFlyerPrecioTotal, setNewFlyerPrecioTotal] = useState("0")
  const [newFlyerPaperId, setNewFlyerPaperId] = useState<string>("")
  const [newFlyerFinishId, setNewFlyerFinishId] = useState<string>("")

  const [flyerRateEdits, setFlyerRateEdits] = useState<
    Record<
      string,
      {
        paperRateId: string
        finishOptionId: string
        formatoKey: string
        tintas: string
        min: string
        max: string
        precioTotal: string
      }
    >
  >({})

  const [pricingSource, setPricingSource] = useState<"tarifario" | "desglose">("tarifario")
  const [matchedRate] = useState<FlyerRate | null>(null)
  const [matchedRateLoading] = useState(false)

  const [newFlyerTierKey, setNewFlyerTierKey] = useState<string>("")

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
    () => finishes.filter((f) => f.activo && getGrupo(f) === "ACABADO" && !f.especial),
    [finishes]
  )
  const activeSizes = useMemo(() => sizes.filter((s) => s.activo), [sizes])

  const acabadosFinishes = useMemo(() => finishes.filter((f) => !f.especial && getGrupo(f) === "ACABADO"), [finishes])
  const plastificadosFinishes = useMemo(() => finishes.filter((f) => !f.especial && getGrupo(f) === "PLASTIFICADO"), [finishes])
  const troqueladosFinishes = useMemo(
    () => finishes.filter((f) => !f.especial && getGrupo(f) === "TROQUELADO" && !isTroqueladaFinish(f)),
    [finishes]
  )
  const troqueladasFinishes = useMemo(
    () => finishes.filter((f) => !f.especial && getGrupo(f) === "TROQUELADO" && isTroqueladaFinish(f)),
    [finishes]
  )
  const cortesFinishes = useMemo(() => finishes.filter((f) => !f.especial && getGrupo(f) === "CORTE"), [finishes])
  const specialFinishes = useMemo(() => finishes.filter((f) => getGrupo(f) === "ACABADO" && Boolean(f.especial)), [finishes])

  const sizeOptions = useMemo(() => {
    return activeSizes.map((s) => ({ key: s.key, nombre: s.nombre, widthCm: s.widthCm, heightCm: s.heightCm }))
  }, [activeSizes])

  const selectedPreset = useMemo(() => {
    return sizeOptions.find((p) => p.key === formatoKey) || null
  }, [formatoKey, sizeOptions])

  useEffect(() => {
    if (!sizeOptions.length) {
      if (formatoKey) setFormatoKey("")
      if (formatoW) setFormatoW("")
      if (formatoH) setFormatoH("")
      return
    }
    const exists = sizeOptions.some((p) => p.key === formatoKey)
    if (exists) return
    const first = sizeOptions[0]
    if (!first) return
    setFormatoKey(first.key)
    setFormatoW(String(first.widthCm))
    setFormatoH(String(first.heightCm))
  }, [sizeOptions, formatoKey, formatoW, formatoH])

  useEffect(() => {
    if (!sizeOptions.length) {
      if (newFlyerFormatoKey) setNewFlyerFormatoKey("")
      return
    }
    const exists = sizeOptions.some((p) => p.key === newFlyerFormatoKey)
    if (exists) return
    const first = sizeOptions[0]
    if (first) setNewFlyerFormatoKey(first.key)
  }, [sizeOptions, newFlyerFormatoKey])

  const paperTipoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of activePapers) set.add(String(p.tipo || "otro").trim() || "otro")
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [activePapers])

  const paperGramajeOptions = useMemo(() => {
    const selected = activePapers.find((p) => p.id === selectedPaperId) || null
    const tipo = (selectedPaperTipo || "").trim() || (selected?.tipo || "otro")
    const set = new Set<number>()
    for (const p of activePapers) {
      const pt = String(p.tipo || "otro").trim() || "otro"
      if (pt !== tipo) continue
      if (typeof p.gramaje === "number" && Number.isFinite(p.gramaje)) set.add(p.gramaje)
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [activePapers, selectedPaperTipo, selectedPaperId])

  const selectedPlanchaProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedPlanchaProfileId) || null
  }, [profiles, selectedPlanchaProfileId])

  const selectedTintaProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedTintaProfileId) || null
  }, [profiles, selectedTintaProfileId])

  const selectedPaper = useMemo(() => {
    return papers.find((p) => p.id === selectedPaperId) || null
  }, [papers, selectedPaperId])

  const selectedFinish = useMemo(() => {
    return finishes.find((f) => f.id === selectedFinishId) || null
  }, [finishes, selectedFinishId])

  function metaNumber(meta: unknown, key: string): number | null {
    if (!meta || typeof meta !== 'object') return null
    const anyMeta = meta as Record<string, unknown>
    const raw = anyMeta[key]
    const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
    return Number.isFinite(num) ? num : null
  }

  function metaString(meta: unknown, key: string) {
    if (!meta || typeof meta !== 'object') return ""
    const raw = (meta as Record<string, unknown>)[key]
    return typeof raw === 'string' ? raw.trim() : ""
  }

  function metaStringList(meta: unknown, key: string) {
    if (!meta || typeof meta !== 'object') return ""
    const raw = (meta as Record<string, unknown>)[key]
    if (Array.isArray(raw)) return raw.map((entry) => String(entry || "").trim()).filter(Boolean).join(", ")
    if (typeof raw === 'string') return raw.trim()
    return ""
  }

  const transporteDropdown = useMemo(() => {
    return customDropdowns.find((d) => d.key === CUSTOM_DROPDOWN_KEYS.transporte) || null
  }, [customDropdowns])

  const transporteOptions = useMemo(() => {
    const items = transporteDropdown?.items ?? []
    return items
      .filter((i) => i.activo)
      .map((i) => {
        const total = Math.max(0, metaNumber(i.meta, 'total') ?? 0)
        return {
          value: i.value,
          total,
          label: `${i.label} • ${formatCurrency(total)}`,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [transporteDropdown])

  const tirajeTiersDropdown = useMemo(() => {
    return customDropdowns.find((d) => d.key === CUSTOM_DROPDOWN_KEYS.tirajeTiers) || null
  }, [customDropdowns])

  const tirajeTierOptions = useMemo(() => {
    const items = tirajeTiersDropdown?.items ?? []
    return items
      .filter((i) => i.activo)
      .map((i) => {
        const min = Math.max(0, metaNumber(i.meta, 'min') ?? 0)
        const max = Math.max(0, metaNumber(i.meta, 'max') ?? 0)
        return { value: i.value, label: i.label, min, max }
      })
      .sort((a, b) => {
        if (a.min !== b.min) return a.min - b.min
        return a.label.localeCompare(b.label)
      })
  }, [tirajeTiersDropdown])

  const visibleCustomDropdowns = useMemo(() => {
    const q = dropdownsSearch.trim().toLowerCase()
    const base = [...customDropdowns].sort((a, b) => a.nombre.localeCompare(b.nombre))
    if (!q) return base
    return base.filter((d) => {
      const nombre = (d.nombre || "").toLowerCase()
      const key = (d.key || "").toLowerCase()
      return nombre.includes(q) || key.includes(q)
    })
  }, [customDropdowns, dropdownsSearch])

  const fetchProfiles = async () => {
    setProfilesLoading(true)
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/perfiles", { cache: "no-store" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "Error al cargar perfiles"))
      setProfiles(Array.isArray(env.data) ? (env.data as PrintProfile[]) : [])
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Error al cargar perfiles")
    } finally {
      setProfilesLoading(false)
    }
  }

  const fetchPapers = async () => {
    setPapersLoading(true)
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/papeles", { cache: "no-store" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "Error al cargar papeles"))
      setPapers(Array.isArray(env.data) ? (env.data as PaperRate[]) : [])
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Error al cargar papeles")
    } finally {
      setPapersLoading(false)
    }
  }

  const fetchFlyerRates = async () => {
    setFlyerRatesLoading(true)
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/flyers-tarifas", { cache: "no-store" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "Error al cargar tarifas"))
      setFlyerRates(Array.isArray(env.data) ? (env.data as FlyerRate[]) : [])
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Error al cargar tarifas")
    } finally {
      setFlyerRatesLoading(false)
    }
  }

  const fetchProductos = async () => {
    setProductosLoading(true)
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/productos", { cache: "no-store" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "Error al cargar productos"))
      setProductos(Array.isArray(env.data) ? (env.data as LitografiaProducto[]) : [])
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Error al cargar productos")
    } finally {
      setProductosLoading(false)
    }
  }

  const fetchFinishes = async () => {
    setFinishesLoading(true)
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/acabados", { cache: "no-store" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "Error al cargar acabados"))
      setFinishes(Array.isArray(env.data) ? (env.data as FinishOption[]) : [])
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Error al cargar acabados")
    } finally {
      setFinishesLoading(false)
    }
  }

  const fetchSizes = async () => {
    setSizesLoading(true)
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/tamanos", { cache: "no-store" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "Error al cargar tamaños"))
      setSizes(Array.isArray(env.data) ? (env.data as PrintSize[]) : [])
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Error al cargar tamaños")
    } finally {
      setSizesLoading(false)
    }
  }

  const fetchCustomDropdowns = async () => {
    setCustomDropdownsLoading(true)
    setCustomDropdownsError(null)
    try {
      const res = await fetch('/api/configuracion/dropdowns?includeItems=1', { cache: 'no-store' })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) {
        throw new Error(getApiErrorMessage(env, 'Error al cargar dropdowns'))
      }
      setCustomDropdowns(Array.isArray(env.data) ? (env.data as CustomDropdown[]) : [])
    } catch (e) {
      setCustomDropdownsError(e instanceof Error ? e.message : 'Error al cargar dropdowns')
    } finally {
      setCustomDropdownsLoading(false)
    }
  }

  function getCostoFromMeta(meta: unknown) {
    if (!meta || typeof meta !== 'object') return ""
    const total = (meta as Record<string, unknown>).total
    if (typeof total === 'number' && Number.isFinite(total)) return String(total)
    if (typeof total === 'string' && total.trim()) return total.trim()
    return ""
  }

  function getNumberFieldFromMeta(meta: unknown, field: 'min' | 'max') {
    if (!meta || typeof meta !== 'object') return ""
    const v = (meta as Record<string, unknown>)[field]
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (typeof v === 'string' && v.trim()) return v.trim()
    return ""
  }

  function formatMetaJson(meta: unknown) {
    try {
      return JSON.stringify(meta && typeof meta === 'object' ? meta : {}, null, 2)
    } catch {
      return "{}"
    }
  }

  const createCustomDropdown = async (payload: { nombre: string; key?: string; descripcion?: string | null; seedItems?: unknown[] }) => {
    setCustomDropdownsError(null)
    try {
      const res = await fetch('/api/configuracion/dropdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, 'No se pudo crear dropdown'))
      await fetchCustomDropdowns()
    } catch (e) {
      setCustomDropdownsError(e instanceof Error ? e.message : 'No se pudo crear dropdown')
    }
  }

  const patchCustomDropdown = async (id: string, patch: { nombre?: string }) => {
    setCustomDropdownsError(null)
    try {
      const res = await fetch(`/api/configuracion/dropdowns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, 'No se pudo actualizar dropdown'))
      await fetchCustomDropdowns()
    } catch (e) {
      setCustomDropdownsError(e instanceof Error ? e.message : 'No se pudo actualizar dropdown')
    }
  }

  const deleteCustomDropdown = async (id: string) => {
    setCustomDropdownsError(null)
    try {
      const res = await fetch(`/api/configuracion/dropdowns/${id}`, { method: 'DELETE' })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, 'No se pudo eliminar dropdown'))
      await fetchCustomDropdowns()
    } catch (e) {
      setCustomDropdownsError(e instanceof Error ? e.message : 'No se pudo eliminar dropdown')
    }
  }

  const createCustomItem = async (dropdownId: string, payload: { label: string; value?: string; sortOrder?: number; activo?: boolean; meta?: unknown }) => {
    setCustomDropdownsError(null)
    try {
      const res = await fetch(`/api/configuracion/dropdowns/${dropdownId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, 'No se pudo crear opción'))
      await fetchCustomDropdowns()
    } catch (e) {
      setCustomDropdownsError(e instanceof Error ? e.message : 'No se pudo crear opción')
    }
  }

  const patchCustomItem = async (itemId: string, patch: { label?: string; value?: string; sortOrder?: number; activo?: boolean; meta?: unknown }) => {
    setCustomDropdownsError(null)
    try {
      const res = await fetch(`/api/configuracion/dropdowns/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, 'No se pudo actualizar opción'))
      await fetchCustomDropdowns()
    } catch (e) {
      setCustomDropdownsError(e instanceof Error ? e.message : 'No se pudo actualizar opción')
    }
  }

  const deleteCustomItem = async (itemId: string) => {
    setCustomDropdownsError(null)
    try {
      const res = await fetch(`/api/configuracion/dropdowns/items/${itemId}`, { method: 'DELETE' })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, 'No se pudo eliminar opción'))
      await fetchCustomDropdowns()
    } catch (e) {
      setCustomDropdownsError(e instanceof Error ? e.message : 'No se pudo eliminar opción')
    }
  }

  const createTemplateIfMissing = async (kind: 'transporte' | 'tirajeTiers' | 'editorialProducto' | 'visualCatalog') => {
    const key =
      kind === 'transporte'
        ? CUSTOM_DROPDOWN_KEYS.transporte
        : kind === 'tirajeTiers'
          ? CUSTOM_DROPDOWN_KEYS.tirajeTiers
          : kind === 'editorialProducto'
            ? CUSTOM_DROPDOWN_KEYS.editorialProducto
            : CUSTOM_DROPDOWN_KEYS.visualCatalog
    const exists = customDropdowns.some((d) => d.key === key)
    if (exists) return

    const seedItems =
      kind === 'transporte'
        ? TRANSPORTE_TEMPLATE_ITEMS
        : kind === 'tirajeTiers'
          ? TIRAJE_TIER_TEMPLATE_ITEMS
          : kind === 'editorialProducto'
            ? EDITORIAL_PRODUCTO_TEMPLATE_ITEMS
            : VISUAL_CATALOG_TEMPLATE_ITEMS
    const nombre =
      kind === 'transporte'
        ? 'Litografía: Transporte'
        : kind === 'tirajeTiers'
          ? 'Litografía: Rangos sugeridos (tiraje)'
          : kind === 'editorialProducto'
            ? 'Litografía: Editorial (libros/cartillas/revistas)'
            : 'Litografía: Catálogo visual'
    await createCustomDropdown({ nombre, key, descripcion: null, seedItems })
  }

  const createFinishInGroup = async (grupo: "ACABADO" | "PLASTIFICADO" | "TROQUELADO" | "CORTE", args: { nombre: string; valor: number; key?: string }) => {
    setConfigError(null)
    const nombre = args.nombre.trim()
    const valor = args.valor

    const res = await fetch("/api/litografia/acabados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, key: args.key, valor: Number.isFinite(valor) ? valor : 0, activo: true, especial: false, grupo }),
    })
    const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
    if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear"))
    await fetchFinishes()
  }

  const createFinish = async () => {
    try {
      const nombre = newFinishNombre.trim()
      const valor = parseFloat(newFinishValor)

      await createFinishInGroup("ACABADO", { nombre, valor: Number.isFinite(valor) ? valor : 0 })
      setNewFinishNombre("")
      setNewFinishValor("0")
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el acabado")
    }
  }

  const createPlastificado = async () => {
    try {
      const nombre = newPlastificadoNombre.trim()
      const valor = parseFloat(newPlastificadoValor)
      await createFinishInGroup("PLASTIFICADO", { nombre, valor: Number.isFinite(valor) ? valor : 0 })
      setNewPlastificadoNombre("")
      setNewPlastificadoValor("0")
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el plastificado")
    }
  }

  const createTroquelado = async () => {
    try {
      const nombre = newTroqueladoNombre.trim()
      const valor = parseFloat(newTroqueladoValor)
      await createFinishInGroup("TROQUELADO", { nombre, valor: Number.isFinite(valor) ? valor : 0 })
      setNewTroqueladoNombre("")
      setNewTroqueladoValor("0")
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el troquelado")
    }
  }

  const createTroquelada = async () => {
    try {
      const nombre = newTroqueladaNombre.trim()
      const valor = parseFloat(newTroqueladaValor)
      const keyBase = toFinishKey(nombre)
      const key = keyBase ? `troquelada_${keyBase}` : "troquelada"
      await createFinishInGroup("TROQUELADO", { nombre, valor: Number.isFinite(valor) ? valor : 0, key })
      setNewTroqueladaNombre("")
      setNewTroqueladaValor("0")
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear la troquelada")
    }
  }

  const createCorte = async () => {
    try {
      const nombre = newCorteNombre.trim()
      const valor = parseFloat(newCorteValor)
      await createFinishInGroup("CORTE", { nombre, valor: Number.isFinite(valor) ? valor : 0 })
      setNewCorteNombre("")
      setNewCorteValor("0")
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el corte")
    }
  }

  const createSpecialFinish = async () => {
    setConfigError(null)
    try {
      const nombre = newSpecialFinishNombre.trim()
      const valor = parseFloat(newSpecialFinishValor)

      const res = await fetch("/api/litografia/acabados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, valor: Number.isFinite(valor) ? valor : 0, activo: true, especial: true }),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear el acabado especial"))
      setNewSpecialFinishNombre("")
      setNewSpecialFinishValor("0")
      await fetchFinishes()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el acabado especial")
    }
  }

  const patchFinish = async (id: string, patch: Partial<FinishOption>) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/acabados/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      )
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo actualizar"))
      await fetchFinishes()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo actualizar")
    }
  }

  const deleteFinish = async (id: string) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/acabados/${id}`, { method: "DELETE" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo eliminar"))
      if (selectedFinishId === id) setSelectedFinishId("")
      await fetchFinishes()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo eliminar")
    }
  }

  const createSize = async () => {
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/tamanos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newSizeKey.trim(),
          nombre: newSizeNombre.trim(),
          widthCm: parseFloat(newSizeW) || 0,
          heightCm: parseFloat(newSizeH) || 0,
          activo: true,
        }),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear el tamaño"))
      setNewSizeKey("")
      setNewSizeNombre("")
      await fetchSizes()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el tamaño")
    }
  }

  const patchSize = async (id: string, patch: Partial<PrintSize>) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/tamanos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo actualizar"))
      await fetchSizes()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo actualizar")
    }
  }

  const deleteSize = async (id: string) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/tamanos/${id}`, { method: "DELETE" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo eliminar"))
      await fetchSizes()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo eliminar")
    }
  }

  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" })
        const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
        const data = (env.data && typeof env.data === "object" ? (env.data as Record<string, unknown>) : {})
        setCanConfigWrite(Boolean(data.canConfigWrite))
      } finally {
        setMeLoaded(true)
      }
    }

    void loadMe()
  }, [])

  // En Litografía se mantiene solo Configuración (sin cotizador de ejemplo).

  useEffect(() => {
    void fetchProfiles()
    void fetchPapers()
    void fetchFinishes()
    void fetchSizes()
    void fetchFlyerRates()
    void fetchProductos()
    void fetchCustomDropdowns()
  }, [])

  const assignProductoToGroup = async (groupKey: string, rateIds: string[], productoId: string | null) => {
    setConfigError(null)
    setGroupAssignLoadingKey(groupKey)
    try {
      const results = await Promise.all(
        rateIds.map(async (id) => {
          const res = await fetch(`/api/litografia/flyers-tarifas/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productoId }),
          })
          const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
          if (!res.ok || env.ok !== true) {
            throw new Error(getApiErrorMessage(env, "No se pudo asignar el producto"))
          }
          return true
        })
      )
      if (results.length) {
        await fetchFlyerRates()
      }
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo asignar el producto")
    } finally {
      setGroupAssignLoadingKey("")
    }
  }

  const createProductoFromGroup = async (groupKey: string, payload: { nombre: string; formatoKey: string; tintas: number; paperRateId: string | null; finishOptionId: string | null }) => {
    setConfigError(null)
    setGroupAssignLoadingKey(groupKey)
    try {
      if (!payload.paperRateId) throw new Error("Selecciona un papel (paperRateId)")
      const res = await fetch("/api/litografia/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: payload.nombre,
          formatoKey: payload.formatoKey,
          tintas: payload.tintas,
          paperRateId: payload.paperRateId,
          finishOptionId: payload.finishOptionId,
          activo: true,
        }),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear el producto"))

      const created = (env.data && typeof env.data === "object" ? (env.data as { id?: unknown }) : {})
      const createdId = typeof created.id === "string" ? created.id : ""
      if (!createdId) throw new Error("Producto creado sin id")

      await fetchProductos()
      setGroupProductoSelection((prev) => ({ ...prev, [groupKey]: createdId }))
      return createdId
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el producto")
      return null
    } finally {
      setGroupAssignLoadingKey("")
    }
  }

  useEffect(() => {
    setPlanchaProfilesPage(0)
    setTintaProfilesPage(0)
  }, [profiles.length])

  useEffect(() => {
    setPapersPage(0)
  }, [papers.length])

  useEffect(() => {
    setFinishesPage(0)
  }, [finishes.length])

  useEffect(() => {
    setSizesPage(0)
  }, [sizes.length])

  useEffect(() => {
    setRatesPage(0)
  }, [flyerRates.length])

  useEffect(() => {
    setRatesPage(0)
  }, [ratesFilterFormatoKey, ratesFilterTintas, ratesFilterPaperId, ratesFilterFinishId])

  // En este MVP, el cotizador se opera con tarifario + transporte.
  // (La Config queda disponible para administrar listas y precios.)
  useEffect(() => {
    if (pricingSource !== "tarifario") setPricingSource("tarifario")
  }, [pricingSource])

  useEffect(() => {
    if (pricingSource === "tarifario") {
      if (!papelPorPliego) setPapelPorPliego(true)
      if (costoCorte !== "0") setCostoCorte("0")
      if (costoAcabados !== "0") setCostoAcabados("0")
    }
  }, [pricingSource, papelPorPliego, costoCorte, costoAcabados, costoTransporte])

  useEffect(() => {
    // Solo Configuración: no se ejecuta lógica de cotización.
  }, [])

  useEffect(() => {
    if (!newFlyerTierKey) return
    const t = tirajeTierOptions.find((x) => x.value === newFlyerTierKey) || null
    if (!t) return
    setNewFlyerMin(String(t.min))
    setNewFlyerMax(String(t.max))
  }, [newFlyerTierKey, tirajeTierOptions])

  useEffect(() => {
    if (!selectedPlanchaProfileId && activePlanchaProfiles.length) {
      setSelectedPlanchaProfileId(activePlanchaProfiles[0]!.id)
    }
  }, [activePlanchaProfiles, selectedPlanchaProfileId])

  useEffect(() => {
    if (!selectedTintaProfileId && activeTintaProfiles.length) {
      setSelectedTintaProfileId(activeTintaProfiles[0]!.id)
    }
  }, [activeTintaProfiles, selectedTintaProfileId])

  useEffect(() => {
    if (!selectedPaperId && activePapers.length) {
      setSelectedPaperId(activePapers[0]!.id)
    }
  }, [activePapers, selectedPaperId])

  useEffect(() => {
    if (!selectedPaperTipo && paperTipoOptions.length) {
      const fromSelected = String(selectedPaper?.tipo || "").trim()
      setSelectedPaperTipo(fromSelected || paperTipoOptions[0]!)
    }
  }, [selectedPaperTipo, paperTipoOptions, selectedPaper])

  useEffect(() => {
    if (!selectedPaperGramaje && paperGramajeOptions.length) {
      const fromSelected = selectedPaper?.gramaje != null ? String(selectedPaper.gramaje) : ""
      setSelectedPaperGramaje(fromSelected || String(paperGramajeOptions[0]!))
    }
  }, [selectedPaperGramaje, paperGramajeOptions, selectedPaper])

  useEffect(() => {
    if (!activePapers.length) return
    const tipo = (selectedPaperTipo || "").trim() || "otro"
    const gramajeNum = selectedPaperGramaje.trim() ? parseInt(selectedPaperGramaje, 10) : NaN

    const match = activePapers.find((p) => {
      const pt = String(p.tipo || "otro").trim() || "otro"
      if (pt !== tipo) return false
      if (!Number.isFinite(gramajeNum)) return true
      return (p.gramaje ?? null) === gramajeNum
    })

    if (match && match.id !== selectedPaperId) {
      setSelectedPaperId(match.id)
    }
  }, [activePapers, selectedPaperTipo, selectedPaperGramaje, selectedPaperId])

  useEffect(() => {
    if (pricingSource !== "tarifario") return
    const opt = transporteOptions.find((o) => o.value === selectedTransporteKey) || null
    const next = opt ? String(opt.total) : "0"
    if (costoTransporte !== next) setCostoTransporte(next)
  }, [pricingSource, selectedTransporteKey, costoTransporte, transporteOptions])

  useEffect(() => {
    if (!newFlyerPaperId && activePapers.length) {
      setNewFlyerPaperId(activePapers[0]!.id)
    }
  }, [activePapers, newFlyerPaperId])

  useEffect(() => {
    const profile = profiles.find((p) => p.id === selectedPlanchaProfileId)
    if (!profile) return
    setCostoPlanchaPorColor(String(profile.costoPlanchaPorColor ?? 0))
  }, [profiles, selectedPlanchaProfileId])

  useEffect(() => {
    const profile = profiles.find((p) => p.id === selectedTintaProfileId)
    if (!profile) return
    setCostoTintaPorColor(String(profile.costoTintaPorColor ?? 0))
  }, [profiles, selectedTintaProfileId])

  useEffect(() => {
    const paper = papers.find((p) => p.id === selectedPaperId)
    if (!paper) return
    setPapelPorPliego(true)
    setCostoPliego(String(paper.costoPliego ?? 0))
    setPliegoW(String(paper.pliegoWidthCm ?? 70))
    setPliegoH(String(paper.pliegoHeightCm ?? 100))

    const t = (paper.tipo || "").toLowerCase()
    if (t.includes("bond")) setPapelTipo("bond")
    else if (t.includes("propal") || t.includes("cote") || t.includes("couche")) setPapelTipo("propalcote")
    else if (t.includes("period")) setPapelTipo("periodico")
    else setPapelTipo("otro")
  }, [papers, selectedPaperId])

  useEffect(() => {
    const draft = props.aiHandoffDraft
    if (!draft) return
    if (appliedAiDraftIdRef.current === draft.id) return
    if (papersLoading || finishesLoading || sizesLoading || customDropdownsLoading) return

    if (draft.cantidad && draft.cantidad > 0) {
      setCantidad(String(draft.cantidad))
    }

    if (draft.brief.trim()) {
      setDescripcion(draft.brief.trim())
    }

    if (typeof draft.anchoCm === "number" && typeof draft.altoCm === "number") {
      const draftWidth = draft.anchoCm
      const draftHeight = draft.altoCm
      const matchedSize = sizeOptions.find((size) => {
        const sameOrientation = Math.abs(size.widthCm - draftWidth) < 0.3 && Math.abs(size.heightCm - draftHeight) < 0.3
        const swappedOrientation = Math.abs(size.widthCm - draftHeight) < 0.3 && Math.abs(size.heightCm - draftWidth) < 0.3
        return sameOrientation || swappedOrientation
      })

      if (matchedSize) {
        setFormatoKey(matchedSize.key)
        setFormatoW(String(matchedSize.widthCm))
        setFormatoH(String(matchedSize.heightCm))
      }

      if (!matchedSize && draft.pricingHints?.sizeLabel) {
        const matchedPricingSize = sizeOptions.find((size) => {
          const haystack = normalizeHandoffText(size.nombre)
          const needle = normalizeHandoffText(draft.pricingHints?.sizeLabel)
          return Boolean(needle) && (haystack.includes(needle) || needle.includes(haystack))
        })

        if (matchedPricingSize) {
          setFormatoKey(matchedPricingSize.key)
          setFormatoW(String(matchedPricingSize.widthCm))
          setFormatoH(String(matchedPricingSize.heightCm))
        }
      }
    }

    const inferredPaperType = inferPaperTypeFromMaterial(draft.material)
    if (inferredPaperType) {
      setPapelTipo(inferredPaperType)
    }

    const normalizedMaterial = normalizeHandoffText(draft.material)
    const gramajeMatch = normalizedMaterial.match(/(\d{2,3})\s*g/)
    if (gramajeMatch) {
      setSelectedPaperGramaje(gramajeMatch[1] || "")
    }

    const directPaperMatch = activePapers.find((paper) => {
      const haystack = normalizeHandoffText(`${paper.nombre} ${paper.tipo || ""} ${paper.gramaje ?? ""}`)
      return normalizedMaterial ? haystack.includes(normalizedMaterial) || normalizedMaterial.includes(haystack) : false
    })

    if (directPaperMatch) {
      setSelectedPaperId(directPaperMatch.id)
      setSelectedPaperTipo(String(directPaperMatch.tipo || "otro").trim() || "otro")
      setSelectedPaperGramaje(directPaperMatch.gramaje != null ? String(directPaperMatch.gramaje) : "")
    } else if (draft.pricingHints?.paperName) {
      const matchedPricingPaper = activePapers.find((paper) => {
        const haystack = normalizeHandoffText(`${paper.nombre} ${paper.tipo || ""} ${paper.gramaje ?? ""}`)
        const needle = normalizeHandoffText(draft.pricingHints?.paperName)
        return Boolean(needle) && (haystack.includes(needle) || needle.includes(haystack))
      })

      if (matchedPricingPaper) {
        setSelectedPaperId(matchedPricingPaper.id)
        setSelectedPaperTipo(String(matchedPricingPaper.tipo || "otro").trim() || "otro")
        setSelectedPaperGramaje(matchedPricingPaper.gramaje != null ? String(matchedPricingPaper.gramaje) : "")
      }
    } else if (inferredPaperType) {
      setSelectedPaperTipo(inferredPaperType)
    }

    const normalizedFinish = normalizeHandoffText(draft.acabado)
    if (normalizedFinish) {
      const finishMatch = activeFinishes.find((finish) => {
        const name = normalizeHandoffText(finish.nombre)
        return name.includes(normalizedFinish) || normalizedFinish.includes(name)
      })
      if (finishMatch) setSelectedFinishId(finishMatch.id)
    } else if (draft.finishHints?.genericLabels.length) {
      const finishHint = normalizeHandoffText(draft.finishHints.genericLabels[0])
      const finishMatch = activeFinishes.find((finish) => {
        const name = normalizeHandoffText(finish.nombre)
        return Boolean(finishHint) && (name.includes(finishHint) || finishHint.includes(name))
      })
      if (finishMatch) setSelectedFinishId(finishMatch.id)
    }

    if (draft.pricingHints?.machineName) {
      const profileMatch = profiles.find((profile) => {
        const haystack = normalizeHandoffText(profile.nombre)
        const needle = normalizeHandoffText(draft.pricingHints?.machineName)
        return Boolean(needle) && (haystack.includes(needle) || needle.includes(haystack))
      })
      if (profileMatch) {
        setSelectedPlanchaProfileId(profileMatch.id)
        setSelectedTintaProfileId(profileMatch.id)
      }
    }

    const normalizedEntrega = normalizeHandoffText(draft.entrega)
    if (normalizedEntrega) {
      const transportMatch = transporteOptions.find((option) => {
        const haystack = normalizeHandoffText(`${option.value} ${option.label}`)
        return haystack.includes(normalizedEntrega) || normalizedEntrega.includes(haystack)
      })
      if (transportMatch) setSelectedTransporteKey(transportMatch.value)
    } else if (draft.pricingHints?.transportLabel) {
      const transportMatch = transporteOptions.find((option) => {
        const haystack = normalizeHandoffText(`${option.value} ${option.label}`)
        const needle = normalizeHandoffText(draft.pricingHints?.transportLabel)
        return Boolean(needle) && (haystack.includes(needle) || needle.includes(haystack))
      })
      if (transportMatch) setSelectedTransporteKey(transportMatch.value)
    }

    setAiPrefillNotice(`Se precargó el cotizador con el brief IA: ${draft.quoteType}${draft.material ? ` · ${draft.material}` : ""}`)
    appliedAiDraftIdRef.current = draft.id
  }, [
    props.aiHandoffDraft,
    papersLoading,
    finishesLoading,
    sizesLoading,
    customDropdownsLoading,
    sizeOptions,
    activePapers,
    activeFinishes,
    transporteOptions,
  ])

  const createPlanchaProfile = async () => {
    const nombre = newPlanchaProfileNombre.trim()
    const plancha = parseFloat(newPlanchaProfilePlancha) || 0
    const anchoUtilCm = parseFloat(newPlanchaProfileAnchoUtil) || 0
    const altoUtilCm = parseFloat(newPlanchaProfileAltoUtil) || 0
    const separacionPiezasCm = 0
    if (!nombre || plancha <= 0 || anchoUtilCm <= 0 || altoUtilCm <= 0) return

    const created = await createProfileDirect({
      nombre,
      costoPlanchaPorColor: plancha,
      costoTintaPorColor: 0,
      anchoUtilCm,
      altoUtilCm,
      separacionPiezasCm,
      activo: true,
    })

    if (created) {
      setNewPlanchaProfileNombre("")
      setNewPlanchaProfilePlancha("0")
      setNewPlanchaProfileAnchoUtil("70")
      setNewPlanchaProfileAltoUtil("100")
    }
  }

  const createTintaProfile = async () => {
    const nombre = newTintaProfileNombre.trim()
    const tinta = parseFloat(newTintaProfileTinta) || 0
    if (!nombre || tinta <= 0) return

    const created = await createProfileDirect({
      nombre,
      costoPlanchaPorColor: 0,
      costoTintaPorColor: tinta,
      anchoUtilCm: 70,
      altoUtilCm: 100,
      separacionPiezasCm: 0,
      activo: true,
    })

    if (created) {
      setNewTintaProfileNombre("")
      setNewTintaProfileTinta("0")
    }
  }

  const createProfileDirect = async (payload: {
    nombre: string
    costoPlanchaPorColor: number
    costoTintaPorColor: number
    anchoUtilCm?: number
    altoUtilCm?: number
    separacionPiezasCm?: number
    activo: boolean
  }): Promise<PrintProfile | null> => {
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/perfiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear el perfil"))
      const created = env.data && typeof env.data === "object" ? (env.data as PrintProfile) : null
      await fetchProfiles()
      return created
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el perfil")
      return null
    }
  }

  const createPaper = async () => {
    setConfigError(null)
    const nombre = newPaperNombre.trim()
    const tipo = newPaperTipo.trim()
    const gramaje = newPaperGramaje.trim()
    const parsedGramaje = gramaje ? parseInt(gramaje, 10) : null
    const parsedPliegoW = parseFloat(newPaperPliegoW)
    const parsedPliegoH = parseFloat(newPaperPliegoH)
    const parsedCostoPliego = parseFloat(newPaperCostoPliego)

    if (!nombre) {
      setConfigError("El nombre del papel es obligatorio")
      return
    }

    if (papers.some((paper) => normalizePaperName(paper.nombre) === normalizePaperName(nombre))) {
      setConfigError(`Ya existe un papel con el nombre \"${nombre}\"`)
      return
    }

    if (gramaje && (parsedGramaje === null || parsedGramaje <= 0)) {
      setConfigError("El gramaje debe ser mayor a 0")
      return
    }

    if (!Number.isFinite(parsedPliegoW) || parsedPliegoW <= 0 || !Number.isFinite(parsedPliegoH) || parsedPliegoH <= 0) {
      setConfigError("El pliego base debe tener ancho y alto mayores a 0")
      return
    }

    if (!Number.isFinite(parsedCostoPliego) || parsedCostoPliego < 0) {
      setConfigError("El costo por pliego no puede ser negativo")
      return
    }

    try {
      const res = await fetch("/api/litografia/papeles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          tipo: tipo || null,
          gramaje: parsedGramaje,
          pliegoWidthCm: parsedPliegoW,
          pliegoHeightCm: parsedPliegoH,
          costoPliego: parsedCostoPliego,
          activo: true,
        }),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear el papel"))
      setNewPaperNombre("")
      setNewPaperTipo("")
      setNewPaperGramaje("")
      setNewPaperPliegoW("70")
      setNewPaperPliegoH("100")
      setNewPaperCostoPliego("0")
      await fetchPapers()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el papel")
    }
  }

  const patchProfile = async (id: string, patch: Partial<PrintProfile>) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/perfiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo actualizar"))
      await fetchProfiles()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo actualizar")
    }
  }

  const patchPaper = async (id: string, patch: Partial<PaperRate>) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/papeles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo actualizar"))
      await fetchPapers()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo actualizar")
    }
  }

  const deleteProfile = async (id: string) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/perfiles/${id}`, { method: "DELETE" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo eliminar"))
      if (selectedPlanchaProfileId === id) setSelectedPlanchaProfileId("")
      if (selectedTintaProfileId === id) setSelectedTintaProfileId("")
      await fetchProfiles()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo eliminar")
    }
  }

  const deletePlanchaProfile = async (id: string) => {
    const profile = profiles.find((p) => p.id === id) || null
    if (!profile) return

    const plancha = Number(profile.costoPlanchaPorColor ?? 0) || 0
    const tinta = Number(profile.costoTintaPorColor ?? 0) || 0

    // Si el perfil está "mezclado" (tiene plancha y tinta), al eliminar desde Planchas
    // solo removemos la parte de plancha para no afectar el módulo de Tintas.
    if (plancha > 0 && tinta > 0) {
      if (selectedPlanchaProfileId === id) setSelectedPlanchaProfileId("")
      await patchProfile(id, { costoPlanchaPorColor: 0 })
      return
    }

    await deleteProfile(id)
  }

  const deleteTintaProfile = async (id: string) => {
    const profile = profiles.find((p) => p.id === id) || null
    if (!profile) return

    const plancha = Number(profile.costoPlanchaPorColor ?? 0) || 0
    const tinta = Number(profile.costoTintaPorColor ?? 0) || 0

    // Si el perfil está "mezclado" (tiene plancha y tinta), al eliminar desde Tintas
    // solo removemos la parte de tinta para no afectar el módulo de Planchas.
    if (plancha > 0 && tinta > 0) {
      if (selectedTintaProfileId === id) setSelectedTintaProfileId("")
      await patchProfile(id, { costoTintaPorColor: 0 })
      return
    }

    await deleteProfile(id)
  }

  const deletePaper = async (id: string) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/papeles/${id}`, { method: "DELETE" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo eliminar"))
      if (selectedPaperId === id) setSelectedPaperId("")
      await fetchPapers()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo eliminar")
    }
  }

  const createFlyerRate = async () => {
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/flyers-tarifas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatoKey: newFlyerFormatoKey,
          tintas: newFlyerTintas,
          tirajeMin: parseInt(newFlyerMin, 10) || 0,
          tirajeMax: parseInt(newFlyerMax, 10) || 0,
          paperRateId: newFlyerPaperId.trim(),
          finishOptionId: newFlyerFinishId.trim() || null,
          precioTotal: parseFloat(newFlyerPrecioTotal) || 0,
          activo: true,
        }),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear la tarifa"))
      setNewFlyerPrecioTotal("0")
      await fetchFlyerRates()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear la tarifa")
    }
  }

  const patchFlyerRate = async (id: string, patch: Partial<FlyerRate>) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/flyers-tarifas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo actualizar"))
      await fetchFlyerRates()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo actualizar")
    }
  }

  const deleteFlyerRate = async (id: string) => {
    setConfigError(null)
    try {
      const res = await fetch(`/api/litografia/flyers-tarifas/${id}`, { method: "DELETE" })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo eliminar"))
      await fetchFlyerRates()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo eliminar")
    }
  }

  const calc = useMemo(() => {
    const usePliego = papelPorPliego
    const parsedFormatoW = selectedPreset ? selectedPreset.widthCm : parseFloat(formatoW) || 0
    const parsedFormatoH = selectedPreset ? selectedPreset.heightCm : parseFloat(formatoH) || 0

    return computeLitografia({
      cantidad: parseFloat(cantidad) || 0,
      colores: parseFloat(colores) || 1,
      desperdicioPct: parseFloat(desperdicioPct) || 0,
      costoPlanchaPorColor: Number(selectedPlanchaProfile?.costoPlanchaPorColor) || parseFloat(costoPlanchaPorColor) || 0,
      costoTintaPorColor: Number(selectedTintaProfile?.costoTintaPorColor) || parseFloat(costoTintaPorColor) || 0,
      costoPapelUnidad: parseFloat(costoPapelUnidad) || 0,
      papelModo: usePliego ? "pliego" : "unidad",
      papelTipo,
      papelPliegoWidthCm: parseFloat(pliegoW) || 0,
      papelPliegoHeightCm: parseFloat(pliegoH) || 0,
      papelFormatoWidthCm: parsedFormatoW,
      papelFormatoHeightCm: parsedFormatoH,
      maquinaPliegoWidthCm: Number(selectedPlanchaProfile?.anchoUtilCm) || 0,
      maquinaPliegoHeightCm: Number(selectedPlanchaProfile?.altoUtilCm) || 0,
      maquinaSeparacionCm: 0,
      costoPliego: parseFloat(costoPliego) || 0,
      costoCorte: parseFloat(costoCorte) || 0,
      // En modo tarifario, los acabados suelen ir dentro del precio del tarifario.
      // Si no existe tarifa, usamos este cálculo como estimado; el acabado se toma del valor configurado.
      costoAcabados: selectedFinish?.valor != null ? Number(selectedFinish.valor) || 0 : (parseFloat(costoAcabados) || 0),
      costoTransporte: parseFloat(costoTransporte) || 0,
      margenPct: 0,
    })
  }, [
    cantidad,
    colores,
    desperdicioPct,
    costoPlanchaPorColor,
    costoTintaPorColor,
    costoPapelUnidad,
    papelPorPliego,
    papelTipo,
    costoPliego,
    pliegoW,
    pliegoH,
    formatoW,
    formatoH,
    selectedPreset,
    selectedPlanchaProfile,
    selectedTintaProfile,
    selectedFinish,
    costoCorte,
    costoAcabados,
    costoTransporte,
  ])

  const planchaProfiles = useMemo(() => {
    const base = profiles.filter((p) => (p.costoPlanchaPorColor ?? 0) > 0)
    const q = planchaProfilesSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [profiles, planchaProfilesSearch])

  const hasPlanchaProfiles = useMemo(() => {
    return profiles.some((p) => (p.costoPlanchaPorColor ?? 0) > 0)
  }, [profiles])

  const tintaProfiles = useMemo(() => {
    const base = profiles.filter((p) => (p.costoTintaPorColor ?? 0) > 0)
    const q = tintaProfilesSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [profiles, tintaProfilesSearch])

  const hasTintaProfiles = useMemo(() => {
    return profiles.some((p) => (p.costoTintaPorColor ?? 0) > 0)
  }, [profiles])

  useEffect(() => {
    setPlanchaProfilesPage(0)
  }, [planchaProfilesSearch])

  useEffect(() => {
    setTintaProfilesPage(0)
  }, [tintaProfilesSearch])

  useEffect(() => {
    setPapersPage(0)
  }, [papersSearch])

  useEffect(() => {
    setSizesPage(0)
  }, [sizesSearch])

  useEffect(() => {
    setFinishesPage(0)
  }, [acabadosSearch])

  useEffect(() => {
    setSpecialFinishesPage(0)
  }, [specialAcabadosSearch])

  useEffect(() => {
    setPlastificadosPage(0)
  }, [plastificadosSearch])

  useEffect(() => {
    setTroqueladosPage(0)
  }, [troqueladosSearch])

  useEffect(() => {
    setTroqueladasPage(0)
  }, [troqueladasSearch])

  useEffect(() => {
    setCortesPage(0)
  }, [cortesSearch])

  useEffect(() => {
    setRatesPage(0)
  }, [flyerRatesSearch])

  const papersList = useMemo(() => {
    const base = papers
    const q = papersSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((p) => {
      const gramaje = p.gramaje != null ? String(p.gramaje) : ""
      return `${p.nombre} ${p.tipo ?? ""} ${gramaje}`.toLowerCase().includes(q)
    })
  }, [papers, papersSearch])

  const sizesList = useMemo(() => {
    const base = sizes
    const q = sizesSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((s) => `${s.nombre} ${s.key}`.toLowerCase().includes(q))
  }, [sizes, sizesSearch])

  const acabadosList = useMemo(() => {
    const base = acabadosFinishes
    const q = acabadosSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((f) => f.nombre.toLowerCase().includes(q))
  }, [acabadosFinishes, acabadosSearch])

  const specialFinishesList = useMemo(() => {
    const base = specialFinishes
    const q = specialAcabadosSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((f) => f.nombre.toLowerCase().includes(q))
  }, [specialFinishes, specialAcabadosSearch])

  const plastificadosList = useMemo(() => {
    const base = plastificadosFinishes
    const q = plastificadosSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((f) => f.nombre.toLowerCase().includes(q))
  }, [plastificadosFinishes, plastificadosSearch])

  const troqueladosList = useMemo(() => {
    const base = troqueladosFinishes
    const q = troqueladosSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((f) => f.nombre.toLowerCase().includes(q))
  }, [troqueladosFinishes, troqueladosSearch])

  const troqueladasList = useMemo(() => {
    const base = troqueladasFinishes
    const q = troqueladasSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((f) => f.nombre.toLowerCase().includes(q))
  }, [troqueladasFinishes, troqueladasSearch])

  const cortesList = useMemo(() => {
    const base = cortesFinishes
    const q = cortesSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((f) => f.nombre.toLowerCase().includes(q))
  }, [cortesFinishes, cortesSearch])

  const pagedPlanchaProfiles = useMemo(() => {
    const start = planchaProfilesPage * PAGE_SIZE
    return planchaProfiles.slice(start, start + PAGE_SIZE)
  }, [planchaProfiles, planchaProfilesPage, PAGE_SIZE])

  const pagedTintaProfiles = useMemo(() => {
    const start = tintaProfilesPage * PAGE_SIZE
    return tintaProfiles.slice(start, start + PAGE_SIZE)
  }, [tintaProfiles, tintaProfilesPage, PAGE_SIZE])

  const pagedPapers = useMemo(() => {
    const start = papersPage * PAGE_SIZE
    return papersList.slice(start, start + PAGE_SIZE)
  }, [papersList, papersPage, PAGE_SIZE])

  const pagedFinishes = useMemo(() => {
    const start = finishesPage * PAGE_SIZE
    return acabadosList.slice(start, start + PAGE_SIZE)
  }, [acabadosList, finishesPage, PAGE_SIZE])

  const pagedPlastificados = useMemo(() => {
    const start = plastificadosPage * PAGE_SIZE
    return plastificadosList.slice(start, start + PAGE_SIZE)
  }, [plastificadosList, plastificadosPage, PAGE_SIZE])

  const pagedTroquelados = useMemo(() => {
    const start = troqueladosPage * PAGE_SIZE
    return troqueladosList.slice(start, start + PAGE_SIZE)
  }, [troqueladosList, troqueladosPage, PAGE_SIZE])

  const pagedTroqueladas = useMemo(() => {
    const start = troqueladasPage * PAGE_SIZE
    return troqueladasList.slice(start, start + PAGE_SIZE)
  }, [troqueladasList, troqueladasPage, PAGE_SIZE])

  const pagedCortes = useMemo(() => {
    const start = cortesPage * PAGE_SIZE
    return cortesList.slice(start, start + PAGE_SIZE)
  }, [cortesList, cortesPage, PAGE_SIZE])

  const pagedSpecialFinishes = useMemo(() => {
    const start = specialFinishesPage * PAGE_SIZE
    return specialFinishesList.slice(start, start + PAGE_SIZE)
  }, [specialFinishesList, specialFinishesPage, PAGE_SIZE])

  const pagedSizes = useMemo(() => {
    const start = sizesPage * PAGE_SIZE
    return sizesList.slice(start, start + PAGE_SIZE)
  }, [sizesList, sizesPage, PAGE_SIZE])

  const filteredFlyerRates = useMemo(() => {
    return flyerRates.filter((r) => {
      if (ratesFilterFormatoKey && r.formatoKey !== ratesFilterFormatoKey) return false
      if (ratesFilterTintas !== "" && r.tintas !== ratesFilterTintas) return false

      if (ratesFilterPaperId) {
        if (r.paperRateId !== ratesFilterPaperId) return false
      }

      if (ratesFilterFinishId === "__generic__") {
        if (r.finishOptionId != null) return false
      } else if (ratesFilterFinishId) {
        if (r.finishOptionId !== ratesFilterFinishId) return false
      }

      return true
    })
  }, [flyerRates, ratesFilterFormatoKey, ratesFilterTintas, ratesFilterPaperId, ratesFilterFinishId])

  const groupedFlyerRates = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        formatoKey: string
        tintas: number
        paperRateId: string | null
        finishOptionId: string | null
        productoId: string | null
        productoNombre: string | null
        rates: FlyerRate[]
      }
    >()

    for (const r of filteredFlyerRates) {
      const paperKey = r.paperRateId ?? ""
      const finishKey = r.finishOptionId ?? ""
      const key = `${paperKey}__${finishKey}__${r.formatoKey}__${r.tintas}`
      const existing = map.get(key)
      if (existing) {
        existing.rates.push(r)
      } else {
        map.set(key, {
          key,
          formatoKey: r.formatoKey,
          tintas: r.tintas,
          paperRateId: r.paperRateId ?? null,
          finishOptionId: r.finishOptionId ?? null,
          productoId: r.productoId ?? null,
          productoNombre: r.producto?.nombre ?? null,
          rates: [r],
        })
      }
    }

    const groups = Array.from(map.values())
    for (const g of groups) {
      g.rates.sort((a, b) => a.tirajeMin - b.tirajeMin)
      const ids = new Set<string>()
      for (const r of g.rates) if (r.productoId) ids.add(r.productoId)
      if (ids.size === 1) {
        const only = Array.from(ids)[0]!
        g.productoId = only
        const fromRate = g.rates.find((r) => r.productoId === only)?.producto?.nombre ?? null
        const fromList = productos.find((p) => p.id === only)?.nombre ?? null
        g.productoNombre = fromList || fromRate
      } else {
        g.productoId = null
        g.productoNombre = null
      }
    }
    groups.sort((a, b) => {
      if (a.formatoKey !== b.formatoKey) return a.formatoKey.localeCompare(b.formatoKey)
      if (a.tintas !== b.tintas) return a.tintas - b.tintas
      return (a.paperRateId ?? "").localeCompare(b.paperRateId ?? "")
    })
    return groups
  }, [filteredFlyerRates, productos])

  const pagedFlyerRateGroups = useMemo(() => {
    const start = ratesPage * PAGE_SIZE
    const q = flyerRatesSearch.trim().toLowerCase()
    const base = groupedFlyerRates
    const filtered = !q
      ? base
      : base.filter((g) => {
          const sizeName = getSizeDisplayName(sizeOptions, g.formatoKey)
          const paperName = g.paperRateId ? (papers.find((p) => p.id === g.paperRateId)?.nombre || g.paperRateId) : ""
          const finishName = g.finishOptionId ? (finishes.find((f) => f.id === g.finishOptionId)?.nombre || g.finishOptionId) : ""
          const producto = g.productoNombre || ""
          return `${sizeName} ${g.formatoKey} ${paperName} ${finishName} ${producto}`.toLowerCase().includes(q)
        })

    return filtered.slice(start, start + PAGE_SIZE)
  }, [groupedFlyerRates, ratesPage, PAGE_SIZE, flyerRatesSearch, sizeOptions, papers, finishes])

  const flyerRateGroupsCount = useMemo(() => {
    const q = flyerRatesSearch.trim().toLowerCase()
    const base = groupedFlyerRates
    if (!q) return base.length
    return base.filter((g) => {
      const sizeName = getSizeDisplayName(sizeOptions, g.formatoKey)
      const paperName = g.paperRateId ? (papers.find((p) => p.id === g.paperRateId)?.nombre || g.paperRateId) : ""
      const finishName = g.finishOptionId ? (finishes.find((f) => f.id === g.finishOptionId)?.nombre || g.finishOptionId) : ""
      const producto = g.productoNombre || ""
      return `${sizeName} ${g.formatoKey} ${paperName} ${finishName} ${producto}`.toLowerCase().includes(q)
    }).length
  }, [groupedFlyerRates, flyerRatesSearch, sizeOptions, papers, finishes])

  return (
    <div className="space-y-4">
      <LitografiaPaperRequestsAdminDialog
        open={paperRequestsOpen}
        onOpenChange={setPaperRequestsOpen}
        onApproved={fetchPapers}
      />
      {configError ? <p className="text-sm text-red-600">{configError}</p> : null}

      {tab === "config" ? (
        <div className="space-y-4">
          
          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Dropdowns personalizados</CardTitle>
                  <CardDescription>
                    Crea nuevas listas (dropdowns) por empresa, con buscador. Puedes editar y eliminar listas y sus opciones.
                  </CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                {customDropdownsError ? <p className="text-sm text-red-600">{customDropdownsError}</p> : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void createTemplateIfMissing('transporte')} disabled={!meLoaded || !canConfigWrite}>
                    Crear plantilla Transporte
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void createTemplateIfMissing('tirajeTiers')} disabled={!meLoaded || !canConfigWrite}>
                    Crear plantilla Rangos sugeridos
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void createTemplateIfMissing('editorialProducto')} disabled={!meLoaded || !canConfigWrite}>
                    Crear plantilla Editorial
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void createTemplateIfMissing('visualCatalog')} disabled={!meLoaded || !canConfigWrite}>
                    Crear plantilla Catálogo visual
                  </Button>
                </div>

                <div>
                  <Label>Buscar dropdown</Label>
                  <Input className={INPUT_COMPACT} value={dropdownsSearch} onChange={(e) => setDropdownsSearch(e.target.value)} placeholder="Buscar por nombre o key…" />
                </div>

                {customDropdownsLoading ? <p className="text-sm text-muted-foreground">Cargando dropdowns…</p> : null}
                {!customDropdownsLoading && visibleCustomDropdowns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay dropdowns personalizados.</p>
                ) : null}

                <div className="space-y-3">
                  {visibleCustomDropdowns.map((d) => {
                    const draft = dropdownEdits[d.id] || {}
                    const draftNombre = draft.nombre ?? d.nombre

                    const isNombreDirty = draft.nombre !== undefined && draftNombre.trim() !== d.nombre
                    const canSave = isNombreDirty && draftNombre.trim()

                    const itemQ = (itemSearch[d.id] || "").trim().toLowerCase()
                    const items = (d.items ?? []).slice().sort((a, b) => {
                      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                      return a.label.localeCompare(b.label)
                    })
                    const visibleItems = !itemQ
                      ? items
                      : items.filter((it) => it.label.toLowerCase().includes(itemQ) || it.value.toLowerCase().includes(itemQ))

                    const isTirajeTiers = d.key === CUSTOM_DROPDOWN_KEYS.tirajeTiers
                    const isEditorial = d.key === CUSTOM_DROPDOWN_KEYS.editorialProducto
                    const isVisualCatalog = d.key === CUSTOM_DROPDOWN_KEYS.visualCatalog
                    const newIt =
                      newItemDraft[d.id] ||
                      (isVisualCatalog
                        ? {
                            label: "",
                            value: "",
                            metaJson:
                              '{\n  "categoryId": "cartas-menus",\n  "categoryLabel": "Cartas y menus",\n  "categoryDescription": "",\n  "categoryIcon": "document",\n  "shortTitle": "",\n  "description": "",\n  "imageUrl": "",\n  "finalWidthCm": 21.59,\n  "finalHeightCm": 27.94,\n  "operationalWidthCm": 21.59,\n  "operationalHeightCm": 27.94,\n  "frontInk": "4",\n  "backInk": "4",\n  "paperTypeHint": "propalcote",\n  "paperWeightHint": 300,\n  "finishHints": [],\n  "extraNote": "",\n  "suggestedExtraQty": 100\n}',
                          }
                        : isTirajeTiers
                        ? { label: "", min: "", max: "" }
                        : isEditorial
                          ? {
                              label: "",
                              totalPaginas: "32",
                              paginasPortadaContraportada: "2",
                              cartasPorPlancha: "2",
                              paginasPorPliego: "4",
                            }
                          : { label: "", costo: "" })

                    return (
                      <div key={d.id} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{d.nombre}</p>
                            <p className="text-xs text-muted-foreground truncate">{d.key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void fetchCustomDropdowns()}
                              disabled={customDropdownsLoading}
                            >
                              Refrescar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => void deleteCustomDropdown(d.id)}
                              disabled={!meLoaded || !canConfigWrite}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                          <div>
                            <Label>Nombre</Label>
                            <Input
                              className={INPUT_COMPACT}
                              value={draftNombre}
                              onChange={(e) =>
                                setDropdownEdits((prev) => ({
                                  ...prev,
                                  [d.id]: { ...prev[d.id], nombre: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="md:col-span-2 flex items-center gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                const patch: { nombre?: string } = {}
                                if (isNombreDirty) patch.nombre = draftNombre.trim()
                                void patchCustomDropdown(d.id, patch).then(() => {
                                  setDropdownEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[d.id]
                                    return next
                                  })
                                })
                              }}
                              disabled={!meLoaded || !canConfigWrite || !canSave}
                            >
                              Guardar cambios
                            </Button>
                            {isNombreDirty && !canSave ? (
                              <p className="text-xs text-muted-foreground">Revisa nombre (obligatorio).</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-end justify-between gap-2">
                            <div className="flex-1">
                              <Label>Buscar opción</Label>
                              <Input
                                className={INPUT_COMPACT}
                                value={itemSearch[d.id] || ""}
                                onChange={(e) => setItemSearch((prev) => ({ ...prev, [d.id]: e.target.value }))}
                                placeholder="Buscar por nombre…"
                              />
                            </div>
                          </div>

                          {isVisualCatalog ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                              <div>
                                <Label>Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={newIt.label}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), label: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Identificador</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={newIt.value ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), value: e.target.value },
                                    }))
                                  }
                                  placeholder="menu-simple"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label>Metadata JSON</Label>
                                <Textarea
                                  className="min-h-56 text-xs font-mono"
                                  value={newIt.metaJson ?? "{}"}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), metaJson: e.target.value },
                                    }))
                                  }
                                />
                                <p className="mt-1 text-xs text-muted-foreground">Aquí puedes definir imagen, categoría, tamaños, papel sugerido y acabados por defecto.</p>
                              </div>
                              <div className="md:col-span-2">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const label = newIt.label.trim()
                                    const value = String(newIt.value ?? "").trim()
                                    if (!label || !value) return
                                    try {
                                      const meta = JSON.parse(String(newIt.metaJson ?? "{}")) as unknown
                                      void createCustomItem(d.id, {
                                        label,
                                        value,
                                        activo: true,
                                        meta,
                                      }).then(() => {
                                        setNewItemDraft((prev) => ({
                                          ...prev,
                                          [d.id]: {
                                            label: "",
                                            value: "",
                                            metaJson:
                                              '{\n  "categoryId": "cartas-menus",\n  "categoryLabel": "Cartas y menus",\n  "categoryDescription": "",\n  "categoryIcon": "document",\n  "shortTitle": "",\n  "description": "",\n  "imageUrl": "",\n  "finalWidthCm": 21.59,\n  "finalHeightCm": 27.94,\n  "operationalWidthCm": 21.59,\n  "operationalHeightCm": 27.94,\n  "frontInk": "4",\n  "backInk": "4",\n  "paperTypeHint": "propalcote",\n  "paperWeightHint": 300,\n  "finishHints": [],\n  "extraNote": "",\n  "suggestedExtraQty": 100\n}',
                                          },
                                        }))
                                      })
                                    } catch {
                                      setCustomDropdownsError('Metadata JSON inválida')
                                    }
                                  }}
                                  disabled={!meLoaded || !canConfigWrite || !newIt.label.trim() || !String(newIt.value ?? '').trim()}
                                >
                                  Agregar opción
                                </Button>
                              </div>
                            </div>
                          ) : isTirajeTiers ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div>
                                <Label>Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={newIt.label}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), label: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Desde</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={newIt.min ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), min: e.target.value },
                                    }))
                                  }
                                  placeholder="1"
                                />
                              </div>
                              <div>
                                <Label>Hasta</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={newIt.max ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), max: e.target.value },
                                    }))
                                  }
                                  placeholder="500"
                                />
                              </div>
                              <div className="md:col-span-3">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const label = newIt.label.trim()
                                    if (!label) return
                                    const min = Number.parseInt(String(newIt.min ?? '').trim(), 10)
                                    const max = Number.parseInt(String(newIt.max ?? '').trim(), 10)
                                    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) {
                                      setCustomDropdownsError('Rango inválido (desde/hasta)')
                                      return
                                    }
                                    void createCustomItem(d.id, {
                                      label,
                                      activo: true,
                                      meta: { min, max },
                                    }).then(() => {
                                      setNewItemDraft((prev) => ({ ...prev, [d.id]: { label: "", min: "", max: "" } }))
                                    })
                                  }}
                                  disabled={!meLoaded || !canConfigWrite || !newIt.label.trim()}
                                >
                                  Agregar opción
                                </Button>
                              </div>
                            </div>
                          ) : isEditorial ? (
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label>Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={newIt.label}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), label: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Páginas</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={newIt.totalPaginas ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), totalPaginas: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Portada+contra</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={newIt.paginasPortadaContraportada ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), paginasPortadaContraportada: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Cartas/plancha</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={newIt.cartasPorPlancha ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), cartasPorPlancha: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Páginas/pliego</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={newIt.paginasPorPliego ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), paginasPorPliego: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="md:col-span-5">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const label = newIt.label.trim()
                                    if (!label) return
                                    const totalPaginas = Number.parseInt(String(newIt.totalPaginas ?? '').trim(), 10)
                                    const paginasPortadaContraportada = Number.parseInt(String(newIt.paginasPortadaContraportada ?? '').trim(), 10)
                                    const cartasPorPlancha = Number.parseInt(String(newIt.cartasPorPlancha ?? '').trim(), 10)
                                    const paginasPorPliego = Number.parseInt(String(newIt.paginasPorPliego ?? '').trim(), 10)
                                    if (!Number.isFinite(totalPaginas) || totalPaginas <= 0) {
                                      setCustomDropdownsError('Páginas inválidas')
                                      return
                                    }
                                    if (!Number.isFinite(paginasPortadaContraportada) || paginasPortadaContraportada < 0) {
                                      setCustomDropdownsError('Portada+contra inválido')
                                      return
                                    }
                                    if (!Number.isFinite(cartasPorPlancha) || cartasPorPlancha <= 0) {
                                      setCustomDropdownsError('Cartas/plancha inválido')
                                      return
                                    }
                                    if (!Number.isFinite(paginasPorPliego) || paginasPorPliego <= 0) {
                                      setCustomDropdownsError('Páginas/pliego inválido')
                                      return
                                    }
                                    void createCustomItem(d.id, {
                                      label,
                                      activo: true,
                                      meta: {
                                        kind: String(label).toUpperCase().includes('REVISTA') ? 'REVISTA' : undefined,
                                        totalPaginas,
                                        paginasPortadaContraportada,
                                        cartasPorPlancha,
                                        paginasPorPliego,
                                      },
                                    }).then(() => {
                                      setNewItemDraft((prev) => ({
                                        ...prev,
                                        [d.id]: {
                                          label: "",
                                          totalPaginas: "32",
                                          paginasPortadaContraportada: "2",
                                          cartasPorPlancha: "2",
                                          paginasPorPliego: "4",
                                        },
                                      }))
                                    })
                                  }}
                                  disabled={!meLoaded || !canConfigWrite || !newIt.label.trim()}
                                >
                                  Agregar opción
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                              <div>
                                <Label>Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={newIt.label}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), label: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Costo / Valor</Label>
                                <MoneyInput
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={newIt.costo ?? ""}
                                  onChange={(e) =>
                                    setNewItemDraft((prev) => ({
                                      ...prev,
                                      [d.id]: { ...(prev[d.id] || newIt), costo: e.target.value },
                                    }))
                                  }
                                  placeholder="0"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const label = newIt.label.trim()
                                    if (!label) return
                                    const costo = Number.parseFloat(String(newIt.costo ?? '').trim())
                                    if (!Number.isFinite(costo) || costo < 0) {
                                      setCustomDropdownsError('Costo/valor inválido')
                                      return
                                    }
                                    void createCustomItem(d.id, {
                                      label,
                                      activo: true,
                                      meta: { total: costo },
                                    }).then(() => {
                                      setNewItemDraft((prev) => ({ ...prev, [d.id]: { label: "", costo: "" } }))
                                    })
                                  }}
                                  disabled={!meLoaded || !canConfigWrite || !newIt.label.trim()}
                                >
                                  Agregar opción
                                </Button>
                              </div>
                            </div>
                          )}

                          {visibleItems.length === 0 ? <p className="text-sm text-muted-foreground">Sin opciones.</p> : null}

                          <div className="space-y-2">
                            {visibleItems.map((it) => {
                              const edit = itemEdits[it.id] || {}
                              const draftLabel = edit.label ?? it.label
                              const draftValue = edit.value ?? it.value
                              const draftMetaJson = edit.metaJson ?? formatMetaJson(it.meta)
                              const draftCosto = edit.costo ?? getCostoFromMeta(it.meta)
                              const draftMin = edit.min ?? getNumberFieldFromMeta(it.meta, 'min')
                              const draftMax = edit.max ?? getNumberFieldFromMeta(it.meta, 'max')
                              const draftTotalPaginas = edit.totalPaginas ?? String(metaNumber(it.meta, 'totalPaginas') ?? '')
                              const draftPortadaContra = edit.paginasPortadaContraportada ?? String(metaNumber(it.meta, 'paginasPortadaContraportada') ?? '')
                              const draftCartasPorPlancha = edit.cartasPorPlancha ?? String(metaNumber(it.meta, 'cartasPorPlancha') ?? '')
                              const draftPaginasPorPliego = edit.paginasPorPliego ?? String(metaNumber(it.meta, 'paginasPorPliego') ?? '')

                              const isLabelDirty = edit.label !== undefined && draftLabel.trim() !== it.label
                              const isValueDirty = edit.value !== undefined && draftValue.trim() !== it.value
                              const isMetaJsonDirty = edit.metaJson !== undefined && draftMetaJson.trim() !== formatMetaJson(it.meta).trim()

                              const parsedCosto = Number.parseFloat(String(draftCosto ?? '').trim())
                              const parsedMin = Number.parseInt(String(draftMin ?? '').trim(), 10)
                              const parsedMax = Number.parseInt(String(draftMax ?? '').trim(), 10)
                              const parsedTotalPaginas = Number.parseInt(String(draftTotalPaginas ?? '').trim(), 10)
                              const parsedPortadaContra = Number.parseInt(String(draftPortadaContra ?? '').trim(), 10)
                              const parsedCartasPorPlancha = Number.parseInt(String(draftCartasPorPlancha ?? '').trim(), 10)
                              const parsedPaginasPorPliego = Number.parseInt(String(draftPaginasPorPliego ?? '').trim(), 10)

                              const isCostoDirty =
                                edit.costo !== undefined &&
                                Number.isFinite(parsedCosto) &&
                                parsedCosto >= 0 &&
                                String(parsedCosto) !== String(getCostoFromMeta(it.meta))
                              const isMinDirty =
                                edit.min !== undefined &&
                                Number.isFinite(parsedMin) &&
                                parsedMin > 0 &&
                                String(parsedMin) !== String(getNumberFieldFromMeta(it.meta, 'min'))
                              const isMaxDirty =
                                edit.max !== undefined &&
                                Number.isFinite(parsedMax) &&
                                parsedMax > 0 &&
                                String(parsedMax) !== String(getNumberFieldFromMeta(it.meta, 'max'))

                              const isTotalPaginasDirty =
                                edit.totalPaginas !== undefined &&
                                Number.isFinite(parsedTotalPaginas) &&
                                parsedTotalPaginas > 0 &&
                                String(parsedTotalPaginas) !== String(metaNumber(it.meta, 'totalPaginas') ?? '')
                              const isPortadaContraDirty =
                                edit.paginasPortadaContraportada !== undefined &&
                                Number.isFinite(parsedPortadaContra) &&
                                parsedPortadaContra >= 0 &&
                                String(parsedPortadaContra) !== String(metaNumber(it.meta, 'paginasPortadaContraportada') ?? '')
                              const isCartasPorPlanchaDirty =
                                edit.cartasPorPlancha !== undefined &&
                                Number.isFinite(parsedCartasPorPlancha) &&
                                parsedCartasPorPlancha > 0 &&
                                String(parsedCartasPorPlancha) !== String(metaNumber(it.meta, 'cartasPorPlancha') ?? '')
                              const isPaginasPorPliegoDirty =
                                edit.paginasPorPliego !== undefined &&
                                Number.isFinite(parsedPaginasPorPliego) &&
                                parsedPaginasPorPliego > 0 &&
                                String(parsedPaginasPorPliego) !== String(metaNumber(it.meta, 'paginasPorPliego') ?? '')

                              const canItemSave = isVisualCatalog
                                ? (isLabelDirty || isValueDirty || isMetaJsonDirty) && draftLabel.trim() && draftValue.trim() && draftMetaJson.trim()
                                : isTirajeTiers
                                ? (isLabelDirty || isMinDirty || isMaxDirty) &&
                                  draftLabel.trim() &&
                                  Number.isFinite(parsedMin) &&
                                  Number.isFinite(parsedMax) &&
                                  parsedMin > 0 &&
                                  parsedMax > 0 &&
                                  parsedMin <= parsedMax
                                : isEditorial
                                  ? (isLabelDirty || isTotalPaginasDirty || isPortadaContraDirty || isCartasPorPlanchaDirty || isPaginasPorPliegoDirty) &&
                                    draftLabel.trim() &&
                                    Number.isFinite(parsedTotalPaginas) &&
                                    parsedTotalPaginas > 0 &&
                                    Number.isFinite(parsedPortadaContra) &&
                                    parsedPortadaContra >= 0 &&
                                    Number.isFinite(parsedCartasPorPlancha) &&
                                    parsedCartasPorPlancha > 0 &&
                                    Number.isFinite(parsedPaginasPorPliego) &&
                                    parsedPaginasPorPliego > 0
                                  : (isLabelDirty || isCostoDirty) && draftLabel.trim() && Number.isFinite(parsedCosto) && parsedCosto >= 0

                              return (
                                <div key={it.id} className="rounded-md border p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{it.label}</p>
                                      {isVisualCatalog ? (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {metaString(it.meta, 'categoryLabel') || 'Sin categoría'} • {metaString(it.meta, 'shortTitle') || it.value} • {metaString(it.meta, 'paperTypeHint') || 'Sin papel'}
                                        </p>
                                      ) : isTirajeTiers ? (
                                        <p className="text-xs text-muted-foreground truncate">
                                          Rango: {getNumberFieldFromMeta(it.meta, 'min') || "?"} - {getNumberFieldFromMeta(it.meta, 'max') || "?"}
                                        </p>
                                      ) : isEditorial ? (
                                        <p className="text-xs text-muted-foreground truncate">
                                          Páginas: {String(metaNumber(it.meta, 'totalPaginas') ?? '?')} • Cartas/plancha: {String(metaNumber(it.meta, 'cartasPorPlancha') ?? '?')} • Páginas/pliego: {String(metaNumber(it.meta, 'paginasPorPliego') ?? '?')}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-muted-foreground truncate">Costo/valor: {formatCurrency(Number.parseFloat(getCostoFromMeta(it.meta)) || 0)}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant={it.activo ? "outline" : "default"}
                                        onClick={() => void patchCustomItem(it.id, { activo: !it.activo })}
                                        disabled={!meLoaded || !canConfigWrite}
                                      >
                                        {it.activo ? "Desactivar" : "Activar"}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-red-600"
                                        onClick={() => void deleteCustomItem(it.id)}
                                        disabled={!meLoaded || !canConfigWrite}
                                      >
                                        Eliminar
                                      </Button>
                                    </div>
                                  </div>

                                  {isVisualCatalog ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                                      <div>
                                        <Label>Nombre</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          value={draftLabel}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], label: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Identificador</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          value={draftValue}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], value: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="md:col-span-2">
                                        <Label>Metadata JSON</Label>
                                        <Textarea
                                          className="min-h-56 text-xs font-mono"
                                          value={draftMetaJson}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], metaJson: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="md:col-span-2 flex items-center gap-2">
                                        <Button
                                          type="button"
                                          onClick={() => {
                                            try {
                                              const patch: { label?: string; value?: string; meta?: unknown } = {}
                                              if (isLabelDirty) patch.label = draftLabel.trim()
                                              if (isValueDirty) patch.value = draftValue.trim()
                                              if (isMetaJsonDirty) patch.meta = JSON.parse(draftMetaJson)
                                              void patchCustomItem(it.id, patch).then(() => {
                                                setItemEdits((prev) => {
                                                  const next = { ...prev }
                                                  delete next[it.id]
                                                  return next
                                                })
                                              })
                                            } catch {
                                              setCustomDropdownsError('Metadata JSON inválida')
                                            }
                                          }}
                                          disabled={!meLoaded || !canConfigWrite || !canItemSave}
                                        >
                                          Guardar opción
                                        </Button>
                                        {(isLabelDirty || isValueDirty || isMetaJsonDirty) && !canItemSave ? (
                                          <p className="text-xs text-muted-foreground">Revisa nombre, identificador o metadata JSON.</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : isTirajeTiers ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                      <div>
                                        <Label>Nombre</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          value={draftLabel}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], label: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Desde</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          value={draftMin}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], min: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Hasta</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          value={draftMax}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], max: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="md:col-span-3 flex items-center gap-2">
                                        <Button
                                          type="button"
                                          onClick={() => {
                                            const patch: { label?: string; meta?: unknown } = {}
                                            if (isLabelDirty) patch.label = draftLabel.trim()
                                            if (isMinDirty || isMaxDirty) {
                                              const min = Number.parseInt(String(draftMin ?? '').trim(), 10)
                                              const max = Number.parseInt(String(draftMax ?? '').trim(), 10)
                                              if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) {
                                                setCustomDropdownsError('Rango inválido (desde/hasta)')
                                                return
                                              }
                                              const baseMeta = it.meta && typeof it.meta === 'object' ? (it.meta as Record<string, unknown>) : {}
                                              patch.meta = { ...baseMeta, min, max }
                                            }
                                            void patchCustomItem(it.id, patch).then(() => {
                                              setItemEdits((prev) => {
                                                const next = { ...prev }
                                                delete next[it.id]
                                                return next
                                              })
                                            })
                                          }}
                                          disabled={!meLoaded || !canConfigWrite || !canItemSave}
                                        >
                                          Guardar opción
                                        </Button>
                                        {(isLabelDirty || isMinDirty || isMaxDirty) && !canItemSave ? (
                                          <p className="text-xs text-muted-foreground">Revisa nombre/rango.</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : isEditorial ? (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                                      <div className="md:col-span-2">
                                        <Label>Nombre</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          value={draftLabel}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], label: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Páginas</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          type="number"
                                          step="1"
                                          min="1"
                                          value={draftTotalPaginas}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], totalPaginas: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Portada+contra</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          type="number"
                                          step="1"
                                          min="0"
                                          value={draftPortadaContra}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], paginasPortadaContraportada: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Cartas/plancha</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          type="number"
                                          step="1"
                                          min="1"
                                          value={draftCartasPorPlancha}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], cartasPorPlancha: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Páginas/pliego</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          type="number"
                                          step="1"
                                          min="1"
                                          value={draftPaginasPorPliego}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], paginasPorPliego: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="md:col-span-5 flex items-center gap-2">
                                        <Button
                                          type="button"
                                          onClick={() => {
                                            const patch: { label?: string; meta?: unknown } = {}
                                            if (isLabelDirty) patch.label = draftLabel.trim()
                                            if (isTotalPaginasDirty || isPortadaContraDirty || isCartasPorPlanchaDirty || isPaginasPorPliegoDirty) {
                                              const totalPaginas = Number.parseInt(String(draftTotalPaginas ?? '').trim(), 10)
                                              const paginasPortadaContraportada = Number.parseInt(String(draftPortadaContra ?? '').trim(), 10)
                                              const cartasPorPlancha = Number.parseInt(String(draftCartasPorPlancha ?? '').trim(), 10)
                                              const paginasPorPliego = Number.parseInt(String(draftPaginasPorPliego ?? '').trim(), 10)
                                              if (!Number.isFinite(totalPaginas) || totalPaginas <= 0) {
                                                setCustomDropdownsError('Páginas inválidas')
                                                return
                                              }
                                              if (!Number.isFinite(paginasPortadaContraportada) || paginasPortadaContraportada < 0) {
                                                setCustomDropdownsError('Portada+contra inválido')
                                                return
                                              }
                                              if (!Number.isFinite(cartasPorPlancha) || cartasPorPlancha <= 0) {
                                                setCustomDropdownsError('Cartas/plancha inválido')
                                                return
                                              }
                                              if (!Number.isFinite(paginasPorPliego) || paginasPorPliego <= 0) {
                                                setCustomDropdownsError('Páginas/pliego inválido')
                                                return
                                              }
                                              const baseMeta = it.meta && typeof it.meta === 'object' ? (it.meta as Record<string, unknown>) : {}
                                              patch.meta = { ...baseMeta, totalPaginas, paginasPortadaContraportada, cartasPorPlancha, paginasPorPliego }
                                            }
                                            void patchCustomItem(it.id, patch).then(() => {
                                              setItemEdits((prev) => {
                                                const next = { ...prev }
                                                delete next[it.id]
                                                return next
                                              })
                                            })
                                          }}
                                          disabled={!meLoaded || !canConfigWrite || !canItemSave}
                                        >
                                          Guardar opción
                                        </Button>
                                        {(isLabelDirty || isTotalPaginasDirty || isPortadaContraDirty || isCartasPorPlanchaDirty || isPaginasPorPliegoDirty) && !canItemSave ? (
                                          <p className="text-xs text-muted-foreground">Revisa nombre/datos.</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                                      <div>
                                        <Label>Nombre</Label>
                                        <Input
                                          className={INPUT_COMPACT}
                                          value={draftLabel}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], label: e.target.value } }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Costo / Valor</Label>
                                        <MoneyInput
                                          className={INPUT_COMPACT}
                                          type="number"
                                          step="1"
                                          min="0"
                                          value={draftCosto}
                                          onChange={(e) => setItemEdits((prev) => ({ ...prev, [it.id]: { ...prev[it.id], costo: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="md:col-span-2 flex items-center gap-2">
                                        <Button
                                          type="button"
                                          onClick={() => {
                                            const patch: { label?: string; meta?: unknown } = {}
                                            if (isLabelDirty) patch.label = draftLabel.trim()
                                            if (isCostoDirty) {
                                              const costo = Number.parseFloat(String(draftCosto ?? '').trim())
                                              if (!Number.isFinite(costo) || costo < 0) {
                                                setCustomDropdownsError('Costo/valor inválido')
                                                return
                                              }
                                              const baseMeta = it.meta && typeof it.meta === 'object' ? (it.meta as Record<string, unknown>) : {}
                                              patch.meta = { ...baseMeta, total: costo }
                                            }
                                            void patchCustomItem(it.id, patch).then(() => {
                                              setItemEdits((prev) => {
                                                const next = { ...prev }
                                                delete next[it.id]
                                                return next
                                              })
                                            })
                                          }}
                                          disabled={!meLoaded || !canConfigWrite || !canItemSave}
                                        >
                                          Guardar opción
                                        </Button>
                                        {(isLabelDirty || isCostoDirty) && !canItemSave ? (
                                          <p className="text-xs text-muted-foreground">Revisa nombre/costo.</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="pt-2 border-t space-y-2">
                  <Label>Crear nuevo dropdown</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                    <div>
                      <Label>Nombre</Label>
                      <Input
                        className={INPUT_COMPACT}
                        value={newDropdownNombre}
                        onChange={(e) => setNewDropdownNombre(e.target.value)}
                        placeholder="Ej: Litografía: Mi lista"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="button"
                        onClick={() => {
                          const nombre = newDropdownNombre.trim()
                          if (!nombre) return
                          void createCustomDropdown({ nombre }).then(() => {
                            setNewDropdownNombre("")
                          })
                        }}
                        disabled={!meLoaded || !canConfigWrite || !newDropdownNombre.trim()}
                      >
                        Crear dropdown
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Se imprime en</CardTitle>
                  <CardDescription>Configura el tamaño real de impresión y el costo base de plancha por color para reutilizarlo en cotizaciones.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div className="md:col-span-2">
                    <Label>Nombre</Label>
                    <Input
                      className={INPUT_COMPACT}
                      value={newPlanchaProfileNombre}
                      onChange={(e) => setNewPlanchaProfileNombre(e.target.value)}
                      placeholder="Ej: Cuarto pliego"
                    />
                  </div>
                  <div>
                    <Label>Plancha/Color</Label>
                    <MoneyInput
                      className={INPUT_COMPACT}
                      type="number"
                      step="1"
                      value={newPlanchaProfilePlancha}
                      onChange={(e) => setNewPlanchaProfilePlancha(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Ancho (cm)</Label>
                    <Input
                      className={INPUT_COMPACT}
                      type="number"
                      step="0.1"
                      min="0"
                      value={newPlanchaProfileAnchoUtil}
                      onChange={(e) => setNewPlanchaProfileAnchoUtil(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Alto (cm)</Label>
                    <Input
                      className={INPUT_COMPACT}
                      type="number"
                      step="0.1"
                      min="0"
                      value={newPlanchaProfileAltoUtil}
                      onChange={(e) => setNewPlanchaProfileAltoUtil(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      type="button"
                      onClick={() => void createPlanchaProfile()}
                      disabled={!newPlanchaProfileNombre.trim() || (parseFloat(newPlanchaProfilePlancha) || 0) <= 0 || (parseFloat(newPlanchaProfileAnchoUtil) || 0) <= 0 || (parseFloat(newPlanchaProfileAltoUtil) || 0) <= 0}
                    >
                      Agregar plancha
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Buscar</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={planchaProfilesSearch}
                    onChange={(e) => setPlanchaProfilesSearch(e.target.value)}
                    placeholder="Buscar por nombre…"
                  />
                </div>

                <div className="space-y-2">
                  {profilesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {planchaProfiles.length === 0 && !profilesLoading ? (
                    <p className="text-sm text-muted-foreground">
                      {hasPlanchaProfiles && planchaProfilesSearch.trim() ? "Sin resultados." : "No hay formatos de impresión configurados."}
                    </p>
                  ) : null}

                  {pagedPlanchaProfiles.map((p) => (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">Costo plancha/color: {formatCurrency(p.costoPlanchaPorColor)}</p>
                          <p className="text-xs text-muted-foreground">Tamaño de impresión: {p.anchoUtilCm}×{p.altoUtilCm} cm</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={p.activo ? "outline" : "default"} onClick={() => patchProfile(p.id, { activo: !p.activo })}>
                            {p.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button type="button" variant="ghost" className="text-red-600" onClick={() => void deletePlanchaProfile(p.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const draft = profileEdits[p.id]
                        const draftNombre = draft?.nombre ?? p.nombre
                        const draftPlancha = draft?.plancha ?? String(p.costoPlanchaPorColor)
                        const draftAnchoUtil = draft?.anchoUtil ?? String(p.anchoUtilCm)
                        const draftAltoUtil = draft?.altoUtil ?? String(p.altoUtilCm)
                        const draftSeparacion = draft?.separacion ?? String(p.separacionPiezasCm ?? 0)
                        const parsedPlancha = parseFloat(draftPlancha)
                        const parsedAnchoUtil = parseFloat(draftAnchoUtil)
                        const parsedAltoUtil = parseFloat(draftAltoUtil)
                        const parsedSeparacion = parseFloat(draftSeparacion)

                        const hasDraft = Boolean(draft)
                        const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== p.nombre
                        const isPlanchaDirty =
                          draft?.plancha !== undefined &&
                          Number.isFinite(parsedPlancha) &&
                          parsedPlancha >= 0 &&
                          parsedPlancha !== p.costoPlanchaPorColor
                        const isAnchoDirty =
                          draft?.anchoUtil !== undefined &&
                          Number.isFinite(parsedAnchoUtil) &&
                          parsedAnchoUtil > 0 &&
                          parsedAnchoUtil !== p.anchoUtilCm
                        const isAltoDirty =
                          draft?.altoUtil !== undefined &&
                          Number.isFinite(parsedAltoUtil) &&
                          parsedAltoUtil > 0 &&
                          parsedAltoUtil !== p.altoUtilCm
                        const isSeparacionDirty =
                          draft?.separacion !== undefined &&
                          Number.isFinite(parsedSeparacion) &&
                          parsedSeparacion >= 0 &&
                          parsedSeparacion !== (p.separacionPiezasCm ?? 0)

                        const canSave =
                          (isNombreDirty || isPlanchaDirty || isAnchoDirty || isAltoDirty || isSeparacionDirty) &&
                          (!draftPlancha.trim() || (Number.isFinite(parsedPlancha) && parsedPlancha >= 0)) &&
                          (!draftAnchoUtil.trim() || (Number.isFinite(parsedAnchoUtil) && parsedAnchoUtil > 0)) &&
                          (!draftAltoUtil.trim() || (Number.isFinite(parsedAltoUtil) && parsedAltoUtil > 0)) &&
                          (!draftSeparacion.trim() || (Number.isFinite(parsedSeparacion) && parsedSeparacion >= 0))

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={draftNombre}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setProfileEdits((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        nombre: v,
                                        plancha: prev[p.id]?.plancha ?? String(p.costoPlanchaPorColor),
                                        tinta: prev[p.id]?.tinta ?? String(p.costoTintaPorColor),
                                        anchoUtil: prev[p.id]?.anchoUtil ?? String(p.anchoUtilCm),
                                        altoUtil: prev[p.id]?.altoUtil ?? String(p.altoUtilCm),
                                        separacion: prev[p.id]?.separacion ?? String(p.separacionPiezasCm ?? 0),
                                      },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Plancha/Color</Label>
                                <MoneyInput
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={draftPlancha}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setProfileEdits((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        nombre: prev[p.id]?.nombre ?? p.nombre,
                                        plancha: v,
                                        tinta: prev[p.id]?.tinta ?? String(p.costoTintaPorColor),
                                        anchoUtil: prev[p.id]?.anchoUtil ?? String(p.anchoUtilCm),
                                        altoUtil: prev[p.id]?.altoUtil ?? String(p.altoUtilCm),
                                        separacion: prev[p.id]?.separacion ?? String(p.separacionPiezasCm ?? 0),
                                      },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Ancho</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={draftAnchoUtil}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setProfileEdits((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        nombre: prev[p.id]?.nombre ?? p.nombre,
                                        plancha: prev[p.id]?.plancha ?? String(p.costoPlanchaPorColor),
                                        tinta: prev[p.id]?.tinta ?? String(p.costoTintaPorColor),
                                        anchoUtil: v,
                                        altoUtil: prev[p.id]?.altoUtil ?? String(p.altoUtilCm),
                                        separacion: prev[p.id]?.separacion ?? String(p.separacionPiezasCm ?? 0),
                                      },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Alto</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={draftAltoUtil}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setProfileEdits((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        nombre: prev[p.id]?.nombre ?? p.nombre,
                                        plancha: prev[p.id]?.plancha ?? String(p.costoPlanchaPorColor),
                                        tinta: prev[p.id]?.tinta ?? String(p.costoTintaPorColor),
                                        anchoUtil: prev[p.id]?.anchoUtil ?? String(p.anchoUtilCm),
                                        altoUtil: v,
                                        separacion: prev[p.id]?.separacion ?? String(p.separacionPiezasCm ?? 0),
                                      },
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setProfileEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[p.id]
                                    return next
                                  })
                                }
                                disabled={!hasDraft}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const nombre = draftNombre.trim()

                                  const nextPlancha =
                                    Number.isFinite(parsedPlancha) && parsedPlancha >= 0 ? parsedPlancha : (p.costoPlanchaPorColor ?? 0)

                                  const isMixed = (p.costoPlanchaPorColor ?? 0) > 0 && (p.costoTintaPorColor ?? 0) > 0
                                  if (isMixed) {
                                    void (async () => {
                                      const created = await createProfileDirect({
                                        nombre: nombre || p.nombre,
                                        costoPlanchaPorColor: nextPlancha,
                                        costoTintaPorColor: 0,
                                        anchoUtilCm: Number.isFinite(parsedAnchoUtil) && parsedAnchoUtil > 0 ? parsedAnchoUtil : p.anchoUtilCm,
                                        altoUtilCm: Number.isFinite(parsedAltoUtil) && parsedAltoUtil > 0 ? parsedAltoUtil : p.altoUtilCm,
                                        separacionPiezasCm: Number.isFinite(parsedSeparacion) && parsedSeparacion >= 0 ? parsedSeparacion : (p.separacionPiezasCm ?? 0),
                                        activo: p.activo,
                                      })

                                      // El original queda como perfil de tinta (solo removemos plancha)
                                      if (selectedPlanchaProfileId === p.id) {
                                        const nextId = created?.id
                                        setSelectedPlanchaProfileId(typeof nextId === "string" && nextId ? nextId : "")
                                      }

                                      await patchProfile(p.id, { costoPlanchaPorColor: 0 })
                                    })()
                                  } else {
                                    const patch: Partial<PrintProfile> = {}
                                    if (nombre && nombre !== p.nombre) patch.nombre = nombre
                                    if (Number.isFinite(parsedPlancha) && parsedPlancha >= 0 && parsedPlancha !== p.costoPlanchaPorColor) {
                                      patch.costoPlanchaPorColor = parsedPlancha
                                    }
                                    if (Number.isFinite(parsedAnchoUtil) && parsedAnchoUtil > 0 && parsedAnchoUtil !== p.anchoUtilCm) {
                                      patch.anchoUtilCm = parsedAnchoUtil
                                    }
                                    if (Number.isFinite(parsedAltoUtil) && parsedAltoUtil > 0 && parsedAltoUtil !== p.altoUtilCm) {
                                      patch.altoUtilCm = parsedAltoUtil
                                    }
                                    if (Number.isFinite(parsedSeparacion) && parsedSeparacion >= 0 && parsedSeparacion !== (p.separacionPiezasCm ?? 0)) {
                                      patch.separacionPiezasCm = parsedSeparacion
                                    }
                                    if (Object.keys(patch).length === 0) return
                                    void patchProfile(p.id, patch)
                                  }
                                }}
                                disabled={!canSave}
                              >
                                Guardar
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}

                  {planchaProfiles.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {planchaProfilesPage * PAGE_SIZE + 1}-
                        {Math.min(planchaProfiles.length, (planchaProfilesPage + 1) * PAGE_SIZE)} de {planchaProfiles.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPlanchaProfilesPage((p) => Math.max(0, p - 1))}
                          disabled={planchaProfilesPage <= 0}
                        >
                          Anterior
                        </Button>
                        <p className="text-xs">
                          Página {planchaProfilesPage + 1} / {Math.max(1, Math.ceil(planchaProfiles.length / PAGE_SIZE))}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPlanchaProfilesPage((p) => Math.min(Math.ceil(planchaProfiles.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={planchaProfilesPage >= Math.ceil(planchaProfiles.length / PAGE_SIZE) - 1}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Tintas</CardTitle>
                  <CardDescription>Costo de tinta por color.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div className="md:col-span-2">
                    <Label>Nombre</Label>
                    <Input
                      className={INPUT_COMPACT}
                      value={newTintaProfileNombre}
                      onChange={(e) => setNewTintaProfileNombre(e.target.value)}
                      placeholder="Ej: Offset 70×100"
                    />
                  </div>
                  <div>
                    <Label>Tinta/Color</Label>
                    <MoneyInput
                      className={INPUT_COMPACT}
                      type="number"
                      step="1"
                      value={newTintaProfileTinta}
                      onChange={(e) => setNewTintaProfileTinta(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      type="button"
                      onClick={() => void createTintaProfile()}
                      disabled={!newTintaProfileNombre.trim() || (parseFloat(newTintaProfileTinta) || 0) <= 0}
                    >
                      Agregar tinta
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Buscar</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={tintaProfilesSearch}
                    onChange={(e) => setTintaProfilesSearch(e.target.value)}
                    placeholder="Buscar por nombre…"
                  />
                </div>

                <div className="space-y-2">
                  {profilesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {tintaProfiles.length === 0 && !profilesLoading ? (
                    <p className="text-sm text-muted-foreground">
                      {hasTintaProfiles && tintaProfilesSearch.trim() ? "Sin resultados." : "No hay registros de tintas."}
                    </p>
                  ) : null}

                  {pagedTintaProfiles.map((p) => (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">Tinta/Color: {formatCurrency(p.costoTintaPorColor)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={p.activo ? "outline" : "default"} onClick={() => patchProfile(p.id, { activo: !p.activo })}>
                            {p.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button type="button" variant="ghost" className="text-red-600" onClick={() => void deleteTintaProfile(p.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const draft = profileEdits[p.id]
                        const draftNombre = draft?.nombre ?? p.nombre
                        const draftTinta = draft?.tinta ?? String(p.costoTintaPorColor)
                        const parsedTinta = parseFloat(draftTinta)

                        const hasDraft = Boolean(draft)
                        const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== p.nombre
                        const isTintaDirty =
                          draft?.tinta !== undefined &&
                          Number.isFinite(parsedTinta) &&
                          parsedTinta >= 0 &&
                          parsedTinta !== p.costoTintaPorColor

                        const canSave =
                          (isNombreDirty || isTintaDirty) &&
                          (!draftTinta.trim() || (Number.isFinite(parsedTinta) && parsedTinta >= 0))

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={draftNombre}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setProfileEdits((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        nombre: v,
                                        plancha: prev[p.id]?.plancha ?? String(p.costoPlanchaPorColor),
                                        tinta: prev[p.id]?.tinta ?? String(p.costoTintaPorColor),
                                      },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Tinta/Color</Label>
                                <MoneyInput
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={draftTinta}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setProfileEdits((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        nombre: prev[p.id]?.nombre ?? p.nombre,
                                        plancha: prev[p.id]?.plancha ?? String(p.costoPlanchaPorColor),
                                        tinta: v,
                                      },
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setProfileEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[p.id]
                                    return next
                                  })
                                }
                                disabled={!hasDraft}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const nombre = draftNombre.trim()

                                  const nextTinta =
                                    Number.isFinite(parsedTinta) && parsedTinta >= 0 ? parsedTinta : (p.costoTintaPorColor ?? 0)

                                  const isMixed = (p.costoPlanchaPorColor ?? 0) > 0 && (p.costoTintaPorColor ?? 0) > 0
                                  if (isMixed) {
                                    void (async () => {
                                      const created = await createProfileDirect({
                                        nombre: nombre || p.nombre,
                                        costoPlanchaPorColor: 0,
                                        costoTintaPorColor: nextTinta,
                                        anchoUtilCm: p.anchoUtilCm,
                                        altoUtilCm: p.altoUtilCm,
                                        separacionPiezasCm: p.separacionPiezasCm ?? 0,
                                        activo: p.activo,
                                      })

                                      // El original queda como perfil de plancha (solo removemos tinta)
                                      if (selectedTintaProfileId === p.id) {
                                        const nextId = created?.id
                                        setSelectedTintaProfileId(typeof nextId === "string" && nextId ? nextId : "")
                                      }

                                      await patchProfile(p.id, { costoTintaPorColor: 0 })
                                    })()
                                  } else {
                                    const patch: Partial<PrintProfile> = {}
                                    if (nombre && nombre !== p.nombre) patch.nombre = nombre
                                    if (Number.isFinite(parsedTinta) && parsedTinta >= 0 && parsedTinta !== p.costoTintaPorColor) {
                                      patch.costoTintaPorColor = parsedTinta
                                    }
                                    if (Object.keys(patch).length === 0) return
                                    void patchProfile(p.id, patch)
                                  }

                                  setProfileEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[p.id]
                                    return next
                                  })
                                }}
                                disabled={!canSave}
                              >
                                Guardar
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}

                  {tintaProfiles.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {tintaProfilesPage * PAGE_SIZE + 1}-
                        {Math.min(tintaProfiles.length, (tintaProfilesPage + 1) * PAGE_SIZE)} de {tintaProfiles.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTintaProfilesPage((p) => Math.max(0, p - 1))}
                          disabled={tintaProfilesPage <= 0}
                        >
                          Anterior
                        </Button>
                        <p className="text-xs">
                          Página {tintaProfilesPage + 1} / {Math.max(1, Math.ceil(tintaProfiles.length / PAGE_SIZE))}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTintaProfilesPage((p) => Math.min(Math.ceil(tintaProfiles.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={tintaProfilesPage >= Math.ceil(tintaProfiles.length / PAGE_SIZE) - 1}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Papeles</CardTitle>
                  <CardDescription>Tipo, gramaje, pliego base y costo por pliego.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div className="md:col-span-3">
                  <Label>Nombre</Label>
                  <Input className={INPUT_COMPACT} value={newPaperNombre} onChange={(e) => setNewPaperNombre(e.target.value)} placeholder="Ej: Propalcote 150g 70×100" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Input className={INPUT_COMPACT} value={newPaperTipo} onChange={(e) => setNewPaperTipo(e.target.value)} placeholder="propalcote" />
                </div>
                <div>
                  <Label>Gramaje</Label>
                  <Input className={INPUT_COMPACT} type="number" step="1" value={newPaperGramaje} onChange={(e) => setNewPaperGramaje(e.target.value)} placeholder="150" />
                </div>
                <div>
                  <Label>Costo/pliego</Label>
                  <MoneyInput className={INPUT_COMPACT} type="number" step="1" value={newPaperCostoPliego} onChange={(e) => setNewPaperCostoPliego(e.target.value)} />
                </div>
                <div>
                  <Label>Pliego W (cm)</Label>
                  <Input className={INPUT_COMPACT} type="number" step="0.1" value={newPaperPliegoW} onChange={(e) => setNewPaperPliegoW(e.target.value)} />
                </div>
                <div>
                  <Label>Pliego H (cm)</Label>
                  <Input className={INPUT_COMPACT} type="number" step="0.1" value={newPaperPliegoH} onChange={(e) => setNewPaperPliegoH(e.target.value)} />
                </div>
                <div className="md:col-span-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={createPaper} disabled={!meLoaded || !canConfigWrite || !newPaperNombre.trim()}>
                      Agregar papel
                    </Button>
                    {canConfigWrite ? (
                      <Button type="button" variant="outline" onClick={() => setPaperRequestsOpen(true)}>
                        Solicitudes de papeles
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <Label>Buscar</Label>
                <Input
                  className={INPUT_COMPACT}
                  value={papersSearch}
                  onChange={(e) => setPapersSearch(e.target.value)}
                  placeholder="Buscar por nombre, tipo o gramaje…"
                />
              </div>

              <div className="space-y-2">
                {papersLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                {papersList.length === 0 && !papersLoading ? (
                  <p className="text-sm text-muted-foreground">{papers.length > 0 && papersSearch.trim() ? "Sin resultados." : "No hay papeles."}</p>
                ) : null}

                {pagedPapers.map((p) => (
                  <div key={p.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.tipo ? `${p.tipo}` : ""}
                          {p.gramaje ? ` ${p.gramaje}g` : ""} • {p.pliegoWidthCm}×{p.pliegoHeightCm} cm • {formatCurrency(p.costoPliego)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant={p.activo ? "outline" : "default"} onClick={() => patchPaper(p.id, { activo: !p.activo })}>
                          {p.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button type="button" variant="ghost" className="text-red-600" onClick={() => deletePaper(p.id)}>
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    {(() => {
                      const draft = paperEdits[p.id]
                      const draftNombre = draft?.nombre ?? p.nombre
                      const draftTipo = draft?.tipo ?? (p.tipo ?? "")
                      const draftGramaje = draft?.gramaje ?? (p.gramaje != null ? String(p.gramaje) : "")
                      const draftCosto = draft?.costoPliego ?? String(p.costoPliego)
                      const draftW = draft?.pliegoW ?? String(p.pliegoWidthCm)
                      const draftH = draft?.pliegoH ?? String(p.pliegoHeightCm)

                      const parsedGramaje = draftGramaje.trim() ? parseInt(draftGramaje, 10) : NaN
                      const parsedCosto = parseFloat(draftCosto)
                      const parsedW = parseFloat(draftW)
                      const parsedH = parseFloat(draftH)

                      const hasDraft = Boolean(draft)

                      const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== p.nombre
                      const isTipoDirty = draft?.tipo !== undefined && draftTipo.trim() !== (p.tipo ?? "")
                      const isGramajeDirty =
                        draft?.gramaje !== undefined &&
                        ((Number.isFinite(parsedGramaje) ? parsedGramaje : null) !== (p.gramaje ?? null))
                      const isCostoDirty =
                        draft?.costoPliego !== undefined &&
                        Number.isFinite(parsedCosto) &&
                        parsedCosto >= 0 &&
                        parsedCosto !== p.costoPliego
                      const isWDirty =
                        draft?.pliegoW !== undefined &&
                        Number.isFinite(parsedW) &&
                        parsedW > 0 &&
                        parsedW !== p.pliegoWidthCm
                      const isHDirty =
                        draft?.pliegoH !== undefined &&
                        Number.isFinite(parsedH) &&
                        parsedH > 0 &&
                        parsedH !== p.pliegoHeightCm

                      const canSave =
                        (isNombreDirty || isTipoDirty || isGramajeDirty || isCostoDirty || isWDirty || isHDirty) &&
                        (!draftCosto.trim() || (Number.isFinite(parsedCosto) && parsedCosto >= 0)) &&
                        (!draftW.trim() || (Number.isFinite(parsedW) && parsedW > 0)) &&
                        (!draftH.trim() || (Number.isFinite(parsedH) && parsedH > 0)) &&
                        (!draftGramaje.trim() || Number.isFinite(parsedGramaje))

                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                            <div className="md:col-span-3">
                              <Label className="text-xs">Nombre</Label>
                              <Input
                                className={INPUT_COMPACT}
                                value={draftNombre}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPaperEdits((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      nombre: v,
                                      tipo: prev[p.id]?.tipo ?? (p.tipo ?? ""),
                                      gramaje: prev[p.id]?.gramaje ?? (p.gramaje != null ? String(p.gramaje) : ""),
                                      costoPliego: prev[p.id]?.costoPliego ?? String(p.costoPliego),
                                      pliegoW: prev[p.id]?.pliegoW ?? String(p.pliegoWidthCm),
                                      pliegoH: prev[p.id]?.pliegoH ?? String(p.pliegoHeightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Tipo</Label>
                              <Input
                                className={INPUT_COMPACT}
                                value={draftTipo}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPaperEdits((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      nombre: prev[p.id]?.nombre ?? p.nombre,
                                      tipo: v,
                                      gramaje: prev[p.id]?.gramaje ?? (p.gramaje != null ? String(p.gramaje) : ""),
                                      costoPliego: prev[p.id]?.costoPliego ?? String(p.costoPliego),
                                      pliegoW: prev[p.id]?.pliegoW ?? String(p.pliegoWidthCm),
                                      pliegoH: prev[p.id]?.pliegoH ?? String(p.pliegoHeightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Gramaje</Label>
                              <Input
                                className={INPUT_COMPACT}
                                type="number"
                                step="1"
                                min="0"
                                value={draftGramaje}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPaperEdits((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      nombre: prev[p.id]?.nombre ?? p.nombre,
                                      tipo: prev[p.id]?.tipo ?? (p.tipo ?? ""),
                                      gramaje: v,
                                      costoPliego: prev[p.id]?.costoPliego ?? String(p.costoPliego),
                                      pliegoW: prev[p.id]?.pliegoW ?? String(p.pliegoWidthCm),
                                      pliegoH: prev[p.id]?.pliegoH ?? String(p.pliegoHeightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Costo/pliego</Label>
                              <MoneyInput
                                className={INPUT_COMPACT}
                                type="number"
                                step="1"
                                min="0"
                                value={draftCosto}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPaperEdits((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      nombre: prev[p.id]?.nombre ?? p.nombre,
                                      tipo: prev[p.id]?.tipo ?? (p.tipo ?? ""),
                                      gramaje: prev[p.id]?.gramaje ?? (p.gramaje != null ? String(p.gramaje) : ""),
                                      costoPliego: v,
                                      pliegoW: prev[p.id]?.pliegoW ?? String(p.pliegoWidthCm),
                                      pliegoH: prev[p.id]?.pliegoH ?? String(p.pliegoHeightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Pliego W</Label>
                              <Input
                                className={INPUT_COMPACT}
                                type="number"
                                step="0.1"
                                min="0"
                                value={draftW}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPaperEdits((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      nombre: prev[p.id]?.nombre ?? p.nombre,
                                      tipo: prev[p.id]?.tipo ?? (p.tipo ?? ""),
                                      gramaje: prev[p.id]?.gramaje ?? (p.gramaje != null ? String(p.gramaje) : ""),
                                      costoPliego: prev[p.id]?.costoPliego ?? String(p.costoPliego),
                                      pliegoW: v,
                                      pliegoH: prev[p.id]?.pliegoH ?? String(p.pliegoHeightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Pliego H</Label>
                              <Input
                                className={INPUT_COMPACT}
                                type="number"
                                step="0.1"
                                min="0"
                                value={draftH}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPaperEdits((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      nombre: prev[p.id]?.nombre ?? p.nombre,
                                      tipo: prev[p.id]?.tipo ?? (p.tipo ?? ""),
                                      gramaje: prev[p.id]?.gramaje ?? (p.gramaje != null ? String(p.gramaje) : ""),
                                      costoPliego: prev[p.id]?.costoPliego ?? String(p.costoPliego),
                                      pliegoW: prev[p.id]?.pliegoW ?? String(p.pliegoWidthCm),
                                      pliegoH: v,
                                    },
                                  }))
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setPaperEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[p.id]
                                  return next
                                })
                              }
                              disabled={!hasDraft}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const patch: Partial<PaperRate> = {}
                                const nombre = draftNombre.trim()
                                if (nombre && nombre !== p.nombre) patch.nombre = nombre

                                const tipo = draftTipo.trim()
                                if (tipo !== (p.tipo ?? "")) patch.tipo = tipo || null

                                if (draftGramaje.trim()) {
                                  const g = parseInt(draftGramaje, 10)
                                  if (Number.isFinite(g) && (p.gramaje ?? null) !== g) patch.gramaje = g
                                } else {
                                  if ((p.gramaje ?? null) !== null) patch.gramaje = null
                                }

                                if (Number.isFinite(parsedCosto) && parsedCosto >= 0 && parsedCosto !== p.costoPliego) patch.costoPliego = parsedCosto
                                if (Number.isFinite(parsedW) && parsedW > 0 && parsedW !== p.pliegoWidthCm) patch.pliegoWidthCm = parsedW
                                if (Number.isFinite(parsedH) && parsedH > 0 && parsedH !== p.pliegoHeightCm) patch.pliegoHeightCm = parsedH

                                if (Object.keys(patch).length === 0) return
                                void patchPaper(p.id, patch)
                                setPaperEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[p.id]
                                  return next
                                })
                              }}
                              disabled={!canSave}
                            >
                              Guardar
                            </Button>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ))}

                {papersList.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {papersPage * PAGE_SIZE + 1}-{Math.min(papersList.length, (papersPage + 1) * PAGE_SIZE)} de {papersList.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setPapersPage((p) => Math.max(0, p - 1))} disabled={papersPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {papersPage + 1} / {Math.max(1, Math.ceil(papersList.length / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPapersPage((p) => Math.min(Math.ceil(papersList.length / PAGE_SIZE) - 1, p + 1))}
                        disabled={papersPage >= Math.ceil(papersList.length / PAGE_SIZE) - 1}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Tamaños cliente</CardTitle>
                  <CardDescription>Define los tamaños finales que compra o recibe el cliente.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                  <div className="md:col-span-2">
                    <Label>Nombre</Label>
                    <Input className={INPUT_COMPACT} value={newSizeNombre} onChange={(e) => setNewSizeNombre(e.target.value)} placeholder="Ej: Carta" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Código</Label>
                    <Input className={INPUT_COMPACT} value={newSizeKey} onChange={(e) => setNewSizeKey(e.target.value)} placeholder="Ej: MEDIO_OFICIO" />
                  </div>
                  <div>
                    <Label>W (cm)</Label>
                    <Input className={INPUT_COMPACT} type="number" step="0.1" value={newSizeW} onChange={(e) => setNewSizeW(e.target.value)} />
                  </div>
                  <div>
                    <Label>H (cm)</Label>
                    <Input className={INPUT_COMPACT} type="number" step="0.1" value={newSizeH} onChange={(e) => setNewSizeH(e.target.value)} />
                  </div>
                  <div className="md:col-span-4">
                    <Button
                      type="button"
                      onClick={createSize}
                      disabled={!newSizeNombre.trim() || !newSizeKey.trim() || !(parseFloat(newSizeW) > 0) || !(parseFloat(newSizeH) > 0)}
                    >
                      Agregar tamaño
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Buscar</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={sizesSearch}
                    onChange={(e) => setSizesSearch(e.target.value)}
                    placeholder="Buscar por nombre o código…"
                  />
                </div>

                <div className="space-y-2">
                  {sizesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {sizesList.length === 0 && !sizesLoading ? (
                    <p className="text-sm text-muted-foreground">{sizes.length > 0 && sizesSearch.trim() ? "Sin resultados." : "No hay tamaños cliente configurados."}</p>
                  ) : null}

                  {pagedSizes.map((s) => (
                    <div key={s.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            Código: {s.key} • {s.widthCm}×{s.heightCm} cm
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={s.activo ? "outline" : "default"} onClick={() => patchSize(s.id, { activo: !s.activo })}>
                            {s.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteSize(s.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {(() => {
                      const draft = sizeEdits[s.id]
                      const draftNombre = draft?.nombre ?? s.nombre
                      const draftKey = draft?.key ?? s.key
                      const draftW = draft?.w ?? String(s.widthCm)
                      const draftH = draft?.h ?? String(s.heightCm)

                      const parsedW = parseFloat(draftW)
                      const parsedH = parseFloat(draftH)

                      const hasDraft = Boolean(draft)
                      const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== s.nombre
                      const isKeyDirty = draft?.key !== undefined && draftKey.trim() !== s.key
                      const isWDirty = draft?.w !== undefined && Number.isFinite(parsedW) && parsedW > 0 && parsedW !== s.widthCm
                      const isHDirty = draft?.h !== undefined && Number.isFinite(parsedH) && parsedH > 0 && parsedH !== s.heightCm

                      const canSave =
                        (isNombreDirty || isKeyDirty || isWDirty || isHDirty) &&
                        draftNombre.trim().length > 0 &&
                        draftKey.trim().length > 0 &&
                        (!draftW.trim() || (Number.isFinite(parsedW) && parsedW > 0)) &&
                        (!draftH.trim() || (Number.isFinite(parsedH) && parsedH > 0))

                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                            <div className="md:col-span-2">
                              <Label className="text-xs">Nombre</Label>
                              <Input
                                className={INPUT_COMPACT}
                                value={draftNombre}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setSizeEdits((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      nombre: v,
                                      key: prev[s.id]?.key ?? s.key,
                                      w: prev[s.id]?.w ?? String(s.widthCm),
                                      h: prev[s.id]?.h ?? String(s.heightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-xs">Código</Label>
                              <Input
                                className={INPUT_COMPACT}
                                value={draftKey}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setSizeEdits((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      nombre: prev[s.id]?.nombre ?? s.nombre,
                                      key: v,
                                      w: prev[s.id]?.w ?? String(s.widthCm),
                                      h: prev[s.id]?.h ?? String(s.heightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">W (cm)</Label>
                              <Input
                                className={INPUT_COMPACT}
                                type="number"
                                step="0.1"
                                min="0"
                                value={draftW}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setSizeEdits((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      nombre: prev[s.id]?.nombre ?? s.nombre,
                                      key: prev[s.id]?.key ?? s.key,
                                      w: v,
                                      h: prev[s.id]?.h ?? String(s.heightCm),
                                    },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">H (cm)</Label>
                              <Input
                                className={INPUT_COMPACT}
                                type="number"
                                step="0.1"
                                min="0"
                                value={draftH}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setSizeEdits((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      nombre: prev[s.id]?.nombre ?? s.nombre,
                                      key: prev[s.id]?.key ?? s.key,
                                      w: prev[s.id]?.w ?? String(s.widthCm),
                                      h: v,
                                    },
                                  }))
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSizeEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[s.id]
                                  return next
                                })
                              }
                              disabled={!hasDraft}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const patch: Partial<PrintSize> = {}
                                const nombre = draftNombre.trim()
                                const key = draftKey.trim()
                                if (nombre && nombre !== s.nombre) patch.nombre = nombre
                                if (key && key !== s.key) patch.key = key
                                if (Number.isFinite(parsedW) && parsedW > 0 && parsedW !== s.widthCm) patch.widthCm = parsedW
                                if (Number.isFinite(parsedH) && parsedH > 0 && parsedH !== s.heightCm) patch.heightCm = parsedH
                                if (Object.keys(patch).length === 0) return
                                void patchSize(s.id, patch)
                                setSizeEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[s.id]
                                  return next
                                })
                              }}
                              disabled={!canSave}
                            >
                              Guardar
                            </Button>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ))}

                {sizesList.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {sizesPage * PAGE_SIZE + 1}-{Math.min(sizesList.length, (sizesPage + 1) * PAGE_SIZE)} de {sizesList.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSizesPage((p) => Math.max(0, p - 1))} disabled={sizesPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {sizesPage + 1} / {Math.max(1, Math.ceil(sizesList.length / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSizesPage((p) => Math.min(Math.ceil(sizesList.length / PAGE_SIZE) - 1, p + 1))}
                        disabled={sizesPage >= Math.ceil(sizesList.length / PAGE_SIZE) - 1}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Acabados</CardTitle>
                  <CardDescription>Lista de acabados disponibles para el tarifario y la cotización.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div className="md:col-span-1">
                  <Label>Nombre</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={newFinishNombre}
                    onChange={(e) => {
                      const v = e.target.value
                      setNewFinishNombre(v)
                    }}
                    placeholder="Ej: Brillo, Mate, UV"
                  />
                </div>
                <div className="md:col-span-1">
                  <Label>Valor</Label>
                  <MoneyInput
                    className={INPUT_COMPACT}
                    type="number"
                    step="1"
                    min="0"
                    value={newFinishValor}
                    onChange={(e) => setNewFinishValor(e.target.value)}
                    placeholder="Ej: 15000"
                  />
                </div>
                <div className="md:col-span-1">
                  <Button type="button" onClick={createFinish} disabled={!newFinishNombre.trim()}>
                    Agregar acabado
                  </Button>
                </div>
              </div>

              <div>
                <Label>Buscar</Label>
                <Input
                  className={INPUT_COMPACT}
                  value={acabadosSearch}
                  onChange={(e) => setAcabadosSearch(e.target.value)}
                  placeholder="Buscar por nombre…"
                />
              </div>

              <div className="space-y-2">
                {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                {acabadosList.length === 0 && !finishesLoading ? (
                  <p className="text-sm text-muted-foreground">{acabadosFinishes.length > 0 && acabadosSearch.trim() ? "Sin resultados." : "No hay acabados."}</p>
                ) : null}

                {pagedFinishes.map((f) => (
                  <div key={f.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{f.nombre}</p>
                        <p className="text-xs text-muted-foreground">Valor: {formatCurrency(f.valor || 0)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant={f.activo ? "outline" : "default"} onClick={() => patchFinish(f.id, { activo: !f.activo })}>
                          {f.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteFinish(f.id)}>
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    {(() => {
                      const draft = finishEdits[f.id]
                      const draftNombre = draft?.nombre ?? f.nombre
                      const draftValor = draft?.valor ?? String(f.valor ?? 0)
                      const parsedDraftValor = parseFloat(draftValor)

                      const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== f.nombre
                      const isValorDirty =
                        draft?.valor !== undefined &&
                        Number.isFinite(parsedDraftValor) &&
                        parsedDraftValor >= 0 &&
                        parsedDraftValor !== (f.valor ?? 0)

                      const hasDraft = Boolean(draft)
                      const canSave = (isNombreDirty || isValorDirty) && (!draftValor.trim() || (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0))

                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                            <div className="md:col-span-2">
                              <Label className="text-xs">Nombre</Label>
                              <Input
                                className={INPUT_COMPACT}
                                value={draftNombre}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFinishEdits((prev) => ({
                                    ...prev,
                                    [f.id]: { nombre: v, valor: prev[f.id]?.valor ?? String(f.valor ?? 0) },
                                  }))
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Valor</Label>
                              <MoneyInput
                                className={INPUT_COMPACT}
                                type="number"
                                step="1"
                                min="0"
                                value={draftValor}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFinishEdits((prev) => ({
                                    ...prev,
                                    [f.id]: { nombre: prev[f.id]?.nombre ?? f.nombre, valor: v },
                                  }))
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFinishEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[f.id]
                                  return next
                                })
                              }
                              disabled={!hasDraft}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const patch: Partial<FinishOption> = {}
                                const nombre = draftNombre.trim()
                                if (nombre && nombre !== f.nombre) patch.nombre = nombre
                                if (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0 && parsedDraftValor !== (f.valor ?? 0)) patch.valor = parsedDraftValor
                                if (Object.keys(patch).length === 0) return
                                void patchFinish(f.id, patch)
                                setFinishEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[f.id]
                                  return next
                                })
                              }}
                              disabled={!canSave}
                            >
                              Guardar
                            </Button>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ))}

                {acabadosList.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {finishesPage * PAGE_SIZE + 1}-{Math.min(acabadosList.length, (finishesPage + 1) * PAGE_SIZE)} de {acabadosList.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setFinishesPage((p) => Math.max(0, p - 1))} disabled={finishesPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {finishesPage + 1} / {Math.max(1, Math.ceil(acabadosList.length / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFinishesPage((p) => Math.min(Math.ceil(acabadosList.length / PAGE_SIZE) - 1, p + 1))}
                        disabled={finishesPage >= Math.ceil(acabadosList.length / PAGE_SIZE) - 1}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pt-6 border-t space-y-4">
                <div>
                  <p className="text-sm font-semibold">Acabados especiales</p>
                  <p className="text-xs text-muted-foreground">Se seleccionan con checks en el cotizador y permiten cantidad por acabado.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div className="md:col-span-1">
                    <Label>Nombre</Label>
                    <Input
                      className={INPUT_COMPACT}
                      value={newSpecialFinishNombre}
                      onChange={(e) => setNewSpecialFinishNombre(e.target.value)}
                      placeholder="Ej: Troquel, Hot stamping"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Valor</Label>
                    <MoneyInput
                      className={INPUT_COMPACT}
                      type="number"
                      step="1"
                      min="0"
                      value={newSpecialFinishValor}
                      onChange={(e) => setNewSpecialFinishValor(e.target.value)}
                      placeholder="Ej: 25000"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Button type="button" onClick={createSpecialFinish} disabled={!newSpecialFinishNombre.trim()}>
                      Agregar acabado especial
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Buscar</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={specialAcabadosSearch}
                    onChange={(e) => setSpecialAcabadosSearch(e.target.value)}
                    placeholder="Buscar por nombre…"
                  />
                </div>

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {specialFinishesList.length === 0 && !finishesLoading ? (
                    <p className="text-sm text-muted-foreground">{specialFinishes.length > 0 && specialAcabadosSearch.trim() ? "Sin resultados." : "No hay acabados especiales."}</p>
                  ) : null}

                  {pagedSpecialFinishes.map((f) => (
                    <div key={f.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{f.nombre}</p>
                          <p className="text-xs text-muted-foreground">Valor: {formatCurrency(f.valor || 0)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={f.activo ? "outline" : "default"} onClick={() => patchFinish(f.id, { activo: !f.activo })}>
                            {f.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteFinish(f.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const draft = finishEdits[f.id]
                        const draftNombre = draft?.nombre ?? f.nombre
                        const draftValor = draft?.valor ?? String(f.valor ?? 0)
                        const parsedDraftValor = parseFloat(draftValor)

                        const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== f.nombre
                        const isValorDirty =
                          draft?.valor !== undefined &&
                          Number.isFinite(parsedDraftValor) &&
                          parsedDraftValor >= 0 &&
                          parsedDraftValor !== (f.valor ?? 0)

                        const hasDraft = Boolean(draft)
                        const canSave = (isNombreDirty || isValorDirty) && (!draftValor.trim() || (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0))

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={draftNombre}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: v, valor: prev[f.id]?.valor ?? String(f.valor ?? 0) },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Valor</Label>
                                <MoneyInput
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={draftValor}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: prev[f.id]?.nombre ?? f.nombre, valor: v },
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setFinishEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[f.id]
                                  return next
                                })}
                                disabled={!hasDraft}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const patch: Partial<FinishOption> = {}
                                  const nombre = draftNombre.trim()
                                  if (nombre && nombre !== f.nombre) patch.nombre = nombre
                                  if (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0 && parsedDraftValor !== (f.valor ?? 0)) patch.valor = parsedDraftValor
                                  if (Object.keys(patch).length === 0) return
                                  void patchFinish(f.id, patch)
                                  setFinishEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[f.id]
                                    return next
                                  })
                                }}
                                disabled={!canSave}
                              >
                                Guardar
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}

                  {specialFinishesList.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {specialFinishesPage * PAGE_SIZE + 1}-{Math.min(specialFinishesList.length, (specialFinishesPage + 1) * PAGE_SIZE)} de {specialFinishesList.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSpecialFinishesPage((p) => Math.max(0, p - 1))} disabled={specialFinishesPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {specialFinishesPage + 1} / {Math.max(1, Math.ceil(specialFinishesList.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSpecialFinishesPage((p) => Math.min(Math.ceil(specialFinishesList.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={specialFinishesPage >= Math.ceil(specialFinishesList.length / PAGE_SIZE) - 1}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Plastificado</CardTitle>
                  <CardDescription>Opciones para el módulo Plastificado del cotizador.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <Label>Nombre</Label>
                    <Input className={INPUT_COMPACT} value={newPlastificadoNombre} onChange={(e) => setNewPlastificadoNombre(e.target.value)} placeholder="Ej: Mate, Brillo" />
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <MoneyInput className={INPUT_COMPACT} type="number" step="1" min="0" value={newPlastificadoValor} onChange={(e) => setNewPlastificadoValor(e.target.value)} placeholder="Ej: 15000" />
                  </div>
                  <div>
                    <Button type="button" onClick={createPlastificado} disabled={!newPlastificadoNombre.trim()}>
                      Agregar plastificado
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Buscar</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={plastificadosSearch}
                    onChange={(e) => setPlastificadosSearch(e.target.value)}
                    placeholder="Buscar por nombre…"
                  />
                </div>

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {plastificadosList.length === 0 && !finishesLoading ? (
                    <p className="text-sm text-muted-foreground">{plastificadosFinishes.length > 0 && plastificadosSearch.trim() ? "Sin resultados." : "No hay plastificados."}</p>
                  ) : null}

                  {pagedPlastificados.map((f) => (
                    <div key={f.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{f.nombre}</p>
                          <p className="text-xs text-muted-foreground">Valor: {formatCurrency(f.valor || 0)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={f.activo ? "outline" : "default"} onClick={() => patchFinish(f.id, { activo: !f.activo })}>
                            {f.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteFinish(f.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const draft = finishEdits[f.id]
                        const draftNombre = draft?.nombre ?? f.nombre
                        const draftValor = draft?.valor ?? String(f.valor ?? 0)
                        const parsedDraftValor = parseFloat(draftValor)

                        const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== f.nombre
                        const isValorDirty =
                          draft?.valor !== undefined &&
                          Number.isFinite(parsedDraftValor) &&
                          parsedDraftValor >= 0 &&
                          parsedDraftValor !== (f.valor ?? 0)

                        const hasDraft = Boolean(draft)
                        const canSave = (isNombreDirty || isValorDirty) && (!draftValor.trim() || (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0))

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={draftNombre}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: v, valor: prev[f.id]?.valor ?? String(f.valor ?? 0) },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Valor</Label>
                                <MoneyInput
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={draftValor}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: prev[f.id]?.nombre ?? f.nombre, valor: v },
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setFinishEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[f.id]
                                    return next
                                  })
                                }
                                disabled={!hasDraft}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const patch: Partial<FinishOption> = {}
                                  const nombre = draftNombre.trim()
                                  if (nombre && nombre !== f.nombre) patch.nombre = nombre
                                  if (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0 && parsedDraftValor !== (f.valor ?? 0)) patch.valor = parsedDraftValor
                                  if (Object.keys(patch).length === 0) return
                                  void patchFinish(f.id, patch)
                                  setFinishEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[f.id]
                                    return next
                                  })
                                }}
                                disabled={!canSave}
                              >
                                Guardar
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}

                  {plastificadosList.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {plastificadosPage * PAGE_SIZE + 1}-{Math.min(plastificadosList.length, (plastificadosPage + 1) * PAGE_SIZE)} de {plastificadosList.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setPlastificadosPage((p) => Math.max(0, p - 1))} disabled={plastificadosPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {plastificadosPage + 1} / {Math.max(1, Math.ceil(plastificadosList.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPlastificadosPage((p) => Math.min(Math.ceil(plastificadosList.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={plastificadosPage >= Math.ceil(plastificadosList.length / PAGE_SIZE) - 1}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Troquel y Troquelada</CardTitle>
                  <CardDescription>Configura por separado el costo del troquel y el valor de troquelar el producto.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="space-y-4 rounded-md border p-4">
                  <div>
                    <h4 className="font-medium">Troquel</h4>
                    <p className="text-xs text-muted-foreground">Valor de fabricar el troquel.</p>
                  </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <Label>Nombre</Label>
                    <Input className={INPUT_COMPACT} value={newTroqueladoNombre} onChange={(e) => setNewTroqueladoNombre(e.target.value)} placeholder="Ej: Troquel carpeta" />
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <MoneyInput className={INPUT_COMPACT} type="number" step="1" min="0" value={newTroqueladoValor} onChange={(e) => setNewTroqueladoValor(e.target.value)} placeholder="Ej: 90000" />
                  </div>
                  <div>
                    <Button type="button" onClick={createTroquelado} disabled={!newTroqueladoNombre.trim()}>
                      Agregar troquel
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Buscar</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={troqueladosSearch}
                    onChange={(e) => setTroqueladosSearch(e.target.value)}
                    placeholder="Buscar por nombre…"
                  />
                </div>

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {troqueladosList.length === 0 && !finishesLoading ? (
                    <p className="text-sm text-muted-foreground">{troqueladosFinishes.length > 0 && troqueladosSearch.trim() ? "Sin resultados." : "No hay troqueles."}</p>
                  ) : null}

                  {pagedTroquelados.map((f) => (
                    <div key={f.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{f.nombre}</p>
                          <p className="text-xs text-muted-foreground">Valor: {formatCurrency(f.valor || 0)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={f.activo ? "outline" : "default"} onClick={() => patchFinish(f.id, { activo: !f.activo })}>
                            {f.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteFinish(f.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const draft = finishEdits[f.id]
                        const draftNombre = draft?.nombre ?? f.nombre
                        const draftValor = draft?.valor ?? String(f.valor ?? 0)
                        const parsedDraftValor = parseFloat(draftValor)

                        const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== f.nombre
                        const isValorDirty =
                          draft?.valor !== undefined &&
                          Number.isFinite(parsedDraftValor) &&
                          parsedDraftValor >= 0 &&
                          parsedDraftValor !== (f.valor ?? 0)

                        const hasDraft = Boolean(draft)
                        const canSave = (isNombreDirty || isValorDirty) && (!draftValor.trim() || (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0))

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={draftNombre}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: v, valor: prev[f.id]?.valor ?? String(f.valor ?? 0) },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Valor</Label>
                                <MoneyInput
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={draftValor}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: prev[f.id]?.nombre ?? f.nombre, valor: v },
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setFinishEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[f.id]
                                    return next
                                  })
                                }
                                disabled={!hasDraft}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const patch: Partial<FinishOption> = {}
                                  const nombre = draftNombre.trim()
                                  if (nombre && nombre !== f.nombre) patch.nombre = nombre
                                  if (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0 && parsedDraftValor !== (f.valor ?? 0)) patch.valor = parsedDraftValor
                                  if (Object.keys(patch).length === 0) return
                                  void patchFinish(f.id, patch)
                                  setFinishEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[f.id]
                                    return next
                                  })
                                }}
                                disabled={!canSave}
                              >
                                Guardar
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}

                  {troqueladosList.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {troqueladosPage * PAGE_SIZE + 1}-{Math.min(troqueladosList.length, (troqueladosPage + 1) * PAGE_SIZE)} de {troqueladosList.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setTroqueladosPage((p) => Math.max(0, p - 1))} disabled={troqueladosPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {troqueladosPage + 1} / {Math.max(1, Math.ceil(troqueladosList.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTroqueladosPage((p) => Math.min(Math.ceil(troqueladosList.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={troqueladosPage >= Math.ceil(troqueladosList.length / PAGE_SIZE) - 1}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                </div>

                <div className="space-y-4 rounded-md border p-4">
                  <div>
                    <h4 className="font-medium">Troquelada</h4>
                    <p className="text-xs text-muted-foreground">Valor de pasar el producto por el troquel ya fabricado.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                    <div>
                      <Label>Nombre</Label>
                      <Input className={INPUT_COMPACT} value={newTroqueladaNombre} onChange={(e) => setNewTroqueladaNombre(e.target.value)} placeholder="Ej: Troquelada carpeta" />
                    </div>
                    <div>
                      <Label>Valor</Label>
                      <MoneyInput className={INPUT_COMPACT} type="number" step="1" min="0" value={newTroqueladaValor} onChange={(e) => setNewTroqueladaValor(e.target.value)} placeholder="Ej: 25000" />
                    </div>
                    <div>
                      <Button type="button" onClick={createTroquelada} disabled={!newTroqueladaNombre.trim()}>
                        Agregar troquelada
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Buscar</Label>
                    <Input
                      className={INPUT_COMPACT}
                      value={troqueladasSearch}
                      onChange={(e) => setTroqueladasSearch(e.target.value)}
                      placeholder="Buscar por nombre…"
                    />
                  </div>

                  <div className="space-y-2">
                    {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                    {troqueladasList.length === 0 && !finishesLoading ? (
                      <p className="text-sm text-muted-foreground">{troqueladasFinishes.length > 0 && troqueladasSearch.trim() ? "Sin resultados." : "No hay troqueladas."}</p>
                    ) : null}

                    {pagedTroqueladas.map((f) => (
                      <div key={f.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{f.nombre}</p>
                            <p className="text-xs text-muted-foreground">Valor: {formatCurrency(f.valor || 0)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant={f.activo ? "outline" : "default"} onClick={() => patchFinish(f.id, { activo: !f.activo })}>
                              {f.activo ? "Desactivar" : "Activar"}
                            </Button>
                            <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteFinish(f.id)}>
                              Eliminar
                            </Button>
                          </div>
                        </div>

                        {(() => {
                          const draft = finishEdits[f.id]
                          const draftNombre = draft?.nombre ?? f.nombre
                          const draftValor = draft?.valor ?? String(f.valor ?? 0)
                          const parsedDraftValor = parseFloat(draftValor)

                          const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== f.nombre
                          const isValorDirty =
                            draft?.valor !== undefined &&
                            Number.isFinite(parsedDraftValor) &&
                            parsedDraftValor >= 0 &&
                            parsedDraftValor !== (f.valor ?? 0)

                          const hasDraft = Boolean(draft)
                          const canSave = (isNombreDirty || isValorDirty) && (!draftValor.trim() || (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0))

                          return (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                <div className="md:col-span-2">
                                  <Label className="text-xs">Nombre</Label>
                                  <Input
                                    className={INPUT_COMPACT}
                                    value={draftNombre}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setFinishEdits((prev) => ({
                                        ...prev,
                                        [f.id]: { nombre: v, valor: prev[f.id]?.valor ?? String(f.valor ?? 0) },
                                      }))
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Valor</Label>
                                  <MoneyInput
                                    className={INPUT_COMPACT}
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={draftValor}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setFinishEdits((prev) => ({
                                        ...prev,
                                        [f.id]: { nombre: prev[f.id]?.nombre ?? f.nombre, valor: v },
                                      }))
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setFinishEdits((prev) => {
                                      const next = { ...prev }
                                      delete next[f.id]
                                      return next
                                    })
                                  }
                                  disabled={!hasDraft}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    const patch: Partial<FinishOption> = {}
                                    const nombre = draftNombre.trim()
                                    if (nombre && nombre !== f.nombre) patch.nombre = nombre
                                    if (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0 && parsedDraftValor !== (f.valor ?? 0)) patch.valor = parsedDraftValor
                                    if (Object.keys(patch).length === 0) return
                                    void patchFinish(f.id, patch)
                                    setFinishEdits((prev) => {
                                      const next = { ...prev }
                                      delete next[f.id]
                                      return next
                                    })
                                  }}
                                  disabled={!canSave}
                                >
                                  Guardar
                                </Button>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    ))}

                    {troqueladasList.length > 0 ? (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <p className="text-xs text-muted-foreground">
                          Mostrando {troqueladasPage * PAGE_SIZE + 1}-{Math.min(troqueladasList.length, (troqueladasPage + 1) * PAGE_SIZE)} de {troqueladasList.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setTroqueladasPage((p) => Math.max(0, p - 1))} disabled={troqueladasPage <= 0}>
                            Anterior
                          </Button>
                          <p className="text-xs">Página {troqueladasPage + 1} / {Math.max(1, Math.ceil(troqueladasList.length / PAGE_SIZE))}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setTroqueladasPage((p) => Math.min(Math.ceil(troqueladasList.length / PAGE_SIZE) - 1, p + 1))}
                            disabled={troqueladasPage >= Math.ceil(troqueladasList.length / PAGE_SIZE) - 1}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Corte</CardTitle>
                  <CardDescription>Opciones para el módulo Corte del cotizador.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <Label>Nombre</Label>
                    <Input className={INPUT_COMPACT} value={newCorteNombre} onChange={(e) => setNewCorteNombre(e.target.value)} placeholder="Ej: Corte guillotina" />
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <MoneyInput className={INPUT_COMPACT} type="number" step="1" min="0" value={newCorteValor} onChange={(e) => setNewCorteValor(e.target.value)} placeholder="Ej: 8000" />
                  </div>
                  <div>
                    <Button type="button" onClick={createCorte} disabled={!newCorteNombre.trim()}>
                      Agregar corte
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Buscar</Label>
                  <Input
                    className={INPUT_COMPACT}
                    value={cortesSearch}
                    onChange={(e) => setCortesSearch(e.target.value)}
                    placeholder="Buscar por nombre…"
                  />
                </div>

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {cortesList.length === 0 && !finishesLoading ? (
                    <p className="text-sm text-muted-foreground">{cortesFinishes.length > 0 && cortesSearch.trim() ? "Sin resultados." : "No hay cortes."}</p>
                  ) : null}

                  {pagedCortes.map((f) => (
                    <div key={f.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{f.nombre}</p>
                          <p className="text-xs text-muted-foreground">Valor: {formatCurrency(f.valor || 0)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={f.activo ? "outline" : "default"} onClick={() => patchFinish(f.id, { activo: !f.activo })}>
                            {f.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteFinish(f.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const draft = finishEdits[f.id]
                        const draftNombre = draft?.nombre ?? f.nombre
                        const draftValor = draft?.valor ?? String(f.valor ?? 0)
                        const parsedDraftValor = parseFloat(draftValor)

                        const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== f.nombre
                        const isValorDirty =
                          draft?.valor !== undefined &&
                          Number.isFinite(parsedDraftValor) &&
                          parsedDraftValor >= 0 &&
                          parsedDraftValor !== (f.valor ?? 0)

                        const hasDraft = Boolean(draft)
                        const canSave = (isNombreDirty || isValorDirty) && (!draftValor.trim() || (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0))

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Nombre</Label>
                                <Input
                                  className={INPUT_COMPACT}
                                  value={draftNombre}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: v, valor: prev[f.id]?.valor ?? String(f.valor ?? 0) },
                                    }))
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Valor</Label>
                                <MoneyInput
                                  className={INPUT_COMPACT}
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={draftValor}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setFinishEdits((prev) => ({
                                      ...prev,
                                      [f.id]: { nombre: prev[f.id]?.nombre ?? f.nombre, valor: v },
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setFinishEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[f.id]
                                    return next
                                  })
                                }
                                disabled={!hasDraft}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const patch: Partial<FinishOption> = {}
                                  const nombre = draftNombre.trim()
                                  if (nombre && nombre !== f.nombre) patch.nombre = nombre
                                  if (Number.isFinite(parsedDraftValor) && parsedDraftValor >= 0 && parsedDraftValor !== (f.valor ?? 0)) patch.valor = parsedDraftValor
                                  if (Object.keys(patch).length === 0) return
                                  void patchFinish(f.id, patch)
                                  setFinishEdits((prev) => {
                                    const next = { ...prev }
                                    delete next[f.id]
                                    return next
                                  })
                                }}
                                disabled={!canSave}
                              >
                                Guardar
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}

                  {cortesList.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {cortesPage * PAGE_SIZE + 1}-{Math.min(cortesList.length, (cortesPage + 1) * PAGE_SIZE)} de {cortesList.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setCortesPage((p) => Math.max(0, p - 1))} disabled={cortesPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {cortesPage + 1} / {Math.max(1, Math.ceil(cortesList.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCortesPage((p) => Math.min(Math.ceil(cortesList.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={cortesPage >= Math.ceil(cortesList.length / PAGE_SIZE) - 1}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </details>
          </Card>

          <Card>
            <details className="group">
              <summary className="relative cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                <ChevronRight className="absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <CardHeader className="pl-8">
                  <CardTitle>Rangos (Flyers)</CardTitle>
                  <CardDescription>
                    Un mismo ítem agrupa varios rangos de cantidad (ej: 1–500, 501–1000) para el mismo Papel + Tamaño + Tintas + Acabado.
                  </CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-8 gap-2 items-end">
                <div className="md:col-span-2">
                  <Label>Filtro Tamaño</Label>
                  <SearchableNativeSelect
                    value={ratesFilterFormatoKey}
                    onChange={(v) => setRatesFilterFormatoKey(v)}
                    disabled={!sizeOptions.length}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    includeAllOption={{ value: "", label: "Todos" }}
                    options={sizeOptions.map((p) => ({ value: p.key, label: p.nombre }))}
                    searchPlaceholder="Buscar tamaño…"
                  />
                </div>
                <div className="md:col-span-1">
                  <Label>Filtro Tintas</Label>
                  <SearchableNativeSelect
                    value={ratesFilterTintas === "" ? "" : String(ratesFilterTintas)}
                    onChange={(raw) => {
                      const v = raw === "" ? "" : (Number(raw) as 1 | 2 | 4)
                      setRatesFilterTintas(v)
                    }}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    includeAllOption={{ value: "", label: "Todas" }}
                    options={[
                      { value: "4", label: "4" },
                      { value: "2", label: "2" },
                      { value: "1", label: "1" },
                    ]}
                    searchPlaceholder="Buscar…"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Filtro Papel</Label>
                  <SearchableNativeSelect
                    value={ratesFilterPaperId}
                    onChange={(v) => setRatesFilterPaperId(v)}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    includeAllOption={{ value: "", label: "Todos" }}
                    options={activePapers.map((p) => ({ value: p.id, label: p.nombre }))}
                    searchPlaceholder="Buscar papel…"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Filtro Acabado</Label>
                  <SearchableNativeSelect
                    value={ratesFilterFinishId}
                    onChange={(v) => setRatesFilterFinishId(v)}
                    disabled={finishesLoading}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    includeAllOption={{ value: "", label: "Todos" }}
                    options={[
                      { value: "__generic__", label: "Solo SIN acabado" },
                      ...activeFinishes.map((f) => ({ value: f.id, label: f.nombre })),
                    ]}
                    searchPlaceholder="Buscar acabado…"
                  />
                </div>
                <div className="md:col-span-1">
                  <Button type="button" variant="outline" onClick={() => {
                    setRatesFilterFormatoKey("")
                    setRatesFilterTintas("")
                    setRatesFilterPaperId("")
                    setRatesFilterFinishId("")
                  }}>
                    Limpiar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                <div className="md:col-span-2">
                  <Label>Papel (obligatorio)</Label>
                  <SearchableNativeSelect
                    value={newFlyerPaperId}
                    onChange={(v) => setNewFlyerPaperId(v)}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    searchPlaceholder="Buscar papel…"
                    options={[
                      { value: "", label: "Selecciona un papel", disabled: true },
                      ...activePapers.map((p) => ({ value: p.id, label: p.nombre })),
                    ]}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Acabado</Label>
                  <SearchableNativeSelect
                    value={newFlyerFinishId}
                    onChange={(v) => setNewFlyerFinishId(v)}
                    disabled={finishesLoading}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    includeAllOption={{ value: "", label: "Sin acabado" }}
                    options={activeFinishes.map((f) => ({ value: f.id, label: f.nombre }))}
                    searchPlaceholder="Buscar acabado…"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Formato</Label>
                  <SearchableNativeSelect
                    value={newFlyerFormatoKey}
                    onChange={(v) => setNewFlyerFormatoKey(v)}
                    disabled={!sizeOptions.length}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    searchPlaceholder="Buscar tamaño…"
                    options={[
                      {
                        value: "",
                        label: sizeOptions.length ? "Selecciona un tamaño" : "Sin tamaños configurados",
                        disabled: true,
                      },
                      ...sizeOptions.map((p) => ({
                        value: p.key,
                        label: `${p.nombre} (${p.widthCm}×${p.heightCm} cm)`,
                      })),
                    ]}
                  />
                  {!sizeOptions.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">Crea tamaños en Configuración &gt; Tamaños cliente.</p>
                  ) : null}
                </div>
                <div>
                  <Label>Tintas</Label>
                  <SearchableNativeSelect
                    value={String(newFlyerTintas)}
                    onChange={(v) => setNewFlyerTintas(Number(v) as 1 | 2 | 4)}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    searchPlaceholder="Buscar tintas…"
                    options={[
                      { value: "4", label: "4" },
                      { value: "2", label: "2" },
                      { value: "1", label: "1" },
                    ]}
                  />
                </div>
                <div>
                  <Label>Rango sugerido</Label>
                  <SearchableNativeSelect
                    value={newFlyerTierKey}
                    onChange={(v) => setNewFlyerTierKey(v)}
                    searchClassName={INPUT_COMPACT}
                    selectClassName={SELECT_COMPACT}
                    includeAllOption={{ value: "", label: "Personalizado" }}
                    options={tirajeTierOptions.map((t) => ({ value: t.value, label: t.label }))}
                    searchPlaceholder="Buscar rango…"
                    emptyText={tirajeTierOptions.length ? 'Sin resultados' : 'Sin rangos configurados'}
                  />
                </div>
                <div>
                  <Label>Min</Label>
                  <Input className={INPUT_COMPACT} type="number" step="1" value={newFlyerMin} onChange={(e) => setNewFlyerMin(e.target.value)} />
                </div>
                <div>
                  <Label>Max</Label>
                  <Input className={INPUT_COMPACT} type="number" step="1" value={newFlyerMax} onChange={(e) => setNewFlyerMax(e.target.value)} />
                </div>
                <div>
                  <Label>Precio total</Label>
                  <MoneyInput className={INPUT_COMPACT} type="number" step="1" value={newFlyerPrecioTotal} onChange={(e) => setNewFlyerPrecioTotal(e.target.value)} />
                </div>
                <div className="md:col-span-6">
                  <Button
                    type="button"
                    onClick={createFlyerRate}
                    disabled={
                      !(parseInt(newFlyerMin, 10) > 0) ||
                      !(parseInt(newFlyerMax, 10) > 0) ||
                      !newFlyerFormatoKey ||
                      !newFlyerPaperId
                    }
                  >
                    Guardar tarifa
                  </Button>
                </div>
              </div>

              <div>
                <Label>Buscar</Label>
                <Input
                  className={INPUT_COMPACT}
                  value={flyerRatesSearch}
                  onChange={(e) => setFlyerRatesSearch(e.target.value)}
                  placeholder="Buscar por tamaño, papel, acabado o producto…"
                />
              </div>

              <div className="space-y-2">
                {flyerRatesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                {flyerRateGroupsCount === 0 && !flyerRatesLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {groupedFlyerRates.length > 0 && flyerRatesSearch.trim() ? "Sin resultados." : "No hay rangos (con estos filtros)."}
                  </p>
                ) : null}

                {pagedFlyerRateGroups.map((g) => (
                  <div key={g.key} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {getSizeDisplayName(sizeOptions, g.formatoKey)} • {g.tintas} tintas • {g.rates.length} rangos
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Producto: {g.productoNombre || "(sin asignar)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Papel: {g.paperRateId ? (papers.find((p) => p.id === g.paperRateId)?.nombre || g.paperRateId) : "Sin papel (legacy)"} • Acabado: {g.finishOptionId ? (finishes.find((f) => f.id === g.finishOptionId)?.nombre || g.finishOptionId) : "Sin acabado"}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 md:items-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <SearchableNativeSelect
                            value={groupProductoSelection[g.key] ?? (g.productoId ?? "")}
                            onChange={(v) => setGroupProductoSelection((prev) => ({ ...prev, [g.key]: v }))}
                            disabled={productosLoading || groupAssignLoadingKey === g.key}
                            searchClassName={INPUT_COMPACT}
                            selectClassName={SELECT_INLINE}
                            searchPlaceholder="Buscar producto…"
                            includeAllOption={{ value: "", label: "Sin producto" }}
                            options={productos.map((p) => ({ value: p.id, label: p.nombre }))}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const selected = (groupProductoSelection[g.key] ?? g.productoId ?? "").trim()
                              void assignProductoToGroup(g.key, g.rates.map((r) => r.id), selected ? selected : null)
                            }}
                            disabled={groupAssignLoadingKey === g.key}
                          >
                            Asignar
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            className={INPUT_COMPACT}
                            placeholder="Nuevo producto (ej: Volantes)"
                            value={groupNewProductoNombre[g.key] ?? ""}
                            onChange={(e) => setGroupNewProductoNombre((prev) => ({ ...prev, [g.key]: e.target.value }))}
                            disabled={groupAssignLoadingKey === g.key}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={async () => {
                              const nombre = (groupNewProductoNombre[g.key] ?? "").trim()
                              if (!nombre) return
                              const createdId = await createProductoFromGroup(g.key, {
                                nombre,
                                formatoKey: g.formatoKey,
                                tintas: g.tintas,
                                paperRateId: g.paperRateId,
                                finishOptionId: g.finishOptionId,
                              })
                              if (!createdId) return
                              await assignProductoToGroup(g.key, g.rates.map((r) => r.id), createdId)
                              setGroupNewProductoNombre((prev) => ({ ...prev, [g.key]: "" }))
                            }}
                            disabled={
                              groupAssignLoadingKey === g.key ||
                              !(groupNewProductoNombre[g.key] ?? "").trim() ||
                              !g.paperRateId
                            }
                          >
                            Crear y asignar
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {g.rates.map((r) => (
                        <div key={r.id} className="rounded-md border bg-muted/10 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {r.tirajeMin}-{r.tirajeMax} • {formatCurrency(r.precioTotal)}
                              </p>
                              <p className="text-xs text-muted-foreground">{r.activo ? "Activo" : "Inactivo"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant={r.activo ? "outline" : "default"} onClick={() => patchFlyerRate(r.id, { activo: !r.activo })}>
                                {r.activo ? "Desactivar" : "Activar"}
                              </Button>
                              <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteFlyerRate(r.id)}>
                                Eliminar
                              </Button>
                            </div>
                          </div>

                          {(() => {
                            const draft = flyerRateEdits[r.id]
                            const draftPaperId = draft?.paperRateId ?? (r.paperRateId ?? "")
                            const draftFinishId = draft?.finishOptionId ?? (r.finishOptionId ?? "")
                            const draftFormatoKey = draft?.formatoKey ?? r.formatoKey
                            const draftTintas = draft?.tintas ?? String(r.tintas)
                            const draftMin = draft?.min ?? String(r.tirajeMin)
                            const draftMax = draft?.max ?? String(r.tirajeMax)
                            const draftPrecio = draft?.precioTotal ?? String(r.precioTotal)

                            const parsedTintasRaw = parseInt(draftTintas, 10)
                            const parsedTintas =
                              parsedTintasRaw === 1 || parsedTintasRaw === 2 || parsedTintasRaw === 4 ? (parsedTintasRaw as 1 | 2 | 4) : null
                            const parsedMin = parseInt(draftMin, 10)
                            const parsedMax = parseInt(draftMax, 10)
                            const parsedPrecio = parseFloat(draftPrecio)

                            const hasDraft = Boolean(draft)

                            const isPaperDirty = draft?.paperRateId !== undefined && draftPaperId !== (r.paperRateId ?? "")
                            const isFinishDirty = draft?.finishOptionId !== undefined && draftFinishId !== (r.finishOptionId ?? "")
                            const isFormatoDirty = draft?.formatoKey !== undefined && draftFormatoKey !== r.formatoKey
                            const isTintasDirty = draft?.tintas !== undefined && parsedTintas != null && parsedTintas !== r.tintas
                            const isMinDirty = draft?.min !== undefined && Number.isFinite(parsedMin) && parsedMin > 0 && parsedMin !== r.tirajeMin
                            const isMaxDirty = draft?.max !== undefined && Number.isFinite(parsedMax) && parsedMax > 0 && parsedMax !== r.tirajeMax
                            const isPrecioDirty = draft?.precioTotal !== undefined && Number.isFinite(parsedPrecio) && parsedPrecio >= 0 && parsedPrecio !== r.precioTotal

                            const canSave =
                              (isPaperDirty || isFinishDirty || isFormatoDirty || isTintasDirty || isMinDirty || isMaxDirty || isPrecioDirty) &&
                              (!draftTintas.trim() || parsedTintas != null) &&
                              (!draftMin.trim() || (Number.isFinite(parsedMin) && parsedMin > 0)) &&
                              (!draftMax.trim() || (Number.isFinite(parsedMax) && parsedMax > 0)) &&
                              (!draftPrecio.trim() || (Number.isFinite(parsedPrecio) && parsedPrecio >= 0)) &&
                              Boolean(draftFormatoKey.trim()) &&
                              Boolean(draftPaperId.trim())

                            return (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">Papel</Label>
                                    <SearchableNativeSelect
                                      value={draftPaperId}
                                      onChange={(v) => {
                                        setFlyerRateEdits((prev) => ({
                                          ...prev,
                                          [r.id]: {
                                            paperRateId: v,
                                            finishOptionId: prev[r.id]?.finishOptionId ?? (r.finishOptionId ?? ""),
                                            formatoKey: prev[r.id]?.formatoKey ?? r.formatoKey,
                                            tintas: prev[r.id]?.tintas ?? String(r.tintas),
                                            min: prev[r.id]?.min ?? String(r.tirajeMin),
                                            max: prev[r.id]?.max ?? String(r.tirajeMax),
                                            precioTotal: prev[r.id]?.precioTotal ?? String(r.precioTotal),
                                          },
                                        }))
                                      }}
                                      searchClassName={INPUT_COMPACT}
                                      selectClassName={SELECT_COMPACT}
                                      searchPlaceholder="Buscar papel…"
                                      options={[
                                        {
                                          value: "",
                                          label: r.paperRateId ? "Selecciona un papel" : "Sin papel (legacy)",
                                          disabled: true,
                                        },
                                        ...activePapers.map((p) => ({ value: p.id, label: p.nombre })),
                                      ]}
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">Acabado</Label>
                                    <SearchableNativeSelect
                                      value={draftFinishId}
                                      onChange={(v) => {
                                        setFlyerRateEdits((prev) => ({
                                          ...prev,
                                          [r.id]: {
                                            paperRateId: prev[r.id]?.paperRateId ?? (r.paperRateId ?? ""),
                                            finishOptionId: v,
                                            formatoKey: prev[r.id]?.formatoKey ?? r.formatoKey,
                                            tintas: prev[r.id]?.tintas ?? String(r.tintas),
                                            min: prev[r.id]?.min ?? String(r.tirajeMin),
                                            max: prev[r.id]?.max ?? String(r.tirajeMax),
                                            precioTotal: prev[r.id]?.precioTotal ?? String(r.precioTotal),
                                          },
                                        }))
                                      }}
                                      disabled={finishesLoading}
                                      searchClassName={INPUT_COMPACT}
                                      selectClassName={SELECT_COMPACT}
                                      includeAllOption={{ value: "", label: "Sin acabado" }}
                                      options={activeFinishes.map((f) => ({ value: f.id, label: f.nombre }))}
                                      searchPlaceholder="Buscar acabado…"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">Tamaño</Label>
                                    <SearchableNativeSelect
                                      value={draftFormatoKey}
                                      onChange={(v) => {
                                        setFlyerRateEdits((prev) => ({
                                          ...prev,
                                          [r.id]: {
                                            paperRateId: prev[r.id]?.paperRateId ?? (r.paperRateId ?? ""),
                                            finishOptionId: prev[r.id]?.finishOptionId ?? (r.finishOptionId ?? ""),
                                            formatoKey: v,
                                            tintas: prev[r.id]?.tintas ?? String(r.tintas),
                                            min: prev[r.id]?.min ?? String(r.tirajeMin),
                                            max: prev[r.id]?.max ?? String(r.tirajeMax),
                                            precioTotal: prev[r.id]?.precioTotal ?? String(r.precioTotal),
                                          },
                                        }))
                                      }}
                                      disabled={!sizeOptions.length}
                                      searchClassName={INPUT_COMPACT}
                                      selectClassName={SELECT_COMPACT}
                                      searchPlaceholder="Buscar tamaño…"
                                      options={
                                        sizeOptions.length
                                          ? [
                                              { value: "", label: "Selecciona un tamaño", disabled: true },
                                              ...sizeOptions.map((p) => ({ value: p.key, label: p.nombre })),
                                            ]
                                          : [{ value: draftFormatoKey, label: draftFormatoKey }]
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Tintas</Label>
                                    <Input
                                      className={INPUT_COMPACT}
                                      type="number"
                                      step="1"
                                      value={draftTintas}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setFlyerRateEdits((prev) => ({
                                          ...prev,
                                          [r.id]: {
                                            paperRateId: prev[r.id]?.paperRateId ?? (r.paperRateId ?? ""),
                                            finishOptionId: prev[r.id]?.finishOptionId ?? (r.finishOptionId ?? ""),
                                            formatoKey: prev[r.id]?.formatoKey ?? r.formatoKey,
                                            tintas: v,
                                            min: prev[r.id]?.min ?? String(r.tirajeMin),
                                            max: prev[r.id]?.max ?? String(r.tirajeMax),
                                            precioTotal: prev[r.id]?.precioTotal ?? String(r.precioTotal),
                                          },
                                        }))
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Min</Label>
                                    <Input
                                      className={INPUT_COMPACT}
                                      type="number"
                                      step="1"
                                      value={draftMin}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setFlyerRateEdits((prev) => ({
                                          ...prev,
                                          [r.id]: {
                                            paperRateId: prev[r.id]?.paperRateId ?? (r.paperRateId ?? ""),
                                            finishOptionId: prev[r.id]?.finishOptionId ?? (r.finishOptionId ?? ""),
                                            formatoKey: prev[r.id]?.formatoKey ?? r.formatoKey,
                                            tintas: prev[r.id]?.tintas ?? String(r.tintas),
                                            min: v,
                                            max: prev[r.id]?.max ?? String(r.tirajeMax),
                                            precioTotal: prev[r.id]?.precioTotal ?? String(r.precioTotal),
                                          },
                                        }))
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Max</Label>
                                    <Input
                                      className={INPUT_COMPACT}
                                      type="number"
                                      step="1"
                                      value={draftMax}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setFlyerRateEdits((prev) => ({
                                          ...prev,
                                          [r.id]: {
                                            paperRateId: prev[r.id]?.paperRateId ?? (r.paperRateId ?? ""),
                                            finishOptionId: prev[r.id]?.finishOptionId ?? (r.finishOptionId ?? ""),
                                            formatoKey: prev[r.id]?.formatoKey ?? r.formatoKey,
                                            tintas: prev[r.id]?.tintas ?? String(r.tintas),
                                            min: prev[r.id]?.min ?? String(r.tirajeMin),
                                            max: v,
                                            precioTotal: prev[r.id]?.precioTotal ?? String(r.precioTotal),
                                          },
                                        }))
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Precio total</Label>
                                    <MoneyInput
                                      className={INPUT_COMPACT}
                                      type="number"
                                      step="1"
                                      value={draftPrecio}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setFlyerRateEdits((prev) => ({
                                          ...prev,
                                          [r.id]: {
                                            paperRateId: prev[r.id]?.paperRateId ?? (r.paperRateId ?? ""),
                                            finishOptionId: prev[r.id]?.finishOptionId ?? (r.finishOptionId ?? ""),
                                            formatoKey: prev[r.id]?.formatoKey ?? r.formatoKey,
                                            tintas: prev[r.id]?.tintas ?? String(r.tintas),
                                            min: prev[r.id]?.min ?? String(r.tirajeMin),
                                            max: prev[r.id]?.max ?? String(r.tirajeMax),
                                            precioTotal: v,
                                          },
                                        }))
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setFlyerRateEdits((prev) => {
                                        const next = { ...prev }
                                        delete next[r.id]
                                        return next
                                      })
                                    }
                                    disabled={!hasDraft}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      const patch: Partial<FlyerRate> = {}

                                      const paperRateId = draftPaperId.trim()
                                      if (paperRateId && (r.paperRateId ?? "") !== paperRateId) patch.paperRateId = paperRateId

                                      const finishOptionId = draftFinishId.trim() || null
                                      if ((r.finishOptionId ?? null) !== finishOptionId) patch.finishOptionId = finishOptionId

                                      const formatoKey = draftFormatoKey.trim()
                                      if (formatoKey && formatoKey !== r.formatoKey) patch.formatoKey = formatoKey

                                      if (parsedTintas != null && parsedTintas !== r.tintas) patch.tintas = parsedTintas
                                      if (Number.isFinite(parsedMin) && parsedMin > 0 && parsedMin !== r.tirajeMin) patch.tirajeMin = parsedMin
                                      if (Number.isFinite(parsedMax) && parsedMax > 0 && parsedMax !== r.tirajeMax) patch.tirajeMax = parsedMax
                                      if (Number.isFinite(parsedPrecio) && parsedPrecio >= 0 && parsedPrecio !== r.precioTotal) patch.precioTotal = parsedPrecio

                                      if (Object.keys(patch).length === 0) return
                                      void patchFlyerRate(r.id, patch)
                                      setFlyerRateEdits((prev) => {
                                        const next = { ...prev }
                                        delete next[r.id]
                                        return next
                                      })
                                    }}
                                    disabled={!canSave}
                                  >
                                    Guardar
                                  </Button>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {flyerRateGroupsCount > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {ratesPage * PAGE_SIZE + 1}-{Math.min(flyerRateGroupsCount, (ratesPage + 1) * PAGE_SIZE)} de {flyerRateGroupsCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setRatesPage((p) => Math.max(0, p - 1))} disabled={ratesPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {ratesPage + 1} / {Math.max(1, Math.ceil(flyerRateGroupsCount / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRatesPage((p) => Math.min(Math.ceil(flyerRateGroupsCount / PAGE_SIZE) - 1, p + 1))}
                        disabled={ratesPage >= Math.ceil(flyerRateGroupsCount / PAGE_SIZE) - 1}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              </CardContent>
            </details>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {aiPrefillNotice ? (
        <div className="lg:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {aiPrefillNotice}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Parámetros</CardTitle>
          <CardDescription>Selecciona opciones. Los costos se autollenan.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Cantidad (tiraje)</Label>
            <Input className={INPUT_COMPACT} type="number" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Aquí va la cantidad final que compra el cliente. Si el cliente pide 6000 volantes carta, en este campo debes poner 6000.
            </p>
          </div>

          <div>
            <Label>Tamaño final cliente</Label>
            <SearchableNativeSelect
              value={formatoKey}
              onChange={(nextKey) => {
                setFormatoKey(nextKey)
                const preset = sizeOptions.find((p) => p.key === nextKey)
                if (!preset) return
                setFormatoW(String(preset.widthCm))
                setFormatoH(String(preset.heightCm))
              }}
              disabled={!sizeOptions.length}
              searchClassName={INPUT_COMPACT}
              selectClassName={SELECT_COMPACT}
              searchPlaceholder="Buscar tamaño…"
              options={[
                {
                  value: "",
                  label: sizeOptions.length ? "Selecciona un tamaño" : "Sin tamaños configurados",
                  disabled: true,
                },
                ...sizeOptions.map((p) => ({
                  value: p.key,
                  label: `${p.nombre} (${p.widthCm}×${p.heightCm} cm)`,
                })),
              ]}
            />
            {!sizeOptions.length ? (
              <p className="mt-1 text-xs text-muted-foreground">Crea tamaños en Configuración &gt; Tamaños cliente para poder cotizar.</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">Este selector define lo que recibe el cliente: carta, media carta, cuarto, octavo, medio pliego o pliego.</p>
          </div>

          <div>
            <Label>Se imprime en</Label>
            <SearchableNativeSelect
              value={selectedPlanchaProfileId}
              onChange={(v) => setSelectedPlanchaProfileId(v)}
              disabled={!activePlanchaProfiles.length}
              searchClassName={INPUT_COMPACT}
              selectClassName={SELECT_COMPACT}
              searchPlaceholder="Buscar formato de impresión…"
              options={
                activePlanchaProfiles.length
                  ? activePlanchaProfiles.map((p) => ({ value: p.id, label: `${p.nombre} (${p.anchoUtilCm}×${p.altoUtilCm} cm)` }))
                  : [{ value: "", label: "Sin formatos configurados", disabled: true }]
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedPlanchaProfile ? (
                <>
                  <span className="block">Tamaño de impresión: {selectedPlanchaProfile.anchoUtilCm}×{selectedPlanchaProfile.altoUtilCm} cm</span>
                  <span className="block">Costo plancha/color: {formatCurrency(selectedPlanchaProfile.costoPlanchaPorColor)}</span>
                </>
              ) : (
                <>Selecciona el tamaño real de impresión; desde aquí se toma el costo base por color.</>
              )}
            </p>
          </div>

          <div>
            <Label>Tinta (costo)</Label>
            <SearchableNativeSelect
              value={selectedTintaProfileId}
              onChange={(v) => setSelectedTintaProfileId(v)}
              disabled={!activeTintaProfiles.length}
              searchClassName={INPUT_COMPACT}
              selectClassName={SELECT_COMPACT}
              searchPlaceholder="Buscar tinta…"
              options={
                activeTintaProfiles.length
                  ? activeTintaProfiles.map((p) => ({ value: p.id, label: p.nombre }))
                  : [{ value: "", label: "Sin perfiles", disabled: true }]
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedTintaProfile ? (
                <>
                  <span className="block">Tinta/Color: {formatCurrency(selectedTintaProfile.costoTintaPorColor)}</span>
                </>
              ) : (
                <>Selecciona tintas.</>
              )}
            </p>
          </div>

          <div>
            <Label>Papel</Label>
            <SearchableNativeSelect
              value={selectedPaperId}
              onChange={(nextId) => {
                setSelectedPaperId(nextId)
                const p = activePapers.find((x) => x.id === nextId) || null
                if (p) {
                  setSelectedPaperTipo(String(p.tipo || "otro").trim() || "otro")
                  setSelectedPaperGramaje(p.gramaje != null ? String(p.gramaje) : "")
                }
              }}
              disabled={!activePapers.length}
              searchClassName={INPUT_COMPACT}
              selectClassName={SELECT_COMPACT}
              searchPlaceholder="Buscar papel…"
              options={
                activePapers.length
                  ? activePapers.map((p) => ({
                      value: p.id,
                      label: `${p.nombre}${p.gramaje ? ` • ${p.gramaje}g` : ""} • ${formatCurrency(p.costoPliego)}/pliego`,
                    }))
                  : [{ value: "", label: "Sin papeles", disabled: true }]
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedPaper ? (
                <>Pliego: {selectedPaper.pliegoWidthCm}×{selectedPaper.pliegoHeightCm} cm</>
              ) : (
                <>Selecciona un papel.</>
              )}
            </p>
          </div>

          <div>
            <Label>Acabados</Label>
            <SearchableNativeSelect
              value={selectedFinishId}
              onChange={(v) => setSelectedFinishId(v)}
              disabled={finishesLoading}
              searchClassName={INPUT_COMPACT}
              selectClassName={SELECT_COMPACT}
              includeAllOption={{ value: "", label: "Sin acabado" }}
              options={activeFinishes.map((f) => ({ value: f.id, label: f.nombre }))}
              searchPlaceholder="Buscar acabado…"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Transporte</Label>
            <SearchableNativeSelect
              value={selectedTransporteKey}
              onChange={(v) => setSelectedTransporteKey(v)}
              searchClassName={INPUT_COMPACT}
              selectClassName={SELECT_COMPACT}
              includeAllOption={{ value: "", label: "Sin transporte" }}
              options={transporteOptions.map((o) => ({ value: o.value, label: `${o.label} • ${formatCurrency(o.total)}` }))}
              searchPlaceholder="Buscar transporte…"
              emptyText={transporteOptions.length ? 'Sin resultados' : 'Sin transportes configurados'}
            />
            {!transporteOptions.length ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-muted-foreground">No hay opciones de transporte configuradas.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void createTemplateIfMissing('transporte')}>
                  Crear plantilla
                </Button>
              </div>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">Opcional. Se suma como valor fijo al total.</p>
          </div>

          <div className="sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea
              className="mt-2 min-h-[72px] text-sm"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Notas/observaciones (opcional)…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
          <CardDescription>
            Precio desde tarifario + transporte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {matchedRateLoading ? <p className="text-sm text-muted-foreground">Buscando tarifa…</p> : null}

          {matchedRate ? (
            <>
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between"><span>Rango aplicado</span><span className="font-medium">{matchedRate.tirajeMin}-{matchedRate.tirajeMax}</span></div>
              </div>

              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                {(() => {
                  const pzas = calc.piezasPorPliego ?? 0
                  const pl = calc.pliegosNecesarios ?? 0
                  if (!(pzas > 0) || !(pl > 0)) return <div className="flex justify-between"><span>Imposición</span><span className="font-medium">—</span></div>
                  return (
                    <>
                      <div className="flex justify-between"><span>Piezas por pliego</span><span className="font-medium">{pzas}</span></div>
                      <div className="flex justify-between"><span>Pliegos necesarios</span><span className="font-medium">{pl}</span></div>
                    </>
                  )
                })()}
              </div>

              <div className="border-t pt-3">
                {(() => {
                  const base = matchedRate.precioTotal || 0
                  const transporte = parseFloat(costoTransporte) || 0
                  const total = base + transporte
                  const qty = Math.max(1, Math.trunc(parseFloat(cantidad) || 0))

                  return (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base (tarifario)</span><span className="font-medium">{formatCurrency(base)}</span></div>
                      <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Transporte</span><span className="font-medium">{formatCurrency(transporte)}</span></div>
                      <div className="flex justify-between mt-2"><span className="font-medium">Total</span><span className="font-bold text-blue-700">{formatCurrency(total)}</span></div>
                      <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Unitario</span><span className="font-medium">{formatCurrency(total / qty)}</span></div>
                    </>
                  )
                })()}
              </div>
            </>
          ) : (
            <>
              {!matchedRateLoading ? (
                <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <p className="text-sm font-medium">Estimado (costos configurados)</p>
                  {(() => {
                    const rawQty = Math.trunc(parseFloat(cantidad) || 0)
                    if (!(rawQty > 0)) {
                      return <p className="text-xs text-muted-foreground">Ingresa una cantidad válida para calcular.</p>
                    }
                    const qty = rawQty
                    const total = calc.costoProduccion
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="flex justify-between"><span>Plancha</span><span className="font-medium text-foreground">{formatCurrency(calc.plancha)}</span></div>
                          <div className="flex justify-between"><span>Tinta</span><span className="font-medium text-foreground">{formatCurrency(calc.tinta)}</span></div>
                          <div className="flex justify-between"><span>Papel</span><span className="font-medium text-foreground">{formatCurrency(calc.papel)}</span></div>
                          <div className="flex justify-between"><span>Acabados</span><span className="font-medium text-foreground">{formatCurrency(calc.acabados)}</span></div>
                          <div className="flex justify-between"><span>Transporte</span><span className="font-medium text-foreground">{formatCurrency(calc.transporte)}</span></div>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between"><span className="font-medium">Total</span><span className="font-bold text-blue-700">{formatCurrency(total)}</span></div>
                          <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Unitario aprox.</span><span className="font-medium">{formatCurrency(total / qty)}</span></div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Para fijar precios por rangos (ej: 1–500, 501–1000), crea rangos por Papel + Tamaño + Tintas + Rango en Configuración.
                        </p>
                      </>
                    )
                  })()}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
        </div>
      )}
    </div>
  )
}
