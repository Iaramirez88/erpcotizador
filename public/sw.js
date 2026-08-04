const CACHE_NAME = 'ordex-shell-v4'
const APP_SHELL = ['/', '/offline', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png']

function normalizeNavigationUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '/dashboard/notificaciones'

  try {
    const url = new URL(value, self.location.origin)
    if (url.origin !== self.location.origin) return '/dashboard/notificaciones'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/dashboard/notificaciones'
  }
}

function buildOfflineResponse() {
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function isStaticAsset(pathname) {
  return pathname.startsWith('/_next/static/')
    || pathname.startsWith('/images/')
    || /\.(?:css|js|mjs|png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/i.test(pathname)
}

function isPublicEmbedPath(pathname) {
  return pathname.startsWith('/chatbot/')
    || pathname.startsWith('/form/')
    || pathname.startsWith('/booking/')
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    const offlinePage = await caches.match('/offline')
    if (offlinePage) return offlinePage

    const appShell = await caches.match('/')
    return appShell || buildOfflineResponse()
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)
  const isSameOrigin = requestUrl.origin === self.location.origin
  const isNavigation = event.request.mode === 'navigate'

  if (!isSameOrigin) return
  if (requestUrl.pathname.startsWith('/api/')) return
  if (requestUrl.pathname.includes('/_next/webpack-hmr')) return
  if (isPublicEmbedPath(requestUrl.pathname)) return

  if (isNavigation) {
    event.respondWith(networkFirstNavigation(event.request))
    return
  }

  if (isStaticAsset(requestUrl.pathname) || APP_SHELL.includes(requestUrl.pathname)) {
    event.respondWith(cacheFirstAsset(event.request))
    return
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request)
      return cached || buildOfflineResponse()
    })
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = null
  try {
    payload = event.data.json()
  } catch {
    payload = null
  }

  if (!payload || typeof payload !== 'object') return

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : 'Nueva notificacion'
  const body = typeof payload.body === 'string' && payload.body.trim()
    ? payload.body.trim()
    : 'Tienes una nueva notificacion pendiente.'
  const actionUrl = normalizeNavigationUrl(payload.actionUrl)
  const tag = typeof payload.tag === 'string' && payload.tag.trim() ? payload.tag.trim() : 'ordex-notification'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const hasVisibleClient = clients.some((client) => {
        try {
          const url = new URL(client.url)
          return url.origin === self.location.origin && client.visibilityState === 'visible'
        } catch {
          return false
        }
      })

      if (hasVisibleClient) return undefined

      return self.registration.showNotification(title, {
        body,
        tag,
        badge: '/icon-192.png',
        icon: '/icon-192.png',
        data: {
          actionUrl,
        },
      })
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const actionUrl = normalizeNavigationUrl(event.notification.data?.actionUrl)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => {
        try {
          const url = new URL(client.url)
          return url.origin === self.location.origin
        } catch {
          return false
        }
      })

      if (existingClient) {
        return existingClient.focus().then(() => existingClient.navigate(actionUrl))
      }

      return self.clients.openWindow(actionUrl)
    })
  )
})