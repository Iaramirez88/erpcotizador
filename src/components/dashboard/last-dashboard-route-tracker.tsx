'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getDashboardLastRouteStorageKey, isPersistableDashboardRoute } from '@/lib/dashboard-last-route'

export default function LastDashboardRouteTracker({ userId }: { userId: string }) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''

  useEffect(() => {
    if (!userId || !isPersistableDashboardRoute(pathname)) return

    const href = search ? `${pathname}?${search}` : pathname

    try {
      window.localStorage.setItem(getDashboardLastRouteStorageKey(userId), href)
    } catch {
      return
    }
  }, [pathname, search, userId])

  return null
}
