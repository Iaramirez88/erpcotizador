type BadgeHost = {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

function normalizeBadgeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

async function applyBadge(target: BadgeHost | null | undefined, count: number) {
  if (!target) return

  if (count > 0 && typeof target.setAppBadge === 'function') {
    await target.setAppBadge(count)
    return
  }

  if (count === 0 && typeof target.clearAppBadge === 'function') {
    await target.clearAppBadge()
  }
}

export async function syncAppBadge(count: number) {
  if (typeof window === 'undefined') return

  const normalized = normalizeBadgeCount(count)
  await applyBadge(navigator as Navigator & BadgeHost, normalized).catch(() => undefined)

  if (!('serviceWorker' in navigator)) return

  await navigator.serviceWorker.ready
    .then(async (registration) => {
      registration.active?.postMessage({ type: 'SGDIGITAL_SYNC_BADGE', unreadCount: normalized })
      await applyBadge(registration as ServiceWorkerRegistration & BadgeHost, normalized).catch(() => undefined)
    })
    .catch(() => undefined)
}