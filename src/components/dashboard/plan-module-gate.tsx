'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type EnabledResponse =
  | { ok: true; enabled: string[]; planTier?: string }
  | { ok?: false; error?: string }

function moduleForPath(pathname: string): string | null {
  // Siempre permitir la pantalla de planes para upgrade.
  if (pathname.startsWith('/dashboard/configuracion/plan')) return null

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (pathname === '/dashboard') return 'DASHBOARD'
    if (pathname.startsWith('/dashboard/reportes')) return 'REPORTES'
    if (pathname.startsWith('/dashboard/cotizador')) return 'COTIZADOR'
    if (pathname.startsWith('/dashboard/cotizaciones')) return 'COTIZACIONES'
    if (pathname.startsWith('/dashboard/clientes')) return 'CLIENTES'
    if (pathname.startsWith('/dashboard/remisiones')) return 'REMISIONES'
    if (pathname.startsWith('/dashboard/pos')) return 'POS'
    if (pathname.startsWith('/dashboard/ordenes')) return 'ORDENES'
    if (pathname.startsWith('/dashboard/escaneos')) return 'ESCANEOS'
    if (pathname.startsWith('/dashboard/terminados')) return 'MATERIALES'
    if (pathname.startsWith('/dashboard/inventario')) return 'INVENTARIO'
    if (pathname.startsWith('/dashboard/bodegas')) return 'INVENTARIO'
    if (pathname.startsWith('/dashboard/compras')) return 'COMPRAS'
    if (pathname.startsWith('/dashboard/proveedores')) return 'PROVEEDORES'
    if (pathname.startsWith('/dashboard/litografia')) return 'COTIZADOR'

    // Todo lo de configuración (excepto /plan) se considera CONFIG.
    if (pathname.startsWith('/dashboard/configuracion')) return 'CONFIG'
  }

  return null
}

export default function PlanModuleGate() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null)

  const currentModule = useMemo(() => moduleForPath(pathname), [pathname])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/modules/enabled', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as EnabledResponse
        if (!cancelled && res.ok && 'ok' in json && json.ok && Array.isArray(json.enabled)) {
          setEnabledModules(new Set(json.enabled))
        }
      } catch {
        // no-op
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!currentModule) return
    if (!enabledModules) return

    if (!enabledModules.has(currentModule)) {
      router.replace(`/dashboard/configuracion/plan?blockedModule=${encodeURIComponent(currentModule)}`)
    }
  }, [currentModule, enabledModules, router])

  return null
}
