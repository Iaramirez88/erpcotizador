"use client"

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
import { LitografiaImpositionPreview } from "@/components/litografia/litografia-imposition-preview"
import { computeLitografia, type LitografiaResult } from "@/lib/litografia"
import { formatCurrency } from "@/lib/utils"

type PapelTipo = "bond" | "propalcote" | "periodico" | "otro"

type PrintRunMode = "4x1" | "4x4"
type PrintInkKey = string

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

function formatCm(value: number | null | undefined) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
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
  paperId: string
  planchas: string
  planchaProfileId: string
  planchaProfileQty: string
  tintaProfileId: string
  tintaProfileQty: string
  sobranteMinimo: string
  finishId: string
  specialFinishId: string
  specialFinishQty: string
  plastificadoId: string
  plastificadoQty: string
  troqueladoId: string
  troqueladoQty: string
  corteId: string
  corteQty: string
  printInkFront: PrintInkKey
  printInkBack: PrintInkKey
  desperdicioPct?: string
}

function createDefaultEditorialPart(): EditorialPartState {
  return {
    formatoKey: "",
    paperId: "",
    planchas: "",
    planchaProfileId: "",
    planchaProfileQty: "1",
    tintaProfileId: "",
    tintaProfileQty: "1",
    sobranteMinimo: "100",
    finishId: "",
    specialFinishId: "",
    specialFinishQty: "0",
    plastificadoId: "",
    plastificadoQty: "1",
    troqueladoId: "",
    troqueladoQty: "1",
    corteId: "",
    corteQty: "1",
    printInkFront: "4",
    printInkBack: "1",
    desperdicioPct: "0",
  }
}

