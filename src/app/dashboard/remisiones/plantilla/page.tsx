'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  RemisionTemplateSettings,
  DEFAULT_REMISION_TEMPLATE,
  mergeRemisionTemplateSettings,
  RemisionPageSize,
  RemisionOrientation,
  RemisionFontFamily,
} from '@/lib/remision-template'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import dynamic from 'next/dynamic'

// Importación dinámica para evitar problemas de SSR
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center">Cargando vista previa...</div> }
)

// Importación del componente PDF
import { RemisionPDF } from '@/lib/remision-pdf-template.client'

// Datos de ejemplo para el preview
const EJEMPLO_REMISION = {
  numero: 'REM-2025-001',
  createdAt: new Date(),
  status: 'ENTREGADO' as const,
  clienteNombre: 'Cliente Ejemplo S.A.S',
  note: 'Esta es una remisión de ejemplo para visualizar la plantilla',
  warehouse: { nombre: 'Bodega Principal' },
  items: [
    {
      quantity: 50,
      note: 'Papel bond tamaño carta',
      material: { nombre: 'Papel Bond', unidadMedida: 'Resma' },
    },
    {
      quantity: 100,
      note: 'Sobres manila tamaño oficio',
      material: { nombre: 'Sobres Manila', unidadMedida: 'Unidad' },
    },
    {
      quantity: 25,
      note: 'Carpetas de presentación',
      material: { nombre: 'Carpetas', unidadMedida: 'Unidad' },
    },
  ],
  createdBy: {
    id: 'user-1',
    name: 'Usuario Demo',
    email: 'demo@sgdigital.com',
  },
}

const EJEMPLO_EMPRESA = {
  nombre: 'SGDigital Softwares',
  nit: '900.123.456-7',
  direccion: 'Calle 123 #45-67, Bogotá',
  telefono: '+57 300 123 4567',
}

