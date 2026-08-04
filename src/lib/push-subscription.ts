export type BrowserPushSubscription = {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

function normalizeKey(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function normalizeBrowserPushSubscription(value: unknown): BrowserPushSubscription | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as {
    endpoint?: unknown
    expirationTime?: unknown
    keys?: {
      p256dh?: unknown
      auth?: unknown
    }
  }

  const endpoint = normalizeKey(raw.endpoint)
  const p256dh = normalizeKey(raw.keys?.p256dh)
  const auth = normalizeKey(raw.keys?.auth)
  const expirationTime = typeof raw.expirationTime === 'number' && Number.isFinite(raw.expirationTime)
    ? raw.expirationTime
    : null

  if (!endpoint || !p256dh || !auth) return null

  return {
    endpoint,
    expirationTime,
    keys: {
      p256dh,
      auth,
    },
  }
}

export function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}