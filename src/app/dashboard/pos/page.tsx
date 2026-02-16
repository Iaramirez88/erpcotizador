/**
 * Página de facturación (MVP)
 * - Listar facturas
 * - Crear factura (PAID por defecto)
 * - Ver detalle básico
 * - Anular factura (si aplica)
 */


'use client'

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
import { formatCurrency, formatUnidadMedidaLabel } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Download, Search } from 'lucide-react'

type DianDirection = 'OUTBOUND' | 'INBOUND'
type DianType = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'ELECTRONIC_INSTRUMENT'
type DianStatus = 'GENERATED' | 'TRANSMITTED' | 'EXPEDITED' | 'DELIVERED' | 'RECEIVED' | 'ERROR'
type DianAction = 'transmitir' | 'expedir' | 'entregar' | 'recepcionar'

const DIAN_STEPS: Array<{ key: DianStatus; title: string; description: string }> = [
  {
    key: 'GENERATED',
    title: 'Generación',
    description: 'Construcción del documento electrónico con su información fiscal y comercial.',
  },
  {
    key: 'TRANSMITTED',
    title: 'Transmisión',
    description: 'Envío para validación/registro ante el proveedor tecnológico y DIAN (según integración).',
  },
  {
    key: 'EXPEDITED',
    title: 'Expedición',
    description: 'Emisión del documento válido y asignación de identificadores/estado de expedición.',
  },
  {
    key: 'DELIVERED',
    title: 'Entrega',
    description: 'Entrega al adquirente por los canales configurados (email/portal/otros).',
  },
  {
    key: 'RECEIVED',
    title: 'Recepción',
    description: 'Recepción y registro de facturas/documentos recibidos (acuse/validación/estado).',
  },
]

const DIAN_DOC_TYPES: Array<{ value: DianType; label: string }> = [
  { value: 'INVOICE', label: 'Factura electrónica' },
  { value: 'CREDIT_NOTE', label: 'Nota crédito' },
  { value: 'DEBIT_NOTE', label: 'Nota débito' },
  { value: 'ELECTRONIC_INSTRUMENT', label: 'Instrumento electrónico' },
]

function dianDirectionLabel(value: DianDirection | string): string {
  if (value === 'OUTBOUND') return 'Emisión'
  if (value === 'INBOUND') return 'Recepción'
  return String(value)
}

function dianTypeLabel(value: DianType | string): string {
  return DIAN_DOC_TYPES.find((t) => t.value === value)?.label ?? String(value)
}

type DianNumeracionTipoDocumento = 'FACTURA_VENTA' | 'NOTA_CREDITO' | 'NOTA_DEBITO'

const DIAN_NUM_TIPO_DOC_OPTIONS: Array<{ value: DianNumeracionTipoDocumento; label: string }> = [
  { value: 'FACTURA_VENTA', label: 'Factura Electrónica de Venta' },
  { value: 'NOTA_CREDITO', label: 'Nota crédito' },
  { value: 'NOTA_DEBITO', label: 'Nota débito' },
]

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

type StockRow = {
  id: string
  quantity: number
  updatedAt: string
  material: { id: string; nombre: string; unidadMedida: string }
}

type ApiListResponse<T> = { success?: boolean; data?: T; error?: string }

function n(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value)
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

type ClientePickerItem = {
  id: string
  nombre: string
  documento: string | null
  email: string | null
}

