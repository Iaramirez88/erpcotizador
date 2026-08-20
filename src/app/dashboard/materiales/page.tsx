/**
 * Página de Productos
 * Catálogo de productos de impresión con precios
 */

"use client"

import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { ImportDialog } from "@/components/import/import-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { MobileActionsMenu } from '@/components/ui/mobile-actions-menu'
import { CustomProductRequestsAdminDialog } from "@/components/materiales/custom-product-requests-admin-dialog"
import { CustomProductRequestsMyDialog } from "@/components/materiales/custom-product-requests-my-dialog"
import {
  ProductConfigDialog,
  type ProductCategoryOption,
  type ProductCustomFieldDefinition,
  type ProductTypeOption,
} from "@/components/materiales/product-config-dialog"
import { ErpPageHero } from "@/components/dashboard/erp-page-chrome"
import { CatalogModuleTabs } from "@/components/inventory/catalog-module-tabs"
import { useCurrentUserAccess } from '@/hooks/use-current-user-access'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import { formatCurrency, formatUnidadMedidaLabel } from "@/lib/utils"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const

type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number] | 'all'

interface Material {
  id: string
  externalId?: string | null
  nombre: string
  tipo: string
  tipoNombre?: string | null
  categoria?: string | null
  imagenUrl?: string | null
  ancho?: number | null
  largo?: number | null
  espesor?: number | null
  color?: string | null
  precioM2?: number | null
  precioMetro?: number | null
  precioUnidad?: number | null
  precioCompra?: number | null
  stockActual: number
  stockMinimo: number
  unidadMedida: string
  proveedor?: string | null
  observaciones?: string | null
  extraFields?: Record<string, unknown> | null
  requiresWorkOrder?: boolean
  activo: boolean
  createdAt: string
  stocks?: Array<{
    quantity: number
    warehouse: { id: string; nombre: string; codigo: string | null; isDefault: boolean; sedeId: string | null }
  }>
  quantityDiscounts?: Array<{
    id: string
    minQty: number
    discountPct: number
  }>
}

type Bodega = {
  id: string
  nombre: string
  codigo: string | null
  isDefault: boolean
  sedeId: string | null
}

type ProveedorLite = {
  id: string
  nombre: string
  nit?: string | null
}

type SedeLite = {
  id: string
  nombre: string
  codigo: string | null
}

type SedeWarehouseOption = {
  sedeId: string
  warehouseId: string
  label: string
}

const TIPOS_MATERIAL = [
  { value: "VINILO", label: "Vinilo" },
  { value: "LONA", label: "Lona" },
  { value: "BANNER", label: "Banner" },
  { value: "MICROPERFORADO", label: "Microperforado" },
  { value: "ONE_WAY", label: "One Way" },
  { value: "ADHESIVO", label: "Adhesivo" },
  { value: "PAPEL", label: "Papel" },
  { value: "CARTULINA", label: "Cartulina" },
  { value: "FOAM", label: "Foam" },
  { value: "ACRILICO", label: "Acrílico" },
  { value: "PVC", label: "PVC" },
  { value: "OTRO", label: "Otro / Merchandising" },
]

const CATEGORIAS_SUGERIDAS = [
  'Merchandising',
  'Sublimación',
  'Impresión',
  'Señalización',
  'Corte / Láser / CNC',
  'Acabados',
  'Promocionales',
  'Papelería',
] as const

const UNIDADES_MEDIDA = [
  { value: "m2", label: "Metro cuadrado (m²)" },
  { value: "ml", label: "Metro lineal (ml)" },
  { value: "unidad", label: "Unidad" },
]

