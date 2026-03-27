/**
 * Página de facturación (MVP)
 * - Listar facturas
 * - Crear factura (PAID por defecto)
 * - Ver detalle básico
 * - Anular factura (si aplica)
 */


'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { formatCurrency, formatUnidadMedidaLabel } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/components/providers/i18n-provider'
import { Download, Plus, Search } from 'lucide-react'

type DianDirection = 'OUTBOUND' | 'INBOUND'
type DianType = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'ELECTRONIC_INSTRUMENT'
type DianStatus = 'GENERATED' | 'TRANSMITTED' | 'EXPEDITED' | 'DELIVERED' | 'RECEIVED' | 'ERROR'
type DianAction = 'transmitir' | 'expedir' | 'entregar' | 'recepcionar'

type TFunction = (key: string, vars?: Record<string, string | number>) => string

function getDianSteps(t: TFunction): Array<{ key: DianStatus; title: string; description: string }> {
  return [
    {
      key: 'GENERATED',
      title: t('pos.dian.steps.generated.title'),
      description: t('pos.dian.steps.generated.description'),
    },
    {
      key: 'TRANSMITTED',
      title: t('pos.dian.steps.transmitted.title'),
      description: t('pos.dian.steps.transmitted.description'),
    },
    {
      key: 'EXPEDITED',
      title: t('pos.dian.steps.expedited.title'),
      description: t('pos.dian.steps.expedited.description'),
    },
    {
      key: 'DELIVERED',
      title: t('pos.dian.steps.delivered.title'),
      description: t('pos.dian.steps.delivered.description'),
    },
    {
      key: 'RECEIVED',
      title: t('pos.dian.steps.received.title'),
      description: t('pos.dian.steps.received.description'),
    },
  ]
}

type DianDocTypeOption = { value: DianType; label: string }
function getDianDocTypes(t: TFunction): DianDocTypeOption[] {
  return [
    { value: 'INVOICE', label: t('pos.dian.docTypes.invoice') },
    { value: 'CREDIT_NOTE', label: t('pos.dian.docTypes.creditNote') },
    { value: 'DEBIT_NOTE', label: t('pos.dian.docTypes.debitNote') },
    { value: 'ELECTRONIC_INSTRUMENT', label: t('pos.dian.docTypes.electronicInstrument') },
  ]
}

function dianDirectionLabel(t: TFunction, value: DianDirection | string): string {
  if (value === 'OUTBOUND') return t('pos.dian.direction.outbound')
  if (value === 'INBOUND') return t('pos.dian.direction.inbound')
  return String(value)
}

function dianTypeLabel(docTypes: DianDocTypeOption[], value: DianType | string): string {
  return docTypes.find((t) => t.value === value)?.label ?? String(value)
}

type DianNumeracionTipoDocumento = 'FACTURA_VENTA' | 'NOTA_CREDITO' | 'NOTA_DEBITO'

