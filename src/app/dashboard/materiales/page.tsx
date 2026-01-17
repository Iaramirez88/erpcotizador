/**
 * Página de Materiales
 * Catálogo de materiales de impresión con precios
 */

"use client"

import { useState, useEffect } from "react"
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
import { formatCurrency } from "@/lib/utils"

interface Material {
  id: string
  nombre: string
  tipo: string
  categoria?: string | null
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
  { value: "OTRO", label: "Otro" },
]

const UNIDADES_MEDIDA = [
  { value: "m2", label: "Metro cuadrado (m²)" },
  { value: "ml", label: "Metro lineal (ml)" },
  { value: "unidad", label: "Unidad" },
]

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "VINILO",
    categoria: "",
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

  useEffect(() => {
    fetchMateriales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tipoFiltro])

  const fetchMateriales = async () => {
    setIsLoading(true)
    try {
      let url = '/api/materiales?'
      if (search) url += `search=${encodeURIComponent(search)}&`
      if (tipoFiltro) url += `tipo=${tipoFiltro}&`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setMateriales(data.data)
      }
    } catch (error) {
      console.error('Error al cargar materiales:', error)
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
        setIsModalOpen(false)
        resetForm()
        fetchMateriales()
      } else {
        alert(data.error || 'Error al guardar material')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar material')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (material: Material) => {
    setEditingMaterial(material)
    setFormData({
      nombre: material.nombre,
      tipo: material.tipo,
      categoria: material.categoria || "",
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
    if (!confirm('¿Estás seguro de eliminar este material?')) return

    try {
      const response = await fetch(`/api/materiales/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        fetchMateriales()
      } else {
        alert(data.error || 'Error al eliminar material')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar material')
    }
  }

  const resetForm = () => {
    setEditingMaterial(null)
    setFormData({
      nombre: "",
      tipo: "VINILO",
      categoria: "",
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
          <h1 className="text-3xl font-bold tracking-tight">Materiales</h1>
          <p className="text-muted-foreground">
            Catálogo de materiales y precios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportDialog module="materiales" title="Importar materiales" />
          <Button onClick={() => { resetForm(); setIsModalOpen(true) }}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Material
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar material..."
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
          </div>
        </CardContent>
      </Card>

      {/* Lista de materiales (compacta) */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : materiales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay materiales registrados</p>
              <Button onClick={() => { resetForm(); setIsModalOpen(true) }} className="mt-4">
                Crear primer material
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
                            Stock: {material.stockActual} {material.unidadMedida}
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
              {editingMaterial ? 'Editar Material' : 'Nuevo Material'}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial 
                ? 'Actualiza la información del material'
                : 'Completa los datos del nuevo material'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="col-span-2">
                <Label htmlFor="nombre">Nombre del Material *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  placeholder="Ej: Vinilo Adhesivo Blanco 3M"
                />
              </div>

              {/* Tipo */}
              <div>
                <Label htmlFor="tipo">Tipo de Material *</Label>
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
              </div>

              {/* Categoría */}
              <div>
                <Label htmlFor="categoria">Categoría</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ej: Impresión exterior"
                />
              </div>

              {/* Especificaciones */}
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
              </div>

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
              </div>

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

              <div>
                <Label htmlFor="unidadMedida">Unidad de Medida *</Label>
                <select
                  id="unidadMedida"
                  value={formData.unidadMedida}
                  onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  required
                >
                  {UNIDADES_MEDIDA.map(unidad => (
                    <option key={unidad.value} value={unidad.value}>{unidad.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="stockActual">Stock Actual</Label>
                <Input
                  id="stockActual"
                  type="number"
                  step="0.01"
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
                  step="0.01"
                  value={formData.stockMinimo}
                  onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                  placeholder="10"
                />
              </div>

              <div>
                <Label htmlFor="proveedor">Proveedor</Label>
                <Input
                  id="proveedor"
                  value={formData.proveedor}
                  onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
              </div>

              {/* Observaciones */}
              <div className="col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Notas adicionales sobre el material..."
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
                  <span className="text-sm">Material activo (disponible para cotizaciones)</span>
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
                    : 'Crear Material'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
