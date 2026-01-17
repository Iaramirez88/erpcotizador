'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CotizacionPDF from '@/lib/pdf-template'
import {
  CotizacionFontFamily,
  CotizacionOrientation,
  CotizacionPageSize,
  CotizacionTemplateSettings,
  DEFAULT_COTIZACION_TEMPLATE,
  mergeCotizacionTemplateSettings,
} from '@/lib/cotizacion-template'

const PDFViewer = dynamic(async () => {
  const mod = await import('@react-pdf/renderer')
  return mod.PDFViewer
}, { ssr: false })

type TemplateResponse = { success: boolean; data?: { settings?: unknown } }

type SectionCardProps = {
  title: string
  defaultOpen?: boolean
  contentClassName?: string
  children: React.ReactNode
}

function SectionCard({ title, defaultOpen = false, contentClassName, children }: SectionCardProps) {
  return (
    <Card>
      <details open={defaultOpen} className="group">
        <summary className="cursor-pointer select-none [&::-webkit-details-marker]:hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center justify-between gap-3">
              <span>{title}</span>
              <span className="text-muted-foreground text-xs font-normal">
                <span className="group-open:hidden">▸</span>
                <span className="hidden group-open:inline">▾</span>
              </span>
            </CardTitle>
          </CardHeader>
        </summary>
        <CardContent className={contentClassName}>{children}</CardContent>
      </details>
    </Card>
  )
}

