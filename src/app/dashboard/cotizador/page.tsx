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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LitografiaQuoteDialog, type LitografiaMeta } from "@/components/litografia/litografia-quote-dialog"
import {
  MetrajeQuoteDialog,
  type MetrajeItemDraft,
  type MetrajeMaterial,
} from "@/components/metraje/metraje-quote-dialog"
import { CustomProductRequestDialog } from "@/components/materiales/custom-product-request-dialog"
import CotizacionPDF, { type CotizacionPdfData } from "@/lib/pdf-template.client"
import type { CotizacionTemplateSettings } from "@/lib/cotizacion-template"
import { useI18n } from "@/components/providers/i18n-provider"
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-link"
import { MobilePdfFallback, useIsMobileViewport } from '@/components/pdf/mobile-pdf-fallback'
import { LitografiaAiAssistant } from "@/components/litografia/litografia-ai-assistant"
import type { LitografiaAiHandoff } from "@/lib/litografia-ai-handoff"

function PdfPreviewLoading() {
  const { t } = useI18n()
  return <div className="flex h-96 items-center justify-center">{t('quotes.preview.loading')}</div>
}

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => <PdfPreviewLoading />,
  }
)

interface Cliente {
  id: string
  nombre: string
  empresa?: string | null
  email?: string | null
  documento?: string | null
}

interface Material {
  id: string
  externalId?: string | null
  nombre: string
  tipo: string
  ancho?: number | null
  largo?: number | null
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
  unidad: string
  ancho: number | null
  alto: number | null
  m2: number | null
  desperdicioPct: number
  precioUnitario: number
  subtotal: number
  laminado: boolean
  troquelado: boolean
  instalacion: boolean
  costoLaminado: number
  costoTroquelado: number
  costoInstalacion: number
  observaciones: string
  terminados: Array<{
    terminadoId: string
    unidadAplicacion: string
    baseCantidad: number
    precioUnitario: number
    costoTotal: number
    nombre?: string
  }>
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function getLitografiaMetaRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null
  const idx = raw.indexOf("LITOGRAFIA_META:")
  if (idx < 0) return null
  const json = raw.slice(idx + "LITOGRAFIA_META:".length).trim()
  if (!json) return null

