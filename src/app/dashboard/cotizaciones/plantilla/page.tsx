'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CotizacionPdfData } from '@/lib/pdf-template'
import {
  CotizacionFontFamily,
  CotizacionOrientation,
  CotizacionPageSize,
  CotizacionTemplateSettings,
  DEFAULT_COTIZACION_TEMPLATE,
  mergeCotizacionTemplateSettings,
} from '@/lib/cotizacion-template'

const CURRENCY_PRESETS: Array<{ label: string; locale: string; currency: string }> = [
  { label: 'COP (Pesos colombianos)', locale: 'es-CO', currency: 'COP' },
  { label: 'USD (Dólares)', locale: 'en-US', currency: 'USD' },
  { label: 'EUR (Euros)', locale: 'es-ES', currency: 'EUR' },
  { label: 'MXN (Pesos mexicanos)', locale: 'es-MX', currency: 'MXN' },
]

type TemplateResponse = {
  success: boolean
  data?: { settings?: unknown; defaultSettings?: unknown; meta?: { scope?: string; canEdit?: boolean } }
}

type TemplateVersionListResponse = { success: boolean; data?: { versions?: Array<{ id: string; createdAt: string }> } }
type TemplateVersionGetResponse = {
  success: boolean
  data?: { id: string; createdAt: string; settings?: unknown; defaultSettings?: unknown }
}

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
  const [templateMeta, setTemplateMeta] = useState<{ scope?: string; canEdit?: boolean }>({})
  const [defaultSettings, setDefaultSettings] = useState<CotizacionTemplateSettings>(DEFAULT_COTIZACION_TEMPLATE)

  const [versions, setVersions] = useState<Array<{ id: string; createdAt: string }>>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null)

  const previewUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

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
        const nextDefault = mergeCotizacionTemplateSettings(json?.data?.defaultSettings ?? DEFAULT_COTIZACION_TEMPLATE)
        if (!cancelled) setSettings(next)
        if (!cancelled) setDefaultSettings(nextDefault)
        if (!cancelled) setTemplateMeta(json?.data?.meta ?? {})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshVersions() {
    setVersionsLoading(true)
    setVersionsError(null)
    try {
      const res = await fetch('/api/templates/cotizacion/versions?limit=12')
      const json: TemplateVersionListResponse = await res.json().catch(() => ({ success: false }))
      const list = json?.data?.versions
      setVersions(Array.isArray(list) ? list : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setVersionsError(msg)
    } finally {
      setVersionsLoading(false)
    }
  }

  useEffect(() => {
    void refreshVersions()
  }, [])

  async function loadVersion(versionId: string) {
    setLoadingVersionId(versionId)
    try {
      const res = await fetch(`/api/templates/cotizacion/versions/${encodeURIComponent(versionId)}`)
      const json: TemplateVersionGetResponse = await res.json().catch(() => ({ success: false }))
      if (!json?.success) throw new Error('No se pudo cargar la versión')

      const next = mergeCotizacionTemplateSettings(json?.data?.settings ?? DEFAULT_COTIZACION_TEMPLATE)
      setSettings(next)
    } finally {
      setLoadingVersionId(null)
    }
  }

  const mockCotizacion = useMemo<CotizacionPdfData>(() => {
    const now = new Date()
    return {
      numero: 'COT-2026-0001',
      createdAt: now,
      validezDias: 15,
      estado: 'BORRADOR',
      observaciones: mockObservaciones,
      garantia: 'Garantía de 30 días por defectos de fabricación.',
      paymentMethods: ['EFECTIVO', 'TRANSFERENCIA', 'BOLD'],
      boldCheckoutUrl: 'https://checkout.bold.co/xxxxxx',
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
  const headerRightLinesJoined = useMemo(() => {
    const r = settings.header.right
    return [r.line1, r.line2, r.line3, r.line4, r.line5].map((x) => String(x ?? '').trim()).filter(Boolean).join('|')
  }, [settings.header.right])

  const pdfViewerKey = useMemo(() => {
    return [
      settings.page.backgroundImageUrl ? 'bg1' : 'bg0',
      String(settings.page.backgroundImageOpacity ?? 1),
      `m:${String(settings.page.marginSides?.top ?? settings.page.padding)}:${String(settings.page.marginSides?.right ?? settings.page.padding)}:${String(settings.page.marginSides?.bottom ?? settings.page.padding)}:${String(settings.page.marginSides?.left ?? settings.page.padding)}`,
      `p:${String(settings.page.paddingSides?.top ?? 0)}:${String(settings.page.paddingSides?.right ?? 0)}:${String(settings.page.paddingSides?.bottom ?? 0)}:${String(settings.page.paddingSides?.left ?? 0)}`,
      `sa:${String(settings.page.safeAreaSides?.top ?? 0)}:${String(settings.page.safeAreaSides?.right ?? 0)}:${String(settings.page.safeAreaSides?.bottom ?? 0)}:${String(settings.page.safeAreaSides?.left ?? 0)}`,
      `ih:${String(settings.page.useInfoAreaHeightPct ?? false)}:${String(settings.page.infoAreaHeightPct ?? 0.75)}`,
      watermarkEnabled ? 'wm1' : 'wm0',
      settings.watermark.mode,
      settings.watermark.useLogo ? 'wml1' : 'wml0',
      settings.watermark.imageUrl ? 'wmi1' : 'wmi0',
      String(settings.watermark.scale ?? 0.8),
      showLogo ? 'lg1' : 'lg0',
      logoUrl ? 'lu1' : 'lu0',
      settings.header.right.showLogo ? 'rg1' : 'rg0',
      settings.header.right.logoUrl ? 'rlu1' : 'rlu0',
      headerRightLinesJoined ? 'rln1' : 'rln0',
      showVendedor ? 'v1' : 'v0',
      showClienteEmail ? 'ce1' : 'ce0',
      showClienteTelefono ? 'ct1' : 'ct0',
      showClienteEmpresa ? 'cemp1' : 'cemp0',
      showEstado ? 'es1' : 'es0',
      showObservaciones ? 'ob1' : 'ob0',
      `vb:${settings.blocks.vendedor.side}:${String(settings.blocks.vendedor.widthPct)}:${String(settings.blocks.vendedor.telefonoOverride ?? '')}:${String(settings.blocks.vendedor.cargoOverride ?? '')}`,
      `cb:${settings.blocks.cliente.side}:${String(settings.blocks.cliente.widthPct)}`,
      `ob:${settings.blocks.observaciones.side}:${String(settings.blocks.observaciones.widthPct)}`,
    ].join('|')
  }, [
    headerRightLinesJoined,
    logoUrl,
    showLogo,
    showClienteEmail,
    showClienteEmpresa,
    showClienteTelefono,
    showEstado,
    showObservaciones,
    showVendedor,
    settings.header.right.logoUrl,
    settings.header.right.showLogo,
    settings.page.padding,
    settings.page.marginSides?.top,
    settings.page.marginSides?.right,
    settings.page.marginSides?.bottom,
    settings.page.marginSides?.left,
    settings.page.paddingSides?.top,
    settings.page.paddingSides?.right,
    settings.page.paddingSides?.bottom,
    settings.page.paddingSides?.left,
    settings.page.safeAreaSides?.top,
    settings.page.safeAreaSides?.right,
    settings.page.safeAreaSides?.bottom,
    settings.page.safeAreaSides?.left,
    settings.page.backgroundImageOpacity,
    settings.page.backgroundImageUrl,
    settings.watermark.imageUrl,
    settings.page.infoAreaHeightPct,
    settings.watermark.mode,
    settings.watermark.scale,
    settings.watermark.useLogo,
    watermarkEnabled,
    settings.blocks.vendedor.side,
    settings.blocks.vendedor.widthPct,
    settings.blocks.vendedor.telefonoOverride,
    settings.blocks.vendedor.cargoOverride,
    settings.blocks.cliente.side,
    settings.blocks.cliente.widthPct,
    settings.blocks.observaciones.side,
    settings.blocks.observaciones.widthPct,
  ])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const res = await fetch('/api/templates/cotizacion/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ settings, cotizacion: mockCotizacion }),
          signal: ctrl.signal,
        })

        if (!res.ok) {
          const contentType = res.headers.get('content-type') ?? ''
          if (contentType.includes('application/json')) {
            const json = (await res.json().catch(() => null)) as null | { error?: string; details?: string }
            const msg = json?.error || json?.details
            throw new Error(msg || `HTTP ${res.status}`)
          }
          const msg = await res.text().catch(() => '')
          throw new Error(msg || `HTTP ${res.status}`)
        }

        const blob = await res.blob()
        const nextUrl = URL.createObjectURL(blob)

        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = nextUrl
        setPreviewUrl(nextUrl)
      } catch (err) {
        if (ctrl.signal.aborted) return
        setPreviewUrl(null)
        const message = err instanceof Error ? err.message : null
        setPreviewError(message ? `No se pudo generar la vista previa. (${message})` : 'No se pudo generar la vista previa.')
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false)
      }
    }, 250)

    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [settings, mockCotizacion, pdfViewerKey])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/templates/cotizacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const json = (await res.json().catch(() => null)) as TemplateResponse | null
      if (!res.ok) {
        const msg = (json as any)?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }
      await refreshVersions()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  async function saveAsDefault() {
    setSaving(true)
    try {
      const res = await fetch('/api/templates/cotizacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultSettings: settings }),
      })
      const json = (await res.json().catch(() => null)) as TemplateResponse | null
      if (!res.ok) {
        const msg = (json as any)?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }
      if (json?.success) {
        setDefaultSettings(mergeCotizacionTemplateSettings(json?.data?.defaultSettings ?? settings))
      }
      await refreshVersions()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  async function onLogoFileChange(file: File | null) {
    if (!file) return
    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      alert('El logo es muy grande. Intenta con una imagen más liviana (≤ 2MB).')
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

  async function fileToDataUrl(file: File) {
    if (file.type === 'image/svg+xml') {
      const text = await file.text()
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
  }

  async function blobToDataUrl(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('No se pudo leer el blob'))
      reader.readAsDataURL(blob)
    })
  }

  async function fileToPdfSafeBackgroundDataUrl(file: File) {
    if (file.type === 'image/svg+xml') {
      const text = await file.text()
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
    }

    // react-pdf es más confiable con JPEG/PNG. Para evitar fallos (p.ej. WEBP)
    // y reducir el tamaño del POST al preview, re-encodamos a JPEG y limitamos dimensiones.
    const maxDim = 1600
    const quality = 0.82

    // createImageBitmap suele soportar más formatos y es rápido.
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const targetW = Math.max(1, Math.round(bitmap.width * scale))
    const targetH = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo inicializar canvas')

    // Fondo blanco por si la imagen tiene transparencia (JPEG no la soporta)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se pudo convertir la imagen'))),
        'image/jpeg',
        quality
      )
    })

    return await blobToDataUrl(outBlob)
  }

  async function onHeaderRightLogoFileChange(file: File | null) {
    if (!file) return
    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      alert('El logo es muy grande. Intenta con una imagen más liviana (≤ 2MB).')
      return
    }

    const dataUrl = await fileToDataUrl(file)
    setSettings((s) => ({
      ...s,
      header: { ...s.header, right: { ...s.header.right, showLogo: true, logoUrl: dataUrl } },
    }))
  }

  async function onWatermarkImageFileChange(file: File | null) {
    if (!file) return
    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      alert('La imagen de marca de agua es muy grande. Intenta con una imagen más liviana (≤ 2MB).')
      return
    }
    const dataUrl = await fileToDataUrl(file)
    setSettings((s) => ({
      ...s,
      watermark: { ...s.watermark, mode: 'image', imageUrl: dataUrl, enabled: true, useLogo: false },
    }))
  }

  async function onBackgroundImageFileChange(file: File | null) {
    if (!file) return
    const maxBytes = 4 * 1024 * 1024
    if (file.size > maxBytes) {
      alert('La imagen de fondo es muy grande. Intenta con una imagen más liviana (≤ 4MB).')
      return
    }

    let dataUrl = ''
    try {
      dataUrl = await fileToPdfSafeBackgroundDataUrl(file)
    } catch {
      // Fallback: usar el Data URL original si falla la conversión.
      dataUrl = await fileToDataUrl(file)
    }
    setSettings((s) => ({
      ...s,
      page: { ...s.page, backgroundImageUrl: dataUrl },
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
                  {templateMeta.scope === 'empresa' && templateMeta.canEdit === false ? (
                    <p className="text-xs text-muted-foreground mt-1">Plantilla predeterminada por empresa (solo lectura).</p>
                  ) : null}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Plantilla de Cotización (PDF)</h1>
          <p className="text-muted-foreground mt-0.5">Personaliza colores, fuentes, tamaños, fondo y marca de agua.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard/cotizador">Volver al Cotizador</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setSettings(DEFAULT_COTIZACION_TEMPLATE)}>
            Restablecer
          </Button>
          <Button type="button" variant="outline" onClick={() => setSettings(defaultSettings)}>
            Usar predeterminada
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void saveAsDefault()}
            disabled={saving || (templateMeta.scope === 'empresa' && templateMeta.canEdit === false)}
          >
            Guardar como predeterminada
          </Button>
          <Button type="button" onClick={save} disabled={saving || (templateMeta.scope === 'empresa' && templateMeta.canEdit === false)}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionCard title="Historial de plantillas" defaultOpen contentClassName="pt-0 space-y-2">
            <div className="text-xs text-muted-foreground">
              Versiones guardadas al presionar “Guardar” o “Guardar como predeterminada”.
            </div>

            {versionsLoading ? <div className="text-sm text-muted-foreground">Cargando…</div> : null}
            {versionsError ? <div className="text-sm text-destructive">{versionsError}</div> : null}

            {!versionsLoading && versions.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aún no hay versiones guardadas.</div>
            ) : null}

            <div className="space-y-2">
              {versions.map((v) => {
                const label = (() => {
                  const d = new Date(v.createdAt)
                  if (Number.isNaN(d.getTime())) return v.createdAt
                  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(d)
                })()

                const isLoadingThis = loadingVersionId === v.id
                return (
                  <div key={v.id} className="flex items-center justify-between gap-2">
                    <div className="text-sm">{label}</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadVersion(v.id)}
                      disabled={Boolean(loadingVersionId)}
                    >
                      {isLoadingThis ? 'Cargando…' : 'Cargar'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </SectionCard>

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
              <div className="md:col-span-3 space-y-2">
                <Label>Margen (por lado)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Arriba</Label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={settings.page.marginSides?.top ?? settings.page.padding}
                      onChange={(e) =>
                        setSettings((s) => {
                          const current =
                            s.page.marginSides ??
                            ({ top: s.page.padding, right: s.page.padding, bottom: s.page.padding, left: s.page.padding } as const)
                          const next = { ...current, top: Number(e.target.value) }
                          const avg = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                          return { ...s, page: { ...s.page, padding: avg, marginSides: next } }
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
                      value={settings.page.marginSides?.right ?? settings.page.padding}
                      onChange={(e) =>
                        setSettings((s) => {
                          const current =
                            s.page.marginSides ??
                            ({ top: s.page.padding, right: s.page.padding, bottom: s.page.padding, left: s.page.padding } as const)
                          const next = { ...current, right: Number(e.target.value) }
                          const avg = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                          return { ...s, page: { ...s.page, padding: avg, marginSides: next } }
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
                      value={settings.page.marginSides?.bottom ?? settings.page.padding}
                      onChange={(e) =>
                        setSettings((s) => {
                          const current =
                            s.page.marginSides ??
                            ({ top: s.page.padding, right: s.page.padding, bottom: s.page.padding, left: s.page.padding } as const)
                          const next = { ...current, bottom: Number(e.target.value) }
                          const avg = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                          return { ...s, page: { ...s.page, padding: avg, marginSides: next } }
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
                      value={settings.page.marginSides?.left ?? settings.page.padding}
                      onChange={(e) =>
                        setSettings((s) => {
                          const current =
                            s.page.marginSides ??
                            ({ top: s.page.padding, right: s.page.padding, bottom: s.page.padding, left: s.page.padding } as const)
                          const next = { ...current, left: Number(e.target.value) }
                          const avg = Math.round((next.top + next.right + next.bottom + next.left) / 4)
                          return { ...s, page: { ...s.page, padding: avg, marginSides: next } }
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 space-y-2">
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
                        setSettings((s) => {
                          const current = s.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                          const next = { ...current, top: Number(e.target.value) }
                          return { ...s, page: { ...s.page, paddingSides: next } }
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
                        setSettings((s) => {
                          const current = s.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                          const next = { ...current, right: Number(e.target.value) }
                          return { ...s, page: { ...s.page, paddingSides: next } }
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
                        setSettings((s) => {
                          const current = s.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                          const next = { ...current, bottom: Number(e.target.value) }
                          return { ...s, page: { ...s.page, paddingSides: next } }
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
                        setSettings((s) => {
                          const current = s.page.paddingSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                          const next = { ...current, left: Number(e.target.value) }
                          return { ...s, page: { ...s.page, paddingSides: next } }
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="md:col-span-3 space-y-2">
                <Label>Imagen de fondo (opcional)</Label>
                <div className="flex flex-col gap-2">
                  <input
                    id="backgroundImageUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onBackgroundImageFileChange(e.target.files?.[0] ?? null)}
                  />

                  <div className="flex items-center gap-2">
                    <Button asChild type="button" variant="outline">
                      <label htmlFor="backgroundImageUpload" className="cursor-pointer">
                        Subir imagen de fondo
                      </label>
                    </Button>
                    {settings.page.backgroundImageUrl ? (
                      <span className="text-xs text-muted-foreground">Imagen cargada</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin imagen</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">URL o Data URL</Label>
                      <Input
                        placeholder="https://... o data:image/..."
                        value={settings.page.backgroundImageUrl ?? ''}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            page: { ...s.page, backgroundImageUrl: e.target.value },
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
                            page: { ...s.page, backgroundImageUrl: undefined },
                          }))
                        }
                      >
                        Quitar fondo
                      </Button>
                    </div>

                <div className="md:col-span-3 space-y-2">
                  <Label>Área segura del membrete (por lado)</Label>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.page.useInfoAreaHeightPct ?? false}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            page: { ...s.page, useInfoAreaHeightPct: e.target.checked },
                          }))
                        }
                      />
                      Forzar área de información por altura (75% por defecto)
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">% información</Label>
                        <Input
                          type="number"
                          min={50}
                          max={95}
                          step={1}
                          value={Math.round((settings.page.infoAreaHeightPct ?? 0.75) * 100)}
                          onChange={(e) => {
                            const pct = Number(e.target.value)
                            setSettings((s) => ({
                              ...s,
                              page: { ...s.page, infoAreaHeightPct: pct / 100 },
                            }))
                          }}
                        />
                      </div>
                      <div className="md:col-span-3 text-xs text-gray-500">
                        Reserva automáticamente el espacio superior/inferior para que el contenido quede dentro del % definido.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Arriba</Label>
                      <Input
                        type="number"
                        min={0}
                        max={250}
                        value={settings.page.safeAreaSides?.top ?? 0}
                        onChange={(e) =>
                          setSettings((s) => {
                            const current = s.page.safeAreaSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                            const next = { ...current, top: Number(e.target.value) }
                            return { ...s, page: { ...s.page, safeAreaSides: next } }
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Derecha</Label>
                      <Input
                        type="number"
                        min={0}
                        max={250}
                        value={settings.page.safeAreaSides?.right ?? 0}
                        onChange={(e) =>
                          setSettings((s) => {
                            const current = s.page.safeAreaSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                            const next = { ...current, right: Number(e.target.value) }
                            return { ...s, page: { ...s.page, safeAreaSides: next } }
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Abajo</Label>
                      <Input
                        type="number"
                        min={0}
                        max={250}
                        value={settings.page.safeAreaSides?.bottom ?? 0}
                        onChange={(e) =>
                          setSettings((s) => {
                            const current = s.page.safeAreaSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                            const next = { ...current, bottom: Number(e.target.value) }
                            return { ...s, page: { ...s.page, safeAreaSides: next } }
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Izquierda</Label>
                      <Input
                        type="number"
                        min={0}
                        max={250}
                        value={settings.page.safeAreaSides?.left ?? 0}
                        onChange={(e) =>
                          setSettings((s) => {
                            const current = s.page.safeAreaSides ?? ({ top: 0, right: 0, bottom: 0, left: 0 } as const)
                            const next = { ...current, left: Number(e.target.value) }
                            return { ...s, page: { ...s.page, safeAreaSides: next } }
                          })
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Úsalo para reservar el espacio del membrete (fondo). El contenido se empuja y, si no cabe, pasa a la siguiente hoja.
                  </p>
                </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Opacidad (0 - 1)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={settings.page.backgroundImageOpacity}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            page: { ...s.page, backgroundImageOpacity: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Recomendado: PNG/JPG liviano. La imagen se ajusta a toda la página.</p>
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

          <SectionCard title="Encabezado y pie (2 secciones)" contentClassName="pt-0 grid grid-cols-1 gap-4">
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
                    id="logoUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onLogoFileChange(e.target.files?.[0] ?? null)}
                  />

                  <div className="flex items-center gap-2">
                    <Button asChild type="button" variant="outline">
                      <label htmlFor="logoUpload" className="cursor-pointer">
                        Subir logo
                      </label>
                    </Button>
                    {settings.header.logoUrl ? (
                      <span className="text-xs text-muted-foreground">Logo cargado</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin logo</span>
                    )}
                  </div>

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
                <Label>Encabezado derecho (logo y líneas)</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.header.right.showLogo}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          header: { ...s.header, right: { ...s.header.right, showLogo: e.target.checked } },
                        }))
                      }
                    />
                    Mostrar logo en el encabezado derecho
                  </label>

                  <input
                    id="headerRightLogoUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onHeaderRightLogoFileChange(e.target.files?.[0] ?? null)}
                  />

                  <div className="flex items-center gap-2">
                    <Button asChild type="button" variant="outline">
                      <label htmlFor="headerRightLogoUpload" className="cursor-pointer">
                        Subir logo derecho
                      </label>
                    </Button>
                    {settings.header.right.logoUrl ? (
                      <span className="text-xs text-muted-foreground">Logo cargado</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin logo</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">URL o Data URL (logo derecho)</Label>
                      <Input
                        placeholder="https://... o data:image/..."
                        value={settings.header.right.logoUrl ?? ''}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            header: { ...s.header, right: { ...s.header.right, logoUrl: e.target.value } },
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
                            header: { ...s.header, right: { ...s.header.right, logoUrl: undefined, showLogo: false } },
                          }))
                        }
                      >
                        Quitar logo derecho
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Línea 1</Label>
                      <Input value={settings.header.right.line1} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, right: { ...s.header.right, line1: e.target.value } } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Línea 2</Label>
                      <Input value={settings.header.right.line2} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, right: { ...s.header.right, line2: e.target.value } } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Línea 3</Label>
                      <Input value={settings.header.right.line3} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, right: { ...s.header.right, line3: e.target.value } } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Línea 4</Label>
                      <Input value={settings.header.right.line4} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, right: { ...s.header.right, line4: e.target.value } } }))} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs text-gray-500">Línea 5</Label>
                      <Input value={settings.header.right.line5} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, right: { ...s.header.right, line5: e.target.value } } }))} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pie de página izquierdo</Label>
                <Textarea
                  value={settings.footer.leftText}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      footer: {
                        ...s.footer,
                        leftText: e.target.value,
                        text: s.footer.rightText ? s.footer.text : e.target.value,
                      },
                    }))
                  }
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Pie de página derecho</Label>
                <Textarea
                  value={settings.footer.rightText}
                  onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, rightText: e.target.value } }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Espacio inferior del footer (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={settings.footer.bottomOffset ?? 0}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      footer: { ...s.footer, bottomOffset: Number(e.target.value || 0) },
                    }))
                  }
                />
                <p className="text-xs text-gray-500">
                  Aumenta este valor si el texto del footer se monta sobre el fondo.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Espacio reservado para el footer (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={260}
                  value={(settings.footer as any).reserveHeight ?? 60}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      footer: { ...s.footer, reserveHeight: Number(e.target.value || 0) },
                    }))
                  }
                />
                <p className="text-xs text-gray-500">
                  Este espacio evita que el contenido (p. ej. Observaciones) quede debajo del footer en páginas largas.
                </p>
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
                <Label>Moneda</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.currency.currency}
                  onChange={(e) => {
                    const nextCurrency = e.target.value
                    const preset = CURRENCY_PRESETS.find((p) => p.currency === nextCurrency)
                    setSettings((s) => ({
                      ...s,
                      currency: {
                        ...s.currency,
                        currency: nextCurrency,
                        locale: preset?.locale ?? s.currency.locale,
                      },
                    }))
                  }}
                >
                  {CURRENCY_PRESETS.map((p) => (
                    <option key={p.currency} value={p.currency}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Al cambiar moneda se sugiere un locale compatible (editable).</p>
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
                <Label>Tipo</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.watermark.mode}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      watermark: { ...s.watermark, mode: e.target.value as 'text' | 'image' },
                    }))
                  }
                >
                  <option value="text">Texto</option>
                  <option value="image">Imagen / Logo</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Texto</Label>
                <Input value={settings.watermark.text} onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, text: e.target.value } }))} />
              </div>

              <div className="space-y-2">
                <Label>Tamaño relativo (0.2 - 1)</Label>
                <Input
                  type="number"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={settings.watermark.scale}
                  onChange={(e) => setSettings((s) => ({ ...s, watermark: { ...s.watermark, scale: Number(e.target.value) } }))}
                />
                <p className="text-xs text-gray-500">0.8 = 80% centrado</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Imagen de marca de agua (opcional)</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.watermark.useLogo}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          watermark: { ...s.watermark, mode: 'image', useLogo: e.target.checked, enabled: true },
                        }))
                      }
                    />
                    Usar el logo del encabezado como marca de agua
                  </label>

                  <input
                    id="watermarkImageUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onWatermarkImageFileChange(e.target.files?.[0] ?? null)}
                  />

                  <div className="flex items-center gap-2">
                    <Button asChild type="button" variant="outline">
                      <label htmlFor="watermarkImageUpload" className="cursor-pointer">
                        Subir imagen de marca de agua
                      </label>
                    </Button>
                    {settings.watermark.imageUrl ? (
                      <span className="text-xs text-muted-foreground">Imagen cargada</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin imagen</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">URL o Data URL (marca de agua)</Label>
                      <Input
                        placeholder="https://... o data:image/..."
                        value={settings.watermark.imageUrl ?? ''}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            watermark: { ...s.watermark, mode: 'image', imageUrl: e.target.value, enabled: true, useLogo: false },
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
                            watermark: { ...s.watermark, imageUrl: undefined, useLogo: false },
                          }))
                        }
                      >
                        Quitar imagen
                      </Button>
                    </div>
                  </div>
                </div>
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

          <SectionCard title="Bloques (Vendedor / Cliente / Observaciones)" contentClassName="pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Vendedor: lado</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.blocks.vendedor.side}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        vendedor: { ...s.blocks.vendedor, side: e.target.value as 'left' | 'right' },
                      },
                    }))
                  }
                >
                  <option value="left">Izquierdo</option>
                  <option value="right">Derecho</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Vendedor: ancho</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.blocks.vendedor.widthPct}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        vendedor: { ...s.blocks.vendedor, widthPct: Number(e.target.value) as 25 | 50 | 75 | 100 },
                      },
                    }))
                  }
                >
                  <option value={25}>25%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Vendedor: teléfono (override)</Label>
                <Input
                  value={settings.blocks.vendedor.telefonoOverride ?? ''}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        vendedor: { ...s.blocks.vendedor, telefonoOverride: e.target.value },
                      },
                    }))
                  }
                  placeholder="Ej: 300 000 0000"
                />
              </div>

              <div className="space-y-2">
                <Label>Vendedor: cargo (override)</Label>
                <Input
                  value={settings.blocks.vendedor.cargoOverride ?? ''}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        vendedor: { ...s.blocks.vendedor, cargoOverride: e.target.value },
                      },
                    }))
                  }
                  placeholder="Ej: Asesor comercial"
                />
              </div>

              <div className="space-y-2">
                <Label>Cliente: lado</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.blocks.cliente.side}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        cliente: { ...s.blocks.cliente, side: e.target.value as 'left' | 'right' },
                      },
                    }))
                  }
                >
                  <option value="left">Izquierdo</option>
                  <option value="right">Derecho</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Cliente: ancho</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.blocks.cliente.widthPct}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        cliente: { ...s.blocks.cliente, widthPct: Number(e.target.value) as 25 | 50 | 75 | 100 },
                      },
                    }))
                  }
                >
                  <option value={25}>25%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Observaciones: lado</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.blocks.observaciones.side}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        observaciones: { ...s.blocks.observaciones, side: e.target.value as 'left' | 'right' },
                      },
                    }))
                  }
                >
                  <option value="left">Izquierdo</option>
                  <option value="right">Derecho</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Observaciones: ancho</Label>
                <select
                  className="px-3 py-2 border rounded-md w-full"
                  value={settings.blocks.observaciones.widthPct}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blocks: {
                        ...s.blocks,
                        observaciones: {
                          ...s.blocks.observaciones,
                          widthPct: Number(e.target.value) as 25 | 50 | 75 | 100,
                        },
                      },
                    }))
                  }
                >
                  <option value={25}>25%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                </select>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="lg:sticky lg:top-4 self-start">
          <SectionCard title="Vista previa" defaultOpen contentClassName="pt-0">
            <div className="w-full h-[760px] border rounded-md overflow-hidden" key={pdfViewerKey}>
              {previewLoading ? (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Generando vista previa…</div>
              ) : null}
              {!previewLoading && previewError ? (
                <div className="w-full h-full flex items-center justify-center text-sm text-red-600">{previewError}</div>
              ) : null}
              {!previewLoading && !previewError && !previewUrl ? (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Sin vista previa.</div>
              ) : null}
              {!previewLoading && !previewError && previewUrl ? (
                <iframe title="Vista previa PDF" src={previewUrl} className="w-full h-full" />
              ) : null}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              La vista previa es una cotización de ejemplo. Al descargar/enviar un PDF real se aplicarán estos ajustes.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
