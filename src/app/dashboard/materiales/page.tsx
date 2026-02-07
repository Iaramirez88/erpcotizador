/**
 * Página de Productos
 * Catálogo de productos de impresión con precios
 */

"use client"

import { useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
import { formatCurrency, formatUnidadMedidaLabel } from "@/lib/utils"

interface Material {
  id: string
  nombre: string
  tipo: string
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
  activo: boolean
  createdAt: string
  quantityDiscounts?: Array<{
    id: string
    minQty: number
    discountPct: number
  }>
}

type ProveedorLite = {
  id: string
  nombre: string
  nit?: string | null
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

export default function ProductosPage() {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("")
  const [unidadFiltro, setUnidadFiltro] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageFileError, setImageFileError] = useState("")
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [proveedorMatches, setProveedorMatches] = useState<ProveedorLite[]>([])
  const [proveedorLoading, setProveedorLoading] = useState(false)
  const [proveedorCreateOpen, setProveedorCreateOpen] = useState(false)
  const [proveedorNuevoNombre, setProveedorNuevoNombre] = useState("")
  const [proveedorNuevoNit, setProveedorNuevoNit] = useState("")
  const [proveedorCreateSaving, setProveedorCreateSaving] = useState(false)
  const [proveedorError, setProveedorError] = useState("")
  
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "VINILO",
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
    proveedor: "",
    observaciones: "",
    activo: true
  })

  const [quantityDiscounts, setQuantityDiscounts] = useState<Array<{ minQty: string; discountPct: string }>>([])

  const unidadCobro = useMemo(() => {
    const u = String(formData.unidadMedida || '').trim().toLowerCase()
    if (u === 'm2' || u === 'm²') return 'm2'
    if (u === 'ml' || u === 'm' || u === 'metro') return 'ml'
    return 'unidad'
  }, [formData.unidadMedida])

  const tipoProducto = useMemo(() => {
    return unidadCobro === 'unidad' ? 'FISICO' : 'METRAJE'
  }, [unidadCobro])

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
    fetchMateriales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tipoFiltro, unidadFiltro])

  const exportExcel = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tipoFiltro) params.set('tipo', tipoFiltro)
    if (unidadFiltro) params.set('unidadMedida', unidadFiltro)
    const url = params.toString() ? `/api/materiales/export?${params.toString()}` : '/api/materiales/export'
    window.location.href = url
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
      let url = '/api/materiales?'
      if (search) url += `search=${encodeURIComponent(search)}&`
      if (tipoFiltro) url += `tipo=${tipoFiltro}&`
      if (unidadFiltro) url += `unidadMedida=${encodeURIComponent(unidadFiltro)}&`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setMateriales(data.data)
      }
    } catch (error) {
      console.error('Error al cargar productos:', error)
    } finally {
      setIsLoading(false)
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

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
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
        alert(data.error || 'Error al guardar producto')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar producto')
    } finally {
      setIsSubmitting(false)
    }
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
      nombre: `${material.nombre} (copia)`,
      tipo: material.tipo,
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
      proveedor: material.proveedor ?? "",
      observaciones: material.observaciones ?? "",
      activo: material.activo,
    })
    setIsModalOpen(true)
  }

  const handleEdit = (material: Material) => {
    setEditingMaterial(material)
    setFormData({
      nombre: material.nombre,
      tipo: material.tipo,
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
      proveedor: material.proveedor || "",
      observaciones: material.observaciones || "",
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
      nombre: "",
      tipo: "VINILO",
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
      proveedor: "",
      observaciones: "",
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-tour="materiales-title">Productos</h1>
          <p className="text-muted-foreground">
            Catálogo de productos y precios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span data-tour="materiales-import">
            <ImportDialog module="materiales" title="Importar productos" />
          </span>
          <Button variant="outline" onClick={exportExcel}>
            Exportar Excel
          </Button>
          <Button onClick={() => { resetForm(); setIsModalOpen(true) }} data-tour="materiales-new">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                data-tour="materiales-search"
                placeholder="Buscar producto..."
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
              <Button onClick={() => { resetForm(); setIsModalOpen(true) }} className="mt-4">
                Crear primer producto
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {materiales.map((material) => {
                const tipoLabel = TIPOS_MATERIAL.find((t) => t.value === material.tipo)?.label || material.tipo
                const specs = [
                  material.ancho ? `Ancho ${material.ancho}cm` : null,
                  material.color ? `Color ${material.color}` : null,
                ].filter(Boolean).join(" • ")

                return (
                  <div key={material.id} className={`px-4 py-3 ${!material.activo ? "opacity-60" : ""}`}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
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
                          <div className="font-medium truncate">{material.nombre}</div>
                          {!material.activo ? (
                            <span className="px-2 py-0.5 text-[10px] border rounded bg-muted">Inactivo</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {tipoLabel}
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
                            className={`text-xs whitespace-nowrap ${material.stockActual <= material.stockMinimo ? "text-red-600 font-medium" : "text-muted-foreground"}`}
                          >
                            Stock: {material.stockActual} {formatUnidadMedidaLabel(material.unidadMedida)}
                          </div>
                        </div>

                        <div className="flex gap-2 md:justify-end">
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
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
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
              {/* Nombre */}
              <div className="col-span-2">
                <Label htmlFor="nombre">Nombre del Producto *</Label>
                <Input
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
                  {CATEGORIAS_SUGERIDAS.map((c) => (
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
                <div>
                  <Label htmlFor="ancho">Ancho (cm)</Label>
                  <Input
                    id="ancho"
                    type="number"
                    step="0.01"
                    value={formData.ancho}
                    onChange={(e) => setFormData({ ...formData, ancho: e.target.value })}
                    placeholder="137"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recomendado para materiales que se cotizan por metraje.
                  </p>
                </div>
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
