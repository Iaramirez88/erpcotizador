/**
 * Página del Cotizador Inteligente
 * Crear cotizaciones con cálculo automático de precios
 */

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import {
  PaperSizePreview,
  getPaperSize,
  type PaperOrientation,
  type PaperSizeKey,
} from "@/components/cotizador/paper-size-preview"

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

export default function CotizadorPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Datos de la cotización
  const [clienteId, setClienteId] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [validezDias, setValidezDias] = useState("15")
  const [tiempoEntrega, setTiempoEntrega] = useState("")
  const [observaciones, setObservaciones] = useState("")

  // Items
  const [items, setItems] = useState<ItemCotizacion[]>([])
  
  // Formulario de nuevo item
  const [showItemForm, setShowItemForm] = useState(false)
  const [itemForm, setItemForm] = useState({
    descripcion: "",
    materialId: "",
    cantidad: "1",
    ancho: "",
    alto: "",
    usePaperSize: false,
    paperSizeKey: "" as "" | PaperSizeKey,
    paperOrientation: "PORTRAIT" as PaperOrientation,
    precioUnitario: "",
    laminado: false,
    troquelado: false,
    instalacion: false,
    costoLaminado: "5000",
    costoTroquelado: "3000",
    costoInstalacion: "15000",
    observaciones: ""
  })

  // Cálculos
  const [subtotal, setSubtotal] = useState(0)
  const [descuento, setDescuento] = useState(0)
  const [iva, setIva] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchClientes()
    fetchMateriales()
  }, [])

  useEffect(() => {
    calcularTotales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, descuento])

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

  const calcularM2 = (ancho: number, alto: number): number => {
    return (ancho * alto) / 10000 // cm² a m²
  }

  const calcularPrecioItem = () => {
    const material = materiales.find(m => m.id === itemForm.materialId)
    if (!material) return

    const cantidad = parseFloat(itemForm.cantidad) || 1
    const ancho = parseFloat(itemForm.ancho) || 0
    const alto = parseFloat(itemForm.alto) || 0

    let precioBase = 0

    // Calcular según tipo de material
    if (material.precioM2 && ancho && alto) {
      const m2 = calcularM2(ancho, alto)
      precioBase = m2 * material.precioM2 * cantidad
    } else if (material.precioMetro && ancho) {
      const metros = (ancho / 100) * cantidad
      precioBase = metros * material.precioMetro
    } else if (material.precioUnidad) {
      precioBase = material.precioUnidad * cantidad
    }

    // Agregar costos de acabados
    let costoAcabados = 0
    if (itemForm.laminado) {
      const costoLam = parseFloat(itemForm.costoLaminado) || 0
      if (ancho && alto) {
        const m2 = calcularM2(ancho, alto)
        costoAcabados += m2 * costoLam * cantidad
      } else {
        costoAcabados += costoLam * cantidad
      }
    }
    if (itemForm.troquelado) {
      const costoTroq = parseFloat(itemForm.costoTroquelado) || 0
      costoAcabados += costoTroq * cantidad
    }
    if (itemForm.instalacion) {
      const costoInst = parseFloat(itemForm.costoInstalacion) || 0
      if (ancho && alto) {
        const m2 = calcularM2(ancho, alto)
        costoAcabados += m2 * costoInst * cantidad
      } else {
        costoAcabados += costoInst * cantidad
      }
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
    const precioTotal = precioBaseConDescuento + costoAcabados
    const precioUnitario = precioTotal / cantidad

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
    itemForm.cantidad,
    itemForm.ancho,
    itemForm.alto,
    itemForm.usePaperSize,
    itemForm.paperSizeKey,
    itemForm.paperOrientation,
    itemForm.laminado,
    itemForm.troquelado,
    itemForm.instalacion,
    itemForm.costoLaminado,
    itemForm.costoTroquelado,
    itemForm.costoInstalacion
  ])

  const agregarItem = () => {
    const material = materiales.find(m => m.id === itemForm.materialId)
    if (!itemForm.descripcion || !material) {
      alert('Completa todos los campos requeridos')
      return
    }

    const cantidad = parseFloat(itemForm.cantidad) || 1
    const ancho = parseFloat(itemForm.ancho) || null
    const alto = parseFloat(itemForm.alto) || null
    const precioUnitario = parseFloat(itemForm.precioUnitario) || 0
    const subtotal = precioUnitario * cantidad

    const nuevoItem: ItemCotizacion = {
      id: Date.now().toString(),
      descripcion: itemForm.descripcion,
      materialId: itemForm.materialId,
      material,
      cantidad,
      ancho,
      alto,
      m2: ancho && alto ? calcularM2(ancho, alto) : null,
      precioUnitario,
      subtotal,
      laminado: itemForm.laminado,
      troquelado: itemForm.troquelado,
      instalacion: itemForm.instalacion,
      costoLaminado: parseFloat(itemForm.costoLaminado) || 0,
      costoTroquelado: parseFloat(itemForm.costoTroquelado) || 0,
      costoInstalacion: parseFloat(itemForm.costoInstalacion) || 0,
      observaciones: itemForm.observaciones
    }

    setItems([...items, nuevoItem])
    setShowItemForm(false)
    resetItemForm()
  }

  const eliminarItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const resetItemForm = () => {
    setItemForm({
      descripcion: "",
      materialId: "",
      cantidad: "1",
      ancho: "",
      alto: "",
      usePaperSize: false,
      paperSizeKey: "",
      paperOrientation: "PORTRAIT",
      precioUnitario: "",
      laminado: false,
      troquelado: false,
      instalacion: false,
      costoLaminado: "5000",
      costoTroquelado: "3000",
      costoInstalacion: "15000",
      observaciones: ""
    })
  }

  const calcularTotales = () => {
    const sub = items.reduce((sum, item) => sum + item.subtotal, 0)
    const desc = parseFloat(descuento.toString()) || 0
    const subConDescuento = sub - desc
    const ivaCalc = subConDescuento * 0.19
    const tot = subConDescuento + ivaCalc

    setSubtotal(sub)
    setIva(ivaCalc)
    setTotal(tot)
  }

  const guardarCotizacion = async () => {
    if (!clienteId || items.length === 0) {
      alert('Selecciona un cliente y agrega al menos un item')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/cotizaciones', {
        method: 'POST',
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
        alert(`Cotización ${data.data.numero} creada exitosamente!`)
        // Limpiar formulario
        setClienteId("")
        setDescripcion("")
        setItems([])
        setDescuento(0)
        setValidezDias("15")
        setTiempoEntrega("")
        setObservaciones("")
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

  const applyPaperSize = (key: PaperSizeKey, orientation: PaperOrientation) => {
    const s = getPaperSize(key)
    if (!s) return
    const width = orientation === "PORTRAIT" ? s.widthCm : s.heightCm
    const height = orientation === "PORTRAIT" ? s.heightCm : s.widthCm
    setItemForm((prev) => ({
      ...prev,
      usePaperSize: true,
      paperSizeKey: key,
      paperOrientation: orientation,
      ancho: String(width),
      alto: String(height),
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cotizador Inteligente</h1>
        <p className="text-muted-foreground">
          Crea cotizaciones con cálculo automático de precios
        </p>
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
                  <select
                    id="cliente"
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    required
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre} {cliente.empresa && `- ${cliente.empresa}`}
                      </option>
                    ))}
                  </select>
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
                <Button onClick={() => setShowItemForm(true)} size="sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showItemForm && (
                <div className="p-4 mb-4 border rounded-lg bg-muted/50 space-y-4">
                  <h4 className="font-medium">Nuevo Item</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="item-desc">Descripción *</Label>
                      <Input
                        id="item-desc"
                        value={itemForm.descripcion}
                        onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })}
                        placeholder="Ej: Banner promocional..."
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="item-material">Material *</Label>
                      <select
                        id="item-material"
                        value={itemForm.materialId}
                        onChange={(e) => {
                          const materialId = e.target.value
                          setItemForm((prev) => ({
                            ...prev,
                            materialId,
                            // Si cambias de material, mantenemos dimensiones; pero reseteamos tamaño de papel
                            usePaperSize: false,
                            paperSizeKey: "",
                            paperOrientation: "PORTRAIT",
                          }))
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="">Seleccionar material...</option>
                        {materiales.map(mat => (
                          <option key={mat.id} value={mat.id}>
                            {mat.nombre} - {mat.precioM2 && `${formatCurrency(mat.precioM2)}/m²`}
                            {mat.precioMetro && `${formatCurrency(mat.precioMetro)}/ml`}
                            {mat.precioUnidad && `${formatCurrency(mat.precioUnidad)}/und`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={itemForm.usePaperSize}
                          onChange={(e) => {
                            const checked = e.target.checked
                            if (!checked) {
                              setItemForm((prev) => ({
                                ...prev,
                                usePaperSize: false,
                                paperSizeKey: "",
                                paperOrientation: "PORTRAIT",
                              }))
                              return
                            }

                            // Default A4 cuando se activa
                            applyPaperSize("A4", itemForm.paperOrientation)
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Usar tamaño de papel</span>
                      </label>
                    </div>

                    {itemForm.usePaperSize && (
                      <>
                        <div>
                          <Label htmlFor="paper-size">Tamaño de papel</Label>
                          <select
                            id="paper-size"
                            value={itemForm.paperSizeKey}
                            onChange={(e) => {
                              const key = e.target.value as PaperSizeKey
                              applyPaperSize(key, itemForm.paperOrientation)
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                          >
                            <option value="A0">A0</option>
                            <option value="A1">A1</option>
                            <option value="A2">A2</option>
                            <option value="A3">A3</option>
                            <option value="A4">A4</option>
                            <option value="A5">A5</option>
                            <option value="A6">A6</option>
                            <option value="PLIEGO_70X100">Pliego (70×100)</option>
                            <option value="MEDIO_PLIEGO_50X70">Medio pliego (50×70)</option>
                            <option value="CUARTO_PLIEGO_35X50">Cuarto pliego (35×50)</option>
                            <option value="CARTA">Carta (21.59×27.94)</option>
                            <option value="MEDIA_CARTA">Media carta (13.97×21.59)</option>
                            <option value="CUARTO_CARTA">Cuarto de carta (10.80×13.97)</option>
                          </select>
                        </div>

                        <div>
                          <Label htmlFor="paper-orientation">Orientación</Label>
                          <select
                            id="paper-orientation"
                            value={itemForm.paperOrientation}
                            onChange={(e) => {
                              const orientation = e.target.value as PaperOrientation
                              if (itemForm.paperSizeKey) {
                                applyPaperSize(itemForm.paperSizeKey, orientation)
                              } else {
                                setItemForm((prev) => ({ ...prev, paperOrientation: orientation }))
                              }
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                          >
                            <option value="PORTRAIT">Vertical</option>
                            <option value="LANDSCAPE">Horizontal</option>
                          </select>
                        </div>

                        {itemForm.paperSizeKey && (
                          <div className="col-span-2">
                            <PaperSizePreview
                              selectedKey={itemForm.paperSizeKey}
                              orientation={itemForm.paperOrientation}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div>
                      <Label htmlFor="item-ancho">Ancho (cm)</Label>
                      <Input
                        id="item-ancho"
                        type="number"
                        step="0.01"
                        value={itemForm.ancho}
                        onChange={(e) => setItemForm({ ...itemForm, ancho: e.target.value })}
                        disabled={itemForm.usePaperSize}
                        className={itemForm.usePaperSize ? "bg-muted" : undefined}
                      />
                    </div>

                    <div>
                      <Label htmlFor="item-alto">Alto (cm)</Label>
                      <Input
                        id="item-alto"
                        type="number"
                        step="0.01"
                        value={itemForm.alto}
                        onChange={(e) => setItemForm({ ...itemForm, alto: e.target.value })}
                        disabled={itemForm.usePaperSize}
                        className={itemForm.usePaperSize ? "bg-muted" : undefined}
                      />
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

                    {/* Acabados */}
                    <div className="col-span-2 space-y-2">
                      <Label>Acabados</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={itemForm.laminado}
                            onChange={(e) => setItemForm({ ...itemForm, laminado: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Laminado</span>
                        </label>
                        {itemForm.laminado && (
                          <Input
                            type="number"
                            step="1"
                            value={itemForm.costoLaminado}
                            onChange={(e) => setItemForm({ ...itemForm, costoLaminado: e.target.value })}
                            placeholder="Costo"
                            className="col-span-2"
                          />
                        )}

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={itemForm.troquelado}
                            onChange={(e) => setItemForm({ ...itemForm, troquelado: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Troquelado</span>
                        </label>
                        {itemForm.troquelado && (
                          <Input
                            type="number"
                            step="1"
                            value={itemForm.costoTroquelado}
                            onChange={(e) => setItemForm({ ...itemForm, costoTroquelado: e.target.value })}
                            placeholder="Costo"
                            className="col-span-2"
                          />
                        )}

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={itemForm.instalacion}
                            onChange={(e) => setItemForm({ ...itemForm, instalacion: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Instalación</span>
                        </label>
                        {itemForm.instalacion && (
                          <Input
                            type="number"
                            step="1"
                            value={itemForm.costoInstalacion}
                            onChange={(e) => setItemForm({ ...itemForm, costoInstalacion: e.target.value })}
                            placeholder="Costo"
                            className="col-span-2"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={agregarItem} size="sm">Agregar</Button>
                    <Button onClick={() => { setShowItemForm(false); resetItemForm() }} variant="outline" size="sm">
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
                  <span className="text-muted-foreground">IVA (19%):</span>
                  <span className="font-medium">{formatCurrency(iva)}</span>
                </div>

                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button 
                onClick={guardarCotizacion}
                disabled={isLoading || !clienteId || items.length === 0}
                className="w-full"
                size="lg"
              >
                {isLoading ? 'Guardando...' : 'Guardar Cotización'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