type CustomField = { id: string; label: string; value: string }

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
  selectedCorteId?: string
  selectedCorteQty?: string
  selectedPaperTipo: string
  selectedPaperGramaje: string
  selectedTransporteKey: string
  costoCorte: string
  costoAcabados: string
  costoTransporte: string
  customFields: CustomField[]

  quoteMode?: QuoteMode

  editorialProductoKey?: string
  editorialTotalPaginas?: string
  editorialPaginasPortadaContraportada?: string
  editorialCartasPorPlancha?: string
  editorialPaginasPorPliego?: string

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
}) {
  const { t, language } = useI18n()

  const [meLoaded, setMeLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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

  const [profiles, setProfiles] = useState<PrintProfile[]>([])
  const [papers, setPapers] = useState<PaperRate[]>([])
  const [finishes, setFinishes] = useState<FinishOption[]>([])
  const [sizes, setSizes] = useState<PrintSize[]>([])
  const [configError, setConfigError] = useState<string | null>(null)
  const [selectedPlanchaProfileIds, setSelectedPlanchaProfileIds] = useState<string[]>([""])
  const [selectedPlanchaProfileQtys, setSelectedPlanchaProfileQtys] = useState<string[]>(["1"])
  const [selectedTintaProfileIds, setSelectedTintaProfileIds] = useState<string[]>([""])
  const [selectedTintaProfileQtys, setSelectedTintaProfileQtys] = useState<string[]>(["1"])
  const [paperRows, setPaperRows] = useState<PaperRow[]>([{ paperId: "", qty: "1", formatoKey: "" }])
  const [selectedFinishIds, setSelectedFinishIds] = useState<string[]>([""])
  const [specialFinishRows, setSpecialFinishRows] = useState<SpecialFinishRow[]>([{ finishId: "", qty: "1" }])

  const [selectedPlastificadoId, setSelectedPlastificadoId] = useState<string>("")
  const [selectedTroqueladoId, setSelectedTroqueladoId] = useState<string>("")
  const [selectedCorteId, setSelectedCorteId] = useState<string>("")

  const [selectedPlastificadoQty, setSelectedPlastificadoQty] = useState<string>("1")
  const [selectedTroqueladoQty, setSelectedTroqueladoQty] = useState<string>("1")
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

  const [editorialCover, setEditorialCover] = useState<EditorialPartState>(() => createDefaultEditorialPart())
  const [editorialInner, setEditorialInner] = useState<EditorialPartState>(() => createDefaultEditorialPart())

  const [costoCorte, setCostoCorte] = useState("0")
  const [costoAcabados, setCostoAcabados] = useState("0")
  const [costoTransporte, setCostoTransporte] = useState("0")

  // Utilidad/Margen opcional (en litografía la utilidad varía)
  const [margenPct, setMargenPct] = useState<string>("40")

  // En SGDigital se cotiza siempre en policromía (4).
  const tintas: 1 | 2 | 4 = 4
  const [pricingError, setPricingError] = useState<string | null>(null)

  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const [showAdvanced, setShowAdvanced] = useState(false)

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

  const editorialMode = quoteMode === "editorial"
  const editorialEnabled = editorialMode && Boolean(String(selectedEditorialProductoKey || "").trim())

  const prevQuoteModeRef = useRef<QuoteMode>(quoteMode)

  useEffect(() => {
    if (!props.open) {
      prevQuoteModeRef.current = quoteMode
      return
    }

    setShowAdvanced(false)

    const prev = prevQuoteModeRef.current
    if (prev !== quoteMode) {
      // Al cambiar de modo, arrancar limpio para evitar herencia entre modos.
      setTitulo("")
      setDescripcion("")

      setCantidad("1000")
      setColores("1")
      setSobranteMinimo("100")
      setPrintInkFront("4")
      setPrintInkBack("1")

      setCostoPlanchaPorColor("25000")
      setCostoTintaPorColor("15000")
      setCostoPapelUnidad("80")

      setMargenPct("40")

      setConfigError(null)

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
      setCostoPapelUnidad("80")
      setSelectedPaperTipo("")
      setSelectedPaperGramaje("")
      setSobranteMinimo("100")

      setSelectedFinishIds([""])
      setSpecialFinishRows([{ finishId: "", qty: "1" }])
      setSelectedPlastificadoId("")
      setSelectedTroqueladoId("")
      setSelectedCorteId("")
      setSelectedPlastificadoQty("1")
      setSelectedTroqueladoQty("1")
      setSelectedCorteQty("1")
      setSelectedTransporteKey("")
      setCostoTransporte("0")
      setCostoCorte("0")
      setCostoAcabados("0")
      setCustomFields([])
      setPricingError(null)
      setAttemptedSubmit(false)

      setSelectedEditorialProductoKey("")
      setEditorialTotalPaginas("32")
      setEditorialPaginasPortadaContraportada("2")
      setEditorialCartasPorPlancha("2")
      setEditorialPaginasPorPliego("4")
      setEditorialCover(createDefaultEditorialPart())
      setEditorialInner(createDefaultEditorialPart())
    }

    prevQuoteModeRef.current = quoteMode
  }, [props.open, quoteMode])

  const SOBRANTE_MINIMO_BASE_DEFAULT = 100

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
      selectedCorteId,
      selectedCorteQty,
      selectedPaperTipo,
      selectedPaperGramaje,
      selectedTransporteKey,
      costoCorte,
      costoAcabados,
      costoTransporte,
      customFields,

      editorialProductoKey: editorialEnabled ? selectedEditorialProductoKey : undefined,
      editorialTotalPaginas: editorialEnabled ? editorialTotalPaginas : undefined,
      editorialPaginasPortadaContraportada: editorialEnabled ? editorialPaginasPortadaContraportada : undefined,
      editorialCartasPorPlancha: editorialEnabled ? editorialCartasPorPlancha : undefined,
      editorialPaginasPorPliego: editorialEnabled ? editorialPaginasPorPliego : undefined,

      editorialParts: editorialEnabled
        ? {
          cover: { ...editorialCover, desperdicioPct: "0" },
          inner: { ...editorialInner, desperdicioPct: "0" },
        }
        : undefined,
      costoProduccion: computed?.costoProduccion,
      precioVenta: computed?.precioVenta,
      selectedMachineName: primaryPlanchaProfile?.nombre,
      selectedMachineWidthCm: primaryPlanchaProfile ? String(primaryMachineWidth) : undefined,
      selectedMachineHeightCm: primaryPlanchaProfile ? String(primaryMachineHeight) : undefined,
      selectedMachineGapCm: primaryPlanchaProfile ? String(primaryMachineGap) : undefined,
      impositionShort: currentImpositionSummary?.short,
      impositionSummary: currentImpositionSummary?.detail,
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
    setSelectedCorteId(meta.selectedCorteId ?? "")
    setSelectedPlastificadoQty(String(meta.selectedPlastificadoQty ?? "1"))
    setSelectedTroqueladoQty(String(meta.selectedTroqueladoQty ?? "1"))
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

    const parts = meta.editorialParts
    if (parts?.cover) setEditorialCover({ ...createDefaultEditorialPart(), ...parts.cover })
    else setEditorialCover(createDefaultEditorialPart())
    if (parts?.inner) setEditorialInner({ ...createDefaultEditorialPart(), ...parts.inner })
    else setEditorialInner(createDefaultEditorialPart())
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

  const selectedPreset = useMemo(() => {
    return sizeOptions.find((p) => p.key === formatoKey) || null
  }, [formatoKey, sizeOptions])

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
  const activeSpecialFinishes = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "ACABADO" && Boolean(f.especial)),
    [finishes]
  )

  const activePlastificados = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "PLASTIFICADO"),
    [finishes]
  )
  const activeTroquelados = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "TROQUELADO"),
    [finishes]
  )
  const activeCortes = useMemo(
    () => finishes.filter((f) => f.activo && getGrupo(f) === "CORTE"),
    [finishes]
  )

  const selectedPlastificado = useMemo(() => {
    if (!selectedPlastificadoId) return null
    return activePlastificados.find((f) => f.id === selectedPlastificadoId) || null
  }, [activePlastificados, selectedPlastificadoId])

  const selectedTroquelado = useMemo(() => {
    if (!selectedTroqueladoId) return null
    return activeTroquelados.find((f) => f.id === selectedTroqueladoId) || null
  }, [activeTroquelados, selectedTroqueladoId])

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
  const corteCost = Number(selectedCorte?.valor) || 0

  const plastificadoQty = useMemo(() => {
    const n = Math.trunc(parseFloat(String(selectedPlastificadoQty)) || 0)
    return Math.max(1, Number.isFinite(n) ? n : 1)
  }, [selectedPlastificadoQty])
  const troqueladoQty = useMemo(() => {
    const n = Math.trunc(parseFloat(String(selectedTroqueladoQty)) || 0)
    return Math.max(1, Number.isFinite(n) ? n : 1)
  }, [selectedTroqueladoQty])
  const corteQty = useMemo(() => {
    const n = Math.trunc(parseFloat(String(selectedCorteQty)) || 0)
    return Math.max(1, Number.isFinite(n) ? n : 1)
  }, [selectedCorteQty])

  const plastificadoCostTotal = plastificadoCost * plastificadoQty
  const troqueladoCostTotal = troqueladoCost * troqueladoQty
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
  const primaryPaper = (primaryPaperId ? papers.find((p) => p.id === primaryPaperId) || null : null)
  const primaryMachineWidth = Number(primaryPlanchaProfile?.anchoUtilCm) || 0
  const primaryMachineHeight = Number(primaryPlanchaProfile?.altoUtilCm) || 0
  const primaryMachineGap = Math.max(0, Number(primaryPlanchaProfile?.separacionPiezasCm) || 0)

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
      if (formatoKey) setFormatoKey("")
      return
    }
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
      setEditorialCover((prev) => (prev.planchaProfileId ? prev : { ...prev, planchaProfileId: activePlanchaProfiles[0]!.id }))
      setEditorialInner((prev) => (prev.planchaProfileId ? prev : { ...prev, planchaProfileId: activePlanchaProfiles[0]!.id }))
    }
    if (activeTintaProfiles.length) {
      setEditorialCover((prev) => (prev.tintaProfileId ? prev : { ...prev, tintaProfileId: activeTintaProfiles[0]!.id }))
      setEditorialInner((prev) => (prev.tintaProfileId ? prev : { ...prev, tintaProfileId: activeTintaProfiles[0]!.id }))
    }
    if (activePapers.length) {
      setEditorialCover((prev) => (prev.paperId ? prev : { ...prev, paperId: activePapers[0]!.id }))
      setEditorialInner((prev) => (prev.paperId ? prev : { ...prev, paperId: activePapers[0]!.id }))
    }
  }, [props.open, editorialMode, activePlanchaProfiles, activeTintaProfiles, activePapers])

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
    const innerPlanchas = totalPaginas > 0 ? 1 : 0
    const coverPlanchas = coverPaginas > 0 ? 1 : 0
    const innerPliegosPorUnidad = totalPaginas > 0 ? Math.ceil(totalPaginas / paginasPorPliego) : 0
    const coverPliegosPorUnidad = coverPaginas > 0 ? Math.ceil(coverPaginas / paginasPorPliego) : 0

    return {
      innerPlanchas,
      coverPlanchas,
      innerPliegosPorUnidad,
      coverPliegosPorUnidad,
    }
  }, [props.open, selectedEditorialProductoKey, editorialTotalPaginas, editorialPaginasPortadaContraportada, editorialPaginasPorPliego])

  const computeEditorialSheetsPreview = useCallback((part: EditorialPartState, pliegosPorUnidad: number) => {
    const runQty = Math.max(0, Math.trunc(parseFloat(cantidad) || 0))
    if (runQty <= 0) return null
    const paper = papers.find((p) => p.id === String(part.paperId || "").trim()) || null
    if (!paper) return null
    const preset = sizeOptions.find((s) => s.key === String(part.formatoKey || "").trim()) || null
    if (!preset) return null
    const planchaProfile = profiles.find((p) => p.id === String(part.planchaProfileId || "").trim()) || null

    const sobranteDefault = parseFloat(sobranteMinimo) || 0
    const sobranteLocal = parseFloat(String(part.sobranteMinimo))
    const sobranteFinal = Number.isFinite(sobranteLocal) ? sobranteLocal : sobranteDefault

    const qtyForCompute = runQty * Math.max(1, Math.trunc(Number(pliegosPorUnidad) || 0) || 1)
    const r = computeLitografia({
      cantidad: qtyForCompute,
      colores: 1,
      desperdicioPct: 0,
      sobranteMinimo: sobranteFinal,
      costoPlanchaPorColor: 0,
      costoTintaPorColor: 0,
      costoPapelUnidad: 0,
      papelModo: "pliego",
      papelTipo: "otro",
      papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
      papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
      papelFormatoWidthCm: preset.widthCm ?? 0,
      papelFormatoHeightCm: preset.heightCm ?? 0,
      maquinaPliegoWidthCm: Number(planchaProfile?.anchoUtilCm) || 0,
      maquinaPliegoHeightCm: Number(planchaProfile?.altoUtilCm) || 0,
      maquinaSeparacionCm: Math.max(0, Number(planchaProfile?.separacionPiezasCm) || 0),
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
      sobranteFinal,
      piezasPorPliego: r.piezasPorPliego,
      pliegosNecesarios: r.pliegosNecesarios,
    }
  }, [cantidad, papers, profiles, sizeOptions, sobranteMinimo])

  const editorialCoverSheetsPreview = useMemo(() => {
    if (!editorialEnabled) return null
    const pliegos = editorialSplitCalc?.coverPliegosPorUnidad ?? 0
    return computeEditorialSheetsPreview(editorialCover, pliegos)
  }, [editorialEnabled, editorialSplitCalc?.coverPliegosPorUnidad, computeEditorialSheetsPreview, editorialCover])

  const editorialInnerSheetsPreview = useMemo(() => {
    if (!editorialEnabled) return null
    const pliegos = editorialSplitCalc?.innerPliegosPorUnidad ?? 0
    return computeEditorialSheetsPreview(editorialInner, pliegos)
  }, [editorialEnabled, editorialSplitCalc?.innerPliegosPorUnidad, computeEditorialSheetsPreview, editorialInner])

  useEffect(() => {
    if (!props.open) return
    if (!selectedEditorialProductoKey) return

    const defaultPaperId = primaryPaperId || activePapers[0]?.id || ""
    const defaultFormatoKey = formatoKey || sizeOptions[0]?.key || ""
    const defaults = editorialSplitCalc

    setEditorialCover((prev) => {
      const next: EditorialPartState = { ...prev }
      if (!String(next.paperId || "").trim()) next.paperId = defaultPaperId
      if (!String(next.formatoKey || "").trim()) next.formatoKey = defaultFormatoKey
      if (!String(next.sobranteMinimo || "").trim()) next.sobranteMinimo = sobranteMinimo
      if (!String(next.planchas || "").trim() && defaults) next.planchas = String(defaults.coverPlanchas || 0)
      next.desperdicioPct = "0"
      return next
    })

    setEditorialInner((prev) => {
      const next: EditorialPartState = { ...prev }
      if (!String(next.paperId || "").trim()) next.paperId = defaultPaperId
      if (!String(next.formatoKey || "").trim()) next.formatoKey = defaultFormatoKey
      if (!String(next.sobranteMinimo || "").trim()) next.sobranteMinimo = sobranteMinimo
      if (!String(next.planchas || "").trim() && defaults) next.planchas = String(defaults.innerPlanchas || 0)
      next.desperdicioPct = "0"
      return next
    })
  }, [props.open, selectedEditorialProductoKey, editorialSplitCalc, primaryPaperId, activePapers, sobranteMinimo, formatoKey, sizeOptions])

  useEffect(() => {
    if (!props.open) return
    if (!editorialEnabled) return
    const coverKey = String(editorialCover.formatoKey || "").trim()
    const innerKey = String(editorialInner.formatoKey || "").trim()
    const next = coverKey || innerKey
    if (!next) return
    if (coverKey !== next) setEditorialCover((prev) => ({ ...prev, formatoKey: next }))
    if (innerKey !== next) setEditorialInner((prev) => ({ ...prev, formatoKey: next }))
  }, [props.open, editorialEnabled, editorialCover.formatoKey, editorialInner.formatoKey])

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

      const presetByKey = new Map(sizeOptions.map((s) => [s.key, s] as const))
      const profileById = new Map(profiles.map((p) => [p.id, p] as const))

      const transporte = parseFloat(costoTransporte) || 0

      const inferPapelTipo = (paperTipoRaw: string | null | undefined): PapelTipo => {
        const tt = String(paperTipoRaw || "").toLowerCase()
        if (tt.includes("bond")) return "bond"
        if (tt.includes("propal") || tt.includes("cote") || tt.includes("couche")) return "propalcote"
        if (tt.includes("period")) return "periodico"
        return "otro"
      }

      const computePart = (part: EditorialPartState, pliegosPorUnidad: number, planchasPorUnidad: number) => {
        const runQty = Math.max(0, Math.trunc(qtyBase))
        if (runQty <= 0) return null
        const paper = papers.find((p) => p.id === String(part.paperId || "").trim()) || null
        if (!paper) return null

        const preset = presetByKey.get(String(part.formatoKey || "").trim()) || null
        if (!preset) return null

        const planchaProfile = part.planchaProfileId ? profileById.get(String(part.planchaProfileId || "").trim()) || null : null
        const tintaProfile = part.tintaProfileId ? profileById.get(String(part.tintaProfileId || "").trim()) || null : null
        const planchaProfileQty = Math.max(1, Math.trunc(parseFloat(String(part.planchaProfileQty || "1")) || 0) || 1)
        const tintaProfileQty = Math.max(1, Math.trunc(parseFloat(String(part.tintaProfileQty || "1")) || 0) || 1)
        const planchaCostPorColor = (Number(planchaProfile?.costoPlanchaPorColor) || 0) * planchaProfileQty
        const tintaCostPorColor = (Number(tintaProfile?.costoTintaPorColor) || 0) * tintaProfileQty

        const tintasLocal: 1 | 2 | 4 = 4
        const planchasLocal = Math.max(0, Math.trunc(Number(planchasPorUnidad) || 0))
        const sobranteLocal = parseFloat(String(part.sobranteMinimo))

        const finish = part.finishId ? finishes.find((f) => f.id === part.finishId) || null : null
        const finishesCost = finish && !finish.especial && getGrupo(finish) === "ACABADO" ? (Number(finish.valor) || 0) : 0

        const special = part.specialFinishId ? finishes.find((f) => f.id === part.specialFinishId) || null : null
        const specialQty = Math.max(0, Math.trunc(parseFloat(String(part.specialFinishQty)) || 0))
        const specialCost = special && Boolean(special.especial) ? (Number(special.valor) || 0) * specialQty : 0

        const plast = part.plastificadoId ? finishes.find((f) => f.id === part.plastificadoId) || null : null
        const plastQty = Math.max(1, Math.trunc(parseFloat(String(part.plastificadoQty)) || 0) || 1)
        const plastCost = plast && getGrupo(plast) === "PLASTIFICADO" ? (Number(plast.valor) || 0) * plastQty : 0

        const troq = part.troqueladoId ? finishes.find((f) => f.id === part.troqueladoId) || null : null
        const troqQty = Math.max(1, Math.trunc(parseFloat(String(part.troqueladoQty)) || 0) || 1)
        const troqCost = troq && getGrupo(troq) === "TROQUELADO" ? (Number(troq.valor) || 0) * troqQty : 0

        const corteOpt = part.corteId ? finishes.find((f) => f.id === part.corteId) || null : null
        const corteQtyLocal = Math.max(1, Math.trunc(parseFloat(String(part.corteQty)) || 0) || 1)
        const corteCostLocal = corteOpt && getGrupo(corteOpt) === "CORTE" ? (Number(corteOpt.valor) || 0) * corteQtyLocal : 0

        const qtyForCompute = runQty * Math.max(1, pliegosPorUnidad)
        return computeLitografia({
          cantidad: qtyForCompute,
          colores: tintasLocal,
          desperdicioPct: 0,
          sobranteMinimo: Number.isFinite(sobranteLocal) ? sobranteLocal : sobrante,
          costoPlanchaPorColor: toPerColorCost(((planchaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoTintaPorColor: toPerColorCost(((tintaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoPapelUnidad: 0,
          papelModo: "pliego",
          papelTipo: inferPapelTipo(paper.tipo),
          papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
          papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
          papelFormatoWidthCm: preset.widthCm ?? 0,
          papelFormatoHeightCm: preset.heightCm ?? 0,
          maquinaPliegoWidthCm: Number(planchaProfile?.anchoUtilCm) || 0,
          maquinaPliegoHeightCm: Number(planchaProfile?.altoUtilCm) || 0,
          maquinaSeparacionCm: Math.max(0, Number(planchaProfile?.separacionPiezasCm) || 0),
          costoPliego: paper.costoPliego ?? 0,
          costoCorte: corteCostLocal,
          costoAcabados: finishesCost + specialCost + plastCost + troqCost,
          costoTransporte: 0,
          margenPct: 0,
        })
      }

      const cover = defaults.coverPliegosPorUnidad > 0
        ? computePart(editorialCover, defaults.coverPliegosPorUnidad, defaults.coverPlanchas)
        : null
      const inner = defaults.innerPliegosPorUnidad > 0
        ? computePart(editorialInner, defaults.innerPliegosPorUnidad, defaults.innerPlanchas)
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

    const addAcabadosExtras = selectedFinishesCost + specialFinishesCost + plastificadoCostTotal + troqueladoCostTotal
    const addCorteExtra = corteCostTotal

    const base = computeLitografia({
      cantidad: qtyForCompute,
      colores: tintas,
      desperdicioPct: 0,
      sobranteMinimo: sobrante,
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
      const presetByKey = new Map(sizeOptions.map((s) => [s.key, s] as const))

      const baseNoPaper = computeLitografia({
        cantidad: qtyForCompute,
        colores: tintas,
        desperdicioPct: 0,
        sobranteMinimo: sobrante,
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

      const presetByKey = new Map(sizeOptions.map((s) => [s.key, s] as const))
      const profileById = new Map(profiles.map((p) => [p.id, p] as const))

      const transporte = parseFloat(costoTransporte) || 0

      const inferPapelTipo = (paperTipoRaw: string | null | undefined): PapelTipo => {
        const tt = String(paperTipoRaw || "").toLowerCase()
        if (tt.includes("bond")) return "bond"
        if (tt.includes("propal") || tt.includes("cote") || tt.includes("couche")) return "propalcote"
        if (tt.includes("period")) return "periodico"
        return "otro"
      }

      const computePart = (part: EditorialPartState, pliegosPorUnidad: number, planchasPorUnidad: number) => {
        const runQty = Math.max(0, Math.trunc(qty))
        if (runQty <= 0) return null
        const paper = papers.find((p) => p.id === String(part.paperId || "").trim()) || null
        if (!paper) return null

        const preset = presetByKey.get(String(part.formatoKey || "").trim()) || null
        if (!preset) return null

        const planchaProfile = part.planchaProfileId ? profileById.get(String(part.planchaProfileId || "").trim()) || null : null
        const tintaProfile = part.tintaProfileId ? profileById.get(String(part.tintaProfileId || "").trim()) || null : null
        const planchaProfileQty = Math.max(1, Math.trunc(parseFloat(String(part.planchaProfileQty || "1")) || 0) || 1)
        const tintaProfileQty = Math.max(1, Math.trunc(parseFloat(String(part.tintaProfileQty || "1")) || 0) || 1)
        const planchaCostPorColor = (Number(planchaProfile?.costoPlanchaPorColor) || 0) * planchaProfileQty
        const tintaCostPorColor = (Number(tintaProfile?.costoTintaPorColor) || 0) * tintaProfileQty

        const tintasLocal: 1 | 2 | 4 = 4
        const planchasLocal = Math.max(0, Math.trunc(Number(planchasPorUnidad) || 0))
        const sobranteLocal = parseFloat(String(part.sobranteMinimo))

        const finish = part.finishId ? finishes.find((f) => f.id === part.finishId) || null : null
        const finishesCost = finish && !finish.especial && getGrupo(finish) === "ACABADO" ? (Number(finish.valor) || 0) : 0

        const special = part.specialFinishId ? finishes.find((f) => f.id === part.specialFinishId) || null : null
        const specialQty = Math.max(0, Math.trunc(parseFloat(String(part.specialFinishQty)) || 0))
        const specialCost = special && Boolean(special.especial) ? (Number(special.valor) || 0) * specialQty : 0

        const plast = part.plastificadoId ? finishes.find((f) => f.id === part.plastificadoId) || null : null
        const plastQty = Math.max(1, Math.trunc(parseFloat(String(part.plastificadoQty)) || 0) || 1)
        const plastCost = plast && getGrupo(plast) === "PLASTIFICADO" ? (Number(plast.valor) || 0) * plastQty : 0

        const troq = part.troqueladoId ? finishes.find((f) => f.id === part.troqueladoId) || null : null
        const troqQty = Math.max(1, Math.trunc(parseFloat(String(part.troqueladoQty)) || 0) || 1)
        const troqCost = troq && getGrupo(troq) === "TROQUELADO" ? (Number(troq.valor) || 0) * troqQty : 0

        const corteOpt = part.corteId ? finishes.find((f) => f.id === part.corteId) || null : null
        const corteQtyLocal = Math.max(1, Math.trunc(parseFloat(String(part.corteQty)) || 0) || 1)
        const corteCostLocal = corteOpt && getGrupo(corteOpt) === "CORTE" ? (Number(corteOpt.valor) || 0) * corteQtyLocal : 0

        const qtyForCompute = runQty * Math.max(1, pliegosPorUnidad)
        return computeLitografia({
          cantidad: qtyForCompute,
          colores: tintasLocal,
          desperdicioPct: 0,
          sobranteMinimo: Number.isFinite(sobranteLocal) ? sobranteLocal : (parseFloat(sobranteMinimo) || 0),
          costoPlanchaPorColor: toPerColorCost(((planchaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoTintaPorColor: toPerColorCost(((tintaCostPorColor || 0) * planchasLocal), tintasLocal),
          costoPapelUnidad: 0,
          papelModo: "pliego",
          papelTipo: inferPapelTipo(paper.tipo),
          papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
          papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
          papelFormatoWidthCm: preset.widthCm ?? 0,
          papelFormatoHeightCm: preset.heightCm ?? 0,
          maquinaPliegoWidthCm: Number(planchaProfile?.anchoUtilCm) || 0,
          maquinaPliegoHeightCm: Number(planchaProfile?.altoUtilCm) || 0,
          maquinaSeparacionCm: Math.max(0, Number(planchaProfile?.separacionPiezasCm) || 0),
          costoPliego: paper.costoPliego ?? 0,
          costoCorte: corteCostLocal,
          costoAcabados: finishesCost + specialCost + plastCost + troqCost,
          costoTransporte: 0,
          margenPct: 0,
        })
      }

      const cover = defaults.coverPliegosPorUnidad > 0
        ? computePart(editorialCover, defaults.coverPliegosPorUnidad, defaults.coverPlanchas)
        : null
      const inner = defaults.innerPliegosPorUnidad > 0
        ? computePart(editorialInner, defaults.innerPliegosPorUnidad, defaults.innerPlanchas)
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
      const presetByKey = new Map(sizeOptions.map((s) => [s.key, s] as const))

      const baseNoPaper = computeLitografia({
        cantidad: qtyForCompute,
        colores: tintas,
        desperdicioPct: 0,
        sobranteMinimo: parseFloat(sobranteMinimo) || 0,
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
    tintas,
  ])

  const currentComputed = isAdmin ? calc : fallbackCalc

  const currentImpositionSummary = useMemo(() => {
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
    const machineLabel = primaryPlanchaProfile
      ? `${primaryPlanchaProfile.nombre} (${formatCm(primaryMachineWidth)}×${formatCm(primaryMachineHeight)} cm útiles)`
      : "Máquina no configurada"
    const utilLabel = `${formatCm(currentComputed.pliegoUtilWidthCm)}×${formatCm(currentComputed.pliegoUtilHeightCm)} cm`
    const arrangement = (currentComputed.piezasHorizontal ?? 0) > 0 && (currentComputed.piezasVertical ?? 0) > 0
      ? `${currentComputed.piezasHorizontal} × ${currentComputed.piezasVertical}`
      : null
    const orientation = currentComputed.orientacionImpresion === "girada" ? "girado" : "normal"
    const short = arrangement && (currentComputed.piezasPorPliego ?? 0) > 0
      ? `${primaryPlanchaProfile?.nombre ?? "Máquina"}: ${arrangement} = ${currentComputed.piezasPorPliego} pzas/pliego, ${currentComputed.pliegosNecesarios ?? "—"} pliegos.`
      : `${primaryPlanchaProfile?.nombre ?? "Máquina"}: ${currentComputed.piezasPorPliego ?? "—"} pzas/pliego, ${currentComputed.pliegosNecesarios ?? "—"} pliegos.`
    const detail = [
      `Formato final ${formatoLabel}`,
      `papel ${paperLabel}`,
      `máquina ${machineLabel}`,
      `área útil usada ${utilLabel}`,
      arrangement ? `imposición ${arrangement} (${orientation})` : null,
      `piezas = tiraje ${runQty} + sobrante ${sobrante} = ${piezas}`,
      `pliegos = ⌈${piezas} / ${currentComputed.piezasPorPliego ?? "—"}⌉ = ${currentComputed.pliegosNecesarios ?? "—"}`,
      (currentComputed.maquinaSeparacionCm ?? 0) > 0 ? `separación ${formatCm(currentComputed.maquinaSeparacionCm)} cm` : null,
    ].filter(Boolean).join(" • ")

    return {
      short,
      detail,
      arrangement,
      orientation,
      machineLabel,
      utilLabel,
    }
  }, [
    currentComputed,
    cantidad,
    sobranteMinimo,
    selectedPreset,
    formatoKey,
    primaryPaper,
    primaryPlanchaProfile,
    primaryMachineWidth,
    primaryMachineHeight,
  ])

  const currentImpositionPreview = useMemo(() => {
    if (editorialMode) return null
    if (!currentComputed || currentComputed.papelModo !== "pliego" || !selectedPreset) return null

    const piecesAcross = Math.max(0, Math.trunc(Number(currentComputed.piezasHorizontal) || 0))
    const piecesDown = Math.max(0, Math.trunc(Number(currentComputed.piezasVertical) || 0))
    if (piecesAcross <= 0 || piecesDown <= 0) return null

    const isRotated = currentComputed.orientacionImpresion === "girada"
    const pieceWidthCm = isRotated ? selectedPreset.heightCm : selectedPreset.widthCm
    const pieceHeightCm = isRotated ? selectedPreset.widthCm : selectedPreset.heightCm
    const sheetWidthCm = Number(currentComputed.papelPliegoWidthCm) || 0
    const sheetHeightCm = Number(currentComputed.papelPliegoHeightCm) || 0
    const utilWidthCm = Number(currentComputed.pliegoUtilWidthCm) || sheetWidthCm
    const utilHeightCm = Number(currentComputed.pliegoUtilHeightCm) || sheetHeightCm
    if (sheetWidthCm <= 0 || sheetHeightCm <= 0 || utilWidthCm <= 0 || utilHeightCm <= 0) return null

    const paperLabel = primaryPaper
      ? `${primaryPaper.nombre} ${formatCm(primaryPaper.pliegoWidthCm)}×${formatCm(primaryPaper.pliegoHeightCm)} cm`
      : `Pliego ${formatCm(sheetWidthCm)}×${formatCm(sheetHeightCm)} cm`
    const formatLabel = `${selectedPreset.nombre} ${formatCm(selectedPreset.widthCm)}×${formatCm(selectedPreset.heightCm)} cm`
    const machineLabel = primaryPlanchaProfile
      ? `${primaryPlanchaProfile.nombre} · area util ${formatCm(utilWidthCm)}×${formatCm(utilHeightCm)} cm`
      : `Area util ${formatCm(utilWidthCm)}×${formatCm(utilHeightCm)} cm`

    return {
      sheetWidthCm,
      sheetHeightCm,
      utilWidthCm,
      utilHeightCm,
      pieceWidthCm,
      pieceHeightCm,
      piecesAcross,
      piecesDown,
      gapCm: Number(currentComputed.maquinaSeparacionCm) || 0,
      paperLabel,
      formatLabel,
      machineLabel,
      arrangementLabel: `${piecesAcross} x ${piecesDown}`,
      orientationLabel: isRotated ? "girado" : "normal",
    }
  }, [editorialMode, currentComputed, selectedPreset, primaryPaper, primaryPlanchaProfile])

  const validation = useMemo(() => {
    const qty = Math.trunc(parseFloat(cantidad) || 0)
    const missingCantidad = qty <= 0
    const missingEditorialTemplate = Boolean(editorialMode && !String(selectedEditorialProductoKey || "").trim())
    const coverRequired = Boolean(editorialEnabled && (editorialSplitCalc?.coverPliegosPorUnidad ?? 0) > 0)
    const innerRequired = Boolean(editorialEnabled && (editorialSplitCalc?.innerPliegosPorUnidad ?? 0) > 0)

    const presetByKey = new Map(sizeOptions.map((s) => [s.key, s] as const))
    const coverPreset = coverRequired ? (presetByKey.get(String(editorialCover.formatoKey || "").trim()) || null) : null
    const innerPreset = innerRequired ? (presetByKey.get(String(editorialInner.formatoKey || "").trim()) || null) : null
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
      ? (activePlanchaProfiles.length > 0 && ((coverRequired && !String(editorialCover.planchaProfileId || "").trim()) || (innerRequired && !String(editorialInner.planchaProfileId || "").trim())))
      : (!primaryPlanchaProfileId && activePlanchaProfiles.length > 0)
    const missingTinta = editorialEnabled
      ? (activeTintaProfiles.length > 0 && ((coverRequired && !String(editorialCover.tintaProfileId || "").trim()) || (innerRequired && !String(editorialInner.tintaProfileId || "").trim())))
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
    editorialCover.planchaProfileId,
    editorialInner.planchaProfileId,
    editorialCover.tintaProfileId,
    editorialInner.tintaProfileId,
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
        line1: `Formato final: ${formatoLabel}.`,
        line2: `Operación: piezas = tiraje (${runQty}) + sobrante (${sobrante}) = ${piezas}.`,
        line3: null as string | null,
      }
    }

    const pzasPorPliego = Math.max(0, Math.trunc(Number(computed.piezasPorPliego) || 0))
    const pliegos = Math.max(0, Math.trunc(Number(computed.pliegosNecesarios) || 0))
    const arrangement = (computed.piezasHorizontal ?? 0) > 0 && (computed.piezasVertical ?? 0) > 0
      ? `${computed.piezasHorizontal} × ${computed.piezasVertical}`
      : null
    const orientation = computed.orientacionImpresion === "girada" ? "girado" : "normal"
    const machineLabel = primaryPlanchaProfile
      ? `${primaryPlanchaProfile.nombre} (${formatCm(primaryMachineWidth)}×${formatCm(primaryMachineHeight)} cm útiles)`
      : "sin máquina configurada"
    const utilLabel = `${formatCm(computed.pliegoUtilWidthCm)}×${formatCm(computed.pliegoUtilHeightCm)} cm`

    return {
      line1: `Formato final: ${formatoLabel}. Papel: ${pliegoLabel}.`,
      line2: `Máquina: ${machineLabel}. Área útil usada: ${utilLabel}.${arrangement ? ` Imposición: ${arrangement} (${orientation}) = ${pzasPorPliego} pzas/pliego.` : ` Piezas por pliego: ${pzasPorPliego || "—"}.`}`,
      line3: `Cálculo: piezas = tiraje (${runQty}) + sobrante (${sobrante}) = ${piezas}; pliegos = ⌈${piezas} / ${pzasPorPliego || "—"}⌉ = ${pliegos}.${(computed.maquinaSeparacionCm ?? 0) > 0 ? ` Separación entre piezas: ${formatCm(computed.maquinaSeparacionCm)} cm.` : ""}`,
    }
  }, [isAdmin, calc, fallbackCalc, cantidad, sobranteMinimo, selectedPreset, formatoKey, pliegoW, pliegoH, primaryPaper, primaryPlanchaProfile, primaryMachineWidth, primaryMachineHeight])

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
      } else {
        if (primaryPaper) parts.push(`${t('printshopQuote.desc.paper')} ${primaryPaper.nombre}${primaryPaper.gramaje ? ` ${primaryPaper.gramaje}g` : ""}`)
        if (selectedFinishes.length) parts.push(`${t('printshopQuote.desc.finishes')} ${selectedFinishes.map((f) => f.nombre).join(", ")}`)
        if (selectedPlastificado) parts.push(`${t('printshopQuote.desc.lamination')} ${selectedPlastificado.nombre}`)
        if (selectedTroquelado) parts.push(`${t('printshopQuote.desc.dieCut')} ${selectedTroquelado.nombre}`)
        if (selectedCorte) parts.push(`${t('printshopQuote.desc.cut')} ${selectedCorte.nombre}`)
        if (selectedSpecialFinishNames.length) parts.push(`${t('printshopQuote.desc.specialFinishes')} ${selectedSpecialFinishNames.join(", ")}`)
      }
      if (selectedTransporteKey) {
        const opt = transporteOptions.find((o) => o.value === selectedTransporteKey)
        parts.push(`${t('printshopQuote.desc.transport')} ${opt?.label ?? ""}`.trim())
      }
      if (!editorialEnabled && currentImpositionSummary?.short) parts.push(currentImpositionSummary.short)
      if (qtyShown > 0) parts.push(t('printshopQuote.desc.run', { qty: qtyShown }))
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
      if (currentImpositionSummary?.short) parts.push(currentImpositionSummary.short)
    }

    return parts.join(" • ")
  }, [titulo, isAdmin, selectedPreset, formatoKey, tintas, cantidad, calc, papelTipo, primaryPaper, selectedFinishes, selectedSpecialFinishNames, selectedTransporteKey, selectedPlastificado, selectedTroquelado, selectedCorte, transporteOptions, t, editorialEnabled, editorialOptions, selectedEditorialProductoKey, currentImpositionSummary])


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

      const ignoreNormalExtras = editorialEnabled
      const addFinishesCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : selectedFinishesCost)
      const addSpecialFinishesCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : specialFinishesCost)
      const addPlastificadoCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : plastificadoCostTotal)
      const addTroqueladoCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : troqueladoCostTotal)
      const addCorteCost = ignoreNormalExtras ? 0 : (isAdmin ? 0 : corteCostTotal)

      const meta = buildMeta()
      const baseValue = computed.precioVenta ?? 0
      const subtotalPerItem =
        (baseValue * margenMultiplier) +
        addFinishesCost +
        addSpecialFinishesCost +
        addPlastificadoCost +
        addTroqueladoCost +
        addCorteCost +
        customFieldsTotal
      const subtotal = subtotalPerItem
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
      <DialogContent className="max-w-5xl p-0">
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
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4">
              <Card className={BOX_BLUR}>
                <CardHeader>
                  <CardTitle>{t('printshopQuote.sections.parameters')}</CardTitle>
                  <CardDescription>
                    {isAdmin ? t('printshopQuote.sections.parametersDescAdmin') : t('printshopQuote.sections.parametersDescUser')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <div className="mt-2">
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
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdvanced((v) => !v)}
                    >
                      {showAdvanced ? 'Ocultar opciones avanzadas' : 'Opciones avanzadas'}
                    </Button>
                  </div>

                  {
                    <>
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className={requiredLabelClass(validation.missingCantidad)}>{t('printshopQuote.fields.runQty')}</Label>
                          <Input
                            className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingCantidad)}`}
                            type="number"
                            step="1"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                          />
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
                          {!editorialEnabled ? (
                            (isAdmin ? calc : fallbackCalc) && (isAdmin ? calc : fallbackCalc)!.papelModo === "pliego" ? (
                              <p className={HELP_TEXT}>
                                Papel requerido (pliegos) ≠ tiraje: {(isAdmin ? calc : fallbackCalc)!.pliegosNecesarios ?? "—"} pliegos ({(isAdmin ? calc : fallbackCalc)!.piezasPorPliego ?? "—"} pzas/pliego).
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
                                    Internas: piezas = tiraje ({editorialInnerSheetsPreview.runQty}) × pliegos/unidad ({editorialInnerSheetsPreview.pliegosPorUnidad}) = {editorialInnerSheetsPreview.qtyForCompute}. Pliegos = ⌈(piezas + sobrante {Math.max(0, Math.trunc(editorialInnerSheetsPreview.sobranteFinal || 0))}) / {editorialInnerSheetsPreview.piezasPorPliego ?? "—"}⌉ = {editorialInnerSheetsPreview.pliegosNecesarios ?? "—"}.
                                  </p>
                                ) : null}
                                {editorialCoverSheetsPreview ? (
                                  <p className={HELP_TEXT}>
                                    Portada: piezas = tiraje ({editorialCoverSheetsPreview.runQty}) × pliegos/unidad ({editorialCoverSheetsPreview.pliegosPorUnidad}) = {editorialCoverSheetsPreview.qtyForCompute}. Pliegos = ⌈(piezas + sobrante {Math.max(0, Math.trunc(editorialCoverSheetsPreview.sobranteFinal || 0))}) / {editorialCoverSheetsPreview.piezasPorPliego ?? "—"}⌉ = {editorialCoverSheetsPreview.pliegosNecesarios ?? "—"}.
                                  </p>
                                ) : null}
                                <p className={HELP_TEXT}>
                                  Total pliegos = portada {editorialCoverSheetsPreview?.pliegosNecesarios ?? 0} + internas {editorialInnerSheetsPreview?.pliegosNecesarios ?? 0}.
                                </p>
                              </>
                            ) : null
                          )}
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
                              Prellena planchas/tintas y ajusta el sobrante mínimo recomendado.
                            </p>
                            <p className={HELP_TEXT}>
                              Selección: {inkLabel(printInkFront)} / {inkLabel(printInkBack)}
                            </p>
                            {hasSpecialInk(printInkFront) || hasSpecialInk(printInkBack) ? (
                              <p className={HELP_TEXT}>
                                Si usas tintas especiales (Pantone, Dorado, Blanco, Barniz UV), ajusta manualmente el multiplicador de planchas/tintas si aplica.
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

                      {currentImpositionPreview ? (
                        <div className="sm:col-span-2">
                          <LitografiaImpositionPreview {...currentImpositionPreview} />
                        </div>
                      ) : null}

                      {editorialMode ? (
                        <div className="sm:col-span-2">
                          <Label className={requiredLabelClass(validation.missingEditorialTemplate)}>Libros / Cartillas / Revistas</Label>
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
                          {!editorialOptions.length ? (
                            <p className={HELP_TEXT}>
                              Crea la plantilla en Configuración de Litografía → Dropdowns personalizados → “Crear plantilla Editorial”.
                            </p>
                          ) : null}

                          {editorialEnabled ? (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                              <p className="text-xs text-muted-foreground">
                                Estructura editorial. Abajo configuras costos por Portada e Internas.
                              </p>
                            </div>
                            <div>
                              <Label className={requiredLabelClass(validation.missingFormato)}>{t('printshopQuote.fields.printSize')} (global)</Label>
                              <select
                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                                value={editorialCover.formatoKey}
                                onChange={(e) => {
                                  const next = e.target.value
                                  setEditorialCover((prev) => ({ ...prev, formatoKey: next }))
                                  setEditorialInner((prev) => ({ ...prev, formatoKey: next }))
                                }}
                                disabled={!sizeOptions.length}
                              >
                                <option value="" disabled>
                                  {sizeOptions.length ? t('printshopQuote.select.size') : t('printshopQuote.select.noSizesConfigured')}
                                </option>
                                {sizeOptions.map((p) => (
                                  <option key={p.key} value={p.key}>
                                    {p.nombre} ({p.widthCm}×{p.heightCm} cm)
                                  </option>
                                ))}
                              </select>
                              <p className={HELP_TEXT}>
                                Determina cuántas piezas caben por pliego (imposición) y afecta los pliegos requeridos.
                              </p>
                            </div>

                            {showAdvanced ? (
                              <>
                                <div>
                                  <Label>Páginas por pliego (según tamaño de impresión)</Label>
                                  <Input
                                    className={INPUT_COMPACT}
                                    type="number"
                                    step="1"
                                    min={1}
                                    value={editorialPaginasPorPliego}
                                    onChange={(e) => setEditorialPaginasPorPliego(e.target.value)}
                                  />
                                  <p className={HELP_TEXT}>
                                    Cuántas páginas caben en 1 pliego para ese tamaño (ej. medio pliego ≈ 2, cuarto ≈ 4).
                                  </p>
                                </div>
                                <div className="sm:col-span-2">
                                  <p className="text-xs text-muted-foreground">
                                    Planchas (CMYK): portada <span className="font-medium">{(editorialSplitCalc?.coverPlanchas ?? 0) * 4}</span> • internas <span className="font-medium">{(editorialSplitCalc?.innerPlanchas ?? 0) * 4}</span> • total <span className="font-medium">{((editorialSplitCalc?.coverPlanchas ?? 0) + (editorialSplitCalc?.innerPlanchas ?? 0)) * 4}</span>
                                    {" "}• Pliegos por unidad: portada <span className="font-medium">{editorialSplitCalc?.coverPliegosPorUnidad ?? 0}</span> • internas <span className="font-medium">{editorialSplitCalc?.innerPliegosPorUnidad ?? 0}</span> • total <span className="font-medium">{(editorialSplitCalc?.coverPliegosPorUnidad ?? 0) + (editorialSplitCalc?.innerPliegosPorUnidad ?? 0)}</span>
                                  </p>
                                </div>
                              </>
                            ) : null}

                            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className={`${BOX_BLUR_MUTED} p-3`}>
                                <p className="text-sm font-medium">Portada / Contraportada</p>
                                  <p className={HELP_TEXT}>
                                    {(() => {
                                      const formato = sizeOptions.find((s) => s.key === String(editorialCover.formatoKey || "").trim())
                                      const paper = papers.find((p) => p.id === String(editorialCover.paperId || "").trim())
                                      const pliegos = editorialSplitCalc?.coverPliegosPorUnidad ?? 0
                                      const caras = editorialSplitCalc?.coverPlanchas ?? 0
                                      const formatoLabel = formato ? `${formato.nombre} (${formato.widthCm}×${formato.heightCm} cm)` : "—"
                                      const paperLabel = paper ? `${paper.nombre}${paper.gramaje ? ` ${paper.gramaje}g` : ""}` : "—"
                                      return `Tamaño: ${formatoLabel} • Papel: ${paperLabel} • Planchas CMYK: ${caras * 4} • Pliegos/unidad: ${pliegos}`
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
                                      Prellena planchas/tintas y ajusta el sobrante mínimo recomendado.
                                    </p>
                                    <p className={HELP_TEXT}>
                                      Selección: {inkLabel(editorialCover.printInkFront)} / {inkLabel(editorialCover.printInkBack)}
                                    </p>
                                    {hasSpecialInk(editorialCover.printInkFront) || hasSpecialInk(editorialCover.printInkBack) ? (
                                      <p className={HELP_TEXT}>
                                        Si usas tintas especiales (Pantone, Dorado, Blanco, Barniz UV), ajusta manualmente el multiplicador de planchas/tintas si aplica.
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
                                    <Input
                                      className={INPUT_COMPACT}
                                      type="number"
                                      step="1"
                                      min={0}
                                      value={editorialPaginasPortadaContraportada}
                                      onChange={(e) => setEditorialPaginasPortadaContraportada(e.target.value)}
                                    />
                                    <p className={HELP_TEXT}>
                                      Pliegos/unidad = ⌈páginas / páginasPorPliego⌉.
                                    </p>
                                    {editorialCoverSheetsPreview ? (
                                      <p className={HELP_TEXT}>
                                        Para {editorialCoverSheetsPreview.runQty} unidades: {editorialCoverSheetsPreview.qtyForCompute} piezas → {editorialCoverSheetsPreview.pliegosNecesarios ?? "—"} pliegos ({editorialCoverSheetsPreview.piezasPorPliego ?? "—"} pzas/pliego, sobrante {Math.max(0, Math.trunc(editorialCoverSheetsPreview.sobranteFinal || 0))}).
                                      </p>
                                    ) : null}
                                  </div>

                                  {!showAdvanced ? null : (
                                    <>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className={requiredLabelClass(validation.missingPlancha)}>{t('printshopQuote.fields.platesCost')}</Label>
                                          <select
                                            className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                            value={editorialCover.planchaProfileId}
                                            onChange={(e) => setEditorialCover((prev) => ({ ...prev, planchaProfileId: e.target.value }))}
                                            disabled={!activePlanchaProfiles.length}
                                          >
                                            <option value="">{t('printshopQuote.select.nonePlates')}</option>
                                            {activePlanchaProfiles.map((p) => (
                                              <option key={p.id} value={p.id}>
                                                {p.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            min={1}
                                            step="1"
                                            value={editorialCover.planchaProfileQty}
                                            onChange={(e) => setEditorialCover((prev) => ({ ...prev, planchaProfileQty: e.target.value }))}
                                            placeholder={t('printshopQuote.placeholders.qtyShort')}
                                          />
                                          <p className={HELP_TEXT}>
                                            Multiplica el costo del perfil de planchas (x{Math.max(1, Math.trunc(parseFloat(String(editorialCover.planchaProfileQty || "1")) || 0) || 1)}).
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className={requiredLabelClass(validation.missingTinta)}>{t('printshopQuote.fields.inkCost')}</Label>
                                          <select
                                            className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingTinta)}`}
                                            value={editorialCover.tintaProfileId}
                                            onChange={(e) => setEditorialCover((prev) => ({ ...prev, tintaProfileId: e.target.value }))}
                                            disabled={!activeTintaProfiles.length}
                                          >
                                            <option value="">{t('printshopQuote.select.noneInks')}</option>
                                            {activeTintaProfiles.map((p) => (
                                              <option key={p.id} value={p.id}>
                                                {p.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            min={1}
                                            step="1"
                                            value={editorialCover.tintaProfileQty}
                                            onChange={(e) => setEditorialCover((prev) => ({ ...prev, tintaProfileQty: e.target.value }))}
                                            placeholder={t('printshopQuote.placeholders.qtyShort')}
                                          />
                                          <p className={HELP_TEXT}>
                                            Multiplica el costo del perfil de tinta (x{Math.max(1, Math.trunc(parseFloat(String(editorialCover.tintaProfileQty || "1")) || 0) || 1)}).
                                          </p>
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
                                            <Label>Sobrante mínimo</Label>
                                            <Input
                                              className={INPUT_COMPACT}
                                              type="number"
                                              step="1"
                                              min={0}
                                              value={editorialCover.sobranteMinimo}
                                              onChange={(e) => setEditorialCover((prev) => ({ ...prev, sobranteMinimo: e.target.value }))}
                                            />
                                            <p className={HELP_TEXT}>
                                              Unidades extra para cubrir desperdicio/merma.
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
                                            disabled={!activeFinishes.length}
                                          >
                                            <option value="">Ninguno</option>
                                            {activeFinishes.map((f) => (
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
                                            <Label>Troquelado</Label>
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
                                    const formato = sizeOptions.find((s) => s.key === String(editorialInner.formatoKey || "").trim())
                                    const paper = papers.find((p) => p.id === String(editorialInner.paperId || "").trim())
                                    const pliegos = editorialSplitCalc?.innerPliegosPorUnidad ?? 0
                                    const caras = editorialSplitCalc?.innerPlanchas ?? 0
                                    const formatoLabel = formato ? `${formato.nombre} (${formato.widthCm}×${formato.heightCm} cm)` : "—"
                                    const paperLabel = paper ? `${paper.nombre}${paper.gramaje ? ` ${paper.gramaje}g` : ""}` : "—"
                                    return `Tamaño: ${formatoLabel} • Papel: ${paperLabel} • Planchas CMYK: ${caras * 4} • Pliegos/unidad: ${pliegos}`
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
                                      Prellena planchas/tintas y ajusta el sobrante mínimo recomendado.
                                    </p>
                                    <p className={HELP_TEXT}>
                                      Selección: {inkLabel(editorialInner.printInkFront)} / {inkLabel(editorialInner.printInkBack)}
                                    </p>
                                    {hasSpecialInk(editorialInner.printInkFront) || hasSpecialInk(editorialInner.printInkBack) ? (
                                      <p className={HELP_TEXT}>
                                        Si usas tintas especiales (Pantone, Dorado, Blanco, Barniz UV), ajusta manualmente el multiplicador de planchas/tintas si aplica.
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
                                    <Input
                                      className={INPUT_COMPACT}
                                      type="number"
                                      step="1"
                                      min={1}
                                      value={editorialTotalPaginas}
                                      onChange={(e) => setEditorialTotalPaginas(e.target.value)}
                                    />
                                    <p className={HELP_TEXT}>
                                      Solo internas (sin portada/contraportada). Pliegos/unidad = ⌈páginas / páginasPorPliego⌉.
                                    </p>
                                    {editorialInnerSheetsPreview ? (
                                      <p className={HELP_TEXT}>
                                        Para {editorialInnerSheetsPreview.runQty} unidades: {editorialInnerSheetsPreview.qtyForCompute} piezas → {editorialInnerSheetsPreview.pliegosNecesarios ?? "—"} pliegos ({editorialInnerSheetsPreview.piezasPorPliego ?? "—"} pzas/pliego, sobrante {Math.max(0, Math.trunc(editorialInnerSheetsPreview.sobranteFinal || 0))}).
                                      </p>
                                    ) : null}
                                  </div>

                                  {!showAdvanced ? null : (
                                    <>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className={requiredLabelClass(validation.missingPlancha)}>{t('printshopQuote.fields.platesCost')}</Label>
                                          <select
                                            className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                            value={editorialInner.planchaProfileId}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, planchaProfileId: e.target.value }))}
                                            disabled={!activePlanchaProfiles.length}
                                          >
                                            <option value="">{t('printshopQuote.select.nonePlates')}</option>
                                            {activePlanchaProfiles.map((p) => (
                                              <option key={p.id} value={p.id}>
                                                {p.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            min={1}
                                            step="1"
                                            value={editorialInner.planchaProfileQty}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, planchaProfileQty: e.target.value }))}
                                            placeholder={t('printshopQuote.placeholders.qtyShort')}
                                          />
                                          <p className={HELP_TEXT}>
                                            Multiplica el costo del perfil de planchas (x{Math.max(1, Math.trunc(parseFloat(String(editorialInner.planchaProfileQty || "1")) || 0) || 1)}).
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className={requiredLabelClass(validation.missingTinta)}>{t('printshopQuote.fields.inkCost')}</Label>
                                          <select
                                            className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingTinta)}`}
                                            value={editorialInner.tintaProfileId}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, tintaProfileId: e.target.value }))}
                                            disabled={!activeTintaProfiles.length}
                                          >
                                            <option value="">{t('printshopQuote.select.noneInks')}</option>
                                            {activeTintaProfiles.map((p) => (
                                              <option key={p.id} value={p.id}>
                                                {p.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <Label>Cantidad</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            min={1}
                                            step="1"
                                            value={editorialInner.tintaProfileQty}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, tintaProfileQty: e.target.value }))}
                                            placeholder={t('printshopQuote.placeholders.qtyShort')}
                                          />
                                          <p className={HELP_TEXT}>
                                            Multiplica el costo del perfil de tinta (x{Math.max(1, Math.trunc(parseFloat(String(editorialInner.tintaProfileQty || "1")) || 0) || 1)}).
                                          </p>
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
                                          <Label>Sobrante mínimo</Label>
                                          <Input
                                            className={INPUT_COMPACT}
                                            type="number"
                                            step="1"
                                            min={0}
                                            value={editorialInner.sobranteMinimo}
                                            onChange={(e) => setEditorialInner((prev) => ({ ...prev, sobranteMinimo: e.target.value }))}
                                          />
                                          <p className={HELP_TEXT}>
                                            Unidades extra para cubrir desperdicio/merma.
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
                                          disabled={!activeFinishes.length}
                                        >
                                          <option value="">Ninguno</option>
                                          {activeFinishes.map((f) => (
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
                                          <Label>Troquelado</Label>
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
                          ) : null}
                        </div>
                      ) : null}

                      {!editorialMode ? (
                      <div className="sm:col-span-2">
                        <Label className={requiredLabelClass(validation.missingFormato)}>{t('printshopQuote.fields.printSize')}</Label>
                        <select
                          className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
                          value={formatoKey}
                          onChange={(e) => setFormatoKey(e.target.value)}
                          disabled={!sizeOptions.length}
                        >
                          <option value="" disabled>
                            {sizeOptions.length ? t('printshopQuote.select.size') : t('printshopQuote.select.noSizesConfigured')}
                          </option>
                          {sizeOptions.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.nombre} ({p.widthCm}×{p.heightCm} cm)
                            </option>
                          ))}
                        </select>
                        {!sizeOptions.length ? (
                          <p className={HELP_TEXT}>
                            {t('printshopQuote.help.createSizes')}
                          </p>
                        ) : null}
                        <p className={HELP_TEXT}>
                          Define el tamaño del producto; afecta el cálculo de papel por pliego.
                        </p>
                      </div>
                      ) : null}

                      {!editorialMode && showAdvanced ? (
                      <div className="sm:col-span-2">
                        <Label className={requiredLabelClass(validation.missingPlancha)}>Máquina de impresión / plancha</Label>
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
                              {t('printshopQuote.summary.totalPlates', { total: formatCurrency(planchaCostConfigured) })} Área útil: {formatCm(primaryMachineWidth)}×{formatCm(primaryMachineHeight)} cm{primaryMachineGap > 0 ? ` • separación ${formatCm(primaryMachineGap)} cm` : ""}.
                            </>
                          ) : (
                            <>{t('printshopQuote.help.selectPlates')}</>
                          )}
                        </p>
                        <p className={HELP_TEXT}>
                          La primera fila define la máquina usada para la imposición. Si agregas varias filas, sus costos se suman y cada “Cantidad” multiplica ese perfil.
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
                                            disabled={!sizeOptions.length}
                                          >
                                            {sizeOptions.map((s) => (
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
                                <Button type="button" variant="outline" size="sm" onClick={addPaperRow}>
                                  {t('common.addAnother')}
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
                    </>
                  }
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
                          </div>

                          {currentImpositionSummary ? (
                            <div className={`${BOX_BLUR_MUTED} bg-muted/10 p-3 text-xs text-muted-foreground`}>
                              {currentImpositionSummary.detail}
                            </div>
                          ) : null}

                          <div className="border-t pt-3">
                            {(() => {
                              const extras = customFieldsTotal
                              const baseValue = fallbackCalc.precioVenta || 0
                              const addFinishes = editorialEnabled ? 0 : selectedFinishesCost
                              const addSpecial = editorialEnabled ? 0 : specialFinishesCost
                              const addPlast = editorialEnabled ? 0 : plastificadoCostTotal
                              const addTroq = editorialEnabled ? 0 : troqueladoCostTotal
                              const addCorte = editorialEnabled ? 0 : corteCostTotal
                              const total = (baseValue * margenMultiplier) + addFinishes + addSpecial + addPlast + addTroq + addCorte + extras
                              return (
                                <>
                                  <div className="space-y-1">
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.admin.plate')}</span><span className="font-medium">{formatCurrency(fallbackCalc.plancha || 0)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.admin.ink')}</span><span className="font-medium">{formatCurrency(fallbackCalc.tinta || 0)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.desc.paper')}</span><span className="font-medium">{formatCurrency(fallbackCalc.papel || 0)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t('printshopQuote.breakdown.transport')}</span><span className="font-medium">{formatCurrency(fallbackCalc.transporte || 0)}</span></div>
                                  </div>

                                  <div className="flex justify-between mt-2"><span className="text-muted-foreground">{t('printshopQuote.breakdown.baseEstimated')}</span><span className="font-medium">{formatCurrency(baseValue)}</span></div>
                                  {addFinishes ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.finishes')}</span><span className="font-medium">{formatCurrency(addFinishes)}</span></div> : null}
                                  {addSpecial ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.specialFinishes')}</span><span className="font-medium">{formatCurrency(addSpecial)}</span></div> : null}
                                  {addPlast ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.lamination')}{plastificadoQty > 1 ? ` (x${plastificadoQty})` : ""}</span><span className="font-medium">{formatCurrency(addPlast)}</span></div> : null}
                                  {addTroq ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.dieCut')}{troqueladoQty > 1 ? ` (x${troqueladoQty})` : ""}</span><span className="font-medium">{formatCurrency(addTroq)}</span></div> : null}
                                  {addCorte ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.cut')}{corteQty > 1 ? ` (x${corteQty})` : ""}</span><span className="font-medium">{formatCurrency(addCorte)}</span></div> : null}
                                  {extras ? <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.extraFields')}</span><span className="font-medium">{formatCurrency(extras)}</span></div> : null}
                                  <div className="flex justify-between mt-2"><span className="font-medium">{t('printshopQuote.breakdown.total')}</span><span className="font-bold text-blue-700">{formatCurrency(total)}</span></div>
                                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t('printshopQuote.breakdown.unit')}</span><span className="font-medium">{formatCurrency(total)}</span></div>
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
                                <span>{t('printshopQuote.admin.piecesPerSheet')}</span>
                                <span className="font-medium">{calc.piezasPorPliego ?? "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{t('printshopQuote.admin.sheetsRequired')}</span>
                                <span className="font-medium">{calc.pliegosNecesarios ?? "—"}</span>
                              </div>
                            </div>
                          ) : null}

                          {currentImpositionSummary ? (
                            <div className={`${BOX_BLUR_MUTED} bg-muted/10 p-3 text-xs text-muted-foreground`}>
                              {currentImpositionSummary.detail}
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
                              const baseValue = calc.precioVenta || 0
                              const total = (baseValue * margenMultiplier) + customFieldsTotal
                              return (
                                <>
                                  <div className="flex justify-between">
                                    <span className="font-medium">{t('printshopQuote.admin.salePrice')}</span>
                                    <span className="font-bold text-blue-700">{formatCurrency(total)}</span>
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-muted-foreground">{t('printshopQuote.admin.saleUnitPrice')}</span>
                                    <span className="font-medium">{formatCurrency(total)}</span>
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
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                {t('common.close')}
              </Button>
              <Button
                type="button"
                onClick={handleAddToCotizacion}
                disabled={!canAdd}
              >
                {props.edit?.itemId ? t('printshopQuote.actions.updateItem') : t('printshopQuote.actions.addToQuote')}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
