'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { TemplateEditorTabs } from '@/components/dashboard/template-editor-tabs'
import {
  DEFAULT_ORDEN_COMPRA_TEMPLATE,
  OrdenCompraFontFamily,
  OrdenCompraOrientation,
  OrdenCompraPageSize,
  OrdenCompraTemplateSettings,
  mergeOrdenCompraTemplateSettings,
} from '@/lib/orden-compra-template'
import { OrdenCompraPDF } from '@/lib/orden-compra-pdf-template.client'
import { useToast } from '@/hooks/use-toast'

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center">Cargando vista previa...</div> }
)

const ORDEN_DEMO = {
  numeroOrden: 'OC-2026-0042',
  numeroPedido: 'REQ-128',
  fechaCompra: new Date(),
  proveedorNombre: 'Papeles del Norte S.A.S.',
  proveedorTelefono: '320 555 0198',
  proveedorDireccion: 'Autopista Medellín km 5',
  sede: 'Principal',
  observaciones: 'Entregar el viernes antes de las 3:00 p.m. y confirmar disponibilidad del lote.',
  recibidoPorNombre: 'Lina Gómez',
  autorizado: true,
  items: [
    { descripcion: 'Vinilo adhesivo mate 1.52m', cantidad: 6, precioUnitario: 185000, descuento: 0, iva: 210900 },
    { descripcion: 'Lona front 13oz', cantidad: 3, precioUnitario: 162000, descuento: 15000, iva: 89550 },
    { descripcion: 'Tinta eco solvente negra', cantidad: 2, precioUnitario: 98000, descuento: 0, iva: 37240 },
  ],
}

export default function PlantillaOrdenCompraPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<OrdenCompraTemplateSettings>(DEFAULT_ORDEN_COMPRA_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'page' | 'colors' | 'typography' | 'header' | 'footer'>('page')

  useEffect(() => {
    void loadTemplate()
  }, [])

  async function loadTemplate() {
    try {
      const res = await fetch('/api/compras/template')
      if (!res.ok) throw new Error('Error al cargar plantilla')
      const data = await res.json()
      setSettings(mergeOrdenCompraTemplateSettings(data.settings ?? DEFAULT_ORDEN_COMPRA_TEMPLATE))
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la plantilla de orden de compra', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function saveTemplate() {
    setSaving(true)
    try {
      const res = await fetch('/api/compras/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast({ title: 'Éxito', description: 'Plantilla de orden de compra guardada correctamente' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la plantilla', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function resetTemplate() {
    if (!confirm('¿Deseas restablecer la plantilla de orden de compra?')) return
    try {
      const res = await fetch('/api/compras/template', { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al resetear')
      const data = await res.json()
      setSettings(mergeOrdenCompraTemplateSettings(data.settings ?? DEFAULT_ORDEN_COMPRA_TEMPLATE))
      toast({ title: 'Éxito', description: 'Plantilla restablecida a valores por defecto' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo resetear la plantilla', variant: 'destructive' })
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'El archivo debe ser una imagen', variant: 'destructive' })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setSettings((prev) => ({
        ...prev,
        header: { ...prev.header, logo: base64, logoUrl: base64 },
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
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={resetTemplate}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Resetear
        </Button>
        <Button onClick={saveTemplate} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <div className="space-y-4">
          <TemplateEditorTabs
            value={activeTab}
            onValueChange={setActiveTab}
            tabs={[
              { value: 'page', label: 'Página' },
              { value: 'colors', label: 'Colores' },
              { value: 'typography', label: 'Texto' },
              { value: 'header', label: 'Encabezado' },
              { value: 'footer', label: 'Pie' },
            ]}
            listClassName="grid w-full grid-cols-5"
          >

            <TabsContent value="page" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de página</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tamaño</Label>
                      <select className="w-full rounded-md border px-3 py-2 text-sm" value={settings.page.size} onChange={(e) => setSettings((prev) => ({ ...prev, page: { ...prev.page, size: e.target.value as OrdenCompraPageSize } }))}>
                        <option value="A4">A4</option>
                        <option value="LETTER">Carta</option>
                        <option value="LEGAL">Legal</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Orientación</Label>
                      <select className="w-full rounded-md border px-3 py-2 text-sm" value={settings.page.orientation} onChange={(e) => setSettings((prev) => ({ ...prev, page: { ...prev.page, orientation: e.target.value as OrdenCompraOrientation } }))}>
                        <option value="portrait">Vertical</option>
                        <option value="landscape">Horizontal</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Secciones del documento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    ['showSupplierContact', 'Mostrar contacto del proveedor'],
                    ['showPreparedBy', 'Mostrar responsable'],
                    ['showSite', 'Mostrar sede'],
                    ['showRequestNumber', 'Mostrar número de pedido'],
                    ['showNotes', 'Mostrar observaciones'],
                    ['showTotals', 'Mostrar totales'],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                      <Label>{label}</Label>
                      <Switch checked={settings.sections[key as keyof typeof settings.sections]} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, sections: { ...prev.sections, [key]: checked } }))} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="colors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Colores</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {[
                    ['primary', 'Primario'],
                    ['pageBackground', 'Fondo página'],
                    ['text', 'Texto'],
                    ['mutedText', 'Texto secundario'],
                    ['sectionBackground', 'Fondo secciones'],
                    ['tableHeaderBackground', 'Cabecera tabla'],
                    ['tableHeaderText', 'Texto cabecera'],
                    ['tableBorder', 'Borde tabla'],
                    ['border', 'Borde general'],
                    ['highlightBackground', 'Caja destacada'],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input type="color" value={settings.colors[key as keyof typeof settings.colors]} onChange={(e) => setSettings((prev) => ({ ...prev, colors: { ...prev.colors, [key]: e.target.value } }))} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="typography" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tipografía</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fuente</Label>
                    <select className="w-full rounded-md border px-3 py-2 text-sm" value={settings.typography.fontFamily} onChange={(e) => setSettings((prev) => ({ ...prev, typography: { ...prev.typography, fontFamily: e.target.value as OrdenCompraFontFamily } }))}>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Times-Roman">Times</option>
                      <option value="Courier">Courier</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fuente base</Label>
                    <Input type="number" min={8} max={14} value={settings.typography.baseFontSize} onChange={(e) => setSettings((prev) => ({ ...prev, typography: { ...prev.typography, baseFontSize: Number(e.target.value) } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input type="number" min={16} max={40} value={settings.typography.titleFontSize} onChange={(e) => setSettings((prev) => ({ ...prev, typography: { ...prev.typography, titleFontSize: Number(e.target.value) } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Títulos de sección</Label>
                    <Input type="number" min={10} max={18} value={settings.typography.sectionTitleFontSize} onChange={(e) => setSettings((prev) => ({ ...prev, typography: { ...prev.typography, sectionTitleFontSize: Number(e.target.value) } }))} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="header" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Encabezado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={settings.header.title} onChange={(e) => setSettings((prev) => ({ ...prev, header: { ...prev.header, title: e.target.value } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de empresa</Label>
                    <Input value={settings.header.companyName} onChange={(e) => setSettings((prev) => ({ ...prev, header: { ...prev.header, companyName: e.target.value } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo 1</Label>
                    <Input value={settings.header.subtitle1} onChange={(e) => setSettings((prev) => ({ ...prev, header: { ...prev.header, subtitle1: e.target.value } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo 2</Label>
                    <Input value={settings.header.subtitle2} onChange={(e) => setSettings((prev) => ({ ...prev, header: { ...prev.header, subtitle2: e.target.value } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto libre</Label>
                    <Textarea value={settings.header.customText ?? ''} onChange={(e) => setSettings((prev) => ({ ...prev, header: { ...prev.header, customText: e.target.value } }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label>Mostrar logo</Label>
                      <p className="text-sm text-muted-foreground">Usa URL o carga una imagen local.</p>
                    </div>
                    <Switch checked={settings.header.showLogo} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, header: { ...prev.header, showLogo: checked } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>URL del logo</Label>
                    <Input value={settings.header.logoUrl ?? ''} onChange={(e) => setSettings((prev) => ({ ...prev, header: { ...prev.header, logoUrl: e.target.value, logo: e.target.value || prev.header.logo } }))} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargar logo</Label>
                    <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="footer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pie de página</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label>Mostrar fecha/hora de generación</Label>
                    <Switch checked={settings.footer.showTimestamp} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, showTimestamp: checked } }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label>Mostrar numeración de página</Label>
                    <Switch checked={settings.footer.showPageNumbers} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, showPageNumbers: checked } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto de pie</Label>
                    <Textarea value={settings.footer.customText} onChange={(e) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, customText: e.target.value } }))} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </TemplateEditorTabs>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Vista previa demo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[calc(100vh-170px)] min-h-[720px]">
              <PDFViewer width="100%" height="100%" showToolbar>
                <OrdenCompraPDF orden={ORDEN_DEMO} template={settings} empresa={{ nombre: 'SGDigital Softwares' }} />
              </PDFViewer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}