'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type OnboardingScopeResponse = {
  ok?: boolean
  dashboard?: { allowedHrefs?: string[] } | null
}

function isAllowedPath(pathname: string, allowedHrefs: Set<string>) {
  if (pathname === '/dashboard') return true

  for (const href of allowedHrefs) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return true
    }
  }

  return false
}

export default function DashboardScopeGate() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [allowedHrefs, setAllowedHrefs] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/onboarding/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as OnboardingScopeResponse
        if (cancelled || !res.ok || !json.ok) return
        setAllowedHrefs(
          Array.isArray(json.dashboard?.allowedHrefs)
            ? json.dashboard.allowedHrefs.filter((href): href is string => typeof href === 'string' && href.startsWith('/dashboard'))
            : []
        )
      } catch {
        // no-op
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const allowedHrefSet = useMemo(() => (allowedHrefs?.length ? new Set(allowedHrefs) : null), [allowedHrefs])

  useEffect(() => {
    if (!allowedHrefSet || !pathname || pathname.startsWith('/dashboard/onboarding')) return
    if (isAllowedPath(pathname, allowedHrefSet)) return

    router.replace('/dashboard')
  }, [allowedHrefSet, pathname, router])

  return null
}