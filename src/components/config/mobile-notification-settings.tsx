'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellOff, BellRing, CheckCircle2, Loader2, RefreshCw, Smartphone, TabletSmartphone, TriangleAlert } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  disableCurrentDevicePush,
  emitPushNotificationsStateChanged,
  fetchPushConfig,
  fetchPushSubscriptionDiagnostics,
  getCurrentBrowserSubscription,
  isPushSupported,
  isStandaloneMode,
  setPushOptOutState,
  syncExistingSubscription,
  type PushSubscriptionDiagnosticItem,
} from '@/lib/push-notification-client'

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function describeUserAgent(userAgent: string | null) {
  const ua = (userAgent ?? '').toLowerCase()

  const platform = ua.includes('android')
    ? 'Android'
    : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')
      ? 'iOS'
      : ua.includes('windows')
        ? 'Windows'
        : ua.includes('mac os x') || ua.includes('macintosh')
          ? 'macOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'Dispositivo'

  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('opr/') || ua.includes('opera')
      ? 'Opera'
      : ua.includes('chrome/') && !ua.includes('edg/')
        ? 'Chrome'
        : ua.includes('firefox/')
          ? 'Firefox'
          : ua.includes('safari/') && !ua.includes('chrome/')
            ? 'Safari'
            : 'Navegador'

  const family = ua.includes('ipad') || ua.includes('tablet')
    ? 'Tablet'
    : ua.includes('android') || ua.includes('iphone') || ua.includes('mobile')
      ? 'Movil'
      : 'Escritorio'

  const label = family === 'Escritorio' ? `${browser} en ${platform}` : `${family} ${platform}`
  return { platform, browser, family, label }
}

function DeviceIcon({ family }: { family: string }) {
  if (family === 'Tablet') return <TabletSmartphone className="h-4 w-4 text-slate-500" />
  return <Smartphone className="h-4 w-4 text-slate-500" />
}