export default function PosPage() {
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

  const [selectedWarehouseForStock, setSelectedWarehouseForStock] = useState('')
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [stockRows, setStockRows] = useState<StockRow[]>([])

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

  const [form, setForm] = useState({
    clienteNombre: '',
    clienteDocumento: '',
    ivaPct: '0',
    note: '',
    warehouseId: '',
    items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }] as DraftItem[],
  })

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
        setError(jsonInvoices.error || 'No se pudieron cargar facturas')
      }

      if (resReturns.ok && jsonReturns.success && Array.isArray(jsonReturns.data)) {
        setReturns(jsonReturns.data)
      } else if (!resReturns.ok) {
        setError((prev) => prev || jsonReturns.error || 'No se pudieron cargar devoluciones')
      }

      if (resBodegas.ok && jsonBodegas.success && Array.isArray(jsonBodegas.data)) {
        setBodegas(jsonBodegas.data)
      } else if (!resBodegas.ok) {
        setError((prev) => prev || jsonBodegas.error || 'No se pudieron cargar sedes')
      }

      if (resMaterials.ok && jsonMaterials.success && Array.isArray(jsonMaterials.data)) {
        setMaterials(jsonMaterials.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }, [materialSearch])

  const exportExcel = useCallback(() => {
    window.location.href = '/api/pos/export'
  }, [])

  useEffect(() => {
    if (!selectedWarehouseForStock && defaultBodegaId) {
      setSelectedWarehouseForStock(defaultBodegaId)
    }
  }, [defaultBodegaId, selectedWarehouseForStock])

  async function loadStock(warehouseId: string) {
    if (!warehouseId) {
      setStockRows([])
      return
    }

    setStockLoading(true)
    setStockError(null)
    try {
      const res = await fetch(`/api/bodegas/${warehouseId}/stock`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<StockRow[]>
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setStockError(json.error || 'No se pudo cargar el stock de sede')
        setStockRows([])
        return
      }
      setStockRows(json.data)
    } catch (e) {
      setStockError(e instanceof Error ? e.message : 'Error inesperado')
      setStockRows([])
    } finally {
      setStockLoading(false)
    }
  }

  const loadDianDocs = useCallback(async () => {
    setDianLoading(true)
    setDianError(null)
    try {
      const qs = new URLSearchParams({ limit: '100' })
      if (dianFilterDirection !== 'ALL') qs.set('direction', dianFilterDirection)

      const res = await fetch(`/api/dian/documentos?${qs.toString()}`)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.ok || !Array.isArray(json.data)) {
        setDianError(json.error || 'No se pudieron cargar los documentos DIAN')
        setDianDocs([])
        return
      }
      setDianDocs(json.data as DianDocListItem[])
    } catch (e) {
      setDianError(e instanceof Error ? e.message : 'Error inesperado')
      setDianDocs([])
    } finally {
      setDianLoading(false)
    }
  }, [dianFilterDirection])

  const loadClientesPicker = useCallback(async () => {
    setClientePickerLoading(true)
    setClientePickerError(null)
    try {
      const res = await fetch(`/api/clientes?search=${encodeURIComponent(clientePickerSearch)}`)
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setClientePickerError(json.error || 'No se pudieron cargar los clientes')
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
      setClientePickerError(e instanceof Error ? e.message : 'Error inesperado')
      setClientePickerItems([])
    } finally {
      setClientePickerLoading(false)
    }
  }, [clientePickerSearch])

  const loadProductosPicker = useCallback(async () => {
    setProductoPickerLoading(true)
    setProductoPickerError(null)
    try {
      const res = await fetch(`/api/materiales?search=${encodeURIComponent(productoPickerSearch)}`)
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<Material[]>
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setProductoPickerError(json.error || 'No se pudieron cargar los productos/servicios')
        setProductoPickerItems([])
        return
      }
      setProductoPickerItems(json.data)
    } catch (e) {
      setProductoPickerError(e instanceof Error ? e.message : 'Error inesperado')
      setProductoPickerItems([])
    } finally {
      setProductoPickerLoading(false)
    }
  }, [productoPickerSearch])

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
        setDianDetailError(json.error || 'No se pudo cargar el detalle del documento')
        setDianDetail(null)
        return
      }
      setDianDetail(json.data as DianDocDetail)
    } catch (e) {
      setDianDetailError(e instanceof Error ? e.message : 'Error inesperado')
      setDianDetail(null)
    } finally {
      setDianDetailLoading(false)
    }
  }, [])

  const loadDianSettings = useCallback(async () => {
    setDianSettingsLoading(true)
    try {
      const res = await fetch('/api/dian/config', { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
      if (!res.ok || !json.ok) {
        setDianError(json.error || 'No se pudo cargar la configuración DIAN')
        return
      }
      setDianSettings((json.data && typeof json.data === 'object' ? (json.data as DianSettings) : {}) as DianSettings)
    } catch (e) {
      setDianError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setDianSettingsLoading(false)
    }
  }, [])

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
        setDianError(json.error || 'No se pudo guardar la configuración DIAN')
        return false
      }
      setDianSettings((json.data && typeof json.data === 'object' ? (json.data as DianSettings) : {}) as DianSettings)
      return true
    } catch (e) {
      setDianError(e instanceof Error ? e.message : 'Error inesperado')
      return false
    } finally {
      setDianSettingsSaving(false)
    }
  }, [])

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
        setDianError('El número es requerido')
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
          setDianError(json.error || 'No se pudo crear el documento DIAN')
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
        setDianError(e instanceof Error ? e.message : 'Error inesperado')
        return false
      } finally {
        setDianCreating(false)
      }
    },
    [dianCreating, loadDianDetail, loadDianDocs]
  )

  function validateDianNumeroAgainstSettings(args: { tipoDoc: DianNumeracionTipoDocumento; numero: string }): string | null {
    const numero = (args.numero || '').trim()
    if (!numero) return 'El número es requerido'

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
      return 'El número no coincide con ningún rango activo autorizado (prefijo + consecutivo).'
    }

    const pref = String(matched.prefijo ?? '').trim()
    const re = new RegExp(`^${escapeRegExp(pref)}(?:[-\s])?(\\d+)$`)
    const m = re.exec(numero)
    const consecutive = m && m[1] ? n(m[1], NaN) : NaN
    const desde = n(matched.desde, NaN)
    const hasta = n(matched.hasta, NaN)
    const actual = n(matched.actual, NaN)

    if (!Number.isFinite(consecutive)) {
      return 'No se pudo leer el consecutivo del número (se espera prefijo + consecutivo numérico).'
    }
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || desde <= 0 || hasta <= 0 || desde > hasta) {
      return 'El rango autorizado está mal configurado (desde/hasta).'
    }
    if (consecutive < desde || consecutive > hasta) {
      return `El consecutivo ${consecutive} está fuera del rango autorizado (${desde}–${hasta}).`
    }
    if (Number.isFinite(actual) && consecutive < actual) {
      return `El consecutivo ${consecutive} es menor al actual configurado (${actual}).`
    }

    const fv = String(matched.fechaVencimiento ?? '').trim()
    if (fv) {
      const exp = new Date(`${fv}T00:00:00`)
      if (!Number.isNaN(exp.getTime()) && exp < new Date(today.toDateString())) {
        return 'El rango está vencido. Ajusta la fecha de vencimiento o desactívalo.'
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
          setDianError((prev) => prev || 'Se creó el documento, pero no se pudo guardar el consecutivo actualizado en la configuración DIAN.')
        }
      }
    },
    [saveDianSettings]
  )

  const loadPosInvoiceIntoDian = useCallback(
    async (invoiceId: string) => {
      const id = String(invoiceId || '').trim()
      if (!id) {
        setDianError('Selecciona una factura interna')
        return
      }

      setDianCreatePosInvoiceLoading(true)
      setDianError(null)
      try {
        const res = await fetch(`/api/pos/facturas/${encodeURIComponent(id)}`)
        const json = (await res.json().catch(() => ({}))) as ApiListResponse<InvoiceDetail>
        if (!res.ok || !json.success || !json.data) {
          setDianError(json.error || 'No se pudo cargar la factura interna')
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
        setDianError(e instanceof Error ? e.message : 'Error inesperado')
        setDianCreatePosInvoice(null)
      } finally {
        setDianCreatePosInvoiceLoading(false)
      }
    },
    [dianCreateNumero, suggestDianNumeroFromSettings]
  )

  const createDianDocFromPosInvoice = useCallback(
    async (args: { posInvoiceId: string; subType: string }) => {
      const posInvoiceId = String(args.posInvoiceId || '').trim()
      if (!posInvoiceId) {
        setDianError('Selecciona una factura interna')
        return
      }

      if (dianCreatePosInvoice?.id !== posInvoiceId) {
        await loadPosInvoiceIntoDian(posInvoiceId)
      }

      const inv = dianCreatePosInvoice
      if (!inv || inv.id !== posInvoiceId) {
        setDianError('No se pudo cargar la factura interna seleccionada')
        return
      }
      if (String(inv.status || '') === 'DRAFT') {
        setDianError('La factura interna está en borrador. Finalízala antes de emitir electrónicamente.')
        return
      }
      if (!String(inv.clienteNombre || '').trim() || !String(inv.clienteDocumento || '').trim()) {
        setDianError('La factura interna no tiene cliente (nombre/documento) completo.')
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
          setDianError(json.error || 'No se pudo crear/conciliar el documento DIAN')
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
        setDianError(e instanceof Error ? e.message : 'Error inesperado')
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
        setDianError('Agrega al menos un ítem con cantidad > 0')
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
      setDianError('Ingresa al menos un número para el lote')
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
      setDianError('Agrega al menos un ítem con cantidad > 0')
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
          setDianError(json.error || `No se pudo crear el documento ${numero}`)
          break
        }
      }
      await loadDianDocs()
    } catch (e) {
      setDianError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setDianCreating(false)
    }
  }, [dianCreateBuyer, dianCreating, dianLotesNumeros, loadDianDocs, normalizedDianCreateItems])

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

      if (!prefijo) messages.push(`Rango #${idx + 1}: prefijo es requerido.`)
      if (!Number.isFinite(desde) || desde <= 0) messages.push(`Rango #${idx + 1}: "Desde" debe ser un número > 0.`)
      if (!Number.isFinite(hasta) || hasta <= 0) messages.push(`Rango #${idx + 1}: "Hasta" debe ser un número > 0.`)
      if (Number.isFinite(desde) && Number.isFinite(hasta) && desde > hasta) messages.push(`Rango #${idx + 1}: "Desde" no puede ser mayor que "Hasta".`)
      if (!Number.isFinite(actual) || actual <= 0) messages.push(`Rango #${idx + 1}: "Actual" debe ser un número > 0.`)
      if (Number.isFinite(desde) && Number.isFinite(hasta) && Number.isFinite(actual) && (actual < desde || actual > hasta)) {
        messages.push(`Rango #${idx + 1}: "Actual" debe estar entre "Desde" y "Hasta".`)
      }
      if (!nroAutorizacion) messages.push(`Rango #${idx + 1}: "Nro. Autorización" es requerido.`)
      if (!fechaVencimiento) messages.push(`Rango #${idx + 1}: "Fecha vencimiento" es requerida.`)
      if (fechaVencimiento) {
        const exp = new Date(`${fechaVencimiento}T00:00:00`)
        if (Number.isNaN(exp.getTime())) {
          messages.push(`Rango #${idx + 1}: "Fecha vencimiento" no es válida.`)
        } else if (activo && exp < todayStart) {
          messages.push(`Rango #${idx + 1}: está vencido y sigue activo.`)
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
          messages.push(`Rangos #${a.idx + 1} y #${b.idx + 1}: se traslapan (mismo tipo y prefijo).`)
        }
      }
    }

    const ok = messages.length === 0
    return { ok, messages }
  }, [])

  const onValidateNumeracion = useCallback(() => {
    const items = Array.isArray(dianSettings.numeracion) ? dianSettings.numeracion : []
    const result = validateDianNumeracion(items)
    setDianNumeracionValidation(result)
    if (!result.ok) setDianError('Hay errores en los rangos de numeración.')
    else setDianError(null)
  }, [dianSettings.numeracion, validateDianNumeracion])

  const onSaveDianSettings = useCallback(async () => {
    const items = Array.isArray(dianSettings.numeracion) ? dianSettings.numeracion : []
    if (items.length > 0) {
      const result = validateDianNumeracion(items)
      setDianNumeracionValidation(result)
      if (!result.ok) {
        setDianError('Corrige los rangos de numeración antes de guardar.')
        return
      }
    }
    await saveDianSettings(dianSettings)
  }, [dianSettings, saveDianSettings, validateDianNumeracion])

  const runDianAction = useCallback(
    async (action: DianAction) => {
      if (!dianSelectedId || dianActionSubmitting) return
      if (action === 'transmitir' && dianDetail?.direction === 'INBOUND') {
        setDianDetailError('Transmisión solo aplica a documentos OUTBOUND')
        return
      }

      setDianActionSubmitting(action)
      setDianDetailError(null)
      try {
        const res = await fetch(`/api/dian/documentos/${dianSelectedId}/${action}`, { method: 'POST' })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string }
        if (!res.ok || !json.ok) {
          setDianDetailError(json.error || 'No se pudo ejecutar la acción DIAN')
          return
        }
        await loadDianDocs()
        await loadDianDetail(dianSelectedId)
      } catch (e) {
        setDianDetailError(e instanceof Error ? e.message : 'Error inesperado')
      } finally {
        setDianActionSubmitting(null)
      }
    },
    [dianActionSubmitting, dianDetail?.direction, dianSelectedId, loadDianDetail, loadDianDocs]
  )

  const dianBitacora = useMemo(() => {
    if (!dianDetail?.events?.length) return ''
    return dianDetail.events
      .map((ev) => `${new Date(ev.createdAt).toLocaleString('es-CO')} [${ev.type}] ${ev.message}`)
      .join('\n')
  }, [dianDetail?.events])

  useEffect(() => {
    void loadStock(selectedWarehouseForStock)
  }, [selectedWarehouseForStock])

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
      clienteNombre: '',
      clienteDocumento: '',
      ivaPct: '0',
      note: '',
      warehouseId: defaultBodegaId,
      items: [{ materialId: '', descripcion: '', quantity: '1', unitPrice: '' }],
    })
    setCreateOpen(true)
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
        setError(json.error || 'No se pudo cargar la factura para prellenar la devolución')
        return
      }

      const inv = json.data
      const nextWarehouseId = inv.warehouse?.id ?? defaultBodegaId
      const nextIvaPct = String(Math.max(0, n(inv.ivaPct, 0)))

      const nextItems: DraftItem[] = (inv.items || []).map((it) => ({
        materialId: it.material?.id ?? '',
        descripcion: it.descripcion ?? it.material?.nombre ?? 'Ítem',
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
      setError(e instanceof Error ? e.message : 'Error inesperado')
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
    const iva = subtotal * (ivaPct / 100)
    const total = subtotal + iva

    return { ivaPct, lines, subtotal, iva, total }
  }, [form.items, form.ivaPct])

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!form.clienteNombre.trim()) {
        setError('clienteNombre es requerido')
        return
      }

      if (computed.lines.length === 0) {
        setError('Agrega al menos un ítem con cantidad > 0')
        return
      }

      const payload = {
        clienteNombre: form.clienteNombre.trim(),
        clienteDocumento: form.clienteDocumento.trim() || undefined,
        ivaPct: computed.ivaPct,
        note: form.note.trim() || undefined,
        warehouseId: form.warehouseId || undefined,
        asDraft: createAsDraft,
        items: computed.lines.map((it) => ({
          materialId: it.materialId || undefined,
          descripcion: it.descripcion?.trim() || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      }

      const res = await fetch('/api/pos/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        if (!createAsDraft && json.error === 'Stock insuficiente') {
          setError('Stock insuficiente. Marca "Guardar como borrador" para registrarla sin descontar inventario.')
          setCreateAsDraft(true)
          return
        }

        setError(json.error || 'No se pudo crear la factura')
        return
      }

      setCreateOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
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
        setDetailError(json.error || 'No se pudo cargar el detalle')
        return
      }
      setDetail(json.data)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setDetailLoading(false)
    }
  }

  async function anular(invoiceId: string) {
    const ok = window.confirm('¿Anular esta factura? Si estaba pagada, se revertirá inventario.')
    if (!ok) return

    setError(null)
    try {
      const res = await fetch(`/api/pos/facturas/${invoiceId}/anular`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || 'No se pudo anular')
        return
      }
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
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
      const ok = window.confirm(opts?.confirmMessage || '¿Finalizar esta factura? Se descontará inventario y quedará como pagada.')
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
        const d = json.details
        const extra = d
          ? ` | Material: ${d.materialNombre || d.materialId || '—'} | Requiere: ${d.required ?? '—'} | Bodega: ${d.warehouseNombre || '—'} | Disp. bodega: ${d.warehouseAvailable ?? '—'} | Disp. global: ${d.globalAvailable ?? '—'}`
          : ''
        const msg = (json.error || 'No se pudo finalizar la factura') + extra
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
      const msg = e instanceof Error ? e.message : 'Error inesperado'
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
        setError('Agrega al menos un ítem de devolución con cantidad > 0')
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
        setError(json.error || 'No se pudo crear la devolución')
        return
      }

      setReturnOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
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
        setReturnDetailError(json.error || 'No se pudo cargar el detalle')
        return
      }
      setReturnDetail(json.data)
    } catch (e) {
      setReturnDetailError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setReturnDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
          <p className="text-muted-foreground">Facturación interna.</p>
        </div>
        {activeTab === 'interna' ? (
          <div className="flex gap-2">
            <Button onClick={() => void loadAll()} variant="secondary" disabled={isLoading}>
              Refrescar
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={isLoading}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
            <Button onClick={openReturn} variant="outline" disabled={isLoading}>
              Nueva devolución
            </Button>
            <Button onClick={openCreate} disabled={isLoading}>
              Nueva factura
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void loadDianDocs()} disabled={dianLoading}>
              Refrescar DIAN
            </Button>
          </div>
        )}
      </div>

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
          <TabsTrigger value="interna">Interna</TabsTrigger>
          <TabsTrigger value="dian">DIAN</TabsTrigger>
        </TabsList>

        {tabPending ? (
          <div className="mt-2 text-sm text-muted-foreground">Cargando…</div>
        ) : null}

        <TabsContent value="interna" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Facturas recientes</CardTitle>
              <CardDescription>Últimas facturas generadas.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : invoices.length === 0 ? (
                <div className="text-sm text-gray-600">Aún no hay facturas.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">Fecha</th>
                        <th className="py-2 pr-4">Número</th>
                        <th className="py-2 pr-4">Cliente</th>
                        <th className="py-2 pr-4">Sede</th>
                        <th className="py-2 pr-4">Estado</th>
                        <th className="py-2 pr-4">Total</th>
                        <th className="py-2 pr-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-700">{new Date(inv.createdAt).toLocaleString('es-CO')}</td>
                          <td className="py-2 pr-4">
                            <button className="text-blue-700 hover:underline" onClick={() => void openDetail(inv.id)}>
                              {inv.numero}
                            </button>
                          </td>
                          <td className="py-2 pr-4 text-gray-900">{inv.clienteNombre}</td>
                          <td className="py-2 pr-4 text-gray-700">{inv.warehouse?.nombre || '—'}</td>
                          <td className="py-2 pr-4 text-gray-700">{inv.status}</td>
                          <td className="py-2 pr-4 font-medium">{formatCurrency(n(inv.total, 0))}</td>
                          <td className="py-2 pr-2">
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(inv.id)}>
                                Ver
                              </Button>
                              {inv.status === 'DRAFT' ? (
                                <Button type="button" size="sm" onClick={() => void finalizar(inv.id)} disabled={finalizeSubmitting}>
                                  {finalizeSubmitting ? 'Finalizando…' : 'Finalizar'}
                                </Button>
                              ) : null}
                              <Button type="button" size="sm" variant="destructive" onClick={() => void anular(inv.id)}>
                                Anular
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
              <CardTitle>Devoluciones recientes</CardTitle>
              <CardDescription>Últimas devoluciones registradas.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : returns.length === 0 ? (
                <div className="text-sm text-gray-600">Aún no hay devoluciones.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">Fecha</th>
                        <th className="py-2 pr-4">Número</th>
                        <th className="py-2 pr-4">Factura</th>
                        <th className="py-2 pr-4">Sede</th>
                        <th className="py-2 pr-4">Total</th>
                        <th className="py-2 pr-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-700">{new Date(r.createdAt).toLocaleString('es-CO')}</td>
                          <td className="py-2 pr-4">
                            <button className="text-blue-700 hover:underline" onClick={() => void openReturnDetail(r.id)}>
                              {r.numero}
                            </button>
                          </td>
                          <td className="py-2 pr-4 text-gray-700">{r.invoice?.numero || '—'}</td>
                          <td className="py-2 pr-4 text-gray-700">{r.warehouse?.nombre || '—'}</td>
                          <td className="py-2 pr-4 font-medium">{formatCurrency(n(r.total, 0))}</td>
                          <td className="py-2 pr-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => void openReturnDetail(r.id)}>
                              Ver
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

          <Card>
            <CardHeader>
              <CardTitle>Stock por sede</CardTitle>
              <CardDescription>Vista rápida del inventario en la sede seleccionada.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-3">
                <div className="sm:w-80">
                  <Label>Sede</Label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm"
                    value={selectedWarehouseForStock}
                    onChange={(e) => setSelectedWarehouseForStock(e.target.value)}
                  >
                    <option value="">(Selecciona)</option>
                    {bodegas.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}{b.isDefault ? ' (Pred.)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:pt-6">
                  <Button type="button" variant="secondary" onClick={() => void loadStock(selectedWarehouseForStock)} disabled={stockLoading}>
                    Refrescar stock
                  </Button>
                </div>
              </div>

              {stockError ? <div className="text-sm text-red-600 mb-2">{stockError}</div> : null}

              {stockLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : !selectedWarehouseForStock ? (
                <div className="text-sm text-gray-600">Selecciona una sede.</div>
              ) : stockRows.length === 0 ? (
                <div className="text-sm text-gray-600">No hay stock registrado en esta sede.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">Material</th>
                        <th className="py-2 pr-4">Cantidad</th>
                        <th className="py-2 pr-4">Unidad</th>
                        <th className="py-2 pr-4">Actualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockRows.map((row) => (
                        <tr key={row.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-900">{row.material.nombre}</td>
                          <td className="py-2 pr-4 text-gray-700">{n(row.quantity, 0).toLocaleString('es-CO')}</td>
                          <td className="py-2 pr-4 text-gray-700">{formatUnidadMedidaLabel(row.material.unidadMedida)}</td>
                          <td className="py-2 pr-4 text-gray-700">{new Date(row.updatedAt).toLocaleString('es-CO')}</td>
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
                Gestión de documentos electrónicos: creación, histórico, configuración y plantillas (base). La transmisión/expedición/entrega/recepción se mantiene desde el histórico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dianError ? <div className="text-sm text-red-600">{dianError}</div> : null}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label>Sección</Label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm"
                    value={dianMainTab}
                    onChange={(e) => setDianMainTab(e.target.value as typeof dianMainTab)}
                  >
                    <option value="crear">Crear</option>
                    <option value="historico">Histórico</option>
                    <option value="configuracion">Configuración</option>
                    <option value="plantillas">Plantillas</option>
                  </select>
                </div>

                {dianMainTab === 'crear' ? (
                  <div>
                    <Label>Tipo</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianCrearTab}
                      onChange={(e) => setDianCrearTab(e.target.value as typeof dianCrearTab)}
                    >
                      <option value="factura_venta">Factura de venta</option>
                      <option value="factura_aui">AUI</option>
                      <option value="factura_exportacion">Exportación</option>
                      <option value="factura_mandato">Mandato</option>
                      <option value="factura_contingencia">Contingencia</option>
                      <option value="factura_lotes">Por lotes</option>
                      <option value="nota_debito">Notas débito</option>
                      <option value="nota_credito">Notas crédito</option>
                    </select>
                  </div>
                ) : null}

                {dianMainTab === 'historico' ? (
                  <div>
                    <Label>Vista</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianHistoricoTab}
                      onChange={(e) => {
                        const next = (e.target.value === 'recibidos' ? 'recibidos' : 'enviados') as typeof dianHistoricoTab
                        setDianHistoricoTab(next)
                      }}
                    >
                      <option value="enviados">Enviados (Emisión)</option>
                      <option value="recibidos">Recibidos (Recepción)</option>
                    </select>
                  </div>
                ) : null}

                {dianMainTab === 'configuracion' ? (
                  <div>
                    <Label>Configuración</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianConfigTab}
                      onChange={(e) => setDianConfigTab(e.target.value as typeof dianConfigTab)}
                    >
                      <option value="rangos">Rangos de numeración</option>
                      <option value="comprador">Adquirente/Comprador</option>
                      <option value="productos">Producto/Servicio</option>
                    </select>
                  </div>
                ) : null}

                {dianMainTab === 'plantillas' ? (
                  <div>
                    <Label>Plantilla</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={dianPlantillaTab}
                      onChange={(e) => setDianPlantillaTab(e.target.value as typeof dianPlantillaTab)}
                    >
                      <option value="factura_venta">Factura de venta</option>
                    </select>
                  </div>
                ) : null}
              </div>

              {dianMainTab === 'crear' ? (
                <div className="space-y-4">
                  {dianCrearTab !== 'factura_lotes' && dianCrearTab !== 'nota_debito' && dianCrearTab !== 'nota_credito' ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Crear/conciliar desde factura interna</CardTitle>
                        <CardDescription>
                          Selecciona una factura interna (finalizada) para cargar datos y emitir electrónicamente al cliente y a DIAN.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          <div className="md:col-span-2">
                            <Label>Factura interna</Label>
                            <select
                              className="w-full h-10 rounded-md border px-3 text-sm"
                              value={dianCreatePosInvoiceId}
                              onChange={(e) => {
                                setDianCreatePosInvoiceId(e.target.value)
                                setDianCreatePosInvoice(null)
                              }}
                              disabled={dianCreatePosInvoiceLoading || dianCreating}
                            >
                              <option value="">(Selecciona)</option>
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
                              {dianCreatePosInvoiceLoading ? 'Cargando…' : 'Cargar datos'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void createDianDocFromPosInvoice({ posInvoiceId: dianCreatePosInvoiceId, subType: String(dianCrearTab) })}
                              disabled={!dianCreatePosInvoiceId || dianCreatePosInvoiceLoading || dianCreating}
                            >
                              {dianCreating ? 'Creando…' : 'Crear/conciliar'}
                            </Button>
                          </div>
                        </div>

                        {dianCreatePosInvoice ? (
                          <div className="rounded-md border p-3 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <div className="text-xs text-muted-foreground">Número interno</div>
                                <div className="font-medium">{dianCreatePosInvoice.numero}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Cliente</div>
                                <div className="font-medium">{dianCreatePosInvoice.clienteNombre}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Total</div>
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
                      <CardTitle className="text-base">Datos del comprador</CardTitle>
                      <CardDescription>Campos base para la creación manual.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>Nombre / Razón social</Label>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setClientePickerTarget('dian')
                              setClientePickerOpen(true)
                            }}
                            title="Buscar cliente"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input value={dianCreateBuyer.nombre} onChange={(e) => setDianCreateBuyer((p) => ({ ...p, nombre: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Documento (NIT/CC)</Label>
                        <Input value={dianCreateBuyer.documento} onChange={(e) => setDianCreateBuyer((p) => ({ ...p, documento: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Email (opcional)</Label>
                        <Input value={dianCreateBuyer.email} onChange={(e) => setDianCreateBuyer((p) => ({ ...p, email: e.target.value }))} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Ítems</CardTitle>
                      <CardDescription>Descripción, cantidad, valor unitario e IVA.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">Descripción</th>
                              <th className="py-2 pr-3">Cant.</th>
                              <th className="py-2 pr-3">Valor unit.</th>
                              <th className="py-2 pr-3">IVA %</th>
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
                                        placeholder="Producto/servicio"
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
                                      title="Buscar producto/servicio"
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
                                    Quitar
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
                          + Agregar ítem
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {dianCrearTab === 'factura_lotes' ? (
                    <div className="rounded-md border p-3 space-y-3">
                      <div>
                        <Label>Números (uno por línea)</Label>
                        <Textarea value={dianLotesNumeros} onChange={(e) => setDianLotesNumeros(e.target.value)} className="mt-2 h-28" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => void createDianDocsLotes()} disabled={dianCreating}>
                          {dianCreating ? 'Creando…' : 'Crear lote'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>Número</Label>
                          <Input value={dianCreateNumero} onChange={(e) => setDianCreateNumero(e.target.value)} placeholder="Ej: FE-123" disabled={dianCreating} />
                        </div>
                        <div className="md:col-span-2 text-xs text-muted-foreground flex items-end">
                          Campos reglamentarios mínimos (comprador + ítems) para iniciar la creación manual.
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
                          {dianCreating ? 'Creando…' : 'Crear documento'}
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
                      <div className="text-sm font-medium">Documentos</div>

                      {dianLoading ? (
                        <div className="text-sm text-gray-600">Cargando…</div>
                      ) : dianDocs.length === 0 ? (
                        <div className="text-sm text-gray-600">Aún no hay documentos.</div>
                      ) : (
                        <div className="overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">Fecha</th>
                                <th className="py-2 pr-4">Dirección</th>
                                <th className="py-2 pr-4">Tipo</th>
                                <th className="py-2 pr-4">Número</th>
                                <th className="py-2 pr-4">Estado</th>
                                <th className="py-2 pr-2">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dianDocs.map((doc) => (
                                <tr key={doc.id} className="border-b last:border-b-0">
                                  <td className="py-2 pr-4 text-gray-700">{new Date(doc.createdAt).toLocaleString('es-CO')}</td>
                                  <td className="py-2 pr-4 text-gray-700">{dianDirectionLabel(doc.direction)}</td>
                                  <td className="py-2 pr-4 text-gray-900">{dianTypeLabel(doc.type)}</td>
                                  <td className="py-2 pr-4 text-gray-700">{doc.numero || '—'}</td>
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
                                      Ver
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
                            <div className="text-sm font-medium">Documento seleccionado</div>
                            <div className="text-xs text-muted-foreground">ID: {dianSelectedId}</div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadDianDetail(dianSelectedId)}
                            disabled={dianDetailLoading}
                          >
                            {dianDetailLoading ? 'Cargando…' : 'Refrescar'}
                          </Button>
                        </div>

                        {dianDetailError ? <div className="text-sm text-red-600">{dianDetailError}</div> : null}

                        {dianDetail ? (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Dirección</div>
                                <div className="text-sm font-medium">{dianDetail.direction}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Tipo</div>
                                <div className="text-sm font-medium">{dianTypeLabel(dianDetail.type)}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Estado</div>
                                <div className="text-sm font-medium">{dianDetail.status}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label>UUID</Label>
                                <Input value={dianDetail.uuid || ''} readOnly placeholder="(Vacío)" />
                              </div>
                              <div>
                                <Label>CUFE</Label>
                                <Input value={dianDetail.cufe || ''} readOnly placeholder="(Vacío)" />
                              </div>
                              <div>
                                <Label>ProviderRef</Label>
                                <Input value={dianDetail.providerRef || ''} readOnly placeholder="(Vacío)" />
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
                                  {dianActionSubmitting === 'transmitir' ? 'Transmitiendo…' : 'Transmitir'}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label="Ayuda: transmitir"
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    Envía el documento para validación/registro ante el proveedor tecnológico y DIAN (según integración). Solo aplica a OUTBOUND.
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
                                  {dianActionSubmitting === 'expedir' ? 'Expidiendo…' : 'Expedir'}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label="Ayuda: expedir"
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    Marca la expedición: el documento queda emitido/válido en el flujo (estado de expedición y referencias asociadas).
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
                                  {dianActionSubmitting === 'entregar' ? 'Entregando…' : 'Entregar'}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label="Ayuda: entregar"
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    Registra la entrega al adquirente por los canales configurados (email/portal/otros).
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
                                  {dianActionSubmitting === 'recepcionar' ? 'Recepcionando…' : 'Recepcionar'}
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      aria-label="Ayuda: recepcionar"
                                    >
                                      ?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    Registra la recepción/acuse y deja trazabilidad del estado (documentos INBOUND o validaciones posteriores).
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>

                            {dianDetail.lastError ? <div className="text-sm text-red-600">Último error: {dianDetail.lastError}</div> : null}

                            <div className="space-y-2">
                              {DIAN_STEPS.map((s) => {
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
                                      {isCompleted ? 'Completado' : 'Pendiente'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>

                            <div>
                              <Label>Bitácora (eventos persistidos)</Label>
                              <Textarea value={dianBitacora} readOnly className="mt-2 h-48 font-mono text-xs" placeholder="Sin eventos aún…" />
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-600">Selecciona un documento para ver el detalle.</div>
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
                      {dianSettingsLoading ? 'Cargando configuración…' : 'Configura rangos, comprador y productos/servicios.'}
                    </div>
                    <Button
                      type="button"
                      onClick={() => void onSaveDianSettings()}
                      disabled={dianSettingsLoading || dianSettingsSaving}
                    >
                      {dianSettingsSaving ? 'Guardando…' : 'Guardar configuración'}
                    </Button>
                  </div>

                  {dianConfigTab === 'rangos' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">Rangos de numeración autorizada</div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={onValidateNumeracion} disabled={dianSettingsLoading}>
                            Validar
                          </Button>
                          <Button type="button" variant="outline" onClick={addDianNumeracionItem}>
                            + Agregar rango
                          </Button>
                        </div>
                      </div>

                      {dianNumeracionValidation ? (
                        dianNumeracionValidation.ok ? (
                          <div className="text-sm text-green-700 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                            Rangos válidos.
                          </div>
                        ) : (
                          <div className="text-sm text-red-700 rounded-md border border-red-200 bg-red-50 px-3 py-2 space-y-1">
                            <div className="font-medium">Errores de validación</div>
                            <ul className="list-disc pl-5">
                              {dianNumeracionValidation.messages.slice(0, 12).map((m, i) => (
                                <li key={i}>{m}</li>
                              ))}
                            </ul>
                            {dianNumeracionValidation.messages.length > 12 ? (
                              <div className="text-xs">…y {dianNumeracionValidation.messages.length - 12} más</div>
                            ) : null}
                          </div>
                        )
                      ) : null}

                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">Tipo de documento</th>
                              <th className="py-2 pr-3">Prefijo</th>
                              <th className="py-2 pr-3">Desde</th>
                              <th className="py-2 pr-3">Hasta</th>
                              <th className="py-2 pr-3">Nro. autorización</th>
                              <th className="py-2 pr-3">Vence</th>
                              <th className="py-2 pr-3">Actual</th>
                              <th className="py-2 pr-3">Activo</th>
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
                                    {DIAN_NUM_TIPO_DOC_OPTIONS.map((o) => (
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
                                    placeholder="Ej: 18764070977251"
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
                                    Quitar
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
                          Buscar adquirente
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>Nombre / Razón social</Label>
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
                          <Label>Documento (NIT/CC)</Label>
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
                          <Label>Email</Label>
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
                            Buscar producto/servicio
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
                            + Agregar manual
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">Código</th>
                              <th className="py-2 pr-3">Descripción</th>
                              <th className="py-2 pr-3">Valor unit.</th>
                              <th className="py-2 pr-3">IVA %</th>
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
                                    Quitar
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
                    <div className="text-sm text-muted-foreground">Plantilla base para Factura de venta.</div>
                    <Button
                      type="button"
                      onClick={() => void saveDianSettings(dianSettings)}
                      disabled={dianSettingsLoading || dianSettingsSaving}
                    >
                      {dianSettingsSaving ? 'Guardando…' : 'Guardar plantilla'}
                    </Button>
                  </div>

                  {dianSettingsLoading ? (
                    <div className="text-sm text-muted-foreground">Cargando…</div>
                  ) : (
                    <div>
                      <Label>Plantilla</Label>
                      <Textarea
                        value={String(dianSettings.templates?.facturaVenta ?? '')}
                        onChange={(e) =>
                          setDianSettings((prev) => ({
                            ...prev,
                            templates: { ...(prev.templates || {}), facturaVenta: e.target.value },
                          }))
                        }
                        className="mt-2 h-64 font-mono text-xs"
                        placeholder="Escribe aquí la plantilla de factura de venta…"
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
            <DialogTitle>Seleccionar cliente</DialogTitle>
            <DialogDescription>Busca y selecciona un cliente existente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={clientePickerSearch}
                onChange={(e) => setClientePickerSearch(e.target.value)}
                placeholder="Buscar por nombre o documento…"
              />
              <Button type="button" variant="outline" onClick={() => void loadClientesPicker()} disabled={clientePickerLoading}>
                {clientePickerLoading ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>

            {clientePickerError ? <div className="text-sm text-red-600">{clientePickerError}</div> : null}

            <div className="rounded-md border overflow-auto max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 px-3">Cliente</th>
                    <th className="py-2 px-3">Documento</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {clientePickerLoading ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        Cargando…
                      </td>
                    </tr>
                  ) : clientePickerItems.length === 0 ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        Sin resultados.
                      </td>
                    </tr>
                  ) : (
                    clientePickerItems.map((c) => (
                      <tr key={c.id} className="border-b last:border-b-0">
                        <td className="py-2 px-3 text-gray-900">{c.nombre}</td>
                        <td className="py-2 px-3 text-gray-700">{c.documento || '—'}</td>
                        <td className="py-2 px-3 text-gray-700">{c.email || '—'}</td>
                        <td className="py-2 px-3 text-right">
                          <Button type="button" size="sm" onClick={() => onPickCliente(c)}>
                            Seleccionar
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
            <DialogTitle>Seleccionar producto/servicio</DialogTitle>
            <DialogDescription>Busca y selecciona un material existente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={productoPickerSearch} onChange={(e) => setProductoPickerSearch(e.target.value)} placeholder="Buscar…" />
              <Button type="button" variant="outline" onClick={() => void loadProductosPicker()} disabled={productoPickerLoading}>
                {productoPickerLoading ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>

            {productoPickerError ? <div className="text-sm text-red-600">{productoPickerError}</div> : null}

            <div className="rounded-md border overflow-auto max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 px-3">Nombre</th>
                    <th className="py-2 px-3">Unidad</th>
                    <th className="py-2 px-3">Precio sugerido</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {productoPickerLoading ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        Cargando…
                      </td>
                    </tr>
                  ) : productoPickerItems.length === 0 ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-muted-foreground" colSpan={4}>
                        Sin resultados.
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
                            Seleccionar
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
            <DialogTitle>Nueva devolución</DialogTitle>
            <DialogDescription>
              Registra una devolución y devuelve inventario. Puedes asociarla a una factura existente (opcional).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitReturn(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label>Factura (opcional)</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={returnForm.invoiceId}
                  onChange={(e) => void onReturnInvoiceChange(e.target.value)}
                >
                  <option value="">(Sin asociar)</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.numero} — {inv.clienteNombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Sede</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={returnForm.warehouseId}
                  onChange={(e) => setReturnForm((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">(Auto)</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}{b.isDefault ? ' (Pred.)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>IVA %</Label>
                <Input value={returnForm.ivaPct} onChange={(e) => setReturnForm((p) => ({ ...p, ivaPct: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Motivo (opcional)</Label>
                <Input value={returnForm.motivo} onChange={(e) => setReturnForm((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Ítems devueltos</div>
                <Button type="button" size="sm" variant="outline" onClick={addReturnItem}>
                  + Agregar ítem
                </Button>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">Material</th>
                      <th className="py-2 pr-3">Descripción</th>
                      <th className="py-2 pr-3">Cant.</th>
                      <th className="py-2 pr-3">Precio</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-2"></th>
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
                              <option value="">(Manual)</option>
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
                              Quitar
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
                <Label>Nota interna (opcional)</Label>
                <Textarea value={returnForm.motivo} onChange={(e) => setReturnForm((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(computedReturn.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA</span>
                  <span className="font-medium">{formatCurrency(computedReturn.iva)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>Total</span>
                  <span className="font-semibold">{formatCurrency(computedReturn.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReturnOpen(false)} disabled={returnSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={returnSubmitting}>
                {returnSubmitting ? 'Creando…' : 'Crear devolución'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nueva factura</DialogTitle>
            <DialogDescription>
              Por defecto se crea como pagada (y descuenta inventario). Si no hay stock, guárdala como borrador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void submitInvoice(e)} className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Guardar como borrador</div>
                <div className="text-xs text-muted-foreground">No descuenta inventario; úsalo si aún no hay stock.</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createAsDraft}
                  onChange={(e) => setCreateAsDraft(e.target.checked)}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Cliente</Label>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setClientePickerTarget('interna')
                      setClientePickerOpen(true)
                    }}
                    title="Buscar cliente"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <Input value={form.clienteNombre} onChange={(e) => setForm((p) => ({ ...p, clienteNombre: e.target.value }))} />
              </div>
              <div>
                <Label>Documento (opcional)</Label>
                <Input value={form.clienteDocumento} onChange={(e) => setForm((p) => ({ ...p, clienteDocumento: e.target.value }))} />
              </div>

              <div>
                <Label>Sede</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={form.warehouseId}
                  onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">(Auto)</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}{b.isDefault ? ' (Pred.)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>IVA %</Label>
                <Input value={form.ivaPct} onChange={(e) => setForm((p) => ({ ...p, ivaPct: e.target.value }))} />
              </div>
              <div className="sm:col-span-1">
                <Label>Buscar material</Label>
                <Input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder="Filtrar…" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Ítems</div>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  + Agregar ítem
                </Button>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">Material</th>
                      <th className="py-2 pr-3">Descripción</th>
                      <th className="py-2 pr-3">Cant.</th>
                      <th className="py-2 pr-3">Precio</th>
                      <th className="py-2 pr-3">Total</th>
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
                          <td className="py-2 pr-3">
                            <div className="flex gap-2 items-center">
                              <select
                                className="w-56 h-10 rounded-md border px-2 text-sm"
                                value={it.materialId}
                                onChange={(e) => updateItem(idx, { materialId: e.target.value })}
                              >
                                <option value="">(Manual)</option>
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
                                title="Buscar producto/servicio"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              value={it.descripcion}
                              onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                              placeholder="Descripción"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              value={it.quantity}
                              onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                              className="w-24"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              value={it.unitPrice}
                              onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                              className="w-32"
                            />
                          </td>
                          <td className="py-2 pr-3 font-medium">{formatCurrency(lineTotal)}</td>
                          <td className="py-2 pr-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => removeItem(idx)}>
                              Quitar
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
                <Label>Nota (opcional)</Label>
                <Textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(computed.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA</span>
                  <span className="font-medium">{formatCurrency(computed.iva)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>Total</span>
                  <span className="font-semibold">{formatCurrency(computed.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creando…' : 'Crear factura'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de factura</DialogTitle>
            <DialogDescription>Información y líneas de la factura seleccionada.</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : detailError ? (
            <div className="text-sm text-red-600">{detailError}</div>
          ) : !detail ? (
            <div className="text-sm text-gray-600">Sin datos.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Número</div>
                  <div className="font-medium">{detail.numero}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Cliente</div>
                  <div className="font-medium">{detail.clienteNombre}</div>
                  <div className="text-xs text-gray-500">{detail.clienteDocumento || '—'}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Sede</div>
                  <div className="font-medium">{detail.warehouse?.nombre || '—'}</div>
                  <div className="text-xs text-gray-500">Estado: {detail.status}</div>
                </div>
              </div>

              {detail.note ? <div className="text-sm text-gray-700">Nota: {detail.note}</div> : null}

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">Descripción</th>
                      <th className="py-2 pr-4">Cant.</th>
                      <th className="py-2 pr-4">Precio</th>
                      <th className="py-2 pr-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 text-gray-900">{it.descripcion}</td>
                        <td className="py-2 pr-4 text-gray-700">{n(it.quantity, 0).toLocaleString('es-CO')}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatCurrency(n(it.unitPrice, 0))}</td>
                        <td className="py-2 pr-4 font-medium">{formatCurrency(n(it.total, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Subtotal:</span> <span className="font-medium">{formatCurrency(detail.subtotal)}</span>
                </div>
                <div>
                  <span className="text-gray-500">IVA:</span> <span className="font-medium">{formatCurrency(detail.iva)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(detail.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {detail && detail.status === 'DRAFT' ? (
              <Button type="button" onClick={() => void finalizar(detail.id)} disabled={finalizeSubmitting || detailLoading}>
                {finalizeSubmitting ? 'Finalizando…' : 'Finalizar'}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDetailOpen} onOpenChange={setReturnDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de devolución</DialogTitle>
            <DialogDescription>Información y líneas de la devolución seleccionada.</DialogDescription>
          </DialogHeader>

          {returnDetailLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : returnDetailError ? (
            <div className="text-sm text-red-600">{returnDetailError}</div>
          ) : !returnDetail ? (
            <div className="text-sm text-gray-600">Sin datos.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Número</div>
                  <div className="font-medium">{returnDetail.numero}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Factura</div>
                  <div className="font-medium">{returnDetail.invoice?.numero || '—'}</div>
                  <div className="text-xs text-gray-500">{new Date(returnDetail.createdAt).toLocaleString('es-CO')}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Sede</div>
                  <div className="font-medium">{returnDetail.warehouse?.nombre || '—'}</div>
                </div>
              </div>

              {returnDetail.motivo ? <div className="text-sm text-gray-700">Motivo: {returnDetail.motivo}</div> : null}

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">Descripción</th>
                      <th className="py-2 pr-4">Cant.</th>
                      <th className="py-2 pr-4">Precio</th>
                      <th className="py-2 pr-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnDetail.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 text-gray-900">{it.descripcion}</td>
                        <td className="py-2 pr-4 text-gray-700">{n(it.quantity, 0).toLocaleString('es-CO')}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatCurrency(n(it.unitPrice, 0))}</td>
                        <td className="py-2 pr-4 font-medium">{formatCurrency(n(it.total, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Subtotal:</span> <span className="font-medium">{formatCurrency(returnDetail.subtotal)}</span>
                </div>
                <div>
                  <span className="text-gray-500">IVA:</span> <span className="font-medium">{formatCurrency(returnDetail.iva)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(returnDetail.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReturnDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
