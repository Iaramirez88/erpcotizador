/**
 * Componente Header
 * 
 * Barra superior del dashboard con búsqueda y acciones
 */

"use client"

import Link from "next/link"
import Image from 'next/image'
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { ChevronDown, Lock, LogOut } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { useUiStore } from "@/lib/ui-store"
import { NavSettingsDialog, type SidebarTooltipPrefs } from "@/components/dashboard/nav-settings-dialog"
import { useTheme } from "@/components/providers/theme-provider"
import { useTour } from "@/components/tour/tour-provider"
import NotificationsBell from "@/components/dashboard/notifications-bell"
import { useI18n } from "@/components/providers/i18n-provider"
import { buildDashboardNavDefinitions, moduleForDashboardHref, sectionForDashboardHref } from "@/lib/dashboard-navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContentPanel,
  DropdownMenuSubTriggerItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  user: {
    name?: string | null
    role?: string
    image?: string | null
    isImpersonating?: boolean
    impersonatedByName?: string | null
    impersonatedByEmail?: string | null
    allowedModules?: string[] | null
    allowedNavHrefs?: string[] | null
    canManageBilling?: boolean
    canAccessWebsiteServices?: boolean
  }
  variant?: 'sticky' | 'inline' | 'sidebar-footer' | 'mobile-footer' | 'mobile-footer-profile'
}

const DEFAULT_SIDEBAR_TOOLTIP_PREFS: SidebarTooltipPrefs = { desktop: true, mobile: true }

function normalizeSidebarTooltipPrefs(value: Partial<SidebarTooltipPrefs> | null | undefined): SidebarTooltipPrefs {
  return {
    desktop: value?.desktop !== false,
    mobile: value?.mobile !== false,
  }
}

