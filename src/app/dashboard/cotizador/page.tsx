/**
 * Página del Cotizador Inteligente
 * Crear cotizaciones con cálculo automático de precios
 */

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { LitografiaQuoteDialog, type LitografiaMeta } from "@/components/litografia/litografia-quote-dialog"
import CotizacionPDF, { type CotizacionPdfData } from "@/lib/pdf-template"
import type { CotizacionTemplateSettings } from "@/lib/cotizacion-template"

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">Cargando vista previa...</div>
    ),
  }
)

interface Cliente {
  id: string
  nombre: string
  empresa?: string | null
  email?: string | null
}

interface Material {
  id: string
  nombre: string
  tipo: string
  precioM2?: number | null
  precioMetro?: number | null
  precioUnidad?: number | null
  unidadMedida: string
  quantityDiscounts?: Array<{
    id: string
    minQty: number
    discountPct: number
  }>
}

interface ItemCotizacion {
  id: string
  descripcion: string
  materialId: string | null
  material: Material | null
  cantidad: number
  ancho: number | null
  alto: number | null
  m2: number | null
  precioUnitario: number
  subtotal: number
  laminado: boolean
  troquelado: boolean
  instalacion: boolean
  costoLaminado: number
  costoTroquelado: number
  costoInstalacion: number
  observaciones: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

export default function CotizadorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cotizacionIdParam = searchParams.get("id")

  const [previewCotizacion, setPreviewCotizacion] = useState<(CotizacionPdfData & { id: string; estado?: string }) | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<CotizacionTemplateSettings | null>(null)
  const [sendingPreviewEmail, setSendingPreviewEmail] = useState(false)
  const [sharingPreviewWhatsapp, setSharingPreviewWhatsapp] = useState(false)

