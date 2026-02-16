'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { useUiStore } from '@/lib/ui-store'

export default function RouteLoadingIndicator() {
  const pathname = usePathname()
  const routeLoading = useUiStore((s) => s.routeLoading)
  const setRouteLoading = useUiStore((s) => s.setRouteLoading)

  const [visible, setVisible] = useState(false)
  const startedAtRef = useRef<number>(0)
  const hideTimeoutRef = useRef<number | null>(null)
  const MIN_VISIBLE_MS = 250

  useEffect(() => {
    if (!routeLoading) return
    startedAtRef.current = Date.now()
    setVisible(true)
  }, [routeLoading])

  useEffect(() => {
    if (!visible) return

    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current)
    const elapsed = Date.now() - startedAtRef.current
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)

    hideTimeoutRef.current = window.setTimeout(() => {
      setVisible(false)
      setRouteLoading(false)
    }, remaining)

    return () => {
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!visible) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-50 bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}
