'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDashboardLastRouteStorageKey, isSafeDashboardRoute } from '@/lib/dashboard-last-route'

type ContinueLastViewButtonProps = {
  userId: string
  fallbackHref: string
}

export default function ContinueLastViewButton({ userId, fallbackHref }: ContinueLastViewButtonProps) {
  const [href, setHref] = useState(fallbackHref)

  useEffect(() => {
    if (!userId) {
      setHref(fallbackHref)
      return
    }

    try {
      const storedHref = window.localStorage.getItem(getDashboardLastRouteStorageKey(userId))
      if (storedHref && isSafeDashboardRoute(storedHref)) {
        setHref(storedHref)
        return
      }
    } catch {
      // ignore
    }

    setHref(fallbackHref)
  }, [fallbackHref, userId])

  return (
    <Button asChild className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
      <Link href={href}>
        <Sparkles className="mr-2 h-4 w-4" />
        Continuar donde ibas
      </Link>
    </Button>
  )
}