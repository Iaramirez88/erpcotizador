/**
 * Página de Inventario (MVP)
 * Permite registrar entradas/salidas/ajustes sobre materiales (productos ofrecidos).
 */

"use client"

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CatalogModuleTabs } from "@/components/inventory/catalog-module-tabs"
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
import { ErpPageHero } from "@/components/dashboard/erp-page-chrome"
import { useCurrentUserAccess } from '@/hooks/use-current-user-access'
import { cn, formatUnidadMedidaLabel } from "@/lib/utils"
import { useI18n } from "@/components/providers/i18n-provider"
import { ArrowDown, ArrowUp, Download, Loader2 } from 'lucide-react'
import { buildPurchaseOrderPrefillHref } from '@/lib/purchase-order-prefill'

type Material = {
  id: string
  externalId?: string | null
  nombre: string
  stockActual: number
  stockMinimo: number
  unidadMedida: string
  proveedor?: string | null
  imagenUrl?: string | null
  activo: boolean
  stocks?: Array<{
    quantity: number
    warehouse: { id: string; nombre: string; codigo: string | null; isDefault: boolean; sedeId: string | null }
  }>
}

type Bodega = {
  id: string
  nombre: string
  codigo: string | null
  isDefault: boolean
  sedeId: string | null
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

type Movement = {
  id: string
  type: "IN" | "OUT" | "ADJUST" | string
  quantity: number
  stockBefore: number
  stockAfter: number
  note: string | null
  createdAt: string
  material: { id: string; nombre: string; unidadMedida: string }
  warehouse?: { id: string; nombre: string } | null
}

type ProveedorLite = {
  id: string
  nombre: string
  nit?: string | null
}

type InventoryScanLookupResponse = {
  success?: boolean
  data?: {
    id: string
    nombre: string
    externalId: string | null
    unidadMedida: string
    stockActual: number
    warehouseQuantity: number | null
  }
  error?: string
}

function n(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

type StockSortKey = 'stockActual' | 'stockMinimo'
type StockSortDirection = 'desc' | 'asc'
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number] | 'all'

export default function InventarioPage() {
  const { t, language } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')
  const { hasWriteAccess } = useCurrentUserAccess()
  const canManageInventory = hasWriteAccess('INVENTARIO')
  const stockSectionRef = useRef<HTMLDivElement | null>(null)
  const movementsSectionRef = useRef<HTMLDivElement | null>(null)

  const [materials, setMaterials] = useState<Material[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [sedes, setSedes] = useState<SedeLite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState("")
  const [stockSort, setStockSort] = useState<{ key: StockSortKey; direction: StockSortDirection } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(25)

  const [warehouseFilterId, setWarehouseFilterId] = useState("")
  const inventoryView = useMemo(() => (searchParams?.get('view') === 'movements' ? 'movements' : 'stock'), [searchParams])
  const inventoryHero = useMemo(
    () => inventoryView === 'movements'
      ? {
          label: t('nav.movements'),
          title: t('nav.movements'),
          description: 'Entradas, salidas y ajustes recientes con trazabilidad por material y bodega.',
        }
      : {
          label: t('nav.stock'),
          title: t('nav.stock'),
          description: 'Existencias actuales por producto, bodega y stock mínimo operativo.',
        },
    [inventoryView, t]
  )

  const materialById = useMemo(() => {
    return new Map(materials.map((m) => [m.id, m]))
  }, [materials])

  const sedeById = useMemo(() => {
    return new Map(sedes.map((sede) => [sede.id, sede]))
  }, [sedes])

  const formatMaterialName = useCallback(
    (materialId: string, nombre: string) => {
      const code = String(materialById.get(materialId)?.externalId ?? '').trim()
      return code ? `(${code}) ${nombre}` : nombre
    },
    [materialById]
  )

  const formatBodegaLabel = useCallback(
    (bodega: Bodega) => {
      const sede = bodega.sedeId ? sedeById.get(bodega.sedeId) : null
      const sedeLabel = sede ? `${sede.nombre}${sede.codigo ? ` (${sede.codigo})` : ''}` : t('inventory.site.global')
      return `${bodega.nombre}${bodega.isDefault ? ` (${t('inventory.site.primary')})` : ''} · ${sedeLabel}`
    },
    [sedeById, t]
  )

  const exportExcel = useCallback(() => {
    const params = new URLSearchParams()
    if (warehouseFilterId) params.set('warehouseId', warehouseFilterId)
    const url = params.toString() ? `/api/inventario/export?${params.toString()}` : '/api/inventario/export'
    window.location.href = url
  }, [warehouseFilterId])

  const [form, setForm] = useState({
    materialId: "",
    type: "IN" as "IN" | "OUT" | "ADJUST",
    quantity: "",
    newStock: "",
    moveScope: 'warehouse' as 'global' | 'warehouse' | 'selectedSedes' | 'allSedes',
    warehouseId: "",
    warehouseIds: [] as string[],
    note: "",
    updateProveedor: false,
    proveedor: "",
  })
  const [scanCode, setScanCode] = useState("")
  const [scanQuantity, setScanQuantity] = useState("1")
  const [scanBusy, setScanBusy] = useState(false)
  const [scanStatus, setScanStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({ kind: 'idle', message: '' })

  const [proveedorMatches, setProveedorMatches] = useState<ProveedorLite[]>([])
  const [proveedorLoading, setProveedorLoading] = useState(false)
  const [proveedorCreateOpen, setProveedorCreateOpen] = useState(false)
  const [proveedorNuevoNombre, setProveedorNuevoNombre] = useState("")
  const [proveedorNuevoNit, setProveedorNuevoNit] = useState("")
  const [proveedorCreateSaving, setProveedorCreateSaving] = useState(false)
  const [proveedorError, setProveedorError] = useState("")

  const defaultBodegaId = useMemo(() => bodegas.find((b) => b.isDefault)?.id ?? "", [bodegas])

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

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const movementsUrl = new URL("/api/inventario", window.location.origin)
      movementsUrl.searchParams.set("limit", "25")
      if (warehouseFilterId) movementsUrl.searchParams.set("warehouseId", warehouseFilterId)

      const [resMaterials, resMovements] = await Promise.all([
        fetch(`/api/materiales?search=${encodeURIComponent(search)}`),
        fetch(movementsUrl.toString()),
      ])

      const resBodegas = await fetch("/api/bodegas")

      const jsonMaterials = (await resMaterials.json().catch(() => ({}))) as { success?: boolean; data?: Material[] }
      const jsonMovements = (await resMovements.json().catch(() => ({}))) as { success?: boolean; data?: Movement[] }
      const jsonBodegas = (await resBodegas.json().catch(() => ({}))) as { success?: boolean; data?: Bodega[] }

      if (resMaterials.ok && jsonMaterials.success && Array.isArray(jsonMaterials.data)) {
        setMaterials(jsonMaterials.data)
      }

      if (resMovements.ok && jsonMovements.success && Array.isArray(jsonMovements.data)) {
        setMovements(jsonMovements.data)
      }

      if (resBodegas.ok && jsonBodegas.success && Array.isArray(jsonBodegas.data)) {
        setBodegas(jsonBodegas.data)
      }

      if (!resMaterials.ok) setError(t('inventory.errors.loadMaterials'))
      if (!resMovements.ok) setError(t('inventory.errors.loadMovements'))
      if (!resBodegas.ok) setError(t('inventory.errors.loadSites'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, warehouseFilterId])

  useEffect(() => {
    setPage(1)
  }, [pageSize, search, stockSort, warehouseFilterId])

  useEffect(() => {
    const view = searchParams?.get('view')
    if (view === 'movements') {
      movementsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (view === 'stock') {
      stockSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    const loadSedes = async () => {
      try {
        const res = await fetch('/api/sedes', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: SedeLite[] }
        if (!cancelled && res.ok && json.success && Array.isArray(json.data)) {
          setSedes(json.data)
        }
      } catch {
        if (!cancelled) setSedes([])
      }
    }

    void loadSedes()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const preferredId = sedeWarehouseOptions[0]?.warehouseId ?? defaultBodegaId
    if (!form.warehouseId && preferredId) {
      setForm((p) => ({ ...p, warehouseId: preferredId }))
    }
  }, [defaultBodegaId, form.warehouseId, sedeWarehouseOptions])

  const activeMaterials = useMemo(() => materials.filter((m) => m.activo !== false), [materials])
  const lowStockMaterials = useMemo(
    () => activeMaterials.filter((material) => n(material.stockActual) <= n(material.stockMinimo)),
    [activeMaterials]
  )

  const sortedActiveMaterials = useMemo(() => {
    if (!stockSort) return activeMaterials

    return [...activeMaterials].sort((left, right) => {
      const leftValue = stockSort.key === 'stockActual' ? n(left.stockActual) : n(left.stockMinimo)
      const rightValue = stockSort.key === 'stockActual' ? n(right.stockActual) : n(right.stockMinimo)

      if (leftValue !== rightValue) {
        return stockSort.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
      }

      return left.nombre.localeCompare(right.nombre, 'es')
    })
  }, [activeMaterials, stockSort])

  const pageCount = useMemo(() => {
    if (pageSize === 'all') return 1
    return Math.max(1, Math.ceil(sortedActiveMaterials.length / pageSize))
  }, [pageSize, sortedActiveMaterials.length])

  const visibleMaterials = useMemo(() => {
    if (pageSize === 'all') return sortedActiveMaterials
    const safePage = Math.min(page, pageCount)
    const start = (safePage - 1) * pageSize
    return sortedActiveMaterials.slice(start, start + pageSize)
  }, [page, pageCount, pageSize, sortedActiveMaterials])

  const selectedMaterial = useMemo(
    () => activeMaterials.find((m) => m.id === form.materialId) ?? null,
    [activeMaterials, form.materialId]
  )

  const selectedMovementWarehouses = useMemo(
    () => form.warehouseIds
      .map((warehouseId) => sedeWarehouseOptions.find((option) => option.warehouseId === warehouseId))
      .filter((option): option is SedeWarehouseOption => Boolean(option)),
    [form.warehouseIds, sedeWarehouseOptions]
  )

  const canUpdateProveedor = form.type === 'IN'

  useEffect(() => {
    // Si el tipo deja de ser entrada, desactivamos la opción.
    if (!canUpdateProveedor && form.updateProveedor) {
      setForm((p) => ({ ...p, updateProveedor: false }))
      setProveedorCreateOpen(false)
      setProveedorError("")
    }
  }, [canUpdateProveedor, form.updateProveedor])

  useEffect(() => {
    if (!isModalOpen) return
    if (!form.updateProveedor) return

    const q = String(form.proveedor || '').trim()
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
  }, [isModalOpen, form.updateProveedor, form.proveedor])

  function openModal() {
    const defaultMaterialId = activeMaterials[0]?.id ?? ""
    setForm((prev) => ({ ...prev, materialId: prev.materialId || defaultMaterialId }))
    setScanCode("")
    setScanQuantity("1")
    setScanStatus({ kind: 'idle', message: '' })
    setIsModalOpen(true)
  }

  function buildLowStockOrderHref(materialsToOrder: Material[]) {
    const suppliers = Array.from(new Set(materialsToOrder.map((material) => String(material.proveedor || '').trim()).filter(Boolean)))

    return buildPurchaseOrderPrefillHref({
      mode: 'order',
      source: 'inventory',
      supplierName: suppliers.length === 1 ? suppliers[0] : undefined,
      notes: [
        suppliers.length > 1 ? t('inventory.lowStock.multiSupplierNote') : null,
        ...materialsToOrder.map(
          (material) =>
            `${formatMaterialName(material.id, material.nombre)}: ${n(material.stockActual).toLocaleString(locale)} / ${n(material.stockMinimo).toLocaleString(locale)} ${formatUnidadMedidaLabel(material.unidadMedida)}`
        ),
      ]
        .filter(Boolean)
        .join('\n'),
      items: materialsToOrder.map((material) => ({
        descripcion: formatMaterialName(material.id, material.nombre),
        cantidad: Math.max(1, Math.ceil(n(material.stockMinimo) - n(material.stockActual))),
        precioUnitario: 0,
        descuento: 0,
        iva: 0,
      })),
    })
  }

  function openLowStockOrder(materialsToOrder: Material[]) {
    if (!materialsToOrder.length) return
    router.push(buildLowStockOrderHref(materialsToOrder))
  }

  async function createProveedor() {
    const nombre = proveedorNuevoNombre.trim()
    const nit = proveedorNuevoNit.trim()
    if (!nombre) {
      setProveedorError(t('inventory.supplier.errors.nameRequired'))
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
        setProveedorError(json?.error || t('inventory.supplier.errors.createFailed'))
        return
      }

      setForm((p) => ({ ...p, proveedor: json.data!.nombre }))
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

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        materialId: form.materialId,
        type: form.type,
        note: form.note || undefined,
      }

      if (form.moveScope === 'warehouse') {
        payload.warehouseId = form.warehouseId || undefined
      } else if (form.moveScope === 'selectedSedes') {
        if (!form.warehouseIds.length) {
          setError('Selecciona al menos una sede para registrar el movimiento.')
          setIsSubmitting(false)
          return
        }
        payload.warehouseIds = form.warehouseIds
      } else if (form.moveScope === 'allSedes') {
        payload.applyToAllSedes = true
      }

      if (form.updateProveedor && form.type === 'IN') {
        payload.updateProveedor = true
        payload.proveedor = String(form.proveedor || '').trim()
      }

      if (form.type === "ADJUST") {
        payload.newStock = Number(form.newStock)
      } else {
        payload.quantity = Number(form.quantity)
      }

      const res = await fetch("/api/inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || t('inventory.errors.registerMovementFailed'))
        return
      }

      setIsModalOpen(false)
  setForm((prev) => ({ ...prev, quantity: "", newStock: "", note: "", updateProveedor: false, proveedor: "", warehouseIds: [] }))
      setProveedorMatches([])
      setProveedorCreateOpen(false)
      setProveedorNuevoNombre("")
      setProveedorNuevoNit("")
      setProveedorError("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitScannedEntry() {
    const code = scanCode.replace(/\s+/g, '').trim()
    const quantity = Number(scanQuantity)

    if (!code) {
      setScanStatus({ kind: 'error', message: t('inventory.errors.scanCodeRequired') })
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setScanStatus({ kind: 'error', message: t('inventory.errors.scanQuantityInvalid') })
      return
    }

    setScanBusy(true)
    setScanStatus({ kind: 'idle', message: '' })
    setError(null)

    try {
      const lookupUrl = new URL('/api/inventario/by-code', window.location.origin)
      lookupUrl.searchParams.set('code', code)
      if (form.moveScope === 'warehouse' && form.warehouseId) lookupUrl.searchParams.set('warehouseId', form.warehouseId)

      const lookupRes = await fetch(lookupUrl.toString(), { cache: 'no-store' })
      const lookupJson = (await lookupRes.json().catch(() => ({}))) as InventoryScanLookupResponse

      if (!lookupRes.ok || !lookupJson.success || !lookupJson.data) {
        setScanStatus({ kind: 'error', message: lookupJson.error || t('inventory.errors.registerMovementFailed') })
        return
      }

      const payload: Record<string, unknown> = {
        materialId: lookupJson.data.id,
        type: 'IN',
        quantity,
        note: form.note || undefined,
      }

      if (form.moveScope === 'warehouse') {
        payload.warehouseId = form.warehouseId || undefined
      } else if (form.moveScope === 'selectedSedes') {
        if (!form.warehouseIds.length) {
          setScanStatus({ kind: 'error', message: 'Selecciona al menos una sede para registrar la entrada.' })
          return
        }
        payload.warehouseIds = form.warehouseIds
      } else if (form.moveScope === 'allSedes') {
        payload.applyToAllSedes = true
      }

      if (form.updateProveedor) {
        payload.updateProveedor = true
        payload.proveedor = String(form.proveedor || '').trim()
      }

      const res = await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }

      if (!res.ok || !json.success) {
        setScanStatus({ kind: 'error', message: json.error || t('inventory.errors.registerMovementFailed') })
        return
      }

      setForm((prev) => ({ ...prev, materialId: lookupJson.data!.id }))
      setScanCode('')
      setScanQuantity('1')
      setScanStatus({
        kind: 'success',
        message: `${t('inventory.scan.entryRegisteredPrefix')} ${formatMaterialName(lookupJson.data.id, lookupJson.data.nombre)}.`,
      })
      await load()
    } catch (e) {
      setScanStatus({ kind: 'error', message: e instanceof Error ? e.message : t('common.unexpectedError') })
    } finally {
      setScanBusy(false)
    }
  }

  function movementLabel(type: Movement["type"]) {
    if (type === "IN") return t('inventory.movementType.in')
    if (type === "OUT") return t('inventory.movementType.out')
    if (type === "ADJUST") return t('inventory.movementType.adjust')
    return String(type)
  }

  function movementBadgeClass(type: Movement["type"]) {
    if (type === "IN") return "bg-green-50 text-green-700"
    if (type === "OUT") return "bg-red-50 text-red-700"
    if (type === "ADJUST") return "bg-blue-50 text-blue-700"
    return "bg-gray-100 text-gray-700"
  }

  function toggleStockSort(key: StockSortKey) {
    setStockSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'desc' }
      }

      return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
    })
  }

  function renderSortIcon(key: StockSortKey) {
    if (!stockSort || stockSort.key !== key) return null
    return stockSort.direction === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Inventario', href: '/dashboard/inventario' },
          { label: inventoryHero.label },
        ]}
        title={<span data-tour="inventario-title">{inventoryHero.title}</span>}
        description={inventoryHero.description}
        actions={
          <>
            {canManageInventory ? <Button variant="outline" onClick={exportExcel} disabled={isLoading}>
              <Download className="mr-2 h-4 w-4" />
              {t('inventory.actions.exportExcel')}
            </Button> : null}
            {canManageInventory ? <Button variant="outline" onClick={() => openLowStockOrder(lowStockMaterials)} disabled={isLoading || lowStockMaterials.length === 0}>
              {t('inventory.actions.lowStockOrder')}
            </Button> : null}
            {canManageInventory ? <Button onClick={openModal} disabled={isLoading} data-tour="inventario-movimiento">
              {t('inventory.actions.registerMovement')}
            </Button> : null}
          </>
        }
        stats={[
          { label: 'Productos', value: activeMaterials.length, hint: 'Productos activos', tone: 'neutral' },
          { label: 'Movimientos', value: movements.length, hint: 'Últimos registros', tone: 'sky' },
          {
            label: 'Bodega',
            value: warehouseFilterId ? bodegas.find((b) => b.id === warehouseFilterId)?.nombre || warehouseFilterId : naText,
            hint: warehouseFilterId ? 'Filtro activo' : 'Todas las bodegas',
            tone: 'amber',
          },
        ]}
      />

      <CatalogModuleTabs group="inventory" />

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div ref={stockSectionRef}>
      <Card>
        <CardHeader>
          <CardTitle>{t('inventory.stock.title')}</CardTitle>
          <CardDescription>{t('inventory.stock.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              data-tour="inventario-search"
              placeholder={t('inventory.stock.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => void load()} disabled={isLoading}>
              {t('inventory.actions.refresh')}
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>
              Mostrando <span className="font-medium text-foreground">{visibleMaterials.length}</span> de{' '}
              <span className="font-medium text-foreground">{sortedActiveMaterials.length}</span> productos
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Mostrar</span>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const next = e.target.value === 'all' ? 'all' : (Number(e.target.value) as PageSizeOption)
                  setPageSize(next)
                  setPage(1)
                }}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                aria-label="Productos por página en inventario"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="all">Todos</option>
              </select>

              {pageSize !== 'all' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                  >
                    Anterior
                  </Button>
                  <span>
                    Página <span className="font-medium text-foreground">{Math.min(page, pageCount)}</span> /{' '}
                    <span className="font-medium text-foreground">{pageCount}</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={page >= pageCount}
                  >
                    Siguiente
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="text-sm text-gray-600">{t('common.loading')}</div>
          ) : sortedActiveMaterials.length === 0 ? (
            <div className="text-sm text-gray-600">{t('inventory.stock.empty')}</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3 w-12">{t('inventory.stock.columns.image')}</th>
                    <th className="py-2 pr-4">{t('inventory.stock.columns.material')}</th>
                    <th className="py-2 pr-4">{t('inventory.stock.columns.site')}</th>
                    <th className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => toggleStockSort('stockActual')}
                        className="inline-flex items-center gap-1 font-medium text-inherit transition hover:text-gray-900"
                        title="Ordenar por stock actual"
                      >
                        {t('inventory.stock.columns.stock')}
                        {renderSortIcon('stockActual')}
                      </button>
                    </th>
                    <th className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => toggleStockSort('stockMinimo')}
                        className="inline-flex items-center gap-1 font-medium text-inherit transition hover:text-gray-900"
                        title="Ordenar por stock mínimo"
                      >
                        {t('inventory.stock.columns.minimum')}
                        {renderSortIcon('stockMinimo')}
                      </button>
                    </th>
                    <th className="py-2 pr-4">{t('inventory.stock.columns.unit')}</th>
                    <th className="py-2 pr-4">{t('inventory.stock.columns.supplier')}</th>
                    <th className="py-2 pr-4 text-right">{t('inventory.stock.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMaterials.map((m) => {
                    const low = n(m.stockActual) <= n(m.stockMinimo)
                    const wh = m.stocks?.[0]?.warehouse ?? null
                    const nombreView = formatMaterialName(m.id, m.nombre)
                    return (
                      <tr key={m.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.imagenUrl || "/placeholder-product.svg"}
                            alt={m.nombre}
                            className="h-8 w-8 rounded border object-cover bg-white"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-product.svg"
                            }}
                          />
                        </td>
                        <td className="py-2 pr-4 font-medium text-gray-900">{nombreView}</td>
                        <td className="py-2 pr-4 text-gray-700">
                          {wh ? `${wh.nombre}${wh.isDefault ? ` (${t('inventory.site.primary')})` : ''}` : naText}
                        </td>
                        <td className={cn("py-2 pr-4", low ? "text-red-700 font-semibold" : "text-gray-900")}>
                          {n(m.stockActual).toLocaleString(locale)} 
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{n(m.stockMinimo).toLocaleString(locale)}</td>
                        <td className="py-2 pr-4 text-gray-700">{formatUnidadMedidaLabel(m.unidadMedida)}</td>
                        <td className="py-2 pr-4 text-gray-700">{m.proveedor || naText}</td>
                        <td className="py-2 pr-4 text-right">
                          {low && canManageInventory ? (
                            <Button variant="outline" onClick={() => openLowStockOrder([m])}>
                              {t('inventory.actions.lowStockOrder')}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{naText}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <div ref={movementsSectionRef}>
      <Card>
        <CardHeader>
          <CardTitle>{t('inventory.movements.title')}</CardTitle>
          <CardDescription>{t('inventory.movements.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
            <div className="text-sm text-gray-700">{t('inventory.filters.filterBySite')}</div>
            <select
              className="border border-gray-200 rounded-md px-3 py-2 text-sm max-w-sm"
              value={warehouseFilterId}
              onChange={(e) => setWarehouseFilterId(e.target.value)}
            >
              <option value="">{t('inventory.filters.allSites')}</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatBodegaLabel(b)}
                </option>
              ))}
            </select>
          </div>

          {movements.length === 0 ? (
            <div className="text-sm text-gray-600">{t('inventory.movements.empty')}</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">{t('inventory.movements.columns.date')}</th>
                    <th className="py-2 pr-4">{t('inventory.movements.columns.material')}</th>
                    <th className="py-2 pr-4">{t('inventory.movements.columns.site')}</th>
                    <th className="py-2 pr-4">{t('inventory.movements.columns.type')}</th>
                    <th className="py-2 pr-4">{t('inventory.movements.columns.delta')}</th>
                    <th className="py-2 pr-4">{t('inventory.movements.columns.beforeAfter')}</th>
                    <th className="py-2 pr-4">{t('inventory.movements.columns.note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mv) => (
                    <tr key={mv.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 text-gray-700">
                        {new Date(mv.createdAt).toLocaleString(locale)}
                      </td>
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {mv.material?.id
                          ? formatMaterialName(
                              mv.material.id,
                              String(mv.material?.nombre || naText)
                            )
                          : mv.material?.nombre || naText}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{mv.warehouse?.nombre || naText}</td>
                      <td className="py-2 pr-4">
                        <span className={cn("text-xs font-semibold px-2 py-1 rounded", movementBadgeClass(mv.type))}>
                          {movementLabel(mv.type)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-900">{n(mv.quantity).toLocaleString(locale)}</td>
                      <td className="py-2 pr-4 text-gray-700">
                        {n(mv.stockBefore).toLocaleString(locale)} → {n(mv.stockAfter).toLocaleString(locale)}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{mv.note || naText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {canManageInventory ? <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('inventory.dialog.title')}</DialogTitle>
            <DialogDescription>{t('inventory.dialog.description')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitMovement} className="space-y-4 overflow-hidden">
            <div className="max-h-[calc(88vh-190px)] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>{t('inventory.fields.material')}</Label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={form.materialId}
                onChange={(e) => setForm((p) => ({ ...p, materialId: e.target.value }))}
                required
              >
                {activeMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatMaterialName(m.id, m.nombre)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Aplicar movimiento a</Label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={form.moveScope}
                onChange={(e) => {
                  const nextScope = e.target.value as 'global' | 'warehouse' | 'selectedSedes' | 'allSedes'
                  setForm((p) => ({
                    ...p,
                    moveScope: nextScope,
                    warehouseIds: nextScope === 'selectedSedes'
                      ? (p.warehouseIds.length ? p.warehouseIds : p.warehouseId ? [p.warehouseId] : [])
                      : p.warehouseIds,
                    warehouseId: nextScope === 'warehouse'
                      ? (p.warehouseId || p.warehouseIds[0] || defaultBodegaId || '')
                      : p.warehouseId,
                  }))
                }}
              >
                <option value="global">Stock global</option>
                <option value="warehouse">Una sede</option>
                <option value="selectedSedes">Varias sedes</option>
                <option value="allSedes">Todas las sedes</option>
              </select>
              <div className="text-xs text-gray-600">
                {form.moveScope === 'global'
                  ? 'El movimiento afectará el stock global sin distribuirlo en una sede específica.'
                  : form.moveScope === 'allSedes'
                    ? 'Se aplicará el mismo movimiento a la bodega principal de cada sede.'
                    : 'Selecciona la sede sobre la que se registrará el movimiento.'}
              </div>
            </div>

            {form.moveScope === 'warehouse' ? (
              <div className="space-y-2">
                <Label>{t('inventory.fields.site')}</Label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  value={form.warehouseId}
                  onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">Selecciona una sede…</option>
                  {sedeWarehouseOptions.map((option) => (
                    <option key={option.sedeId} value={option.warehouseId}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-600">
                  {t('inventory.fields.siteHelp')}
                </div>
              </div>
            ) : null}

            {form.moveScope === 'selectedSedes' ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="space-y-2">
                  <Label>Agregar sede</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                      value={form.warehouseId}
                      onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                    >
                      <option value="">Selecciona una sede…</option>
                      {sedeWarehouseOptions.map((option) => (
                        <option key={option.sedeId} value={option.warehouseId} disabled={form.warehouseIds.includes(option.warehouseId)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForm((p) => {
                        if (!p.warehouseId || p.warehouseIds.includes(p.warehouseId)) return p
                        return { ...p, warehouseIds: [...p.warehouseIds, p.warehouseId] }
                      })}
                    >
                      Agregar sede
                    </Button>
                  </div>
                </div>

                {selectedMovementWarehouses.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedMovementWarehouses.map((option) => (
                      <div key={option.warehouseId} className="flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-sky-700">
                        <span>{option.label}</span>
                        <button
                          type="button"
                          className="font-semibold text-sky-700"
                          onClick={() => setForm((p) => ({ ...p, warehouseIds: p.warehouseIds.filter((id) => id !== option.warehouseId) }))}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600">
                    Agrega una sede y luego podrás seguir sumando más una a una.
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('inventory.fields.type')}</Label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      type: e.target.value as "IN" | "OUT" | "ADJUST",
                      quantity: "",
                      newStock: "",
                      ...(e.target.value === 'IN' ? {} : { updateProveedor: false }),
                    }))
                  }
                >
                  <option value="IN">{t('inventory.movementType.in')}</option>
                  <option value="OUT">{t('inventory.movementType.out')}</option>
                  <option value="ADJUST">{t('inventory.movementType.adjust')}</option>
                </select>
              </div>

              {form.type === "ADJUST" ? (
                <div className="space-y-2">
                  <Label>{t('inventory.fields.newStock')}</Label>
                  <Input
                    inputMode="decimal"
                    value={form.newStock}
                    onChange={(e) => setForm((p) => ({ ...p, newStock: e.target.value }))}
                    placeholder={selectedMaterial ? String(selectedMaterial.stockActual) : "0"}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t('inventory.fields.quantity')}</Label>
                  <Input
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                    placeholder={t('inventory.fields.quantityPlaceholder')}
                    required
                  />
                </div>
              )}
            </div>

            {form.type === 'IN' ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 space-y-3">
                <div className="space-y-2">
                  <Label>{t('inventory.fields.scanCode')}</Label>
                  <Input
                    value={scanCode}
                    onChange={(e) => {
                      setScanCode(e.target.value)
                      if (scanStatus.kind !== 'idle') setScanStatus({ kind: 'idle', message: '' })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void submitScannedEntry()
                      }
                    }}
                    placeholder="Ej: 7701234567890"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <div className="text-xs text-gray-600">{t('inventory.fields.scanCodeHelp')}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="space-y-2">
                    <Label>{t('inventory.fields.scanQuantity')}</Label>
                    <Input
                      inputMode="decimal"
                      value={scanQuantity}
                      onChange={(e) => setScanQuantity(e.target.value)}
                      placeholder={t('inventory.fields.quantityPlaceholder')}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button type="button" variant="secondary" onClick={() => void submitScannedEntry()} disabled={scanBusy} className="w-full sm:w-auto">
                      {scanBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {scanBusy ? t('inventory.actions.scanning') : t('inventory.actions.scanEntry')}
                    </Button>
                  </div>
                </div>

                {scanStatus.kind !== 'idle' ? (
                  <div className={cn('text-sm', scanStatus.kind === 'success' ? 'text-green-700' : 'text-red-600')}>
                    {scanStatus.message}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedMaterial ? (
              <div className="text-xs text-gray-600">
                {t('inventory.currentStock')}: <span className="font-medium">{n(selectedMaterial.stockActual).toLocaleString(locale)}</span> {formatUnidadMedidaLabel(selectedMaterial.unidadMedida)}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t('inventory.fields.noteOptional')}</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder={t('inventory.fields.notePlaceholder')}
              />
            </div>

            {canUpdateProveedor ? (
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.updateProveedor}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setForm((p) => ({
                        ...p,
                        updateProveedor: checked,
                        proveedor: checked ? (p.proveedor || selectedMaterial?.proveedor || '') : '',
                      }))
                      setProveedorCreateOpen(false)
                      setProveedorError("")
                      if (checked) {
                        setProveedorNuevoNombre(String(selectedMaterial?.proveedor || '').trim())
                        setProveedorNuevoNit("")
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{t('inventory.supplier.updateCheckbox')}</span>
                </label>

                {form.updateProveedor ? (
                  <div className="space-y-2">
                    <Label>{t('inventory.fields.supplier')}</Label>
                    <Input
                      value={form.proveedor}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, proveedor: e.target.value }))
                        setProveedorCreateOpen(false)
                        setProveedorError("")
                      }}
                      placeholder={t('inventory.supplier.searchPlaceholder')}
                      required
                    />

                    {proveedorLoading ? (
                      <div className="text-xs text-muted-foreground">{t('inventory.supplier.searching')}</div>
                    ) : null}

                    {!proveedorCreateOpen && proveedorMatches.length > 0 ? (
                      <div className="rounded-md border border-input bg-background p-1">
                        {proveedorMatches.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left rounded-sm px-2 py-1 text-sm hover:bg-muted"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, proveedor: p.nombre }))
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
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProveedorCreateOpen(true)
                            setProveedorError("")
                            setProveedorNuevoNombre(String(form.proveedor || '').trim())
                            setProveedorNuevoNit("")
                          }}
                        >
                          {t('inventory.supplier.createNew')}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-md border border-input p-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>{t('inventory.supplier.fields.name')}</Label>
                            <Input value={proveedorNuevoNombre} onChange={(e) => setProveedorNuevoNombre(e.target.value)} disabled={proveedorCreateSaving} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('inventory.supplier.fields.nitOptional')}</Label>
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
                            {t('common.cancel')}
                          </Button>
                          <Button type="button" onClick={() => void createProveedor()} disabled={proveedorCreateSaving}>
                            {proveedorCreateSaving ? t('inventory.supplier.creating') : t('inventory.supplier.create')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.materialId}>
                {isSubmitting ? t('common.saving') : t('inventory.actions.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog> : null}
    </div>
  )
}
