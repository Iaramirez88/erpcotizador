'use client'

import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { labelForDashboardPath } from '@/lib/dashboard-navigation'

const ALWAYS_ALLOWED_PREFERENCE_PATHS = [
  '/dashboard/perfil',
  '/dashboard/notificaciones',
  '/dashboard/ayuda',
] as const

function isAlwaysAllowedPreferencePath(pathname: string) {
  return ALWAYS_ALLOWED_PREFERENCE_PATHS.some((href) => pathname === href || pathname.startsWith(`${href}/`))
}

function isAllowedDashboardPath(pathname: string, allowedHrefs: Set<string>) {
  if (pathname === '/dashboard') return true

  for (const href of allowedHrefs) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return true
    }
  }

  return false
}

type Props = {
  allowedHrefs: string[] | null
  children: React.ReactNode
}

export default function DashboardPermissionBoundary({ allowedHrefs, children }: Props) {
  const pathname = usePathname() ?? ''
  const allowedHrefSet = useMemo(() => (allowedHrefs?.length ? new Set(allowedHrefs) : null), [allowedHrefs])

  const isAllowed = useMemo(() => {
    if (!pathname || pathname.startsWith('/dashboard/onboarding')) return true
    if (isAlwaysAllowedPreferencePath(pathname)) return true
    if (!allowedHrefSet) return true
    return isAllowedDashboardPath(pathname, allowedHrefSet)
  }, [allowedHrefSet, pathname])

  if (isAllowed) return <>{children}</>

  const sectionLabel = labelForDashboardPath(pathname)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300 bg-white/80 text-amber-700">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">Sin permisos</div>
              <div className="text-base font-semibold">No tienes permisos para esta sección: {sectionLabel}.</div>
              <div className="text-sm text-amber-900/80">Solicítalo a tu administrador para que te habilite el acceso correspondiente y puedas continuar.</div>
            </div>
          </div>
          <Button asChild variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
            <Link href="/dashboard">Volver a Inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}