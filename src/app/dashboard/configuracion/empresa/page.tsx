'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CardInfoHeader } from '@/components/ui/card-info-header'
import { Input } from '@/components/ui/input'
import { InfoHint } from '@/components/ui/info-hint'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { getBusinessTypeLabel } from '@/lib/company-onboarding'

type EmpresaConfig = {
  empresaId: string
  workspaceCode: string
  nombre: string
  nit: string
  logo: string | null
  intelligenceEnabled: boolean
  hasRegistrationCode: boolean
}

type OnboardingConfig = {
  status: string
  businessType: string | null
  locked: boolean
  completedAt?: string | null
  dashboard: {
    headline: string
    description: string
    checklist: string[]
  } | null
}

export default function ConfigEmpresaPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [config, setConfig] = useState<EmpresaConfig | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingConfig | null>(null)
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [intelligenceEnabled, setIntelligenceEnabled] = useState(false)

  const logoPreview = useMemo(() => (logo ?? config?.logo ?? null), [logo, config?.logo])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/configuracion/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
        if (cancelled) return
        if (!res.ok || !json?.ok || !json.data) {
          setError(json?.error ?? 'No se pudo cargar la configuración.')
          return
        }
        setConfig(json.data)
        setNombre(json.data.nombre)
        setNit(json.data.nit)
        setLogo(json.data.logo)
        setIntelligenceEnabled(Boolean(json.data.intelligenceEnabled))
      } catch {
        if (!cancelled) setError('No se pudo cargar la configuración.')
      }
      try {
        const res = await fetch('/api/onboarding/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean
          status?: string
          locked?: boolean
          completedAt?: string | null
          businessType?: string | null
          dashboard?: OnboardingConfig['dashboard']
        } | null
        if (!cancelled && res.ok && json?.ok) {
          setOnboarding({
            status: json.status ?? 'COMPLETED',
            locked: Boolean(json.locked),
            completedAt: json.completedAt ?? null,
            businessType: json.businessType ?? null,
            dashboard: json.dashboard ?? null,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveBranding() {
    if (!config) return
    const nextNombre = nombre.trim()
    const nextNit = nit.trim()
    if (!nextNombre) {
      setError('El nombre no puede estar vacío.')
      return
    }
    if (!nextNit) {
      setError('El NIT no puede estar vacío.')
      return
    }

    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nextNombre, nit: nextNit, logo, intelligenceEnabled }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setError(json?.error ?? 'No se pudo guardar.')
        return
      }
      setConfig(json.data)
      setIntelligenceEnabled(Boolean(json.data.intelligenceEnabled))
      setStatus('Guardado.')

      window.dispatchEvent(
        new CustomEvent('empresa:branding-updated', {
          detail: { nombre: json.data.nombre, logo: json.data.logo, nit: json.data.nit },
        })
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoFile(file: File) {
    const maxBytes = 400 * 1024
    if (file.size > maxBytes) {
      setError('Logo demasiado grande (máx 400KB).')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Formato no soportado. Usa PNG/JPG/WebP.')
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })

    setLogo(dataUrl)
    setError(null)
    setStatus(null)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <ErpPageHero
        eyebrow="ERP configuración"
        title="Empresa"
        description="Personaliza el branding y comparte el código correcto para solicitar acceso."
        stats={[
          { label: 'Código', value: config?.workspaceCode || 'Cargando...', hint: 'Acceso al workspace', tone: 'neutral' },
          { label: 'Nombre', value: nombre || config?.nombre || 'Sin nombre', hint: 'Branding actual', tone: 'sky' },
          { label: 'Logo', value: logoPreview ? 'Configurado' : 'Pendiente', hint: 'Identidad visual', tone: 'amber' },
        ]}
      />

      <Card>
        <CardHeader>
          <CardInfoHeader
            title={<CardTitle>Branding</CardTitle>}
            description="Este nombre y logo se usan en pantallas públicas y el dashboard."
            tone="action"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
          {error ? <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">{error}</div> : null}
          {status ? <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">{status}</div> : null}

          {config ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Código de acceso del espacio (WS-...)</Label>
                  <InfoHint content="Este es el único código que debes compartir para que otra persona se registre o active su acceso al espacio. Es único y no cambia." label="Ver ayuda del código de acceso" />
                </div>
                <Input value={config.workspaceCode} readOnly disabled className="font-mono" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={saving} />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input value={nit} onChange={(e) => setNit(e.target.value)} disabled={saving} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Logo</Label>
                  <InfoHint content="Recomendado: 512x512. Máximo 400KB." label="Ver recomendación del logo" />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative h-14 w-14 rounded-md overflow-hidden border bg-white">
                    {logoPreview ? (
                      <Image src={logoPreview} alt="Logo" fill className="object-contain" sizes="56px" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">Sin logo</div>
                    )}
                  </div>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={saving}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      void handleLogoFile(file)
                      e.currentTarget.value = ''
                    }}
                    className="max-w-sm"
                  />
                  <Button type="button" variant="outline" disabled={saving || !logoPreview} onClick={() => setLogo(null)}>
                    Quitar
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="button" disabled={saving || loading || !config} onClick={() => void saveBranding()}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardInfoHeader
            title={<CardTitle>Motor de inteligencia empresarial</CardTitle>}
            description="Actívalo solo si tu empresa desea recibir esta lectura ejecutiva asistida y sus alertas. Es una ayuda orientativa y no reemplaza la validación gerencial."
            tone="action"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="intelligence-enabled" className="text-sm font-medium text-slate-950">Permitir lectura ejecutiva y alertas asistidas</Label>
              <CardDescription>
                Cuando está apagado, se oculta el módulo de inteligencia del dashboard y se detienen sus notificaciones automáticas.
              </CardDescription>
            </div>
            <Switch
              id="intelligence-enabled"
              checked={intelligenceEnabled}
              onCheckedChange={setIntelligenceEnabled}
              disabled={saving || loading || !config}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardInfoHeader
            title={<CardTitle>Preset de operación</CardTitle>}
            description="El nicho inicial define qué módulos se muestran en este espacio y qué frentes quedan ocultos para el equipo."
            tone="data"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Cargando preset…</p> : null}
          {!loading && onboarding ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Tipo de negocio</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {onboarding.businessType ? getBusinessTypeLabel(onboarding.businessType as Parameters<typeof getBusinessTypeLabel>[0]) : 'Sin definir'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Estado</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {onboarding.locked ? 'Cerrado' : onboarding.status === 'COMPLETED' ? 'Configurado' : 'Pendiente'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Inicio</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {onboarding.dashboard?.headline ?? 'Sin resumen aún'}
                  </div>
                </div>
              </div>

              {onboarding.locked ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  La configuración inicial ya quedó fijada y no se puede cambiar desde esta pantalla. Si necesitas mover el espacio a otro nicho o ajustar módulos base, solicítalo por soporte en ivanimage@hotmail.com o WhatsApp 3115385427.
                </div>
              ) : (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  Mientras no se cierre la configuración inicial, aquí podrás completar el preset para dejar visibles solo los módulos que sí aplican a tu negocio.
                </div>
              )}

              {onboarding.dashboard?.checklist?.length ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-900">Checklist sugerido</div>
                  {onboarding.dashboard.checklist.map((item) => (
                    <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
        <CardFooter>
          {onboarding?.locked ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" variant="outline">
                <a href="mailto:ivanimage@hotmail.com?subject=Solicitud%20de%20cambio%20de%20nicho">Solicitar por correo</a>
              </Button>
              <Button asChild type="button">
                <a href="https://wa.me/573115385427" target="_blank" rel="noreferrer">Solicitar por WhatsApp</a>
              </Button>
            </div>
          ) : (
            <Button asChild type="button" variant="outline">
              <Link href="/dashboard/onboarding">Completar configuración inicial</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
