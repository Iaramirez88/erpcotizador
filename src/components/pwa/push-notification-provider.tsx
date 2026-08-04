'use client'

import { BellRing, BellOff, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { normalizeBrowserPushSubscription, urlBase64ToUint8Array, type BrowserPushSubscription } from '@/lib/push-subscription'

const DISMISS_KEY = 'sgd_push_notifications_dismissed'

function isPushSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  return standaloneMedia || iosStandalone
}

async function fetchPushConfig() {
  const response = await fetch('/api/push/public-key', { cache: 'no-store' })
  const json = (await response.json().catch(() => null)) as { enabled?: boolean; publicKey?: string | null } | null
  return {
    enabled: json?.enabled === true,
    publicKey: typeof json?.publicKey === 'string' && json.publicKey.trim() ? json.publicKey.trim() : null,
  }
}

async function persistSubscription(subscription: PushSubscription) {
  const parsed = normalizeBrowserPushSubscription(subscription.toJSON())
  if (!parsed) throw new Error('No se pudo serializar la suscripción push.')

  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  })

  if (!response.ok) {
    throw new Error('No se pudo guardar la suscripción push.')
  }
}

async function syncExistingSubscription(publicKey: string) {
  if (!isPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()

  if (existingSubscription) {
    await persistSubscription(existingSubscription)
    return true
  }

  if (Notification.permission !== 'granted') return false

  const createdSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await persistSubscription(createdSubscription)
  return true
}

async function deleteExistingSubscription(subscription: BrowserPushSubscription | null) {
  if (!subscription?.endpoint) return

  await fetch('/api/push/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined)
}

export function PushNotificationProvider() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [dismissed, setDismissed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) return

    setSupported(true)
    setPermission(Notification.permission)
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')

    void fetchPushConfig().then(async (config) => {
      setEnabled(config.enabled)
      setPublicKey(config.publicKey)

      if (config.enabled && config.publicKey && Notification.permission === 'granted') {
        try {
          await syncExistingSubscription(config.publicKey)
        } catch {
          // ignore background sync failures
        }
      }
    }).catch(() => {
      setEnabled(false)
      setPublicKey(null)
    })
  }, [])

  const shouldShow = useMemo(() => {
    if (!supported || !enabled || !publicKey) return false
    if (permission === 'granted') return false
    if (dismissed) return false
    return isStandaloneMode()
  }, [dismissed, enabled, permission, publicKey, supported])

  async function handleEnable() {
    if (!publicKey) return

    setBusy(true)
    setError(null)

    try {
      let nextPermission = Notification.permission
      if (nextPermission !== 'granted') {
        nextPermission = await Notification.requestPermission()
        setPermission(nextPermission)
      }

      if (nextPermission !== 'granted') {
        setError('El permiso quedó bloqueado. Habilítalo desde los ajustes del navegador o de la app instalada.')
        return
      }

      await syncExistingSubscription(publicKey)
      window.localStorage.removeItem(DISMISS_KEY)
      setDismissed(false)
    } catch {
      setError('No fue posible activar las notificaciones en este dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!supported || permission !== 'denied') return

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        const parsed = normalizeBrowserPushSubscription(subscription?.toJSON?.() ?? null)
        await deleteExistingSubscription(parsed)
      })
      .catch(() => undefined)
  }, [permission, supported])

  if (!shouldShow) return null

  return (
    <div className="fixed inset-x-0 top-4 z-[75] flex justify-center px-4">
      <div className="w-full max-w-lg rounded-[22px] border border-amber-200 bg-[linear-gradient(135deg,_rgba(255,251,235,0.98)_0%,_rgba(255,237,213,0.98)_100%)] p-4 text-slate-900 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-amber-500/15 p-2.5 text-amber-700">
            {permission === 'denied' ? <BellOff className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Activa notificaciones reales en tu app instalada</p>
                <p className="mt-1 text-xs leading-5 text-slate-700">
                  {permission === 'denied'
                    ? 'El permiso está bloqueado. Debes habilitarlo en los ajustes del navegador o de la app para recibir avisos con la app cerrada.'
                    : 'Con esto Ordex podrá mostrar avisos del sistema aunque la app esté cerrada o en segundo plano.'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-slate-500 transition hover:bg-white/70 hover:text-slate-900"
                onClick={() => {
                  window.localStorage.setItem(DISMISS_KEY, '1')
                  setDismissed(true)
                }}
                aria-label="Ocultar aviso de notificaciones"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button className="h-9 rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800" onClick={() => void handleEnable()} disabled={busy || permission === 'denied'}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
                {busy ? 'Activando...' : 'Activar notificaciones'}
              </Button>
              {error ? <p className="text-xs text-rose-700">{error}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}