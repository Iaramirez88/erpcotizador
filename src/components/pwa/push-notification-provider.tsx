'use client'

import { BellRing, BellOff, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  PUSH_NOTIFICATIONS_DISMISS_KEY,
  PUSH_NOTIFICATIONS_STATE_EVENT,
  deleteExistingSubscription,
  fetchPushConfig,
  fetchSubscriptionStatus,
  isPushOptedOut,
  isPushSupported,
  isStandaloneMode,
  syncExistingSubscription,
} from '@/lib/push-notification-client'
import { normalizeBrowserPushSubscription } from '@/lib/push-subscription'

export function PushNotificationProvider() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [dismissed, setDismissed] = useState(true)
  const [optedOut, setOptedOut] = useState(false)
  const [subscriptionReady, setSubscriptionReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) return

    setSupported(true)
    setPermission(Notification.permission)
    setDismissed(window.localStorage.getItem(PUSH_NOTIFICATIONS_DISMISS_KEY) === '1')
    setOptedOut(isPushOptedOut())

    void fetchPushConfig().then(async (config) => {
      setEnabled(config.enabled)
      setPublicKey(config.publicKey)

      if (config.enabled && config.publicKey && Notification.permission === 'granted') {
        try {
          const synced = await syncExistingSubscription(config.publicKey)
          const subscribed = await fetchSubscriptionStatus().catch(() => false)
          setSubscriptionReady(synced || subscribed)
        } catch {
          setSubscriptionReady(false)
        }
      } else if (config.enabled) {
        const subscribed = await fetchSubscriptionStatus().catch(() => false)
        setSubscriptionReady(subscribed)
      }
    }).catch(() => {
      setEnabled(false)
      setPublicKey(null)
      setSubscriptionReady(false)
    })
  }, [])

  const shouldShow = useMemo(() => {
    if (!supported || !enabled || !publicKey) return false
    if (optedOut) return false
    if (permission === 'granted' && subscriptionReady !== false) return false
    if (permission !== 'granted' && dismissed) return false
    return isStandaloneMode()
  }, [dismissed, enabled, optedOut, permission, publicKey, subscriptionReady, supported])

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
        setSubscriptionReady(false)
        return
      }

      await syncExistingSubscription(publicKey)
      const subscribed = await fetchSubscriptionStatus().catch(() => false)
      window.localStorage.removeItem(PUSH_NOTIFICATIONS_DISMISS_KEY)
      window.localStorage.removeItem('sgd_push_notifications_opt_out')
      setSubscriptionReady(subscribed)
      setDismissed(false)
      setOptedOut(false)
    } catch {
      setSubscriptionReady(false)
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

  useEffect(() => {
    function handlePushStateChanged(event: Event) {
      const detail = (event as CustomEvent<{ optedOut?: boolean; subscribed?: boolean; permission?: NotificationPermission | null }>).detail
      if (!detail) return
      if (typeof detail.optedOut === 'boolean') setOptedOut(detail.optedOut)
      if (typeof detail.subscribed === 'boolean') setSubscriptionReady(detail.subscribed)
      if (detail.permission) setPermission(detail.permission)
    }

    window.addEventListener(PUSH_NOTIFICATIONS_STATE_EVENT, handlePushStateChanged)
    return () => window.removeEventListener(PUSH_NOTIFICATIONS_STATE_EVENT, handlePushStateChanged)
  }, [])

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
                  {permission === 'granted' && subscriptionReady === false
                    ? 'El permiso ya fue concedido, pero esta instalación no alcanzó a registrar una suscripción push activa. Usa el botón para repararla.'
                    : permission === 'denied'
                    ? 'El permiso está bloqueado. Debes habilitarlo en los ajustes del navegador o de la app para recibir avisos con la app cerrada.'
                    : 'Con esto Ordex podrá mostrar avisos del sistema aunque la app esté cerrada o en segundo plano.'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-slate-500 transition hover:bg-white/70 hover:text-slate-900"
                onClick={() => {
                  window.localStorage.setItem(PUSH_NOTIFICATIONS_DISMISS_KEY, '1')
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
                {busy ? 'Activando...' : permission === 'granted' && subscriptionReady === false ? 'Reparar notificaciones' : 'Activar notificaciones'}
              </Button>
              {error ? <p className="text-xs text-rose-700">{error}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}