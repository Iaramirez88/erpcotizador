/**
 * Componente Header
 * 
 * Barra superior del dashboard con búsqueda y acciones
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useUiStore } from "@/lib/ui-store"
import { NavSettingsDialog } from "@/components/dashboard/nav-settings-dialog"
import { useTour } from "@/components/tour/tour-provider"
import NotificationsBell from "@/components/dashboard/notifications-bell"
import { useI18n } from "@/components/providers/i18n-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  user: {
    name?: string | null
    role?: string
    image?: string | null
    allowedModules?: string[] | null
  }
}

function moduleForHref(href: string): string | null {
  switch (href) {
    case '/dashboard':
      return 'DASHBOARD'
    case '/dashboard/reportes':
      return 'REPORTES'
    case '/dashboard/contabilidad':
      return 'CONTABILIDAD'
    case '/dashboard/cotizador':
      return 'COTIZADOR'
    case '/dashboard/cotizaciones':
      return 'COTIZACIONES'
    case '/dashboard/remisiones':
      return 'REMISIONES'
    case '/dashboard/pos':
      return 'POS'
    case '/dashboard/clientes':
      return 'CLIENTES'
    case '/dashboard/ordenes':
      return 'ORDENES'
    case '/dashboard/litografia':
      return 'COTIZADOR'
    case '/dashboard/escaneos':
      return 'ESCANEOS'
    case '/dashboard/materiales':
      return 'MATERIALES'
    case '/dashboard/terminados':
      return 'MATERIALES'
    case '/dashboard/inventario':
    case '/dashboard/inventario/traslados':
      return 'INVENTARIO'
    case '/dashboard/compras':
      return 'COMPRAS'
    case '/dashboard/proveedores':
      return 'PROVEEDORES'
    case '/dashboard/configuracion/desperdicios':
    case '/dashboard/configuracion/sedes':
    case '/dashboard/configuracion/usuarios':
    case '/dashboard/configuracion/permisos':
    case '/dashboard/configuracion/empresa':
    case '/dashboard/configuracion/plan':
      return 'CONFIG'
    default:
      return null
  }
}

export default function Header({ user }: HeaderProps) {
  const { t, language, setLanguage } = useI18n()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [planName, setPlanName] = useState<string>("")
  const [navPrefs, setNavPrefs] = useState<Record<string, boolean> | null>(null)
  const [canManageBilling, setCanManageBilling] = useState(() => user.role === 'ADMIN')
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav)
  const { hasCurrentTour, startCurrentTour, resetCurrentTour } = useTour()

  useEffect(() => {
    if (user.role === 'ADMIN') setCanManageBilling(true)
  }, [user.role])

  const allowedModules = useMemo(() => {
    if (!user.allowedModules) return null
    return new Set(user.allowedModules)
  }, [user.allowedModules])

  const initials = useMemo(() => {
    const name = (user.name ?? '').trim()
    if (!name) return 'U'
    const parts = name.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? 'U'
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (a + b).toUpperCase()
  }, [user.name])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/plan')
        const json = (await res.json().catch(() => null)) as { current?: { nombre?: string } } | null
        if (!cancelled && typeof json?.current?.nombre === 'string') {
          setPlanName(json.current.nombre)
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch('/api/ui-preferences')
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { nav?: Record<string, boolean> } } | null
        if (!cancelled && json?.success) {
          setNavPrefs(json.data?.nav ?? {})
        }
      } catch {
        // ignore
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadBillingAccess() {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { canManageBilling?: boolean } | null }
          | null
        if (!cancelled && res.ok && json?.success) {
          setCanManageBilling(Boolean(json.data?.canManageBilling))
        }
      } catch {
        // ignore
      }
    }
    void loadBillingAccess()
    return () => {
      cancelled = true
    }
  }, [])

  const navItems = useMemo(() => {
    const base = [
      { name: t('nav.dashboard'), href: '/dashboard' },
      { name: t('nav.reports'), href: '/dashboard/reportes' },
      { name: t('nav.accounting'), href: '/dashboard/contabilidad' },
      { name: t('nav.quote'), href: '/dashboard/cotizador' },
      { name: t('nav.quotes'), href: '/dashboard/cotizaciones' },
      { name: t('nav.billing'), href: '/dashboard/pos' },
      { name: t('nav.deliveries'), href: '/dashboard/remisiones' },
      { name: t('nav.clients'), href: '/dashboard/clientes' },
      { name: t('nav.orders'), href: '/dashboard/ordenes' },
      { name: t('nav.printshop'), href: '/dashboard/litografia' },
      { name: t('nav.scans'), href: '/dashboard/escaneos' },
      { name: t('nav.products'), href: '/dashboard/materiales' },
      { name: t('nav.finishes'), href: '/dashboard/terminados' },
      { name: t('nav.inventory'), href: '/dashboard/inventario' },
      { name: t('nav.transfers'), href: '/dashboard/inventario/traslados' },
      { name: t('nav.purchases'), href: '/dashboard/compras' },
      { name: t('nav.suppliers'), href: '/dashboard/proveedores' },
      { name: t('nav.waste'), href: '/dashboard/configuracion/desperdicios' },
      { name: t('nav.branches'), href: '/dashboard/configuracion/sedes' },
      { name: t('nav.users'), href: '/dashboard/configuracion/usuarios' },
      { name: t('nav.permissions'), href: '/dashboard/configuracion/permisos' },
      { name: t('nav.company'), href: '/dashboard/configuracion/empresa' },
      ...(canManageBilling ? [{ name: t('nav.plan'), href: '/dashboard/configuracion/plan' }] : []),
    ]
    const withRbacGate = base.filter((it) => {
      const moduleKey = moduleForHref(it.href)
      if (!moduleKey) return true
      if (!allowedModules) return true
      return allowedModules.has(moduleKey)
    })
    return withRbacGate
  }, [canManageBilling, t, allowedModules])

  async function saveNav(next: Record<string, boolean>) {
    setNavPrefs(next)
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nav: next }),
    }).catch(() => null)
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Breadcrumb / Title */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleMobileNav}
            aria-label={t('header.openMenu')}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>

          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('header.controlPanel')}</h2>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <NotificationsBell onUnreadCountChange={setUnreadCount} />

          {/* Más opciones */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" type="button" className="relative">
                {t('common.more')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('header.sections.access')}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/perfil">{t('header.profile')}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {navPrefs ? (
                <NavSettingsDialog
                  items={navItems}
                  value={navPrefs}
                  onSave={saveNav}
                  trigger={(open) => (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        open()
                      }}
                    >
                      {t('header.customizeMenu')}
                    </DropdownMenuItem>
                  )}
                />
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('header.sections.help')}</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!hasCurrentTour}
                onSelect={(e) => {
                  e.preventDefault()
                  startCurrentTour()
                }}
              >
                {t('header.tour.view')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasCurrentTour}
                onSelect={(e) => {
                  e.preventDefault()
                  void resetCurrentTour()
                  startCurrentTour()
                }}
              >
                {t('header.tour.restart')}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('common.language')}</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setLanguage('es')
                }}
              >
                {t('common.spanish')}{language === 'es' ? ' ✓' : ''}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setLanguage('en')
                }}
              >
                {t('common.english')}{language === 'en' ? ' ✓' : ''}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="relative h-9 w-9 rounded-full overflow-hidden border bg-white">
              {user.image ? (
                <img src={user.image} alt={user.name ?? 'Usuario'} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-xs font-semibold text-slate-700 bg-slate-100">
                  {initials}
                </div>
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role?.toLowerCase()}
                {planName ? ` · Plan: ${planName}` : ''}
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
            >
              {t('header.signOut')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
