'use client'

import { useEffect } from 'react'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number
}

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false

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