export function MobileNotificationSettings() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [pushConfigured, setPushConfigured] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [deviceItems, setDeviceItems] = useState<PushSubscriptionDiagnosticItem[]>([])
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [currentEndpointTail, setCurrentEndpointTail] = useState<string | null>(null)

  const loadState = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supportedNow = isPushSupported()
      setSupported(supportedNow)
      setStandalone(isStandaloneMode())
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission)
      }

      const [config, diagnostics] = await Promise.all([
        fetchPushConfig(),
        fetchPushSubscriptionDiagnostics(),
      ])

      setPushConfigured(config.enabled)
      setPublicKey(config.publicKey)
      setDeviceItems(diagnostics.items)
      setSubscriptionCount(diagnostics.count)

      if (supportedNow) {
        const currentSubscription = await getCurrentBrowserSubscription().catch(() => null)
        setCurrentEndpointTail(currentSubscription?.endpoint.slice(-18) ?? null)
      } else {
        setCurrentEndpointTail(null)
      }
    } catch {
      setError('No se pudo cargar el estado de notificaciones para este usuario.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const currentDeviceSubscribed = useMemo(() => {
    if (!currentEndpointTail) return false
    return deviceItems.some((item) => item.endpointTail === currentEndpointTail)
  }, [currentEndpointTail, deviceItems])

  const currentDeviceEnabled = permission === 'granted' && currentDeviceSubscribed

  async function handleToggle(nextChecked: boolean) {
    if (busy) return
    setBusy(true)
    setError(null)
    setStatus(null)

    try {
      if (nextChecked) {
        if (!supported) {
          setError('Este dispositivo o navegador no soporta notificaciones push.')
          return
        }
        if (!pushConfigured || !publicKey) {
          setError('Las notificaciones push no estan configuradas en el servidor.')
          return
        }

        let nextPermission = typeof Notification !== 'undefined' ? Notification.permission : 'default'
        if (nextPermission !== 'granted') {
          nextPermission = await Notification.requestPermission()
          setPermission(nextPermission)
        }

        if (nextPermission !== 'granted') {
          setError('El permiso no fue concedido. Debes permitir notificaciones en el dispositivo para activarlas.')
          emitPushNotificationsStateChanged({ optedOut: false, subscribed: false, permission: nextPermission })
          return
        }

        await syncExistingSubscription(publicKey)
        setPushOptOutState(false)
        emitPushNotificationsStateChanged({ optedOut: false, subscribed: true, permission: nextPermission })
        setStatus('Notificaciones activadas para este dispositivo.')
      } else {
        await disableCurrentDevicePush()
        setPushOptOutState(true)
        emitPushNotificationsStateChanged({ optedOut: true, subscribed: false, permission: typeof Notification !== 'undefined' ? Notification.permission : null })
        setStatus('Notificaciones desactivadas para este dispositivo.')
      }

      await loadState()
    } catch {
      setError(nextChecked ? 'No fue posible activar las notificaciones.' : 'No fue posible desactivar las notificaciones en este dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  const currentDeviceLabel = useMemo(() => describeUserAgent(typeof navigator === 'undefined' ? null : navigator.userAgent), [])

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Configuracion', href: '/dashboard/configuracion/empresa' }, { label: 'Notificaciones moviles' }]}
        eyebrow="Configuracion personal"
        title="Notificaciones moviles"
        description="Decide si este dispositivo puede recibir avisos push de Ordex y revisa en que dispositivos de tu usuario hay suscripciones activas."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white/90">
              <Link href="/dashboard/notificaciones">Abrir centro de notificaciones</Link>
            </Button>
            <Button onClick={() => void loadState()} variant="outline" className="rounded-xl border-slate-200 bg-white/90" disabled={loading || busy}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar estado
            </Button>
          </>
        }
        stats={[
          { label: 'Push en servidor', value: pushConfigured ? 'Activo' : 'Pendiente', hint: 'VAPID y entrega web push', tone: pushConfigured ? 'teal' : 'amber' },
          { label: 'Permiso actual', value: permission === 'granted' ? 'Permitido' : permission === 'denied' ? 'Bloqueado' : 'Pendiente', hint: 'Estado del dispositivo actual', tone: permission === 'granted' ? 'sky' : 'amber' },
          { label: 'Dispositivos vinculados', value: subscriptionCount, hint: 'Suscripciones push del usuario', tone: 'neutral' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Este dispositivo</CardTitle>
            <CardDescription>
              Activa o desactiva las notificaciones push para el movil o navegador actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {currentDeviceEnabled ? <BellRing className="h-4 w-4 text-emerald-600" /> : <BellOff className="h-4 w-4 text-slate-500" />}
                    {currentDeviceLabel.label}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {currentDeviceEnabled
                      ? 'Este dispositivo ya puede recibir notificaciones push de Ordex.'
                      : 'Activa esta opcion para recibir avisos aunque la app este en segundo plano o cerrada.'}
                  </p>
                </div>
                <Switch checked={currentDeviceEnabled} onCheckedChange={(checked) => void handleToggle(checked)} disabled={busy || !supported || (!pushConfigured && !currentDeviceEnabled)} aria-label="Activar notificaciones push en este dispositivo" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Soporte del dispositivo</div>
                <div className="mt-2 text-base font-semibold text-slate-950">{supported ? 'Compatible' : 'No compatible'}</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{supported ? 'Hay soporte para service worker, push y permisos del navegador.' : 'Este navegador no expone la API necesaria para recibir push.'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modo actual</div>
                <div className="mt-2 text-base font-semibold text-slate-950">{standalone ? 'App instalada' : 'Navegador'}</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{standalone ? 'Ordex se esta ejecutando como app instalada en este dispositivo.' : 'Si usas iPhone, agrega Ordex a pantalla de inicio para habilitar push real.'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm leading-6 text-slate-600">
              En iPhone o iPad las notificaciones push solo funcionan con Ordex instalado en pantalla de inicio y permiso concedido. En Android se recomienda instalar la app, aunque algunos navegadores tambien soportan push desde el navegador.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Dispositivos del usuario</CardTitle>
            <CardDescription>
              Esta lista muestra los dispositivos con suscripcion push activa para tu cuenta. Es la mejor senal disponible para saber donde Ordex puede notificarte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando dispositivos vinculados...
              </div>
            ) : deviceItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-600">
                No hay dispositivos vinculados todavia. Cuando actives push en un movil o navegador compatible, aparecera aqui.
              </div>
            ) : (
              deviceItems.map((item) => {
                const meta = describeUserAgent(item.userAgent)
                const isCurrent = currentEndpointTail != null && item.endpointTail === currentEndpointTail
                return (
                  <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <DeviceIcon family={meta.family} />
                          <span className="truncate">{meta.label}</span>
                          {isCurrent ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Este dispositivo</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{meta.browser} · endpoint {item.endpointTail}</p>
                      </div>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <div>
                        <span className="font-medium text-slate-700">Vinculado:</span> {formatDate(item.createdAt)}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Ultima sincronizacion:</span> {formatDate(item.updatedAt)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {!pushConfigured ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>El servidor todavia no tiene Web Push listo. La vista queda preparada, pero debes completar las VAPID para que los avisos se entreguen.</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}