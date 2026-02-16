'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useUiStore } from '@/lib/ui-store'

function isModifiedEvent(e: MouseEvent) {
  return e.metaKey || e.altKey || e.ctrlKey || e.shiftKey
}

function shouldIgnoreAnchor(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== '_self') return true
  if (anchor.hasAttribute('download')) return true
  const rel = (anchor.getAttribute('rel') || '').toLowerCase()
  if (rel.includes('external')) return true
  return false
}

export default function RouteLoadingStartListener() {
  const pathname = usePathname()
  const setRouteLoading = useUiStore((s) => s.setRouteLoading)

  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      if (e.defaultPrevented) return
      if (e.button !== 0) return // solo click izquierdo
      if (isModifiedEvent(e)) return

      const target = e.target as HTMLElement | null
      if (!target) return

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (shouldIgnoreAnchor(anchor)) return

      const href = anchor.getAttribute('href')
      if (!href) return
      if (href.startsWith('#')) return
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return

      let url: URL
      try {
        url = new URL(anchor.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return
      const nextPath = url.pathname
      if (!nextPath) return

      // Evitar encender loader si es misma ruta
      if (nextPath === pathname) return
      if (pathname.startsWith(nextPath + '/')) return

      setRouteLoading(true)
    }

    // Captura para asegurar que corre antes de navegación
    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [pathname, setRouteLoading])

  return null
}