const CUSTOM_FIELD_TYPE_LABELS: Record<ProductCustomFieldDefinition['fieldType'], string> = {
  TEXT: 'Texto corto',
  LONG_TEXT: 'Texto largo',
  NUMBER: 'Número',
  BOOLEAN: 'Sí / No',
  DATE: 'Fecha',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeExtraFields(value: unknown): Record<string, string | boolean> {
  if (!isRecord(value)) return {}

  const entries = Object.entries(value).map(([key, fieldValue]) => {
    if (typeof fieldValue === 'boolean') return [key, fieldValue] as const
    if (fieldValue == null) return [key, ''] as const
    return [key, String(fieldValue)] as const
  })

  return Object.fromEntries(entries)
}

function parseFieldOptions(field: ProductCustomFieldDefinition): string[] {
  if (!Array.isArray(field.optionsJson)) return []
  return field.optionsJson.map((item) => String(item).trim()).filter(Boolean)
}

export default function ProductosPage() {
  const searchParams = useSearchParams()
  const { mode: dataViewMode, setMode: setDataViewMode } = useDataViewMode('materiales.history', 'list')
  const [materiales, setMateriales] = useState<Material[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [bodegasFiltroList, setBodegasFiltroList] = useState<Bodega[]>([])
  const [sedes, setSedes] = useState<SedeLite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("")
  const [unidadFiltro, setUnidadFiltro] = useState("")
  const [sortFiltro, setSortFiltro] = useState<'nameAsc' | 'mostSold' | 'stockDesc' | 'mostQuoted' | 'createdDesc' | 'createdAsc' | 'priceDesc' | 'priceAsc'>('nameAsc')
  const [sedeFiltro, setSedeFiltro] = useState("")
  const [bodegaFiltro, setBodegaFiltro] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("")
  const [proveedorFiltro, setProveedorFiltro] = useState("")
  const [descuentoFiltro, setDescuentoFiltro] = useState<'all' | 'true' | 'false'>('all')
  const [precioMinFiltro, setPrecioMinFiltro] = useState("")
  const [precioMaxFiltro, setPrecioMaxFiltro] = useState("")
  const [stockMinFiltro, setStockMinFiltro] = useState("")
  const [stockMaxFiltro, setStockMaxFiltro] = useState("")
  const [createdFromFiltro, setCreatedFromFiltro] = useState("")
  const [createdToFiltro, setCreatedToFiltro] = useState("")

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(25)
  const [totalRows, setTotalRows] = useState(0)

  const [selectionScope, setSelectionScope] = useState<'none' | 'page' | 'all'>("none")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportPeriodo, setExportPeriodo] = useState<'' | 'day' | 'week' | 'month' | 'quarter'>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageFileError, setImageFileError] = useState("")
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [customRequestsOpen, setCustomRequestsOpen] = useState(false)
  const [myCustomRequestsOpen, setMyCustomRequestsOpen] = useState(false)
  const [productConfigOpen, setProductConfigOpen] = useState(false)
  const [typeOptions, setTypeOptions] = useState<ProductTypeOption[]>([])
  const [categoryOptions, setCategoryOptions] = useState<ProductCategoryOption[]>([])
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<ProductCustomFieldDefinition[]>([])

  useEffect(() => {
    if (!searchParams) return
    const notif = searchParams.get('notif')
    if (notif === 'custom-requests') setCustomRequestsOpen(true)
    if (notif === 'my-custom-requests') setMyCustomRequestsOpen(true)
  }, [searchParams])

  useEffect(() => {
    if (!isModalOpen) return

    const timer = window.setTimeout(() => {
      externalIdInputRef.current?.focus()
      externalIdInputRef.current?.select()
    }, 30)

    return () => window.clearTimeout(timer)
  }, [editingMaterial, isModalOpen])

  const [proveedorMatches, setProveedorMatches] = useState<ProveedorLite[]>([])
  const [proveedorLoading, setProveedorLoading] = useState(false)
  const [proveedorCreateOpen, setProveedorCreateOpen] = useState(false)
  const [proveedorNuevoNombre, setProveedorNuevoNombre] = useState("")
  const [proveedorNuevoNit, setProveedorNuevoNit] = useState("")
  const [proveedorCreateSaving, setProveedorCreateSaving] = useState(false)
  const [proveedorError, setProveedorError] = useState("")
  const externalIdInputRef = useRef<HTMLInputElement | null>(null)
  const nombreInputRef = useRef<HTMLInputElement | null>(null)
  const { data: currentUserAccess, hasWriteAccess } = useCurrentUserAccess()
  const canManageProducts = hasWriteAccess('MATERIALES')
  const isAdmin = Boolean(currentUserAccess?.canManageCustomProductRequests)
  
  const [formData, setFormData] = useState({
    externalId: "",
    nombre: "",
    tipo: "VINILO",
    tipoNombre: "Vinilo",
    categoria: "",
    imagenUrl: "",
    ancho: "",
    largo: "",
    espesor: "",
    color: "",
    precioM2: "",
    precioMetro: "",
    precioUnidad: "",
    precioCompra: "",
    stockActual: "0",
    stockMinimo: "0",
    unidadMedida: "m2",
    warehouseId: "",
    warehouseIds: [] as string[],
    stockScope: 'warehouse' as 'warehouse' | 'selectedSedes' | 'allSedes',
    proveedor: "",
    observaciones: "",
    extraFields: {} as Record<string, string | boolean>,
    requiresWorkOrder: false,
    activo: true
  })

  const [quantityDiscounts, setQuantityDiscounts] = useState<Array<{ minQty: string; discountPct: string }>>([])

  const baseTypeOptions = useMemo(() => TIPOS_MATERIAL, [])

  const availableTypeOptions = useMemo(() => {
    const custom = typeOptions.map((option) => ({
      value: option.nombre,
      label: option.nombre,
      baseTipo: option.baseTipo,
      source: 'custom' as const,
    }))

    const base = TIPOS_MATERIAL.filter(
      (tipo) => !custom.some((option) => option.value.toLowerCase() === tipo.label.toLowerCase())
    ).map((tipo) => ({
      value: tipo.label,
      label: tipo.label,
      baseTipo: tipo.value,
      source: 'base' as const,
    }))

    return [...custom, ...base]
  }, [typeOptions])

  const availableCategoryOptions = useMemo(() => {
    return Array.from(new Set([...CATEGORIAS_SUGERIDAS, ...categoryOptions.map((option) => option.nombre)])).sort((a, b) =>
      a.localeCompare(b, 'es')
    )
  }, [categoryOptions])

  const fetchConfiguracion = useCallback(async () => {
    try {
      const res = await fetch('/api/materiales/configuracion', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        data?: {
          typeOptions?: ProductTypeOption[]
          categoryOptions?: ProductCategoryOption[]
          customFields?: ProductCustomFieldDefinition[]
        }
      } | null

      if (!res.ok || !json?.success || !json.data) return

      setTypeOptions(Array.isArray(json.data.typeOptions) ? json.data.typeOptions : [])
      setCategoryOptions(Array.isArray(json.data.categoryOptions) ? json.data.categoryOptions : [])
      setCustomFieldDefinitions(Array.isArray(json.data.customFields) ? json.data.customFields : [])
    } catch {
      // noop
    }
  }, [])

  const unidadCobro = useMemo(() => {
    const u = String(formData.unidadMedida || '').trim().toLowerCase()
    if (u === 'm2' || u === 'm²') return 'm2'
    if (u === 'ml' || u === 'm' || u === 'metro') return 'ml'
    return 'unidad'
  }, [formData.unidadMedida])

  useEffect(() => {
    void fetchConfiguracion()
  }, [fetchConfiguracion])

  const tipoProducto = useMemo(() => {
    return unidadCobro === 'unidad' ? 'FISICO' : 'METRAJE'
  }, [unidadCobro])

  const defaultBodegaId = useMemo(() => {
    // Preferimos la bodega principal asociada a la sede (sedeId != null).
    const sedeDefault = bodegas.find((b) => b.isDefault && b.sedeId)
    if (sedeDefault?.id) return sedeDefault.id
    const anyDefault = bodegas.find((b) => b.isDefault)
    if (anyDefault?.id) return anyDefault.id
    return bodegas[0]?.id ?? ''
  }, [bodegas])

  const sedeById = useMemo(() => {
    return new Map(sedes.map((sede) => [sede.id, sede]))
  }, [sedes])

  const formatBodegaLabel = useCallback(
    (bodega: Bodega) => {
      const sede = bodega.sedeId ? sedeById.get(bodega.sedeId) : null
      const sedeLabel = sede ? `${sede.nombre}${sede.codigo ? ` (${sede.codigo})` : ''}` : 'Global'
      return `${bodega.nombre}${bodega.isDefault ? ' (Principal)' : ''} · ${sedeLabel}`
    },
    [sedeById]
  )

  const sedeWarehouseOptions = useMemo<SedeWarehouseOption[]>(() => {
    const sortedSedes = [...sedes].sort((a, b) => {
      const aIsPrincipal = a.nombre.trim().toLowerCase() === 'principal'
      const bIsPrincipal = b.nombre.trim().toLowerCase() === 'principal'
      if (aIsPrincipal !== bIsPrincipal) return aIsPrincipal ? 1 : -1
      return a.nombre.localeCompare(b.nombre, 'es')
    })

    return sortedSedes
      .map((sede) => {
        const warehouse =
          bodegas.find((bodega) => bodega.sedeId === sede.id && bodega.isDefault) ??
          bodegas.find((bodega) => bodega.sedeId === sede.id)

        if (!warehouse?.id) return null

        return {
          sedeId: sede.id,
          warehouseId: warehouse.id,
          label: sede.codigo ? `${sede.nombre} (${sede.codigo})` : sede.nombre,
        }
      })
      .filter((option): option is SedeWarehouseOption => Boolean(option?.warehouseId))
  }, [bodegas, sedes])

  const resolveWarehouseIdForSedePicker = useCallback(
    (warehouseId: string) => {
      if (!warehouseId) return ''
      if (sedeWarehouseOptions.some((option) => option.warehouseId === warehouseId)) return warehouseId

      const currentWarehouse = bodegas.find((bodega) => bodega.id === warehouseId)
      if (!currentWarehouse?.sedeId) return warehouseId

      return sedeWarehouseOptions.find((option) => option.sedeId === currentWarehouse.sedeId)?.warehouseId ?? warehouseId
    },
    [bodegas, sedeWarehouseOptions]
  )

  const selectedWarehouseOptions = useMemo(
    () => formData.warehouseIds
      .map((warehouseId) => sedeWarehouseOptions.find((option) => option.warehouseId === warehouseId))
      .filter((option): option is SedeWarehouseOption => Boolean(option)),
    [formData.warehouseIds, sedeWarehouseOptions]
  )

  const buildWarehouseSelectionFromMaterial = useCallback(
    (material: Material) => {
      const defaultWarehouseIds = Array.from(
        new Set(
          (material.stocks ?? [])
            .filter((stock) => stock.warehouse?.sedeId && stock.warehouse.isDefault)
            .map((stock) => resolveWarehouseIdForSedePicker(stock.warehouse.id))
            .filter(Boolean)
        )
      )

      if (defaultWarehouseIds.length > 1) {
        return {
          warehouseId: defaultWarehouseIds[0] ?? '',
          warehouseIds: defaultWarehouseIds,
          stockScope: 'selectedSedes' as const,
        }
      }

      return {
        warehouseId: defaultWarehouseIds[0] ?? resolveWarehouseIdForSedePicker(material.stocks?.[0]?.warehouse?.id ?? ''),
        warehouseIds: defaultWarehouseIds,
        stockScope: 'warehouse' as const,
      }
    },
    [resolveWarehouseIdForSedePicker]
  )

  useEffect(() => {
    if (!isModalOpen) return

    const loadBodegas = async () => {
      try {
        const res = await fetch('/api/bodegas')
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: Bodega[] }
        if (res.ok && json.success && Array.isArray(json.data)) {
          setBodegas(json.data)
        }
      } catch {
        // noop
      }
    }

    void loadBodegas()
  }, [isModalOpen])

  useEffect(() => {
    if (!isModalOpen || editingMaterial || !defaultBodegaId) return

    setFormData((prev) => {
      if (prev.stockScope !== 'warehouse' || prev.warehouseId) return prev
      return { ...prev, warehouseId: defaultBodegaId }
    })
  }, [defaultBodegaId, editingMaterial, isModalOpen])

  useEffect(() => {
    let cancelled = false
    const loadBodegas = async () => {
      try {
        const res = await fetch('/api/bodegas', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: Bodega[] }
        if (!cancelled && res.ok && json.success && Array.isArray(json.data)) {
          setBodegas(json.data)
        }
      } catch {
        // noop
      }
    }

    void loadBodegas()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadSedes = async () => {
      try {
        const res = await fetch('/api/sedes', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: Array<{ id: string; nombre: string; codigo: string | null }> }
        if (!cancelled && res.ok && json.success && Array.isArray(json.data)) {
          setSedes(json.data.map((s) => ({ id: s.id, nombre: s.nombre, codigo: s.codigo ?? null })))
        }
      } catch {
        // noop
      }
    }

    void loadSedes()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadBodegasFiltro = async () => {
      try {
        const url = new URL('/api/bodegas', window.location.origin)
        if (sedeFiltro) url.searchParams.set('sedeId', sedeFiltro)
        const res = await fetch(url.toString(), { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: Bodega[] }
        if (!cancelled && res.ok && json.success && Array.isArray(json.data)) {
          setBodegasFiltroList(json.data)
        } else if (!cancelled) {
          setBodegasFiltroList([])
        }
      } catch {
        if (!cancelled) setBodegasFiltroList([])
      }
    }

    void loadBodegasFiltro()
    return () => {
      cancelled = true
    }
  }, [sedeFiltro])

  useEffect(() => {
    if (!bodegaFiltro) return
    const exists = bodegasFiltroList.some((b) => b.id === bodegaFiltro)
    if (!exists) setBodegaFiltro("")
  }, [bodegaFiltro, bodegasFiltroList])

  // Regla: no asignar bodega automáticamente al abrir el modal.

  function setTipoProducto(next: 'METRAJE' | 'FISICO') {
    setFormData((prev) => {
      if (next === 'FISICO') {
        return {
          ...prev,
          unidadMedida: 'unidad',
          precioM2: '',
          precioMetro: '',
        }
      }

      // METRAJE
      const current = String(prev.unidadMedida || '').trim().toLowerCase()
      const nextUnidad = current === 'ml' || current === 'm' || current === 'metro' ? 'ml' : 'm2'
      return {
        ...prev,
        unidadMedida: nextUnidad,
        precioUnidad: '',
      }
    })
  }

  useEffect(() => {
    // Cuando cambian filtros, volvemos a página 1.
    setPage(1)
    setSelectionScope('none')
    setSelectedIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tipoFiltro, unidadFiltro, sortFiltro, sedeFiltro, bodegaFiltro, categoriaFiltro, proveedorFiltro, descuentoFiltro, precioMinFiltro, precioMaxFiltro, stockMinFiltro, stockMaxFiltro, createdFromFiltro, createdToFiltro])

  useEffect(() => {
    // Al paginar o cambiar el tamaño, limpiamos selección de página.
    if (selectionScope !== 'all') {
      setSelectionScope('none')
      setSelectedIds(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  useEffect(() => {
    fetchMateriales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tipoFiltro, unidadFiltro, sortFiltro, sedeFiltro, bodegaFiltro, categoriaFiltro, proveedorFiltro, descuentoFiltro, precioMinFiltro, precioMaxFiltro, stockMinFiltro, stockMaxFiltro, createdFromFiltro, createdToFiltro, page, pageSize])

  const exportExcel = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tipoFiltro) params.set('tipo', tipoFiltro)
    if (unidadFiltro) params.set('unidadMedida', unidadFiltro)
    if (sortFiltro && sortFiltro !== 'nameAsc') params.set('sort', sortFiltro)
    if (sedeFiltro) params.set('sedeId', sedeFiltro)
    if (bodegaFiltro) params.set('warehouseId', bodegaFiltro)
    if (categoriaFiltro) params.set('categoria', categoriaFiltro)
    if (proveedorFiltro) params.set('proveedor', proveedorFiltro)
    if (descuentoFiltro !== 'all') params.set('withDiscount', descuentoFiltro)
    if (precioMinFiltro) params.set('precioMin', precioMinFiltro)
    if (precioMaxFiltro) params.set('precioMax', precioMaxFiltro)
    if (stockMinFiltro) params.set('stockMin', stockMinFiltro)
    if (stockMaxFiltro) params.set('stockMax', stockMaxFiltro)
    if (createdFromFiltro) params.set('createdFrom', createdFromFiltro)
    if (createdToFiltro) params.set('createdTo', createdToFiltro)
    const url = params.toString() ? `/api/materiales/export?${params.toString()}` : '/api/materiales/export'
    window.location.href = url
  }

  const formatLocalDateInput = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const applyExportPeriod = (period: '' | 'day' | 'week' | 'month' | 'quarter') => {
    setExportPeriodo(period)
    if (!period) return
    const now = new Date()
    const to = formatLocalDateInput(now)
    const days = period === 'day' ? 0 : period === 'week' ? 7 : period === 'month' ? 30 : 90
    const fromDate = new Date(now)
    fromDate.setDate(fromDate.getDate() - days)
    const from = formatLocalDateInput(fromDate)
    setCreatedFromFiltro(from)
    setCreatedToFiltro(to)
  }

  useEffect(() => {
    if (!isModalOpen) return

    const q = String(formData.proveedor || '').trim()
    if (!q) {
      setProveedorMatches([])
      setProveedorLoading(false)
      return
    }

    const ac = new AbortController()
    const t = setTimeout(async () => {
      try {
        setProveedorLoading(true)
        const url = new URL('/api/proveedores', window.location.origin)
        url.searchParams.set('search', q)
        url.searchParams.set('activo', 'true')
        const res = await fetch(url.toString(), { signal: ac.signal })
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ProveedorLite[] } | null
        if (ac.signal.aborted) return
        if (res.ok && json?.success && Array.isArray(json.data)) {
          setProveedorMatches(json.data.slice(0, 6))
        } else {
          setProveedorMatches([])
        }
      } catch {
        if (!ac.signal.aborted) setProveedorMatches([])
      } finally {
        if (!ac.signal.aborted) setProveedorLoading(false)
      }
    }, 250)

    return () => {
      ac.abort()
      clearTimeout(t)
    }
  }, [isModalOpen, formData.proveedor])

  const createProveedor = async () => {
    const nombre = proveedorNuevoNombre.trim()
    const nit = proveedorNuevoNit.trim()
    if (!nombre) {
      setProveedorError('El nombre del proveedor es requerido.')
      return
    }

    setProveedorError('')
    setProveedorCreateSaving(true)
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, nit: nit || null }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ProveedorLite; error?: string } | null
      if (!res.ok || !json?.success || !json.data?.nombre) {
        setProveedorError(json?.error || 'No se pudo crear el proveedor.')
        return
      }

      setFormData((p) => ({ ...p, proveedor: json.data!.nombre }))
      setProveedorCreateOpen(false)
      setProveedorNuevoNombre('')
      setProveedorNuevoNit('')
      setProveedorMatches((prev) => {
        const exists = prev.some((x) => x.id === json.data!.id)
        return exists ? prev : [json.data!, ...prev].slice(0, 6)
      })
    } finally {
      setProveedorCreateSaving(false)
    }
  }

  const fetchMateriales = async () => {
    setIsLoading(true)
    try {
      const url = new URL('/api/materiales', window.location.origin)
      if (search) url.searchParams.set('search', search)
      if (tipoFiltro) url.searchParams.set('tipo', tipoFiltro)
      if (unidadFiltro) url.searchParams.set('unidadMedida', unidadFiltro)
      if (sortFiltro && sortFiltro !== 'nameAsc') url.searchParams.set('sort', sortFiltro)
      if (sedeFiltro) url.searchParams.set('sedeId', sedeFiltro)
      if (bodegaFiltro) url.searchParams.set('warehouseId', bodegaFiltro)
      if (categoriaFiltro) url.searchParams.set('categoria', categoriaFiltro)
      if (proveedorFiltro) url.searchParams.set('proveedor', proveedorFiltro)
      if (descuentoFiltro !== 'all') url.searchParams.set('withDiscount', descuentoFiltro)
      if (precioMinFiltro) url.searchParams.set('precioMin', precioMinFiltro)
      if (precioMaxFiltro) url.searchParams.set('precioMax', precioMaxFiltro)
      if (stockMinFiltro) url.searchParams.set('stockMin', stockMinFiltro)
      if (stockMaxFiltro) url.searchParams.set('stockMax', stockMaxFiltro)
      if (createdFromFiltro) url.searchParams.set('createdFrom', createdFromFiltro)
      if (createdToFiltro) url.searchParams.set('createdTo', createdToFiltro)

      if (pageSize !== 'all') {
        url.searchParams.set('page', String(Math.max(1, page)))
        url.searchParams.set('pageSize', String(pageSize))
      } else {
        url.searchParams.set('pageSize', 'all')
      }
      
      const response = await fetch(url.toString())
      const data = await response.json()
      
      if (data.success) {
        const rows = Array.isArray(data.data) ? (data.data as Material[]) : []
        setMateriales(rows)
        const total = Number(data?.meta?.total)
        setTotalRows(Number.isFinite(total) ? total : rows.length)

        const serverPage = Number(data?.meta?.page)
        if (pageSize !== 'all' && Number.isFinite(serverPage) && serverPage > 0 && serverPage !== page) {
          setPage(Math.floor(serverPage))
        }
      }
    } catch (error) {
      console.error('Error al cargar productos:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const pageCount = useMemo(() => {
    if (pageSize === 'all') return 1
    const size = Number(pageSize)
    if (!Number.isFinite(size) || size <= 0) return 1
    return Math.max(1, Math.ceil(totalRows / size))
  }, [pageSize, totalRows])

  const selectedCount = useMemo(() => {
    if (selectionScope === 'all') return 0
    if (selectionScope === 'page') return selectedIds.size
    return 0
  }, [selectionScope, selectedIds, totalRows])

  const toggleSelectId = (id: string) => {
    if (selectionScope === 'all') return
    setSelectionScope('page')
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectPage = () => {
    if (selectionScope === 'page' && selectedIds.size === materiales.length) {
      setSelectionScope('none')
      setSelectedIds(new Set())
      return
    }
    setSelectionScope('page')
    setSelectedIds(new Set(materiales.map((m) => m.id)))
  }

  const toggleSelectAllDb = () => {
    if (selectionScope === 'all') {
      setSelectionScope('none')
      setSelectedIds(new Set())
      return
    }
    setSelectionScope('all')
    setSelectedIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectionScope === 'none') return

    const label =
      selectionScope === 'all'
        ? 'TODOS los productos de la base de datos (según tus permisos)'
        : `${selectedIds.size} producto(s) seleccionados de esta página`

    if (!confirm(`¿Estás seguro de eliminar ${label}?\n\nNota: los productos usados en cotizaciones no se eliminan.`)) {
      return
    }

    try {
      const payload =
        selectionScope === 'all'
          ? { scope: 'all' as const }
          : { scope: 'ids' as const, ids: Array.from(selectedIds) }

      const res = await fetch('/api/materiales/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; deleted?: number; skippedUsed?: number; error?: string }
        | null

      if (!res.ok || !json?.success) {
        alert(json?.error || 'No se pudo eliminar por lote')
        return
      }

      const deleted = Number(json.deleted ?? 0)
      const skippedUsed = Number(json.skippedUsed ?? 0)
      if (skippedUsed > 0) {
        alert(`Eliminados: ${deleted}.\nNo eliminados (usados en cotizaciones): ${skippedUsed}.`)
      }

      setSelectionScope('none')
      setSelectedIds(new Set())
      await fetchMateriales()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar productos')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = editingMaterial 
        ? `/api/materiales/${editingMaterial.id}`
        : '/api/materiales'
      
      const method = editingMaterial ? 'PUT' : 'POST'

      const { warehouseId, warehouseIds, stockScope, ...restForm } = formData
      const stockActualN = Number(restForm.stockActual)
      const effectiveWarehouseId = stockScope === 'warehouse' ? (warehouseId || defaultBodegaId || '') : ''

      if (stockScope === 'warehouse' && stockActualN > 0 && !effectiveWarehouseId) {
        alert('Selecciona una bodega para el stock inicial o cambia el alcance a Todas las sedes.')
        setIsSubmitting(false)
        return
      }

      if (stockScope === 'selectedSedes' && stockActualN > 0 && warehouseIds.length === 0) {
        alert('Agrega al menos una sede para el stock inicial o cambia el alcance a Todas las sedes.')
        setIsSubmitting(false)
        return
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...restForm,
          extraFields: Object.fromEntries(
            Object.entries(restForm.extraFields).filter(([, value]) => {
              if (typeof value === 'boolean') return true
              return String(value ?? '').trim().length > 0
            })
          ),
          stockScope,
          warehouseId: stockScope === 'warehouse' ? (effectiveWarehouseId || undefined) : undefined,
          warehouseIds: stockScope === 'selectedSedes' ? warehouseIds : undefined,
          quantityDiscounts: quantityDiscounts
            .map((d) => ({
              minQty: parseFloat(d.minQty),
              discountPct: parseFloat(d.discountPct),
            }))
            .filter((d) => Number.isFinite(d.minQty) && d.minQty > 0 && Number.isFinite(d.discountPct) && d.discountPct >= 0 && d.discountPct <= 100)
            .sort((a, b) => a.minQty - b.minQty)
        }),
      })

      const data = await response.json()

      if (data.success) {
        const materialId: string | null = String(data?.data?.id || editingMaterial?.id || '').trim() || null

        // Si el usuario seleccionó un archivo, lo subimos y guardamos imagenUrl.
        if (imageFile && materialId) {
          try {
            setIsUploadingImage(true)
            const fd = new FormData()
            fd.set('file', imageFile)
            const up = await fetch(`/api/materiales/${materialId}/imagen`, { method: 'POST', body: fd })
            const upJson = await up.json().catch(() => null)
            if (!up.ok || !upJson?.success) {
              alert(upJson?.error || 'No se pudo subir la imagen')
            }
          } finally {
            setIsUploadingImage(false)
          }
        }

        setIsModalOpen(false)
        resetForm()
        fetchMateriales()
      } else {
        const detail = String(data?.detail || '').trim()
        alert(`${data.error || 'Error al guardar producto'}${detail ? `\n\nDetalle: ${detail}` : ''}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar producto')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExternalIdChange = (value: string) => {
    const normalizedValue = value.replace(/[\r\n\t]+/g, '').trimStart()
    setFormData((prev) => ({ ...prev, externalId: normalizedValue }))
  }

  const handleDuplicate = (material: Material) => {
    setEditingMaterial(null)
    setQuantityDiscounts(
      (material.quantityDiscounts ?? []).map((d) => ({
        minQty: String(d.minQty),
        discountPct: String(d.discountPct),
      }))
    )

    setFormData({
      externalId: "",
      nombre: `${material.nombre} (copia)`,
      tipo: material.tipo,
      tipoNombre: material.tipoNombre ?? TIPOS_MATERIAL.find((item) => item.value === material.tipo)?.label ?? material.tipo,
      categoria: material.categoria ?? "",
      imagenUrl: material.imagenUrl ?? "",
      ancho: material.ancho?.toString() || "",
      largo: material.largo?.toString() || "",
      espesor: material.espesor?.toString() || "",
      color: material.color ?? "",
      precioM2: material.precioM2?.toString() || "",
      precioMetro: material.precioMetro?.toString() || "",
      precioUnidad: material.precioUnidad?.toString() || "",
      precioCompra: material.precioCompra?.toString() || "",
      stockActual: "0",
      stockMinimo: material.stockMinimo?.toString() || "0",
      unidadMedida: material.unidadMedida,
      ...buildWarehouseSelectionFromMaterial(material),
      proveedor: material.proveedor ?? "",
      observaciones: material.observaciones ?? "",
      extraFields: normalizeExtraFields(material.extraFields),
      requiresWorkOrder: Boolean(material.requiresWorkOrder),
      activo: material.activo,
    })
    setIsModalOpen(true)
  }

  const handleEdit = (material: Material) => {
    setEditingMaterial(material)
    const warehouseSelection = buildWarehouseSelectionFromMaterial(material)
    setFormData({
      externalId: material.externalId ?? "",
      nombre: material.nombre,
      tipo: material.tipo,
      tipoNombre: material.tipoNombre ?? TIPOS_MATERIAL.find((item) => item.value === material.tipo)?.label ?? material.tipo,
      categoria: material.categoria || "",
      imagenUrl: material.imagenUrl ?? "",
      ancho: material.ancho?.toString() || "",
      largo: material.largo?.toString() || "",
      espesor: material.espesor?.toString() || "",
      color: material.color || "",
      precioM2: material.precioM2?.toString() || "",
      precioMetro: material.precioMetro?.toString() || "",
      precioUnidad: material.precioUnidad?.toString() || "",
      precioCompra: material.precioCompra?.toString() || "",
      stockActual: material.stockActual.toString(),
      stockMinimo: material.stockMinimo.toString(),
      unidadMedida: material.unidadMedida,
      ...warehouseSelection,
      proveedor: material.proveedor || "",
      observaciones: material.observaciones || "",
      extraFields: normalizeExtraFields(material.extraFields),
      requiresWorkOrder: Boolean(material.requiresWorkOrder),
      activo: material.activo
    })

    setQuantityDiscounts(
      (material.quantityDiscounts ?? [])
        .slice()
        .sort((a, b) => a.minQty - b.minQty)
        .map((d) => ({ minQty: d.minQty.toString(), discountPct: d.discountPct.toString() }))
    )
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return

    try {
      const response = await fetch(`/api/materiales/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        fetchMateriales()
      } else {
        alert(data.error || 'Error al eliminar producto')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar producto')
    }
  }

  const resetForm = () => {
    setEditingMaterial(null)
    setImageFile(null)
    setImageFileError("")
    setProveedorMatches([])
    setProveedorLoading(false)
    setProveedorCreateOpen(false)
    setProveedorNuevoNombre("")
    setProveedorNuevoNit("")
    setProveedorCreateSaving(false)
    setProveedorError("")
    setFormData({
      externalId: "",
      nombre: "",
      tipo: "VINILO",
      tipoNombre: "Vinilo",
      categoria: "",
      imagenUrl: "",
      ancho: "",
      largo: "",
      espesor: "",
      color: "",
      precioM2: "",
      precioMetro: "",
      precioUnidad: "",
      precioCompra: "",
      stockActual: "0",
      stockMinimo: "0",
      unidadMedida: "m2",
      warehouseId: defaultBodegaId,
      warehouseIds: defaultBodegaId ? [defaultBodegaId] : [],
      stockScope: 'warehouse',
      proveedor: "",
      observaciones: "",
      extraFields: {},
      requiresWorkOrder: false,
      activo: true
    })

    setQuantityDiscounts([])
  }

  const uploadImageForEditingMaterial = async () => {
    if (!editingMaterial?.id) {
      alert('Primero guarda el producto para poder subir imagen.')
      return
    }
    if (!imageFile) {
      alert('Selecciona una imagen.')
      return
    }
    if (imageFileError) {
      alert(imageFileError)
      return
    }

    setIsUploadingImage(true)
    try {
      const fd = new FormData()
      fd.set('file', imageFile)
      const up = await fetch(`/api/materiales/${editingMaterial.id}/imagen`, { method: 'POST', body: fd })
      const upJson = await up.json().catch(() => null)
      if (!up.ok || !upJson?.success) {
        const detail = String(upJson?.detail || '').trim()
        alert(`${upJson?.error || 'No se pudo subir la imagen'}${detail ? `\n${detail}` : ''}`)
        return
      }
      const nextUrl = String(upJson?.data?.imagenUrl || '').trim()
      if (nextUrl) {
        setFormData((p) => ({ ...p, imagenUrl: nextUrl }))
      }
      setImageFile(null)
      setImageFileError("")
      await fetchMateriales()
    } finally {
      setIsUploadingImage(false)
    }
  }

  const addDiscountTier = () => {
    setQuantityDiscounts((prev) => [...prev, { minQty: "", discountPct: "" }])
  }

  const updateDiscountTier = (idx: number, patch: Partial<{ minQty: string; discountPct: string }>) => {
    setQuantityDiscounts((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }

  const removeDiscountTier = (idx: number) => {
    setQuantityDiscounts((prev) => prev.filter((_, i) => i !== idx))
  }

  const getPrecioDisplay = (material: Material) => {
    if (material.precioM2) return `${formatCurrency(material.precioM2)}/m²`
    if (material.precioMetro) return `${formatCurrency(material.precioMetro)}/ml`
    if (material.precioUnidad) return `${formatCurrency(material.precioUnidad)}/und`
    return 'Sin precio'
  }

  const getMaterialSpecs = useCallback((material: Material) => {
    const specs: string[] = []

    if (material.unidadMedida === 'm2') {
      if (material.ancho) specs.push(`Ancho ${material.ancho}cm`)
      if (material.largo) specs.push(`Alto ${material.largo}cm`)
    } else {
      if (material.ancho) specs.push(`Ancho ${material.ancho}cm`)
      if (material.largo) specs.push(`Largo ${material.largo}${material.unidadMedida === 'ml' ? 'ml' : 'cm'}`)
    }

    if (material.color) specs.push(`Color ${material.color}`)
    return specs.join(" • ")
  }, [])

  const renderPaginationBar = (position: 'top' | 'bottom') => (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${position === 'top' ? 'border-b' : 'border-t'}`}>
      <div className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{materiales.length}</span> de{' '}
        <span className="font-medium text-foreground">{totalRows}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DataViewToggle mode={dataViewMode} onChange={setDataViewMode} />
        <div className="text-sm text-muted-foreground">Mostrar</div>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const v = e.target.value
            const next = v === 'all' ? 'all' : (Number(v) as PageSizeOption)
            setPageSize(next)
            setPage(1)
          }}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          aria-label={`Productos por página (${position})`}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
          <option value="all">Todos</option>
        </select>

        {pageSize !== 'all' ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 px-3"
            >
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              Página <span className="font-medium text-foreground">{page}</span> /{' '}
              <span className="font-medium text-foreground">{pageCount}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="h-8 px-3"
            >
              Siguiente
            </Button>
          </div>
        ) : null}

        {canManageProducts ? <Button
          variant="outline"
          size="sm"
          onClick={toggleSelectPage}
          className="h-8 px-3"
        >
          {selectionScope === 'page' && selectedIds.size === materiales.length
            ? 'Quitar selección (página)'
            : 'Seleccionar página'}
        </Button> : null}
        {canManageProducts ? <Button
          variant="outline"
          size="sm"
          onClick={toggleSelectAllDb}
          className="h-8 px-3"
        >
          {selectionScope === 'all' ? 'Quitar selección (BD)' : 'Seleccionar todos (BD)'}
        </Button> : null}
        {canManageProducts ? <Button
          variant="outline"
          size="sm"
          onClick={() => void handleBulkDelete()}
          disabled={selectionScope === 'none' || (selectionScope === 'page' && selectedIds.size === 0)}
          className="h-8 px-3 text-red-600"
        >
          Eliminar seleccionados{selectedCount ? ` (${selectedCount})` : ''}
        </Button> : null}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <CustomProductRequestsAdminDialog open={customRequestsOpen} onOpenChange={setCustomRequestsOpen} />
      <CustomProductRequestsMyDialog open={myCustomRequestsOpen} onOpenChange={setMyCustomRequestsOpen} />
      <ProductConfigDialog
        open={productConfigOpen}
        onOpenChange={setProductConfigOpen}
        baseTypeOptions={baseTypeOptions}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        customFieldDefinitions={customFieldDefinitions}
        onRefresh={fetchConfiguracion}
      />
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Inventario', href: '/dashboard/inventario' },
          { label: 'Productos' },
        ]}
        title={<span data-tour="materiales-title">Productos</span>}
        description="Catálogo y precios del módulo de inventario."
        actions={
          <>
            {isAdmin ? (
              <Button variant="outline" type="button" onClick={() => setCustomRequestsOpen(true)}>
                Solicitudes de personalizados
              </Button>
            ) : null}
            {canManageProducts ? <span data-tour="materiales-import">
              <ImportDialog
                module="materiales"
                title="Importar productos"
                onSuccess={async () => {
                  await fetchMateriales()
                }}
              />
            </span> : null}
            {canManageProducts ? <Button variant="outline" onClick={() => setIsExportOpen(true)}>
              Exportar Excel
            </Button> : null}
            {canManageProducts ? <Button variant="outline" type="button" onClick={() => setProductConfigOpen(true)}>
              Configurar catálogos
            </Button> : null}
            {canManageProducts ? <Button onClick={() => { resetForm(); setIsModalOpen(true) }} data-tour="materiales-new">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Producto
            </Button> : null}
          </>
        }
      />

      <CatalogModuleTabs />

      {/* Modal de exportación */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Exportar productos</DialogTitle>
            <DialogDescription>Aplica un periodo o un rango para la descarga.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label>Sede</Label>
                  <select
                    value={sedeFiltro}
                    onChange={(e) => setSedeFiltro(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Sede activa</option>
                    <Button variant="outline" type="button" onClick={() => setMyCustomRequestsOpen(true)}>
                      Mis solicitudes
                    </Button>
                    {sedes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}{s.codigo ? ` (${s.codigo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Bodega</Label>
                  <select
                    value={bodegaFiltro}
                    onChange={(e) => setBodegaFiltro(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Todas las bodegas</option>
                    {bodegasFiltroList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {formatBodegaLabel(b)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Periodo</Label>
                <select
                  value={exportPeriodo}
                  onChange={(e) => applyExportPeriod(e.target.value as ('' | 'day' | 'week' | 'month' | 'quarter'))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Sin periodo</option>
                  <option value="day">1 día</option>
                  <option value="week">1 semana</option>
                  <option value="month">1 mes</option>
                  <option value="quarter">Trimestral</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label>Creado desde</Label>
                  <Input
                    type="date"
                    value={createdFromFiltro}
                    onChange={(e) => {
                      setExportPeriodo('')
                      setCreatedFromFiltro(e.target.value)
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Creado hasta</Label>
                  <Input
                    type="date"
                    value={createdToFiltro}
                    onChange={(e) => {
                      setExportPeriodo('')
                      setCreatedToFiltro(e.target.value)
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label>Precio min</Label>
                  <Input
                    placeholder="Precio min"
                    value={precioMinFiltro}
                    onChange={(e) => setPrecioMinFiltro(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Precio max</Label>
                  <Input
                    placeholder="Precio max"
                    value={precioMaxFiltro}
                    onChange={(e) => setPrecioMaxFiltro(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label>Stock min</Label>
                  <Input
                    placeholder="Stock min"
                    value={stockMinFiltro}
                    onChange={(e) => setStockMinFiltro(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Stock max</Label>
                  <Input
                    placeholder="Stock max"
                    value={stockMaxFiltro}
                    onChange={(e) => setStockMaxFiltro(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Categoría</Label>
                <Input
                  list="export-categorias-sugeridas"
                  placeholder="Categoría"
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                />
                <datalist id="export-categorias-sugeridas">
                  {availableCategoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsExportOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                exportExcel()
                setIsExportOpen(false)
              }}
            >
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[240px]">
                <Input
                  data-tour="materiales-search"
                  placeholder="Buscar por nombre o código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Todos los tipos</option>
                {TIPOS_MATERIAL.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>

              <select
                value={unidadFiltro}
                onChange={(e) => setUnidadFiltro(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Todas las unidades</option>
                {UNIDADES_MEDIDA.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={sortFiltro}
                onChange={(e) => setSortFiltro(e.target.value as typeof sortFiltro)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="nameAsc">Orden: Nombre</option>
                <option value="mostSold">Más vendido</option>
                <option value="mostQuoted">Más cotizado</option>
                <option value="stockDesc">Mayor stock</option>
                <option value="createdDesc">Más reciente</option>
                <option value="createdAsc">Más antiguo</option>
                <option value="priceDesc">Mayor precio</option>
                <option value="priceAsc">Menor precio</option>
              </select>

              <select
                value={sedeFiltro}
                onChange={(e) => setSedeFiltro(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Sede: activa</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}{s.codigo ? ` (${s.codigo})` : ''}
                  </option>
                ))}
              </select>

              <select
                value={bodegaFiltro}
                onChange={(e) => setBodegaFiltro(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Todas las bodegas</option>
                {bodegasFiltroList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {formatBodegaLabel(b)}
                  </option>
                ))}
              </select>

              <Input
                placeholder="Proveedor"
                value={proveedorFiltro}
                onChange={(e) => setProveedorFiltro(e.target.value)}
                className="h-9 w-[180px]"
              />

              <Input
                placeholder="Categoría"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="h-9 w-[180px]"
              />

              <select
                value={descuentoFiltro}
                onChange={(e) => setDescuentoFiltro(e.target.value as typeof descuentoFiltro)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="all">Descuento: Todos</option>
                <option value="true">Con descuento</option>
                <option value="false">Sin descuento</option>
              </select>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Precio min"
                  value={precioMinFiltro}
                  onChange={(e) => setPrecioMinFiltro(e.target.value)}
                  className="h-9 w-[110px]"
                  inputMode="decimal"
                />
                <Input
                  placeholder="Precio max"
                  value={precioMaxFiltro}
                  onChange={(e) => setPrecioMaxFiltro(e.target.value)}
                  className="h-9 w-[110px]"
                  inputMode="decimal"
                />
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Stock min"
                  value={stockMinFiltro}
                  onChange={(e) => setStockMinFiltro(e.target.value)}
                  className="h-9 w-[110px]"
                  inputMode="decimal"
                />
                <Input
                  placeholder="Stock max"
                  value={stockMaxFiltro}
                  onChange={(e) => setStockMaxFiltro(e.target.value)}
                  className="h-9 w-[110px]"
                  inputMode="decimal"
                />
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={createdFromFiltro}
                  onChange={(e) => setCreatedFromFiltro(e.target.value)}
                  className="h-9"
                />
                <Input
                  type="date"
                  value={createdToFiltro}
                  onChange={(e) => setCreatedToFiltro(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos (compacta) */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : materiales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay productos registrados</p>
              {canManageProducts ? <Button onClick={() => { resetForm(); setIsModalOpen(true) }} className="mt-4">
                Crear primer producto
              </Button> : null}
            </div>
          ) : (
            <div>
              {renderPaginationBar('top')}

              {dataViewMode === 'grid' ? (
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {materiales.map((material) => {
                const tipoLabel = TIPOS_MATERIAL.find((t) => t.value === material.tipo)?.label || material.tipo
                const tipoComercial = String(material.tipoNombre ?? '').trim()
                const externalIdTrim = String(material.externalId ?? '').trim()
                const materialNombreView = externalIdTrim ? `(${externalIdTrim}) ${material.nombre}` : material.nombre
                const specs = getMaterialSpecs(material)

                const wh = material.stocks?.[0]?.warehouse ?? null
                const stockForView = bodegaFiltro ? (material.stocks?.[0]?.quantity ?? 0) : material.stockActual

                const isChecked = selectionScope === 'all' ? true : selectedIds.has(material.id)
                const isDisabled = selectionScope === 'all'

                return (
                  <Card key={material.id} className={`${!material.activo ? 'opacity-60' : ''} rounded-2xl border bg-white shadow-sm`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {canManageProducts ? <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={() => toggleSelectId(material.id)}
                              className="h-4 w-4 rounded border border-input"
                              aria-label={`Seleccionar ${material.nombre}`}
                            /> : null}
                            <img
                              src={material.imagenUrl || "/placeholder-product.svg"}
                              alt={material.nombre}
                              className="h-10 w-10 rounded border object-cover bg-white cursor-zoom-in"
                              onClick={() => setPreviewUrl((material.imagenUrl || "/placeholder-product.svg").trim() || null)}
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-product.svg"
                              }}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">{materialNombreView}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {tipoComercial || tipoLabel}
                                {tipoComercial && tipoComercial !== tipoLabel ? ` · Base: ${tipoLabel}` : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                        {!material.activo ? (
                          <span className="px-2 py-0.5 text-[10px] border rounded bg-muted">Inactivo</span>
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-2 text-sm">
                        <div className="text-xs text-muted-foreground">{material.categoria ? `${material.categoria}${specs ? ` • ${specs}` : ''}` : specs || 'Sin especificaciones'}</div>
                        <div className="font-semibold text-blue-600">{getPrecioDisplay(material)}</div>
                        <div className={`text-xs ${stockForView <= material.stockMinimo ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
                          Stock: {stockForView} {formatUnidadMedidaLabel(material.unidadMedida)}
                        </div>
                        <div className="text-xs text-muted-foreground">Bodega: {wh ? `${wh.nombre}${wh.isDefault ? ' (Principal)' : ''}` : '—'}</div>
                      </div>

                      {canManageProducts ? <div className="mt-4 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(material)}
                          className="h-8 px-3"
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(material)}
                          className="h-8 px-3"
                        >
                          Duplicar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(material.id)}
                          className="h-8 px-3 text-red-600"
                        >
                          Eliminar
                        </Button>
                      </div> : null}
                    </CardContent>
                  </Card>
                )
              })}
              </div>
              ) : (
              <div className="divide-y">
                {materiales.map((material) => {
                const tipoLabel = TIPOS_MATERIAL.find((t) => t.value === material.tipo)?.label || material.tipo
                const tipoComercial = String(material.tipoNombre ?? '').trim()
                const externalIdTrim = String(material.externalId ?? '').trim()
                const materialNombreView = externalIdTrim ? `(${externalIdTrim}) ${material.nombre}` : material.nombre
                const specs = getMaterialSpecs(material)

                const wh = material.stocks?.[0]?.warehouse ?? null
                const stockForView = bodegaFiltro ? (material.stocks?.[0]?.quantity ?? 0) : material.stockActual

                const isChecked = selectionScope === 'all' ? true : selectedIds.has(material.id)
                const isDisabled = selectionScope === 'all'

                return (
                  <div key={material.id} className={`px-4 py-3 ${!material.activo ? "opacity-60" : ""}`}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {canManageProducts ? <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => toggleSelectId(material.id)}
                            className="h-4 w-4 rounded border border-input"
                            aria-label={`Seleccionar ${material.nombre}`}
                          /> : null}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={material.imagenUrl || "/placeholder-product.svg"}
                            alt={material.nombre}
                            className="h-8 w-8 rounded border object-cover bg-white cursor-zoom-in"
                            onClick={() => setPreviewUrl((material.imagenUrl || "/placeholder-product.svg").trim() || null)}
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-product.svg"
                            }}
                          />
                          <div className="font-medium truncate">{materialNombreView}</div>
                          {!material.activo ? (
                            <span className="px-2 py-0.5 text-[10px] border rounded bg-muted">Inactivo</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {tipoComercial || tipoLabel}
                          {tipoComercial && tipoComercial !== tipoLabel ? ` · Base: ${tipoLabel}` : ""}
                          {material.categoria ? ` • ${material.categoria}` : ""}
                          {specs ? ` • ${specs}` : ""}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end md:gap-4">
                        <div className="flex items-center justify-between gap-4 md:justify-end">
                          <div className="text-sm font-semibold text-blue-600 whitespace-nowrap">
                            {getPrecioDisplay(material)}
                          </div>
                          <div
                            className={`text-xs whitespace-nowrap ${stockForView <= material.stockMinimo ? "text-red-600 font-medium" : "text-muted-foreground"}`}
                          >
                            Stock: {stockForView} {formatUnidadMedidaLabel(material.unidadMedida)}
                          </div>
                          <div className="text-xs whitespace-nowrap text-muted-foreground">
                            Bodega: {wh ? `${wh.nombre}${wh.isDefault ? ' (Principal)' : ''}` : '—'}
                          </div>
                        </div>

                        {canManageProducts ? <div className="md:hidden">
                          <MobileActionsMenu label={material.nombre}>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={(e) => {
                              e.preventDefault();
                              handleEdit(material);
                            }}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => {
                              e.preventDefault();
                              handleDuplicate(material);
                            }}>
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={(e) => {
                              e.preventDefault();
                              handleDelete(material.id);
                            }}>
                              Eliminar
                            </DropdownMenuItem>
                          </MobileActionsMenu>
                        </div> : null}

                        {canManageProducts ? <div className="hidden gap-2 md:flex md:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(material)}
                            className="h-8 px-3"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicate(material)}
                            className="h-8 px-3"
                          >
                            Duplicar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(material.id)}
                            className="h-8 px-3 text-red-600"
                          >
                            Eliminar
                          </Button>
                        </div> : null}
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
              )}
              {renderPaginationBar('bottom')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMaterial ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial 
                ? 'Actualiza la información del producto'
                : 'Completa los datos del nuevo producto'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Código/ID externo */}
              <div className="col-span-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="externalId">Código QR / barras / ID externo</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      externalIdInputRef.current?.focus()
                      externalIdInputRef.current?.select()
                    }}
                  >
                    Capturar con escáner
                  </Button>
                </div>
                <Input
                  ref={externalIdInputRef}
                  id="externalId"
                  value={formData.externalId}
                  onChange={(e) => handleExternalIdChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    nombreInputRef.current?.focus()
                  }}
                  placeholder="Escanea aquí o escribe: 12345 / SKU-001"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Deja este campo activo y usa el lector en modo teclado. Si el escáner envía Enter al final, el foco pasa al nombre del producto.
                </p>
              </div>

              {/* Nombre */}
              <div className="col-span-2">
                <Label htmlFor="nombre">Nombre del Producto *</Label>
                <Input
                  ref={nombreInputRef}
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  placeholder="Ej: Vinilo Adhesivo Blanco 3M"
                />
              </div>

              {/* Tipo de producto (metraje vs físico) */}
              <div className="col-span-2">
                <Label htmlFor="tipoProducto">Tipo de producto *</Label>
                <select
                  id="tipoProducto"
                  value={tipoProducto}
                  onChange={(e) => setTipoProducto(e.target.value as 'METRAJE' | 'FISICO')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  required
                >
                  <option value="METRAJE">Material por metraje (m² / ml)</option>
                  <option value="FISICO">Producto físico (por unidad)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Si es mug/llavero/esfero/botilito elige “Producto físico”.
                </p>
              </div>

              {/* Tipo */}
              <div>
                <Label htmlFor="tipoNombre">Tipo comercial *</Label>
                <select
                  id="tipoNombre"
                  value={formData.tipoNombre}
                  onChange={(e) => {
                    const next = e.target.value
                    const match = availableTypeOptions.find((option) => option.value === next)
                    setFormData({
                      ...formData,
                      tipoNombre: next,
                      tipo: match?.baseTipo ?? formData.tipo,
                    })
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  required
                >
                  {availableTypeOptions.map((tipo) => (
                    <option key={`${tipo.source}-${tipo.value}`} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Este es el nombre visible del producto dentro del catálogo.
                </p>
              </div>

              <div>
                <Label htmlFor="tipo">Tipo técnico *</Label>
                <select
                  id="tipo"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  required
                >
                  {TIPOS_MATERIAL.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Esto es el material base (vinilo, lona, papel, etc.).
                </p>
              </div>

              {/* Categoría */}
              <div>
                <Label htmlFor="categoria">Categoría</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ej: Merchandising"
                  list="categoria-sugeridas"
                />
                <datalist id="categoria-sugeridas">
                  {availableCategoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Imagen */}
              <div className="col-span-2">
                <Label>Imagen</Label>
                {formData.imagenUrl ? (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.imagenUrl}
                      alt="Vista previa"
                      className="h-20 w-20 rounded border object-contain bg-white cursor-zoom-in"
                      onClick={() => setPreviewUrl(formData.imagenUrl || null)}
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-product.svg"
                      }}
                    />
                  </div>
                ) : null}

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      if (!f) {
                        setImageFile(null)
                        setImageFileError("")
                        return
                      }

                      const allowed = f.type === 'image/jpeg' || f.type === 'image/png'
                      if (!allowed) {
                        setImageFile(null)
                        setImageFileError('Formato no permitido. Usa JPG o PNG.')
                        return
                      }

                      const maxBytes = 256 * 1024
                      if (Number.isFinite(f.size) && f.size > maxBytes) {
                        setImageFile(null)
                        setImageFileError('Imagen demasiado grande (máx 256KB).')
                        return
                      }

                      setImageFileError("")
                      setImageFile(f)
                    }}
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploadingImage || !imageFile || !editingMaterial}
                    onClick={() => void uploadImageForEditingMaterial()}
                  >
                    {isUploadingImage ? 'Subiendo…' : 'Subir imagen'}
                  </Button>
                  <p className={"text-xs mt-1 " + (imageFileError ? "text-red-600" : "text-muted-foreground")}>
                    {imageFileError || 'Solo JPG o PNG (máx 256KB). Se sube al guardar/editar.'}
                  </p>
                  {!editingMaterial ? (
                    <p className="text-xs text-muted-foreground">
                      Tip: si es un producto nuevo, primero guárdalo y luego sube la imagen.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Especificaciones */}
              {tipoProducto === 'METRAJE' ? (
                <>
                  <div>
                    <Label htmlFor="ancho">Ancho base {unidadCobro === 'm2' ? '(cm)' : '(cm opcional)'}</Label>
                    <Input
                      id="ancho"
                      type="number"
                      step="0.01"
                      value={formData.ancho}
                      onChange={(e) => setFormData({ ...formData, ancho: e.target.value })}
                      placeholder="137"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {unidadCobro === 'm2'
                        ? 'Úsalo junto con el alto base para que el cotizador respete la tarifa mínima o exacta del tamaño cargado.'
                        : 'Opcional para materiales cobrados por metro lineal.'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="largo">{unidadCobro === 'm2' ? 'Alto base (cm)' : 'Largo base (ml)'}</Label>
                    <Input
                      id="largo"
                      type="number"
                      step="0.01"
                      value={formData.largo}
                      onChange={(e) => setFormData({ ...formData, largo: e.target.value })}
                      placeholder={unidadCobro === 'm2' ? '250' : '1'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {unidadCobro === 'm2'
                        ? 'Este campo se usa como alto en el cotizador por metraje.'
                        : 'Si lo defines, el cotizador por metro lineal lo toma como largo sugerido por unidad.'}
                    </p>
                  </div>
                </>
              ) : null}

              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Blanco, Negro, Transparente..."
                />
              </div>

              {/* Precios */}
              <div className="col-span-2 border-t pt-4">
                <h4 className="font-medium mb-3">Precios de Venta</h4>
                <p className="text-sm text-muted-foreground">
                  La unidad de cobro controla cómo se cotiza: por m², por metro lineal o por unidad.
                </p>
              </div>

              {unidadCobro === 'm2' && (
                <div>
                  <Label htmlFor="precioM2">Precio por m²</Label>
                  <Input
                    id="precioM2"
                    type="number"
                    step="0.01"
                    value={formData.precioM2}
                    onChange={(e) => setFormData({ ...formData, precioM2: e.target.value })}
                    placeholder="25000"
                  />
                </div>
              )}

              {unidadCobro === 'ml' && (
                <div>
                  <Label htmlFor="precioMetro">Precio por Metro Lineal</Label>
                  <Input
                    id="precioMetro"
                    type="number"
                    step="0.01"
                    value={formData.precioMetro}
                    onChange={(e) => setFormData({ ...formData, precioMetro: e.target.value })}
                    placeholder="15000"
                  />
                </div>
              )}

              {unidadCobro === 'unidad' && (
                <div>
                  <Label htmlFor="precioUnidad">Precio por Unidad</Label>
                  <Input
                    id="precioUnidad"
                    type="number"
                    step="0.01"
                    value={formData.precioUnidad}
                    onChange={(e) => setFormData({ ...formData, precioUnidad: e.target.value })}
                    placeholder="5000"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="precioCompra">Precio de Compra</Label>
                <Input
                  id="precioCompra"
                  type="number"
                  step="0.01"
                  value={formData.precioCompra}
                  onChange={(e) => setFormData({ ...formData, precioCompra: e.target.value })}
                  placeholder="12000"
                />
              </div>

              {/* Descuentos por cantidad */}
              <div className="col-span-2 border-t pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-medium">Descuentos por cantidad</h4>
                    <p className="text-sm text-muted-foreground">
                      Se aplica el mayor descuento cuyo mínimo cumpla la cantidad.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addDiscountTier}>
                    Agregar
                  </Button>
                </div>

                {quantityDiscounts.length === 0 ? (
                  <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Sin descuentos configurados.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {quantityDiscounts.map((tier, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Label className="text-xs">Mín. cantidad</Label>
                          <Input
                            type="number"
                            step="1"
                            value={tier.minQty}
                            onChange={(e) => updateDiscountTier(idx, { minQty: e.target.value })}
                            placeholder="Ej: 10"
                          />
                        </div>
                        <div className="col-span-5">
                          <Label className="text-xs">% descuento</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={tier.discountPct}
                            onChange={(e) => updateDiscountTier(idx, { discountPct: e.target.value })}
                            placeholder="Ej: 5"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <Button type="button" variant="outline" size="sm" onClick={() => removeDiscountTier(idx)}>
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inventario */}
              <div className="col-span-2 border-t pt-4">
                <h4 className="font-medium mb-3">Inventario</h4>
              </div>

              {tipoProducto === 'METRAJE' ? (
                <div>
                  <Label htmlFor="unidadMedida">Se cobra por *</Label>
                  <select
                    id="unidadMedida"
                    value={formData.unidadMedida}
                    onChange={(e) => {
                      const next = e.target.value
                      setFormData((prev) => ({
                        ...prev,
                        unidadMedida: next,
                        precioM2: next === 'm2' ? prev.precioM2 : '',
                        precioMetro: next === 'ml' ? prev.precioMetro : '',
                        precioUnidad: '',
                      }))
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    required
                  >
                    {UNIDADES_MEDIDA.filter((u) => u.value !== 'unidad').map((unidad) => (
                      <option key={unidad.value} value={unidad.value}>{unidad.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label>Unidad de cobro</Label>
                  <div className="h-9 flex items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    Unidad
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este producto se cotiza por unidad.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="stockActual">Stock Actual</Label>
                <Input
                  id="stockActual"
                  type="number"
                  step={tipoProducto === 'FISICO' ? "1" : "0.01"}
                  value={formData.stockActual}
                  onChange={(e) => setFormData({ ...formData, stockActual: e.target.value })}
                  placeholder="100"
                />
              </div>

              <div>
                <Label>Aplicar stock a</Label>
                <select
                  value={formData.stockScope}
                  onChange={(e) => {
                    const nextScope = e.target.value as 'warehouse' | 'selectedSedes' | 'allSedes'
                    setFormData((p) => ({
                      ...p,
                      stockScope: nextScope,
                      warehouseIds: nextScope === 'selectedSedes'
                        ? (p.warehouseIds.length ? p.warehouseIds : p.warehouseId ? [p.warehouseId] : [])
                        : p.warehouseIds,
                      warehouseId: nextScope === 'warehouse'
                        ? (p.warehouseId || p.warehouseIds[0] || defaultBodegaId || '')
                        : p.warehouseId,
                    }))
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="warehouse">Esta bodega (solo una sede)</option>
                  <option value="selectedSedes">Varias sedes (una a una)</option>
                  <option value="allSedes">Todas las sedes (duplica en bodega principal)</option>
                </select>
              </div>

              {formData.stockScope === 'warehouse' ? (
                <div>
                  <Label>Bodega / Sede</Label>
                  {bodegas.length > 0 ? (
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      required
                    >
                      <option value="">Selecciona una sede…</option>
                      {sedeWarehouseOptions.map((option) => (
                        <option key={option.sedeId} value={option.warehouseId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-9 flex items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                      Sin bodegas
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    El stock quedará registrado en la bodega principal de la sede seleccionada.
                  </p>
                </div>
              ) : formData.stockScope === 'selectedSedes' ? (
                <div className="col-span-2 space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                  <div>
                    <Label>Agregar sede</Label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={formData.warehouseId}
                        onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="">Selecciona una sede…</option>
                        {sedeWarehouseOptions.map((option) => (
                          <option key={option.sedeId} value={option.warehouseId} disabled={formData.warehouseIds.includes(option.warehouseId)}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormData((prev) => {
                          if (!prev.warehouseId || prev.warehouseIds.includes(prev.warehouseId)) return prev
                          return { ...prev, warehouseIds: [...prev.warehouseIds, prev.warehouseId] }
                        })}
                      >
                        Agregar sede
                      </Button>
                    </div>
                  </div>

                  {selectedWarehouseOptions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedWarehouseOptions.map((option) => (
                        <div key={option.warehouseId} className="flex items-center gap-2 rounded-full border border-sky-200 bg-background px-3 py-1 text-xs text-sky-700">
                          <span>{option.label}</span>
                          <button
                            type="button"
                            className="font-semibold text-sky-700"
                            onClick={() => setFormData((prev) => ({ ...prev, warehouseIds: prev.warehouseIds.filter((id) => id !== option.warehouseId) }))}
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Agrega una sede y luego puedes seguir sumando más una a una.
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    El mismo stock inicial se aplicará en la bodega principal de cada sede seleccionada.
                  </p>
                </div>
              ) : (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mt-1">
                    Se asignará el mismo stock en la bodega principal de cada sede.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="stockMinimo">Stock Mínimo</Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  step={tipoProducto === 'FISICO' ? "1" : "0.01"}
                  value={formData.stockMinimo}
                  onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                  placeholder="10"
                />
              </div>

              <div>
                <Label htmlFor="proveedor">Proveedor (opcional)</Label>
                <Input
                  id="proveedor"
                  value={formData.proveedor}
                  onChange={(e) => {
                    setFormData({ ...formData, proveedor: e.target.value })
                    setProveedorCreateOpen(false)
                    setProveedorError("")
                  }}
                  placeholder="Busca o escribe el nombre del proveedor"
                />

                {proveedorLoading ? (
                  <div className="mt-1 text-xs text-muted-foreground">Buscando proveedores…</div>
                ) : null}

                {!proveedorCreateOpen && proveedorMatches.length > 0 ? (
                  <div className="mt-2 rounded-md border border-input bg-background p-1">
                    {proveedorMatches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left rounded-sm px-2 py-1 text-sm hover:bg-muted"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, proveedor: p.nombre }))
                          setProveedorMatches([])
                        }}
                        title={p.nit ? `${p.nombre} · ${p.nit}` : p.nombre}
                      >
                        <div className="font-medium">{p.nombre}</div>
                        {p.nit ? <div className="text-xs text-muted-foreground">{p.nit}</div> : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                {!proveedorCreateOpen ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setProveedorCreateOpen(true)
                        setProveedorError("")
                        setProveedorNuevoNombre(String(formData.proveedor || '').trim())
                        setProveedorNuevoNit("")
                      }}
                    >
                      Crear proveedor nuevo
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-input p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input value={proveedorNuevoNombre} onChange={(e) => setProveedorNuevoNombre(e.target.value)} disabled={proveedorCreateSaving} />
                      </div>
                      <div className="space-y-2">
                        <Label>NIT (opcional)</Label>
                        <Input value={proveedorNuevoNit} onChange={(e) => setProveedorNuevoNit(e.target.value)} disabled={proveedorCreateSaving} />
                      </div>
                    </div>

                    {proveedorError ? <div className="text-sm text-red-600">{proveedorError}</div> : null}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setProveedorCreateOpen(false)
                          setProveedorError("")
                        }}
                        disabled={proveedorCreateSaving}
                      >
                        Cancelar
                      </Button>
                      <Button type="button" onClick={createProveedor} disabled={proveedorCreateSaving}>
                        {proveedorCreateSaving ? 'Creando…' : 'Crear'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {customFieldDefinitions.length > 0 ? (
                <div className="col-span-2 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-medium">Campos extra</h4>
                      <p className="text-sm text-muted-foreground">
                        Campos configurables para ampliar la ficha del producto.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setProductConfigOpen(true)}>
                      Administrar campos
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {customFieldDefinitions.map((field) => {
                      const value = formData.extraFields[field.key]
                      const options = parseFieldOptions(field)
                      const commonHelp = field.helpText ? (
                        <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Tipo: {CUSTOM_FIELD_TYPE_LABELS[field.fieldType]}</p>
                      )

                      if (field.fieldType === 'BOOLEAN') {
                        return (
                          <div key={field.id} className="col-span-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    extraFields: {
                                      ...prev.extraFields,
                                      [field.key]: e.target.checked,
                                    },
                                  }))
                                }
                              />
                              <span>{field.label}{field.required ? ' *' : ''}</span>
                            </label>
                            {commonHelp}
                          </div>
                        )
                      }

                      if (options.length > 0) {
                        return (
                          <div key={field.id}>
                            <Label htmlFor={`extra-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                            <select
                              id={`extra-${field.key}`}
                              value={String(value ?? '')}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  extraFields: {
                                    ...prev.extraFields,
                                    [field.key]: e.target.value,
                                  },
                                }))
                              }
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                              required={field.required}
                            >
                              <option value="">Selecciona una opción</option>
                              {options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            {commonHelp}
                          </div>
                        )
                      }

                      if (field.fieldType === 'LONG_TEXT') {
                        return (
                          <div key={field.id} className="col-span-2">
                            <Label htmlFor={`extra-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                            <Textarea
                              id={`extra-${field.key}`}
                              value={String(value ?? '')}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  extraFields: {
                                    ...prev.extraFields,
                                    [field.key]: e.target.value,
                                  },
                                }))
                              }
                              rows={3}
                              required={field.required}
                            />
                            {commonHelp}
                          </div>
                        )
                      }

                      return (
                        <div key={field.id}>
                          <Label htmlFor={`extra-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                          <Input
                            id={`extra-${field.key}`}
                            type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
                            step={field.fieldType === 'NUMBER' ? '0.01' : undefined}
                            value={String(value ?? '')}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                extraFields: {
                                  ...prev.extraFields,
                                  [field.key]: e.target.value,
                                },
                              }))
                            }
                            required={field.required}
                          />
                          {commonHelp}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Observaciones */}
              <div className="col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Notas adicionales sobre el producto..."
                  rows={3}
                />
              </div>

              {/* Estado */}
              <div className="col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresWorkOrder}
                    onChange={(e) => setFormData({ ...formData, requiresWorkOrder: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Este producto requiere orden de trabajo automática</span>
                </label>
              </div>

              <div className="col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Producto activo (disponible para cotizaciones)</span>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? 'Guardando...' 
                  : editingMaterial 
                    ? 'Actualizar' 
                    : 'Crear Producto'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) setPreviewUrl(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
            <DialogDescription>Imagen del producto</DialogDescription>
          </DialogHeader>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview" className="w-full max-h-[70vh] object-contain rounded border bg-white" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