function MenuChevron() {
  return (
    <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function MobileMenuChevron({ open }: { open: boolean }) {
  return <ChevronDown className={open ? 'h-4 w-4 text-slate-500 transition-transform rotate-180' : 'h-4 w-4 text-slate-500 transition-transform'} />
}

function MenuIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center text-slate-700">{children}</span>
}

export default function Header({ user, variant = 'sticky' }: HeaderProps) {
  const router = useRouter()
  const { t, language, setLanguage } = useI18n()
  const { theme, setTheme } = useTheme()
  const [navPrefs, setNavPrefs] = useState<Record<string, boolean> | null>(null)
  const [navOrder, setNavOrder] = useState<string[]>([])
  const [sidebarTooltipPrefs, setSidebarTooltipPrefs] = useState<SidebarTooltipPrefs>(DEFAULT_SIDEBAR_TOOLTIP_PREFS)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [navSettingsOpen, setNavSettingsOpen] = useState(false)
  const [returningToSuperAdmin, setReturningToSuperAdmin] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [expandedMobileSection, setExpandedMobileSection] = useState<string | null>(null)
  const [canManageBilling] = useState(Boolean(user.canManageBilling))
  const [canAccessWebsiteServices] = useState(Boolean(user.canAccessWebsiteServices))
  const [allowedNavHrefs] = useState<string[]>(() => user.allowedNavHrefs ?? [])
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav)
  const { hasCurrentTour, startCurrentTour, resetCurrentTour } = useTour()

  const allowedModules = useMemo(() => {
    if (!user.allowedModules) return null
    return new Set(user.allowedModules)
  }, [user.allowedModules])
  const allowedNavHrefSet = useMemo(() => (allowedNavHrefs.length ? new Set(allowedNavHrefs) : null), [allowedNavHrefs])

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
        const res = await fetch('/api/ui-preferences')
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { nav?: Record<string, boolean>; navOrder?: string[]; sidebarTooltips?: SidebarTooltipPrefs } } | null
        if (!cancelled && json?.success) {
          setNavPrefs(json.data?.nav ?? {})
          setNavOrder(Array.isArray(json.data?.navOrder) ? json.data.navOrder : [])
          setSidebarTooltipPrefs(normalizeSidebarTooltipPrefs(json.data?.sidebarTooltips))
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
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const applyMatch = (matches: boolean) => setIsMobileViewport(matches)
    applyMatch(mediaQuery.matches)

    const onChange = (event: MediaQueryListEvent) => applyMatch(event.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    function handleUiPreferencesUpdated(event: Event) {
      const detail = (event as CustomEvent<{ nav?: Record<string, boolean>; navOrder?: string[]; sidebarTooltips?: SidebarTooltipPrefs }>).detail
      if (!detail) return
      if (detail.nav) setNavPrefs(detail.nav)
      if (Array.isArray(detail.navOrder)) setNavOrder(detail.navOrder)
      if (detail.sidebarTooltips) setSidebarTooltipPrefs(normalizeSidebarTooltipPrefs(detail.sidebarTooltips))
    }

    window.addEventListener('ui-preferences:nav-updated', handleUiPreferencesUpdated)
    return () => window.removeEventListener('ui-preferences:nav-updated', handleUiPreferencesUpdated)
  }, [])

  useEffect(() => {
    if (!userMenuOpen) {
      setExpandedMobileSection(null)
    }
  }, [userMenuOpen])

  const navItems = useMemo(() => {
    const base = buildDashboardNavDefinitions(t)
    const withRbacGate = base.filter((it) => {
      if (allowedNavHrefSet?.has(it.href)) return true
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
  }, [allowedNavHrefSet, canAccessWebsiteServices, canManageBilling, t, allowedModules, user.role])

  async function saveNav(next: Record<string, boolean>, nextOrder: string[], nextTooltipPrefs: SidebarTooltipPrefs) {
    setNavPrefs(next)
    setNavOrder(nextOrder)
    setSidebarTooltipPrefs(nextTooltipPrefs)
    window.dispatchEvent(new CustomEvent('ui-preferences:nav-updated', {
      detail: { nav: next, navOrder: nextOrder, sidebarTooltips: nextTooltipPrefs },
    }))
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nav: next, navOrder: nextOrder, sidebarTooltips: nextTooltipPrefs }),
    }).catch(() => null)
  }

  async function returnToSuperAdmin() {
    setReturningToSuperAdmin(true)
    try {
      const res = await fetch('/api/auth/impersonation/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; accessUrl?: string }
      if (!res.ok || !json.ok || !json.accessUrl) {
        alert(json.error || t('header.returnToSuperAdminError'))
        return
      }

      router.push(json.accessUrl)
      router.refresh()
    } catch {
      alert(t('header.returnToSuperAdminError'))
    } finally {
      setReturningToSuperAdmin(false)
    }
  }

  function toggleMobileSection(key: string) {
    setExpandedMobileSection((current) => (current === key ? null : key))
  }

  function renderMobileSubmenu(options: {
    keyName: string
    label: string
    icon: React.ReactNode
    disabled?: boolean
    children: React.ReactNode
  }) {
    const open = expandedMobileSection === options.keyName

    return (
      <div className={options.disabled ? 'opacity-50' : ''}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-[15px] font-medium text-slate-700 transition hover:bg-slate-100"
          onClick={() => {
            if (options.disabled) return
            toggleMobileSection(options.keyName)
          }}
          disabled={options.disabled}
        >
          <span className="flex items-center gap-3">
            <MenuIcon>{options.icon}</MenuIcon>
            <span>{options.label}</span>
          </span>
          <MobileMenuChevron open={open} />
        </button>
        {open ? <div className="mt-1 space-y-1 rounded-2xl bg-slate-50 p-2">{options.children}</div> : null}
      </div>
    )
  }

  const configMenu = isMobileViewport
    ? renderMobileSubmenu({
        keyName: 'configuracion',
        label: 'Configuración',
        disabled: !canManageBilling,
        icon: (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        ),
        children: (
          <>
            <Link href="/dashboard/configuracion/plan" className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => setUserMenuOpen(false)}>
              Facturación
            </Link>
            <Link href="/dashboard/configuracion/plan?tab=almacenamiento" className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => setUserMenuOpen(false)}>
              Consumo actual de espacio
            </Link>
          </>
        ),
      })
    : (
      <DropdownMenuSub>
        <DropdownMenuSubTriggerItem className="rounded-2xl px-3 py-3 text-[15px] font-medium text-slate-700 focus:bg-slate-100 data-[state=open]:bg-slate-100" disabled={!canManageBilling}>
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <MenuIcon>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </MenuIcon>
              <span>Configuración</span>
            </span>
            <MenuChevron />
          </div>
        </DropdownMenuSubTriggerItem>
        <DropdownMenuSubContentPanel className="w-64 rounded-2xl p-2">
          <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700">
            <Link href="/dashboard/configuracion/plan">Facturación</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700">
            <Link href="/dashboard/configuracion/plan?tab=almacenamiento">Consumo actual de espacio</Link>
          </DropdownMenuItem>
        </DropdownMenuSubContentPanel>
      </DropdownMenuSub>
    )

  const themeMenu = isMobileViewport
    ? renderMobileSubmenu({
        keyName: 'tema',
        label: 'Tema',
        icon: (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9Zm0 4v5l3 3" />
          </svg>
        ),
        children: (
          <>
            <button type="button" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => { setTheme('light'); setUserMenuOpen(false) }}>
              Claro{theme === 'light' ? ' ✓' : ''}
            </button>
            <button type="button" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => { setTheme('dark'); setUserMenuOpen(false) }}>
              Oscuro{theme === 'dark' ? ' ✓' : ''}
            </button>
            <button type="button" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => { setTheme('system'); setUserMenuOpen(false) }}>
              Sistema{theme === 'system' ? ' ✓' : ''}
            </button>
          </>
        ),
      })
    : (
      <DropdownMenuSub>
        <DropdownMenuSubTriggerItem className="rounded-2xl px-3 py-3 text-[15px] font-medium text-slate-700 focus:bg-slate-100 data-[state=open]:bg-slate-100">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <MenuIcon>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9Zm0 4v5l3 3" />
                </svg>
              </MenuIcon>
              <span>Tema</span>
            </span>
            <MenuChevron />
          </div>
        </DropdownMenuSubTriggerItem>
        <DropdownMenuSubContentPanel className="w-56 rounded-2xl p-2">
          <DropdownMenuItem className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700" onSelect={(e) => { e.preventDefault(); setTheme('light') }}>
            Claro{theme === 'light' ? ' ✓' : ''}
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700" onSelect={(e) => { e.preventDefault(); setTheme('dark') }}>
            Oscuro{theme === 'dark' ? ' ✓' : ''}
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700" onSelect={(e) => { e.preventDefault(); setTheme('system') }}>
            Sistema{theme === 'system' ? ' ✓' : ''}
          </DropdownMenuItem>
        </DropdownMenuSubContentPanel>
      </DropdownMenuSub>
    )

  const languageMenu = isMobileViewport
    ? renderMobileSubmenu({
        keyName: 'idioma',
        label: t('common.language'),
        icon: (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1 13 4-4m0 0 4 4m-4-4v7M4 12h8m-6 7h2" />
          </svg>
        ),
        children: (
          <>
            <button type="button" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => { setLanguage('es'); setUserMenuOpen(false) }}>
              {t('common.spanish')}{language === 'es' ? ' ✓' : ''}
            </button>
            <button type="button" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => { setLanguage('en'); setUserMenuOpen(false) }}>
              {t('common.english')}{language === 'en' ? ' ✓' : ''}
            </button>
          </>
        ),
      })
    : (
      <DropdownMenuSub>
        <DropdownMenuSubTriggerItem className="rounded-2xl px-3 py-3 text-[15px] font-medium text-slate-700 focus:bg-slate-100 data-[state=open]:bg-slate-100">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <MenuIcon>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1 13 4-4m0 0 4 4m-4-4v7M4 12h8m-6 7h2" />
                </svg>
              </MenuIcon>
              <span>{t('common.language')}</span>
            </span>
            <MenuChevron />
          </div>
        </DropdownMenuSubTriggerItem>
        <DropdownMenuSubContentPanel className="w-56 rounded-2xl p-2">
          <DropdownMenuItem className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700" onSelect={(e) => { e.preventDefault(); setLanguage('es') }}>
            {t('common.spanish')}{language === 'es' ? ' ✓' : ''}
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700" onSelect={(e) => { e.preventDefault(); setLanguage('en') }}>
            {t('common.english')}{language === 'en' ? ' ✓' : ''}
          </DropdownMenuItem>
        </DropdownMenuSubContentPanel>
      </DropdownMenuSub>
    )

  const helpMenu = isMobileViewport
    ? renderMobileSubmenu({
        keyName: 'ayuda',
        label: 'Ayuda y recursos educativos',
        icon: (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.305-.88 2.418-2.13 2.83-.97.32-1.87 1.1-1.87 2.17V16m0 4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
          </svg>
        ),
        children: (
          <>
            <Link href="/dashboard/ayuda" className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => setUserMenuOpen(false)}>
              Centro de ayuda
            </Link>
            <Link href="/dashboard/ayuda" className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white" onClick={() => setUserMenuOpen(false)}>
              Documentación y videos
            </Link>
            <button type="button" disabled={!hasCurrentTour} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-50" onClick={() => { startCurrentTour(); setUserMenuOpen(false) }}>
              {t('header.tour.view')}
            </button>
            <button type="button" disabled={!hasCurrentTour} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-50" onClick={() => { void resetCurrentTour(); startCurrentTour(); setUserMenuOpen(false) }}>
              {t('header.tour.restart')}
            </button>
          </>
        ),
      })
    : (
      <DropdownMenuSub>
        <DropdownMenuSubTriggerItem className="rounded-2xl px-3 py-3 text-[15px] font-medium text-slate-700 focus:bg-slate-100 data-[state=open]:bg-slate-100">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <MenuIcon>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.305-.88 2.418-2.13 2.83-.97.32-1.87 1.1-1.87 2.17V16m0 4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
                </svg>
              </MenuIcon>
              <span>Ayuda y recursos educativos</span>
            </span>
            <MenuChevron />
          </div>
        </DropdownMenuSubTriggerItem>
        <DropdownMenuSubContentPanel className="w-72 rounded-2xl p-2">
          <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700">
            <Link href="/dashboard/ayuda">Centro de ayuda</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700">
            <Link href="/dashboard/ayuda">Documentación y videos</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasCurrentTour}
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700"
            onSelect={(e) => {
              e.preventDefault()
              startCurrentTour()
            }}
          >
            {t('header.tour.view')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasCurrentTour}
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700"
            onSelect={(e) => {
              e.preventDefault()
              void resetCurrentTour()
              startCurrentTour()
            }}
          >
            {t('header.tour.restart')}
          </DropdownMenuItem>
        </DropdownMenuSubContentPanel>
      </DropdownMenuSub>
    )

  const isSidebarFooter = variant === 'sidebar-footer'
  const isMobileFooter = variant === 'mobile-footer' || variant === 'mobile-footer-profile'
  const isMobileFooterProfileOnly = variant === 'mobile-footer-profile'

  const actions = (
    <>
      {/* Actions */}
      <div className={isSidebarFooter ? 'flex shrink-0 flex-col items-center gap-2' : isMobileFooterProfileOnly ? 'flex shrink-0 items-center justify-center' : 'flex shrink-0 items-center gap-1.5 sm:gap-2'}>
          {!isMobileFooterProfileOnly ? <NotificationsBell placement={isSidebarFooter ? 'sidebar-footer' : isMobileFooter ? 'mobile-footer' : 'header'} /> : null}

          {navPrefs ? (
            <NavSettingsDialog
              items={navItems}
              value={navPrefs}
              order={navOrder}
              tooltipPrefs={sidebarTooltipPrefs}
              onSave={saveNav}
              open={navSettingsOpen}
              onOpenChange={setNavSettingsOpen}
              trigger={() => null}
            />
          ) : null}

          {/* User Menu */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className={isMobileFooter ? 'h-14 w-14 rounded-full p-0 hover:bg-slate-100/80' : 'h-9 w-9 rounded-full p-0 hover:bg-accent/60'}
                aria-label={t('header.profile')}
              >
                <div className={isMobileFooter ? 'relative h-11 w-11 overflow-hidden rounded-full bg-muted' : 'relative h-8 w-8 overflow-hidden rounded-full bg-muted'}>
                  {user.image ? (
                    <Image src={user.image} alt={user.name ?? 'Usuario'} fill className="object-cover" sizes={isMobileFooter ? '44px' : '32px'} unoptimized />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-muted text-[11px] font-semibold text-foreground">
                      {initials}
                    </div>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isSidebarFooter ? 'start' : 'end'}
              side={isSidebarFooter ? 'right' : isMobileFooter ? 'top' : 'bottom'}
              sideOffset={isSidebarFooter ? 16 : isMobileFooter ? 12 : 8}
              className="w-80 rounded-3xl border-slate-200 p-3 shadow-[0_22px_45px_-28px_rgba(15,23,42,0.35)]"
            >

              <DropdownMenuItem asChild className="rounded-2xl px-3 py-3 text-[15px] font-medium text-slate-700 focus:bg-slate-100">
                <Link href="/dashboard/perfil" className="flex w-full items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <MenuIcon>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m16 0v-2a4 4 0 00-3-3.87M7 7a4 4 0 118 0 4 4 0 01-8 0z" />
                      </svg>
                    </MenuIcon>
                    <span>Mi cuenta</span>
                  </span>
                  <MenuChevron />
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="rounded-2xl px-3 py-3 text-[15px] font-medium text-slate-700 focus:bg-slate-100">
                <Link href="/auth/change-password" className="flex w-full items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <MenuIcon>
                      <Lock className="h-5 w-5" />
                    </MenuIcon>
                    <span>Cambiar contraseña</span>
                  </span>
                  <MenuChevron />
                </Link>
              </DropdownMenuItem>

              {configMenu}

              {themeMenu}

              {languageMenu}

              {helpMenu}

              {navPrefs ? (
                <DropdownMenuItem
                  className="rounded-2xl px-3 py-3 text-[15px] font-medium text-slate-700 focus:bg-slate-100"
                  onSelect={() => {
                    setUserMenuOpen(false)
                    setNavSettingsOpen(true)
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <MenuIcon>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      </MenuIcon>
                      <span>Personalizar menú</span>
                    </span>
                  </div>
                </DropdownMenuItem>
              ) : null}

              {user.isImpersonating ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={returningToSuperAdmin}
                    onSelect={(e) => {
                      e.preventDefault()
                      void returnToSuperAdmin()
                    }}
                  >
                    {returningToSuperAdmin ? t('common.processing') : t('header.returnToSuperAdmin')}
                  </DropdownMenuItem>
                </>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  void signOut({ callbackUrl: "/auth/login" })
                }}
                className="text-red-600 focus:text-red-600"
              >
                <span className="flex items-center gap-3">
                  <LogOut className="h-5 w-5" />
                  <span>{t('header.signOut')}</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
    </>
  )

  if (variant === 'inline' || variant === 'sidebar-footer' || variant === 'mobile-footer' || variant === 'mobile-footer-profile') {
    return actions
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/88 px-2 py-1.5 text-foreground backdrop-blur-xl sm:px-3 lg:px-4">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-1.5">
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
        </div>

        {actions}
      </div>
    </header>
  )
}
