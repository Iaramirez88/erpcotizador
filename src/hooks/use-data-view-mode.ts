'use client'

import { useEffect, useState } from 'react'
import type { DataViewMode } from '@/lib/payroll'

type UiPreferencesResponse = {
  success?: boolean
  data?: {
    dataView?: Record<string, DataViewMode>
  }
}

export function useDataViewMode(scope: string, defaultMode: DataViewMode = 'list') {
  const [mode, setMode] = useState<DataViewMode>(defaultMode)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/ui-preferences', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as UiPreferencesResponse | null
        if (!cancelled && json?.success) {
          setMode(json.data?.dataView?.[scope] ?? defaultMode)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [scope, defaultMode])

  async function updateMode(nextMode: DataViewMode) {
    setMode(nextMode)
    try {
      const res = await fetch('/api/ui-preferences', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as UiPreferencesResponse | null
      const current = json?.data?.dataView ?? {}

      await fetch('/api/ui-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataView: { ...current, [scope]: nextMode } }),
      })
    } catch {
      // ignore; optimistic update is enough for the current session
    }
  }

  return { mode, setMode: updateMode, ready }
}