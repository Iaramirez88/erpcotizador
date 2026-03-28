export const DEFAULT_NOTIFICATION_ACTION_LABEL = 'Abrir'

export function normalizeNotificationActionUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return null
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    if (!/^https?:$/i.test(url.protocol)) return null
    if (!url.pathname.startsWith('/')) return null
    if (url.pathname.startsWith('//')) return null

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function normalizeNotificationActionLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}