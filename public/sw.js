const CACHE_NAME = 'ordex-shell-v3'
const APP_SHELL = ['/', '/offline', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png']

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