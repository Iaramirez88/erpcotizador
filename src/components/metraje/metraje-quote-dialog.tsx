/**
 * Cotizador por metraje (m² / ml)
 * - Selecciona producto con precio por m² o por ml
 * - Usa medidas por defecto del producto (editables)
 * - Permite seleccionar acabados (Terminados)
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type MetrajeMaterial = {
  id: string
  externalId?: string | null
  nombre: string
  unidadMedida: string
  ancho?: number | null // cm
  largo?: number | null // cm o metros (según unidad)
  precioM2?: number | null
  precioMetro?: number | null
}

type Terminado = {
  id: string
  nombre: string
  unidadAplicacion: string
  precioUnitario: number
  activo: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

export type ItemCotizacionTerminadoDraft = {
  terminadoId: string
  unidadAplicacion: "m2" | "ml" | "unidad"
  baseCantidad: number
  precioUnitario: number
  costoTotal: number
  nombre?: string
}

export type MetrajeItemDraft = {
  id: string
  descripcion: string
  materialId: string
  material: MetrajeMaterial
  cantidad: number
  unidad: "m2" | "ml"
  ancho: number | null
  alto: number | null
  m2: number | null // área por unidad (m²) o largo por unidad (ml)
  desperdicioPct?: number
  precioUnitario: number
  subtotal: number
  observaciones: string
  laminado: boolean
  troquelado: boolean
  instalacion: boolean
  costoLaminado: number
  costoTroquelado: number
  costoInstalacion: number
  terminados: ItemCotizacionTerminadoDraft[]
}

function normalizeUnidad(value: unknown): "m2" | "ml" | "unidad" {
  const u = String(value ?? "").trim().toLowerCase()
  if (u === "m2" || u === "m²") return "m2"
  if (u === "ml" || u === "m" || u === "metro") return "ml"
  return "unidad"
}

function toNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clampNonNeg(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function MetrajeQuoteDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  materiales: MetrajeMaterial[]
  formatCurrency: (value: number) => string
  onAddItem: (item: MetrajeItemDraft) => void
  edit?: { itemId: string; item: Partial<MetrajeItemDraft> } | null
  onUpdateItem?: (item: MetrajeItemDraft) => void
}) {
  const { open, onOpenChange, materiales, formatCurrency, onAddItem, edit, onUpdateItem } = props

  const formatMaterialLabel = (m: Pick<MetrajeMaterial, 'nombre' | 'externalId'>) => {
    const code = String(m.externalId ?? '').trim()
    return code ? `(${code}) ${m.nombre}` : m.nombre
  }

  const [isLoadingTerminados, setIsLoadingTerminados] = useState(false)
  const [terminados, setTerminados] = useState<Terminado[]>([])
  const [terminadosError, setTerminadosError] = useState<string | null>(null)

  const [materialSearch, setMaterialSearch] = useState("")
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [materialId, setMaterialId] = useState<string>("")

  const [descripcion, setDescripcion] = useState("")
  const [cantidad, setCantidad] = useState("1")

  const [anchoCm, setAnchoCm] = useState("")
  const [altoCm, setAltoCm] = useState("")
  const [largoMl, setLargoMl] = useState("")

  const [selectedTerminadoIds, setSelectedTerminadoIds] = useState<Set<string>>(new Set())

  const selectedMaterial = useMemo(
    () => materiales.find((m) => m.id === materialId) || null,
    [materialId, materiales]
  )

  const unidad = useMemo<"m2" | "ml" | null>(() => {
    if (!selectedMaterial) return null
    const u = normalizeUnidad(selectedMaterial.unidadMedida)
    if (u === "m2" && selectedMaterial.precioM2 != null) return "m2"
    if (u === "ml" && selectedMaterial.precioMetro != null) return "ml"
    if (selectedMaterial.precioM2 != null) return "m2"
    if (selectedMaterial.precioMetro != null) return "ml"
    return null
  }, [selectedMaterial])

  const cantidadN = useMemo(() => {
    const n = Math.max(0, Math.trunc(toNumber(cantidad) || 0))
    return n > 0 ? n : 0
  }, [cantidad])

  const anchoCmN = useMemo(() => clampNonNeg(toNumber(anchoCm)), [anchoCm])
  const altoCmN = useMemo(() => clampNonNeg(toNumber(altoCm)), [altoCm])
  const largoMlN = useMemo(() => clampNonNeg(toNumber(largoMl)), [largoMl])

  const medidaPorUnidad = useMemo(() => {
    if (!unidad) return 0
    if (unidad === "m2") {
      if (!anchoCmN || !altoCmN) return 0
      return (anchoCmN * altoCmN) / 10000
    }
    return largoMlN
  }, [unidad, anchoCmN, altoCmN, largoMlN])

  const totalMedida = useMemo(() => medidaPorUnidad * cantidadN, [medidaPorUnidad, cantidadN])

  const costoMaterialPorUnidad = useMemo(() => {
    if (!selectedMaterial || !unidad) return 0
    if (unidad === "m2") return (selectedMaterial.precioM2 || 0) * medidaPorUnidad
    return (selectedMaterial.precioMetro || 0) * medidaPorUnidad
  }, [selectedMaterial, unidad, medidaPorUnidad])

  const terminadosDisponibles = useMemo(() => {
    if (!unidad) return []
    const active = terminados.filter((t) => t.activo !== false)
    return active.filter((t) => {
      const u = normalizeUnidad(t.unidadAplicacion)
      if (u === "unidad") return true
      return u === unidad
    })
  }, [terminados, unidad])

  const terminadosDraft = useMemo<ItemCotizacionTerminadoDraft[]>(() => {
    if (!unidad || !selectedTerminadoIds.size) return []

    const selected = Array.from(selectedTerminadoIds)
      .map((id) => terminadosDisponibles.find((t) => t.id === id))
      .filter(Boolean) as Terminado[]

    return selected.map((t) => {
      const u = normalizeUnidad(t.unidadAplicacion)
      const baseCantidad = u === "unidad" ? cantidadN : totalMedida
      const costoTotal = baseCantidad * (Number(t.precioUnitario) || 0)

      return {
        terminadoId: t.id,
        unidadAplicacion: u,
        baseCantidad,
        precioUnitario: Number(t.precioUnitario) || 0,
        costoTotal,
        nombre: t.nombre,
      }
    })
  }, [unidad, selectedTerminadoIds, terminadosDisponibles, cantidadN, totalMedida])

  const costoTerminadosTotal = useMemo(
    () => terminadosDraft.reduce((sum, x) => sum + (Number(x.costoTotal) || 0), 0),
    [terminadosDraft]
  )

  const subtotal = useMemo(() => {
    const totalMaterial = costoMaterialPorUnidad * cantidadN
    return totalMaterial + costoTerminadosTotal
  }, [costoMaterialPorUnidad, cantidadN, costoTerminadosTotal])

  const precioUnitario = useMemo(() => {
    if (!cantidadN) return 0
    return subtotal / cantidadN
  }, [subtotal, cantidadN])

  const materialesFiltrados = useMemo(() => {
    const base = materiales.filter((m) => Boolean(m.precioM2 || m.precioMetro))
    const q = materialSearch.trim().toLowerCase()
    if (!q) return base.slice(0, 80)
    return base
      .filter((m) => {
        return (
          String(m.nombre || "").toLowerCase().includes(q) ||
          String(m.externalId || "").toLowerCase().includes(q)
        )
      })
      .slice(0, 80)
  }, [materiales, materialSearch])

  useEffect(() => {
    if (!open) return

    const applyEdit = () => {
      if (!edit?.itemId) return
      const item = edit.item

      if (item.materialId) {
        setMaterialId(String(item.materialId))
        const mat = materiales.find((m) => m.id === String(item.materialId))
        setMaterialSearch(mat?.nombre ?? "")
      }

      setDescripcion(typeof item.descripcion === "string" ? item.descripcion : "")
      setCantidad(item.cantidad != null ? String(item.cantidad) : "1")

      const itemUnidad = item.unidad === "ml" ? "ml" : "m2"

      if (itemUnidad === "m2") {
        setAnchoCm(item.ancho != null ? String(item.ancho) : "")
        setAltoCm(item.alto != null ? String(item.alto) : "")
        setLargoMl("")
      } else {
        setAnchoCm(item.ancho != null ? String(item.ancho) : "")
        setAltoCm("")
        setLargoMl(item.m2 != null ? String(item.m2) : "")
      }

      const tds = Array.isArray(item.terminados) ? item.terminados : []
      const ids = new Set<string>(
        tds
          .map((x) => {
            const rec = asRecord(x)
            const id = rec.terminadoId
            return typeof id === "string" ? id : ""
          })
          .filter(Boolean)
      )
      setSelectedTerminadoIds(ids)
    }

    const applyDefaults = () => {
      setMaterialSearch("")
      setMaterialId("")
      setDescripcion("")
      setCantidad("1")
      setAnchoCm("")
      setAltoCm("")
      setLargoMl("")
      setSelectedTerminadoIds(new Set())
    }

    if (edit?.itemId) applyEdit()
    else applyDefaults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit?.itemId])

  useEffect(() => {
    if (!open) return
    if (terminados.length) return
    if (isLoadingTerminados) return

    const load = async () => {
      setIsLoadingTerminados(true)
      setTerminadosError(null)
      try {
        const res = await fetch("/api/terminados", { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setTerminadosError(typeof json?.error === "string" ? json.error : "No se pudieron cargar los terminados")
          setTerminados([])
          return
        }
        setTerminados(Array.isArray(json.data) ? (json.data as Terminado[]) : [])
      } catch (error) {
        console.error("Error cargando terminados:", error)
        setTerminadosError("No se pudieron cargar los terminados")
        setTerminados([])
      } finally {
        setIsLoadingTerminados(false)
      }
    }

    void load()
  }, [open, terminados.length, isLoadingTerminados])

  useEffect(() => {
    if (!selectedMaterial) return

    // Defaults por producto
    const u = unidad
    if (!u) return

    const defaultAncho = selectedMaterial.ancho != null ? String(selectedMaterial.ancho) : ""
    const defaultLargo = selectedMaterial.largo != null ? String(selectedMaterial.largo) : ""

    if (u === "m2") {
      if (!anchoCm) setAnchoCm(defaultAncho)
      if (!altoCm) setAltoCm(defaultLargo)
      if (largoMl) setLargoMl("")
      return
    }

    // ml
    if (!anchoCm) setAnchoCm(defaultAncho)
    if (!largoMl) setLargoMl(defaultLargo)
    if (altoCm) setAltoCm("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaterial?.id, unidad])

  const toggleTerminado = (id: string) => {
    setSelectedTerminadoIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSubmit = () => {
    if (!selectedMaterial || !unidad) {
      alert("Selecciona un producto por metraje")
      return
    }

    if (!cantidadN) {
      alert("Cantidad inválida")
      return
    }

    if (!medidaPorUnidad || (unidad === "m2" && (!anchoCmN || !altoCmN))) {
      alert(unidad === "m2" ? "Ingresa ancho y alto" : "Ingresa el largo (ml)")
      return
    }

    const desc = (descripcion || "").trim() || selectedMaterial.nombre

    const draft: MetrajeItemDraft = {
      id: edit?.itemId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      descripcion: desc,
      materialId: selectedMaterial.id,
      material: selectedMaterial,
      cantidad: cantidadN,
      unidad,
      ancho: anchoCmN || null,
      alto: unidad === "m2" ? altoCmN || null : null,
      m2: medidaPorUnidad || null,
      precioUnitario,
      subtotal,
      desperdicioPct: 0,
      observaciones: "",
      laminado: false,
      troquelado: false,
      instalacion: false,
      costoLaminado: 0,
      costoTroquelado: 0,
      costoInstalacion: 0,
      terminados: terminadosDraft,
    }

    if (edit?.itemId && onUpdateItem) onUpdateItem(draft)
    else onAddItem(draft)

    onOpenChange(false)
  }

  const title = edit?.itemId ? "Editar item por metraje" : "Cotizador por metraje"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Producto *</Label>
              <div className="relative">
                <Input
                  value={materialSearch}
                  onChange={(e) => {
                    setMaterialSearch(e.target.value)
                    setMaterialDropdownOpen(true)
                    if (!e.target.value.trim()) setMaterialId("")
                  }}
                  onFocus={() => setMaterialDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setMaterialDropdownOpen(false), 120)}
                  placeholder="Buscar por nombre o código…"
                />

                {materialDropdownOpen ? (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-background p-1 shadow-sm max-h-64 overflow-auto">
                    {materialesFiltrados.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
                    ) : (
                      materialesFiltrados.map((mat) => {
                        const hint =
                          (mat.precioM2 ? `${formatCurrency(mat.precioM2)}/m²` : "") ||
                          (mat.precioMetro ? `${formatCurrency(mat.precioMetro)}/ml` : "")

                        return (
                          <button
                            key={mat.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 rounded-sm text-sm hover:bg-muted ${
                              mat.id === materialId ? "bg-muted" : ""
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setMaterialId(mat.id)
                              setMaterialSearch(mat.nombre)
                              setMaterialDropdownOpen(false)
                            }}
                          >
                            <div className="truncate">{formatMaterialLabel(mat)}</div>
                            {hint ? <div className="text-xs text-muted-foreground truncate">{hint}</div> : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-span-2">
              <Label>Descripción</Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Aviso para vitrina…" />
            </div>

            <div>
              <Label>Cantidad *</Label>
              <Input type="number" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>

            {unidad === "m2" ? (
              <>
                <div>
                  <Label>Ancho (cm) *</Label>
                  <Input type="number" step="0.01" value={anchoCm} onChange={(e) => setAnchoCm(e.target.value)} />
                </div>
                <div>
                  <Label>Alto (cm) *</Label>
                  <Input type="number" step="0.01" value={altoCm} onChange={(e) => setAltoCm(e.target.value)} />
                </div>
              </>
            ) : unidad === "ml" ? (
              <>
                <div>
                  <Label>Ancho (cm) (opcional)</Label>
                  <Input type="number" step="0.01" value={anchoCm} onChange={(e) => setAnchoCm(e.target.value)} />
                </div>
                <div>
                  <Label>Largo por unidad (ml) *</Label>
                  <Input type="number" step="0.01" value={largoMl} onChange={(e) => setLargoMl(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="col-span-2 text-sm text-muted-foreground">
                Selecciona un producto con precio por m² o por ml.
              </div>
            )}
          </div>

          <div className="rounded border p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Medida por unidad:</span>
              <span className="font-medium">
                {unidad === "m2"
                  ? `${medidaPorUnidad.toFixed(4)} m²`
                  : unidad === "ml"
                    ? `${medidaPorUnidad.toFixed(2)} ml`
                    : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Medida total:</span>
              <span className="font-medium">
                {unidad === "m2"
                  ? `${totalMedida.toFixed(4)} m²`
                  : unidad === "ml"
                    ? `${totalMedida.toFixed(2)} ml`
                    : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal material:</span>
              <span className="font-medium">{formatCurrency(costoMaterialPorUnidad * cantidadN)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal acabados:</span>
              <span className="font-medium">{formatCurrency(costoTerminadosTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Subtotal item:</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">Acabados</div>
              {isLoadingTerminados ? <div className="text-xs text-muted-foreground">Cargando…</div> : null}
            </div>

            {terminadosError ? (
              <div className="text-sm text-red-600">{terminadosError}</div>
            ) : terminadosDisponibles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No hay terminados disponibles para esta unidad.
              </div>
            ) : (
              <div className="max-h-52 overflow-auto rounded border p-2 space-y-1">
                {terminadosDisponibles.map((t) => {
                  const checked = selectedTerminadoIds.has(t.id)
                  const u = normalizeUnidad(t.unidadAplicacion)

                  return (
                    <label
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-muted cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTerminado(t.id)}
                        />
                        <div>
                          <div className="text-sm">{t.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(Number(t.precioUnitario) || 0)}/{u === "m2" ? "m²" : u === "ml" ? "ml" : "und"}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">{u.toUpperCase()}</div>
                    </label>
                  )
                })}
              </div>
            )}

            {terminadosDraft.length ? (
              <div className="rounded border p-2 text-sm">
                <div className="font-medium">Resumen acabados</div>
                <div className="mt-1 space-y-1">
                  {terminadosDraft.map((x) => (
                    <div key={x.terminadoId} className="flex justify-between gap-3">
                      <span className="truncate">{x.nombre || x.terminadoId}</span>
                      <span className="text-muted-foreground">{formatCurrency(x.costoTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit}>
            {edit?.itemId ? "Guardar cambios" : "Agregar item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
