'use client'

import { useCallback, useEffect, useState } from 'react'
import { sanitizeContabilidadNavPinnedHrefs } from '@/lib/contabilidad-nav'
import { useUiStore } from '@/lib/ui-store'

type UiPreferencesResponse = {
  success?: boolean
  data?: {
    contabilidadNav?: {
      pinnedHrefs?: unknown
    }
  }
}

/** Caché corta para no repetir el GET en cada navegación dentro de contabilidad. */
const SERVER_CACHE_TTL_MS = 30_000
let serverCache: { pinnedHrefs: string[]; at: number } | null = null

function readServerCache(): string[] | null {
  if (!serverCache) return null
  if (Date.now() - serverCache.at > SERVER_CACHE_TTL_MS) return null
  return serverCache.pinnedHrefs
}

function writeServerCache(pinnedHrefs: string[]) {
  serverCache = { pinnedHrefs: [...pinnedHrefs], at: Date.now() }
}

async function fetchServerPinnedHrefs(): Promise<string[] | null> {
  try {
    const res = await fetch('/api/ui-preferences', { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as UiPreferencesResponse | null
    if (!json?.success) return null
    return sanitizeContabilidadNavPinnedHrefs(json.data?.contabilidadNav?.pinnedHrefs)
  } catch {
    return null
  }
}

async function persistServerPinnedHrefs(pinnedHrefs: string[]): Promise<boolean> {
  try {
    const res = await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contabilidadNav: { pinnedHrefs } }),
    })
    return res.ok
  } catch {
    return false
  }
}

export type ContabilidadNavPinsSyncState = 'loading' | 'synced' | 'local'

/**
 * Anclas de la barra de contabilidad con persistencia en base de datos
 * (`ui_preferences`) y respaldo en localStorage.
 *
 * Flujo:
 * 1. Hidrata de localStorage para pintar sin esperar red.
 * 2. Consulta la API; si la cuenta ya tiene anclas guardadas, éstas mandan
 *    (permite compartirlas entre dispositivos).
 * 3. Si la cuenta no tiene anclas pero el navegador sí, migra una sola vez.
 * 4. Cada cambio se guarda localmente y se sincroniza con la API.
 */
export function useContabilidadNavPins() {
  const pinnedHrefs = useUiStore((state) => state.contabilidadNavPinned)
  const hydratePinned = useUiStore((state) => state.hydrateContabilidadNavPinned)
  const setPinnedHrefs = useUiStore((state) => state.setContabilidadNavPinned)
  const [syncState, setSyncState] = useState<ContabilidadNavPinsSyncState>('loading')

  useEffect(() => {
    let cancelled = false

    hydratePinned()
    const localPinned = sanitizeContabilidadNavPinnedHrefs(useUiStore.getState().contabilidadNavPinned)

    async function sync() {
      const cached = readServerCache()
      if (cached) {
        if (!cancelled && cached.length > 0) setPinnedHrefs(cached)
        if (!cancelled) setSyncState('synced')
        return
      }

      const serverPinned = await fetchServerPinnedHrefs()
      if (cancelled) return

      if (serverPinned === null) {
        // Sin sesión o sin red: se conserva lo guardado en este dispositivo.
        setSyncState('local')
        return
      }

      if (serverPinned.length === 0 && localPinned.length > 0) {
        // Migración única de anclas que sólo vivían en localStorage.
        const ok = await persistServerPinnedHrefs(localPinned)
        writeServerCache(localPinned)
        if (!cancelled) setSyncState(ok ? 'synced' : 'local')
        return
      }

      writeServerCache(serverPinned)
      if (serverPinned.length > 0) setPinnedHrefs(serverPinned)
      setSyncState('synced')
    }

    void sync()

    return () => {
      cancelled = true
    }
  }, [hydratePinned, setPinnedHrefs])

  const togglePinned = useCallback(
    (href: string) => {
      const current = useUiStore.getState().contabilidadNavPinned
      const next = current.includes(href) ? current.filter((entry) => entry !== href) : [...current, href]

      setPinnedHrefs(next)
      writeServerCache(next)
      void persistServerPinnedHrefs(next)
    },
    [setPinnedHrefs],
  )

  const clearPinned = useCallback(() => {
    setPinnedHrefs([])
    writeServerCache([])
    void persistServerPinnedHrefs([])
  }, [setPinnedHrefs])

  return { pinnedHrefs, togglePinned, clearPinned, syncState }
}
