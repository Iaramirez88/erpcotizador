'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CardInfoHeader } from '@/components/ui/card-info-header'
import { Input } from '@/components/ui/input'
import { InfoHint } from '@/components/ui/info-hint'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  taskCancellationReasonRequired: boolean
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

type OnboardingStatusResponse = {
  ok?: boolean
  status?: string
  locked?: boolean
  completedAt?: string | null
  businessType?: string | null
  dashboard?: OnboardingConfig['dashboard']
  availableBusinessTypes?: string[]
  error?: string
}

export default function ConfigEmpresaPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingIntelligence, setSavingIntelligence] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [intelligenceError, setIntelligenceError] = useState<string | null>(null)
  const [intelligenceStatus, setIntelligenceStatus] = useState<string | null>(null)

  const [config, setConfig] = useState<EmpresaConfig | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingConfig | null>(null)
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [intelligenceEnabled, setIntelligenceEnabled] = useState(false)
  const [taskCancellationReasonRequired, setTaskCancellationReasonRequired] = useState(false)
  const [savingTaskPolicy, setSavingTaskPolicy] = useState(false)
  const [taskPolicyError, setTaskPolicyError] = useState<string | null>(null)
  const [taskPolicyStatus, setTaskPolicyStatus] = useState<string | null>(null)
  const [availableBusinessTypes, setAvailableBusinessTypes] = useState<string[]>([])
  const [presetBusinessType, setPresetBusinessType] = useState<string>('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetError, setPresetError] = useState<string | null>(null)
  const [presetStatus, setPresetStatus] = useState<string | null>(null)

  const logoPreview = useMemo(() => (logo ?? config?.logo ?? null), [logo, config?.logo])

  async function loadOnboardingConfig(cancelled = false) {
    const res = await fetch('/api/onboarding/empresa', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as OnboardingStatusResponse | null
    if (cancelled || !res.ok || !json?.ok) return

    setOnboarding({
      status: json.status ?? 'COMPLETED',
      locked: Boolean(json.locked),
      completedAt: json.completedAt ?? null,
      businessType: json.businessType ?? null,
      dashboard: json.dashboard ?? null,
    })
    setAvailableBusinessTypes(Array.isArray(json.availableBusinessTypes) ? json.availableBusinessTypes : [])
    setPresetBusinessType(json.businessType ?? '')
  }

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
        setTaskCancellationReasonRequired(Boolean(json.data.taskCancellationReasonRequired))
      } catch {
        if (!cancelled) setError('No se pudo cargar la configuración.')
      }
      try {
        await loadOnboardingConfig(cancelled)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveCompanyPreset() {
    if (!config) return
    if (!presetBusinessType) {
      setPresetError('Selecciona un tipo de negocio antes de guardar el preset.')
      return
    }

    setSavingPreset(true)
    setPresetError(null)
    setPresetStatus(null)

    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyPresetBusinessType: presetBusinessType }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setPresetError(json?.error ?? 'No se pudo actualizar la configuración inicial.')
        return
      }

      const nextConfig = json.data
      setConfig((current) => (current ? { ...current, ...nextConfig } : nextConfig))
      await loadOnboardingConfig()
      setPresetStatus('La configuración inicial quedó actualizada y ahora sí controla el espacio con el nuevo preset.')
    } catch {
      setPresetError('No se pudo actualizar la configuración inicial.')
    } finally {
      setSavingPreset(false)
    }
  }

  async function clearCompanyPreset() {
    if (!config) return

    setSavingPreset(true)
    setPresetError(null)
    setPresetStatus(null)

    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearCompanyPreset: true }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setPresetError(json?.error ?? 'No se pudo quitar la configuración inicial.')
        return
      }

      const nextConfig = json.data
      setConfig((current) => (current ? { ...current, ...nextConfig } : nextConfig))
      await loadOnboardingConfig()
      setPresetStatus('La configuración inicial quedó eliminada. Desde ahora puedes gobernar el espacio con permisos y módulos sin ese recorte base.')
    } catch {
      setPresetError('No se pudo quitar la configuración inicial.')
    } finally {
      setSavingPreset(false)
    }
  }

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
      setTaskCancellationReasonRequired(Boolean(json.data.taskCancellationReasonRequired))
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

  async function saveIntelligenceSetting(nextEnabled: boolean) {
    if (!config) return

    const previousValue = intelligenceEnabled
    setIntelligenceEnabled(nextEnabled)
    setSavingIntelligence(true)
    setIntelligenceError(null)
    setIntelligenceStatus(null)

    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intelligenceEnabled: nextEnabled }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setIntelligenceEnabled(previousValue)
        setIntelligenceError(json?.error ?? 'No se pudo actualizar el módulo.')
        return
      }

      const nextConfig = json.data
      setConfig((current) => current ? { ...current, ...nextConfig } : nextConfig)
      setIntelligenceEnabled(Boolean(nextConfig.intelligenceEnabled))
      setIntelligenceStatus(nextConfig.intelligenceEnabled
        ? 'Módulo prendido. Ya puedes verlo en el dashboard.'
        : 'Módulo apagado. Se ocultó del dashboard y se detuvieron sus alertas automáticas.')
    } catch {
      setIntelligenceEnabled(previousValue)
      setIntelligenceError('No se pudo actualizar el módulo.')
    } finally {
      setSavingIntelligence(false)
    }
  }

  async function saveTaskPolicySetting(nextValue: boolean) {
    if (!config) return

    const previousValue = taskCancellationReasonRequired
    setTaskCancellationReasonRequired(nextValue)
    setSavingTaskPolicy(true)
    setTaskPolicyError(null)
    setTaskPolicyStatus(null)

    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskCancellationReasonRequired: nextValue }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setTaskCancellationReasonRequired(previousValue)
        setTaskPolicyError(json?.error ?? 'No se pudo actualizar la política de tareas.')
        return
      }

      const nextConfig = json.data
      setConfig((current) => current ? { ...current, ...nextConfig } : nextConfig)
      setTaskCancellationReasonRequired(Boolean(nextConfig.taskCancellationReasonRequired))
      setTaskPolicyStatus(nextConfig.taskCancellationReasonRequired
        ? 'Ahora se exigirá un motivo al anular una tarea.'
        : 'El motivo al anular una tarea quedó opcional, pero la traza seguirá guardándose.')
    } catch {
      setTaskCancellationReasonRequired(previousValue)
      setTaskPolicyError('No se pudo actualizar la política de tareas.')
    } finally {
      setSavingTaskPolicy(false)
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
              {intelligenceError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{intelligenceError}</div> : null}
              {intelligenceStatus ? <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{intelligenceStatus}</div> : null}
            </div>
            <Switch
              id="intelligence-enabled"
              checked={intelligenceEnabled}
              onCheckedChange={(checked) => void saveIntelligenceSetting(checked)}
              disabled={saving || savingIntelligence || loading || !config}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
            <span>{savingIntelligence ? 'Guardando estado del módulo...' : intelligenceEnabled ? 'Estado actual: prendido' : 'Estado actual: apagado'}</span>
            <span className={intelligenceEnabled ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700' : 'rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700'}>
              {intelligenceEnabled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardInfoHeader
            title={<CardTitle>Política de anulación de tareas</CardTitle>}
            description="Las tareas no se borran físicamente: se anulan, se archivan y conservan su historial. Aquí defines si el motivo será obligatorio para tu empresa."
            tone="action"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="task-cancellation-reason-required" className="text-sm font-medium text-slate-950">Exigir motivo al anular o retirar una tarea</Label>
              <CardDescription>
                Si lo activas, el usuario deberá registrar por qué la tarea no sigue. La traza también quedará en notificaciones.
              </CardDescription>
              {taskPolicyError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{taskPolicyError}</div> : null}
              {taskPolicyStatus ? <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{taskPolicyStatus}</div> : null}
            </div>
            <Switch
              id="task-cancellation-reason-required"
              checked={taskCancellationReasonRequired}
              onCheckedChange={(checked) => void saveTaskPolicySetting(checked)}
              disabled={saving || savingTaskPolicy || loading || !config}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
            <span>{savingTaskPolicy ? 'Guardando política de tareas...' : taskCancellationReasonRequired ? 'Estado actual: motivo obligatorio' : 'Estado actual: motivo opcional'}</span>
            <span className={taskCancellationReasonRequired ? 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800' : 'rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700'}>
              {taskCancellationReasonRequired ? 'Obligatorio' : 'Opcional'}
            </span>
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

              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Editar configuración inicial</Label>
                    <InfoHint content="Si cambias este preset, se recalcula el frente base del negocio y puede encender o apagar módulos/verticales iniciales para toda la empresa." label="Ver ayuda de la configuración inicial" />
                  </div>
                  <Select value={presetBusinessType} onValueChange={setPresetBusinessType} disabled={savingPreset || loading || !availableBusinessTypes.length}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona un tipo de negocio" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBusinessTypes.map((businessType) => (
                        <SelectItem key={businessType} value={businessType}>
                          {getBusinessTypeLabel(businessType as Parameters<typeof getBusinessTypeLabel>[0])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {presetError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{presetError}</div> : null}
                  {presetStatus ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{presetStatus}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={savingPreset || loading || !presetBusinessType} onClick={() => void saveCompanyPreset()}>
                    {savingPreset ? 'Aplicando…' : 'Aplicar preset'}
                  </Button>
                  <Button type="button" variant="destructive" disabled={savingPreset || loading || !onboarding?.businessType} onClick={() => void clearCompanyPreset()}>
                    {savingPreset ? 'Quitando…' : 'Eliminar preset'}
                  </Button>
                </div>
              </div>

              <div className={onboarding.businessType ? 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900' : 'rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900'}>
                {onboarding.businessType
                  ? 'Este preset sí puede seguir recortando módulos y rutas aunque ya hayas prendido permisos manuales. Si el espacio quedó mal clasificado, cámbialo o elimínalo aquí.'
                  : 'Actualmente no hay un preset inicial forzando el espacio. Desde este punto el acceso queda gobernado por módulos, verticales y permisos.'}
              </div>

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
          {onboarding?.businessType ? (
            <div className="text-sm text-slate-600">
              El cambio del preset se aplica desde esta pantalla y reescribe la base de módulos y accesos iniciales del espacio.
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
