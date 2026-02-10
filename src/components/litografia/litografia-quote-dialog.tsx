"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import { computeLitografia } from "@/lib/litografia"

type PapelTipo = "bond" | "propalcote" | "periodico" | "otro"

const TRANSPORTE_OPTIONS = [
  { key: "norte", label: "Norte", total: 20000 },
  { key: "sur", label: "Sur", total: 40000 },
  { key: "fuera_bogota", label: "Fuera de Bogotá", total: 60000 },
] as const

type TransporteKey = (typeof TRANSPORTE_OPTIONS)[number]["key"]

const INPUT_COMPACT = "h-7 px-2 text-xs"
const SELECT_COMPACT = "mt-2 h-8 w-full rounded-md border bg-background px-2 text-xs"

type PrintProfile = {
  id: string
  nombre: string
  costoPlanchaPorColor: number
  costoTintaPorColor: number
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

type FlyerRate = {
  id: string
  formatoKey: string
  tintas: 1 | 2 | 4
  tirajeMin: number
  tirajeMax: number
  paperRateId: string | null
  finishOptionId: string | null
  precioTotal: number
  activo: boolean
}

type ApiEnvelope = { ok?: unknown; data?: unknown; error?: unknown }

function asApiEnvelope(value: unknown): ApiEnvelope {
  return value && typeof value === "object" ? (value as ApiEnvelope) : {}
}

function getApiErrorMessage(env: ApiEnvelope, fallback: string) {
  return typeof env.error === "string" ? env.error : fallback
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

function parseCopNumber(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0
  if (/[a-zA-Z]/.test(trimmed)) return 0
  if (!/[0-9]/.test(trimmed)) return 0

  const sign = trimmed.startsWith("-") ? -1 : 1
  const digits = trimmed.replace(/[^0-9]/g, "")
  if (!digits) return 0
  const n = Number(digits)
  if (!Number.isFinite(n)) return 0
  return sign * n
}

type CustomField = { id: string; label: string; value: string }

export type LitografiaMeta = {
  version: 1
  titulo: string
  descripcion: string
  // Utilidad/margen opcional (porcentaje). Se aplica al total del ítem de litografía.
  margenPct?: string
  cantidad: string
  desperdicioPct: string
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
  selectedFinishId: string
  selectedFinishIds?: string[]
  selectedPaperTipo: string
  selectedPaperGramaje: string
  selectedTransporteKey: TransporteKey | ""
  costoCorte: string
  costoAcabados: string
  costoTransporte: string
  customFields: CustomField[]
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

export function LitografiaQuoteDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddItem: (payload: AddLitografiaItemPayload) => void
  edit?: { itemId: string; meta: LitografiaMeta } | null
  onUpdateItem?: (payload: AddLitografiaItemPayload & { itemId: string }) => void
}) {
  const [meLoaded, setMeLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")

  const [cantidad, setCantidad] = useState("1000")
  const [colores, setColores] = useState("4")
  const [desperdicioPct, setDesperdicioPct] = useState("3")

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
  const [selectedPlanchaProfileId, setSelectedPlanchaProfileId] = useState<string>("")
  const [selectedTintaProfileId, setSelectedTintaProfileId] = useState<string>("")
  const [selectedPaperId, setSelectedPaperId] = useState<string>("")
  const [selectedFinishIds, setSelectedFinishIds] = useState<string[]>([""])

  const [selectedPaperTipo, setSelectedPaperTipo] = useState<string>("")
  const [selectedPaperGramaje, setSelectedPaperGramaje] = useState<string>("")

  const [selectedTransporteKey, setSelectedTransporteKey] = useState<TransporteKey | "">("")

  const [costoCorte, setCostoCorte] = useState("0")
  const [costoAcabados, setCostoAcabados] = useState("0")
  const [costoTransporte, setCostoTransporte] = useState("0")

  // Utilidad/Margen opcional (en litografía la utilidad varía)
  const [margenPct, setMargenPct] = useState<string>("")

  // En SGDigital se cotiza siempre en policromía (4).
  const tintas: 1 | 2 | 4 = 4
  const [tarifa, setTarifa] = useState<FlyerRate | null>(null)
  const [tarifaLoading, setTarifaLoading] = useState(false)
  const [tarifaError, setTarifaError] = useState<string | null>(null)

  const [pricingSource, setPricingSource] = useState<"tarifario" | "calculo">("tarifario")

  const [customFields, setCustomFields] = useState<CustomField[]>([])

  const finishIdsNormalized = useMemo(() => {
    const ids = selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean)
    return Array.from(new Set(ids))
  }, [selectedFinishIds])

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

  const customFieldsTotal = useMemo(() => {
    return customFields.reduce((acc, f) => acc + parseCopNumber(f.value), 0)
  }, [customFields])

  const margenMultiplier = useMemo(() => {
    const n = parseFloat(String(margenPct))
    const pct = Number.isFinite(n) ? Math.min(500, Math.max(0, n)) : 0
    return 1 + pct / 100
  }, [margenPct])

  const buildMeta = (): LitografiaMeta => {
    const finishIds = selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean)
    const primaryFinishId = finishIds[0] ?? ""
    return {
      version: 1,
      titulo,
      descripcion,
      margenPct,
      cantidad,
      desperdicioPct,
      pricingSource,
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
      selectedPlanchaProfileId,
      selectedTintaProfileId,
      selectedPaperId,
      selectedFinishId: primaryFinishId,
      selectedFinishIds: finishIds,
      selectedPaperTipo,
      selectedPaperGramaje,
      selectedTransporteKey,
      costoCorte,
      costoAcabados,
      costoTransporte,
      customFields,
    }
  }

  const applyMeta = (meta: LitografiaMeta) => {
    setTitulo(meta.titulo ?? "")
    setDescripcion(meta.descripcion ?? "")
    setMargenPct(meta.margenPct ?? "")
    setCantidad(meta.cantidad ?? "")
    setDesperdicioPct(meta.desperdicioPct ?? "")
    setPricingSource(meta.pricingSource === "calculo" ? "calculo" : "tarifario")
    setFormatoKey(meta.formatoKey ?? "")
    setColores(meta.colores ?? "4")
    setCostoPlanchaPorColor(meta.costoPlanchaPorColor ?? "")
    setCostoTintaPorColor(meta.costoTintaPorColor ?? "")
    setCostoPapelUnidad(meta.costoPapelUnidad ?? "")
    setPapelPorPliego(Boolean(meta.papelPorPliego))
    setPapelTipo((meta.papelTipo as PapelTipo) ?? "propalcote")
    setCostoPliego(meta.costoPliego ?? "")
    setPliegoW(meta.pliegoW ?? "")
    setPliegoH(meta.pliegoH ?? "")
    setSelectedPlanchaProfileId(meta.selectedPlanchaProfileId ?? "")
    setSelectedTintaProfileId(meta.selectedTintaProfileId ?? "")
    setSelectedPaperId(meta.selectedPaperId ?? "")
    const finishIdsRaw = Array.isArray(meta.selectedFinishIds) ? meta.selectedFinishIds : []
    const fromList = finishIdsRaw.map((x) => String(x || "").trim()).filter(Boolean)
    const fromLegacy = String(meta.selectedFinishId ?? "").trim()
    const nextFinishIds = fromList.length ? fromList : (fromLegacy ? [fromLegacy] : [])
    setSelectedFinishIds(nextFinishIds.length ? nextFinishIds : [""])
    setSelectedPaperTipo(meta.selectedPaperTipo ?? "")
    setSelectedPaperGramaje(meta.selectedPaperGramaje ?? "")
    setSelectedTransporteKey((meta.selectedTransporteKey as TransporteKey | "") ?? "")
    setCostoCorte(meta.costoCorte ?? "0")
    setCostoAcabados(meta.costoAcabados ?? "0")
    setCostoTransporte(meta.costoTransporte ?? "0")
    setCustomFields(Array.isArray(meta.customFields) ? meta.customFields : [])
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
  const activeFinishes = useMemo(() => finishes.filter((f) => f.activo), [finishes])

  const selectedPlanchaProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedPlanchaProfileId) || null
  }, [profiles, selectedPlanchaProfileId])

  const selectedTintaProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedTintaProfileId) || null
  }, [profiles, selectedTintaProfileId])

  const selectedPaper = useMemo(() => {
    return papers.find((p) => p.id === selectedPaperId) || null
  }, [papers, selectedPaperId])

  const selectedFinishes = useMemo(() => {
    const wanted = new Set(selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean))
    if (!wanted.size) return [] as FinishOption[]
    return finishes.filter((f) => wanted.has(f.id))
  }, [finishes, selectedFinishIds])

  const selectedFinishesCost = useMemo(() => {
    return selectedFinishes.reduce((acc, f) => acc + (Number(f.valor) || 0), 0)
  }, [selectedFinishes])

  useEffect(() => {
    if (!props.open) return
    if (!selectedPlanchaProfileId && activePlanchaProfiles.length) {
      setSelectedPlanchaProfileId(activePlanchaProfiles[0]!.id)
    }
  }, [props.open, activePlanchaProfiles, selectedPlanchaProfileId])

  useEffect(() => {
    if (!props.open) return
    if (!selectedTintaProfileId && activeTintaProfiles.length) {
      setSelectedTintaProfileId(activeTintaProfiles[0]!.id)
    }
  }, [props.open, activeTintaProfiles, selectedTintaProfileId])

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
    if (!selectedPaperId && activePapers.length) {
      setSelectedPaperId(activePapers[0]!.id)
    }
  }, [props.open, activePapers, selectedPaperId])

  useEffect(() => {
    if (!props.open) return
    if (pricingSource !== "tarifario") return
    const opt = TRANSPORTE_OPTIONS.find((o) => o.key === selectedTransporteKey) || null
    const next = opt ? String(opt.total) : "0"
    if (costoTransporte !== next) setCostoTransporte(next)
  }, [props.open, pricingSource, selectedTransporteKey, costoTransporte])

  useEffect(() => {
    const load = async () => {
      setConfigError(null)
      setTarifaError(null)
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
        setConfigError(e instanceof Error ? e.message : "No se pudieron cargar tarifas")
        setMeLoaded(true)
      }
    }

    if (props.open) void load()
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    if (!meLoaded) return
    if (pricingSource !== "tarifario") return

    const qty = Math.trunc(parseFloat(cantidad) || 0)
    if (qty <= 0) {
      setTarifa(null)
      return
    }

    const controller = new AbortController()
    const run = async () => {
      setTarifaLoading(true)
      setTarifaError(null)
      try {
        const url = new URL("/api/litografia/flyers-tarifas/match", window.location.origin)
        url.searchParams.set("formatoKey", formatoKey)
        url.searchParams.set("tintas", String(tintas))
        url.searchParams.set("cantidad", String(qty))
        if (selectedPaperId) url.searchParams.set("paperRateId", selectedPaperId)
        const finishIds = selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean)
        if (finishIds.length === 1) url.searchParams.set("finishOptionId", finishIds[0]!)

        const res = await fetch(url.toString(), { cache: "no-store", signal: controller.signal })
        const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
        if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo consultar tarifa"))
        const data = (env.data as FlyerRate | null) ?? null
        setTarifa(data)
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        setTarifa(null)
        setTarifaError(e instanceof Error ? e.message : "No se pudo consultar tarifa")
      } finally {
        setTarifaLoading(false)
      }
    }

    void run()
    return () => controller.abort()
  }, [props.open, meLoaded, isAdmin, pricingSource, cantidad, formatoKey, selectedPaperId, selectedFinishIds])

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

    setSelectedPaperTipo(String(paper.tipo || "").trim())
    setSelectedPaperGramaje(paper.gramaje != null ? String(paper.gramaje) : "")

    const t = (paper.tipo || "").toLowerCase()
    if (t.includes("bond")) setPapelTipo("bond")
    else if (t.includes("propal") || t.includes("cote") || t.includes("couche")) setPapelTipo("propalcote")
    else if (t.includes("period")) setPapelTipo("periodico")
    else setPapelTipo("otro")
  }, [papers, selectedPaperId])

  const calc = useMemo(() => {
    if (!isAdmin) return null
    return computeLitografia({
      cantidad: parseFloat(cantidad) || 0,
      colores: parseFloat(colores) || 1,
      desperdicioPct: parseFloat(desperdicioPct) || 0,
      costoPlanchaPorColor: parseFloat(costoPlanchaPorColor) || 0,
      costoTintaPorColor: parseFloat(costoTintaPorColor) || 0,
      costoPapelUnidad: parseFloat(costoPapelUnidad) || 0,
      papelModo: papelPorPliego ? "pliego" : "unidad",
      papelTipo,
      papelPliegoWidthCm: parseFloat(pliegoW) || 0,
      papelPliegoHeightCm: parseFloat(pliegoH) || 0,
      papelFormatoWidthCm: selectedPreset?.widthCm ?? 0,
      papelFormatoHeightCm: selectedPreset?.heightCm ?? 0,
      costoPliego: parseFloat(costoPliego) || 0,
      costoCorte: parseFloat(costoCorte) || 0,
      costoAcabados: parseFloat(costoAcabados) || 0,
      costoTransporte: parseFloat(costoTransporte) || 0,
      margenPct: 0,
    })
  }, [
    isAdmin,
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
    selectedPreset,
    costoCorte,
    costoAcabados,
    costoTransporte,
  ])

  const fallbackCalc = useMemo(() => {
    if (isAdmin) return null
    if (!props.open) return null

    const qty = Math.trunc(parseFloat(cantidad) || 0)
    if (qty <= 0) return null
    if (!selectedPreset) return null

    // Estimación cuando no hay tarifa exacta. Usa costos del perfil y papel seleccionado.
    const desperdicio = parseFloat(desperdicioPct) || 0
    const planchaProfile = selectedPlanchaProfile
    const tintaProfile = selectedTintaProfile
    const paper = selectedPaper
    if (!planchaProfile || !tintaProfile || !paper) return null

    return computeLitografia({
      cantidad: qty,
      colores: tintas,
      desperdicioPct: desperdicio,
      costoPlanchaPorColor: planchaProfile.costoPlanchaPorColor ?? 0,
      costoTintaPorColor: tintaProfile.costoTintaPorColor ?? 0,
      costoPapelUnidad: 0,
      papelModo: "pliego",
      papelTipo,
      papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
      papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
      papelFormatoWidthCm: selectedPreset.widthCm ?? 0,
      papelFormatoHeightCm: selectedPreset.heightCm ?? 0,
      costoPliego: paper.costoPliego ?? 0,
      costoCorte: 0,
      costoAcabados: selectedFinishesCost,
      costoTransporte: parseFloat(costoTransporte) || 0,
      // Margen 0: se deja como estimación base (se puede ajustar en tarifario).
      margenPct: 0,
    })
  }, [
    isAdmin,
    props.open,
    cantidad,
    desperdicioPct,
    papelTipo,
    costoTransporte,
    selectedPreset,
    selectedPlanchaProfile,
    selectedTintaProfile,
    selectedPaper,
    selectedFinishesCost,
  ])

  const canAdd = useMemo(() => {
    if (isAdmin) return Boolean(calc)
    if (tarifaLoading) return false
    return Boolean(tarifa || fallbackCalc)
  }, [isAdmin, calc, tarifaLoading, tarifa, fallbackCalc])

  const defaultDescripcion = useMemo(() => {
    const base = (titulo || (isAdmin ? "Litografía" : "Litografía")).trim() || (isAdmin ? "Litografía" : "Litografía")

    if (!isAdmin) {
      const presetLabel = selectedPreset ? `${selectedPreset.nombre} (${selectedPreset.widthCm}×${selectedPreset.heightCm} cm)` : (formatoKey || "Tamaño")
      const tintasLabel = tintas === 4 ? "Policromía (4)" : `${tintas} tinta${tintas === 1 ? "" : "s"}`
      const qty = Math.trunc(parseFloat(cantidad) || 0)
      const parts = [base, presetLabel, tintasLabel]
      if (selectedPaper) parts.push(`Papel ${selectedPaper.nombre}${selectedPaper.gramaje ? ` ${selectedPaper.gramaje}g` : ""}`)
      if (selectedFinishes.length) parts.push(`Acabados ${selectedFinishes.map((f) => f.nombre).join(", ")}`)
      if (selectedTransporteKey) {
        const opt = TRANSPORTE_OPTIONS.find((o) => o.key === selectedTransporteKey)
        parts.push(`Transporte ${opt?.label ?? ""}`.trim())
      }
      if (qty > 0) parts.push(`Tiraje ${qty}`)
      if (tarifa) parts.push(`Rango ${tarifa.tirajeMin}-${tarifa.tirajeMax}`)
      return parts.join(" • ")
    }

    if (!calc) return base

    const parts = [`${base}`, `${calc.k} colores`, `Tiraje ${Math.round(calc.qty)}`]

    if (calc.papelModo === "pliego") {
      const formatoLabel = selectedPreset ? `${selectedPreset.nombre} (${selectedPreset.widthCm}×${selectedPreset.heightCm} cm)` : "Formato"
      const pl = calc.pliegosNecesarios ?? 0
      const pzas = calc.piezasPorPliego ?? 0
      parts.push(`Papel ${papelTipo}`)
      parts.push(`${formatoLabel}`)
      if (pl > 0 && pzas > 0) parts.push(`Pliegos ${pl} (${pzas} pzas/pliego)`)
    }

    return parts.join(" • ")
  }, [titulo, isAdmin, selectedPreset, formatoKey, tintas, cantidad, tarifa, calc, papelTipo, selectedPaper, selectedFinishes, selectedTransporteKey])

  const buildDescripcion = () => {
    const notas = descripcion.trim()
    const extra = customFields
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label && f.value)

    if (!notas && extra.length === 0) return defaultDescripcion

    const lines = [defaultDescripcion]
    if (notas) lines.push("", "Notas:", notas)
    if (extra.length) lines.push("", "Campos:", ...extra.map((f) => `- ${f.label}: ${f.value}`))
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
    if (!isAdmin || pricingSource === "tarifario") {
      const qty = Math.trunc(parseFloat(cantidad) || 0)
      if (qty <= 0) {
        setTarifaError("Cantidad inválida")
        return
      }
      const transporte = parseFloat(costoTransporte) || 0
      const base = tarifa ? Number(tarifa.precioTotal) || 0 : 0
      const estimated = !tarifa ? fallbackCalc : null
      if (!tarifa && !estimated) {
        setTarifaError("No hay tarifa configurada para estas opciones")
        return
      }

      const finishIds = selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean)
      const finishesCost = selectedFinishesCost
      const addFinishesCost = tarifa && tarifa.finishOptionId && finishIds.length === 1 && tarifa.finishOptionId === finishIds[0] ? 0 : finishesCost

      const meta = buildMeta()
      const baseValue = tarifa ? base : (estimated?.precioVenta ?? 0)
      const subtotal = (baseValue * margenMultiplier) + (tarifa ? (transporte + addFinishesCost) : addFinishesCost) + customFieldsTotal
      const payload: AddLitografiaItemPayload = {
        descripcion: buildDescripcion(),
        cantidad: qty,
        unidad: "unidad",
        desperdicioPct: tarifa ? 0 : (estimated?.waste ?? 0),
        precioUnitario: subtotal / qty,
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

    if (!calc) return

    const qty = Math.max(1, Math.trunc(calc.qty || 0))
  const baseValue = calc.precioVenta || 0
  const subtotal = (baseValue * margenMultiplier) + customFieldsTotal

    const meta = buildMeta()
    const payload: AddLitografiaItemPayload = {
      descripcion: buildDescripcion(),
      cantidad: calc.qty,
      unidad: "unidad",
      desperdicioPct: calc.waste,
      precioUnitario: subtotal / qty,
      subtotal,
      meta,
    }

    if (props.edit?.itemId && props.onUpdateItem) {
      props.onUpdateItem({ ...payload, itemId: props.edit.itemId })
    } else {
      props.onAddItem(payload)
    }
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-5xl p-0">
        <div className="flex flex-col max-h-[90vh]">
          <div className="p-6 pb-3">
            <DialogHeader>
              <DialogTitle>Cotización Litografía</DialogTitle>
              <DialogDescription>
                {isAdmin
                  ? "Calcula y agrega el resultado como ítem a la cotización actual."
                  : "Selecciona formato, tintas y tiraje. El precio se toma del tarifario por rango."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Parámetros</CardTitle>
                  <CardDescription>
                    {isAdmin ? "Ajusta valores para el cálculo." : "Usuario estándar: no edita costos."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label>Nombre/Referencia</Label>
                    <Input
                      className={INPUT_COMPACT}
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ej: Flyers A5"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Utilidad / Margen (%) (opcional)</Label>
                    <Input
                      className={INPUT_COMPACT}
                      type="number"
                      min={0}
                      max={500}
                      step="1"
                      value={margenPct}
                      onChange={(e) => setMargenPct(e.target.value)}
                      placeholder="0"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Se aplica al total del ítem de litografía. 0 = sin utilidad adicional.</p>
                  </div>

                  {isAdmin ? (
                    <div className="sm:col-span-2">
                      <Label>Fuente de precio</Label>
                      <select
                        className={SELECT_COMPACT}
                        value={pricingSource}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === "tarifario" || v === "calculo") setPricingSource(v)
                        }}
                      >
                        <option value="tarifario">Tarifario (por rango)</option>
                        <option value="calculo">Cálculo (aprox.)</option>
                      </select>
                    </div>
                  ) : null}

                  {!isAdmin || pricingSource === "tarifario" ? (
                    <>
                      <div>
                        <Label>Cantidad (tiraje)</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={cantidad}
                          onChange={(e) => setCantidad(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Tamaño de impresión</Label>
                        <select
                          className={SELECT_COMPACT}
                          value={formatoKey}
                          onChange={(e) => setFormatoKey(e.target.value)}
                          disabled={!sizeOptions.length}
                        >
                          <option value="" disabled>
                            {sizeOptions.length ? "Selecciona un tamaño" : "Sin tamaños configurados"}
                          </option>
                          {sizeOptions.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.nombre} ({p.widthCm}×{p.heightCm} cm)
                            </option>
                          ))}
                        </select>
                        {!sizeOptions.length ? (
                          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                            Crea tamaños en Configuración &gt; Tamaños de impresión para poder cotizar.
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <Label>Planchas (costo)</Label>
                        <select
                          className={SELECT_COMPACT}
                          value={selectedPlanchaProfileId}
                          onChange={(e) => setSelectedPlanchaProfileId(e.target.value)}
                          disabled={!activePlanchaProfiles.length}
                        >
                          {activePlanchaProfiles.length ? (
                            activePlanchaProfiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))
                          ) : (
                            <option value="">Sin perfiles</option>
                          )}
                        </select>
                        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                          {selectedPlanchaProfile ? (
                            <>Plancha/Color: {formatCurrency(selectedPlanchaProfile.costoPlanchaPorColor)}</>
                          ) : (
                            <>Selecciona planchas.</>
                          )}
                        </p>
                      </div>

                      <div>
                        <Label>Tinta (costo)</Label>
                        <select
                          className={SELECT_COMPACT}
                          value={selectedTintaProfileId}
                          onChange={(e) => setSelectedTintaProfileId(e.target.value)}
                          disabled={!activeTintaProfiles.length}
                        >
                          {activeTintaProfiles.length ? (
                            activeTintaProfiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))
                          ) : (
                            <option value="">Sin perfiles</option>
                          )}
                        </select>
                        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                          {selectedTintaProfile ? (
                            <>Tinta/Color: {formatCurrency(selectedTintaProfile.costoTintaPorColor)}</>
                          ) : (
                            <>Selecciona tintas.</>
                          )}
                        </p>
                      </div>

                        <div>
                          <Label>Papel</Label>
                          <select
                            className={SELECT_COMPACT}
                            value={selectedPaperId}
                            onChange={(e) => setSelectedPaperId(e.target.value)}
                            disabled={!activePapers.length}
                          >
                            {activePapers.length ? (
                              activePapers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre}{p.gramaje ? ` • ${p.gramaje}g` : ""} • {formatCurrency(p.costoPliego)}/pliego
                                </option>
                              ))
                            ) : (
                              <option value="">Sin papeles</option>
                            )}
                          </select>
                          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                            {selectedPaper ? (
                              <>Pliego: {selectedPaper.pliegoWidthCm}×{selectedPaper.pliegoHeightCm} cm</>
                            ) : (
                              <>Selecciona un papel.</>
                            )}
                          </p>
                        </div>

                        <div>
                          <Label>Acabados</Label>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] leading-tight text-muted-foreground">Puedes agregar más de un acabado.</span>
                            <Button type="button" variant="outline" size="sm" onClick={addFinishRow}>
                              Agregar
                            </Button>
                          </div>
                          <div className="mt-2 space-y-2">
                            {selectedFinishIds.map((id, idx) => (
                              <div key={`${idx}-${id}`} className="flex items-center gap-2">
                                <select
                                  className={SELECT_COMPACT}
                                  value={id}
                                  onChange={(e) => updateFinishRow(idx, e.target.value)}
                                >
                                  <option value="">Sin acabado</option>
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
                                    Quitar
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                            {finishIdsNormalized.length
                              ? <>Seleccionados: {selectedFinishes.map((f) => f.nombre).join(", ")}</>
                              : <>Ej: troquel.</>}
                          </p>
                        </div>

                      <div className="sm:col-span-2">
                        <Label>Transporte</Label>
                        <select className={SELECT_COMPACT} value={selectedTransporteKey} onChange={(e) => setSelectedTransporteKey(e.target.value as TransporteKey | "")}>
                          <option value="">Sin transporte</option>
                          {TRANSPORTE_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label} • {formatCurrency(o.total)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">Opcional. Se suma como valor fijo al total.</p>
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

                      <div className="sm:col-span-2">
                        {tarifaError ? <p className="text-sm text-red-600">{tarifaError}</p> : null}
                        {!tarifaError && configError ? <p className="text-sm text-red-600">{configError}</p> : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>Cantidad (tiraje)</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={cantidad}
                          onChange={(e) => setCantidad(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Número de colores</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={colores}
                          onChange={(e) => setColores(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Desperdicio (%)</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="0.1"
                          value={desperdicioPct}
                          onChange={(e) => setDesperdicioPct(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Plancha por color</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={costoPlanchaPorColor}
                          onChange={(e) => setCostoPlanchaPorColor(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Tinta por color</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={costoTintaPorColor}
                          onChange={(e) => setCostoTintaPorColor(e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-1">
                        <Label>Planchas (auto)</Label>
                        <select
                          className={SELECT_COMPACT}
                          value={selectedPlanchaProfileId}
                          onChange={(e) => setSelectedPlanchaProfileId(e.target.value)}
                        >
                          <option value="">(Manual)</option>
                          {activePlanchaProfiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                        {configError ? <p className="mt-1 text-xs text-red-600">{configError}</p> : null}
                      </div>

                      <div className="sm:col-span-2 lg:col-span-1">
                        <Label>Tintas (auto)</Label>
                        <select
                          className={SELECT_COMPACT}
                          value={selectedTintaProfileId}
                          onChange={(e) => setSelectedTintaProfileId(e.target.value)}
                        >
                          <option value="">(Manual)</option>
                          {activeTintaProfiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-4">
                        <Label>Papel</Label>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            id="papel-por-pliego-dialog"
                            type="checkbox"
                            checked={papelPorPliego}
                            onChange={(e) => setPapelPorPliego(e.target.checked)}
                          />
                          <label htmlFor="papel-por-pliego-dialog" className="text-sm text-muted-foreground">
                            Calcular por pliego (imposición)
                          </label>
                        </div>
                      </div>

                      {papelPorPliego ? (
                        <>
                          <div>
                            <Label>Tipo de papel</Label>
                            <select
                              className={SELECT_COMPACT}
                              value={papelTipo}
                              onChange={(e) => {
                                const next = e.target.value as PapelTipo
                                setPapelTipo(next)
                                const nextDefault = getDefaultCostoPliego(next)
                                if (nextDefault > 0) setCostoPliego(String(nextDefault))
                              }}
                            >
                              <option value="propalcote">Propalcote</option>
                              <option value="bond">Bond</option>
                              <option value="periodico">Periódico</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>

                          <div>
                            <Label>Costo por pliego</Label>
                            <Input
                              className={INPUT_COMPACT}
                              type="number"
                              step="1"
                              value={costoPliego}
                              onChange={(e) => setCostoPliego(e.target.value)}
                            />
                          </div>

                          <div>
                            <Label>Pliego (ancho cm)</Label>
                            <Input
                              className={INPUT_COMPACT}
                              type="number"
                              step="0.1"
                              value={pliegoW}
                              onChange={(e) => setPliegoW(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Pliego (alto cm)</Label>
                            <Input
                              className={INPUT_COMPACT}
                              type="number"
                              step="0.1"
                              value={pliegoH}
                              onChange={(e) => setPliegoH(e.target.value)}
                            />
                          </div>

                          <div className="sm:col-span-2 lg:col-span-2">
                            <Label>Formato final</Label>
                            <select
                              className={SELECT_COMPACT}
                              value={formatoKey}
                              onChange={(e) => setFormatoKey(e.target.value)}
                              disabled={!sizeOptions.length}
                            >
                              <option value="" disabled>
                                {sizeOptions.length ? "Selecciona un tamaño" : "Sin tamaños configurados"}
                              </option>
                              {sizeOptions.map((p) => (
                                <option key={p.key} value={p.key}>
                                  {p.nombre} ({p.widthCm}×{p.heightCm} cm)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2 lg:col-span-2">
                            <Label>Papel (auto)</Label>
                            <select
                              className={SELECT_COMPACT}
                              value={selectedPaperId}
                              onChange={(e) => setSelectedPaperId(e.target.value)}
                            >
                              <option value="">(Manual)</option>
                              {activePapers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : (
                        <div>
                          <Label>Papel por unidad</Label>
                          <Input
                            className={INPUT_COMPACT}
                            type="number"
                            step="0.01"
                            value={costoPapelUnidad}
                            onChange={(e) => setCostoPapelUnidad(e.target.value)}
                          />
                        </div>
                      )}

                      <div>
                        <Label>Corte (total)</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={costoCorte}
                          onChange={(e) => setCostoCorte(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Acabados (total)</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={costoAcabados}
                          onChange={(e) => setCostoAcabados(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Transporte (total)</Label>
                        <Input
                          className={INPUT_COMPACT}
                          type="number"
                          step="1"
                          value={costoTransporte}
                          onChange={(e) => setCostoTransporte(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Resultado</CardTitle>
                    <CardDescription>
                      {isAdmin
                        ? "Desglose de costos (aprox.)."
                        : tarifa
                          ? "Precio desde tarifario."
                          : fallbackCalc
                            ? "Sin tarifa exacta. Se usa cálculo estimado."
                            : "Precio desde tarifario."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!isAdmin ? (
                      <>
                        {tarifaLoading ? <p className="text-sm text-muted-foreground">Consultando tarifa…</p> : null}
                        {!tarifaLoading && !tarifa && !fallbackCalc ? (
                          <p className="text-sm text-muted-foreground">No hay tarifa para estas opciones.</p>
                        ) : null}

                        {tarifa ? (
                          <>
                            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                              <div className="flex justify-between">
                                <span>Rango aplicable</span>
                                <span className="font-medium">
                                  {tarifa.tirajeMin}–{tarifa.tirajeMax}
                                </span>
                              </div>
                            </div>

                            {(() => {
                              const wantsFinish = finishIdsNormalized.length > 0
                              const usedGenericFinish = wantsFinish && tarifa.finishOptionId == null
                              const usedGenericPaper = Boolean(selectedPaperId) && tarifa.paperRateId == null
                              if (!usedGenericFinish && !usedGenericPaper) return null
                              return (
                                <p className="text-xs text-amber-700">
                                  Usando tarifa genérica ({usedGenericPaper ? "sin papel específico" : null}{usedGenericPaper && usedGenericFinish ? ", " : null}{usedGenericFinish ? "sin acabado específico" : null}). Para que troquel/papel cambien el precio, configura una tarifa exacta.
                                </p>
                              )
                            })()}

                            <div className="border-t pt-3">
                              {(() => {
                                const base = tarifa.precioTotal || 0
                                const transporte = parseFloat(costoTransporte) || 0
                                const extras = customFieldsTotal
                                const addFinishesCost =
                                  tarifa.finishOptionId && finishIdsNormalized.length === 1 && tarifa.finishOptionId === finishIdsNormalized[0]
                                    ? 0
                                    : selectedFinishesCost
                                const total = (base * margenMultiplier) + transporte + addFinishesCost + extras
                                const qty = Math.max(1, Math.trunc(parseFloat(cantidad) || 1))
                                return (
                                  <>
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base (tarifario)</span><span className="font-medium">{formatCurrency(base)}</span></div>
                                    <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Transporte</span><span className="font-medium">{formatCurrency(transporte)}</span></div>
                                      {addFinishesCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Acabados</span><span className="font-medium">{formatCurrency(addFinishesCost)}</span></div> : null}
                                    {extras ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Campos extra</span><span className="font-medium">{formatCurrency(extras)}</span></div> : null}
                                    <div className="flex justify-between mt-2"><span className="font-medium">Total</span><span className="font-bold text-blue-700">{formatCurrency(total)}</span></div>
                                    <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Unitario</span><span className="font-medium">{formatCurrency(total / qty)}</span></div>
                                  </>
                                )
                              })()}
                            </div>
                          </>
                        ) : fallbackCalc ? (
                          <>
                            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                              <div className="flex justify-between">
                                <span>Modo</span>
                                <span className="font-medium">Estimado</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Pliegos</span>
                                <span className="font-medium">{fallbackCalc.pliegosNecesarios ?? "—"}</span>
                              </div>
                            </div>

                            <div className="border-t pt-3">
                              {(() => {
                                const extras = customFieldsTotal
                                const baseValue = fallbackCalc.precioVenta || 0
                                const total = (baseValue * margenMultiplier) + extras
                                const qty = Math.max(1, Math.trunc(parseFloat(cantidad) || 1))
                                return (
                                  <>
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total (estimado)</span><span className="font-medium">{formatCurrency(total)}</span></div>
                                    {extras ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Campos extra</span><span className="font-medium">{formatCurrency(extras)}</span></div> : null}
                                    <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Unitario</span><span className="font-medium">{formatCurrency(total / qty)}</span></div>
                                    <p className="mt-2 text-[10px] leading-tight text-amber-700">
                                      No existe tarifa exacta para esta combinación. Configura el tarifario para que el precio sea el oficial.
                                    </p>
                                  </>
                                )
                              })()}
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : calc ? (
                      <>
                        {calc.papelModo === "pliego" && (
                          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Tiraje con desperdicio</span>
                              <span className="font-medium">{Math.ceil(calc.qtyConDesperdicio)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Piezas por pliego</span>
                              <span className="font-medium">{calc.piezasPorPliego ?? "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Pliegos requeridos</span>
                              <span className="font-medium">{calc.pliegosNecesarios ?? "—"}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Plancha</span>
                          <span className="font-medium">{formatCurrency(calc.plancha)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tinta</span>
                          <span className="font-medium">{formatCurrency(calc.tinta)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Papel</span>
                          <span className="font-medium">{formatCurrency(calc.papel)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Corte</span>
                          <span className="font-medium">{formatCurrency(calc.corte)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Acabados</span>
                          <span className="font-medium">{formatCurrency(calc.acabados)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Transporte</span>
                          <span className="font-medium">{formatCurrency(calc.transporte)}</span>
                        </div>

                        <div className="border-t pt-3">
                          <div className="flex justify-between">
                            <span className="font-medium">Costo producción</span>
                            <span className="font-bold">{formatCurrency(calc.costoProduccion)}</span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Costo unitario</span>
                            <span className="font-medium">{formatCurrency(calc.costoUnitario)}</span>
                          </div>
                        </div>

                        <div className="border-t pt-3">
                          <div className="flex justify-between">
                            <span className="font-medium">Precio venta</span>
                            <span className="font-bold text-blue-700">{formatCurrency(((calc.precioVenta || 0) * margenMultiplier) + customFieldsTotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Precio unitario</span>
                            <span className="font-medium">{formatCurrency((((calc.precioVenta || 0) * margenMultiplier) + customFieldsTotal) / Math.max(1, Math.trunc(calc.qty || 0)))}</span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">Nota: valores sin impuestos; usa como guía rápida.</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Completa los parámetros para calcular.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Campos personalizados</CardTitle>
                        <CardDescription>Se anexan a la descripción del ítem. Si el valor es numérico, se suma al total.</CardDescription>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                        Agregar campo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {customFields.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay campos extra.</p>
                    ) : (
                      customFields.map((f) => (
                        <div key={f.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                          <div className="md:col-span-2">
                            <Label className="text-xs">Etiqueta</Label>
                            <Input
                              className={INPUT_COMPACT}
                              value={f.label}
                              onChange={(e) => updateCustomField(f.id, { label: e.target.value })}
                              placeholder="Ej: Tamaño"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-xs">Valor</Label>
                            <Input
                              className={INPUT_COMPACT}
                              value={f.value}
                              onChange={(e) => updateCustomField(f.id, { value: e.target.value })}
                              placeholder="Ej: A5"
                            />
                          </div>
                          <div className="md:col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => removeCustomField(f.id)}
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}

                    <div className="pt-2">
                      <Label className="text-xs">Preview descripción</Label>
                      <pre className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
                        {buildDescripcion()}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="border-t bg-background p-4">
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                Cerrar
              </Button>
              <Button
                type="button"
                onClick={handleAddToCotizacion}
                disabled={!canAdd}
              >
                {props.edit?.itemId ? "Actualizar item" : "Agregar a cotización"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
