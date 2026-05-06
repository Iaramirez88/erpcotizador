/**
 * Componente Header
 * 
 * Barra superior del dashboard con búsqueda y acciones
 */

"use client"

import Link from "next/link"
import Image from 'next/image'
import { useEffect, useMemo, useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useUiStore } from "@/lib/ui-store"
import { NavSettingsDialog } from "@/components/dashboard/nav-settings-dialog"
import { useTheme } from "@/components/providers/theme-provider"
import { useTour } from "@/components/tour/tour-provider"
import NotificationsBell from "@/components/dashboard/notifications-bell"
import { useI18n } from "@/components/providers/i18n-provider"
import { buildDashboardNavDefinitions, moduleForDashboardHref, sectionForDashboardHref } from "@/lib/dashboard-navigation"
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
    canManageBilling?: boolean
    canAccessWebsiteServices?: boolean
  }
}

export default function Header({ user }: HeaderProps) {
  const { t, language, setLanguage } = useI18n()
  const { theme, setTheme } = useTheme()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [planName, setPlanName] = useState<string>("")
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [trialBadgeVisible, setTrialBadgeVisible] = useState(false)
  const [navPrefs, setNavPrefs] = useState<Record<string, boolean> | null>(null)
  const [navOrder, setNavOrder] = useState<string[]>([])
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [navSettingsOpen, setNavSettingsOpen] = useState(false)
  const [canManageBilling] = useState(Boolean(user.canManageBilling))
  const [canAccessWebsiteServices] = useState(Boolean(user.canAccessWebsiteServices))
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav)
  const { hasCurrentTour, startCurrentTour, resetCurrentTour } = useTour()

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
        const json = (await res.json().catch(() => null)) as {
          current?: { nombre?: string }
          effective?: { trial?: { isActive?: boolean; daysLeft?: number | null } | null } | null
        } | null
        if (!cancelled && typeof json?.current?.nombre === 'string') {
          setPlanName(json.current.nombre)
        }
        if (!cancelled) {
          const daysLeft = typeof json?.effective?.trial?.daysLeft === 'number' ? json.effective.trial.daysLeft : null
          setTrialDaysLeft(daysLeft)
          setTrialBadgeVisible(Boolean(json?.effective?.trial?.isActive && daysLeft !== null))
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch('/api/ui-preferences')
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { nav?: Record<string, boolean>; navOrder?: string[] } } | null
        if (!cancelled && json?.success) {
          setNavPrefs(json.data?.nav ?? {})
          setNavOrder(Array.isArray(json.data?.navOrder) ? json.data.navOrder : [])
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

  const navItems = useMemo(() => {
    const base = buildDashboardNavDefinitions(t)
    const withRbacGate = base.filter((it) => {
      if (it.href === '/dashboard/configuracion/servicios-web') {
        return canAccessWebsiteServices
      }
      const moduleKey = moduleForDashboardHref(it.href)
      if (!moduleKey) return true
      if (!allowedModules) return true
      return allowedModules.has(moduleKey)
    })
    const withBillingGate = withRbacGate.filter((it) => (it.href === '/dashboard/configuracion/plan' ? canManageBilling : true))
    return withBillingGate.filter((it) => {
      const isSuperAdminRoute = it.href === '/dashboard/configuracion/super-admin/modulos-por-plan'
      if (!isSuperAdminRoute) return true
      return user.role === 'ADMIN'
    }).map((it) => ({ ...it, section: sectionForDashboardHref(it.href) }))
  }, [canAccessWebsiteServices, canManageBilling, t, allowedModules, user.role])

  async function saveNav(next: Record<string, boolean>, nextOrder: string[]) {
    setNavPrefs(next)
    setNavOrder(nextOrder)
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nav: next, navOrder: nextOrder }),
    }).catch(() => null)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/88 px-2 py-1.5 text-foreground shadow-[0_10px_24px_-22px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:px-3 lg:px-4">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-1.5">
        {/* Breadcrumb / Title */}
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleMobileNav}
            aria-label={t('header.openMenu')}
            type="button"
          >
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>

          <h2 className="truncate text-sm font-semibold text-foreground">{t('header.controlPanel')}</h2>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NotificationsBell onUnreadCountChange={setUnreadCount} />

          {navPrefs ? (
            <NavSettingsDialog
              items={navItems}
              value={navPrefs}
              order={navOrder}
              onSave={saveNav}
              open={navSettingsOpen}
              onOpenChange={setNavSettingsOpen}
              trigger={() => null}
            />
          ) : null}

          {/* Más opciones */}
          <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" type="button" className="relative h-8 bg-background/80 px-2 text-xs sm:px-2.5">
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
                <DropdownMenuItem
                  onSelect={() => {
                    setMoreMenuOpen(false)
                    setNavSettingsOpen(true)
                  }}
                >
                  {t('header.customizeMenu')}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tema</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setTheme('light')
                }}
              >
                Claro{theme === 'light' ? ' ✓' : ''}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setTheme('dark')
                }}
              >
                Oscuro{theme === 'dark' ? ' ✓' : ''}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setTheme('system')
                }}
              >
                Sistema{theme === 'system' ? ' ✓' : ''}
              </DropdownMenuItem>
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full border border-border bg-card shadow-sm">
              {user.image ? (
                <Image src={user.image} alt={user.name ?? 'Usuario'} fill className="object-cover" sizes="32px" unoptimized />
              ) : (
                <div className="grid h-full w-full place-items-center bg-muted text-[11px] font-semibold text-foreground">
                  {initials}
                </div>
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[12px] font-medium leading-4 text-slate-900">{user.name}</p>
              <p className="text-[10px] capitalize leading-4 text-slate-500">
                {user.role?.toLowerCase()}
                {planName ? ` · Plan: ${planName}` : ''}
              </p>
              {trialBadgeVisible && trialDaysLeft !== null ? (
                <p className="text-[10px] leading-3.5 text-red-600">
                  {trialDaysLeft <= 1 ? 'Tu prueba termina manana' : `Prueba: ${trialDaysLeft} dia(s) restantes`}
                </p>
              ) : null}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="h-8 px-2"
            >
              {t('header.signOut')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
