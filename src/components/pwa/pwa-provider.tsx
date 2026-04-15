'use client'

import { useEffect } from 'react'

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      } catch (error) {
        console.error('No se pudo registrar el service worker de PWA.', error)
      }
    }

    void register()
  }, [])

  return null
}