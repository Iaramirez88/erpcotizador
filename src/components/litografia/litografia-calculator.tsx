"use client"

import { useEffect, useMemo, useState, type ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { computeLitografia } from "@/lib/litografia"
import { formatCurrency } from "@/lib/utils"

type PapelTipo = "bond" | "propalcote" | "periodico" | "otro"

const TRANSPORTE_OPTIONS = [
  { key: "norte", label: "Norte", total: 20000 },
  { key: "sur", label: "Sur", total: 40000 },
  { key: "fuera_bogota", label: "Fuera de Bogotá", total: 60000 },
] as const

type TransporteKey = (typeof TRANSPORTE_OPTIONS)[number]["key"]

const DEFAULT_TIRAJE_TIERS = [
  { key: "1_500", label: "1–500", min: 1, max: 500 },
  { key: "501_1000", label: "501–1000", min: 501, max: 1000 },
  { key: "1001_2000", label: "1001–2000", min: 1001, max: 2000 },
  { key: "2001_5000", label: "2001–5000", min: 2001, max: 5000 },
  { key: "5001_10000", label: "5001–10000", min: 5001, max: 10000 },
] as const

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

type ApiEnvelope = { ok?: unknown; data?: unknown; error?: unknown }

function asApiEnvelope(value: unknown): ApiEnvelope {
  return value && typeof value === "object" ? (value as ApiEnvelope) : {}
}

function getApiErrorMessage(env: ApiEnvelope, fallback: string) {
  return typeof env.error === "string" ? env.error : fallback
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

function getSizeDisplayName(sizes: Array<{ key: string; nombre: string }>, key: string) {
  return sizes.find((s) => s.key === key)?.nombre || key
}

export function LitografiaCalculator() {
  const PAGE_SIZE = 5
  const [tab] = useState<"config">("config")

  const [meLoaded, setMeLoaded] = useState(false)
  const [canConfigWrite, setCanConfigWrite] = useState(false)

  const [cantidad, setCantidad] = useState("1000")
  const [colores, setColores] = useState("4")
  const [desperdicioPct] = useState("3")

  const [costoPlanchaPorColor, setCostoPlanchaPorColor] = useState("25000")
  const [costoTintaPorColor, setCostoTintaPorColor] = useState("15000")
  const [costoPapelUnidad, setCostoPapelUnidad] = useState("80")

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

  const [selectedTransporteKey, setSelectedTransporteKey] = useState<TransporteKey | "">("")

  const [newProfileNombre, setNewProfileNombre] = useState("")
  const [newProfilePlancha, setNewProfilePlancha] = useState("0")
  const [newProfileTinta, setNewProfileTinta] = useState("0")

  const [profileEdits, setProfileEdits] = useState<Record<string, { nombre: string; plancha: string; tinta: string }>>({})

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
  const [papersPage, setPapersPage] = useState(0)
  const [finishesPage, setFinishesPage] = useState(0)
  const [plastificadosPage, setPlastificadosPage] = useState(0)
  const [troqueladosPage, setTroqueladosPage] = useState(0)
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
  const [matchedRate, setMatchedRate] = useState<FlyerRate | null>(null)
  const [matchedRateLoading, setMatchedRateLoading] = useState(false)

  const [selectedRateId, setSelectedRateId] = useState<string>("")
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
  const troqueladosFinishes = useMemo(() => finishes.filter((f) => !f.especial && getGrupo(f) === "TROQUELADO"), [finishes])
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
  }, [sizeOptions, formatoKey])

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

  const createFinishInGroup = async (grupo: "ACABADO" | "PLASTIFICADO" | "TROQUELADO" | "CORTE", args: { nombre: string; valor: number }) => {
    setConfigError(null)
    const nombre = args.nombre.trim()
    const valor = args.valor

    const res = await fetch("/api/litografia/acabados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, valor: Number.isFinite(valor) ? valor : 0, activo: true, especial: false, grupo }),
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

  const createFlyerRateDirect = async (payload: {
    formatoKey: string
    tintas: 1 | 2 | 4
    tirajeMin: number
    tirajeMax: number
    paperRateId: string | null
    finishOptionId: string | null
    precioTotal: number
  }) => {
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/flyers-tarifas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, activo: true }),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear la tarifa"))
      await fetchFlyerRates()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear la tarifa")
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

  const tintasFromColores = useMemo(() => {
    const v = Number(colores)
    return (v === 1 || v === 2 || v === 4 ? v : 4) as 1 | 2 | 4
  }, [colores])

  const availableTarifas = useMemo(() => {
    const finishId = selectedFinishId.trim() || null

    const candidates = flyerRates
      .filter((r) => r.activo)
      .filter((r) => r.formatoKey === formatoKey)
      .filter((r) => r.tintas === tintasFromColores)
      // Tarifas siempre asociadas a un papel (para poder calcular imposición por pliego)
      .filter((r) => Boolean(selectedPaperId) && r.paperRateId === selectedPaperId)
      // Acabado exacto: si no hay acabado seleccionado, se usa la tarifa con finishOptionId = null
      .filter((r) => r.finishOptionId === finishId)
      .sort((a, b) => {
        if (a.tirajeMin !== b.tirajeMin) return a.tirajeMin - b.tirajeMin
        return 0
      })

    const byRange = new Map<string, FlyerRate>()
    for (const r of candidates) {
      const k = `${r.tirajeMin}:${r.tirajeMax}`
      if (!byRange.has(k)) byRange.set(k, r)
    }

    return Array.from(byRange.values()).sort((a, b) => a.tirajeMin - b.tirajeMin)
  }, [flyerRates, formatoKey, tintasFromColores, selectedPaperId, selectedFinishId])

  useEffect(() => {
    // Solo Configuración: no se ejecuta lógica de cotización.
  }, [])

  useEffect(() => {
    if (!newFlyerTierKey) return
    const t = DEFAULT_TIRAJE_TIERS.find((x) => x.key === newFlyerTierKey) || null
    if (!t) return
    setNewFlyerMin(String(t.min))
    setNewFlyerMax(String(t.max))
  }, [newFlyerTierKey])

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
    const opt = TRANSPORTE_OPTIONS.find((o) => o.key === selectedTransporteKey) || null
    const next = opt ? String(opt.total) : "0"
    if (costoTransporte !== next) setCostoTransporte(next)
  }, [pricingSource, selectedTransporteKey, costoTransporte])

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

  const createProfile = async (mode: "plancha" | "tinta" | "ambos" = "ambos") => {
    setConfigError(null)
    try {
      const res = await fetch("/api/litografia/perfiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newProfileNombre,
          costoPlanchaPorColor: mode === "tinta" ? 0 : parseFloat(newProfilePlancha) || 0,
          costoTintaPorColor: mode === "plancha" ? 0 : parseFloat(newProfileTinta) || 0,
          activo: true,
        }),
      })
      const env = asApiEnvelope((await res.json().catch(() => null)) as unknown)
      if (!res.ok || env.ok !== true) throw new Error(getApiErrorMessage(env, "No se pudo crear el perfil"))
      setNewProfileNombre("")
      setNewProfilePlancha("0")
      setNewProfileTinta("0")
      await fetchProfiles()
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "No se pudo crear el perfil")
    }
  }

  const createProfileDirect = async (payload: {
    nombre: string
    costoPlanchaPorColor: number
    costoTintaPorColor: number
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
    try {
      const res = await fetch("/api/litografia/papeles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newPaperNombre,
          tipo: newPaperTipo,
          gramaje: newPaperGramaje ? parseInt(newPaperGramaje, 10) : null,
          pliegoWidthCm: parseFloat(newPaperPliegoW) || 70,
          pliegoHeightCm: parseFloat(newPaperPliegoH) || 100,
          costoPliego: parseFloat(newPaperCostoPliego) || 0,
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
      costoPlanchaPorColor: parseFloat(costoPlanchaPorColor) || 0,
      costoTintaPorColor: parseFloat(costoTintaPorColor) || 0,
      costoPapelUnidad: parseFloat(costoPapelUnidad) || 0,
      papelModo: usePliego ? "pliego" : "unidad",
      papelTipo,
      papelPliegoWidthCm: parseFloat(pliegoW) || 0,
      papelPliegoHeightCm: parseFloat(pliegoH) || 0,
      papelFormatoWidthCm: parsedFormatoW,
      papelFormatoHeightCm: parsedFormatoH,
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
    selectedFinish,
    costoCorte,
    costoAcabados,
    costoTransporte,
  ])

  const planchaProfiles = useMemo(() => {
    return profiles.filter((p) => (p.costoPlanchaPorColor ?? 0) > 0)
  }, [profiles])

  const tintaProfiles = useMemo(() => {
    return profiles.filter((p) => (p.costoTintaPorColor ?? 0) > 0)
  }, [profiles])

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
    return papers.slice(start, start + PAGE_SIZE)
  }, [papers, papersPage, PAGE_SIZE])

  const pagedFinishes = useMemo(() => {
    const start = finishesPage * PAGE_SIZE
    return acabadosFinishes.slice(start, start + PAGE_SIZE)
  }, [acabadosFinishes, finishesPage, PAGE_SIZE])

  const pagedPlastificados = useMemo(() => {
    const start = plastificadosPage * PAGE_SIZE
    return plastificadosFinishes.slice(start, start + PAGE_SIZE)
  }, [plastificadosFinishes, plastificadosPage, PAGE_SIZE])

  const pagedTroquelados = useMemo(() => {
    const start = troqueladosPage * PAGE_SIZE
    return troqueladosFinishes.slice(start, start + PAGE_SIZE)
  }, [troqueladosFinishes, troqueladosPage, PAGE_SIZE])

  const pagedCortes = useMemo(() => {
    const start = cortesPage * PAGE_SIZE
    return cortesFinishes.slice(start, start + PAGE_SIZE)
  }, [cortesFinishes, cortesPage, PAGE_SIZE])

  const pagedSpecialFinishes = useMemo(() => {
    const start = specialFinishesPage * PAGE_SIZE
    return specialFinishes.slice(start, start + PAGE_SIZE)
  }, [specialFinishes, specialFinishesPage, PAGE_SIZE])

  const pagedSizes = useMemo(() => {
    const start = sizesPage * PAGE_SIZE
    return sizes.slice(start, start + PAGE_SIZE)
  }, [sizes, sizesPage, PAGE_SIZE])

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
    return groupedFlyerRates.slice(start, start + PAGE_SIZE)
  }, [groupedFlyerRates, ratesPage, PAGE_SIZE])

  return (
    <div className="space-y-4">
      {configError ? <p className="text-sm text-red-600">{configError}</p> : null}

      {tab === "config" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración (Litografía)</CardTitle>
              <CardDescription>
                Módulos separados para evitar pantallas largas. Cada lista muestra 5 ítems y permite paginar.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
                  <CardTitle>Planchas</CardTitle>
                  <CardDescription>Costo de plancha por color.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div className="md:col-span-2">
                    <Label>Nombre</Label>
                    <Input className={INPUT_COMPACT} value={newProfileNombre} onChange={(e) => setNewProfileNombre(e.target.value)} placeholder="Ej: Offset 70×100" />
                  </div>
                  <div>
                    <Label>Plancha/Color</Label>
                    <MoneyInput className={INPUT_COMPACT} type="number" step="1" value={newProfilePlancha} onChange={(e) => setNewProfilePlancha(e.target.value)} />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      type="button"
                      onClick={() => void createProfile("plancha")}
                      disabled={!newProfileNombre.trim() || (parseFloat(newProfilePlancha) || 0) <= 0}
                    >
                      Agregar plancha
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {profilesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {planchaProfiles.length === 0 && !profilesLoading ? <p className="text-sm text-muted-foreground">No hay registros de planchas.</p> : null}

                  {pagedPlanchaProfiles.map((p) => (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">Plancha/Color: {formatCurrency(p.costoPlanchaPorColor)}</p>
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
                        const parsedPlancha = parseFloat(draftPlancha)

                        const hasDraft = Boolean(draft)
                        const isNombreDirty = draft?.nombre !== undefined && draftNombre.trim() !== p.nombre
                        const isPlanchaDirty =
                          draft?.plancha !== undefined &&
                          Number.isFinite(parsedPlancha) &&
                          parsedPlancha >= 0 &&
                          parsedPlancha !== p.costoPlanchaPorColor

                        const canSave =
                          (isNombreDirty || isPlanchaDirty) &&
                          (!draftPlancha.trim() || (Number.isFinite(parsedPlancha) && parsedPlancha >= 0))

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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
                  <CardTitle>Tintas</CardTitle>
                  <CardDescription>Costo de tinta por color.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div className="md:col-span-2">
                    <Label>Nombre</Label>
                    <Input className={INPUT_COMPACT} value={newProfileNombre} onChange={(e) => setNewProfileNombre(e.target.value)} placeholder="Ej: Offset 70×100" />
                  </div>
                  <div>
                    <Label>Tinta/Color</Label>
                    <MoneyInput className={INPUT_COMPACT} type="number" step="1" value={newProfileTinta} onChange={(e) => setNewProfileTinta(e.target.value)} />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      type="button"
                      onClick={() => void createProfile("tinta")}
                      disabled={!newProfileNombre.trim() || (parseFloat(newProfileTinta) || 0) <= 0}
                    >
                      Agregar tinta
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {profilesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {tintaProfiles.length === 0 && !profilesLoading ? <p className="text-sm text-muted-foreground">No hay registros de tintas.</p> : null}

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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
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
                  <Button type="button" onClick={createPaper} disabled={!newPaperNombre.trim()}>
                    Agregar papel
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {papersLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                {papers.length === 0 && !papersLoading ? <p className="text-sm text-muted-foreground">No hay papeles.</p> : null}

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

                {papers.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {papersPage * PAGE_SIZE + 1}-{Math.min(papers.length, (papersPage + 1) * PAGE_SIZE)} de {papers.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setPapersPage((p) => Math.max(0, p - 1))} disabled={papersPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {papersPage + 1} / {Math.max(1, Math.ceil(papers.length / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPapersPage((p) => Math.min(Math.ceil(papers.length / PAGE_SIZE) - 1, p + 1))}
                        disabled={papersPage >= Math.ceil(papers.length / PAGE_SIZE) - 1}
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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
                  <CardTitle>Tamaños de impresión</CardTitle>
                  <CardDescription>Define los formatos disponibles (código, nombre y dimensiones).</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <div className="md:col-span-2">
                  <Label>Nombre</Label>
                  <Input className={INPUT_COMPACT} value={newSizeNombre} onChange={(e) => setNewSizeNombre(e.target.value)} placeholder="Ej: Medio oficio" />
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

              <div className="space-y-2">
                {sizesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                {sizes.length === 0 && !sizesLoading ? <p className="text-sm text-muted-foreground">No hay tamaños configurados.</p> : null}

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

                {sizes.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {sizesPage * PAGE_SIZE + 1}-{Math.min(sizes.length, (sizesPage + 1) * PAGE_SIZE)} de {sizes.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSizesPage((p) => Math.max(0, p - 1))} disabled={sizesPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {sizesPage + 1} / {Math.max(1, Math.ceil(sizes.length / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSizesPage((p) => Math.min(Math.ceil(sizes.length / PAGE_SIZE) - 1, p + 1))}
                        disabled={sizesPage >= Math.ceil(sizes.length / PAGE_SIZE) - 1}
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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
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

              <div className="space-y-2">
                {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                {acabadosFinishes.length === 0 && !finishesLoading ? <p className="text-sm text-muted-foreground">No hay acabados.</p> : null}

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

                {acabadosFinishes.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {finishesPage * PAGE_SIZE + 1}-{Math.min(acabadosFinishes.length, (finishesPage + 1) * PAGE_SIZE)} de {acabadosFinishes.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setFinishesPage((p) => Math.max(0, p - 1))} disabled={finishesPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {finishesPage + 1} / {Math.max(1, Math.ceil(acabadosFinishes.length / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFinishesPage((p) => Math.min(Math.ceil(acabadosFinishes.length / PAGE_SIZE) - 1, p + 1))}
                        disabled={finishesPage >= Math.ceil(acabadosFinishes.length / PAGE_SIZE) - 1}
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

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {specialFinishes.length === 0 && !finishesLoading ? <p className="text-sm text-muted-foreground">No hay acabados especiales.</p> : null}

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

                  {specialFinishes.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {specialFinishesPage * PAGE_SIZE + 1}-{Math.min(specialFinishes.length, (specialFinishesPage + 1) * PAGE_SIZE)} de {specialFinishes.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSpecialFinishesPage((p) => Math.max(0, p - 1))} disabled={specialFinishesPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {specialFinishesPage + 1} / {Math.max(1, Math.ceil(specialFinishes.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSpecialFinishesPage((p) => Math.min(Math.ceil(specialFinishes.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={specialFinishesPage >= Math.ceil(specialFinishes.length / PAGE_SIZE) - 1}
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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
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

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {plastificadosFinishes.length === 0 && !finishesLoading ? <p className="text-sm text-muted-foreground">No hay plastificados.</p> : null}

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

                  {plastificadosFinishes.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {plastificadosPage * PAGE_SIZE + 1}-{Math.min(plastificadosFinishes.length, (plastificadosPage + 1) * PAGE_SIZE)} de {plastificadosFinishes.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setPlastificadosPage((p) => Math.max(0, p - 1))} disabled={plastificadosPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {plastificadosPage + 1} / {Math.max(1, Math.ceil(plastificadosFinishes.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPlastificadosPage((p) => Math.min(Math.ceil(plastificadosFinishes.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={plastificadosPage >= Math.ceil(plastificadosFinishes.length / PAGE_SIZE) - 1}
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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
                  <CardTitle>Troquel / Troquelado</CardTitle>
                  <CardDescription>Opciones para el módulo Troquelado del cotizador.</CardDescription>
                </CardHeader>
              </summary>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <Label>Nombre</Label>
                    <Input className={INPUT_COMPACT} value={newTroqueladoNombre} onChange={(e) => setNewTroqueladoNombre(e.target.value)} placeholder="Ej: Troquel estándar" />
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <MoneyInput className={INPUT_COMPACT} type="number" step="1" min="0" value={newTroqueladoValor} onChange={(e) => setNewTroqueladoValor(e.target.value)} placeholder="Ej: 25000" />
                  </div>
                  <div>
                    <Button type="button" onClick={createTroquelado} disabled={!newTroqueladoNombre.trim()}>
                      Agregar troquelado
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {troqueladosFinishes.length === 0 && !finishesLoading ? <p className="text-sm text-muted-foreground">No hay troquelados.</p> : null}

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

                  {troqueladosFinishes.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {troqueladosPage * PAGE_SIZE + 1}-{Math.min(troqueladosFinishes.length, (troqueladosPage + 1) * PAGE_SIZE)} de {troqueladosFinishes.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setTroqueladosPage((p) => Math.max(0, p - 1))} disabled={troqueladosPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {troqueladosPage + 1} / {Math.max(1, Math.ceil(troqueladosFinishes.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTroqueladosPage((p) => Math.min(Math.ceil(troqueladosFinishes.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={troqueladosPage >= Math.ceil(troqueladosFinishes.length / PAGE_SIZE) - 1}
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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
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

                <div className="space-y-2">
                  {finishesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                  {cortesFinishes.length === 0 && !finishesLoading ? <p className="text-sm text-muted-foreground">No hay cortes.</p> : null}

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

                  {cortesFinishes.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {cortesPage * PAGE_SIZE + 1}-{Math.min(cortesFinishes.length, (cortesPage + 1) * PAGE_SIZE)} de {cortesFinishes.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setCortesPage((p) => Math.max(0, p - 1))} disabled={cortesPage <= 0}>
                          Anterior
                        </Button>
                        <p className="text-xs">Página {cortesPage + 1} / {Math.max(1, Math.ceil(cortesFinishes.length / PAGE_SIZE))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCortesPage((p) => Math.min(Math.ceil(cortesFinishes.length / PAGE_SIZE) - 1, p + 1))}
                          disabled={cortesPage >= Math.ceil(cortesFinishes.length / PAGE_SIZE) - 1}
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
            <details>
              <summary className="cursor-pointer">
                <CardHeader>
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
                  <select
                    className={SELECT_COMPACT}
                    value={ratesFilterFormatoKey}
                    onChange={(e) => setRatesFilterFormatoKey(e.target.value)}
                    disabled={!sizeOptions.length}
                  >
                    <option value="">Todos</option>
                    {sizeOptions.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <Label>Filtro Tintas</Label>
                  <select
                    className={SELECT_COMPACT}
                    value={ratesFilterTintas === "" ? "" : String(ratesFilterTintas)}
                    onChange={(e) => {
                      const raw = e.target.value
                      const v = raw === "" ? "" : (Number(raw) as 1 | 2 | 4)
                      setRatesFilterTintas(v)
                    }}
                  >
                    <option value="">Todas</option>
                    <option value="4">4</option>
                    <option value="2">2</option>
                    <option value="1">1</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Filtro Papel</Label>
                  <select className={SELECT_COMPACT} value={ratesFilterPaperId} onChange={(e) => setRatesFilterPaperId(e.target.value)}>
                    <option value="">Todos</option>
                    {activePapers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Filtro Acabado</Label>
                  <select className={SELECT_COMPACT} value={ratesFilterFinishId} onChange={(e) => setRatesFilterFinishId(e.target.value)} disabled={finishesLoading}>
                    <option value="">Todos</option>
                    <option value="__generic__">Solo SIN acabado</option>
                    {activeFinishes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
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
                  <select className={SELECT_COMPACT} value={newFlyerPaperId} onChange={(e) => setNewFlyerPaperId(e.target.value)}>
                    <option value="" disabled>
                      Selecciona un papel
                    </option>
                    {activePapers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Acabado</Label>
                  <select className={SELECT_COMPACT} value={newFlyerFinishId} onChange={(e) => setNewFlyerFinishId(e.target.value)} disabled={finishesLoading}>
                    <option value="">Sin acabado</option>
                    {activeFinishes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Formato</Label>
                  <select
                    className={SELECT_COMPACT}
                    value={newFlyerFormatoKey}
                    onChange={(e) => setNewFlyerFormatoKey(e.target.value)}
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
                    <p className="mt-1 text-xs text-muted-foreground">Crea tamaños en Configuración &gt; Tamaños de impresión.</p>
                  ) : null}
                </div>
                <div>
                  <Label>Tintas</Label>
                  <select className={SELECT_COMPACT} value={String(newFlyerTintas)} onChange={(e) => setNewFlyerTintas(Number(e.target.value) as 1 | 2 | 4)}>
                    <option value="4">4</option>
                    <option value="2">2</option>
                    <option value="1">1</option>
                  </select>
                </div>
                <div>
                  <Label>Rango sugerido</Label>
                  <select className={SELECT_COMPACT} value={newFlyerTierKey} onChange={(e) => setNewFlyerTierKey(e.target.value)}>
                    <option value="">Personalizado</option>
                    {DEFAULT_TIRAJE_TIERS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
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

              <div className="space-y-2">
                {flyerRatesLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                {groupedFlyerRates.length === 0 && !flyerRatesLoading ? <p className="text-sm text-muted-foreground">No hay rangos (con estos filtros).</p> : null}

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
                          <select
                            className={SELECT_INLINE}
                            value={groupProductoSelection[g.key] ?? (g.productoId ?? "")}
                            onChange={(e) => setGroupProductoSelection((prev) => ({ ...prev, [g.key]: e.target.value }))}
                            disabled={productosLoading || groupAssignLoadingKey === g.key}
                          >
                            <option value="">Sin producto</option>
                            {productos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))}
                          </select>
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
                                    <select
                                      className={SELECT_COMPACT}
                                      value={draftPaperId}
                                      onChange={(e) => {
                                        const v = e.target.value
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
                                    >
                                      {draftPaperId ? null : (
                                        <option value="" disabled>
                                          {r.paperRateId ? "Selecciona un papel" : "Sin papel (legacy)"}
                                        </option>
                                      )}
                                      {activePapers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">Acabado</Label>
                                    <select
                                      className={SELECT_COMPACT}
                                      value={draftFinishId}
                                      onChange={(e) => {
                                        const v = e.target.value
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
                                    >
                                      <option value="">Sin acabado</option>
                                      {activeFinishes.map((f) => (
                                        <option key={f.id} value={f.id}>
                                          {f.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">Tamaño</Label>
                                    <select
                                      className={SELECT_COMPACT}
                                      value={draftFormatoKey}
                                      onChange={(e) => {
                                        const v = e.target.value
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
                                    >
                                      {sizeOptions.length ? null : <option value={r.formatoKey}>{r.formatoKey}</option>}
                                      {sizeOptions.map((p) => (
                                        <option key={p.key} value={p.key}>
                                          {p.nombre}
                                        </option>
                                      ))}
                                    </select>
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

                {groupedFlyerRates.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {ratesPage * PAGE_SIZE + 1}-{Math.min(groupedFlyerRates.length, (ratesPage + 1) * PAGE_SIZE)} de {groupedFlyerRates.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setRatesPage((p) => Math.max(0, p - 1))} disabled={ratesPage <= 0}>
                        Anterior
                      </Button>
                      <p className="text-xs">Página {ratesPage + 1} / {Math.max(1, Math.ceil(groupedFlyerRates.length / PAGE_SIZE))}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRatesPage((p) => Math.min(Math.ceil(groupedFlyerRates.length / PAGE_SIZE) - 1, p + 1))}
                        disabled={ratesPage >= Math.ceil(groupedFlyerRates.length / PAGE_SIZE) - 1}
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
      <Card>
        <CardHeader>
          <CardTitle>Parámetros</CardTitle>
          <CardDescription>Selecciona opciones. Los costos se autollenan.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Cantidad (tiraje)</Label>
            <Input className={INPUT_COMPACT} type="number" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>

          <div>
            <Label>Tamaño de impresión</Label>
            <select
              className={SELECT_COMPACT}
              value={formatoKey}
              onChange={(e) => {
                const nextKey = e.target.value
                setFormatoKey(nextKey)
                const preset = sizeOptions.find((p) => p.key === nextKey)
                if (!preset) return
                setFormatoW(String(preset.widthCm))
                setFormatoH(String(preset.heightCm))
              }}
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
              <p className="mt-1 text-xs text-muted-foreground">Crea tamaños en Configuración &gt; Tamaños de impresión para poder cotizar.</p>
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
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedPlanchaProfile ? (
                <>
                  <span className="block">Plancha/Color: {formatCurrency(selectedPlanchaProfile.costoPlanchaPorColor)}</span>
                </>
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
            <select
              className={SELECT_COMPACT}
              value={selectedPaperId}
              onChange={(e) => {
                const nextId = e.target.value
                setSelectedPaperId(nextId)
                const p = activePapers.find((x) => x.id === nextId) || null
                if (p) {
                  setSelectedPaperTipo(String(p.tipo || "otro").trim() || "otro")
                  setSelectedPaperGramaje(p.gramaje != null ? String(p.gramaje) : "")
                }
              }}
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
            <select className={SELECT_COMPACT} value={selectedFinishId} onChange={(e) => setSelectedFinishId(e.target.value)} disabled={finishesLoading}>
              <option value="">Sin acabado</option>
              {activeFinishes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
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