export default function PlantillaCotizacionPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<CotizacionTemplateSettings>(DEFAULT_COTIZACION_TEMPLATE)

  const [mockObservaciones, setMockObservaciones] = useState<string>(
    'Observación de ejemplo: tiempos de entrega sujetos a confirmación.'
  )
  const [mockNotas, setMockNotas] = useState<string>('Nota de ejemplo: incluye diseño básico.')
  const [mockClienteNombre, setMockClienteNombre] = useState<string>('Cliente de Prueba')
  const [mockClienteEmpresa, setMockClienteEmpresa] = useState<string>('Empresa Demo S.A.S')
  const [mockClienteEmail, setMockClienteEmail] = useState<string>('cliente@correo.com')
  const [mockClienteTelefono, setMockClienteTelefono] = useState<string>('300 000 0000')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/templates/cotizacion')
        const json: TemplateResponse = await res.json().catch(() => ({ success: false }))
        const next = mergeCotizacionTemplateSettings(json?.data?.settings ?? DEFAULT_COTIZACION_TEMPLATE)
        if (!cancelled) setSettings(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const mockCotizacion = useMemo<Parameters<typeof CotizacionPDF>[0]['cotizacion']>(() => {
    const now = new Date()
    return {
      numero: 'COT-2026-0001',
      createdAt: now,
      validezDias: 15,
      estado: 'BORRADOR',
      observaciones: mockObservaciones,
      cliente: {
        nombre: mockClienteNombre,
        email: mockClienteEmail,
        telefono: mockClienteTelefono,
        empresa: mockClienteEmpresa,
      },
      vendedor: {
        name: 'Vendedor Demo',
        email: 'vendedor@sgdigital.com',
      },
      items: [
        {
          cantidad: 2,
          ancho: 1.2,
          alto: 0.8,
          metrosCuadrados: 1.92,
          precioUnitario: 150000,
          subtotal: 300000,
          laminado: true,
          troquelado: false,
          instalacion: true,
          material: { nombre: 'Banner 13oz', tipo: 'BANNER' },
        },
        {
          cantidad: 1,
          ancho: null,
          alto: null,
          metrosCuadrados: undefined,
          precioUnitario: 85000,
          subtotal: 85000,
          laminado: false,
          troquelado: true,
          instalacion: false,
          material: { nombre: 'Vinilo adhesivo', tipo: 'VINILO' },
        },
      ],
      subtotal: 385000,
      iva: 73150,
      total: 458150,
      notas: mockNotas,
    }
  }, [
    mockClienteEmail,
    mockClienteEmpresa,
    mockClienteNombre,
    mockClienteTelefono,
    mockNotas,
    mockObservaciones,
  ])

  const {
    showVendedor,
    showClienteEmail,
    showClienteTelefono,
    showClienteEmpresa,
    showEstado,
    showObservaciones,
  } = settings.toggles
  const { enabled: watermarkEnabled } = settings.watermark
  const { showLogo, logoUrl } = settings.header

  const pdfViewerKey = useMemo(() => {
    return [
      watermarkEnabled ? 'wm1' : 'wm0',
      showLogo ? 'lg1' : 'lg0',
      logoUrl ? 'lu1' : 'lu0',
      showVendedor ? 'v1' : 'v0',
      showClienteEmail ? 'ce1' : 'ce0',
      showClienteTelefono ? 'ct1' : 'ct0',
      showClienteEmpresa ? 'cemp1' : 'cemp0',
      showEstado ? 'es1' : 'es0',
      showObservaciones ? 'ob1' : 'ob0',
    ].join('|')
  }, [
    logoUrl,
    showLogo,
    showClienteEmail,
    showClienteEmpresa,
    showClienteTelefono,
    showEstado,
    showObservaciones,
    showVendedor,
    watermarkEnabled,
  ])

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/templates/cotizacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
    } finally {
      setSaving(false)
    }
  }

  async function onLogoFileChange(file: File | null) {
    if (!file) return
    const maxBytes = 700 * 1024
    if (file.size > maxBytes) {
      alert('El logo es muy grande. Intenta con una imagen más liviana (≤ 700KB).')
      return
    }

    if (file.type === 'image/svg+xml') {
      const text = await file.text()
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
      setSettings((s) => ({
        ...s,
        header: { ...s.header, showLogo: true, logoUrl: dataUrl },
      }))
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })

    setSettings((s) => ({
      ...s,
      header: { ...s.header, showLogo: true, logoUrl: dataUrl },
    }))
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Plantilla de Cotización (PDF)</h1>
          <p className="text-muted-foreground mt-0.5">Personaliza colores, fuentes, tamaños, fondo y marca de agua.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSettings(DEFAULT_COTIZACION_TEMPLATE)}>
            Restablecer
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionCard title="Hoja" defaultOpen contentClassName="pt-0 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tamaño</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.page.size}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      page: { ...s.page, size: e.target.value as CotizacionPageSize },
                    }))
                  }
                >
                  <option value="A4">A4</option>
                  <option value="LETTER">Carta</option>
                  <option value="LEGAL">Oficio</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Orientación</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.page.orientation}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      page: { ...s.page, orientation: e.target.value as CotizacionOrientation },
                    }))
                  }
                >
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Margen/Padding</Label>
                <Input
                  type="number"
                  min={12}
                  max={80}
                  value={settings.page.padding}
                  onChange={(e) => setSettings((s) => ({ ...s, page: { ...s.page, padding: Number(e.target.value) } }))}
                />
              </div>
          </SectionCard>

          <SectionCard title="Colores" contentClassName="pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color principal</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.primary}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, primary: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.primary}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, primary: e.target.value } }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fondo de página</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.pageBackground}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, pageBackground: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.pageBackground}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, pageBackground: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Texto</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.text}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, text: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.text}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, text: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Texto secundario</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.mutedText}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, mutedText: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.mutedText}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, mutedText: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fondo secciones</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.sectionBackground}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, sectionBackground: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.sectionBackground}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, sectionBackground: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Borde tabla</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.tableBorder}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, tableBorder: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.tableBorder}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, tableBorder: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fondo observaciones</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.warningBackground}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, colors: { ...s.colors, warningBackground: e.target.value } }))
                    }
                  />
                  <Input
                    value={settings.colors.warningBackground}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, colors: { ...s.colors, warningBackground: e.target.value } }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Borde observaciones</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.warningBorder}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, warningBorder: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.warningBorder}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, warningBorder: e.target.value } }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Encabezado tabla</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.tableHeaderBackground}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, colors: { ...s.colors, tableHeaderBackground: e.target.value } }))
                    }
                  />
                  <Input
                    value={settings.colors.tableHeaderBackground}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, colors: { ...s.colors, tableHeaderBackground: e.target.value } }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Texto encabezado tabla</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.colors.tableHeaderText}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, tableHeaderText: e.target.value } }))}
                  />
                  <Input
                    value={settings.colors.tableHeaderText}
                    onChange={(e) => setSettings((s) => ({ ...s, colors: { ...s.colors, tableHeaderText: e.target.value } }))}
                  />
                </div>
              </div>
          </SectionCard>

          <SectionCard title="Tipografía" contentClassName="pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuente</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.typography.fontFamily}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      typography: { ...s.typography, fontFamily: e.target.value as CotizacionFontFamily },
                    }))
                  }
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times-Roman">Times</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tamaño base</Label>
                <Input
                  type="number"
                  min={8}
                  max={14}
                  value={settings.typography.baseFontSize}
                  onChange={(e) => setSettings((s) => ({ ...s, typography: { ...s.typography, baseFontSize: Number(e.target.value) } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  type="number"
                  min={16}
                  max={40}
                  value={settings.typography.titleFontSize}
                  onChange={(e) => setSettings((s) => ({ ...s, typography: { ...s.typography, titleFontSize: Number(e.target.value) } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Secciones</Label>
                <Input
                  type="number"
                  min={10}
                  max={18}
                  value={settings.typography.sectionTitleFontSize}
                  onChange={(e) => setSettings((s) => ({ ...s, typography: { ...s.typography, sectionTitleFontSize: Number(e.target.value) } }))}
                />
              </div>
          </SectionCard>

          <SectionCard title="Encabezado y textos" contentClassName="pt-0 grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.header.showLogo}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          header: { ...s.header, showLogo: e.target.checked },
                        }))
                      }
                    />
                    Mostrar logo en el PDF
                  </label>

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={(e) => void onLogoFileChange(e.target.files?.[0] ?? null)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">URL o Data URL</Label>
                      <Input
                        placeholder="https://... o data:image/..."
                        value={settings.header.logoUrl ?? ''}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            header: { ...s.header, logoUrl: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            header: { ...s.header, logoUrl: undefined, showLogo: false },
                          }))
                        }
                      >
                        Quitar logo
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG/JPG recomendado. SVG se intenta renderizar; si tu SVG es complejo, puede que no se muestre en el PDF.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Título (ej. COTIZACIÓN)</Label>
                <Input value={settings.header.title} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, title: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Nombre empresa</Label>
                <Input value={settings.header.companyName} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, companyName: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo 1</Label>
                <Input value={settings.header.subtitle1} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, subtitle1: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo 2</Label>
                <Input value={settings.header.subtitle2} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, subtitle2: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Texto pie de página</Label>
                <Textarea
                  value={settings.footer.text}
                  onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, text: e.target.value } }))}
                  rows={3}
                />
              </div>
          </SectionCard>

          <SectionCard title="Contenido (vista previa)" contentClassName="pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cliente (nombre)</Label>
                <Input value={mockClienteNombre} onChange={(e) => setMockClienteNombre(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cliente (empresa)</Label>
                <Input value={mockClienteEmpresa} onChange={(e) => setMockClienteEmpresa(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cliente (email)</Label>
                <Input value={mockClienteEmail} onChange={(e) => setMockClienteEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cliente (teléfono)</Label>
                <Input value={mockClienteTelefono} onChange={(e) => setMockClienteTelefono(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observaciones</Label>
                <Textarea value={mockObservaciones} onChange={(e) => setMockObservaciones(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notas</Label>
                <Textarea value={mockNotas} onChange={(e) => setMockNotas(e.target.value)} rows={2} />
              </div>
          </SectionCard>

          <SectionCard title="Moneda" contentClassName="pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Locale (ej. es-MX, es-CO)</Label>
                <Input
                  value={settings.currency.locale}
                  onChange={(e) => setSettings((s) => ({ ...s, currency: { ...s.currency, locale: e.target.value } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Moneda (ej. MXN, COP, USD)</Label>
                <Input
                  value={settings.currency.currency}
                  onChange={(e) => setSettings((s) => ({ ...s, currency: { ...s.currency, currency: e.target.value } }))}
                />
              </div>
          </SectionCard>

          <SectionCard title="Marca de agua" contentClassName="pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.watermark.enabled}
                  onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, enabled: e.target.checked } }))}
                />
                Activar
              </label>
              <div className="space-y-2">
                <Label>Texto</Label>
                <Input value={settings.watermark.text} onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, text: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Opacidad (0 - 0.25)</Label>
                <Input
                  type="number"
                  min={0}
                  max={0.25}
                  step={0.01}
                  value={settings.watermark.opacity}
                  onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, opacity: Number(e.target.value) } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tamaño</Label>
                <Input
                  type="number"
                  min={24}
                  max={120}
                  value={settings.watermark.fontSize}
                  onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, fontSize: Number(e.target.value) } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Rotación (grados)</Label>
                <Input
                  type="number"
                  min={-90}
                  max={90}
                  value={settings.watermark.rotateDeg}
                  onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, rotateDeg: Number(e.target.value) } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.watermark.color}
                    onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, color: e.target.value } }))}
                  />
                  <Input value={settings.watermark.color} onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, color: e.target.value } }))} />
                </div>
              </div>
          </SectionCard>

          <SectionCard title="Campos visibles" contentClassName="pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
              {(
                [
                  ['showVendedor', 'Mostrar vendedor'],
                  ['showClienteEmail', 'Mostrar email del cliente'],
                  ['showClienteTelefono', 'Mostrar teléfono del cliente'],
                  ['showClienteEmpresa', 'Mostrar empresa del cliente'],
                  ['showEstado', 'Mostrar estado'],
                  ['showObservaciones', 'Mostrar observaciones'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.toggles[key]}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        toggles: { ...s.toggles, [key]: e.target.checked },
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
          </SectionCard>
        </div>

        <SectionCard title="Vista previa" defaultOpen contentClassName="pt-0">
            <div className="w-full h-[760px] border rounded-md overflow-hidden">
              <PDFViewer width="100%" height="100%" key={pdfViewerKey}>
                <CotizacionPDF cotizacion={mockCotizacion} template={settings} />
              </PDFViewer>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              La vista previa es una cotización de ejemplo. Al descargar/enviar un PDF real se aplicarán estos ajustes.
            </p>
        </SectionCard>
      </div>
    </div>
  )
}