  const [taxConfig, setTaxConfig] = useState<{ pricesIncludeIva: boolean; ivaPct: number }>({
    pricesIncludeIva: true,
    ivaPct: 19,
  })

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCotizacion, setIsLoadingCotizacion] = useState(false)

  const [litografiaOpen, setLitografiaOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Datos de la cotización
  const [clienteId, setClienteId] = useState("")
  const [clienteSearch, setClienteSearch] = useState("")
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false)
  const [descripcion, setDescripcion] = useState("")
  const [validezDias, setValidezDias] = useState("15")
  const [tiempoEntrega, setTiempoEntrega] = useState("")
  const [observaciones, setObservaciones] = useState("")

  // Items
  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [editingManualItemId, setEditingManualItemId] = useState<string | null>(null)
  const [litografiaEdit, setLitografiaEdit] = useState<{ itemId: string; meta: LitografiaMeta } | null>(null)
  
  // Formulario de nuevo item
  const [showItemForm, setShowItemForm] = useState(false)
  const [materialSearch, setMaterialSearch] = useState("")
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [itemForm, setItemForm] = useState({
    descripcion: "",
    materialId: "",
    cantidad: "1",
    precioUnitario: "",
    observaciones: ""
  })

  const filteredClientes = (clienteSearch.trim()
    ? clientes.filter((c) => {
        const q = clienteSearch.trim().toLowerCase()
        return (
          String(c.nombre || "").toLowerCase().includes(q) ||
          String((c as unknown as { documento?: string }).documento || "").toLowerCase().includes(q) ||
          String((c as unknown as { email?: string }).email || "").toLowerCase().includes(q)
        )
      })
    : clientes
  ).slice(0, 50)

  const filteredMateriales = (materialSearch.trim()
    ? materiales.filter((m) => {
        const q = materialSearch.trim().toLowerCase()
        return String(m.nombre || "").toLowerCase().includes(q)
      })
    : materiales
  ).slice(0, 80)

  useEffect(() => {
    if (!clienteId) return
    if (clienteSearch.trim()) return
    const c = clientes.find((x) => x.id === clienteId)
    if (!c) return
    setClienteSearch(`${c.nombre}${c.empresa ? ` - ${c.empresa}` : ""}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, clientes])

  useEffect(() => {
    if (!itemForm.materialId) return
    if (materialSearch.trim()) return
    const m = materiales.find((x) => x.id === itemForm.materialId)
    if (!m) return
    setMaterialSearch(m.nombre)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemForm.materialId, materiales])

  // Cálculos
  const [subtotal, setSubtotal] = useState(0)
  const [descuento, setDescuento] = useState(0)
  const [iva, setIva] = useState(0)
  const [utilidadPct, setUtilidadPct] = useState(30)
  const [utilidad, setUtilidad] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchClientes()
    fetchMateriales()
    void fetchCotizacionesConfig()
  }, [])

  const fetchCotizacionesConfig = async () => {
    try {
      const res = await fetch('/api/configuracion/cotizaciones', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.ok && json?.data) {
        const pricesIncludeIva = Boolean(json.data.pricesIncludeIva)
        const ivaPct = Math.min(100, Math.max(0, Number(json.data.ivaPct ?? 19)))
        setTaxConfig({ pricesIncludeIva, ivaPct })
      }
    } catch (error) {
      console.error('Error al cargar config de IVA:', error)
    }
  }

  useEffect(() => {
    const id = cotizacionIdParam?.trim() || null
    if (!id) {
      setEditingId(null)
      return
    }
    if (editingId === id) return

    const load = async () => {
      setIsLoadingCotizacion(true)
      try {
        const res = await fetch(`/api/cotizaciones/${id}`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok || !data?.success) {
          alert(data?.error || "No se pudo cargar la cotización")
          router.push("/dashboard/cotizador")
          return
        }

        const cot = data.data as {
          id: string
          clienteId: string
          descuento?: number
          validezDias?: number
          observaciones?: string | null
          items?: unknown[]
        }

        setEditingId(cot.id)
        setClienteId(String(cot.clienteId || ""))
        setDescuento(typeof cot.descuento === "number" ? cot.descuento : Number(cot.descuento || 0))
        setValidezDias(String(cot.validezDias ?? 15))

        const obsRaw = String(cot.observaciones || "").trim()
        if (obsRaw) {
          const parts = obsRaw.split(/\n\n+/)
          const maybeDesc = (parts[0] || "").trim()
          const maybeEntrega = parts.find((p) => /^Tiempo de entrega:/i.test(p.trim()))
          const entregaValue = maybeEntrega ? maybeEntrega.replace(/^Tiempo de entrega:\s*/i, "").trim() : ""
          const rest = parts
            .filter((p) => p.trim() && p.trim() !== maybeDesc && p !== maybeEntrega)
            .join("\n\n")
            .trim()

          setDescripcion(maybeDesc)
          setTiempoEntrega(entregaValue)
          setObservaciones(rest)
        } else {
          setDescripcion("")
          setTiempoEntrega("")
          setObservaciones("")
        }

        const mappedItems: ItemCotizacion[] = Array.isArray(cot.items)
          ? cot.items.map((raw: unknown) => {
              const it = asRecord(raw)
              const matRec = asRecord(it.material)
              const material = it.material
                ? {
                    id: String(matRec.id || ""),
                    nombre: String(matRec.nombre || ""),
                    tipo: String(matRec.tipo || ""),
                    precioM2: typeof matRec.precioM2 === "number" ? matRec.precioM2 : null,
                    precioMetro: typeof matRec.precioMetro === "number" ? matRec.precioMetro : null,
                    precioUnidad: typeof matRec.precioUnidad === "number" ? matRec.precioUnidad : null,
                    unidadMedida: String(matRec.unidadMedida || "unidad"),
                    quantityDiscounts: [],
                  }
                : null

              const cantidadRaw = it.cantidad
              const precioUnitarioRaw = it.precioUnitario
              const subtotalRaw = it.subtotal

              return {
                id: String(it.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
                descripcion: String(it.descripcion || ""),
                materialId: it.materialId ? String(it.materialId) : null,
                material,
                cantidad: typeof cantidadRaw === "number" ? cantidadRaw : parseFloat(String(cantidadRaw || 1)) || 1,
                ancho: it.ancho != null ? Number(it.ancho) : null,
                alto: it.alto != null ? Number(it.alto) : null,
                m2: it.area != null ? Number(it.area) : null,
                precioUnitario:
                  typeof precioUnitarioRaw === "number" ? precioUnitarioRaw : parseFloat(String(precioUnitarioRaw || 0)) || 0,
                subtotal: typeof subtotalRaw === "number" ? subtotalRaw : parseFloat(String(subtotalRaw || 0)) || 0,
                laminado: Boolean(it.laminado),
                troquelado: Boolean(it.troquelado),
                instalacion: Boolean(it.instalacion),
                costoLaminado: 0,
                costoTroquelado: 0,
                costoInstalacion: it.costoInstalacion != null ? Number(it.costoInstalacion) : 0,
                observaciones: "",
              }
            })
          : []

        setItems(mappedItems)
        setShowItemForm(false)
      } catch (e) {
        console.error("Error al cargar cotización:", e)
        alert("Error al cargar la cotización")
        router.push("/dashboard/cotizador")
      } finally {
        setIsLoadingCotizacion(false)
      }
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacionIdParam])

  useEffect(() => {
    calcularTotales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, descuento, taxConfig.pricesIncludeIva, taxConfig.ivaPct, utilidadPct])

  const fetchClientes = async () => {
    try {
      const response = await fetch('/api/clientes')
      const data = await response.json()
      if (data.success) {
        setClientes(data.data)
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error)
    }
  }

  const fetchMateriales = async () => {
    try {
      const response = await fetch('/api/materiales?activo=true')
      const data = await response.json()
      if (data.success) {
        setMateriales(data.data)
      }
    } catch (error) {
      console.error('Error al cargar materiales:', error)
    }
  }

  const abrirPreviewPorId = async (id: string) => {
    try {
      const res = await fetch(`/api/cotizaciones/${id}`, { cache: "no-store" })
      if (!res.ok) throw new Error("No se pudo cargar la cotización")
      const data = await res.json()
      if (!data?.success || !data?.data) throw new Error(data?.error ?? "No se pudo cargar la cotización")
      setPreviewCotizacion(data.data as CotizacionPdfData & { id: string; estado?: string })

      const templateRes = await fetch('/api/cotizacion-template', { cache: "no-store" })
      if (templateRes.ok) {
        const templateData = await templateRes.json()
        const settings = templateData?.success && templateData?.data?.settings
          ? (templateData.data.settings as CotizacionTemplateSettings)
          : null
        setPreviewTemplate(settings)
      } else {
        setPreviewTemplate(null)
      }
    } catch (error) {
      console.error('Error al cargar datos para preview:', error)
      alert('Error al cargar el preview')
    }
  }

  const buildWhatsAppMessage = (cotizacion: CotizacionPdfData & { numero: string }, pdfUrl: string) => {
    const createdAt = new Date(cotizacion.createdAt)
    const validezDias = Number(cotizacion.validezDias) || 15
    const validUntil = new Date(createdAt.getTime() + validezDias * 24 * 60 * 60 * 1000)
    const items = Array.isArray(cotizacion.items) ? cotizacion.items : []

    const resumenItems = items
      .slice(0, 4)
      .map((it) => {
        const name = String(it?.descripcion || it?.material?.nombre || 'Ítem').trim() || 'Ítem'
        const qty = typeof it?.cantidad === 'number' && !Number.isNaN(it.cantidad) ? it.cantidad : null
        const unit = String(it?.unidad || '').trim()
        const qtyLabel = qty !== null ? `${qty}${unit ? ` ${unit}` : ''}` : null
        return `• ${qtyLabel ? `${qtyLabel} - ` : ''}${name}`
      })
      .join('\n')

    const hayMasItems = items.length > 4

    return [
      '*SGDigital Softwares*',
      `*Cotización ${cotizacion.numero}*`,
      '',
      `*Cliente:* ${cotizacion?.cliente?.nombre ?? '-'}`,
      `*Total:* ${formatCurrency(Number(cotizacion.total) || 0)}`,
      `*Fecha:* ${createdAt.toLocaleDateString('es-MX')}`,
      `*Vigencia:* hasta ${validUntil.toLocaleDateString('es-MX')}`,
      '',
      resumenItems ? '*Resumen:*\n' + resumenItems + (hayMasItems ? '\n• …' : '') : '',
      '',
      `*PDF:* ${pdfUrl}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  const compartirPreviewPorWhatsApp = async () => {
    if (!previewCotizacion?.id) return
    setSharingPreviewWhatsapp(true)
    try {
      const res = await fetch(`/api/cotizaciones/${previewCotizacion.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlSeconds: 60 * 60 * 24 * 14 }),
      })

      const json = await res.json().catch(() => ({ success: false }))
      if (!res.ok || !json?.success) {
        alert(`No se pudo generar link de WhatsApp: ${json?.error ?? 'Error'}`)
        return
      }

      const url: string = json.data.url
      const mensaje = buildWhatsAppMessage(previewCotizacion, url)
      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al preparar el WhatsApp')
    } finally {
      setSharingPreviewWhatsapp(false)
    }
  }

  const enviarPreviewPorEmail = async () => {
    if (!previewCotizacion?.id) return
    const destinatario = String(previewCotizacion?.cliente?.email || '').trim()
    if (!destinatario) {
      alert('El cliente no tiene email registrado')
      return
    }

    const confirmar = window.confirm(
      `¿Enviar cotización ${previewCotizacion?.numero ?? ''} a ${destinatario}?`
    )
    if (!confirmar) return

    setSendingPreviewEmail(true)
    try {
      const res = await fetch(`/api/cotizaciones/${previewCotizacion.id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatarios: [destinatario],
          copiarContabilidad: String(previewCotizacion?.estado) === 'APROBADA',
        }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Error' }))
        alert(`Error: ${error?.error ?? 'No se pudo enviar'}`)
        return
      }
      alert('Cotización enviada correctamente')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al enviar el email')
    } finally {
      setSendingPreviewEmail(false)
    }
  }

  const calcularPrecioItem = () => {
    const material = materiales.find(m => m.id === itemForm.materialId)
    if (!material) return

    const cantidad = parseFloat(itemForm.cantidad) || 1

    let precioBase = 0

    // Calcular según tipo de material
    if (material.precioUnidad) {
      precioBase = material.precioUnidad * cantidad
    }

    // Descuento por cantidad (configurable por material)
    const cantidadDiscountPct = (() => {
      const tiers = material.quantityDiscounts ?? []
      let best = 0
      for (const tier of tiers) {
        if (cantidad >= tier.minQty && tier.discountPct > best) best = tier.discountPct
      }
      return best
    })()

    const precioBaseConDescuento = precioBase * (1 - cantidadDiscountPct / 100)
    const precioUnitario = cantidad > 0 ? precioBaseConDescuento / cantidad : 0

    setItemForm(prev => ({
      ...prev,
      precioUnitario: precioUnitario.toFixed(2)
    }))
  }

  useEffect(() => {
    if (itemForm.materialId) {
      calcularPrecioItem()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    itemForm.materialId,
    itemForm.cantidad
  ])

  const agregarItem = () => {
    const material = materiales.find(m => m.id === itemForm.materialId)
    if (!material) {
      alert('Selecciona un producto')
      return
    }

    // Este formulario manual es solo para productos por unidad.
    // Los productos por m²/ml se agregan por el Cotizador de Litografía.
    if (material.precioM2 || material.precioMetro) {
      alert('Este producto se cotiza por medidas (m² / ml). Usa “Cotizador Litografía”.')
      return
    }

    const cantidad = parseFloat(itemForm.cantidad) || 1
    const ancho = null
    const alto = null
    const precioUnitario = parseFloat(itemForm.precioUnitario) || 0
    const subtotal = precioUnitario * cantidad

    const descripcionItem = (() => {
      const raw = (itemForm.descripcion || "").trim()
      if (raw) return raw
      const dims = ancho && alto ? ` (${ancho}×${alto} cm)` : ""
      return `${material.nombre}${dims}`
    })()

    const nuevoItem: ItemCotizacion = {
      id: editingManualItemId ?? Date.now().toString(),
      descripcion: descripcionItem,
      materialId: itemForm.materialId,
      material,
      cantidad,
      ancho,
      alto,
      m2: null,
      precioUnitario,
      subtotal,
      laminado: false,
      troquelado: false,
      instalacion: false,
      costoLaminado: 0,
      costoTroquelado: 0,
      costoInstalacion: 0,
      observaciones: itemForm.observaciones
    }

    if (editingManualItemId) {
      setItems((prev) => prev.map((it) => (it.id === editingManualItemId ? nuevoItem : it)))
      setEditingManualItemId(null)
    } else {
      setItems((prev) => [...prev, nuevoItem])
    }

    setShowItemForm(false)
    resetItemForm()
  }

  const agregarItemLitografia = (payload: {
    descripcion: string
    cantidad: number
    unidad: string
    desperdicioPct: number
    precioUnitario: number
    subtotal: number
    meta?: LitografiaMeta
  }) => {
    const metaStr = payload.meta ? `LITOGRAFIA_META:${JSON.stringify(payload.meta)}` : ""
    const nuevoItem: ItemCotizacion = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      descripcion: payload.descripcion,
      materialId: null,
      material: null,
      cantidad: payload.cantidad,
      ancho: null,
      alto: null,
      m2: null,
      precioUnitario: payload.precioUnitario,
      subtotal: payload.subtotal,
      laminado: false,
      troquelado: false,
      instalacion: false,
      costoLaminado: 0,
      costoTroquelado: 0,
      costoInstalacion: 0,
      observaciones: [
        `Litografía • unidad=${payload.unidad}${payload.desperdicioPct ? ` • desperdicio=${payload.desperdicioPct}%` : ""}`,
        metaStr,
      ]
        .filter(Boolean)
        .join("\n"),
    }

    setItems((prev) => [...prev, nuevoItem])
    setShowItemForm(false)
  }

  const actualizarItemLitografia = (payload: {
    itemId: string
    descripcion: string
    cantidad: number
    unidad: string
    desperdicioPct: number
    precioUnitario: number
    subtotal: number
    meta?: LitografiaMeta
  }) => {
    const metaStr = payload.meta ? `LITOGRAFIA_META:${JSON.stringify(payload.meta)}` : ""
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== payload.itemId) return it
        return {
          ...it,
          descripcion: payload.descripcion,
          cantidad: payload.cantidad,
          precioUnitario: payload.precioUnitario,
          subtotal: payload.subtotal,
          observaciones: [
            `Litografía • unidad=${payload.unidad}${payload.desperdicioPct ? ` • desperdicio=${payload.desperdicioPct}%` : ""}`,
            metaStr,
          ]
            .filter(Boolean)
            .join("\n"),
        }
      })
    )
    setLitografiaEdit(null)
    setLitografiaOpen(false)
  }

  const eliminarItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const parseLitografiaMeta = (raw: string): LitografiaMeta | null => {
    const idx = raw.indexOf("LITOGRAFIA_META:")
    if (idx < 0) return null
    const json = raw.slice(idx + "LITOGRAFIA_META:".length).trim()
    if (!json) return null
    try {
      const parsed = JSON.parse(json) as unknown
      if (!parsed || typeof parsed !== "object") return null
      const rec = parsed as Record<string, unknown>
      if (rec.version !== 1) return null
      return parsed as LitografiaMeta
    } catch {
      return null
    }
  }

  const editarItem = (item: ItemCotizacion) => {
    // Litografía (con meta) => reabrir el mismo cotizador
    if (!item.materialId && !item.material && typeof item.observaciones === "string") {
      const meta = parseLitografiaMeta(item.observaciones)
      if (meta) {
        setLitografiaEdit({ itemId: item.id, meta })
        setShowItemForm(false)
        setLitografiaOpen(true)
        return
      }
    }

    // Manual (por unidad) => reusar el formulario de creación
    if (item.materialId) {
      setEditingManualItemId(item.id)
      setItemForm({
        descripcion: String(item.descripcion || ""),
        materialId: String(item.materialId || ""),
        cantidad: String(item.cantidad ?? 1),
        precioUnitario: String(item.precioUnitario ?? ""),
        observaciones: String(item.observaciones || ""),
      })

      const mat = materiales.find((m) => m.id === item.materialId)
      setMaterialSearch(mat?.nombre ?? "")
      setShowItemForm(true)
      return
    }

    // Fallback mínimo si no se puede reconstruir
    alert("Este item no tiene formato editable disponible (falta metadata).")
  }

  const resetItemForm = () => {
    setItemForm({
      descripcion: "",
      materialId: "",
      cantidad: "1",
      precioUnitario: "",
      observaciones: ""
    })
  }

  const calcularTotales = () => {
    const sub = items.reduce((sum, item) => sum + item.subtotal, 0)
    const desc = parseFloat(descuento.toString()) || 0
    const subConDescuento = Math.max(0, sub - Math.max(0, desc))

    const ivaPct = Math.min(100, Math.max(0, taxConfig.ivaPct))
    const rate = ivaPct / 100

    let ivaCalc = 0
    let tot = 0

    if (taxConfig.pricesIncludeIva) {
      const denom = 1 + rate
      const base = denom > 0 ? subConDescuento / denom : subConDescuento
      ivaCalc = subConDescuento - base
      tot = subConDescuento
    } else {
      ivaCalc = subConDescuento * rate
      tot = subConDescuento + ivaCalc
    }

    const uPct = Math.min(100, Math.max(30, Number(utilidadPct) || 30))
    const utilidadCalc = tot * (uPct / 100)
    const totFinal = tot + utilidadCalc

    setSubtotal(sub)
    setIva(ivaCalc)
    setUtilidad(utilidadCalc)
    setTotal(totFinal)
  }

  const guardarCotizacion = async () => {
    if (!clienteId || items.length === 0) {
      alert('Selecciona un cliente y agrega al menos un item')
      return
    }

    setIsLoading(true)
    try {
      const url = editingId ? `/api/cotizaciones/${editingId}` : '/api/cotizaciones'
      const method = editingId ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteId,
          descripcion,
          items: items.map(item => ({
            descripcion: item.descripcion,
            materialId: item.materialId,
            cantidad: item.cantidad,
            ancho: item.ancho,
            alto: item.alto,
            m2: item.m2,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            laminado: item.laminado,
            troquelado: item.troquelado,
            instalacion: item.instalacion,
            costoLaminado: item.costoLaminado,
            costoTroquelado: item.costoTroquelado,
            costoInstalacion: item.costoInstalacion,
            observaciones: item.observaciones
          })),
          subtotal,
          descuento,
          iva,
          total,
          validezDias,
          tiempoEntrega,
          observaciones
        }),
      })

      const data = await response.json()

      if (data.success) {
        const id = data?.data?.id as string | undefined
        const numero = data?.data?.numero

        // Si estamos CREANDO una nueva cotización, abrir preview con acciones.
        if (!editingId && id) {
          await abrirPreviewPorId(id)
          resetCotizador()
          return
        }

        alert(`Cotización ${numero || ''} actualizada exitosamente!`)

        // Limpiar / salir de edición
        router.push('/dashboard/cotizador')
        resetCotizador()
      } else {
        alert(data.error || 'Error al guardar cotización')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar cotización')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedMaterial = materiales.find(m => m.id === itemForm.materialId) || null
  const cantidadActual = parseFloat(itemForm.cantidad) || 1
  const cantidadDiscountPct = (() => {
    if (!selectedMaterial) return 0
    const tiers = selectedMaterial.quantityDiscounts ?? []
    let best = 0
    for (const tier of tiers) {
      if (cantidadActual >= tier.minQty && tier.discountPct > best) best = tier.discountPct
    }
    return best
  })()

  const resetCotizador = () => {
    setEditingId(null)
    setClienteId("")
    setDescripcion("")
    setValidezDias("15")
    setTiempoEntrega("")
    setObservaciones("")
    setItems([])
    setShowItemForm(false)
    setEditingManualItemId(null)
    setLitografiaEdit(null)
    resetItemForm()
    setSubtotal(0)
    setDescuento(0)
    setIva(0)
    setTotal(0)
  }

  return (
    <div className="space-y-6">
      <LitografiaQuoteDialog
        open={litografiaOpen}
        onOpenChange={setLitografiaOpen}
        onAddItem={agregarItemLitografia}
        edit={litografiaEdit}
        onUpdateItem={actualizarItemLitografia}
      />

      {/* Preview post-guardar */}
      <Dialog
        open={!!previewCotizacion}
        onOpenChange={(open) => {
          if (!open) setPreviewCotizacion(null)
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Vista previa - {previewCotizacion?.numero}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={sharingPreviewWhatsapp}
              onClick={() => void compartirPreviewPorWhatsApp()}
            >
              {sharingPreviewWhatsapp ? 'Generando link…' : 'WhatsApp'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={sendingPreviewEmail}
              onClick={() => void enviarPreviewPorEmail()}
            >
              {sendingPreviewEmail ? 'Enviando…' : 'Correo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const id = previewCotizacion?.id
                setPreviewCotizacion(null)
                if (id) router.push(`/dashboard/cotizador?id=${id}`)
              }}
            >
              Editar
            </Button>
            <Button type="button" onClick={() => setPreviewCotizacion(null)}>
              Cerrar
            </Button>
          </div>

          {previewCotizacion ? (
            <div className="h-[70vh] w-full overflow-hidden rounded border">
              <PDFViewer width="100%" height="100%">
                <CotizacionPDF
                  cotizacion={previewCotizacion}
                  template={previewTemplate || undefined}
                />
              </PDFViewer>
            </div>
          ) : null}

          <DialogFooter />
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cotizador Inteligente</h1>
            <p className="text-muted-foreground">
              {isLoadingCotizacion
                ? 'Cargando cotización…'
                : editingId
                  ? `Editando cotización (${editingId})`
                  : 'Crea cotizaciones con cálculo automático de precios'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" type="button">
              <Link href="/dashboard/cotizaciones">Historial</Link>
            </Button>
            <Button asChild variant="outline" size="sm" type="button">
              <Link href="/dashboard/cotizaciones/plantilla">Editar plantilla</Link>
            </Button>
            {editingId ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  router.push('/dashboard/cotizador')
                  resetCotizador()
                }}
              >
                Cancelar edición
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos básicos */}
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <div className="relative">
                    <Input
                      id="cliente"
                      value={clienteSearch}
                      onChange={(e) => {
                        setClienteSearch(e.target.value)
                        setClienteDropdownOpen(true)
                        if (!e.target.value.trim()) setClienteId("")
                      }}
                      onFocus={() => setClienteDropdownOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setClienteDropdownOpen(false), 120)
                      }}
                      placeholder="Buscar cliente por nombre, documento o email…"
                      required
                    />

                    {clienteDropdownOpen ? (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-background p-1 shadow-sm max-h-64 overflow-auto">
                        {filteredClientes.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
                        ) : (
                          filteredClientes.map((cliente) => {
                            const label = `${cliente.nombre}${cliente.empresa ? ` - ${cliente.empresa}` : ""}`
                            return (
                              <button
                                key={cliente.id}
                                type="button"
                                className={`w-full text-left px-3 py-2 rounded-sm text-sm hover:bg-muted ${
                                  cliente.id === clienteId ? 'bg-muted' : ''
                                }`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  setClienteId(cliente.id)
                                  setClienteSearch(label)
                                  setClienteDropdownOpen(false)
                                }}
                              >
                                <div className="truncate">{label}</div>
                                {'documento' in cliente ? (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {(cliente as unknown as { documento?: string }).documento || ''}
                                  </div>
                                ) : null}
                              </button>
                            )
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Descripción general del proyecto..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="validez">Validez (días)</Label>
                  <Input
                    id="validez"
                    type="number"
                    value={validezDias}
                    onChange={(e) => setValidezDias(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="entrega">Tiempo de Entrega</Label>
                  <Input
                    id="entrega"
                    value={tiempoEntrega}
                    onChange={(e) => setTiempoEntrega(e.target.value)}
                    placeholder="Ej: 5 días hábiles"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items de la Cotización</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setShowItemForm(false)
                      setLitografiaOpen(true)
                    }}
                  >
                    Cotizador Litografía
                  </Button>
                  <Button onClick={() => setShowItemForm(true)} size="sm">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar Item
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showItemForm && (
                <div className="p-4 mb-4 border rounded-lg bg-muted/50 space-y-4">
                  <h4 className="font-medium">{editingManualItemId ? "Editar Item" : "Nuevo Item"}</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="item-material">Producto a cotizar *</Label>
                      <div className="relative">
                        <Input
                          id="item-material"
                          value={materialSearch}
                          onChange={(e) => {
                            setMaterialSearch(e.target.value)
                            setMaterialDropdownOpen(true)
                            if (!e.target.value.trim()) {
                              setItemForm((prev) => ({ ...prev, materialId: '' }))
                            }
                          }}
                          onFocus={() => setMaterialDropdownOpen(true)}
                          onBlur={() => {
                            setTimeout(() => setMaterialDropdownOpen(false), 120)
                          }}
                          placeholder="Buscar producto por nombre…"
                        />

                        {materialDropdownOpen ? (
                          <div className="absolute z-10 mt-1 w-full rounded-md border bg-background p-1 shadow-sm max-h-64 overflow-auto">
                            {filteredMateriales.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
                            ) : (
                              filteredMateriales.map((mat) => {
                                const priceHint =
                                  (mat.precioM2 ? `${formatCurrency(mat.precioM2)}/m²` : '') ||
                                  (mat.precioMetro ? `${formatCurrency(mat.precioMetro)}/ml` : '') ||
                                  (mat.precioUnidad ? `${formatCurrency(mat.precioUnidad)}/und` : '')

                                return (
                                  <button
                                    key={mat.id}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 rounded-sm text-sm hover:bg-muted ${
                                      mat.id === itemForm.materialId ? 'bg-muted' : ''
                                    }`}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setItemForm((prev) => ({ ...prev, materialId: mat.id }))
                                      setMaterialSearch(mat.nombre)
                                      setMaterialDropdownOpen(false)
                                    }}
                                  >
                                    <div className="truncate">{mat.nombre}</div>
                                    {priceHint ? (
                                      <div className="text-xs text-muted-foreground truncate">{priceHint}</div>
                                    ) : null}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="item-desc">Descripción</Label>
                      <Input
                        id="item-desc"
                        value={itemForm.descripcion}
                        onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })}
                        placeholder="Ej: Llaveros para evento..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Opcional. Si la dejas vacía, se usa el nombre del producto.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="item-cantidad">Cantidad *</Label>
                      <Input
                        id="item-cantidad"
                        type="number"
                        step="1"
                        value={itemForm.cantidad}
                        onChange={(e) => setItemForm({ ...itemForm, cantidad: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="item-precio">Precio Unitario</Label>
                      <Input
                        id="item-precio"
                        type="number"
                        step="0.01"
                        value={itemForm.precioUnitario}
                        onChange={(e) => setItemForm({ ...itemForm, precioUnitario: e.target.value })}
                        readOnly
                        className="bg-muted"
                      />
                      {cantidadDiscountPct > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Descuento por cantidad aplicado: {cantidadDiscountPct}%
                        </p>
                      )}
                    </div>

                  </div>

                  <div className="flex gap-2">
                    <Button onClick={agregarItem} size="sm">{editingManualItemId ? "Guardar cambios" : "Agregar"}</Button>
                    <Button
                      onClick={() => {
                        setShowItemForm(false)
                        setEditingManualItemId(null)
                        resetItemForm()
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabla de items */}
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay items. Agrega el primer item a la cotización.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.descripcion}</h4>
                          <p className="text-sm text-muted-foreground">
                            {item.material?.nombre}
                            {item.ancho && item.alto && ` • ${item.ancho} x ${item.alto} cm (${item.m2?.toFixed(2)} m²)`}
                            {` • Cantidad: ${item.cantidad}`}
                          </p>
                          {(item.laminado || item.troquelado || item.instalacion) && (
                            <div className="flex gap-2 mt-1">
                              {item.laminado && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Laminado</span>}
                              {item.troquelado && <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Troquelado</span>}
                              {item.instalacion && <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">Instalación</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.precioUnitario)} c/u
                          </p>
                          <p className="font-bold text-blue-600">
                            {formatCurrency(item.subtotal)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editarItem(item)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => eliminarItem(item.id)}
                            className="text-red-600"
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Términos y condiciones, notas adicionales..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Resumen */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
              <CardDescription>Totales de la cotización</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>

                <div>
                  <Label htmlFor="descuento" className="text-sm">Descuento:</Label>
                  <Input
                    id="descuento"
                    type="number"
                    step="1"
                    value={descuento}
                    onChange={(e) => setDescuento(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">
                    IVA ({Math.min(100, Math.max(0, taxConfig.ivaPct))}%{taxConfig.pricesIncludeIva ? ' incluido' : ''}):
                  </span>
                  <span className="font-medium">{formatCurrency(iva)}</span>
                </div>

                <div>
                  <Label htmlFor="utilidadPct" className="text-sm">Utilidad (%):</Label>
                  <Input
                    id="utilidadPct"
                    type="number"
                    min={30}
                    max={100}
                    step="1"
                    value={utilidadPct}
                    onChange={(e) => setUtilidadPct(parseFloat(e.target.value) || 30)}
                    placeholder="30"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Se calcula sobre el total con IVA incluido.</p>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Utilidad ({Math.min(100, Math.max(30, utilidadPct))}%):</span>
                  <span className="font-medium">{formatCurrency(utilidad)}</span>
                </div>

                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button 
                onClick={guardarCotizacion}
                disabled={isLoading || isLoadingCotizacion || !clienteId || items.length === 0}
                className="w-full"
                size="lg"
              >
                {isLoading
                  ? 'Guardando...'
                  : editingId
                    ? 'Actualizar cotización'
                    : 'Guardar Cotización'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