  try {
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function getLitografiaItemIncludedIvaPct(raw: unknown): number | null {
  const rec = getLitografiaMetaRecord(raw)
  if (!rec || rec.itemSubtotalIncludesIva !== true) return null
  const ivaPct = typeof rec.itemIvaPct === "number" ? rec.itemIvaPct : Number(rec.itemIvaPct)
  return Number.isFinite(ivaPct) && ivaPct > 0 ? ivaPct : null
}

export default function CotizadorPage() {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-MX'
  const isMobileViewport = useIsMobileViewport()

  // La facturación electrónica aún no está habilitada: se muestran opciones, pero quedan deshabilitadas.
  const electronicBillingEnabled = false
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  const formatMaterialLabel = (m: Pick<Material, 'nombre' | 'externalId'>) => {
    const code = String(m.externalId ?? '').trim()
    return code ? `(${code}) ${m.nombre}` : m.nombre
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const cotizacionIdParam = searchParams?.get('id')
  const crmOpportunityIdParam = searchParams?.get('crmOpportunityId')?.trim() || ''
  const clienteIdParam = searchParams?.get('clienteId')?.trim() || ''
  const opportunityTitleParam = searchParams?.get('opportunityTitle')?.trim() || ''

  const [previewCotizacion, setPreviewCotizacion] = useState<(CotizacionPdfData & { id: string; estado?: string }) | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<CotizacionTemplateSettings | null>(null)
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string
      action:
        | 'CREATED'
        | 'UPDATED'
        | 'APPROVED'
        | 'SENT'
        | 'SALE_REALIZED_SET'
        | 'SALE_REALIZED_UNSET'
      effect: 'NONE' | 'DEBIT' | 'CREDIT'
      note: string | null
      autoSummary?: string[]
      before?: unknown
      after?: unknown
      createdAt: string
      performedBy: { id: string; name: string | null; email: string } | null
      requestedBy: { id: string; name: string | null; email: string } | null
    }>
  >([])
  const [traceOpen, setTraceOpen] = useState(false)
  const [sendingPreviewEmail, setSendingPreviewEmail] = useState(false)
  const [sharingPreviewWhatsapp, setSharingPreviewWhatsapp] = useState(false)
  const [approvingForBilling, setApprovingForBilling] = useState(false)
  const [creatingInvoiceFromCotizacion, setCreatingInvoiceFromCotizacion] = useState(false)
  const [remittingElectronic, setRemittingElectronic] = useState(false)
  const [createdInvoice, setCreatedInvoice] = useState<{ id: string; numero: string } | null>(null)
  const [appliedCrmPrefillKey, setAppliedCrmPrefillKey] = useState<string | null>(null)

  const [taxConfig, setTaxConfig] = useState<{ pricesIncludeIva: boolean; ivaPct: number }>({
    pricesIncludeIva: true,
    ivaPct: 19,
  })

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCotizacion, setIsLoadingCotizacion] = useState(false)

  const [litografiaOpen, setLitografiaOpen] = useState(false)
  const [litografiaAiOpen, setLitografiaAiOpen] = useState(false)
  const [metrajeOpen, setMetrajeOpen] = useState(false)
  const [customProductOpen, setCustomProductOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [litografiaAiDraft, setLitografiaAiDraft] = useState<LitografiaAiHandoff | null>(null)
  const [litografiaAiOpenToken, setLitografiaAiOpenToken] = useState(0)

  // Datos de la cotización
  const [clienteId, setClienteId] = useState("")
  const [clienteSearch, setClienteSearch] = useState("")
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false)
  const [createClienteInlineOpen, setCreateClienteInlineOpen] = useState(false)
  const [createClienteInlineSubmitting, setCreateClienteInlineSubmitting] = useState(false)
  const [createClienteInlineError, setCreateClienteInlineError] = useState<string | null>(null)
  const [createClienteInlineForm, setCreateClienteInlineForm] = useState({
    nombre: '',
    segmento: '',
    tipoDocumento: 'CC',
    documento: '',
    email: '',
    telefono: '',
    celular: '',
    direccion: '',
    ciudad: '',
    departamento: '',
  })
  const [descripcion, setDescripcion] = useState("")
  const [validezDias, setValidezDias] = useState("15")
  const [tiempoEntrega, setTiempoEntrega] = useState("")
  const [observaciones, setObservaciones] = useState("")

  // Items
  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [editingManualItemId, setEditingManualItemId] = useState<string | null>(null)
  const [litografiaEdit, setLitografiaEdit] = useState<{ itemId: string; meta: LitografiaMeta } | null>(null)
  const [metrajeEdit, setMetrajeEdit] = useState<{ itemId: string; item: Partial<MetrajeItemDraft> } | null>(null)
  
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
        return (
          String(m.nombre || "").toLowerCase().includes(q) ||
          String(m.externalId || "").toLowerCase().includes(q)
        )
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
  // Nota: la utilidad/margen se maneja en el cotizador de litografía (opcional).
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchClientes()
    fetchMateriales()
    void fetchCotizacionesConfig()
  }, [])

  useEffect(() => {
    if (editingId) return
    if (!crmOpportunityIdParam) return
    if (appliedCrmPrefillKey === crmOpportunityIdParam) return

    if (clienteIdParam) {
      setClienteId(clienteIdParam)
    }

    if (opportunityTitleParam && !descripcion.trim()) {
      setDescripcion(`Cotización para oportunidad CRM: ${opportunityTitleParam}`)
    }

    setAppliedCrmPrefillKey(crmOpportunityIdParam)
  }, [appliedCrmPrefillKey, clienteIdParam, crmOpportunityIdParam, descripcion, editingId, opportunityTitleParam])

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
          alert(t('common.errorWithDetails', { details: data?.error || t('quotes.errors.loadQuote') }))
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
        // Descuento deshabilitado por el momento.
        setDescuento(0)
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
                    externalId: matRec.externalId != null ? String(matRec.externalId) : null,
                    nombre: String(matRec.nombre || ""),
                    tipo: String(matRec.tipo || ""),
                    ancho: typeof matRec.ancho === "number" ? matRec.ancho : null,
                    largo: typeof matRec.largo === "number" ? matRec.largo : null,
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
              const observacionesRaw = it.observaciones

              const terminadosRaw = it.terminados
              const terminadosArr = Array.isArray(terminadosRaw) ? terminadosRaw : []
              const terminados = terminadosArr
                .map((tr: unknown) => {
                  const trRec = asRecord(tr)
                  const termRec = asRecord(trRec.terminado)
                  const terminadoId = trRec.terminadoId ? String(trRec.terminadoId) : String(termRec.id || "")
                  if (!terminadoId) return null
                  return {
                    terminadoId,
                    unidadAplicacion: String(trRec.unidadAplicacion || "unidad"),
                    baseCantidad: Number(trRec.baseCantidad ?? 0) || 0,
                    precioUnitario: Number(trRec.precioUnitario ?? 0) || 0,
                    costoTotal: Number(trRec.costoTotal ?? 0) || 0,
                    nombre: termRec.nombre ? String(termRec.nombre) : undefined,
                  }
                })
                .filter(Boolean) as ItemCotizacion["terminados"]

              return {
                id: String(it.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
                descripcion: String(it.descripcion || ""),
                materialId: it.materialId ? String(it.materialId) : null,
                material,
                cantidad: typeof cantidadRaw === "number" ? cantidadRaw : parseFloat(String(cantidadRaw || 1)) || 1,
                unidad: typeof it.unidad === "string" ? String(it.unidad) : "unidad",
                ancho: it.ancho != null ? Number(it.ancho) : null,
                alto: it.alto != null ? Number(it.alto) : null,
                m2: it.area != null ? Number(it.area) : null,
                desperdicioPct: it.desperdicioPct != null ? Number(it.desperdicioPct) : 0,
                precioUnitario:
                  typeof precioUnitarioRaw === "number" ? precioUnitarioRaw : parseFloat(String(precioUnitarioRaw || 0)) || 0,
                subtotal: typeof subtotalRaw === "number" ? subtotalRaw : parseFloat(String(subtotalRaw || 0)) || 0,
                laminado: Boolean(it.laminado),
                troquelado: Boolean(it.troquelado),
                instalacion: Boolean(it.instalacion),
                costoLaminado: 0,
                costoTroquelado: 0,
                costoInstalacion: it.costoInstalacion != null ? Number(it.costoInstalacion) : 0,
                observaciones:
                  typeof observacionesRaw === "string" ? String(observacionesRaw) : "",
                terminados,
              }
            })
          : []

        // Descuento deshabilitado por el momento.
        setDescuento(0)

        setItems(mappedItems)
        setShowItemForm(false)
      } catch (e) {
        console.error("Error al cargar cotización:", e)
        alert(t('quotes.errors.loadQuote'))
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
  }, [items, taxConfig.pricesIncludeIva, taxConfig.ivaPct])

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

  const submitInlineCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateClienteInlineSubmitting(true)
    setCreateClienteInlineError(null)

    try {
      const payload = {
        ...createClienteInlineForm,
        nombre: createClienteInlineForm.nombre.trim(),
        segmento: createClienteInlineForm.segmento.trim() || undefined,
        documento: createClienteInlineForm.documento.trim(),
        email: createClienteInlineForm.email.trim() || undefined,
        telefono: createClienteInlineForm.telefono.trim() || undefined,
        celular: createClienteInlineForm.celular.trim() || undefined,
        direccion: createClienteInlineForm.direccion.trim() || undefined,
        ciudad: createClienteInlineForm.ciudad.trim() || undefined,
        departamento: createClienteInlineForm.departamento.trim() || undefined,
      }

      if (!payload.nombre || !payload.tipoDocumento || !payload.documento) {
        setCreateClienteInlineError('Nombre, tipo de documento y documento son requeridos.')
        return
      }

      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: Cliente; error?: string }
      if (!res.ok || !json.success || !json.data?.id) {
        setCreateClienteInlineError(json.error || 'No se pudo crear el cliente.')
        return
      }

      const created = json.data
      const label = `${created.nombre}${created.empresa ? ` - ${created.empresa}` : ''}`

      setClientes((prev) => {
        const next = prev.filter((item) => item.id !== created.id)
        return [created, ...next]
      })
      setClienteId(created.id)
      setClienteSearch(label)
      setClienteDropdownOpen(false)
      setCreateClienteInlineOpen(false)
      setCreateClienteInlineForm({
        nombre: '',
        segmento: '',
        tipoDocumento: 'CC',
        documento: '',
        email: '',
        telefono: '',
        celular: '',
        direccion: '',
        ciudad: '',
        departamento: '',
      })
    } catch (error) {
      setCreateClienteInlineError(error instanceof Error ? error.message : 'Error inesperado al crear el cliente.')
    } finally {
      setCreateClienteInlineSubmitting(false)
    }
  }

  const abrirPreviewPorId = async (id: string) => {
    try {
      setCreatedInvoice(null)
      const res = await fetch(`/api/cotizaciones/${id}`, { cache: "no-store" })
      if (!res.ok) throw new Error(t('quotes.errors.loadQuote'))
      const data = await res.json()
      if (!data?.success || !data?.data) throw new Error(data?.error ?? t('quotes.errors.loadQuote'))
      setPreviewCotizacion(data.data as CotizacionPdfData & { id: string; estado?: string })

      const auditRes = await fetch(`/api/cotizaciones/${id}/audit`, { cache: 'no-store' })
      if (auditRes.ok) {
        const auditJson = await auditRes.json().catch(() => null)
        const events = auditJson?.success ? auditJson?.data?.events : null
        setAuditEvents(Array.isArray(events) ? events : [])
      } else {
        setAuditEvents([])
      }

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
      alert(t('quotes.errors.loadPreview'))
    }
  }

  const aprobarParaEnviar = async () => {
    if (!previewCotizacion?.id) return
    if (approvingForBilling) return

    setApprovingForBilling(true)
    try {
      const res = await fetch(`/api/cotizaciones/${previewCotizacion.id}/aprobar`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        alert(t('common.errorWithDetails', { details: json?.error || t('quotes.errors.approveFallback') }))
        return
      }

      setPreviewCotizacion((prev) => (prev ? { ...prev, estado: 'APROBADA' } : prev))
      alert(t('quoteBuilder.success.approvedReadyToSend'))
    } catch (error) {
      console.error('Error al aprobar:', error)
      alert(t('quotes.errors.approve'))
    } finally {
      setApprovingForBilling(false)
    }
  }

  const crearFacturaDesdeCotizacion = async () => {
    if (!previewCotizacion?.id) return
    if (creatingInvoiceFromCotizacion) return

    setCreatingInvoiceFromCotizacion(true)
    try {
      const res = await fetch(`/api/cotizaciones/${previewCotizacion.id}/facturar`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok || !json?.data) {
        alert(t('common.errorWithDetails', { details: json?.error || t('quotes.errors.createInvoiceFallback') }))
        return
      }

      const inv = json.data as { id: string; numero: string }
      setCreatedInvoice({ id: inv.id, numero: inv.numero })
      alert(
        `${t('quotes.invoice.created', { numero: inv.numero })}. ${t('quoteBuilder.invoice.appearsInHistory')}`
      )
    } catch (error) {
      console.error('Error al facturar:', error)
      alert(t('quotes.errors.createInvoice'))
    } finally {
      setCreatingInvoiceFromCotizacion(false)
    }
  }

  const remitirAFacturaElectronica = async () => {
    if (!createdInvoice?.id) return
    if (remittingElectronic) return

    setRemittingElectronic(true)
    try {
      const res = await fetch('/api/dian/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'OUTBOUND',
          type: 'INVOICE',
          posInvoiceId: createdInvoice.id,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        alert(t('common.errorWithDetails', { details: json?.error || t('quoteBuilder.errors.remitElectronicFallback') }))
        return
      }

      alert(t('quoteBuilder.success.dianCreated'))
    } catch (error) {
      console.error('Error al remitir a DIAN:', error)
      alert(t('quoteBuilder.errors.remitElectronic'))
    } finally {
      setRemittingElectronic(false)
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
        const name = String(it?.descripcion || it?.material?.nombre || t('quotes.whatsapp.itemFallback')).trim() || t('quotes.whatsapp.itemFallback')
        const qty = typeof it?.cantidad === 'number' && !Number.isNaN(it.cantidad) ? it.cantidad : null
        const unit = String(it?.unidad || '').trim()
        const qtyLabel = qty !== null ? `${qty}${unit ? ` ${unit}` : ''}` : null
        return `• ${qtyLabel ? `${qtyLabel} - ` : ''}${name}`
      })
      .join('\n')

    const hayMasItems = items.length > 4

    return [
      '*SGDigital Softwares*',
      t('quotes.whatsapp.title', { numero: cotizacion.numero }),
      '',
      t('quotes.whatsapp.client', { name: cotizacion?.cliente?.nombre ?? '-' }),
      t('quotes.whatsapp.total', { total: formatCurrency(Number(cotizacion.total) || 0) }),
      t('quotes.whatsapp.date', { date: createdAt.toLocaleDateString(locale) }),
      t('quotes.whatsapp.validUntil', { date: validUntil.toLocaleDateString(locale) }),
      '',
      resumenItems ? t('quotes.whatsapp.summaryHeader') + '\n' + resumenItems + (hayMasItems ? '\n• …' : '') : '',
      '',
      t('quotes.whatsapp.pdf', { url: pdfUrl }),
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
        alert(t('quotes.errors.whatsappLink', { details: json?.error ?? t('common.error') }))
        return
      }

      const url: string = json.data.url
      const mensaje = buildWhatsAppMessage(previewCotizacion, url)

      const telefono = (previewCotizacion as unknown as { cliente?: { telefono?: string | null } })
        ?.cliente?.telefono
      const whatsappUrl = buildWhatsAppWebUrl({ phone: telefono, message: mensaje })
      window.open(whatsappUrl, '_blank')
    } catch (error) {
      console.error('Error:', error)
      alert(t('quotes.errors.whatsappPrepare'))
    } finally {
      setSharingPreviewWhatsapp(false)
    }
  }

  const enviarPreviewPorEmail = async () => {
    if (!previewCotizacion?.id) return
    const destinatario = String(previewCotizacion?.cliente?.email || '').trim()
    if (!destinatario) {
      alert(t('quoteBuilder.errors.clientMissingEmail'))
      return
    }

    const confirmar = window.confirm(
      t('quotes.confirm.sendEmail', { numero: previewCotizacion?.numero ?? '', email: destinatario })
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
        alert(t('common.errorWithDetails', { details: error?.error ?? t('quoteBuilder.errors.sendEmailFallback') }))
        return
      }
      alert(t('quotes.success.emailSent'))
    } catch (error) {
      console.error('Error:', error)
      alert(t('quotes.errors.sendEmail'))
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
      alert(t('quoteBuilder.errors.selectProduct'))
      return
    }

    // Este formulario manual es solo para productos por unidad.
    // Los productos por m²/ml se agregan por el Cotizador de Metraje.
    if (material.precioM2 || material.precioMetro) {
      alert(t('quoteBuilder.errors.productRequiresLithography'))
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
      unidad: "unidad",
      ancho,
      alto,
      m2: null,
      desperdicioPct: 0,
      precioUnitario,
      subtotal,
      laminado: false,
      troquelado: false,
      instalacion: false,
      costoLaminado: 0,
      costoTroquelado: 0,
      costoInstalacion: 0,
      observaciones: itemForm.observaciones,
      terminados: [],
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
      unidad: payload.unidad,
      ancho: null,
      alto: null,
      m2: null,
      desperdicioPct: payload.desperdicioPct,
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
      terminados: [],
    }

    setItems((prev) => [...prev, nuevoItem])
    setShowItemForm(false)
    setLitografiaAiDraft(null)
  }

  const agregarItemLitografiaCotizadoDesdeIa = (draft: LitografiaAiHandoff) => {
    const quotedItem = draft.quotedItem
    if (!quotedItem) return false

    const subtotalWithIva = Number(quotedItem.subtotalWithIva)
    if (!Number.isFinite(subtotalWithIva) || subtotalWithIva <= 0) return false

    const quantity = Math.max(1, Math.trunc(Number(quotedItem.quantity) || Number(draft.cantidad) || 1))
    const precioUnitario = Number.isFinite(Number(quotedItem.unitPriceWithIva)) && Number(quotedItem.unitPriceWithIva) > 0
      ? Number(quotedItem.unitPriceWithIva)
      : subtotalWithIva / quantity

    const metaStr = `LITOGRAFIA_META:${JSON.stringify({
      version: 3,
      itemSubtotalIncludesIva: true,
      itemIvaPct: quotedItem.ivaPct,
      subtotalSinIva: quotedItem.subtotalBeforeIva,
      subtotalConIva: subtotalWithIva,
      cantidad: String(quantity),
      cantidadItems: String(quantity),
      selectedMachineName: quotedItem.machineName,
    })}`

    const observaciones = [
      `Litografía IA directa • unidad=${quotedItem.unit}${quotedItem.machineName ? ` • máquina=${quotedItem.machineName}` : ""}`,
      quotedItem.summary || draft.assistantReply,
      metaStr,
    ]
      .filter(Boolean)
      .join("\n")

    const nuevoItem: ItemCotizacion = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      descripcion: quotedItem.description || draft.producto || "Ítem de litografía",
      materialId: null,
      material: null,
      cantidad: quantity,
      unidad: quotedItem.unit || "unidad",
      ancho: draft.anchoCm,
      alto: draft.altoCm,
      m2: null,
      desperdicioPct: 0,
      precioUnitario,
      subtotal: subtotalWithIva,
      laminado: false,
      troquelado: false,
      instalacion: false,
      costoLaminado: 0,
      costoTroquelado: 0,
      costoInstalacion: 0,
      observaciones,
      terminados: [],
    }

    setItems((prev) => [...prev, nuevoItem])
    setShowItemForm(false)
    setLitografiaAiDraft(null)
    return true
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
          unidad: payload.unidad,
          desperdicioPct: payload.desperdicioPct,
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
    setLitografiaAiDraft(null)
  }

  const handleLitografiaOpenChange = (open: boolean) => {
    setLitografiaOpen(open)
    if (!open) {
      setLitografiaEdit(null)
      setLitografiaAiDraft(null)
    }
  }

  const agregarItemMetraje = (draft: MetrajeItemDraft) => {
    const nuevoItem: ItemCotizacion = {
      ...draft,
      materialId: draft.materialId,
      material: draft.material as unknown as Material,
      cantidad: draft.cantidad,
      unidad: draft.unidad,
      ancho: draft.ancho,
      alto: draft.alto,
      m2: draft.m2,
      desperdicioPct: 0,
      precioUnitario: draft.precioUnitario,
      subtotal: draft.subtotal,
      laminado: false,
      troquelado: false,
      instalacion: false,
      costoLaminado: 0,
      costoTroquelado: 0,
      costoInstalacion: 0,
      observaciones: draft.observaciones,
      terminados: (draft.terminados || []) as any,
    }

    setItems((prev) => [...prev, nuevoItem])
    setShowItemForm(false)
    setMetrajeEdit(null)
  }

  const actualizarItemMetraje = (draft: MetrajeItemDraft) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== draft.id) return it
        return {
          ...it,
          descripcion: draft.descripcion,
          materialId: draft.materialId,
          material: draft.material as unknown as Material,
          cantidad: draft.cantidad,
          unidad: draft.unidad,
          ancho: draft.ancho,
          alto: draft.alto,
          m2: draft.m2,
          precioUnitario: draft.precioUnitario,
          subtotal: draft.subtotal,
          terminados: (draft.terminados || []) as any,
        }
      })
    )
    setMetrajeEdit(null)
    setMetrajeOpen(false)
  }

  const eliminarItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const parseLitografiaMeta = (raw: string): LitografiaMeta | null => {
    const rec = getLitografiaMetaRecord(raw)
    if (!rec) return null
    const version = Number(rec.version)
    if (![1, 2].includes(version)) return null
    return rec as unknown as LitografiaMeta
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

    // Metraje (m²/ml) => reabrir el cotizador de metraje
    if (item.materialId && (String(item.unidad) === "m2" || String(item.unidad) === "ml")) {
      setMetrajeEdit({
        itemId: item.id,
        item: {
          id: item.id,
          descripcion: item.descripcion,
          materialId: item.materialId,
          cantidad: item.cantidad,
          unidad: item.unidad === "ml" ? "ml" : "m2",
          ancho: item.ancho,
          alto: item.alto,
          m2: item.m2,
          terminados: item.terminados as any,
        },
      })
      setShowItemForm(false)
      setMetrajeOpen(true)
      return
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
    alert(t('quoteBuilder.errors.itemNotEditable'))
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
    const ivaPct = Math.min(100, Math.max(0, taxConfig.ivaPct))
    const rate = ivaPct / 100

    let subtotalGeneral = 0
    let subtotalLitografiaSinIva = 0
    let ivaLitografia = 0

    for (const item of items) {
      const subtotalItem = Number.isFinite(item.subtotal) ? item.subtotal : 0
      const itemIvaPct = getLitografiaItemIncludedIvaPct(item.observaciones)

      if (itemIvaPct && subtotalItem > 0) {
        const denom = 1 + itemIvaPct / 100
        const base = denom > 0 ? subtotalItem / denom : subtotalItem
        subtotalLitografiaSinIva += base
        ivaLitografia += subtotalItem - base
        continue
      }

      subtotalGeneral += subtotalItem
    }

    let ivaCalc = 0
    let tot = 0
    let sub = 0

    if (taxConfig.pricesIncludeIva) {
      const denom = 1 + rate
      const baseGeneral = denom > 0 ? subtotalGeneral / denom : subtotalGeneral
      const ivaGeneral = subtotalGeneral - baseGeneral
      sub = baseGeneral + subtotalLitografiaSinIva
      ivaCalc = ivaGeneral + ivaLitografia
      tot = subtotalGeneral + subtotalLitografiaSinIva + ivaLitografia
    } else {
      const ivaGeneral = subtotalGeneral * rate
      sub = subtotalGeneral + subtotalLitografiaSinIva
      ivaCalc = ivaGeneral + ivaLitografia
      tot = subtotalGeneral + ivaGeneral + subtotalLitografiaSinIva + ivaLitografia
    }

    setSubtotal(sub)
    setIva(ivaCalc)
    setTotal(tot)
  }

  const guardarCotizacion = async () => {
    if (!clienteId || items.length === 0) {
      alert(t('quoteBuilder.errors.missingClientOrItems'))
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
          crmOpportunityId: !editingId && crmOpportunityIdParam ? crmOpportunityIdParam : undefined,
          descripcion,
          items: items.map(item => ({
            descripcion: item.descripcion,
            materialId: item.materialId,
            cantidad: item.cantidad,
            unidad: item.unidad,
            ancho: item.ancho,
            alto: item.alto,
            m2: item.m2,
            desperdicioPct: item.desperdicioPct,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            laminado: item.laminado,
            troquelado: item.troquelado,
            instalacion: item.instalacion,
            costoLaminado: item.costoLaminado,
            costoTroquelado: item.costoTroquelado,
            costoInstalacion: item.costoInstalacion,
            observaciones: item.observaciones,
            terminados: item.terminados,
          })),
          subtotal,
          descuento: 0,
          descuentoPct: 0,
          iva,
          total,
          validezDias,
          tiempoEntrega,
          observaciones,
        }),
      })

      const contentType = response.headers.get('content-type') ?? ''
      const rawText = await response.text().catch(() => '')
      const data: any = (() => {
        if (!rawText) return null
        try {
          return JSON.parse(rawText)
        } catch {
          return null
        }
      })()

      if (response.ok && data?.success) {
        const id = data?.data?.id as string | undefined
        const numero = data?.data?.numero

        // Si estamos CREANDO una nueva cotización, abrir preview con acciones.
        if (!editingId && id) {
          await abrirPreviewPorId(id)
          if (crmOpportunityIdParam) {
            router.replace('/dashboard/cotizador')
          }
          resetCotizador()
          return
        }

        alert(t('quoteBuilder.success.updated', { numero: numero || '' }))

        // Limpiar / salir de edición
        router.push('/dashboard/cotizador')
        resetCotizador()
      } else {
        const apiError = typeof data?.error === 'string' ? data.error : null
        const apiDetails = typeof data?.details === 'string' ? data.details : null
        const msg = apiError || apiDetails || (rawText ? rawText.slice(0, 240) : null) || `HTTP ${response.status}`
        console.error('Error guardando cotización:', {
          url,
          method,
          status: response.status,
          ok: response.ok,
          contentType,
          rawStart: rawText ? rawText.slice(0, 300) : null,
          data,
        })
        alert(t('common.errorWithDetails', { details: msg }))
      }
    } catch (error) {
      console.error('Error:', error)
      alert(t('quoteBuilder.errors.save'))
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
    setMetrajeEdit(null)
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
        onOpenChange={handleLitografiaOpenChange}
        onAddItem={agregarItemLitografia}
        edit={litografiaEdit}
        onUpdateItem={actualizarItemLitografia}
        aiDraft={litografiaAiDraft}
      />

      <MetrajeQuoteDialog
        open={metrajeOpen}
        onOpenChange={(v) => {
          setMetrajeOpen(v)
          if (!v) setMetrajeEdit(null)
        }}
        materiales={materiales as unknown as MetrajeMaterial[]}
        formatCurrency={formatCurrency}
        onAddItem={agregarItemMetraje}
        edit={metrajeEdit}
        onUpdateItem={actualizarItemMetraje}
      />

      <CustomProductRequestDialog
        open={customProductOpen}
        onOpenChange={setCustomProductOpen}
        defaultNombre={materialSearch}
      />

      <Dialog open={createClienteInlineOpen} onOpenChange={setCreateClienteInlineOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('customers.dialog.newTitle')}</DialogTitle>
            <DialogDescription>{t('customers.dialog.newDescription')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitInlineCliente(e)} className="space-y-4">
            {createClienteInlineError ? <div className="text-sm text-red-600">{createClienteInlineError}</div> : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="inline-cliente-nombre">{t('customers.form.name')} *</Label>
                <Input
                  id="inline-cliente-nombre"
                  value={createClienteInlineForm.nombre}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, nombre: e.target.value }))}
                  required
                  placeholder={t('customers.form.namePlaceholder')}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="inline-cliente-segmento">{t('customers.form.segment')}</Label>
                <select
                  id="inline-cliente-segmento"
                  value={createClienteInlineForm.segmento}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, segmento: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">{t('customers.form.segmentAuto')}</option>
                  <option value="POTENCIAL">{t('customers.segment.POTENCIAL')}</option>
                  <option value="OCASIONAL">{t('customers.segment.OCASIONAL')}</option>
                  <option value="FRECUENTE">{t('customers.segment.FRECUENTE')}</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">{t('customers.form.segmentHelp')}</p>
              </div>

              <div>
                <Label htmlFor="inline-cliente-tipo-doc">{t('customers.form.documentType')} *</Label>
                <select
                  id="inline-cliente-tipo-doc"
                  value={createClienteInlineForm.tipoDocumento}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, tipoDocumento: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="NIT">NIT</option>
                  <option value="CC">{t('customers.form.documentType.CC')}</option>
                  <option value="CE">{t('customers.form.documentType.CE')}</option>
                  <option value="PASAPORTE">{t('customers.form.documentType.PASAPORTE')}</option>
                </select>
              </div>

              <div>
                <Label htmlFor="inline-cliente-documento">{t('customers.form.documentNumber')} *</Label>
                <Input
                  id="inline-cliente-documento"
                  value={createClienteInlineForm.documento}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, documento: e.target.value }))}
                  required
                  placeholder="123456789"
                />
              </div>

              <div>
                <Label htmlFor="inline-cliente-email">{t('customers.form.email')}</Label>
                <Input
                  id="inline-cliente-email"
                  type="email"
                  value={createClienteInlineForm.email}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder={t('customers.form.emailPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="inline-cliente-telefono">{t('customers.form.phone')}</Label>
                <Input
                  id="inline-cliente-telefono"
                  value={createClienteInlineForm.telefono}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, telefono: e.target.value }))}
                  placeholder={t('customers.form.phonePlaceholder')}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="inline-cliente-celular">{t('customers.form.mobile')}</Label>
                <Input
                  id="inline-cliente-celular"
                  value={createClienteInlineForm.celular}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, celular: e.target.value }))}
                  placeholder={t('customers.form.mobilePlaceholder')}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="inline-cliente-direccion">{t('customers.form.address')}</Label>
                <Input
                  id="inline-cliente-direccion"
                  value={createClienteInlineForm.direccion}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, direccion: e.target.value }))}
                  placeholder={t('customers.form.addressPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="inline-cliente-ciudad">{t('customers.form.city')}</Label>
                <Input
                  id="inline-cliente-ciudad"
                  value={createClienteInlineForm.ciudad}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, ciudad: e.target.value }))}
                  placeholder={t('customers.form.cityPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="inline-cliente-departamento">{t('customers.form.state')}</Label>
                <Input
                  id="inline-cliente-departamento"
                  value={createClienteInlineForm.departamento}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, departamento: e.target.value }))}
                  placeholder={t('customers.form.statePlaceholder')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateClienteInlineOpen(false)}
                disabled={createClienteInlineSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createClienteInlineSubmitting}>
                {createClienteInlineSubmitting ? 'Creando...' : 'Crear cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={litografiaAiOpen} onOpenChange={setLitografiaAiOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('quoteBuilder.actions.aiQuoteBuilder')}</DialogTitle>
          </DialogHeader>
          <LitografiaAiAssistant
            initialBrief={[descripcion, observaciones].map((item) => item.trim()).filter(Boolean).join("\n\n")}
            openToken={litografiaAiOpenToken}
            onApplyToClassic={(draft) => {
              setLitografiaAiOpen(false)
              setShowItemForm(false)
              setLitografiaEdit(null)
              if (agregarItemLitografiaCotizadoDesdeIa(draft)) {
                return
              }
              setLitografiaAiDraft(draft)
              setLitografiaOpen(true)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Preview post-guardar */}
      <Dialog
        open={!!previewCotizacion}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewCotizacion(null)
            setCreatedInvoice(null)
            setAuditEvents([])
            setTraceOpen(false)
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {t('quotes.preview.title', { numero: previewCotizacion?.numero ?? '' })}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={sharingPreviewWhatsapp}
              onClick={() => void compartirPreviewPorWhatsApp()}
            >
              {sharingPreviewWhatsapp ? t('quotes.whatsapp.generatingLink') : 'WhatsApp'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={sendingPreviewEmail}
              onClick={() => void enviarPreviewPorEmail()}
            >
              {sendingPreviewEmail ? t('quoteBuilder.preview.sending') : t('quoteBuilder.preview.email')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const id = previewCotizacion?.id
                setPreviewCotizacion(null)
                setCreatedInvoice(null)
                if (id) router.push(`/dashboard/cotizador?id=${id}`)
              }}
            >
              {t('common.edit')}
            </Button>

            {previewCotizacion?.id ? (
              <>
                {String(previewCotizacion?.estado) !== 'APROBADA' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={approvingForBilling}
                    onClick={() => void aprobarParaEnviar()}
                  >
                    {approvingForBilling ? t('quoteBuilder.preview.approving') : t('quotes.actions.approveToSend')}
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  title={!electronicBillingEnabled ? t('quoteBuilder.preview.billingDisabled') : undefined}
                  disabled={!electronicBillingEnabled || String(previewCotizacion?.estado) !== 'APROBADA' || creatingInvoiceFromCotizacion}
                  onClick={() => void crearFacturaDesdeCotizacion()}
                >
                  {creatingInvoiceFromCotizacion
                    ? t('quoteBuilder.preview.creatingInvoice')
                    : t('quoteBuilder.preview.createInvoiceDraft')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  title={!electronicBillingEnabled ? t('quoteBuilder.preview.billingDisabled') : undefined}
                  disabled={!electronicBillingEnabled || !createdInvoice?.id || remittingElectronic}
                  onClick={() => void remitirAFacturaElectronica()}
                >
                  {remittingElectronic ? t('quoteBuilder.preview.remitting') : t('quoteBuilder.preview.remitElectronic')}
                </Button>

                {createdInvoice?.numero ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPreviewCotizacion(null)
                      router.push('/dashboard/pos')
                    }}
                  >
                    {t('quoteBuilder.preview.goToInvoices')}
                  </Button>
                ) : null}
              </>
            ) : null}

            <Button type="button" onClick={() => setPreviewCotizacion(null)}>
              {t('common.close')}
            </Button>
          </div>

          {previewCotizacion ? (
            <div className="h-[70vh] w-full overflow-hidden rounded border">
              {isMobileViewport ? (
                <MobilePdfFallback
                  title={`Cotización ${previewCotizacion.numero}`}
                  description="En móvil la vista previa embebida del PDF puede fallar. Aquí puedes abrirlo con el visor disponible, descargarlo o compartirlo."
                  pdfUrl={`/api/cotizaciones/${previewCotizacion.id}/pdf`}
                  downloadName={`Cotizacion-${previewCotizacion.numero}.pdf`}
                />
              ) : (
                <PDFViewer width="100%" height="100%">
                  <CotizacionPDF
                    cotizacion={previewCotizacion}
                    template={previewTemplate || undefined}
                  />
                </PDFViewer>
              )}
            </div>
          ) : null}

          {previewCotizacion?.id ? (
            <div className="space-y-2 rounded border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="font-medium">Trazabilidad</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTraceOpen(true)}
                    disabled={!auditEvents.length}
                  >
                    Ver trazabilidad
                  </Button>
                </div>
                <div className="text-muted-foreground">
                  Ediciones: {auditEvents.filter((e) => e.action === 'UPDATED').length}
                </div>
              </div>

              {auditEvents.length ? (
                <div className="max-h-40 overflow-auto">
                  <div className="space-y-1">
                    {auditEvents.map((e) => {
                      const fecha = new Date(e.createdAt).toLocaleString(locale)
                      const performed = e.performedBy?.name || e.performedBy?.email || '-'
                      const requested = e.requestedBy?.name || e.requestedBy?.email || null
                      const who = requested && requested !== performed
                        ? `Solicitó: ${requested} • Ejecutó: ${performed}`
                        : `Por: ${performed}`

                      const effectLabel =
                        e.effect === 'DEBIT'
                          ? ' (Nota débito)'
                          : e.effect === 'CREDIT'
                            ? ' (Nota crédito)'
                            : ''

                      const actionLabel =
                        e.action === 'CREATED'
                          ? 'Creada'
                          : e.action === 'APPROVED'
                            ? 'Aprobada'
                            : `Editada${effectLabel}`

                      return (
                        <div key={e.id} className="flex flex-col gap-0.5 rounded px-2 py-1 hover:bg-muted/50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">{actionLabel}</div>
                            <div className="text-muted-foreground">{fecha}</div>
                          </div>
                          <div className="text-muted-foreground">{who}</div>
                          {Array.isArray(e.autoSummary) && e.autoSummary.length ? (
                            <div className="text-muted-foreground">
                              {e.autoSummary.slice(0, 2).map((line, idx) => (
                                <div key={idx}>{line}</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">Sin registros</div>
              )}
            </div>
          ) : null}

          <DialogFooter />
        </DialogContent>
      </Dialog>

      {/* Dialog para trazabilidad (automática) */}
      <Dialog
        open={traceOpen}
        onOpenChange={(open) => {
          setTraceOpen(open)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Trazabilidad de cambios</DialogTitle>
          </DialogHeader>

          {auditEvents.length ? (
            <div className="space-y-2 text-sm">
              {auditEvents.map((e) => {
                const fecha = new Date(e.createdAt).toLocaleString(locale)
                const performed = e.performedBy?.name || e.performedBy?.email || '-'
                const requested = e.requestedBy?.name || e.requestedBy?.email || null
                const who = requested && requested !== performed
                  ? `Solicitó: ${requested} • Ejecutó: ${performed}`
                  : `Por: ${performed}`

                const effectLabel =
                  e.effect === 'DEBIT'
                    ? ' (Nota débito)'
                    : e.effect === 'CREDIT'
                      ? ' (Nota crédito)'
                      : ''

                const actionLabel =
                  e.action === 'CREATED'
                    ? 'Creada'
                    : e.action === 'APPROVED'
                      ? 'Aprobada'
                      : `Editada${effectLabel}`

                return (
                  <div key={e.id} className="rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{actionLabel}</div>
                      <div className="text-muted-foreground">{fecha}</div>
                    </div>
                    <div className="text-muted-foreground">{who}</div>

                    {Array.isArray(e.autoSummary) && e.autoSummary.length ? (
                      <div className="mt-2 space-y-1">
                        {e.autoSummary.map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-muted-foreground">Sin detalle automático</div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Sin registros</div>
          )}
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-tour="cotizador-title">{t('quoteBuilder.page.title')}</h1>
            <p className="text-muted-foreground">
              {isLoadingCotizacion
                ? t('quoteBuilder.page.loadingQuote')
                : editingId
                  ? t('quoteBuilder.page.editing', { id: editingId })
                  : t('quoteBuilder.page.subtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button asChild variant="outline" size="sm" type="button">
              <Link href="/dashboard/cotizaciones">{t('quoteBuilder.actions.history')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm" type="button">
              <Link href="/dashboard/cotizaciones/plantilla">{t('quotes.actions.editTemplate')}</Link>
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
                {t('quoteBuilder.actions.cancelEdit')}
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
              <CardTitle>{t('quoteBuilder.sections.general')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2" data-tour="cotizador-cliente">
                  <Label htmlFor="cliente" className="mb-2 block">{t('quoteBuilder.fields.client')} *</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="relative min-w-0 flex-1">
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
                      placeholder={t('quoteBuilder.placeholders.clientSearch')}
                      required
                    />

                    {clienteDropdownOpen ? (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-background p-1 shadow-sm max-h-64 overflow-auto">
                        {filteredClientes.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">{t('common.noResults')}</div>
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
                                {cliente.documento ? (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {cliente.documento}
                                  </div>
                                ) : null}
                              </button>
                            )
                          })
                        )}
                      </div>
                    ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="sm:mt-0 sm:shrink-0"
                      onClick={() => {
                        setCreateClienteInlineError(null)
                        setCreateClienteInlineForm((prev) => ({
                          ...prev,
                          nombre: clienteSearch.trim() && !clienteId ? clienteSearch.trim() : prev.nombre,
                        }))
                        setCreateClienteInlineOpen(true)
                      }}
                    >
                      Crear cliente
                    </Button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="descripcion">{t('quoteBuilder.fields.description')}</Label>
                  <Textarea
                    id="descripcion"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder={t('quoteBuilder.placeholders.description')}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="validez">{t('quoteBuilder.fields.validityDays')}</Label>
                  <Input
                    id="validez"
                    type="number"
                    value={validezDias}
                    onChange={(e) => setValidezDias(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="entrega">{t('quoteBuilder.fields.deliveryTime')}</Label>
                  <Input
                    id="entrega"
                    value={tiempoEntrega}
                    onChange={(e) => setTiempoEntrega(e.target.value)}
                    placeholder={t('quoteBuilder.placeholders.deliveryTime')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{t('quoteBuilder.sections.items')}</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setShowItemForm(false)
                      setLitografiaAiOpenToken((value) => value + 1)
                      setLitografiaAiOpen(true)
                    }}
                  >
                    {t('quoteBuilder.actions.aiQuoteBuilder')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setShowItemForm(false)
                      setLitografiaOpen(true)
                    }}
                  >
                    {t('quoteBuilder.actions.lithographyQuoteBuilder')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setShowItemForm(false)
                      setMetrajeEdit(null)
                      setMetrajeOpen(true)
                    }}
                  >
                    {t('quoteBuilder.actions.metrageQuoteBuilder')}
                  </Button>
                  <Button onClick={() => setShowItemForm(true)} size="sm" data-tour="cotizador-add-item">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('quoteBuilder.actions.addItem')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showItemForm && (
                <div className="mb-4 space-y-4 rounded-lg border bg-muted/50 p-4">
                  <h4 className="font-medium">
                    {editingManualItemId ? t('quoteBuilder.itemForm.editTitle') : t('quoteBuilder.itemForm.newTitle')}
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="item-material">{t('quoteBuilder.itemForm.productRequired')} *</Label>
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
                          placeholder={t('quoteBuilder.placeholders.productSearch')}
                        />

                        {materialDropdownOpen ? (
                          <div className="absolute z-10 mt-1 w-full rounded-md border bg-background p-1 shadow-sm max-h-64 overflow-auto">
                            {filteredMateriales.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">{t('common.noResults')}</div>
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
                                    <div className="truncate">{formatMaterialLabel(mat)}</div>
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
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => setCustomProductOpen(true)}
                        >
                          Crear producto personalizado
                        </Button>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="item-desc">{t('quoteBuilder.fields.description')}</Label>
                      <Input
                        id="item-desc"
                        value={itemForm.descripcion}
                        onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })}
                        placeholder={t('quoteBuilder.itemForm.descriptionPlaceholder')}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('quoteBuilder.itemForm.descriptionHelp')}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="item-cantidad">{t('quoteBuilder.fields.quantity')} *</Label>
                      <Input
                        id="item-cantidad"
                        type="number"
                        step="1"
                        value={itemForm.cantidad}
                        onChange={(e) => setItemForm({ ...itemForm, cantidad: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="item-precio">{t('quoteBuilder.fields.unitPrice')}</Label>
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
                          {t('quoteBuilder.itemForm.quantityDiscountApplied', { pct: cantidadDiscountPct })}
                        </p>
                      )}
                    </div>

                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={agregarItem} size="sm">
                      {editingManualItemId ? t('quoteBuilder.actions.saveChanges') : t('common.add')}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowItemForm(false)
                        setEditingManualItemId(null)
                        resetItemForm()
                      }}
                      variant="outline"
                      size="sm"
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabla de items */}
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('quoteBuilder.items.empty')}
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const litografiaMetaRecord = getLitografiaMetaRecord(item.observaciones)
                    const meta = typeof item.observaciones === "string" ? parseLitografiaMeta(item.observaciones) : null
                    const isDirectAiItem = Number(litografiaMetaRecord?.version) === 3
                    const tirajeRaw = meta
                      ? String((meta.cantidadItems ?? meta.cantidad ?? "0"))
                      : String(litografiaMetaRecord?.cantidadItems ?? litografiaMetaRecord?.cantidad ?? "0")
                    const machineName = meta?.selectedMachineName || String(litografiaMetaRecord?.selectedMachineName || "").trim()
                    const editDisabledReason = isDirectAiItem ? "Este item viene cerrado desde la IA. Para cambiarlo, vuelve a cotizarlo desde el asistente." : null
                    const canEditItem = !isDirectAiItem
                      ? true
                      : false
                    const tiraje = Math.max(0, Math.trunc(parseFloat(tirajeRaw) || 0))
                    const detailParts: string[] = []
                    if (item.material?.nombre) detailParts.push(item.material.nombre)
                    if (String(item.unidad) === 'm2' && item.ancho && item.alto) {
                      detailParts.push(`${item.ancho} x ${item.alto} cm (${(item.m2 ?? 0).toFixed(4)} m²)`)
                    } else if (String(item.unidad) === 'ml' && item.m2) {
                      const anchoLabel = item.ancho ? ` • ancho ${item.ancho} cm` : ''
                      detailParts.push(`${item.m2.toFixed(2)} ml${anchoLabel}`)
                    }
                    if (tiraje > 0) detailParts.push(`Tiraje: ${tiraje}`)
                    if (machineName) detailParts.push(`Máquina: ${machineName}`)
                    detailParts.push(`${t('quoteBuilder.fields.quantityLabel')}: ${item.cantidad}`)
                    const details = detailParts.join(" • ")

                    return (
                      <div key={item.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{item.descripcion}</h4>
                            <p className="text-sm text-muted-foreground">{details}</p>
                          {(item.laminado || item.troquelado || item.instalacion) && (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {item.laminado && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{t('quoteBuilder.items.laminated')}</span>}
                              {item.troquelado && <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">{t('quoteBuilder.items.dieCut')}</span>}
                              {item.instalacion && <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">{t('quoteBuilder.items.installation')}</span>}
                            </div>
                          )}
                          {Array.isArray(item.terminados) && item.terminados.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {item.terminados.slice(0, 6).map((tr) => (
                                <span
                                  key={tr.terminadoId}
                                  className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded"
                                  title={tr.unidadAplicacion}
                                >
                                  {tr.nombre || 'Terminado'}
                                </span>
                              ))}
                              {item.terminados.length > 6 ? (
                                <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
                                  +{item.terminados.length - 6}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          </div>
                          <div className="space-y-1 text-left sm:text-right">
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(item.precioUnitario)} {t('quoteBuilder.items.each')}
                            </p>
                            <p className="font-bold text-blue-600">
                              {formatCurrency(item.subtotal)}
                            </p>
                            <Button variant="ghost" size="sm" onClick={() => editarItem(item)} disabled={!canEditItem} title={editDisabledReason || undefined}>
                              {t('common.edit')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarItem(item.id)}
                              className="text-red-600"
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle>{t('quoteBuilder.sections.notes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder={t('quoteBuilder.placeholders.notes')}
                rows={4}
              />
            </CardContent>
          </Card>

        </div>

        {/* Resumen */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>{t('quoteBuilder.sections.summary')}</CardTitle>
              <CardDescription>{t('quoteBuilder.summary.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('quoteBuilder.summary.subtotal')}:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">
                    {t('quoteBuilder.summary.taxLabel', {
                      pct: Math.min(100, Math.max(0, taxConfig.ivaPct)),
                      included: taxConfig.pricesIncludeIva ? t('quoteBuilder.summary.included') : '',
                    })}
                  </span>
                  <span className="font-medium">{formatCurrency(iva)}</span>
                </div>

                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>{t('quoteBuilder.summary.total')}:</span>
                  <span className="text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button 
                onClick={guardarCotizacion}
                disabled={isLoading || isLoadingCotizacion || !clienteId || items.length === 0}
                className="w-full"
                size="lg"
                data-tour="cotizador-save"
              >
                {isLoading
                  ? t('common.saving')
                  : editingId
                    ? t('quoteBuilder.actions.updateQuote')
                    : t('quoteBuilder.actions.saveQuote')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
