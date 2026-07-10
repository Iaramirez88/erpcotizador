'use client'

import { useEffect, useMemo, useState } from 'react'
import { type AccessLevel, type ModuleKey } from '@prisma/client'

type MeData = {
  access?: Partial<Record<ModuleKey, AccessLevel>>
  canManageCustomProductRequests?: boolean
}

const ACCESS_ORDER: Record<AccessLevel, number> = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3,
}

export function useCurrentUserAccess() {
  const [data, setData] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: MeData } | null
        if (!cancelled) setData(json?.success ? (json.data ?? null) : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const access = data?.access ?? {}

  return useMemo(() => {
    const getModuleAccess = (module: ModuleKey): AccessLevel => access[module] ?? 'NONE'
    const hasWriteAccess = (module: ModuleKey) => ACCESS_ORDER[getModuleAccess(module)] >= ACCESS_ORDER.WRITE
    const hasAdminAccess = (module: ModuleKey) => ACCESS_ORDER[getModuleAccess(module)] >= ACCESS_ORDER.ADMIN

    return {
      data,
      loading,
      access,
      getModuleAccess,
      hasWriteAccess,
      hasAdminAccess,
    }
  }, [access, data, loading])
}