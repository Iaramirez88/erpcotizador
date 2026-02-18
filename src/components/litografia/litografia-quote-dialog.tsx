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
  grupo?: "ACABADO" | "PLASTIFICADO" | "TROQUELADO" | "CORTE"
  especial?: boolean
  valor: number
  activo: boolean
}

type SpecialFinishRow = {
  finishId: string
  qty: string
}

type PaperRow = {
  paperId: string
  qty: string
  formatoKey?: string
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
  // Unidades extra mínimas (además del % de desperdicio)
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
  selectedTintaProfileIds?: string[]
  selectedPaperIds?: string[]
  paperItems?: Array<{ paperId: string; qty: string; formatoKey?: string }>
  selectedFinishId: string
  selectedFinishIds?: string[]
  specialFinishItems?: Array<{ finishId: string; qty: string }>
  selectedPlastificadoId?: string
  selectedTroqueladoId?: string
  selectedCorteId?: string
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
  const [colores, setColores] = useState("1")
  const [desperdicioPct, setDesperdicioPct] = useState("3")
  const [sobranteMinimo, setSobranteMinimo] = useState("100")

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
  const [selectedTintaProfileIds, setSelectedTintaProfileIds] = useState<string[]>([""])
  const [paperRows, setPaperRows] = useState<PaperRow[]>([{ paperId: "", qty: "", formatoKey: "" }])
  const [selectedFinishIds, setSelectedFinishIds] = useState<string[]>([""])
  const [specialFinishRows, setSpecialFinishRows] = useState<SpecialFinishRow[]>([{ finishId: "", qty: "1" }])

  const [selectedPlastificadoId, setSelectedPlastificadoId] = useState<string>("")
  const [selectedTroqueladoId, setSelectedTroqueladoId] = useState<string>("")
  const [selectedCorteId, setSelectedCorteId] = useState<string>("")

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

  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const [customFields, setCustomFields] = useState<CustomField[]>([])

  const planchaIdsNormalized = useMemo(() => {
    const ids = selectedPlanchaProfileIds.map((x) => String(x || "").trim()).filter(Boolean)
    return Array.from(new Set(ids))
  }, [selectedPlanchaProfileIds])
  const tintaIdsNormalized = useMemo(() => {
    const ids = selectedTintaProfileIds.map((x) => String(x || "").trim()).filter(Boolean)
    return Array.from(new Set(ids))
  }, [selectedTintaProfileIds])

  const primaryPlanchaProfileId = planchaIdsNormalized[0] ?? ""
  const primaryTintaProfileId = tintaIdsNormalized[0] ?? ""
  const primaryPaperId = String(paperRows[0]?.paperId ?? "").trim()

  const finishIdsNormalized = useMemo(() => {
    const ids = selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean)
    return Array.from(new Set(ids))
  }, [selectedFinishIds])

  const addPlanchaRow = () => setSelectedPlanchaProfileIds((prev) => [...prev, ""])
  const removePlanchaRow = (index: number) => {
    setSelectedPlanchaProfileIds((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [""]
    })
  }
  const updatePlanchaRow = (index: number, value: string) => {
    setSelectedPlanchaProfileIds((prev) => {
      const normalized = String(value || "").trim()
      if (normalized) {
        const alreadyUsed = prev.some((v, i) => i !== index && String(v || "").trim() === normalized)
        if (alreadyUsed) return prev
      }
      const next = [...prev]
      next[index] = normalized
      if (!next.length) return [""]
      return next
    })
  }

  const addTintaRow = () => setSelectedTintaProfileIds((prev) => [...prev, ""])
  const removeTintaRow = (index: number) => {
    setSelectedTintaProfileIds((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [""]
    })
  }
  const updateTintaRow = (index: number, value: string) => {
    setSelectedTintaProfileIds((prev) => {
      const normalized = String(value || "").trim()
      if (normalized) {
        const alreadyUsed = prev.some((v, i) => i !== index && String(v || "").trim() === normalized)
        if (alreadyUsed) return prev
      }
      const next = [...prev]
      next[index] = normalized
      if (!next.length) return [""]
      return next
    })
  }

  const addPaperRow = () => setPaperRows((prev) => [...prev, { paperId: "", qty: "", formatoKey }])
  const removePaperRow = (index: number) => {
    setPaperRows((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [{ paperId: "", qty: "", formatoKey: "" }]
    })
  }
  const updatePaperRow = (index: number, paperId: string) => {
    setPaperRows((prev) => {
      const normalized = String(paperId || "").trim()
      if (normalized) {
        const alreadyUsed = prev.some((row, i) => i !== index && String(row.paperId || "").trim() === normalized)
        if (alreadyUsed) return prev
      }
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
      if (normalized) {
        const alreadyUsedElsewhere = prev.some((row, i) => i !== index && String(row.finishId || "").trim() === normalized)
        if (alreadyUsedElsewhere) return prev
      }
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
    const pct = Number.isFinite(n) ? Math.min(500, Math.max(0, n)) : 0
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
    return {
      version: 1,
      titulo,
      descripcion,
      margenPct,
      cantidad,
      desperdicioPct,
      sobranteMinimo,
      pricingSource: "tarifario",
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
      selectedTintaProfileIds,
      selectedPaperIds,
      paperItems,
      selectedFinishId: primaryFinishId,
      selectedFinishIds: finishIds,
      specialFinishItems,
      selectedPlastificadoId,
      selectedTroqueladoId,
      selectedCorteId,
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
    setSobranteMinimo(meta.sobranteMinimo ?? "100")
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

    const nextPlanchas = planchaIds.map((x) => String(x || "").trim()).filter(Boolean)
    const nextTintas = tintaIds.map((x) => String(x || "").trim()).filter(Boolean)
    setSelectedPlanchaProfileIds(nextPlanchas.length ? nextPlanchas : (planchaLegacy ? [planchaLegacy] : [""]))
    setSelectedTintaProfileIds(nextTintas.length ? nextTintas : (tintaLegacy ? [tintaLegacy] : [""]))

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
    setPaperRows(finalRows.length ? finalRows : [{ paperId: "", qty: "", formatoKey: "" }])
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
    setSelectedTransporteKey((meta.selectedTransporteKey as TransporteKey | "") ?? "")
    setSelectedPlastificadoId(meta.selectedPlastificadoId ?? "")
    setSelectedTroqueladoId(meta.selectedTroqueladoId ?? "")
    setSelectedCorteId(meta.selectedCorteId ?? "")
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

  const plastificadoCost = Number(selectedPlastificado?.valor) || 0
  const troqueladoCost = Number(selectedTroquelado?.valor) || 0
  const corteCost = Number(selectedCorte?.valor) || 0

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

  const planchaCostConfigured = useMemo(() => {
    return selectedPlanchaProfiles.reduce((acc, p) => acc + (Number(p.costoPlanchaPorColor) || 0), 0)
  }, [selectedPlanchaProfiles])
  const tintaCostConfigured = useMemo(() => {
    return selectedTintaProfiles.reduce((acc, p) => acc + (Number(p.costoTintaPorColor) || 0), 0)
  }, [selectedTintaProfiles])

  const selectedFinishes = useMemo(() => {
    const wanted = new Set(selectedFinishIds.map((x) => String(x || "").trim()).filter(Boolean))
    if (!wanted.size) return [] as FinishOption[]
    return finishes.filter((f) => !f.especial && wanted.has(f.id))
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
    }
  }, [props.open, activePlanchaProfiles, primaryPlanchaProfileId])

  useEffect(() => {
    if (!props.open) return
    if (!primaryTintaProfileId && activeTintaProfiles.length) {
      setSelectedTintaProfileIds([activeTintaProfiles[0]!.id])
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
      setPaperRows([{ paperId: activePapers[0]!.id, qty: "", formatoKey: "" }])
    }
  }, [props.open, activePapers, primaryPaperId])

  useEffect(() => {
    if (!props.open) return
    const opt = TRANSPORTE_OPTIONS.find((o) => o.key === selectedTransporteKey) || null
    const next = opt ? String(opt.total) : "0"
    if (costoTransporte !== next) setCostoTransporte(next)
  }, [props.open, selectedTransporteKey, costoTransporte])

  useEffect(() => {
    const load = async () => {
      setConfigError(null)
      setTarifaError(null)
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
        setConfigError(e instanceof Error ? e.message : "No se pudieron cargar tarifas")
        setMeLoaded(true)
      }
    }

    if (props.open) void load()
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    if (!meLoaded) return

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
        if (primaryPaperId) url.searchParams.set("paperRateId", primaryPaperId)
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
  }, [props.open, meLoaded, isAdmin, cantidad, formatoKey, primaryPaperId, selectedFinishIds])

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

  const calc = useMemo(() => {
    if (!isAdmin) return null
    const qtyBase = parseFloat(cantidad) || 0
    const desperdicio = parseFloat(desperdicioPct) || 0
    const sobrante = parseFloat(sobranteMinimo) || 0

    const base = computeLitografia({
      cantidad: qtyBase,
      colores: 1,
      desperdicioPct: desperdicio,
      sobranteMinimo: sobrante,
      costoPlanchaPorColor: planchaCostConfigured,
      costoTintaPorColor: tintaCostConfigured,
      costoPapelUnidad: parseFloat(costoPapelUnidad) || 0,
      papelModo: papelPorPliego ? "pliego" : "unidad",
      papelTipo,
      papelPliegoWidthCm: parseFloat(pliegoW) || 0,
      papelPliegoHeightCm: parseFloat(pliegoH) || 0,
      papelFormatoWidthCm: selectedPreset?.widthCm ?? 0,
      papelFormatoHeightCm: selectedPreset?.heightCm ?? 0,
      costoPliego: parseFloat(costoPliego) || 0,
      costoCorte: parseFloat(costoCorte) || 0,
      costoAcabados: (parseFloat(costoAcabados) || 0) + selectedFinishesCost + specialFinishesCost,
      costoTransporte: parseFloat(costoTransporte) || 0,
      margenPct: 0,
    })

    if (papelPorPliego && selectedPreset) {
      const byPaperId = new Map(papers.map((p) => [p.id, p] as const))
      const presetByKey = new Map(sizeOptions.map((s) => [s.key, s] as const))

      const baseNoPaper = computeLitografia({
        cantidad: qtyBase,
        colores: 1,
        desperdicioPct: desperdicio,
        sobranteMinimo: sobrante,
        costoPlanchaPorColor: planchaCostConfigured,
        costoTintaPorColor: tintaCostConfigured,
        costoPapelUnidad: 0,
        papelModo: "pliego",
        papelTipo,
        papelPliegoWidthCm: (primaryPaper?.pliegoWidthCm ?? parseFloat(pliegoW)) || 0,
        papelPliegoHeightCm: (primaryPaper?.pliegoHeightCm ?? parseFloat(pliegoH)) || 0,
        papelFormatoWidthCm: selectedPreset.widthCm ?? 0,
        papelFormatoHeightCm: selectedPreset.heightCm ?? 0,
        costoPliego: 0,
        costoCorte: parseFloat(costoCorte) || 0,
        costoAcabados: (parseFloat(costoAcabados) || 0) + selectedFinishesCost + specialFinishesCost,
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

        const rowQty = idx === 0 ? qtyBase : (parseFloat(String(row.qty || "0")) || 0)
        if (rowQty <= 0) continue

        const r = computeLitografia({
          cantidad: rowQty,
          colores: 1,
          desperdicioPct: desperdicio,
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
          costoPliego: paper.costoPliego ?? 0,
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
        }
      }
    }
    return base
  }, [
    isAdmin,
    cantidad,
    desperdicioPct,
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
    costoTransporte,
    paperRows,
    primaryPaper,
    papers,
    sizeOptions,
  ])

  const fallbackCalc = useMemo(() => {
    if (isAdmin) return null
    if (!props.open) return null

    const qty = Math.trunc(parseFloat(cantidad) || 0)
    if (qty <= 0) return null
    if (!selectedPreset) return null

    // Estimación cuando no hay tarifa exacta. Usa costos del perfil y papel seleccionado.
    const desperdicio = parseFloat(desperdicioPct) || 0
    if (!primaryPaper) return null
    const paper = primaryPaper

    const base = computeLitografia({
      cantidad: qty,
      colores: 1,
      desperdicioPct: desperdicio,
      sobranteMinimo: parseFloat(sobranteMinimo) || 0,
      costoPlanchaPorColor: planchaCostConfigured,
      costoTintaPorColor: tintaCostConfigured,
      costoPapelUnidad: 0,
      papelModo: "pliego",
      papelTipo,
      papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
      papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
      papelFormatoWidthCm: selectedPreset.widthCm ?? 0,
      papelFormatoHeightCm: selectedPreset.heightCm ?? 0,
      costoPliego: paper.costoPliego ?? 0,
      costoCorte: 0,
      costoAcabados: 0,
      costoTransporte: parseFloat(costoTransporte) || 0,
      // Margen 0: se deja como estimación base (se puede ajustar en tarifario).
      margenPct: 0,
    })

    if (selectedPreset) {
      const byPaperId = new Map(papers.map((p) => [p.id, p] as const))
      const presetByKey = new Map(sizeOptions.map((s) => [s.key, s] as const))

      const baseNoPaper = computeLitografia({
        cantidad: qty,
        colores: 1,
        desperdicioPct: desperdicio,
        sobranteMinimo: parseFloat(sobranteMinimo) || 0,
        costoPlanchaPorColor: planchaCostConfigured,
        costoTintaPorColor: tintaCostConfigured,
        costoPapelUnidad: 0,
        papelModo: "pliego",
        papelTipo,
        papelPliegoWidthCm: paper.pliegoWidthCm ?? 0,
        papelPliegoHeightCm: paper.pliegoHeightCm ?? 0,
        papelFormatoWidthCm: selectedPreset.widthCm ?? 0,
        papelFormatoHeightCm: selectedPreset.heightCm ?? 0,
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

        const rowQty = idx === 0 ? qty : (parseFloat(String(row.qty || "0")) || 0)
        if (rowQty <= 0) continue

        const r = computeLitografia({
          cantidad: rowQty,
          colores: 1,
          desperdicioPct: desperdicio,
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
        }
      }
    }
    return base
  }, [
    isAdmin,
    props.open,
    cantidad,
    desperdicioPct,
    sobranteMinimo,
    planchaCostConfigured,
    tintaCostConfigured,
    papelTipo,
    costoTransporte,
    selectedPreset,
    primaryPaper,
    paperRows,
    papers,
    sizeOptions,
  ])

  const validation = useMemo(() => {
    const qty = Math.trunc(parseFloat(cantidad) || 0)
    const missingCantidad = qty <= 0
    const missingFormato = !formatoKey || !selectedPreset
    const missingPaper = !primaryPaperId && activePapers.length > 0
    const missingPlancha = !primaryPlanchaProfileId && activePlanchaProfiles.length > 0
    const missingTinta = !primaryTintaProfileId && activeTintaProfiles.length > 0
    const missingPricing = !isAdmin && !tarifa && !fallbackCalc

    const hasMissing = missingCantidad || missingFormato || missingPaper || missingPlancha || missingTinta || missingPricing
    return {
      qty,
      missingCantidad,
      missingFormato,
      missingPaper,
      missingPlancha,
      missingTinta,
      missingPricing,
      hasMissing,
    }
  }, [
    isAdmin,
    cantidad,
    formatoKey,
    selectedPreset,
    primaryPaperId,
    activePapers.length,
    primaryPlanchaProfileId,
    activePlanchaProfiles.length,
    primaryTintaProfileId,
    activeTintaProfiles.length,
    tarifa,
    fallbackCalc,
  ])

  const requiredLabelClass = (missing: boolean) => (attemptedSubmit && missing ? "text-red-600" : "")
  const requiredFieldClass = (missing: boolean) =>
    attemptedSubmit && missing ? "border-red-500 focus-visible:ring-red-500" : ""

  const canAdd = useMemo(() => {
    if (tarifaLoading) return false
    if (validation.hasMissing) return false
    if (isAdmin) return Boolean(calc)
    return Boolean(tarifa || fallbackCalc)
  }, [tarifaLoading, validation.hasMissing, isAdmin, calc, tarifa, fallbackCalc])

  const defaultDescripcion = useMemo(() => {
    const base = (titulo || (isAdmin ? "Litografía" : "Litografía")).trim() || (isAdmin ? "Litografía" : "Litografía")

    if (!isAdmin) {
      const presetLabel = selectedPreset ? `${selectedPreset.nombre} (${selectedPreset.widthCm}×${selectedPreset.heightCm} cm)` : (formatoKey || "Tamaño")
      const tintasLabel = tintas === 4 ? "Policromía (4)" : `${tintas} tinta${tintas === 1 ? "" : "s"}`
      const qty = Math.trunc(parseFloat(cantidad) || 0)
      const parts = [base, presetLabel, tintasLabel]
      if (primaryPaper) parts.push(`Papel ${primaryPaper.nombre}${primaryPaper.gramaje ? ` ${primaryPaper.gramaje}g` : ""}`)
      if (selectedFinishes.length) parts.push(`Acabados ${selectedFinishes.map((f) => f.nombre).join(", ")}`)
      if (selectedPlastificado) parts.push(`Plastificado ${selectedPlastificado.nombre}`)
      if (selectedTroquelado) parts.push(`Troquelado ${selectedTroquelado.nombre}`)
      if (selectedCorte) parts.push(`Corte ${selectedCorte.nombre}`)
      if (selectedSpecialFinishNames.length) parts.push(`Acabados especiales ${selectedSpecialFinishNames.join(", ")}`)
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
  }, [titulo, isAdmin, selectedPreset, formatoKey, tintas, cantidad, tarifa, calc, papelTipo, primaryPaper, selectedFinishes, selectedSpecialFinishNames, selectedTransporteKey, selectedPlastificado, selectedTroquelado, selectedCorte])

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
    {
      setAttemptedSubmit(true)
      setTarifaError(null)
      const qty = Math.trunc(parseFloat(cantidad) || 0)
      if (qty <= 0) {
        setTarifaError("Cantidad inválida")
        return
      }

      if (validation.hasMissing) {
        setTarifaError("Completa los campos obligatorios para generar la cotización")
        return
      }

      const transporte = parseFloat(costoTransporte) || 0
      const base = tarifa ? Number(tarifa.precioTotal) || 0 : 0
      const computed = !tarifa ? (isAdmin ? calc : fallbackCalc) : null

      if (!tarifa && !computed) {
        setTarifaError("No hay tarifa ni cálculo estimado disponible")
        return
      }

      const addFinishesCost = tarifa ? 0 : (isAdmin && computed ? 0 : selectedFinishesCost)
      const addSpecialFinishesCost = isAdmin && computed ? 0 : specialFinishesCost
      const addPlastificadoCost = isAdmin && computed ? 0 : plastificadoCost
      const addTroqueladoCost = isAdmin && computed ? 0 : troqueladoCost
      const addCorteCost = isAdmin && computed ? 0 : corteCost

      const meta = buildMeta()
      const baseValue = tarifa ? base : (computed?.precioVenta ?? 0)
      const shouldAddTransporte = Boolean(tarifa) || !computed
      const subtotal =
        (baseValue * margenMultiplier) +
        (shouldAddTransporte ? transporte : 0) +
        addFinishesCost +
        addSpecialFinishesCost +
        addPlastificadoCost +
        addTroqueladoCost +
        addCorteCost +
        customFieldsTotal
      const payload: AddLitografiaItemPayload = {
        descripcion: buildDescripcion(),
        cantidad: qty,
        unidad: "unidad",
        desperdicioPct: tarifa ? 0 : (computed?.waste ?? 0),
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

                  {isAdmin ? (
                    <div className="sm:col-span-2">
                      <Label>Tarifario (por rango)</Label>
                      <p className="mt-1 text-xs text-muted-foreground">Fuente de precio fija. El cálculo aprox. está deshabilitado.</p>
                    </div>
                  ) : null}

                  {
                    <>
                      <div >
                    <Label>Utilidad / Margen <small>(%) (opcional)</small></Label>
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
                      <div>
                        <Label className={requiredLabelClass(validation.missingCantidad)}>Cantidad (tiraje)</Label>
                        <Input
                          className={`${INPUT_COMPACT} ${requiredFieldClass(validation.missingCantidad)}`}
                          type="number"
                          step="1"
                          value={cantidad}
                          onChange={(e) => setCantidad(e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className={requiredLabelClass(validation.missingFormato)}>Tamaño de impresión</Label>
                        <select
                          className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingFormato)}`}
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
                        <Label className={requiredLabelClass(validation.missingPlancha)}>Planchas (costo)</Label>
                        <div className="mt-2 space-y-2">
                          {selectedPlanchaProfileIds.map((id, idx) => (
                            <div key={`${idx}-${id}`} className="flex items-center gap-2">
                              <select
                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPlancha)}`}
                                value={id}
                                onChange={(e) => updatePlanchaRow(idx, e.target.value)}
                                disabled={!activePlanchaProfiles.length}
                              >
                                <option value="">Sin planchas</option>
                                {activePlanchaProfiles.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>
                              {selectedPlanchaProfileIds.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => removePlanchaRow(idx)}
                                >
                                  Quitar
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] leading-tight text-muted-foreground">Puedes agregar más de un perfil de planchas.</span>
                          <Button type="button" variant="outline" size="sm" onClick={addPlanchaRow}>
                            Agregar otro
                          </Button>
                        </div>
                        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                          {primaryPlanchaProfile ? (
                            <>Total planchas: {formatCurrency(planchaCostConfigured)}</>
                          ) : (
                            <>Selecciona planchas.</>
                          )}
                        </p>
                      </div>

                      <div>
                        <Label className={requiredLabelClass(validation.missingTinta)}>Tinta (costo)</Label>
                        <div className="mt-2 space-y-2">
                          {selectedTintaProfileIds.map((id, idx) => (
                            <div key={`${idx}-${id}`} className="flex items-center gap-2">
                              <select
                                className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingTinta)}`}
                                value={id}
                                onChange={(e) => updateTintaRow(idx, e.target.value)}
                                disabled={!activeTintaProfiles.length}
                              >
                                <option value="">Sin tintas</option>
                                {activeTintaProfiles.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>
                              {selectedTintaProfileIds.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => removeTintaRow(idx)}
                                >
                                  Quitar
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] leading-tight text-muted-foreground">Puedes agregar más de un perfil de tintas.</span>
                          <Button type="button" variant="outline" size="sm" onClick={addTintaRow}>
                            Agregar otro
                          </Button>
                        </div>
                        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                          {primaryTintaProfile ? (
                            <>Total tintas: {formatCurrency(tintaCostConfigured)}</>
                          ) : (
                            <>Selecciona tintas.</>
                          )}
                        </p>
                      </div>

                        <div className="sm:col-span-2">
                          <Label className={requiredLabelClass(validation.missingPaper)}>Papel</Label>
                          <div className="mt-2 space-y-2">
                            {paperRows.map((row, idx) => (
                              <div key={`${idx}-${row.paperId}`} className="flex items-center gap-2">
                                <select
                                  className={`${SELECT_COMPACT} ${requiredFieldClass(validation.missingPaper)}`}
                                  value={row.paperId}
                                  onChange={(e) => updatePaperRow(idx, e.target.value)}
                                  disabled={!activePapers.length}
                                >
                                  <option value="">Sin papel</option>
                                  {activePapers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nombre}{p.gramaje ? ` • ${p.gramaje}g` : ""} • {formatCurrency(p.costoPliego)}/pliego
                                    </option>
                                  ))}
                                </select>
                                {idx === 0 ? (
                                  <div className="min-w-[120px] text-[10px] leading-tight text-muted-foreground">
                                    Tiraje: {String(cantidad || "0")}
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
                                        placeholder="Cantidad"
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
                                    Quitar
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] leading-tight text-muted-foreground">
                              El primer papel usa el tiraje y tamaño principal. Los adicionales permiten cantidad y tamaño.
                            </span>
                            <Button type="button" variant="outline" size="sm" onClick={addPaperRow}>
                              Agregar otro
                            </Button>
                          </div>
                          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                            {primaryPaper ? (
                              <>Pliego (principal): {primaryPaper.pliegoWidthCm}×{primaryPaper.pliegoHeightCm} cm</>
                            ) : (
                              <>Selecciona un papel.</>
                            )}
                          </p>

                          <div className="mt-2">
                            <Label>Sobrante mínimo (unid.)</Label>
                            <Input
                              className={INPUT_COMPACT}
                              type="number"
                              min={0}
                              step="1"
                              value={sobranteMinimo}
                              onChange={(e) => setSobranteMinimo(e.target.value)}
                              placeholder="100"
                            />
                            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                              Se usa como mínimo de unidades extra (además del % de desperdicio).
                            </p>
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <Label>Acabados</Label>
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
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] leading-tight text-muted-foreground">Puedes agregar más de un acabado.</span>
                            <Button type="button" variant="outline" size="sm" onClick={addFinishRow}>
                              Agregar otro
                            </Button>
                          </div>
                          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                            {finishIdsNormalized.length
                              ? <>Seleccionados: {selectedFinishes.map((f) => f.nombre).join(", ")}</>
                              : <>Ej: troquel.</>}
                          </p>
                        </div>

                        <div>
                          <Label>Plastificado</Label>
                          <select
                            className={SELECT_COMPACT}
                            value={selectedPlastificadoId}
                            onChange={(e) => setSelectedPlastificadoId(e.target.value)}
                            disabled={!activePlastificados.length}
                          >
                            <option value="">Sin plastificado</option>
                            {activePlastificados.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.nombre}
                              </option>
                            ))}
                          </select>
                          {!activePlastificados.length ? (
                            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                              Configura opciones en Configuración &gt; Litografía &gt; Acabados &gt; Plastificado.
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <Label>Troquel / Troquelado</Label>
                          <select
                            className={SELECT_COMPACT}
                            value={selectedTroqueladoId}
                            onChange={(e) => setSelectedTroqueladoId(e.target.value)}
                            disabled={!activeTroquelados.length}
                          >
                            <option value="">Sin troquelado</option>
                            {activeTroquelados.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.nombre}
                              </option>
                            ))}
                          </select>
                          {!activeTroquelados.length ? (
                            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                              Configura opciones en Configuración &gt; Litografía &gt; Acabados &gt; Troquelado.
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <Label>Corte</Label>
                          <select
                            className={SELECT_COMPACT}
                            value={selectedCorteId}
                            onChange={(e) => setSelectedCorteId(e.target.value)}
                            disabled={!activeCortes.length}
                          >
                            <option value="">Sin corte</option>
                            {activeCortes.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.nombre}
                              </option>
                            ))}
                          </select>
                          {!activeCortes.length ? (
                            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                              Configura opciones en Configuración &gt; Litografía &gt; Acabados &gt; Corte.
                            </p>
                          ) : null}
                        </div>

                        <div className="sm:col-span-2">
                          <Label>Acabados especiales</Label>
                          <div className="mt-2 space-y-2">
                            {specialFinishRows.map((row, idx) => {
                              const finishId = String(row.finishId || "").trim()
                              const selected = finishId ? activeSpecialFinishes.find((f) => f.id === finishId) || null : null
                              const takenElsewhere = new Set(
                                specialFinishRows
                                  .map((r, i) => (i === idx ? "" : String(r.finishId || "").trim()))
                                  .filter(Boolean)
                              )

                              return (
                                <div key={`${idx}-${finishId}`} className="flex items-center gap-2">
                                  <select
                                    className={SELECT_COMPACT}
                                    value={finishId}
                                    onChange={(e) => updateSpecialFinishRow(idx, e.target.value)}
                                  >
                                    <option value="">Seleccionar…</option>
                                    {activeSpecialFinishes.map((f) => (
                                      <option key={f.id} value={f.id} disabled={takenElsewhere.has(f.id)}>
                                        {f.nombre}
                                      </option>
                                    ))}
                                  </select>

                                  <span className="text-[10px] leading-tight text-muted-foreground whitespace-nowrap">
                                    {selected ? `${formatCurrency(selected.valor || 0)} c/u` : ""}
                                  </span>

                                  <Input
                                    className={`${INPUT_COMPACT} w-24 shrink-0`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={row.qty ?? "1"}
                                    onChange={(e) => updateSpecialFinishQty(idx, e.target.value)}
                                    placeholder="Cant."
                                  />

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600"
                                    onClick={() => removeSpecialFinishRow(idx)}
                                  >
                                    Quitar
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] leading-tight text-muted-foreground">Puedes agregar más de un acabado especial.</span>
                            <Button type="button" variant="outline" size="sm" onClick={addSpecialFinishRow}>
                              Agregar Otro
                            </Button>
                          </div>
                          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                            {selectedSpecialFinishNames.length
                              ? <>Seleccionados: {selectedSpecialFinishNames.join(", ")}</>
                              : <>Ej: troquel, hot stamping.</>}
                          </p>

                          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                            Total acabados especiales: {formatCurrency(specialFinishesCost)}
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
                  }
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Resultado</CardTitle>
                    <CardDescription>
                      {tarifa
                        ? "Precio desde tarifario."
                        : fallbackCalc
                          ? "Sin tarifa exacta. Se usa cálculo estimado."
                          : isAdmin && calc
                            ? "Sin tarifa exacta. Se usa cálculo (admin)."
                          : "Precio desde tarifario."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <>
                      {tarifaLoading ? <p className="text-sm text-muted-foreground">Consultando tarifa…</p> : null}
                      {null}

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
                            const usedGenericPaper = Boolean(primaryPaperId) && tarifa.paperRateId == null
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
                              const addFinishesCost = 0
                              const total = (base * margenMultiplier) + transporte + addFinishesCost + specialFinishesCost + plastificadoCost + troqueladoCost + corteCost + extras
                              const qty = Math.max(1, Math.trunc(parseFloat(cantidad) || 1))
                              return (
                                <>
                                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base (tarifario)</span><span className="font-medium">{formatCurrency(base)}</span></div>
                                  <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Transporte</span><span className="font-medium">{formatCurrency(transporte)}</span></div>
                                  {addFinishesCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Acabados</span><span className="font-medium">{formatCurrency(addFinishesCost)}</span></div> : null}
                                  {specialFinishesCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Acabados especiales</span><span className="font-medium">{formatCurrency(specialFinishesCost)}</span></div> : null}
                                  {plastificadoCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Plastificado</span><span className="font-medium">{formatCurrency(plastificadoCost)}</span></div> : null}
                                  {troqueladoCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Troquelado</span><span className="font-medium">{formatCurrency(troqueladoCost)}</span></div> : null}
                                  {corteCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Corte</span><span className="font-medium">{formatCurrency(corteCost)}</span></div> : null}
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
                              const total = (baseValue * margenMultiplier) + selectedFinishesCost + specialFinishesCost + plastificadoCost + troqueladoCost + corteCost + extras
                              const qty = Math.max(1, Math.trunc(parseFloat(cantidad) || 1))
                              return (
                                <>
                                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base (estimado)</span><span className="font-medium">{formatCurrency(baseValue)}</span></div>
                                  {selectedFinishesCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Acabados</span><span className="font-medium">{formatCurrency(selectedFinishesCost)}</span></div> : null}
                                  {specialFinishesCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Acabados especiales</span><span className="font-medium">{formatCurrency(specialFinishesCost)}</span></div> : null}
                                  {plastificadoCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Plastificado</span><span className="font-medium">{formatCurrency(plastificadoCost)}</span></div> : null}
                                  {troqueladoCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Troquelado</span><span className="font-medium">{formatCurrency(troqueladoCost)}</span></div> : null}
                                  {corteCost ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Corte</span><span className="font-medium">{formatCurrency(corteCost)}</span></div> : null}
                                  {extras ? <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Campos extra</span><span className="font-medium">{formatCurrency(extras)}</span></div> : null}
                                  <div className="flex justify-between mt-2"><span className="font-medium">Total</span><span className="font-bold text-blue-700">{formatCurrency(total)}</span></div>
                                  <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Unitario</span><span className="font-medium">{formatCurrency(total / qty)}</span></div>
                                </>
                              )
                            })()}
                          </div>
                        </>
                      ) : isAdmin && calc ? (
                        <>
                          {calc.papelModo === "pliego" ? (
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
                          ) : null}

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
                            {(() => {
                              const baseValue = calc.precioVenta || 0
                              const total = (baseValue * margenMultiplier) + customFieldsTotal
                              const qty = Math.max(1, Math.trunc(parseFloat(cantidad) || 1))
                              return (
                                <>
                                  <div className="flex justify-between">
                                    <span className="font-medium">Precio venta</span>
                                    <span className="font-bold text-blue-700">{formatCurrency(total)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm mt-1">
                                    <span className="text-muted-foreground">Precio unitario</span>
                                    <span className="font-medium">{formatCurrency(total / qty)}</span>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        </>
                      ) : null}
                    </>
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