export default function PlantillaRemisionesPage() {
  const [activeTab, setActiveTab] = useState<'page' | 'colors' | 'typography' | 'header' | 'footer'>('page')
  const [tabPending, setTabPending] = useState(false)
  const tabTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current)
    }
  }, [])

  const { toast } = useToast()
  const [settings, setSettings] = useState<RemisionTemplateSettings>(DEFAULT_REMISION_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoBase64, setLogoBase64] = useState<string>('')

  useEffect(() => {
    cargarPlantilla()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarPlantilla = async () => {
    try {
      const res = await fetch('/api/remisiones/template')
      if (!res.ok) throw new Error('Error al cargar plantilla')
      const data = await res.json()
      setSettings(mergeRemisionTemplateSettings(data.settings ?? DEFAULT_REMISION_TEMPLATE))
      if (data.settings.header?.logo) {
        setLogoBase64(data.settings.header.logo)
      }
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la plantilla',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const guardarPlantilla = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/remisiones/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (!res.ok) throw new Error('Error al guardar')

      toast({
        title: 'Éxito',
        description: 'Plantilla guardada correctamente',
      })
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la plantilla',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const resetearPlantilla = async () => {
    if (!confirm('¿Deseas restablecer la plantilla a los valores por defecto?')) return

    try {
      const res = await fetch('/api/remisiones/template', { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al resetear')

      const data = await res.json()
      setSettings(mergeRemisionTemplateSettings(data.settings ?? DEFAULT_REMISION_TEMPLATE))
      setLogoBase64('')

      toast({
        title: 'Éxito',
        description: 'Plantilla restablecida a valores por defecto',
      })
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo restablecer la plantilla',
        variant: 'destructive',
      })
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'El archivo debe ser una imagen',
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setLogoBase64(base64)
      setSettings((prev) => ({
        ...prev,
        header: { ...prev.header, logo: base64 },
      }))
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="mb-6 flex items-center justify-end">
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetearPlantilla}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Resetear
          </Button>
          <Button onClick={guardarPlantilla} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Panel de configuración */}
        <div className="space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const next = (v || 'page') as typeof activeTab
              if (next === activeTab) return
              setTabPending(true)
              setActiveTab(next)
              if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current)
              tabTimerRef.current = window.setTimeout(() => setTabPending(false), 180)
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="page">Página</TabsTrigger>
              <TabsTrigger value="colors">Colores</TabsTrigger>
              <TabsTrigger value="typography">Texto</TabsTrigger>
              <TabsTrigger value="header">Encabezado</TabsTrigger>
              <TabsTrigger value="footer">Pie</TabsTrigger>
            </TabsList>

            {tabPending ? (
              <div className="mt-2 text-sm text-muted-foreground">Cargando…</div>
            ) : null}

            {/* Configuración de página */}
            <TabsContent value="page" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Página</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tamaño de Página</Label>
                    <Select
                      value={settings.page.size}
                      onValueChange={(value: string) =>
                        setSettings((prev) => ({
                          ...prev,
                          page: { ...prev.page, size: value as RemisionPageSize },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LETTER">Carta</SelectItem>
                        <SelectItem value="A4">A4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Orientación</Label>
                    <Select
                      value={settings.page.orientation}
                      onValueChange={(value: string) =>
                        setSettings((prev) => ({
                          ...prev,
                          page: { ...prev.page, orientation: value as RemisionOrientation },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Vertical</SelectItem>
                        <SelectItem value="landscape">Horizontal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-2">
                      <Label>Margen (por lado)</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Arriba</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.marginSides?.top ?? settings.page.marginVertical ?? settings.page.padding}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base =
                                  prev.page.marginSides ??
                                  ({
                                    top: prev.page.marginVertical ?? prev.page.padding,
                                    right: prev.page.marginHorizontal ?? prev.page.padding,
                                    bottom: prev.page.marginVertical ?? prev.page.padding,
                                    left: prev.page.marginHorizontal ?? prev.page.padding,
                                  } as const)
                                const next = { ...base, top: Number(e.target.value) }
                                const avgH = Math.round((next.left + next.right) / 2)
                                const avgV = Math.round((next.top + next.bottom) / 2)
                                const avgAll = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                                return {
                                  ...prev,
                                  page: {
                                    ...prev.page,
                                    padding: avgAll,
                                    marginHorizontal: avgH,
                                    marginVertical: avgV,
                                    marginSides: next,
                                  },
                                }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Derecha</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.marginSides?.right ?? settings.page.marginHorizontal ?? settings.page.padding}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base =
                                  prev.page.marginSides ??
                                  ({
                                    top: prev.page.marginVertical ?? prev.page.padding,
                                    right: prev.page.marginHorizontal ?? prev.page.padding,
                                    bottom: prev.page.marginVertical ?? prev.page.padding,
                                    left: prev.page.marginHorizontal ?? prev.page.padding,
                                  } as const)
                                const next = { ...base, right: Number(e.target.value) }
                                const avgH = Math.round((next.left + next.right) / 2)
                                const avgV = Math.round((next.top + next.bottom) / 2)
                                const avgAll = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                                return {
                                  ...prev,
                                  page: {
                                    ...prev.page,
                                    padding: avgAll,
                                    marginHorizontal: avgH,
                                    marginVertical: avgV,
                                    marginSides: next,
                                  },
                                }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Abajo</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.marginSides?.bottom ?? settings.page.marginVertical ?? settings.page.padding}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base =
                                  prev.page.marginSides ??
                                  ({
                                    top: prev.page.marginVertical ?? prev.page.padding,
                                    right: prev.page.marginHorizontal ?? prev.page.padding,
                                    bottom: prev.page.marginVertical ?? prev.page.padding,
                                    left: prev.page.marginHorizontal ?? prev.page.padding,
                                  } as const)
                                const next = { ...base, bottom: Number(e.target.value) }
                                const avgH = Math.round((next.left + next.right) / 2)
                                const avgV = Math.round((next.top + next.bottom) / 2)
                                const avgAll = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                                return {
                                  ...prev,
                                  page: {
                                    ...prev.page,
                                    padding: avgAll,
                                    marginHorizontal: avgH,
                                    marginVertical: avgV,
                                    marginSides: next,
                                  },
                                }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Izquierda</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.marginSides?.left ?? settings.page.marginHorizontal ?? settings.page.padding}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base =
                                  prev.page.marginSides ??
                                  ({
                                    top: prev.page.marginVertical ?? prev.page.padding,
                                    right: prev.page.marginHorizontal ?? prev.page.padding,
                                    bottom: prev.page.marginVertical ?? prev.page.padding,
                                    left: prev.page.marginHorizontal ?? prev.page.padding,
                                  } as const)
                                const next = { ...base, left: Number(e.target.value) }
                                const avgH = Math.round((next.left + next.right) / 2)
                                const avgV = Math.round((next.top + next.bottom) / 2)
                                const avgAll = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                                return {
                                  ...prev,
                                  page: {
                                    ...prev.page,
                                    padding: avgAll,
                                    marginHorizontal: avgH,
                                    marginVertical: avgV,
                                    marginSides: next,
                                  },
                                }
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 space-y-2">
                      <Label>Padding (por lado)</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Arriba</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.paddingSides?.top ?? 0}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base = prev.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                                const next = { ...base, top: Number(e.target.value) }
                                return { ...prev, page: { ...prev.page, paddingSides: next } }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Derecha</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.paddingSides?.right ?? 0}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base = prev.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                                const next = { ...base, right: Number(e.target.value) }
                                return { ...prev, page: { ...prev.page, paddingSides: next } }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Abajo</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.paddingSides?.bottom ?? 0}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base = prev.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                                const next = { ...base, bottom: Number(e.target.value) }
                                return { ...prev, page: { ...prev.page, paddingSides: next } }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Izquierda</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={settings.page.paddingSides?.left ?? 0}
                            onChange={(e) =>
                              setSettings((prev) => {
                                const base = prev.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                                const next = { ...base, left: Number(e.target.value) }
                                return { ...prev, page: { ...prev.page, paddingSides: next } }
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Configuración de colores */}
            <TabsContent value="colors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Esquema de Colores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Color Primario</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={settings.colors.primary}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, primary: e.target.value },
                          }))
                        }
                        className="h-10 w-20"
                      />
                      <Input
                        type="text"
                        value={settings.colors.primary}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, primary: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color de Texto</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={settings.colors.text}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, text: e.target.value },
                          }))
                        }
                        className="h-10 w-20"
                      />
                      <Input
                        type="text"
                        value={settings.colors.text}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, text: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color de Borde</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={settings.colors.border}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, border: e.target.value },
                          }))
                        }
                        className="h-10 w-20"
                      />
                      <Input
                        type="text"
                        value={settings.colors.border}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, border: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color de Fondo (Tabla)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={settings.colors.background}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, background: e.target.value },
                          }))
                        }
                        className="h-10 w-20"
                      />
                      <Input
                        type="text"
                        value={settings.colors.background}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, background: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Configuración de tipografía */}
            <TabsContent value="typography" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tipografía</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fuente</Label>
                    <Select
                      value={settings.typography.fontFamily}
                      onValueChange={(value: string) =>
                        setSettings((prev) => ({
                          ...prev,
                          typography: { ...prev.typography, fontFamily: value as RemisionFontFamily },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Times-Roman">Times New Roman</SelectItem>
                        <SelectItem value="Courier">Courier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Tamaño Base</Label>
                      <Input
                        type="number"
                        value={settings.typography.baseFontSize}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            typography: { ...prev.typography, baseFontSize: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tamaño Título</Label>
                      <Input
                        type="number"
                        value={settings.typography.titleFontSize}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            typography: { ...prev.typography, titleFontSize: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Configuración de encabezado */}
            <TabsContent value="header" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Encabezado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Mostrar Logo</Label>
                    <Switch
                      checked={settings.header.showLogo}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          header: { ...prev.header, showLogo: checked },
                        }))
                      }
                    />
                  </div>

                  {settings.header.showLogo && (
                    <div className="space-y-2">
                      <Label>Logo</Label>
                      <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                      {logoBase64 && (
                        <div className="mt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoBase64}
                            alt="Logo preview"
                            className="h-16 w-auto rounded border"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Texto Personalizado</Label>
                    <Input
                      type="text"
                      value={settings.header.customText || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          header: { ...prev.header, customText: e.target.value },
                        }))
                      }
                      placeholder="Ej: Remisión de Mercancía"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Configuración de pie de página */}
            <TabsContent value="footer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pie de Página</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Mostrar Números de Página</Label>
                    <Switch
                      checked={settings.footer.showPageNumbers}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, showPageNumbers: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Texto Personalizado</Label>
                    <Input
                      type="text"
                      value={settings.footer.customText || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, customText: e.target.value },
                        }))
                      }
                      placeholder="Ej: Gracias por su confianza"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Secciones visibles */}
          <Card>
            <CardHeader>
              <CardTitle>Secciones del Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Mostrar Información de Bodega</Label>
                <Switch
                  checked={settings.sections.showWarehouse}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, showWarehouse: checked },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Mostrar Observaciones</Label>
                <Switch
                  checked={settings.sections.showObservaciones}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, showObservaciones: checked },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Mostrar Creado Por</Label>
                <Switch
                  checked={settings.sections.showCreatedBy}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, showCreatedBy: checked },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vista previa del PDF */}
        <div className="lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[800px] w-full overflow-hidden rounded border">
                <PDFViewer width="100%" height="100%">
                  <RemisionPDF
                    remision={EJEMPLO_REMISION}
                    empresa={EJEMPLO_EMPRESA}
                    template={settings}
                  />
                </PDFViewer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