type DianNumeracionTipoDocumentoOption = { value: DianNumeracionTipoDocumento; label: string }
function getDianNumeracionTipoDocOptions(t: TFunction): DianNumeracionTipoDocumentoOption[] {
  return [
    { value: 'FACTURA_VENTA', label: t('pos.dian.numerationDocType.facturaVenta') },
    { value: 'NOTA_CREDITO', label: t('pos.dian.numerationDocType.notaCredito') },
    { value: 'NOTA_DEBITO', label: t('pos.dian.numerationDocType.notaDebito') },
  ]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type DianDocListItem = {
  id: string
  direction: DianDirection
  type: DianType
  status: DianStatus
  numero: string | null
  uuid: string | null
  cufe: string | null
  provider: string | null
  providerRef: string | null
  transmittedAt: string | null
  expeditedAt: string | null
  deliveredAt: string | null
  receivedAt: string | null
  lastError: string | null
  createdAt: string
  posInvoice?: { id: string; numero: string } | null
  posReturn?: { id: string; numero: string } | null
}

type DianDocEvent = {
  id: string
  type: string
  message: string
  meta: unknown
  createdAt: string
}

type DianDocDetail = {
  id: string
  direction: DianDirection
  type: DianType
  status: DianStatus
  numero: string | null
  uuid: string | null
  cufe: string | null
  provider: string | null
  providerRef: string | null
  payload: unknown
  xml: string | null
  lastError: string | null
  transmittedAt: string | null
  expeditedAt: string | null
  deliveredAt: string | null
  receivedAt: string | null
  createdAt: string
  updatedAt: string
  posInvoice?: { id: string; numero: string } | null
  posReturn?: { id: string; numero: string } | null
  events: DianDocEvent[]
  createdBy?: { id: string; name: string | null; email: string | null } | null
}

type Bodega = {
  id: string
  nombre: string
  codigo: string | null
  isDefault: boolean
}

type Material = {
  id: string
  nombre: string
  unidadMedida: string
  precioUnidad?: number | null
  precioMetro?: number | null
  precioM2?: number | null
}

type InvoiceListItem = {
  id: string
  numero: string
  status: string
  clienteNombre: string
  total: number
  createdAt: string
  warehouse?: { id: string; nombre: string } | null
}

type InvoiceDetail = {
  id: string
  numero: string
  status: string
  empresaId?: string
  clienteNombre: string
  clienteDocumento: string | null
  ivaPct: number
  subtotal: number
  iva: number
  total: number
  note: string | null
  createdAt: string
  warehouse?: { id: string; nombre: string; codigo: string | null } | null
  items: Array<{
    id: string
    descripcion: string
    quantity: number
    unitPrice: number
    total: number
    material?: { id: string; nombre: string; unidadMedida: string } | null
  }>
}

type ReturnListItem = {
  id: string
  numero: string
  total: number
  createdAt: string
  invoice?: { id: string; numero: string } | null
  warehouse?: { id: string; nombre: string } | null
}

type ReturnDetail = {
  id: string
  numero: string
  motivo: string | null
  ivaPct: number
  subtotal: number
  iva: number
  total: number
  createdAt: string
  invoice?: { id: string; numero: string } | null
  warehouse?: { id: string; nombre: string; codigo: string | null } | null
  items: Array<{
    id: string
    descripcion: string
    quantity: number
    unitPrice: number
    total: number
    material?: { id: string; nombre: string; unidadMedida: string } | null
  }>
}

type ApiListResponse<T> = { success?: boolean; data?: T; error?: string }

function n(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseMoneyInput(value: unknown, fallback = 0) {
  const s = String(value ?? '').trim()
  if (!s) return fallback
  const cleaned = s
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : fallback
}

function priceSuggestion(m: Material | undefined | null): number {
  if (!m) return 0
  return n(m.precioUnidad ?? m.precioMetro ?? m.precioM2 ?? 0)
}

type DraftItem = {
  materialId: string
  descripcion: string
  quantity: string
  unitPrice: string
}

type PaymentMethod =
  | 'CASH'
  | 'CREDIT'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'CHECK'
  | 'TRANSFER'
  | 'BONUS'
  | 'LETTER'
  | 'VALE'
  | 'OTHER'

const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CREDIT',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'CHECK',
  'TRANSFER',
  'BONUS',
  'LETTER',
  'VALE',
  'OTHER',
]

type ClientePickerItem = {
  id: string
  nombre: string
  documento: string | null
  email: string | null
}

export default function PosPage() {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const searchParams = useSearchParams()

  const dianSteps = useMemo(() => getDianSteps(t), [t])
  const dianDocTypes = useMemo(() => getDianDocTypes(t), [t])
  const dianNumTipoDocOptions = useMemo(() => getDianNumeracionTipoDocOptions(t), [t])

  const [activeTab, setActiveTab] = useState<'interna' | 'dian'>('interna')
  const [tabPending, setTabPending] = useState(false)
  const tabTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current)
    }
  }, [])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [returns, setReturns] = useState<ReturnListItem[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [materials, setMaterials] = useState<Material[]>([])

  const [materialSearch, setMaterialSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [finalizeSubmitting, setFinalizeSubmitting] = useState(false)
  const [createAsDraft, setCreateAsDraft] = useState(false)

  const [returnSubmitting, setReturnSubmitting] = useState(false)

  const [returnDetailOpen, setReturnDetailOpen] = useState(false)
  const [returnDetailLoading, setReturnDetailLoading] = useState(false)
  const [returnDetailError, setReturnDetailError] = useState<string | null>(null)
  const [returnDetail, setReturnDetail] = useState<ReturnDetail | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<InvoiceDetail | null>(null)

  const [dianFilterDirection, setDianFilterDirection] = useState<'ALL' | DianDirection>('ALL')
  const [dianDocs, setDianDocs] = useState<DianDocListItem[]>([])
  const [dianLoading, setDianLoading] = useState(false)
  const [dianError, setDianError] = useState<string | null>(null)

  const [dianSelectedId, setDianSelectedId] = useState('')
  const [dianDetail, setDianDetail] = useState<DianDocDetail | null>(null)
  const [dianDetailLoading, setDianDetailLoading] = useState(false)
  const [dianDetailError, setDianDetailError] = useState<string | null>(null)

  const [dianCreating, setDianCreating] = useState(false)
  const [dianActionSubmitting, setDianActionSubmitting] = useState<DianAction | null>(null)

  const [dianMainTab, setDianMainTab] = useState<'crear' | 'historico' | 'configuracion' | 'plantillas'>('historico')
  const [dianHistoricoTab, setDianHistoricoTab] = useState<'enviados' | 'recibidos'>('enviados')
  const [dianCrearTab, setDianCrearTab] = useState<
    | 'factura_venta'
    | 'factura_aui'
    | 'factura_exportacion'
    | 'factura_mandato'
    | 'factura_contingencia'
    | 'factura_lotes'
    | 'nota_debito'
    | 'nota_credito'
  >('factura_venta')
  const [dianConfigTab, setDianConfigTab] = useState<'rangos' | 'comprador' | 'productos'>('rangos')
  const [dianPlantillaTab, setDianPlantillaTab] = useState<'factura_venta'>('factura_venta')

  useEffect(() => {
    const requestedTab = searchParams?.get('tab')
    const requestedDianTab = searchParams?.get('dianTab')

    if (requestedTab === 'dian') {
      setActiveTab('dian')
    } else if (requestedTab === 'interna') {
      setActiveTab('interna')
    }

    if (requestedDianTab === 'crear' || requestedDianTab === 'historico' || requestedDianTab === 'configuracion' || requestedDianTab === 'plantillas') {
      setDianMainTab(requestedDianTab)
    }
  }, [searchParams])

  type DianSettings = {
    numeracion?: Array<{
      tipoDocumento?: DianNumeracionTipoDocumento
      prefijo?: string
      desde?: number
      hasta?: number
      actual?: number
      nroAutorizacion?: string
      fechaVencimiento?: string
      activo?: boolean
    }>
    compradorDefault?: {
      nombre?: string
      documento?: string
      email?: string
    }
    productos?: Array<{
      codigo?: string
      descripcion?: string
      unitPrice?: number
      ivaPct?: number
    }>
    templates?: {
      facturaVenta?: string
    }
  } & Record<string, unknown>

  const [dianSettingsLoading, setDianSettingsLoading] = useState(false)
  const [dianSettingsSaving, setDianSettingsSaving] = useState(false)
  const [dianSettings, setDianSettings] = useState<DianSettings>({})
  const [dianNumeracionValidation, setDianNumeracionValidation] = useState<{ ok: boolean; messages: string[] } | null>(null)

  const [dianCreateNumero, setDianCreateNumero] = useState('')
  const [dianCreateBuyer, setDianCreateBuyer] = useState({
    nombre: '',
    documento: '',
    email: '',
  })
  const [dianCreateItems, setDianCreateItems] = useState<Array<{ descripcion: string; quantity: string; unitPrice: string; ivaPct: string }>>([
    { descripcion: '', quantity: '1', unitPrice: '', ivaPct: '0' },
  ])
  const [dianLotesNumeros, setDianLotesNumeros] = useState('')

  const [dianCreatePosInvoiceId, setDianCreatePosInvoiceId] = useState('')
  const [dianCreatePosInvoiceLoading, setDianCreatePosInvoiceLoading] = useState(false)
  const [dianCreatePosInvoice, setDianCreatePosInvoice] = useState<InvoiceDetail | null>(null)

  const [clientePickerOpen, setClientePickerOpen] = useState(false)
  const [clientePickerTarget, setClientePickerTarget] = useState<'interna' | 'dian' | 'dian-config'>('interna')
  const [clientePickerSearch, setClientePickerSearch] = useState('')
  const [clientePickerLoading, setClientePickerLoading] = useState(false)
  const [clientePickerError, setClientePickerError] = useState<string | null>(null)
  const [clientePickerItems, setClientePickerItems] = useState<ClientePickerItem[]>([])

  const [productoPickerOpen, setProductoPickerOpen] = useState(false)
  const [productoPickerTarget, setProductoPickerTarget] = useState<
    | { kind: 'interna'; idx: number }
    | { kind: 'dian'; idx: number }
    | { kind: 'dian-config' }
    | null
  >(null)
  const [productoPickerSearch, setProductoPickerSearch] = useState('')
  const [productoPickerLoading, setProductoPickerLoading] = useState(false)
  const [productoPickerError, setProductoPickerError] = useState<string | null>(null)
  const [productoPickerItems, setProductoPickerItems] = useState<Material[]>([])

  const [createClienteInlineOpen, setCreateClienteInlineOpen] = useState(false)
  const [createClienteInlineSubmitting, setCreateClienteInlineSubmitting] = useState(false)
  const [createClienteInlineError, setCreateClienteInlineError] = useState<string | null>(null)
  const [createClienteInlineForm, setCreateClienteInlineForm] = useState({
    nombre: '',
    tipoDocumento: 'CC',
    documento: '',
    email: '',
    telefono: '',
    celular: '',
    direccion: '',
    ciudad: '',
    departamento: '',
  })

  const [form, setForm] = useState({
    clienteNombre: '',
    clienteDocumento: '',
    ivaPct: '0',
    discountAmount: '0',
    otherTaxesAmount: '0',
    note: '',
    warehouseId: '',
    items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }] as DraftItem[],
  })

  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentMethod, string>>(() =>
    PAYMENT_METHODS.reduce((acc, key) => {
      acc[key] = '0'
      return acc
    }, {} as Record<PaymentMethod, string>),
  )
  const [paymentsTouched, setPaymentsTouched] = useState(false)

  const [returnForm, setReturnForm] = useState({
    invoiceId: '',
    motivo: '',
    ivaPct: '0',
    warehouseId: '',
    items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }] as DraftItem[],
  })

  const defaultBodegaId = useMemo(() => bodegas.find((b) => b.isDefault)?.id ?? '', [bodegas])

  const computedReturn = useMemo(() => {
    const ivaPct = Math.max(0, n(returnForm.ivaPct, 0))
    const lines = returnForm.items
      .map((it) => {
        const quantity = Math.max(0, n(it.quantity, 0))
        const unitPrice = Math.max(0, n(it.unitPrice, 0))
        const total = quantity * unitPrice
        return { ...it, quantity, unitPrice, total }
      })
      .filter((it) => it.quantity > 0)

    const subtotal = lines.reduce((sum, it) => sum + it.total, 0)
    const iva = subtotal * (ivaPct / 100)
    const total = subtotal + iva

    return { ivaPct, lines, subtotal, iva, total }
  }, [returnForm.items, returnForm.ivaPct])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [resInvoices, resReturns, resBodegas, resMaterials] = await Promise.all([
        fetch('/api/pos/facturas?limit=50'),
        fetch('/api/pos/devoluciones?limit=50'),
        fetch('/api/bodegas'),
        fetch(`/api/materiales?search=${encodeURIComponent(materialSearch)}`),
      ])

      const jsonInvoices = (await resInvoices.json().catch(() => ({}))) as ApiListResponse<InvoiceListItem[]>
      const jsonReturns = (await resReturns.json().catch(() => ({}))) as ApiListResponse<ReturnListItem[]>
      const jsonBodegas = (await resBodegas.json().catch(() => ({}))) as ApiListResponse<Bodega[]>
      const jsonMaterials = (await resMaterials.json().catch(() => ({}))) as ApiListResponse<Material[]>

      if (resInvoices.ok && jsonInvoices.success && Array.isArray(jsonInvoices.data)) {
        setInvoices(jsonInvoices.data)
      } else if (!resInvoices.ok) {
        setError(jsonInvoices.error || t('pos.errors.loadInvoices'))
      }

      if (resReturns.ok && jsonReturns.success && Array.isArray(jsonReturns.data)) {
        setReturns(jsonReturns.data)
      } else if (!resReturns.ok) {
        setError((prev) => prev || jsonReturns.error || t('pos.errors.loadReturns'))
      }

      if (resBodegas.ok && jsonBodegas.success && Array.isArray(jsonBodegas.data)) {
        setBodegas(jsonBodegas.data)
      } else if (!resBodegas.ok) {
        setError((prev) => prev || jsonBodegas.error || t('pos.errors.loadWarehouses'))
      }

      if (resMaterials.ok && jsonMaterials.success && Array.isArray(jsonMaterials.data)) {
        setMaterials(jsonMaterials.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }, [materialSearch, t])

  const exportExcel = useCallback(() => {
    window.location.href = '/api/pos/export'
  }, [])

  const loadDianDocs = useCallback(async () => {
    setDianLoading(true)
    setDianError(null)
    try {
      const qs = new URLSearchParams({ limit: '100' })
      if (dianFilterDirection !== 'ALL') qs.set('direction', dianFilterDirection)

      const res = await fetch(`/api/dian/documentos?${qs.toString()}`)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.ok || !Array.isArray(json.data)) {
        setDianError(json.error || t('pos.dian.errors.loadDocuments'))
        setDianDocs([])
        return
      }
      setDianDocs(json.data as DianDocListItem[])
    } catch (e) {
      setDianError(e instanceof Error ? e.message : t('common.unexpectedError'))
      setDianDocs([])
    } finally {
      setDianLoading(false)
    }
  }, [dianFilterDirection, t])

  const loadClientesPicker = useCallback(async () => {
    setClientePickerLoading(true)
    setClientePickerError(null)
    try {
      const res = await fetch(`/api/clientes?search=${encodeURIComponent(clientePickerSearch)}`)
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setClientePickerError(json.error || t('pos.errors.loadClients'))
        setClientePickerItems([])
        return
      }
      const raw = json.data as Array<Record<string, unknown>>
      const items: ClientePickerItem[] = raw.map((c) => ({
        id: String(c.id ?? ''),
        nombre: String(c.nombre ?? ''),
        documento: c.documento != null ? String(c.documento) : null,
        email: c.email != null ? String(c.email) : null,
      }))
      setClientePickerItems(items)
    } catch (e) {
      setClientePickerError(e instanceof Error ? e.message : t('common.unexpectedError'))
      setClientePickerItems([])
    } finally {
      setClientePickerLoading(false)
    }
  }, [clientePickerSearch, t])

  const loadProductosPicker = useCallback(async () => {
    setProductoPickerLoading(true)
    setProductoPickerError(null)
    try {
      const res = await fetch(`/api/materiales?search=${encodeURIComponent(productoPickerSearch)}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<Material[]>
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setProductoPickerError(json.error || t('pos.errors.loadProducts'))
        setProductoPickerItems([])
        return
      }
      setProductoPickerItems(json.data)
    } catch (e) {
      setProductoPickerError(e instanceof Error ? e.message : t('common.unexpectedError'))
      setProductoPickerItems([])
    } finally {
      setProductoPickerLoading(false)
    }
  }, [productoPickerSearch, t])

  useEffect(() => {
    if (!clientePickerOpen) return
    void loadClientesPicker()
  }, [clientePickerOpen, loadClientesPicker])

  useEffect(() => {
    if (!productoPickerOpen) return
    void loadProductosPicker()
  }, [productoPickerOpen, loadProductosPicker])

  function onPickCliente(item: ClientePickerItem) {
    if (clientePickerTarget === 'dian') {
      setDianCreateBuyer((prev) => ({
        ...prev,
        nombre: item.nombre,
        documento: item.documento ?? '',
        email: item.email ?? prev.email,
      }))
    } else if (clientePickerTarget === 'dian-config') {
      setDianSettings((prev) => ({
        ...prev,
        compradorDefault: {
          ...(prev.compradorDefault || {}),
          nombre: item.nombre,
          documento: item.documento ?? '',
          email: item.email ?? prev.compradorDefault?.email,
        },
      }))
    } else {
      setForm((prev) => ({
        ...prev,
        clienteNombre: item.nombre,
        clienteDocumento: item.documento ?? '',
      }))
    }
    setClientePickerOpen(false)
  }

  function onPickProducto(item: Material) {
    const target = productoPickerTarget
    if (!target) return

    if (target.kind === 'dian') {
      setDianCreateItems((prev) =>
        prev.map((x, i) => (i === target.idx ? { ...x, descripcion: item.nombre, unitPrice: String(priceSuggestion(item)) } : x)),
      )
    } else if (target.kind === 'dian-config') {
      setDianSettings((prev) => ({
        ...prev,
        productos: [
          ...(Array.isArray(prev.productos) ? prev.productos : []),
          {
            codigo: '',
            descripcion: item.nombre,
            unitPrice: priceSuggestion(item),
            ivaPct: 0,
          },
        ],
      }))
    } else {
      updateItem(target.idx, {
        materialId: item.id,
        descripcion: item.nombre,
        unitPrice: String(priceSuggestion(item)),
      })
    }

    setProductoPickerOpen(false)
    setProductoPickerTarget(null)
  }

  const loadDianDetail = useCallback(async (id: string) => {
    if (!id) return

    setDianDetailLoading(true)
    setDianDetailError(null)
    try {
      const res = await fetch(`/api/dian/documentos/${id}`)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.ok || !json.data) {
        setDianDetailError(json.error || t('pos.dian.errors.loadDocumentDetail'))
        setDianDetail(null)
        return
      }
      setDianDetail(json.data as DianDocDetail)
    } catch (e) {
      setDianDetailError(e instanceof Error ? e.message : t('common.unexpectedError'))
      setDianDetail(null)
    } finally {
      setDianDetailLoading(false)
    }
  }, [t])

  const loadDianSettings = useCallback(async () => {
    setDianSettingsLoading(true)
    try {
      const res = await fetch('/api/dian/config', { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.ok) {
        setDianError(json.error || t('pos.dian.errors.loadSettings'))
        return
      }
      setDianSettings((json.data && typeof json.data === 'object' ? (json.data as DianSettings) : {}) as DianSettings)
    } catch (e) {
      setDianError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setDianSettingsLoading(false)
    }
  }, [t])

  const saveDianSettings = useCallback(async (next: DianSettings) => {
    setDianSettingsSaving(true)
    try {
      const res = await fetch('/api/dian/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.ok) {
        setDianError(json.error || t('pos.dian.errors.saveSettings'))
        return false
      }
      setDianSettings((json.data && typeof json.data === 'object' ? (json.data as DianSettings) : {}) as DianSettings)
      return true
    } catch (e) {
      setDianError(e instanceof Error ? e.message : t('common.unexpectedError'))
      return false
    } finally {
      setDianSettingsSaving(false)
    }
  }, [t])

  useEffect(() => {
    if (activeTab !== 'dian') return
    if (dianMainTab === 'configuracion' || dianMainTab === 'plantillas') {
      void loadDianSettings()
    }
  }, [activeTab, dianMainTab, loadDianSettings])

  useEffect(() => {
    if (activeTab !== 'dian') return
    if (dianMainTab !== 'historico') return
    const nextDir: 'ALL' | DianDirection = dianHistoricoTab === 'recibidos' ? 'INBOUND' : 'OUTBOUND'
    if (dianFilterDirection !== nextDir) setDianFilterDirection(nextDir)
  }, [activeTab, dianFilterDirection, dianHistoricoTab, dianMainTab])

  const createDianDocFromUi = useCallback(
    async (args: { type: DianType; numero: string; payload: Record<string, unknown> }): Promise<boolean> => {
      if (dianCreating) return false

      const numero = (args.numero || '').trim()
      if (!numero) {
        setDianError(t('pos.dian.validation.numberRequired'))
        return false
      }

      setDianCreating(true)
      setDianError(null)
      try {
        const res = await fetch('/api/dian/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            direction: 'OUTBOUND',
            type: args.type,
            numero,
            payload: args.payload,
          }),
        })

        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
        if (!res.ok || !json.ok || !json.data) {
          setDianError(json.error || t('pos.dian.errors.createDocument'))
          return false
        }

        const created = json.data as { id?: string } | null
        await loadDianDocs()
        if (created?.id) {
          setDianSelectedId(created.id)
          await loadDianDetail(created.id)
        }
        return true
      } catch (e) {
        setDianError(e instanceof Error ? e.message : t('common.unexpectedError'))
        return false
      } finally {
        setDianCreating(false)
      }
    },
    [dianCreating, loadDianDetail, loadDianDocs]
  )

  function validateDianNumeroAgainstSettings(args: { tipoDoc: DianNumeracionTipoDocumento; numero: string }): string | null {
    const numero = (args.numero || '').trim()
    if (!numero) return t('pos.dian.validation.numberRequired')

    const numeracion = (Array.isArray(dianSettings.numeracion) ? dianSettings.numeracion : []).filter(
      (r) => Boolean(r.activo) && (r.tipoDocumento ?? 'FACTURA_VENTA') === args.tipoDoc
    )

    if (numeracion.length === 0) return null

    const today = new Date()
    const matched = numeracion.find((r) => {
      const pref = String(r.prefijo ?? '').trim()
      if (!pref) return false
      const re = new RegExp(`^${escapeRegExp(pref)}(?:[-\s])?(\\d+)$`)
      return re.test(numero)
    })

    if (!matched) {
      return t('pos.dian.validation.numberNoActiveRangeMatch')
    }

    const pref = String(matched.prefijo ?? '').trim()
    const re = new RegExp(`^${escapeRegExp(pref)}(?:[-\s])?(\\d+)$`)
    const m = re.exec(numero)
    const consecutive = m && m[1] ? n(m[1], NaN) : NaN
    const desde = n(matched.desde, NaN)
    const hasta = n(matched.hasta, NaN)
    const actual = n(matched.actual, NaN)

    if (!Number.isFinite(consecutive)) {
      return t('pos.dian.validation.numberConsecutiveParseError')
    }
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || desde <= 0 || hasta <= 0 || desde > hasta) {
      return t('pos.dian.validation.rangeBadConfigured')
    }
    if (consecutive < desde || consecutive > hasta) {
      return t('pos.dian.validation.consecutiveOutOfRange', { consecutive, desde, hasta })
    }
    if (Number.isFinite(actual) && consecutive < actual) {
      return t('pos.dian.validation.consecutiveLessThanCurrent', { consecutive, actual })
    }

    const fv = String(matched.fechaVencimiento ?? '').trim()
    if (fv) {
      const exp = new Date(`${fv}T00:00:00`)
      if (!Number.isNaN(exp.getTime()) && exp < new Date(today.toDateString())) {
        return t('pos.dian.validation.rangeExpired')
      }
    }

    return null
  }

  const suggestDianNumeroFromSettings = useCallback(
    (tipoDoc: DianNumeracionTipoDocumento): string => {
      const numeracion = (Array.isArray(dianSettings.numeracion) ? dianSettings.numeracion : []).filter(
        (r) => Boolean(r.activo) && (r.tipoDocumento ?? 'FACTURA_VENTA') === tipoDoc
      )
      if (numeracion.length === 0) return ''

      const today = new Date()
      const candidates = numeracion.filter((r) => {
        const pref = String(r.prefijo ?? '').trim()
        if (!pref) return false

        const fv = String(r.fechaVencimiento ?? '').trim()
        if (fv) {
          const exp = new Date(`${fv}T00:00:00`)
          if (!Number.isNaN(exp.getTime()) && exp < new Date(today.toDateString())) return false
        }

        const desde = n(r.desde, NaN)
        const hasta = n(r.hasta, NaN)
        const actual = n(r.actual, NaN)
        const next = Number.isFinite(actual) ? actual : Number.isFinite(desde) ? desde : NaN
        if (!Number.isFinite(next)) return false
        if (Number.isFinite(desde) && next < desde) return false
        if (Number.isFinite(hasta) && next > hasta) return false
        return true
      })

      const chosen = candidates[0]
      if (!chosen) return ''

      const pref = String(chosen.prefijo ?? '').trim()
      const desde = n(chosen.desde, NaN)
      const actual = n(chosen.actual, NaN)
      const next = Number.isFinite(actual) ? actual : Number.isFinite(desde) ? desde : NaN
      if (!pref || !Number.isFinite(next)) return ''
      return `${pref}-${next}`
    },
    [dianSettings.numeracion]
  )

  const bumpAndPersistDianActual = useCallback(
    async (args: { tipoDoc: DianNumeracionTipoDocumento; numero: string }) => {
      const numero = (args.numero || '').trim()
      if (!numero) return

      let nextSettings: DianSettings | null = null

      setDianSettings((prev) => {
        const current = Array.isArray(prev.numeracion) ? prev.numeracion : []
        const next = current.map((r) => {
          if (!r.activo) return r
          if ((r.tipoDocumento ?? 'FACTURA_VENTA') !== args.tipoDoc) return r
          const pref = String(r.prefijo ?? '').trim()
          if (!pref) return r
          const re = new RegExp(`^${escapeRegExp(pref)}(?:[-\\s])?(\\d+)$`)
          const m = re.exec(numero)
          if (!m || !m[1]) return r
          const consecutive = n(m[1], NaN)
          if (!Number.isFinite(consecutive)) return r
          const actual = n(r.actual, NaN)
          if (Number.isFinite(actual) && consecutive < actual) return r
          return { ...r, actual: consecutive + 1 }
        })
        nextSettings = { ...prev, numeracion: next }
        return nextSettings
      })

      if (nextSettings) {
        const saved = await saveDianSettings(nextSettings)
        if (!saved) {
            setDianError((prev) => prev || t('pos.dian.errors.consecutivePersistFailed'))
        }
      }
    },
      [saveDianSettings, t]
  )

  const loadPosInvoiceIntoDian = useCallback(
    async (invoiceId: string) => {
      const id = String(invoiceId || '').trim()
      if (!id) {
        setDianError(t('pos.dian.posInvoice.selectInternalInvoice'))
        return
      }

      setDianCreatePosInvoiceLoading(true)
      setDianError(null)
      try {
        const res = await fetch(`/api/pos/facturas/${encodeURIComponent(id)}`)
        const json = (await res.json().catch(() => ({}))) as ApiListResponse<InvoiceDetail>
        if (!res.ok || !json.success || !json.data) {
          setDianError(json.error || t('pos.dian.posInvoice.loadFailed'))
          setDianCreatePosInvoice(null)
          return
        }

        const inv = json.data
        setDianCreatePosInvoice(inv)
        setDianCreateBuyer({
          nombre: String(inv.clienteNombre ?? ''),
          documento: String(inv.clienteDocumento ?? ''),
          email: '',
        })
        setDianCreateItems(
          Array.isArray(inv.items) && inv.items.length > 0
            ? inv.items.map((it) => ({
                descripcion: String(it.descripcion ?? ''),
                quantity: String(n(it.quantity, 0)),
                unitPrice: String(n(it.unitPrice, 0)),
                ivaPct: String(n(inv.ivaPct, 0)),
              }))
            : [{ descripcion: '', quantity: '1', unitPrice: '', ivaPct: String(n(inv.ivaPct, 0)) }]
        )

        if (!dianCreateNumero.trim()) {
          const suggested = suggestDianNumeroFromSettings('FACTURA_VENTA')
          if (suggested) setDianCreateNumero(suggested)
        }
      } catch (e) {
        setDianError(e instanceof Error ? e.message : t('common.unexpectedError'))
        setDianCreatePosInvoice(null)
      } finally {
        setDianCreatePosInvoiceLoading(false)
      }
    },
    [dianCreateNumero, suggestDianNumeroFromSettings, t]
  )

  const createDianDocFromPosInvoice = useCallback(
    async (args: { posInvoiceId: string; subType: string }) => {
      const posInvoiceId = String(args.posInvoiceId || '').trim()
      if (!posInvoiceId) {
        setDianError(t('pos.dian.posInvoice.selectInternalInvoice'))
        return
      }

      if (dianCreatePosInvoice?.id !== posInvoiceId) {
        await loadPosInvoiceIntoDian(posInvoiceId)
      }

      const inv = dianCreatePosInvoice
      if (!inv || inv.id !== posInvoiceId) {
        setDianError(t('pos.dian.posInvoice.selectedLoadFailed'))
        return
      }
      if (String(inv.status || '') === 'DRAFT') {
        setDianError(t('pos.dian.posInvoice.isDraftFinalizeFirst'))
        return
      }
      if (!String(inv.clienteNombre || '').trim() || !String(inv.clienteDocumento || '').trim()) {
        setDianError(t('pos.dian.posInvoice.clientIncomplete'))
        return
      }

      let numero = dianCreateNumero.trim()
      if (!numero) {
        const suggested = suggestDianNumeroFromSettings('FACTURA_VENTA')
        if (suggested) {
          numero = suggested
          setDianCreateNumero(suggested)
        }
      }

      const numeroErr = validateDianNumeroAgainstSettings({ tipoDoc: 'FACTURA_VENTA', numero })
      if (numeroErr) {
        setDianError(numeroErr)
        return
      }

      if (dianCreating) return
      setDianCreating(true)
      setDianError(null)
      try {
        const res = await fetch('/api/dian/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            direction: 'OUTBOUND',
            type: 'INVOICE' satisfies DianType,
            posInvoiceId,
            numero,
            payload: {
              ui: {
                kind: 'POS_INVOICE',
                subType: args.subType,
                posInvoiceId,
              },
            },
          }),
        })

        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
        if (!res.ok || !json.ok || !json.data) {
          setDianError(json.error || t('pos.dian.errors.createOrReconcileDocument'))
          return
        }

        const created = json.data as { id?: string; reused?: boolean } | null
        await loadDianDocs()
        if (created?.id) {
          setDianSelectedId(created.id)
          await loadDianDetail(created.id)
        }

        if (!created?.reused) {
          await bumpAndPersistDianActual({ tipoDoc: 'FACTURA_VENTA', numero })
        }
      } catch (e) {
        setDianError(e instanceof Error ? e.message : t('common.unexpectedError'))
      } finally {
        setDianCreating(false)
      }
    },
    [
      bumpAndPersistDianActual,
      dianCreateNumero,
      dianCreatePosInvoice,
      dianCreating,
      loadDianDetail,
      loadDianDocs,
      loadPosInvoiceIntoDian,
      suggestDianNumeroFromSettings,
    ]
  )

  const normalizedDianCreateItems = useMemo(() => {
    return (dianCreateItems || [])
      .map((it) => {
        const descripcion = String(it.descripcion || '').trim()
        const quantity = Math.max(0, n(it.quantity, 0))
        const unitPrice = Math.max(0, n(it.unitPrice, 0))
        const ivaPct = Math.max(0, n(it.ivaPct, 0))
        return { descripcion, quantity, unitPrice, ivaPct }
      })
      .filter((it) => it.descripcion && it.quantity > 0)
  }, [dianCreateItems])

  const createDianDocFromCrear = useCallback(
    async (args: { dianType: DianType; subType: string }) => {
      const numero = dianCreateNumero.trim()
      const tipoDoc: DianNumeracionTipoDocumento =
        args.subType === 'NOTA_CREDITO' ? 'NOTA_CREDITO' : args.subType === 'NOTA_DEBITO' ? 'NOTA_DEBITO' : 'FACTURA_VENTA'

      const numeroErr = validateDianNumeroAgainstSettings({ tipoDoc, numero })
      if (numeroErr) {
        setDianError(numeroErr)
        return
      }

      const buyerNombre = dianCreateBuyer.nombre.trim()
      const buyerDocumento = dianCreateBuyer.documento.trim()
      if (!buyerNombre) {
        setDianError('El nombre del adquirente/comprador es requerido')
        return
      }
      if (!buyerDocumento) {
        setDianError('El documento del adquirente/comprador es requerido')
        return
      }

      if (normalizedDianCreateItems.length === 0) {
        setDianError(t('pos.dian.validation.itemsRequired'))
        return
      }

      const ok = await createDianDocFromUi({
        type: args.dianType,
        numero,
        payload: {
          ui: {
            kind: 'CREAR',
            subType: args.subType,
            buyer: {
              nombre: buyerNombre,
              documento: buyerDocumento,
              email: dianCreateBuyer.email.trim() || undefined,
            },
            items: normalizedDianCreateItems,
          },
        },
      })

      if (ok) {
        await bumpAndPersistDianActual({ tipoDoc, numero })
      }
    },
    [bumpAndPersistDianActual, createDianDocFromUi, dianCreateBuyer, dianCreateNumero, normalizedDianCreateItems, validateDianNumeroAgainstSettings]
  )

  const createDianDocsLotes = useCallback(async () => {
    const numeros = dianLotesNumeros
      .split(/\r?\n|,|;/g)
      .map((s) => s.trim())
      .filter(Boolean)

    if (numeros.length === 0) {
      setDianError(t('pos.dian.create.batch.numbersRequired'))
      return
    }

    const buyerNombre = dianCreateBuyer.nombre.trim()
    const buyerDocumento = dianCreateBuyer.documento.trim()
    if (!buyerNombre) {
      setDianError(t('pos.dian.create.buyerNameRequired'))
      return
    }
    if (!buyerDocumento) {
      setDianError(t('pos.dian.create.buyerDocumentRequired'))
      return
    }
    if (normalizedDianCreateItems.length === 0) {
      setDianError(t('pos.dian.create.itemsRequired'))
      return
    }

    if (dianCreating) return
    setDianCreating(true)
    setDianError(null)
    try {
      for (const numero of numeros) {
        const res = await fetch('/api/dian/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            direction: 'OUTBOUND',
            type: 'INVOICE' satisfies DianType,
            numero,
            payload: {
              ui: {
                kind: 'CREAR',
                subType: 'FACTURA_LOTES',
                buyer: {
                  nombre: buyerNombre,
                  documento: buyerDocumento,
                  email: dianCreateBuyer.email.trim() || undefined,
                },
                items: normalizedDianCreateItems,
              },
            },
          }),
        })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
        if (!res.ok || !json.ok) {
          setDianError(json.error || t('pos.dian.errors.createDocumentNumber', { numero }))
          break
        }
      }
      await loadDianDocs()
    } catch (e) {
      setDianError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setDianCreating(false)
    }
  }, [dianCreateBuyer, dianCreating, dianLotesNumeros, loadDianDocs, normalizedDianCreateItems, t])

  const updateDianNumeracionItem = useCallback((idx: number, patch: Partial<NonNullable<DianSettings['numeracion']>[number]>) => {
    setDianSettings((prev) => {
      const current = Array.isArray(prev.numeracion) ? prev.numeracion : []
      const next = current.map((it, i) => (i === idx ? { ...it, ...patch } : it))
      return { ...prev, numeracion: next }
    })
  }, [])

  const addDianNumeracionItem = useCallback(() => {
    setDianSettings((prev) => {
      const current = Array.isArray(prev.numeracion) ? prev.numeracion : []
      return {
        ...prev,
        numeracion: [
          ...current,
          { tipoDocumento: 'FACTURA_VENTA', prefijo: '', desde: 1, hasta: 999999, actual: 1, nroAutorizacion: '', fechaVencimiento: '', activo: true },
        ],
      }
    })
  }, [])

  const removeDianNumeracionItem = useCallback((idx: number) => {
    setDianSettings((prev) => {
      const current = Array.isArray(prev.numeracion) ? prev.numeracion : []
      const next = current.filter((_, i) => i !== idx)
      return { ...prev, numeracion: next }
    })
  }, [])

  const validateDianNumeracion = useCallback((items: NonNullable<DianSettings['numeracion']>) => {
    const messages: string[] = []
    const today = new Date()
    const todayStart = new Date(today.toDateString())

    const normalized = items.map((r, idx) => {
      const tipoDocumento = (r.tipoDocumento ?? 'FACTURA_VENTA') as DianNumeracionTipoDocumento
      const prefijo = String(r.prefijo ?? '').trim()
      const desde = n(r.desde, NaN)
      const hasta = n(r.hasta, NaN)
      const actual = n(r.actual, NaN)
      const nroAutorizacion = String(r.nroAutorizacion ?? '').trim()
      const fechaVencimiento = String(r.fechaVencimiento ?? '').trim()
      const activo = Boolean(r.activo)

      if (!prefijo) messages.push(t('pos.dian.numerationValidation.prefixRequired', { idx: idx + 1 }))
      if (!Number.isFinite(desde) || desde <= 0) messages.push(t('pos.dian.numerationValidation.fromGtZero', { idx: idx + 1 }))
      if (!Number.isFinite(hasta) || hasta <= 0) messages.push(t('pos.dian.numerationValidation.toGtZero', { idx: idx + 1 }))
      if (Number.isFinite(desde) && Number.isFinite(hasta) && desde > hasta) {
        messages.push(t('pos.dian.numerationValidation.fromNotGreaterThanTo', { idx: idx + 1 }))
      }
      if (!Number.isFinite(actual) || actual <= 0) messages.push(t('pos.dian.numerationValidation.currentGtZero', { idx: idx + 1 }))
      if (Number.isFinite(desde) && Number.isFinite(hasta) && Number.isFinite(actual) && (actual < desde || actual > hasta)) {
        messages.push(t('pos.dian.numerationValidation.currentWithinBounds', { idx: idx + 1 }))
      }
      if (!nroAutorizacion) messages.push(t('pos.dian.numerationValidation.authorizationRequired', { idx: idx + 1 }))
      if (!fechaVencimiento) messages.push(t('pos.dian.numerationValidation.expirationRequired', { idx: idx + 1 }))
      if (fechaVencimiento) {
        const exp = new Date(`${fechaVencimiento}T00:00:00`)
        if (Number.isNaN(exp.getTime())) {
          messages.push(t('pos.dian.numerationValidation.expirationInvalid', { idx: idx + 1 }))
        } else if (activo && exp < todayStart) {
          messages.push(t('pos.dian.numerationValidation.expiredButActive', { idx: idx + 1 }))
        }
      }

      return { idx, tipoDocumento, prefijo, desde, hasta, activo }
    })

    // Validar traslape entre rangos activos del mismo tipo+prefijo
    const active = normalized.filter((r) => r.activo && r.prefijo && Number.isFinite(r.desde) && Number.isFinite(r.hasta))
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]!
        const b = active[j]!
        if (a.tipoDocumento !== b.tipoDocumento) continue
        if (a.prefijo !== b.prefijo) continue
        const overlap = a.desde <= b.hasta && b.desde <= a.hasta
        if (overlap) {
          messages.push(t('pos.dian.numerationValidation.overlap', { a: a.idx + 1, b: b.idx + 1 }))
        }
      }
    }

    const ok = messages.length === 0
    return { ok, messages }
  }, [t])

  const onValidateNumeracion = useCallback(() => {
    const items = Array.isArray(dianSettings.numeracion) ? dianSettings.numeracion : []
    const result = validateDianNumeracion(items)
    setDianNumeracionValidation(result)
    if (!result.ok) setDianError(t('pos.dian.numerationValidation.hasErrors'))
    else setDianError(null)
  }, [dianSettings.numeracion, t, validateDianNumeracion])

  const onSaveDianSettings = useCallback(async () => {
    const items = Array.isArray(dianSettings.numeracion) ? dianSettings.numeracion : []
    if (items.length > 0) {
      const result = validateDianNumeracion(items)
      setDianNumeracionValidation(result)
      if (!result.ok) {
        setDianError(t('pos.dian.numerationValidation.fixBeforeSave'))
        return
      }
    }
    await saveDianSettings(dianSettings)
  }, [dianSettings, saveDianSettings, t, validateDianNumeracion])

  const runDianAction = useCallback(
    async (action: DianAction) => {
      if (!dianSelectedId || dianActionSubmitting) return
      if (action === 'transmitir' && dianDetail?.direction === 'INBOUND') {
        setDianDetailError(t('pos.dian.actions.transmit.outboundOnly'))
        return
      }

      setDianActionSubmitting(action)
      setDianDetailError(null)
      try {
        const res = await fetch(`/api/dian/documentos/${dianSelectedId}/${action}`, { method: 'POST' })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
        if (!res.ok || !json.ok) {
          setDianDetailError(json.error || t('pos.dian.errors.actionFailed'))
          return
        }
        await loadDianDocs()
        await loadDianDetail(dianSelectedId)
      } catch (e) {
        setDianDetailError(e instanceof Error ? e.message : t('common.unexpectedError'))
      } finally {
        setDianActionSubmitting(null)
      }
    },
    [dianActionSubmitting, dianDetail?.direction, dianSelectedId, loadDianDetail, loadDianDocs, t]
  )

  const dianBitacora = useMemo(() => {
    if (!dianDetail?.events?.length) return ''
    return dianDetail.events
      .map((ev) => `${new Date(ev.createdAt).toLocaleString(locale)} [${ev.type}] ${ev.message}`)
      .join('\n')
  }, [dianDetail?.events, locale])

  useEffect(() => {
    if (activeTab !== 'dian') return
    void loadDianDocs()
  }, [activeTab, loadDianDocs])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  function openCreate() {
    setError(null)
    setCreateAsDraft(false)
    setForm({
      clienteNombre: t('pos.createDialog.defaultCustomer'),
      clienteDocumento: '',
      ivaPct: '0',
      discountAmount: '0',
      otherTaxesAmount: '0',
      note: '',
      warehouseId: defaultBodegaId,
      items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    })
    setPaymentsTouched(false)
    setPaymentAmounts(
      PAYMENT_METHODS.reduce((acc, key) => {
        acc[key] = '0'
        return acc
      }, {} as Record<PaymentMethod, string>),
    )
    setCreateOpen(true)
  }

  async function submitInlineCliente(e: React.FormEvent) {
    e.preventDefault()
    setCreateClienteInlineSubmitting(true)
    setCreateClienteInlineError(null)

    try {
      const payload = {
        ...createClienteInlineForm,
        nombre: createClienteInlineForm.nombre.trim(),
        documento: createClienteInlineForm.documento.trim(),
        email: createClienteInlineForm.email.trim() || undefined,
        telefono: createClienteInlineForm.telefono.trim() || undefined,
        celular: createClienteInlineForm.celular.trim() || undefined,
        direccion: createClienteInlineForm.direccion.trim() || undefined,
        ciudad: createClienteInlineForm.ciudad.trim() || undefined,
        departamento: createClienteInlineForm.departamento.trim() || undefined,
      }

      if (!payload.nombre || !payload.tipoDocumento || !payload.documento) {
        setCreateClienteInlineError(t('pos.customers.inlineCreate.errors.required'))
        return
      }

      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.success) {
        setCreateClienteInlineError(json.error || t('pos.customers.inlineCreate.errors.failed'))
        return
      }

      const created = json.data as { nombre?: unknown; documento?: unknown }
      const nombre = String(created?.nombre ?? payload.nombre)
      const documento = String(created?.documento ?? payload.documento)

      setForm((p) => ({ ...p, clienteNombre: nombre, clienteDocumento: documento }))
      setCreateClienteInlineOpen(false)
    } catch (e) {
      setCreateClienteInlineError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setCreateClienteInlineSubmitting(false)
    }
  }

  function openReturn() {
    setError(null)
    setReturnForm({
      invoiceId: '',
      motivo: '',
      ivaPct: '0',
      warehouseId: defaultBodegaId,
      items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    })
    setReturnOpen(true)
  }

  async function onReturnInvoiceChange(invoiceId: string) {
    setReturnForm((p) => ({ ...p, invoiceId }))
    if (!invoiceId) return

    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<InvoiceDetail>
      if (!res.ok || !json.success || !json.data) {
        setError(json.error || t('pos.errors.loadInvoiceForReturnPrefill'))
        return
      }

      const inv = json.data
      const nextWarehouseId = inv.warehouse?.id ?? defaultBodegaId
      const nextIvaPct = String(Math.max(0, n(inv.ivaPct, 0)))

      const nextItems: DraftItem[] = (inv.items || []).map((it) => ({
        materialId: it.material?.id ?? '',
        descripcion: it.descripcion ?? it.material?.nombre ?? t('pos.itemFallback'),
        quantity: String(Math.max(0, n(it.quantity, 0)) || 1),
        unitPrice: String(Math.max(0, n(it.unitPrice, 0))),
      }))

      setReturnForm((p) => ({
        ...p,
        ivaPct: p.ivaPct !== '0' ? p.ivaPct : nextIvaPct,
        warehouseId: p.warehouseId || nextWarehouseId,
        items: nextItems.length ? nextItems : p.items,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    }
  }

  function updateReturnItem(idx: number, patch: Partial<DraftItem>) {
    setReturnForm((prev) => {
      const next = [...prev.items]
      const current = next[idx]
      if (!current) return prev
      const updated = { ...current, ...patch }

      if (patch.materialId !== undefined) {
        const m = materials.find((x) => x.id === patch.materialId) ?? null
        if (m) {
          if (!updated.descripcion) updated.descripcion = m.nombre
          if (!updated.unitPrice) updated.unitPrice = String(priceSuggestion(m))
        }
      }

      next[idx] = updated
      return { ...prev, items: next }
    })
  }

  function addReturnItem() {
    setReturnForm((prev) => ({
      ...prev,
      items: [...prev.items, { materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    }))
  }

  function removeReturnItem(idx: number) {
    setReturnForm((prev) => {
      const next = prev.items.filter((_, i) => i !== idx)
      return {
        ...prev,
        items: next.length ? next : [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
      }
    })
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setForm((prev) => {
      const next = [...prev.items]
      const current = next[idx]
      if (!current) return prev
      const updated = { ...current, ...patch }

      if (patch.materialId !== undefined) {
        const m = materials.find((x) => x.id === patch.materialId) ?? null
        if (m) {
          if (!updated.descripcion) updated.descripcion = m.nombre
          if (!updated.unitPrice) updated.unitPrice = String(priceSuggestion(m))
        }
      }

      next[idx] = updated
      return { ...prev, items: next }
    })
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    }))
  }

  function removeItem(idx: number) {
    setForm((prev) => {
      const next = prev.items.filter((_, i) => i !== idx)
      return { ...prev, items: next.length ? next : [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }] }
    })
  }

  const computed = useMemo(() => {
    const ivaPct = Math.max(0, n(form.ivaPct, 0))
    const lines = form.items
      .map((it) => {
        const quantity = Math.max(0, n(it.quantity, 0))
        const unitPrice = Math.max(0, n(it.unitPrice, 0))
        const total = quantity * unitPrice
        return { ...it, quantity, unitPrice, total }
      })
      .filter((it) => it.quantity > 0)

    const subtotal = lines.reduce((sum, it) => sum + it.total, 0)
    const discountAmount = Math.max(0, parseMoneyInput(form.discountAmount, 0))
    const otherTaxesAmount = Math.max(0, parseMoneyInput(form.otherTaxesAmount, 0))
    const discountFinal = Math.min(subtotal, discountAmount)
    const taxableBase = Math.max(0, subtotal - discountFinal)
    const iva = taxableBase * (ivaPct / 100)
    const total = taxableBase + iva + otherTaxesAmount

    return { ivaPct, lines, subtotal, discountAmount: discountFinal, taxableBase, otherTaxesAmount, iva, total }
  }, [form.items, form.ivaPct, form.discountAmount, form.otherTaxesAmount])

  const computedPayments = useMemo(() => {
    const normalized = PAYMENT_METHODS.map((method) => ({
      method,
      amount: Math.max(0, parseMoneyInput(paymentAmounts[method], 0)),
    })).filter((p) => p.amount > 0)

    const sum = normalized.reduce((acc, p) => acc + p.amount, 0)
    const diff = computed.total - sum
    const ok = createAsDraft || Math.abs(diff) < 0.01

    return { normalized, sum, diff, ok }
  }, [createAsDraft, paymentAmounts, computed.total])

  useEffect(() => {
    if (!createOpen) return
    if (createAsDraft) return
    if (paymentsTouched) return

    setPaymentAmounts((prev) => {
      const next = { ...prev }
      for (const key of PAYMENT_METHODS) next[key] = '0'
      next.CASH = String(Math.max(0, Math.round(computed.total)))
      return next
    })
  }, [createAsDraft, createOpen, computed.total, paymentsTouched])

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!form.clienteNombre.trim()) {
        setError(t('pos.errors.clientNameRequired'))
        return
      }

      if (computed.lines.length === 0) {
        setError(t('pos.errors.itemsRequired'))
        return
      }

      if (!createAsDraft && !computedPayments.ok) {
        setError(t('pos.errors.paymentsMustMatchTotal'))
        return
      }

      const payload = {
        clienteNombre: form.clienteNombre.trim(),
        clienteDocumento: form.clienteDocumento.trim() || undefined,
        ivaPct: computed.ivaPct,
        discountAmount: computed.discountAmount,
        otherTaxesAmount: computed.otherTaxesAmount,
        note: form.note.trim() || undefined,
        warehouseId: form.warehouseId || undefined,
        asDraft: createAsDraft,
        items: computed.lines.map((it) => ({
          materialId: it.materialId || undefined,
          descripcion: it.descripcion?.trim() || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        payments: createAsDraft ? undefined : computedPayments.normalized,
      }

      const res = await fetch('/api/pos/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        if (!createAsDraft && json.error === 'Stock insuficiente') {
          setError(t('pos.errors.stockInsufficientDraftHint'))
          setCreateAsDraft(true)
          return
        }

        setError(json.error || t('pos.errors.createInvoiceFailed'))
        return
      }

      setCreateOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function openDetail(invoiceId: string) {
    setDetailOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)

    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<InvoiceDetail>
      if (!res.ok || !json.success || !json.data) {
        setDetailError(json.error || t('pos.errors.loadInvoiceDetailFailed'))
        return
      }
      setDetail(json.data)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function downloadInvoicePdf(invoiceId: string, numero: string) {
    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}/pdf?download=1`)
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || t('pos.errors.downloadInvoicePdfFailed'))
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `Factura-${numero}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(anchor)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pos.errors.downloadInvoicePdfFailed'))
    }
  }

  function openInvoicePdf(invoiceId: string) {
    window.open(`/api/pos/facturas/${invoiceId}/pdf`, '_blank', 'noopener,noreferrer')
  }

  async function anular(invoiceId: string) {
    const ok = window.confirm(t('pos.confirm.voidInvoice'))
    if (!ok) return

    setError(null)
    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}/anular`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || t('pos.errors.voidInvoiceFailed'))
        return
      }
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    }
  }

  async function finalizar(
    invoiceId: string,
    opts?: {
      confirm?: boolean
      confirmMessage?: string
    }
  ): Promise<boolean> {
    const shouldConfirm = opts?.confirm ?? true
    if (shouldConfirm) {
      const ok = window.confirm(opts?.confirmMessage || t('pos.confirm.finalizeInvoice'))
      if (!ok) return false
    }

    setError(null)
    setDetailError(null)
    setFinalizeSubmitting(true)

    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        details?: {
          materialId?: string
          materialNombre?: string | null
          required?: number
          warehouseId?: string | null
          warehouseNombre?: string | null
          warehouseAvailable?: number | null
          globalAvailable?: number | null
        }
      }
      if (!res.ok || !json.success) {
        const na = t('common.na')
        const d = json.details
        const extra = d
          ? ` | ${t('pos.finalize.details.material')}: ${d.materialNombre || d.materialId || na} | ${t('pos.finalize.details.required')}: ${d.required ?? na} | ${t('pos.finalize.details.warehouse')}: ${d.warehouseNombre || na} | ${t('pos.finalize.details.warehouseAvailable')}: ${d.warehouseAvailable ?? na} | ${t('pos.finalize.details.globalAvailable')}: ${d.globalAvailable ?? na}`
          : ''
        const msg = (json.error || t('pos.errors.finalizeInvoiceFailed')) + extra
        setError(msg)
        setDetailError(msg)
        return false
      }

      await loadAll()
      if (detailOpen && detail?.id === invoiceId) {
        await openDetail(invoiceId)
      }
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.unexpectedError')
      setError(msg)
      setDetailError(msg)
      return false
    } finally {
      setFinalizeSubmitting(false)
    }
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault()
    setReturnSubmitting(true)
    setError(null)

    try {
      if (computedReturn.lines.length === 0) {
        setError(t('pos.errors.returnItemsRequired'))
        return
      }

      const payload = {
        invoiceId: returnForm.invoiceId.trim() || undefined,
        warehouseId: returnForm.warehouseId || undefined,
        motivo: returnForm.motivo.trim() || undefined,
        ivaPct: computedReturn.ivaPct,
        items: computedReturn.lines.map((it) => ({
          materialId: it.materialId || undefined,
          descripcion: it.descripcion?.trim() || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      }

      const res = await fetch('/api/pos/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || t('pos.errors.createReturnFailed'))
        return
      }

      setReturnOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setReturnSubmitting(false)
    }
  }

  async function openReturnDetail(returnId: string) {
    setReturnDetailOpen(true)
    setReturnDetail(null)
    setReturnDetailError(null)
    setReturnDetailLoading(true)

    try {
      const res = await fetch(`/api/pos/devoluciones/${returnId}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<ReturnDetail>
      if (!res.ok || !json.success || !json.data) {
        setReturnDetailError(json.error || t('pos.errors.loadReturnDetailFailed'))
        return
      }
      setReturnDetail(json.data)
    } catch (e) {
      setReturnDetailError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setReturnDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="ERP comercial"
        title={t('pos.title')}
        description={t('pos.subtitle')}
        actions={activeTab === 'interna' ? (
          <>
            <Button onClick={() => void loadAll()} variant="secondary" disabled={isLoading}>
              {t('pos.actions.refresh')}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/pos/plantilla">{t('pos.actions.template')}</Link>
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={isLoading}>
              <Download className="mr-2 h-4 w-4" />
              {t('pos.actions.exportExcel')}
            </Button>
            <Button onClick={openReturn} variant="outline" disabled={isLoading}>
              {t('pos.actions.newReturn')}
            </Button>
            <Button onClick={openCreate} disabled={isLoading}>
              {t('pos.actions.newInvoice')}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => void loadDianDocs()} disabled={dianLoading}>
            {t('pos.dian.actions.refresh')}
          </Button>
        )}
        stats={[
          { label: 'Facturas', value: invoices.length, hint: 'Registros cargados', tone: 'neutral' },
          { label: 'Devoluciones', value: returns.length, hint: 'Documentos internos', tone: 'amber' },
          { label: 'DIAN', value: dianDocs.length, hint: activeTab === 'dian' ? 'Histórico visible' : 'Documentos sincronizados', tone: 'teal' },
        ]}
      />

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const next = (v === 'dian' ? 'dian' : 'interna') as 'interna' | 'dian'
          if (next === activeTab) return
          setTabPending(true)
          setActiveTab(next)
          if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current)
          tabTimerRef.current = window.setTimeout(() => setTabPending(false), 180)
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="interna">{t('pos.tabs.internal')}</TabsTrigger>
          <TabsTrigger value="dian">{t('pos.tabs.dian')}</TabsTrigger>
        </TabsList>

        {tabPending ? (
          <div className="mt-2 text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : null}

        <TabsContent value="interna" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('pos.invoices.recent.title')}</CardTitle>
              <CardDescription>{t('pos.invoices.recent.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-gray-600">{t('common.loading')}</div>
              ) : invoices.length === 0 ? (
                <div className="text-sm text-gray-600">{t('pos.invoices.recent.empty')}</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">{t('pos.invoices.columns.date')}</th>
                        <th className="py-2 pr-4">{t('pos.invoices.columns.number')}</th>
                        <th className="py-2 pr-4">{t('pos.invoices.columns.client')}</th>
                        <th className="py-2 pr-4">{t('pos.invoices.columns.warehouse')}</th>
                        <th className="py-2 pr-4">{t('pos.invoices.columns.status')}</th>
                        <th className="py-2 pr-4">{t('pos.invoices.columns.total')}</th>
                        <th className="py-2 pr-2">{t('pos.invoices.columns.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-700">{new Date(inv.createdAt).toLocaleString(locale)}</td>
                          <td className="py-2 pr-4">
                            <button className="text-blue-700 hover:underline" onClick={() => void openDetail(inv.id)}>
                              {inv.numero}
                            </button>
                          </td>
                          <td className="py-2 pr-4 text-gray-900">{inv.clienteNombre}</td>
                          <td className="py-2 pr-4 text-gray-700">{inv.warehouse?.nombre || t('common.na')}</td>
                          <td className="py-2 pr-4 text-gray-700">{inv.status}</td>
                          <td className="py-2 pr-4 font-medium">{formatCurrency(n(inv.total, 0))}</td>
                          <td className="py-2 pr-2">
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(inv.id)}>
                                {t('pos.actions.view')}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => openInvoicePdf(inv.id)}>
                                {t('pos.actions.print')}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => void downloadInvoicePdf(inv.id, inv.numero)}>
                                {t('pos.actions.downloadPdf')}
                              </Button>
                              {inv.status === 'DRAFT' ? (
                                <Button type="button" size="sm" onClick={() => void finalizar(inv.id)} disabled={finalizeSubmitting}>
                                  {finalizeSubmitting ? t('pos.actions.finalizing') : t('pos.actions.finalize')}
                                </Button>
                              ) : null}
                              <Button type="button" size="sm" variant="destructive" onClick={() => void anular(inv.id)}>
                                {t('pos.actions.void')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('pos.returns.recent.title')}</CardTitle>
              <CardDescription>{t('pos.returns.recent.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-gray-600">{t('common.loading')}</div>
              ) : returns.length === 0 ? (
                <div className="text-sm text-gray-600">{t('pos.returns.recent.empty')}</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">{t('pos.returns.columns.date')}</th>
                        <th className="py-2 pr-4">{t('pos.returns.columns.number')}</th>
                        <th className="py-2 pr-4">{t('pos.returns.columns.invoice')}</th>
                        <th className="py-2 pr-4">{t('pos.returns.columns.warehouse')}</th>
                        <th className="py-2 pr-4">{t('pos.returns.columns.total')}</th>
                        <th className="py-2 pr-2">{t('pos.returns.columns.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-700">{new Date(r.createdAt).toLocaleString(locale)}</td>
                          <td className="py-2 pr-4">
                            <button className="text-blue-700 hover:underline" onClick={() => void openReturnDetail(r.id)}>
                              {r.numero}
                            </button>
                          </td>
                          <td className="py-2 pr-4 text-gray-700">{r.invoice?.numero || t('common.na')}</td>
                          <td className="py-2 pr-4 text-gray-700">{r.warehouse?.nombre || t('common.na')}</td>
                          <td className="py-2 pr-4 font-medium">{formatCurrency(n(r.total, 0))}</td>
                          <td className="py-2 pr-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => void openReturnDetail(r.id)}>
                              {t('pos.actions.view')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dian" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>DIAN</CardTitle>
              <CardDescription>
                {t('pos.dian.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dianError ? <div className="text-sm text-red-600">{dianError}</div> : null}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label>{t('pos.dian.labels.section')}</Label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm"
                    value={dianMainTab}
                    onChange={(e) => setDianMainTab(e.target.value as typeof dianMainTab)}
                  >
                    <option value="crear">{t('pos.dian.sections.create')}</option>
                    <option value="historico">{t('pos.dian.sections.historic')}</option>
                    <option value="configuracion">{t('pos.dian.sections.configuration')}</option>
                    <option value="plantillas">{t('pos.dian.sections.templates')}</option>
                  </select>
                </div>

                {dianMainTab === 'crear' ? (
                  <div>
                    <Label>{t('pos.dian.labels.type')}</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianCrearTab}
                      onChange={(e) => setDianCrearTab(e.target.value as typeof dianCrearTab)}
                    >
                      <option value="factura_venta">{t('pos.dian.create.types.salesInvoice')}</option>
                      <option value="factura_aui">{t('pos.dian.create.types.aui')}</option>
                      <option value="factura_exportacion">{t('pos.dian.create.types.export')}</option>
                      <option value="factura_mandato">{t('pos.dian.create.types.mandate')}</option>
                      <option value="factura_contingencia">{t('pos.dian.create.types.contingency')}</option>
                      <option value="factura_lotes">{t('pos.dian.create.types.batch')}</option>
                      <option value="nota_debito">{t('pos.dian.create.types.debitNotes')}</option>
                      <option value="nota_credito">{t('pos.dian.create.types.creditNotes')}</option>
                    </select>
                  </div>
                ) : null}

                {dianMainTab === 'historico' ? (
                  <div>
                    <Label>{t('pos.dian.labels.view')}</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianHistoricoTab}
                      onChange={(e) => {
                        const next = (e.target.value === 'recibidos' ? 'recibidos' : 'enviados') as typeof dianHistoricoTab
                        setDianHistoricoTab(next)
                      }}
                    >
                      <option value="enviados">{t('pos.dian.historic.view.sent')}</option>
                      <option value="recibidos">{t('pos.dian.historic.view.received')}</option>
                    </select>
                  </div>
                ) : null}

                {dianMainTab === 'configuracion' ? (
                  <div>
                    <Label>{t('pos.dian.labels.configuration')}</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianConfigTab}
                      onChange={(e) => setDianConfigTab(e.target.value as typeof dianConfigTab)}
                    >
                      <option value="rangos">{t('pos.dian.configuration.tabs.ranges')}</option>
                      <option value="comprador">{t('pos.dian.configuration.tabs.buyer')}</option>
                      <option value="productos">{t('pos.dian.configuration.tabs.products')}</option>
                    </select>
                  </div>
                ) : null}

                {dianMainTab === 'plantillas' ? (
                  <div>
                    <Label>{t('pos.dian.labels.template')}</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianPlantillaTab}
                      onChange={(e) => setDianPlantillaTab(e.target.value as typeof dianPlantillaTab)}
                    >
                      <option value="factura_venta">{t('pos.dian.templates.salesInvoice')}</option>
                    </select>
                  </div>
                ) : null}
              </div>

              {dianMainTab === 'crear' ? (
                <div className="space-y-4">
                  {dianCrearTab !== 'factura_lotes' && dianCrearTab !== 'nota_debito' && dianCrearTab !== 'nota_credito' ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{t('pos.dian.create.fromInternalInvoice.title')}</CardTitle>
                        <CardDescription>{t('pos.dian.create.fromInternalInvoice.description')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          <div className="md:col-span-2">
                            <Label>{t('pos.dian.create.fromInternalInvoice.internalInvoice')}</Label>
                            <select
                              className="w-full h-10 rounded-md border px-3 text-sm"
                              value={dianCreatePosInvoiceId}
                              onChange={(e) => {
                                setDianCreatePosInvoiceId(e.target.value)
                                setDianCreatePosInvoice(null)
                              }}
                              disabled={dianCreatePosInvoiceLoading || dianCreating}
                            >
                              <option value="">{t('pos.placeholders.select')}</option>
                              {invoices
                                .filter((x) => String(x.status || '') !== 'DRAFT')
                                .map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.numero} — {inv.clienteNombre} — {formatCurrency(n(inv.total, 0))}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void loadPosInvoiceIntoDian(dianCreatePosInvoiceId)}
                              disabled={!dianCreatePosInvoiceId || dianCreatePosInvoiceLoading || dianCreating}
                            >
                              {dianCreatePosInvoiceLoading ? t('common.loading') : t('pos.dian.create.fromInternalInvoice.loadData')}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void createDianDocFromPosInvoice({ posInvoiceId: dianCreatePosInvoiceId, subType: String(dianCrearTab) })}
                              disabled={!dianCreatePosInvoiceId || dianCreatePosInvoiceLoading || dianCreating}
                            >
                              {dianCreating ? t('pos.dian.create.creating') : t('pos.dian.create.fromInternalInvoice.createReconcile')}
                            </Button>
                          </div>
                        </div>

                        {dianCreatePosInvoice ? (
                          <div className="rounded-md border p-3 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <div className="text-xs text-muted-foreground">{t('pos.dian.create.fromInternalInvoice.summary.internalNumber')}</div>
                                <div className="font-medium">{dianCreatePosInvoice.numero}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">{t('pos.dian.create.fromInternalInvoice.summary.client')}</div>
                                <div className="font-medium">{dianCreatePosInvoice.clienteNombre}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">{t('pos.dian.create.fromInternalInvoice.summary.total')}</div>
                                <div className="font-medium">{formatCurrency(n(dianCreatePosInvoice.total, 0))}</div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('pos.dian.create.buyer.title')}</CardTitle>
                      <CardDescription>{t('pos.dian.create.buyer.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>{t('pos.dian.create.buyer.name')}</Label>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setClientePickerTarget('dian')
                              setClientePickerOpen(true)
                            }}
                            title={t('pos.clientPicker.openTitle')}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input value={dianCreateBuyer.nombre} onChange={(e) => setDianCreateBuyer((p) => ({ ...p, nombre: e.target.value }))} />
                      </div>
                      <div>
                        <Label>{t('pos.dian.create.buyer.document')}</Label>
                        <Input value={dianCreateBuyer.documento} onChange={(e) => setDianCreateBuyer((p) => ({ ...p, documento: e.target.value }))} />
                      </div>
                      <div>
                        <Label>{t('pos.dian.create.buyer.emailOptional')}</Label>
                        <Input value={dianCreateBuyer.email} onChange={(e) => setDianCreateBuyer((p) => ({ ...p, email: e.target.value }))} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('pos.dian.create.items.title')}</CardTitle>
                      <CardDescription>{t('pos.dian.create.items.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">{t('pos.dian.create.items.columns.description')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.create.items.columns.quantity')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.create.items.columns.unitValue')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.create.items.columns.vatPercent')}</th>
                              <th className="py-2 pr-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {dianCreateItems.map((it, idx) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="py-2 pr-3">
                                  <div className="flex gap-2 items-center">
                                    <div className="min-w-0 flex-1">
                                      <Input
                                        value={it.descripcion}
                                        onChange={(e) =>
                                          setDianCreateItems((prev) => prev.map((x, i) => (i === idx ? { ...x, descripcion: e.target.value } : x)))
                                        }
                                        placeholder={t('pos.dian.create.items.placeholders.productOrService')}
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      onClick={() => {
                                        setProductoPickerTarget({ kind: 'dian', idx })
                                        setProductoPickerOpen(true)
                                      }}
                                      title={t('pos.productPicker.openTitle')}
                                    >
                                      <Search className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    value={it.quantity}
                                    onChange={(e) =>
                                      setDianCreateItems((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                                    }
                                    className="w-24"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    value={it.unitPrice}
                                    onChange={(e) =>
                                      setDianCreateItems((prev) => prev.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)))
                                    }
                                    className="w-36"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    value={it.ivaPct}
                                    onChange={(e) =>
                                      setDianCreateItems((prev) => prev.map((x, i) => (i === idx ? { ...x, ivaPct: e.target.value } : x)))
                                    }
                                    className="w-24"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setDianCreateItems((prev) => {
                                        const next = prev.filter((_, i) => i !== idx)
                                        return next.length ? next : [{ descripcion: '', quantity: '1', unitPrice: '', ivaPct: '0' }]
                                      })
                                    }
                                  >
                                    {t('common.remove')}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setDianCreateItems((prev) => [...prev, { descripcion: '', quantity: '1', unitPrice: '', ivaPct: '0' }])
                          }
                        >
                          {t('pos.dian.create.items.addItem')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {dianCrearTab === 'factura_lotes' ? (
                    <div className="rounded-md border p-3 space-y-3">
                      <div>
                        <Label>{t('pos.dian.create.batch.numbersLabel')}</Label>
                        <Textarea value={dianLotesNumeros} onChange={(e) => setDianLotesNumeros(e.target.value)} className="mt-2 h-28" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => void createDianDocsLotes()} disabled={dianCreating}>
                          {dianCreating ? t('pos.dian.create.creating') : t('pos.dian.create.batch.createBatch')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>{t('pos.dian.create.manual.number')}</Label>
                          <Input
                            value={dianCreateNumero}
                            onChange={(e) => setDianCreateNumero(e.target.value)}
                            placeholder={t('pos.dian.create.manual.numberPlaceholder')}
                            disabled={dianCreating}
                          />
                        </div>
                        <div className="md:col-span-2 text-xs text-muted-foreground flex items-end">
                          {t('pos.dian.create.manual.helper')}
                        </div>
                      </div>

                      <div>
                        <Button
                          type="button"
                          onClick={() => {
                            if (dianCrearTab === 'nota_debito') {
                              void createDianDocFromCrear({ dianType: 'DEBIT_NOTE', subType: 'NOTA_DEBITO' })
                            } else if (dianCrearTab === 'nota_credito') {
                              void createDianDocFromCrear({ dianType: 'CREDIT_NOTE', subType: 'NOTA_CREDITO' })
                            } else if (dianCrearTab === 'factura_aui') {
                              void createDianDocFromCrear({ dianType: 'INVOICE', subType: 'FACTURA_AUI' })
                            } else if (dianCrearTab === 'factura_exportacion') {
                              void createDianDocFromCrear({ dianType: 'INVOICE', subType: 'FACTURA_EXPORTACION' })
                            } else if (dianCrearTab === 'factura_mandato') {
                              void createDianDocFromCrear({ dianType: 'INVOICE', subType: 'FACTURA_MANDATO' })
                            } else if (dianCrearTab === 'factura_contingencia') {
                              void createDianDocFromCrear({ dianType: 'INVOICE', subType: 'FACTURA_CONTINGENCIA' })
                            } else {
                              void createDianDocFromCrear({ dianType: 'INVOICE', subType: 'FACTURA_VENTA' })
                            }
                          }}
                          disabled={dianCreating}
                        >
                          {dianCreating ? t('pos.dian.create.creating') : t('pos.dian.create.createDocument')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {dianMainTab === 'historico' ? (
                <div className="space-y-4">
                  <TooltipProvider delayDuration={200}>
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="text-sm font-medium">{t('pos.dian.historic.title')}</div>

                      {dianLoading ? (
                        <div className="text-sm text-gray-600">{t('common.loading')}</div>
                      ) : dianDocs.length === 0 ? (
                        <div className="text-sm text-gray-600">{t('pos.dian.historic.empty')}</div>
                      ) : (
                        <div className="overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">{t('pos.dian.historic.columns.date')}</th>
                                <th className="py-2 pr-4">{t('pos.dian.historic.columns.direction')}</th>
                                <th className="py-2 pr-4">{t('pos.dian.historic.columns.type')}</th>
                                <th className="py-2 pr-4">{t('pos.dian.historic.columns.number')}</th>
                                <th className="py-2 pr-4">{t('pos.dian.historic.columns.status')}</th>
                                <th className="py-2 pr-2">{t('pos.dian.historic.columns.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dianDocs.map((doc) => (
                                <tr key={doc.id} className="border-b last:border-b-0">
                                  <td className="py-2 pr-4 text-gray-700">{new Date(doc.createdAt).toLocaleString(locale)}</td>
                                  <td className="py-2 pr-4 text-gray-700">{dianDirectionLabel(t, doc.direction)}</td>
                                  <td className="py-2 pr-4 text-gray-900">{dianTypeLabel(dianDocTypes, doc.type)}</td>
                                  <td className="py-2 pr-4 text-gray-700">{doc.numero || t('common.na')}</td>
                                  <td className="py-2 pr-4 text-gray-700">{doc.status}</td>
                                  <td className="py-2 pr-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setDianSelectedId(doc.id)
                                        void loadDianDetail(doc.id)
                                      }}
                                    >
                                      {t('pos.actions.view')}
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {dianSelectedId ? (
                      <div className="rounded-md border p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{t('pos.dian.detail.selectedTitle')}</div>
                            <div className="text-xs text-muted-foreground">{t('pos.dian.detail.idLabel')}: {dianSelectedId}</div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadDianDetail(dianSelectedId)}
                            disabled={dianDetailLoading}
                          >
                              {dianDetailLoading ? t('common.loading') : t('pos.dian.detail.refresh')}
                          </Button>
                        </div>

                        {dianDetailError ? <div className="text-sm text-red-600">{dianDetailError}</div> : null}

                        {dianDetail ? (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">{t('pos.dian.detail.labels.direction')}</div>
                                <div className="text-sm font-medium">{dianDetail.direction}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">{t('pos.dian.detail.labels.type')}</div>
                                <div className="text-sm font-medium">{dianTypeLabel(dianDocTypes, dianDetail.type)}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">{t('pos.dian.detail.labels.status')}</div>
                                <div className="text-sm font-medium">{dianDetail.status}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label>{t('pos.dian.detail.fields.uuid')}</Label>
                                <Input value={dianDetail.uuid || ''} readOnly placeholder={t('pos.dian.detail.emptyValue')} />
                              </div>
                              <div>
                                <Label>{t('pos.dian.detail.fields.cufe')}</Label>
                                <Input value={dianDetail.cufe || ''} readOnly placeholder={t('pos.dian.detail.emptyValue')} />
                              </div>
                              <div>
                                <Label>{t('pos.dian.detail.fields.providerRef')}</Label>
                                <Input value={dianDetail.providerRef || ''} readOnly placeholder={t('pos.dian.detail.emptyValue')} />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void runDianAction('transmitir')}
                                  disabled={
                                    dianActionSubmitting !== null ||
                                    dianDetail.direction === 'INBOUND' ||
                                    Boolean(dianDetail.transmittedAt)
                                  }
                                >
                                  {dianActionSubmitting === 'transmitir'
                                    ? t('pos.dian.actions.transmit.transmitting')
                                    : t('pos.dian.actions.transmit.transmit')}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label={t('pos.dian.actions.transmit.helpAriaLabel')}
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {t('pos.dian.actions.transmit.helpText')}
                                  </TooltipContent>
                                </Tooltip>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void runDianAction('expedir')}
                                  disabled={dianActionSubmitting !== null || Boolean(dianDetail.expeditedAt)}
                                >
                                  {dianActionSubmitting === 'expedir'
                                    ? t('pos.dian.actions.issue.issuing')
                                    : t('pos.dian.actions.issue.issue')}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label={t('pos.dian.actions.issue.helpAriaLabel')}
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {t('pos.dian.actions.issue.helpText')}
                                  </TooltipContent>
                                </Tooltip>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void runDianAction('entregar')}
                                  disabled={dianActionSubmitting !== null || Boolean(dianDetail.deliveredAt)}
                                >
                                  {dianActionSubmitting === 'entregar'
                                    ? t('pos.dian.actions.deliver.delivering')
                                    : t('pos.dian.actions.deliver.deliver')}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label={t('pos.dian.actions.deliver.helpAriaLabel')}
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {t('pos.dian.actions.deliver.helpText')}
                                  </TooltipContent>
                                </Tooltip>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void runDianAction('recepcionar')}
                                  disabled={dianActionSubmitting !== null || Boolean(dianDetail.receivedAt)}
                                >
                                  {dianActionSubmitting === 'recepcionar'
                                    ? t('pos.dian.actions.receive.receiving')
                                    : t('pos.dian.actions.receive.receive')}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label={t('pos.dian.actions.receive.helpAriaLabel')}
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {t('pos.dian.actions.receive.helpText')}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>

                            {dianDetail.lastError ? (
                              <div className="text-sm text-red-600">
                                {t('pos.dian.detail.lastErrorPrefix')} {dianDetail.lastError}
                              </div>
                            ) : null}

                            <div className="space-y-2">
                              {dianSteps.map((s) => {
                                const isCompleted =
                                  s.key === 'GENERATED'
                                    ? true
                                    : s.key === 'TRANSMITTED'
                                      ? Boolean(dianDetail.transmittedAt)
                                      : s.key === 'EXPEDITED'
                                        ? Boolean(dianDetail.expeditedAt)
                                        : s.key === 'DELIVERED'
                                          ? Boolean(dianDetail.deliveredAt)
                                          : Boolean(dianDetail.receivedAt)

                                return (
                                  <div key={s.key} className="flex items-start justify-between gap-3 rounded-md border p-3">
                                    <div>
                                      <div className="text-sm font-medium">{s.title}</div>
                                      <div className="text-xs text-muted-foreground">{s.description}</div>
                                    </div>
                                    <span className="shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
                                      {isCompleted ? t('pos.dian.steps.completed') : t('pos.dian.steps.pending')}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>

                            <div>
                              <Label>{t('pos.dian.detail.log.title')}</Label>
                              <Textarea
                                value={dianBitacora}
                                readOnly
                                className="mt-2 h-48 font-mono text-xs"
                                placeholder={t('pos.dian.detail.log.empty')}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-600">{t('pos.dian.detail.selectToView')}</div>
                        )}
                      </div>
                    ) : null}
                  </TooltipProvider>
                </div>
              ) : null}

              {dianMainTab === 'configuracion' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {dianSettingsLoading ? t('pos.dian.configuration.loading') : t('pos.dian.configuration.hint')}
                    </div>
                    <Button
                      type="button"
                      onClick={() => void onSaveDianSettings()}
                      disabled={dianSettingsLoading || dianSettingsSaving}
                    >
                      {dianSettingsSaving ? t('common.saving') : t('pos.dian.configuration.save')}
                    </Button>
                  </div>

                  {dianConfigTab === 'rangos' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{t('pos.dian.numeration.title')}</div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={onValidateNumeracion} disabled={dianSettingsLoading}>
                            {t('pos.dian.numeration.validate')}
                          </Button>
                          <Button type="button" variant="outline" onClick={addDianNumeracionItem}>
                            {t('pos.dian.numeration.addRange')}
                          </Button>
                        </div>
                      </div>

                      {dianNumeracionValidation ? (
                        dianNumeracionValidation.ok ? (
                          <div className="text-sm text-green-700 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                            {t('pos.dian.numeration.valid')}
                          </div>
                        ) : (
                          <div className="text-sm text-red-700 rounded-md border border-red-200 bg-red-50 px-3 py-2 space-y-1">
                            <div className="font-medium">{t('pos.dian.numeration.validationErrorsTitle')}</div>
                            <ul className="list-disc pl-5">
                              {dianNumeracionValidation.messages.slice(0, 12).map((m, i) => (
                                <li key={i}>{m}</li>
                              ))}
                            </ul>
                            {dianNumeracionValidation.messages.length > 12 ? (
                              <div className="text-xs">{t('pos.dian.numeration.moreErrors', { count: dianNumeracionValidation.messages.length - 12 })}</div>
                            ) : null}
                          </div>
                        )
                      ) : null}

                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.docType')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.prefix')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.from')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.to')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.authorizationNumber')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.expires')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.current')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.numeration.columns.active')}</th>
                              <th className="py-2 pr-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Array.isArray(dianSettings.numeracion) ? dianSettings.numeracion : []).map((r, idx) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="py-2 pr-3">
                                  <select
                                    className="w-56 h-10 rounded-md border px-2 text-sm"
                                    value={String(r.tipoDocumento ?? 'FACTURA_VENTA')}
                                    onChange={(e) => updateDianNumeracionItem(idx, { tipoDocumento: e.target.value as DianNumeracionTipoDocumento })}
                                  >
                                    {dianNumTipoDocOptions.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 pr-3">
                                  <Input value={String(r.prefijo ?? '')} onChange={(e) => updateDianNumeracionItem(idx, { prefijo: e.target.value })} className="w-32" />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input value={String(r.desde ?? '')} onChange={(e) => updateDianNumeracionItem(idx, { desde: n(e.target.value, 0) })} className="w-28" />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input value={String(r.hasta ?? '')} onChange={(e) => updateDianNumeracionItem(idx, { hasta: n(e.target.value, 0) })} className="w-28" />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    value={String(r.nroAutorizacion ?? '')}
                                    onChange={(e) => updateDianNumeracionItem(idx, { nroAutorizacion: e.target.value })}
                                    className="w-48"
                                    placeholder={t('pos.dian.numeration.authorizationPlaceholder')}
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    type="date"
                                    value={String(r.fechaVencimiento ?? '')}
                                    onChange={(e) => updateDianNumeracionItem(idx, { fechaVencimiento: e.target.value })}
                                    className="w-40"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input value={String(r.actual ?? '')} onChange={(e) => updateDianNumeracionItem(idx, { actual: n(e.target.value, 0) })} className="w-28" />
                                </td>
                                <td className="py-2 pr-3">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(r.activo)}
                                    onChange={(e) => updateDianNumeracionItem(idx, { activo: e.target.checked })}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Button type="button" size="sm" variant="outline" onClick={() => removeDianNumeracionItem(idx)}>
                                    {t('common.remove')}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {dianConfigTab === 'comprador' ? (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setClientePickerTarget('dian-config')
                            setClientePickerOpen(true)
                          }}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          {t('pos.dian.configuration.buyer.search')}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>{t('pos.dian.configuration.buyer.name')}</Label>
                          <Input
                            value={String(dianSettings.compradorDefault?.nombre ?? '')}
                            onChange={(e) =>
                              setDianSettings((prev) => ({
                                ...prev,
                                compradorDefault: { ...(prev.compradorDefault || {}), nombre: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>{t('pos.dian.configuration.buyer.document')}</Label>
                          <Input
                            value={String(dianSettings.compradorDefault?.documento ?? '')}
                            onChange={(e) =>
                              setDianSettings((prev) => ({
                                ...prev,
                                compradorDefault: { ...(prev.compradorDefault || {}), documento: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>{t('pos.dian.configuration.buyer.email')}</Label>
                          <Input
                            value={String(dianSettings.compradorDefault?.email ?? '')}
                            onChange={(e) =>
                              setDianSettings((prev) => ({
                                ...prev,
                                compradorDefault: { ...(prev.compradorDefault || {}), email: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dianConfigTab === 'productos' ? (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setProductoPickerTarget({ kind: 'dian-config' })
                              setProductoPickerOpen(true)
                            }}
                          >
                            <Search className="h-4 w-4 mr-2" />
                            {t('pos.dian.configuration.products.search')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setDianSettings((prev) => ({
                                ...prev,
                                productos: [
                                  ...(Array.isArray(prev.productos) ? prev.productos : []),
                                  { codigo: '', descripcion: '', unitPrice: 0, ivaPct: 0 },
                                ],
                              }))
                            }
                          >
                            {t('pos.dian.configuration.products.addManual')}
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">{t('pos.dian.configuration.products.columns.code')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.configuration.products.columns.description')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.configuration.products.columns.unitValue')}</th>
                              <th className="py-2 pr-3">{t('pos.dian.configuration.products.columns.vatPercent')}</th>
                              <th className="py-2 pr-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Array.isArray(dianSettings.productos) ? dianSettings.productos : []).map((p, idx) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="py-2 pr-3">
                                  <Input
                                    value={String(p.codigo ?? '')}
                                    onChange={(e) =>
                                      setDianSettings((prev) => {
                                        const current = Array.isArray(prev.productos) ? prev.productos : []
                                        const next = current.map((x, i) => (i === idx ? { ...x, codigo: e.target.value } : x))
                                        return { ...prev, productos: next }
                                      })
                                    }
                                    className="w-40"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    value={String(p.descripcion ?? '')}
                                    onChange={(e) =>
                                      setDianSettings((prev) => {
                                        const current = Array.isArray(prev.productos) ? prev.productos : []
                                        const next = current.map((x, i) => (i === idx ? { ...x, descripcion: e.target.value } : x))
                                        return { ...prev, productos: next }
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    value={String(p.unitPrice ?? '')}
                                    onChange={(e) =>
                                      setDianSettings((prev) => {
                                        const current = Array.isArray(prev.productos) ? prev.productos : []
                                        const next = current.map((x, i) => (i === idx ? { ...x, unitPrice: n(e.target.value, 0) } : x))
                                        return { ...prev, productos: next }
                                      })
                                    }
                                    className="w-36"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Input
                                    value={String(p.ivaPct ?? '')}
                                    onChange={(e) =>
                                      setDianSettings((prev) => {
                                        const current = Array.isArray(prev.productos) ? prev.productos : []
                                        const next = current.map((x, i) => (i === idx ? { ...x, ivaPct: n(e.target.value, 0) } : x))
                                        return { ...prev, productos: next }
                                      })
                                    }
                                    className="w-24"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setDianSettings((prev) => {
                                        const current = Array.isArray(prev.productos) ? prev.productos : []
                                        const next = current.filter((_, i) => i !== idx)
                                        return { ...prev, productos: next }
                                      })
                                    }
                                  >
                                    {t('common.remove')}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {dianMainTab === 'plantillas' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{t('pos.dian.templates.hint')}</div>
                    <Button
                      type="button"
                      onClick={() => void saveDianSettings(dianSettings)}
                      disabled={dianSettingsLoading || dianSettingsSaving}
                    >
                      {dianSettingsSaving ? t('common.saving') : t('pos.dian.templates.save')}
                    </Button>
                  </div>

                  {dianSettingsLoading ? (
                    <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
                  ) : (
                    <div>
                      <Label>{t('pos.dian.templates.templateLabel')}</Label>
                      <Textarea
                        value={String(dianSettings.templates?.facturaVenta ?? '')}
                        onChange={(e) =>
                          setDianSettings((prev) => ({
                            ...prev,
                            templates: { ...(prev.templates || {}), facturaVenta: e.target.value },
                          }))
                        }
                        className="mt-2 h-64 font-mono text-xs"
                        placeholder={t('pos.dian.templates.templatePlaceholder')}
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={clientePickerOpen}
        onOpenChange={(open) => {
          setClientePickerOpen(open)
          if (!open) {
            setClientePickerError(null)
            setClientePickerSearch('')
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('pos.clientPicker.title')}</DialogTitle>
            <DialogDescription>{t('pos.clientPicker.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={clientePickerSearch}
                onChange={(e) => setClientePickerSearch(e.target.value)}
                placeholder={t('pos.clientPicker.searchPlaceholder')}
              />
              <Button type="button" variant="outline" onClick={() => void loadClientesPicker()} disabled={clientePickerLoading}>
                {clientePickerLoading ? t('pos.clientPicker.searching') : t('pos.clientPicker.search')}
              </Button>
            </div>

            {clientePickerError ? <div className="text-sm text-red-600">{clientePickerError}</div> : null}

            <div className="rounded-md border overflow-auto max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 px-3">{t('pos.clientPicker.columns.client')}</th>
                    <th className="py-2 px-3">{t('pos.clientPicker.columns.document')}</th>
                    <th className="py-2 px-3">{t('pos.clientPicker.columns.email')}</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {clientePickerLoading ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        {t('common.loading')}
                      </td>
                    </tr>
                  ) : clientePickerItems.length === 0 ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        {t('pos.clientPicker.empty')}
                      </td>
                    </tr>
                  ) : (
                    clientePickerItems.map((c) => (
                      <tr key={c.id} className="border-b last:border-b-0">
                        <td className="py-2 px-3 text-gray-900">{c.nombre}</td>
                        <td className="py-2 px-3 text-gray-700">{c.documento || t('common.na')}</td>
                        <td className="py-2 px-3 text-gray-700">{c.email || t('common.na')}</td>
                        <td className="py-2 px-3 text-right">
                          <Button type="button" size="sm" onClick={() => onPickCliente(c)}>
                            {t('common.select')}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={productoPickerOpen}
        onOpenChange={(open) => {
          setProductoPickerOpen(open)
          if (!open) {
            setProductoPickerTarget(null)
            setProductoPickerError(null)
            setProductoPickerSearch('')
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('pos.productPicker.title')}</DialogTitle>
            <DialogDescription>{t('pos.productPicker.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={productoPickerSearch}
                onChange={(e) => setProductoPickerSearch(e.target.value)}
                placeholder={t('pos.productPicker.searchPlaceholder')}
              />
              <Button type="button" variant="outline" onClick={() => void loadProductosPicker()} disabled={productoPickerLoading}>
                {productoPickerLoading ? t('pos.productPicker.searching') : t('pos.productPicker.search')}
              </Button>
            </div>

            {productoPickerError ? <div className="text-sm text-red-600">{productoPickerError}</div> : null}

            <div className="rounded-md border overflow-auto max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 px-3">{t('pos.productPicker.columns.name')}</th>
                    <th className="py-2 px-3">{t('pos.productPicker.columns.unit')}</th>
                    <th className="py-2 px-3">{t('pos.productPicker.columns.suggestedPrice')}</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {productoPickerLoading ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        {t('common.loading')}
                      </td>
                    </tr>
                  ) : productoPickerItems.length === 0 ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        {t('pos.productPicker.empty')}
                      </td>
                    </tr>
                  ) : (
                    productoPickerItems.map((m) => (
                      <tr key={m.id} className="border-b last:border-b-0">
                        <td className="py-2 px-3 text-gray-900">{m.nombre}</td>
                        <td className="py-2 px-3 text-gray-700">{formatUnidadMedidaLabel(m.unidadMedida)}</td>
                        <td className="py-2 px-3 text-gray-700">{formatCurrency(priceSuggestion(m))}</td>
                        <td className="py-2 px-3 text-right">
                          <Button type="button" size="sm" onClick={() => onPickProducto(m)}>
                            {t('common.select')}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('pos.returnDialog.title')}</DialogTitle>
            <DialogDescription>{t('pos.returnDialog.description')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitReturn(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label>{t('pos.returnDialog.invoiceOptional')}</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={returnForm.invoiceId}
                  onChange={(e) => void onReturnInvoiceChange(e.target.value)}
                >
                  <option value="">{t('pos.placeholders.unlinked')}</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.numero} — {inv.clienteNombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t('pos.labels.warehouse')}</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={returnForm.warehouseId}
                  onChange={(e) => setReturnForm((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">{t('pos.placeholders.auto')}</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}{b.isDefault ? ` ${t('pos.labels.defaultShort')}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>{t('pos.labels.vatPercent')}</Label>
                <Input value={returnForm.ivaPct} onChange={(e) => setReturnForm((p) => ({ ...p, ivaPct: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>{t('pos.returnDialog.reasonOptional')}</Label>
                <Input value={returnForm.motivo} onChange={(e) => setReturnForm((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t('pos.returnDialog.itemsReturned')}</div>
                <Button type="button" size="sm" variant="outline" onClick={addReturnItem}>
                  {t('pos.items.addItem')}
                </Button>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-1 pr-3">{t('pos.items.columns.material')}</th>
                      <th className="py-1 pr-3">{t('pos.items.columns.description')}</th>
                      <th className="py-1 pr-3">{t('pos.items.columns.quantity')}</th>
                      <th className="py-1 pr-3">{t('pos.items.columns.price')}</th>
                      <th className="py-1 pr-3">{t('pos.items.columns.total')}</th>
                      <th className="py-1 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnForm.items.map((it, idx) => {
                      const qty = Math.max(0, n(it.quantity, 0))
                      const unit = Math.max(0, n(it.unitPrice, 0))
                      const lineTotal = qty * unit
                      return (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="py-2 pr-3">
                            <select
                              className="w-56 h-10 rounded-md border px-2 text-sm"
                              value={it.materialId}
                              onChange={(e) => updateReturnItem(idx, { materialId: e.target.value })}
                            >
                              <option value="">{t('pos.placeholders.manual')}</option>
                              {materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <Input value={it.descripcion} onChange={(e) => updateReturnItem(idx, { descripcion: e.target.value })} />
                          </td>
                          <td className="py-2 pr-3">
                            <Input value={it.quantity} onChange={(e) => updateReturnItem(idx, { quantity: e.target.value })} className="w-24" />
                          </td>
                          <td className="py-2 pr-3">
                            <Input value={it.unitPrice} onChange={(e) => updateReturnItem(idx, { unitPrice: e.target.value })} className="w-32" />
                          </td>
                          <td className="py-2 pr-3 font-medium">{formatCurrency(lineTotal)}</td>
                          <td className="py-2 pr-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => removeReturnItem(idx)}>
                              {t('common.remove')}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="sm:col-span-2">
                <Label>{t('pos.returnDialog.internalNoteOptional')}</Label>
                <Textarea value={returnForm.motivo} onChange={(e) => setReturnForm((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span>{t('pos.summary.subtotal')}</span>
                  <span className="font-medium">{formatCurrency(computedReturn.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('pos.summary.vat')}</span>
                  <span className="font-medium">{formatCurrency(computedReturn.iva)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>{t('pos.summary.total')}</span>
                  <span className="font-semibold">{formatCurrency(computedReturn.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReturnOpen(false)} disabled={returnSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={returnSubmitting}>
                {returnSubmitting ? t('pos.actions.creating') : t('pos.returnDialog.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[90vw] max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pos.createDialog.title')}</DialogTitle>
            <DialogDescription>{t('pos.createDialog.description')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitInvoice(e)} className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-2">
              <div>
                <div className="text-sm font-medium">{t('pos.createDialog.saveAsDraft.title')}</div>
                <div className="text-xs text-muted-foreground">{t('pos.createDialog.saveAsDraft.description')}</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createAsDraft}
                  onChange={(e) => setCreateAsDraft(e.target.checked)}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>{t('pos.labels.client')}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        setCreateClienteInlineError(null)
                        setCreateClienteInlineForm({
                          nombre: '',
                          tipoDocumento: 'CC',
                          documento: '',
                          email: '',
                          telefono: '',
                          celular: '',
                          direccion: '',
                          ciudad: '',
                          departamento: '',
                        })
                        setCreateClienteInlineOpen(true)
                      }}
                      title={t('pos.customers.inlineCreate.open')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        setClientePickerTarget('interna')
                        setClientePickerOpen(true)
                      }}
                      title={t('pos.clientPicker.openTitle')}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Input value={form.clienteNombre} onChange={(e) => setForm((p) => ({ ...p, clienteNombre: e.target.value }))} />
              </div>
              <div>
                <Label>{t('pos.labels.documentOptional')}</Label>
                <Input value={form.clienteDocumento} onChange={(e) => setForm((p) => ({ ...p, clienteDocumento: e.target.value }))} />
              </div>

              <div>
                <Label>{t('pos.labels.warehouse')}</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={form.warehouseId}
                  onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">{t('pos.placeholders.auto')}</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}{b.isDefault ? ` ${t('pos.labels.defaultShort')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t('pos.labels.vatPercent')}</Label>
                <Input value={form.ivaPct} onChange={(e) => setForm((p) => ({ ...p, ivaPct: e.target.value }))} />
              </div>
              <div className="sm:col-span-1">
                <Label>{t('pos.createDialog.searchMaterial')}</Label>
                <Input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder={t('pos.createDialog.searchPlaceholder')} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t('pos.items.title')}</div>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  {t('pos.items.addItem')}
                </Button>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">{t('pos.items.columns.material')}</th>
                      <th className="py-2 pr-3">{t('pos.items.columns.description')}</th>
                      <th className="py-2 pr-3">{t('pos.items.columns.quantity')}</th>
                      <th className="py-2 pr-3">{t('pos.items.columns.price')}</th>
                      <th className="py-2 pr-3">{t('pos.items.columns.total')}</th>
                      <th className="py-2 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) => {
                      const qty = Math.max(0, n(it.quantity, 0))
                      const unit = Math.max(0, n(it.unitPrice, 0))
                      const lineTotal = qty * unit

                      return (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="py-1 pr-3">
                            <div className="flex gap-2 items-center">
                              <select
                                className="w-56 h-9 rounded-md border px-2 text-xs"
                                value={it.materialId}
                                onChange={(e) => updateItem(idx, { materialId: e.target.value })}
                              >
                                <option value="">{t('pos.placeholders.manual')}</option>
                                {materials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nombre}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  setProductoPickerTarget({ kind: 'interna', idx })
                                  setProductoPickerOpen(true)
                                }}
                                title={t('pos.productPicker.openTitle')}
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="py-1 pr-3">
                            <Input
                              value={it.descripcion}
                              onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                              placeholder={t('pos.items.placeholders.description')}
                              className="h-9 text-xs"
                            />
                          </td>
                          <td className="py-1 pr-3">
                            <Input
                              value={it.quantity}
                              onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                              className="w-24 h-9 text-xs"
                            />
                          </td>
                          <td className="py-1 pr-3">
                            <Input
                              value={it.unitPrice}
                              onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                              className="w-32 h-9 text-xs"
                            />
                          </td>
                          <td className="py-1 pr-3 font-medium">{formatCurrency(lineTotal)}</td>
                          <td className="py-1 pr-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => removeItem(idx)}>
                              {t('common.remove')}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
              <div className="lg:col-span-2 space-y-3">
                <div className="rounded-md border p-2">
                  <div className="text-sm font-medium">{t('pos.payments.title')}</div>
                  <div className="text-xs text-muted-foreground">{t('pos.payments.description')}</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {PAYMENT_METHODS.map((method) => (
                      <div key={method} className="flex items-center justify-between gap-2">
                        <Label className="text-xs">{t(`pos.payments.methods.${method}`)}</Label>
                        <Input
                          inputMode="numeric"
                          disabled={createAsDraft}
                          value={paymentAmounts[method]}
                          onChange={(e) => {
                            setPaymentsTouched(true)
                            const value = e.target.value
                            setPaymentAmounts((p) => ({ ...p, [method]: value }))
                          }}
                          className="h-9 text-xs w-40"
                        />
                      </div>
                    ))}
                  </div>

                  {!createAsDraft ? (
                    <div className="flex items-center justify-between text-xs mt-2">
                      <span className={computedPayments.ok ? 'text-muted-foreground' : 'text-red-600'}>
                        {t('pos.payments.sum')} {formatCurrency(computedPayments.sum)}
                      </span>
                      <span className={computedPayments.ok ? 'text-muted-foreground' : 'text-red-600'}>
                        {t('pos.payments.diff')} {formatCurrency(Math.abs(computedPayments.diff))}
                      </span>
                    </div>
                  ) : null}

                  {!createAsDraft && !computedPayments.ok ? (
                    <div className="text-xs text-red-600 mt-2">{t('pos.errors.paymentsMustMatchTotal')}</div>
                  ) : null}
                </div>

                <div>
                  <Label>{t('pos.createDialog.noteOptional')}</Label>
                  <Textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span>{t('pos.summary.subtotal')}</span>
                  <span className="font-medium">{formatCurrency(computed.subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm mt-2">
                  <span>{t('pos.summary.discount')}</span>
                  <Input
                    inputMode="numeric"
                    value={form.discountAmount}
                    onChange={(e) => setForm((p) => ({ ...p, discountAmount: e.target.value }))}
                    className="h-9 text-xs w-32"
                  />
                </div>

                <div className="flex justify-between text-sm mt-2">
                  <span>{t('pos.summary.taxableBase')}</span>
                  <span className="font-medium">{formatCurrency(computed.taxableBase)}</span>
                </div>

                <div className="flex justify-between text-sm mt-2">
                  <span>{t('pos.summary.vat')}</span>
                  <span className="font-medium">{formatCurrency(computed.iva)}</span>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm mt-2">
                  <span>{t('pos.summary.otherTaxes')}</span>
                  <Input
                    inputMode="numeric"
                    value={form.otherTaxesAmount}
                    onChange={(e) => setForm((p) => ({ ...p, otherTaxesAmount: e.target.value }))}
                    className="h-9 text-xs w-32"
                  />
                </div>

                <div className="flex justify-between text-sm mt-3">
                  <span>{t('pos.summary.total')}</span>
                  <span className="font-semibold">{formatCurrency(computed.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('pos.actions.creating') : t('pos.createDialog.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createClienteInlineOpen} onOpenChange={setCreateClienteInlineOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pos.customers.inlineCreate.title')}</DialogTitle>
            <DialogDescription>{t('pos.customers.inlineCreate.description')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitInlineCliente(e)} className="space-y-3">
            {createClienteInlineError ? <div className="text-sm text-red-600">{createClienteInlineError}</div> : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <Label>{t('pos.customers.inlineCreate.fields.name')}</Label>
                <Input
                  value={createClienteInlineForm.nombre}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>

              <div>
                <Label>{t('pos.customers.inlineCreate.fields.documentType')}</Label>
                <select
                  value={createClienteInlineForm.tipoDocumento}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, tipoDocumento: e.target.value }))}
                  className="w-full h-10 rounded-md border px-3 text-sm"
                >
                  <option value="NIT">NIT</option>
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="PASAPORTE">{t('pos.customers.inlineCreate.fields.passport')}</option>
                </select>
              </div>
              <div>
                <Label>{t('pos.customers.inlineCreate.fields.document')}</Label>
                <Input
                  value={createClienteInlineForm.documento}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, documento: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2">
                <Label>{t('pos.customers.inlineCreate.fields.emailOptional')}</Label>
                <Input
                  value={createClienteInlineForm.email}
                  onChange={(e) => setCreateClienteInlineForm((p) => ({ ...p, email: e.target.value }))}
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createClienteInlineSubmitting}>
                {createClienteInlineSubmitting ? t('pos.actions.creating') : t('pos.customers.inlineCreate.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('pos.invoiceDetailDialog.title')}</DialogTitle>
            <DialogDescription>{t('pos.invoiceDetailDialog.description')}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="text-sm text-gray-600">{t('common.loading')}</div>
          ) : detailError ? (
            <div className="text-sm text-red-600">{detailError}</div>
          ) : !detail ? (
            <div className="text-sm text-gray-600">{t('pos.invoiceDetailDialog.empty')}</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{t('pos.invoiceDetailDialog.labels.number')}</div>
                  <div className="font-medium">{detail.numero}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{t('pos.invoiceDetailDialog.labels.client')}</div>
                  <div className="font-medium">{detail.clienteNombre}</div>
                  <div className="text-xs text-gray-500">{detail.clienteDocumento || t('common.na')}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{t('pos.invoiceDetailDialog.labels.warehouse')}</div>
                  <div className="font-medium">{detail.warehouse?.nombre || t('common.na')}</div>
                  <div className="text-xs text-gray-500">
                    {t('pos.invoiceDetailDialog.labels.status')}: {detail.status}
                  </div>
                </div>
              </div>

              {detail.note ? (
                <div className="text-sm text-gray-700">
                  {t('pos.invoiceDetailDialog.labels.note')}: {detail.note}
                </div>
              ) : null}

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">{t('pos.items.columns.description')}</th>
                      <th className="py-2 pr-4">{t('pos.items.columns.quantity')}</th>
                      <th className="py-2 pr-4">{t('pos.items.columns.price')}</th>
                      <th className="py-2 pr-4">{t('pos.items.columns.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 text-gray-900">{it.descripcion}</td>
                        <td className="py-2 pr-4 text-gray-700">{n(it.quantity, 0).toLocaleString(locale)}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatCurrency(n(it.unitPrice, 0))}</td>
                        <td className="py-2 pr-4 font-medium">{formatCurrency(n(it.total, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <div>
                  <span className="text-gray-500">{t('pos.summary.subtotal')}:</span> <span className="font-medium">{formatCurrency(detail.subtotal)}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('pos.summary.vat')}:</span> <span className="font-medium">{formatCurrency(detail.iva)}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('pos.summary.total')}:</span> <span className="font-semibold">{formatCurrency(detail.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {detail && detail.status === 'DRAFT' ? (
              <Button type="button" onClick={() => void finalizar(detail.id)} disabled={finalizeSubmitting || detailLoading}>
                {finalizeSubmitting ? t('pos.actions.finalizing') : t('pos.actions.finalize')}
              </Button>
            ) : null}
            {detail ? (
              <Button type="button" variant="outline" onClick={() => openInvoicePdf(detail.id)}>
                {t('pos.actions.print')}
              </Button>
            ) : null}
            {detail ? (
              <Button type="button" variant="outline" onClick={() => void downloadInvoicePdf(detail.id, detail.numero)}>
                {t('pos.actions.downloadPdf')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDetailOpen} onOpenChange={setReturnDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('pos.returnDetailDialog.title')}</DialogTitle>
            <DialogDescription>{t('pos.returnDetailDialog.description')}</DialogDescription>
          </DialogHeader>

          {returnDetailLoading ? (
            <div className="text-sm text-gray-600">{t('common.loading')}</div>
          ) : returnDetailError ? (
            <div className="text-sm text-red-600">{returnDetailError}</div>
          ) : !returnDetail ? (
            <div className="text-sm text-gray-600">{t('pos.returnDetailDialog.empty')}</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{t('pos.returnDetailDialog.labels.number')}</div>
                  <div className="font-medium">{returnDetail.numero}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{t('pos.returnDetailDialog.labels.invoice')}</div>
                  <div className="font-medium">{returnDetail.invoice?.numero || t('common.na')}</div>
                  <div className="text-xs text-gray-500">{new Date(returnDetail.createdAt).toLocaleString(locale)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{t('pos.returnDetailDialog.labels.warehouse')}</div>
                  <div className="font-medium">{returnDetail.warehouse?.nombre || t('common.na')}</div>
                </div>
              </div>

              {returnDetail.motivo ? (
                <div className="text-sm text-gray-700">
                  {t('pos.returnDetailDialog.labels.reason')}: {returnDetail.motivo}
                </div>
              ) : null}

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">{t('pos.items.columns.description')}</th>
                      <th className="py-2 pr-4">{t('pos.items.columns.quantity')}</th>
                      <th className="py-2 pr-4">{t('pos.items.columns.price')}</th>
                      <th className="py-2 pr-4">{t('pos.items.columns.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnDetail.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 text-gray-900">{it.descripcion}</td>
                        <td className="py-2 pr-4 text-gray-700">{n(it.quantity, 0).toLocaleString(locale)}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatCurrency(n(it.unitPrice, 0))}</td>
                        <td className="py-2 pr-4 font-medium">{formatCurrency(n(it.total, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <div>
                  <span className="text-gray-500">{t('pos.summary.subtotal')}:</span> <span className="font-medium">{formatCurrency(returnDetail.subtotal)}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('pos.summary.vat')}:</span> <span className="font-medium">{formatCurrency(returnDetail.iva)}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('pos.summary.total')}:</span> <span className="font-semibold">{formatCurrency(returnDetail.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReturnDetailOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
