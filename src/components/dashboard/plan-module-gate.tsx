'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { moduleForDashboardPath } from '@/lib/dashboard-navigation'

type EnabledResponse =
  | { ok: true; enabled: string[]; planTier?: string }
  | { ok?: false; error?: string }

export default function PlanModuleGate() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null)

  const currentModule = useMemo(() => moduleForDashboardPath(pathname), [pathname])

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
