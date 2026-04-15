const CACHE_NAME = 'ordex-shell-v2'
const APP_SHELL = ['/', '/offline', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png']

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

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone()
        if (isSameOrigin && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        if (isNavigation) {
          const offlinePage = await caches.match('/offline')
          if (offlinePage) return offlinePage
        }

        const homePage = await caches.match('/')
        if (homePage) return homePage

        throw new Error('No hay contenido disponible sin conexión.')
      })
  )
})