'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PhoneCall, ShieldCheck, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

type CrmAddonState = {
  code: 'DAILY_CALLS'
  title: string
  description: string
  enabled: boolean
  status: 'INACTIVE' | 'CONFIGURING' | 'ACTIVE'
  ready: boolean
  commercial: {
    code: string
    status: 'INTERNAL_TEST' | 'QUOTE_REQUIRED' | 'ACTIVE' | 'SUSPENDED'
    monthlyPriceCOP: number
    canUseAddon: boolean
    label: string
    notes: string | null
    activatedAt: string | null
  }
  accessPolicy: {
    startCall: string
    joinCall: string
    recordCall: string
  }
  metrics: {
    trailing30Days: {
      startedSessions: number
      completedSessions: number
      failedSessions: number
      totalMinutes: number
    }
  }
  validation: {
    checkedAt: string | null
    ok: boolean
    message: string
    domainName: string | null
  }
  settings: {
    connectionMode: 'SGDIGITAL_MANAGED' | 'CUSTOMER_DAILY'
    dailyDomain: string
    roomPrefix: string
    enableRecording: boolean
    defaultCallType: 'video' | 'audio'
    hasApiKey: boolean
    validatedDomainName?: string | null
    validationCheckedAt?: string | null
    lastValidationError?: string | null
  }
  checklist: Array<{
    key: string
    label: string
    done: boolean
  }>
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type DraftState = {
  enabled: boolean
  connectionMode: 'SGDIGITAL_MANAGED' | 'CUSTOMER_DAILY'
  dailyDomain: string
  roomPrefix: string
  enableRecording: boolean
  defaultCallType: 'video' | 'audio'
  commercialStatus: 'INTERNAL_TEST' | 'QUOTE_REQUIRED' | 'ACTIVE' | 'SUSPENDED'
  commercialNotes: string
  apiKey: string
}

function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  return fetch(url, init).then((res) => res.json().catch(() => ({}))) as Promise<JsonResponse<T>>
}

function getDraftFromAddon(addon: CrmAddonState | null): DraftState {
  return {
    enabled: addon?.enabled === true,
    connectionMode: addon?.settings.connectionMode ?? 'SGDIGITAL_MANAGED',
    dailyDomain: addon?.settings.dailyDomain ?? '',
    roomPrefix: addon?.settings.roomPrefix ?? 'crm-room',
    enableRecording: addon?.settings.enableRecording === true,
    defaultCallType: addon?.settings.defaultCallType ?? 'video',
    commercialStatus: addon?.commercial.status ?? 'INTERNAL_TEST',
    commercialNotes: addon?.commercial.notes ?? '',
    apiKey: '',
  }
}

function getStatusLabel(status: CrmAddonState['status']) {
  if (status === 'ACTIVE') return 'Activo'
  if (status === 'CONFIGURING') return 'Configurando'
  return 'Inactivo'
}

function getStatusClassName(status: CrmAddonState['status']) {
  if (status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'CONFIGURING') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function DailyBillingNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-semibold">Daily puede exigir tarjeta para activar la API</div>
          <div className="mt-1 leading-6 text-amber-900">
            En modo autogestionado, algunas cuentas nuevas de Daily piden agregar tarjeta y fondear un credito inicial de desarrollo antes de habilitar el uso de API.
          </div>
        </div>
      </div>
    </div>
  )
}

function formatCurrencyCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

