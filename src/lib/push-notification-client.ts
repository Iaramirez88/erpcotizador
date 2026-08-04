'use client'

import { normalizeBrowserPushSubscription, urlBase64ToUint8Array, type BrowserPushSubscription } from '@/lib/push-subscription'

export const PUSH_NOTIFICATIONS_DISMISS_KEY = 'sgd_push_notifications_dismissed'
export const PUSH_NOTIFICATIONS_OPTOUT_KEY = 'sgd_push_notifications_opt_out'
export const PUSH_NOTIFICATIONS_STATE_EVENT = 'push-notifications:state-changed'

export type PushConfigResponse = {
  enabled: boolean
  publicKey: string | null
}

export type PushSubscriptionDiagnosticItem = {
  id: string
  endpointTail: string
  createdAt: string
  updatedAt: string
  userAgent: string | null
}

export type PushSubscriptionDiagnostics = {
  ok: boolean
  subscribed: boolean
  count: number
  items: PushSubscriptionDiagnosticItem[]
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  return standaloneMedia || iosStandalone
}

export function isPushOptedOut() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PUSH_NOTIFICATIONS_OPTOUT_KEY) === '1'
}

export function emitPushNotificationsStateChanged(detail: {
  optedOut?: boolean
  subscribed?: boolean
  permission?: NotificationPermission | null
} = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PUSH_NOTIFICATIONS_STATE_EVENT, { detail }))
}

export function setPushOptOutState(next: boolean) {
  if (typeof window === 'undefined') return
  if (next) {
    window.localStorage.setItem(PUSH_NOTIFICATIONS_OPTOUT_KEY, '1')
  } else {
    window.localStorage.removeItem(PUSH_NOTIFICATIONS_OPTOUT_KEY)
  }
}

export async function fetchPushConfig(): Promise<PushConfigResponse> {
  const response = await fetch('/api/push/public-key', { cache: 'no-store' })
  const json = (await response.json().catch(() => null)) as { enabled?: boolean; publicKey?: string | null } | null
  return {
    enabled: json?.enabled === true,
    publicKey: typeof json?.publicKey === 'string' && json.publicKey.trim() ? json.publicKey.trim() : null,
  }
}

export async function fetchPushSubscriptionDiagnostics(): Promise<PushSubscriptionDiagnostics> {
  const response = await fetch('/api/push/subscriptions', { cache: 'no-store' })
  const json = (await response.json().catch(() => null)) as
    | {
        ok?: boolean
        subscribed?: boolean
        count?: number
        items?: PushSubscriptionDiagnosticItem[]
      }
    | null

  return {
    ok: json?.ok === true,
    subscribed: json?.subscribed === true,
    count: typeof json?.count === 'number' ? json.count : 0,
    items: Array.isArray(json?.items) ? json.items : [],
  }
}

export async function fetchSubscriptionStatus() {
  const diagnostics = await fetchPushSubscriptionDiagnostics()
  return diagnostics.subscribed
}

export async function persistSubscription(subscription: PushSubscription) {
  const parsed = normalizeBrowserPushSubscription(subscription.toJSON())
  if (!parsed) throw new Error('No se pudo serializar la suscripcion push.')

  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  })

  if (!response.ok) {
    throw new Error('No se pudo guardar la suscripcion push.')
  }
}

export async function getCurrentBrowserSubscription() {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return normalizeBrowserPushSubscription(subscription?.toJSON?.() ?? null)
}

export async function syncExistingSubscription(publicKey: string) {
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

export async function deleteExistingSubscription(subscription: BrowserPushSubscription | null) {
  if (!subscription?.endpoint) return

  await fetch('/api/push/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined)
}

export async function disableCurrentDevicePush() {
  if (!isPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()
  const parsed = normalizeBrowserPushSubscription(existingSubscription?.toJSON?.() ?? null)

  await deleteExistingSubscription(parsed)
  await existingSubscription?.unsubscribe().catch(() => false)

  return Boolean(parsed?.endpoint || existingSubscription)
}