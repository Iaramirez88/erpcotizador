'use client'

import { useEffect } from 'react'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number
}

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false

    const isDevelopment = process.env.NODE_ENV !== 'production'

    const cleanupDevelopmentServiceWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      } catch {
        // ignore
      }

      if (!('caches' in window)) return

      try {
        const keys = await caches.keys()
        await Promise.all(
          keys
            .filter((key) => key.startsWith('ordex-shell-'))
            .map((key) => caches.delete(key))
        )
      } catch {
        // ignore
      }
    }

    if (isDevelopment) {
      void cleanupDevelopmentServiceWorkers()
      return () => {
        cancelled = true
      }
    }

    const register = async () => {
      try {
        if (cancelled) return
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      } catch (error) {
        console.error('No se pudo registrar el service worker de PWA.', error)
      }
    }

    const scheduleRegister = () => {
      const idleWindow = window as IdleWindow
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleWindow.requestIdleCallback(() => {
          void register()
        })
        return
      }

      globalThis.setTimeout(() => {
        void register()
      }, 250)
    }

    if (document.readyState === 'complete') {
      scheduleRegister()
    } else {
      window.addEventListener('load', scheduleRegister, { once: true })
    }

    return () => {
      cancelled = true
      window.removeEventListener('load', scheduleRegister)
    }
  }, [])

  return null
}