export function CrmAddonsMarketplaceCard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addon, setAddon] = useState<CrmAddonState | null>(null)
  const [draft, setDraft] = useState<DraftState>(getDraftFromAddon(null))

  async function loadAddon() {
    setLoading(true)
    setError(null)
    try {
      const json = await requestJson<CrmAddonState[]>('/api/crm/addons')
      const nextAddon = Array.isArray(json.data) ? json.data.find((item) => item.code === 'DAILY_CALLS') ?? null : null
      setAddon(nextAddon)
      setDraft(getDraftFromAddon(nextAddon))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el addon Daily.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAddon()
  }, [])

  async function saveDraft(nextEnabled: boolean) {
    setSaving(true)
    setError(null)
    try {
      const json = await requestJson<CrmAddonState>('/api/crm/addons/DAILY_CALLS', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: nextEnabled,
          connectionMode: draft.connectionMode,
          dailyDomain: draft.dailyDomain,
          roomPrefix: draft.roomPrefix,
          enableRecording: draft.enableRecording,
          defaultCallType: draft.defaultCallType,
          commercialStatus: draft.commercialStatus,
          commercialNotes: draft.commercialNotes,
          apiKey: draft.apiKey,
        }),
      })
      if (!json.success || !json.data) {
        setError(json.error || 'No se pudo guardar el addon Daily.')
        return
      }
      setAddon(json.data)
      setDraft(getDraftFromAddon(json.data))
      setDialogOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el addon Daily.')
    } finally {
      setSaving(false)
    }
  }

  async function validateConnection() {
    setValidating(true)
    setError(null)
    try {
      const json = await requestJson<CrmAddonState>('/api/crm/addons/DAILY_CALLS', {
        method: 'POST',
      })
      if (!json.success || !json.data) {
        setError(json.error || 'No se pudo validar la conexion Daily.')
        return
      }
      setAddon(json.data)
      setDraft(getDraftFromAddon(json.data))
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'No se pudo validar la conexion Daily.')
    } finally {
      setValidating(false)
    }
  }

  function formatDateTime(value: string | null | undefined) {
    if (!value) return 'Aun no validado'
    try {
      return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    } catch {
      return value
    }
  }

  const checklistDone = addon?.checklist.filter((item) => item.done).length ?? 0
  const checklistTotal = addon?.checklist.length ?? 0

  return (
    <Card className="border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_52%,#f7fff8_100%)] shadow-[0_22px_48px_-38px_rgba(15,23,42,0.28)]">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              <PhoneCall className="h-3.5 w-3.5" />
              Addons CRM
            </div>
            <CardTitle className="text-slate-950">Daily como plugin activable</CardTitle>
            <CardDescription className="max-w-3xl text-slate-600">
              El inbox base sigue igual. Este addon habilita llamada y videollamada como capacidad adicional que la empresa prende, configura y opera cuando le conviene.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => void loadAddon()} disabled={loading || saving}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Recargar
            </Button>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => void validateConnection()} disabled={loading || saving || validating || !addon?.enabled}>
              {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Validar conexion
            </Button>
            <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => setDialogOpen(true)} disabled={loading || !addon}>
              Configurar addon
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-500">Cargando estado del addon Daily...</div>
        ) : addon ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">{addon.title}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusClassName(addon.status)}`}>
                        {getStatusLabel(addon.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{addon.description}</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Label htmlFor="daily-addon-toggle" className="text-sm font-medium text-slate-700">Activar</Label>
                    <Switch
                      id="daily-addon-toggle"
                      checked={draft.enabled}
                      disabled={saving}
                      onCheckedChange={(checked) => {
                        setDraft((current) => ({ ...current, enabled: checked }))
                        void saveDraft(checked)
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Conexion</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{addon.settings.connectionMode === 'CUSTOMER_DAILY' ? 'Cuenta propia' : 'SGDigital administrado'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Dominio Daily</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{addon.settings.dailyDomain || 'Pendiente'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tipo por defecto</div>
                    <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-950">
                      <Video className="h-4 w-4 text-sky-600" />
                      {addon.settings.defaultCallType === 'audio' ? 'Solo audio' : 'Video'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Credencial backend</div>
                    <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-950">
                      <ShieldCheck className={`h-4 w-4 ${addon.settings.hasApiKey || addon.settings.connectionMode === 'SGDIGITAL_MANAGED' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      {addon.settings.connectionMode === 'SGDIGITAL_MANAGED' ? 'Gestionada por SGDigital' : addon.settings.hasApiKey ? 'API key resguardada' : 'Pendiente'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Estado comercial</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{addon.commercial.label}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Precio mensual sugerido</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{formatCurrencyCOP(addon.commercial.monthlyPriceCOP)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Uso permitido</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{addon.commercial.canUseAddon ? 'Sí' : 'Bloqueado por estado comercial'}</div>
                  </div>
                </div>

                {addon.settings.connectionMode === 'CUSTOMER_DAILY' ? <DailyBillingNotice /> : null}

                {addon.commercial.notes ? <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">{addon.commercial.notes}</div> : null}

                <div className={addon.validation.ok ? 'mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900' : 'mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900'}>
                  <div className="font-semibold">{addon.validation.ok ? 'Conexion validada' : 'Validacion pendiente o con error'}</div>
                  <div className="mt-1">{addon.validation.message}</div>
                  <div className="mt-2 text-xs opacity-80">Ultima revision: {formatDateTime(addon.validation.checkedAt)}</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Checklist de despliegue</h3>
                    <p className="mt-1 text-xs text-slate-500">{checklistDone}/{checklistTotal} tareas cubiertas en el addon Daily.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {addon.ready ? 'Listo para siguiente fase' : 'Base en configuracion'}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {addon.checklist.map((item) => (
                    <div key={item.key} className={item.done ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900' : 'rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700'}>
                      {item.done ? 'Listo' : 'Pendiente'}: {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Permisos operativos</h3>
                    <p className="mt-1 text-xs text-slate-500">Primera entrega de fase 4 aplicada desde backend.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">RBAC activo</div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">Iniciar: {addon.accessPolicy.startCall}</div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">Unirse: {addon.accessPolicy.joinCall}</div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">Grabar: {addon.accessPolicy.recordCall}</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Uso últimos 30 días</h3>
                    <p className="mt-1 text-xs text-slate-500">Base para consumo y activación comercial del addon.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">Métricas base</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sesiones iniciadas</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{addon.metrics.trailing30Days.startedSessions}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sesiones cerradas</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{addon.metrics.trailing30Days.completedSessions}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fallos</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{addon.metrics.trailing30Days.failedSessions}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Minutos acumulados</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{addon.metrics.trailing30Days.totalMinutes}</div>
                  </div>
                </div>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configurar addon Daily</DialogTitle>
                  <DialogDescription>
                    Define si esta empresa usara una cuenta administrada por SGDigital o una cuenta propia de Daily. El inbox base no depende de esta configuracion.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Modo de conexion</Label>
                    <Select value={draft.connectionMode} onValueChange={(value) => setDraft((current) => ({ ...current, connectionMode: value === 'CUSTOMER_DAILY' ? 'CUSTOMER_DAILY' : 'SGDIGITAL_MANAGED' }))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SGDIGITAL_MANAGED">SGDigital administrado</SelectItem>
                        <SelectItem value="CUSTOMER_DAILY">Cuenta propia del cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {draft.connectionMode === 'CUSTOMER_DAILY' ? <div className="md:col-span-2"><DailyBillingNotice /></div> : null}
                  <div className="grid gap-2">
                    <Label>Dominio Daily</Label>
                    <Input value={draft.dailyDomain} onChange={(event) => setDraft((current) => ({ ...current, dailyDomain: event.target.value }))} placeholder="miempresa.daily.co" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Prefijo de room</Label>
                    <Input value={draft.roomPrefix} onChange={(event) => setDraft((current) => ({ ...current, roomPrefix: event.target.value }))} placeholder="crm-room" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo de llamada por defecto</Label>
                    <Select value={draft.defaultCallType} onValueChange={(value) => setDraft((current) => ({ ...current, defaultCallType: value === 'audio' ? 'audio' : 'video' }))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Videollamada</SelectItem>
                        <SelectItem value="audio">Solo audio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Estado comercial</Label>
                    <Select value={draft.commercialStatus} onValueChange={(value) => setDraft((current) => ({
                      ...current,
                      commercialStatus: value === 'QUOTE_REQUIRED' || value === 'ACTIVE' || value === 'SUSPENDED' ? value : 'INTERNAL_TEST',
                    }))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTERNAL_TEST">Prueba interna</SelectItem>
                        <SelectItem value="QUOTE_REQUIRED">Pendiente comercial</SelectItem>
                        <SelectItem value="ACTIVE">Activo comercialmente</SelectItem>
                        <SelectItem value="SUSPENDED">Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>API key Daily</Label>
                    <Input type="password" value={draft.apiKey} onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))} placeholder={addon.settings.hasApiKey ? 'Dejar vacio para conservar la actual' : 'Pegar API key'} />
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Nota comercial</Label>
                    <Input value={draft.commercialNotes} onChange={(event) => setDraft((current) => ({ ...current, commercialNotes: event.target.value }))} placeholder="Ej. incluido por piloto, cotización enviada, pendiente aprobación interna" />
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">Grabacion opcional</div>
                      <div className="text-xs text-slate-500">Solo admins y managers pueden verla dentro de la llamada si el addon la tiene habilitada.</div>
                    </div>
                    <Switch checked={draft.enableRecording} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enableRecording: checked }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" className="rounded-2xl" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
                  <Button className="rounded-2xl" onClick={() => void saveDraft(draft.enabled)} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar configuracion'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}