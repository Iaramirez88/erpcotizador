'use client'

import Link from 'next/link'
import { BellRing, BellOff, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { isPublicEmbedPath } from '@/lib/public-embed-paths'

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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isPublicEmbedPath(window.location.pathname)) return
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

  // Abre el aviso cuando corresponde (p. ej. justo después de instalar la app).
  useEffect(() => {
    if (shouldShow) setOpen(true)
  }, [shouldShow])

  // Después de instalar la app, re-muestra el aviso de notificaciones aunque se
  // hubiera descartado antes desde el navegador.
  useEffect(() => {
    function handleAppInstalled() {
      window.localStorage.removeItem(PUSH_NOTIFICATIONS_DISMISS_KEY)
      window.localStorage.removeItem('sgd_push_notifications_opt_out')
      setDismissed(false)
      setOptedOut(false)
      if (Notification.permission !== 'granted') setOpen(true)
    }

    window.addEventListener('appinstalled', handleAppInstalled)
    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  function handleDismiss() {
    window.localStorage.setItem(PUSH_NOTIFICATIONS_DISMISS_KEY, '1')
    setDismissed(true)
    setOpen(false)
  }

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
      setOpen(false)
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

  if (!supported) return null

  const description = permission === 'granted' && subscriptionReady === false
    ? 'El permiso ya fue concedido, pero esta instalación no alcanzó a registrar una suscripción push activa. Usa el botón para repararla.'
    : permission === 'denied'
      ? 'El permiso está bloqueado. Debes habilitarlo en los ajustes del navegador o de la app para recibir avisos con la app cerrada.'
      : 'Con esto Ordex podrá mostrarte avisos del sistema aunque la app esté cerrada o en segundo plano.'

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleDismiss() }}>
      <DialogContent className="max-w-md rounded-[24px]">
        <DialogHeader>
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
            {permission === 'denied' ? <BellOff className="h-6 w-6" /> : <BellRing className="h-6 w-6" />}
          </div>
          <DialogTitle>Activa las notificaciones</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          <p className="text-xs text-slate-500">
            Puedes activarlas o desactivarlas cuando quieras desde{' '}
            <Link href="/dashboard/configuracion/notificaciones" className="font-medium text-sky-700 underline-offset-2 hover:underline">
              Configuración → Notificaciones
            </Link>.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={handleDismiss}>
            Ahora no
          </Button>
          <Button className="h-10 rounded-xl" onClick={() => void handleEnable()} disabled={busy || permission === 'denied'}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
            {busy ? 'Activando...' : permission === 'granted' && subscriptionReady === false ? 'Reparar notificaciones' : 'Activar notificaciones'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}