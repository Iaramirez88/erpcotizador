/**
 * Componente Sidebar
 * 
 * Barra lateral de navegación del dashboard
 */
"use client"

import Link from "next/link"
import { Lock, Building2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/lib/ui-store"
import { NavSettingsDialog, type NavSettingsItem } from "@/components/dashboard/nav-settings-dialog"
import Image from "next/image"
import { useI18n } from "@/components/providers/i18n-provider"

interface SidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string
  }
}

interface NavItem {
  name: string
  href: string
  icon: React.ReactElement
  badge?: string
}

function moduleForHref(href: string): string | null {
  switch (href) {
    case '/dashboard':
      return 'DASHBOARD'
    case '/dashboard/reportes':
      return 'REPORTES'
    case '/dashboard/contabilidad':
    case '/dashboard/contabilidad/plan-de-cuentas':
    case '/dashboard/contabilidad/centros-de-costo':
    case '/dashboard/contabilidad/reglas':
    case '/dashboard/contabilidad/asientos':
    case '/dashboard/contabilidad/tesoreria':
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
    case '/dashboard/bodegas':
    case '/dashboard/configuracion/usuarios':
    case '/dashboard/configuracion/permisos':
    case '/dashboard/configuracion/empresa':
    case '/dashboard/configuracion/plan':
    case '/dashboard/configuracion/desperdicios':
    case '/dashboard/configuracion/super-admin/modulos-por-plan':
    case '/dashboard/configuracion/super-admin/empresas':
    case '/dashboard/configuracion/super-admin/usuarios':
      return 'CONFIG'
    default:
      return null
  }
}

function buildModuleNavigation(t: (key: string) => string): NavItem[] {
  return [
  {
    name: t('nav.dashboard'),
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: t('nav.reports'),
    href: "/dashboard/reportes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: t('nav.accounting'),
    href: "/dashboard/contabilidad",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14h6m-6 4h6M7 4h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    ),
  },

  // Comercial
  {
    name: t('nav.quote'),
    href: "/dashboard/cotizador",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: t('nav.quotes'),
    href: "/dashboard/cotizaciones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-7 5h8a2 2 0 002-2V7a2 2 0 00-2-2h-1.5a2.5 2.5 0 00-5 0H8a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: t('nav.deliveries'),
    href: "/dashboard/remisiones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m3-10H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2zm-7-2h2a2 2 0 012 2v0H9v0a2 2 0 012-2z"
        />
      </svg>
    ),
  },
  {
    name: t('nav.billing'),
    href: "/dashboard/pos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M6 11h12M6 15h6M6 19h12" />
      </svg>
    ),
  },
  {
    name: t('nav.clients'),
    href: "/dashboard/clientes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },

  // Operaciones
  {
    name: t('nav.orders'),
    href: "/dashboard/ordenes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    name: t('nav.printshop'),
    href: "/dashboard/litografia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M7 17h10M8 21h8M6 3h12v14H6V3z" />
      </svg>
    ),
  },
  {
    name: t('nav.scans'),
    href: "/dashboard/escaneos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2M7 7h10v10H7V7zm2 2h6m-6 3h6m-6 3h4" />
      </svg>
    ),
  },
  {
    name: t('nav.finishes'),
    href: "/dashboard/terminados",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zm0 0v20M3 6.5l9 4.5 9-4.5" />
      </svg>
    ),
  },
  {
    name: t('nav.products'),
    href: "/dashboard/materiales",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },

  // Logística
  {
    name: t('nav.inventory'),
    href: "/dashboard/inventario",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 20h10a2 2 0 002-2V8a2 2 0 00-2-2h-1.5a2.5 2.5 0 00-5 0H9a2 2 0 00-2 2v10a2 2 0 002 2zm3-14a1 1 0 112 0h-2z"
        />
      </svg>
    ),
  },
  {
    name: t('nav.transfers'),
    href: "/dashboard/inventario/traslados",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l4 5-4 5" />
      </svg>
    ),
  },
  {
    name: t('nav.purchases'),
    href: "/dashboard/compras",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 7.5M17 13l1.5 7.5M9 21h6" />
      </svg>
    ),
  },
  {
    name: t('nav.suppliers'),
    href: "/dashboard/proveedores",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V7a1 1 0 011-1h14a1 1 0 011 1v14M8 10h8M8 14h8M8 18h8" />
      </svg>
    ),
  },
  {
    name: t('nav.waste'),
    href: "/dashboard/configuracion/desperdicios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 14h8l1-14" />
      </svg>
    ),
  },

  // Gestión
  {
    name: t('nav.branches'),
    href: "/dashboard/bodegas",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    name: t('nav.users'),
    href: "/dashboard/configuracion/usuarios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: t('nav.permissions'),
    href: "/dashboard/configuracion/permisos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V7a4 4 0 118 0v4m-8 0h8m-8 0H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2" />
      </svg>
    ),
  },
  {
    name: t('nav.company'),
    href: "/dashboard/configuracion/empresa",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V7a2 2 0 012-2h3V3h6v2h3a2 2 0 012 2v14M8 11h.01M8 15h.01M12 11h.01M12 15h.01M16 11h.01M16 15h.01" />
      </svg>
    ),
  },
  {
    name: t('nav.plan'),
    href: "/dashboard/configuracion/plan",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h4m-6 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Super Admin",
    href: "/dashboard/configuracion/super-admin/modulos-por-plan",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 0c-3.314 0-6 1.79-6 4v2h12v-2c0-2.21-2.686-4-6-4zm7-3h2v2h-2V8zM3 8h2v2H3V8z"
        />
      </svg>
    ),
  },
  {
    name: "Super Admin · Empresas",
    href: "/dashboard/configuracion/super-admin/empresas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V7a2 2 0 012-2h3V3h6v2h3a2 2 0 012 2v14M8 11h.01M8 15h.01M12 11h.01M12 15h.01M16 11h.01M16 15h.01" />
      </svg>
    ),
  },
  {
    name: "Super Admin · Usuarios",
    href: "/dashboard/configuracion/super-admin/usuarios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  ]
}

function buildPreferenceNavigation(t: (key: string) => string): NavItem[] {
  return [
  {
    name: t('header.profile'),
    href: "/dashboard/perfil",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m16 0v-2a4 4 0 00-3-3.87M7 7a4 4 0 118 0 4 4 0 01-8 0z" />
      </svg>
    ),
  },
  {
    name: t('header.notifications'),
    href: "/dashboard/notificaciones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 01-6 0" />
      </svg>
    ),
  },
  {
    name: t('header.sections.help'),
    href: "/dashboard/ayuda",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.305-.88 2.418-2.13 2.83-.97.32-1.87 1.1-1.87 2.17V16m0 4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
      </svg>
    ),
  },
  ]
}

type UiPrefsResponse = {
  success: boolean
  data?: {
    nav?: Record<string, boolean>
  }
}

type EmpresaBranding = {
  nombre: string
  logo: string | null
  nit: string
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname() ?? ''

  const { t } = useI18n()

  const moduleNavigation = useMemo(() => buildModuleNavigation(t), [t])
  const preferenceNavigation = useMemo(() => buildPreferenceNavigation(t), [t])

  const [canManageBilling, setCanManageBilling] = useState(() => user.role === 'ADMIN')

  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)
  const setRouteLoading = useUiStore((s) => s.setRouteLoading)

  const [navPrefs, setNavPrefs] = useState<Record<string, boolean> | null>(null)
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaBranding | null>(null)
  const [planTier, setPlanTier] = useState<string | null>(null)
  const [isPersonal, setIsPersonal] = useState<boolean>(false)
  const [openSectionTitle, setOpenSectionTitle] = useState<string | null>(null)

  useEffect(() => {
    if (user.role === 'ADMIN') setCanManageBilling(true)
  }, [user.role])

  function isNavActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (pathname === href) return true
    return pathname.startsWith(href + '/')
  }

  function beginRouteLoadingIfNeeded(href: string) {
    if (!href) return
    if (href === pathname) return
    if (pathname.startsWith(href + '/')) return
    setRouteLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ui-preferences')
        const json: UiPrefsResponse = await res.json().catch(() => ({ success: false }))
        if (!cancelled && json?.success) {
          setNavPrefs(json.data?.nav ?? {})
        }
      } catch {}
      try {
        const res = await fetch('/api/modules/enabled', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; enabled?: string[]; planTier?: string }
          | null
        if (!cancelled && json?.ok && Array.isArray(json.enabled)) {
          setEnabledModules(new Set(json.enabled))
          setPlanTier(json.planTier ?? null)
        }
      } catch {}
      try {
        const res = await fetch('/api/configuracion/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: { nombre?: string; logo?: string | null; nit?: string } }
          | null
        if (!cancelled && json?.ok && json.data?.nombre) {
          setEmpresa({
            nombre: json.data.nombre,
            logo: json.data.logo ?? null,
            nit: json.data.nit ?? '',
          })
          setIsPersonal((json.data.nit ?? '').startsWith('PERS-'))
        }
      } catch {}
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const upgradePlanLabel = useMemo(() => {
    if (planTier === 'BASIC') return 'Intermedio'
    if (planTier === 'INTERMEDIO') return 'Full'
    return 'superior'
  }, [planTier])

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

  useEffect(() => {
    function onBrandingUpdated(e: Event) {
      const ce = e as CustomEvent<Partial<EmpresaBranding>>
      const next = ce.detail
      if (!next) return
      setEmpresa((prev) => ({
        nombre: next.nombre ?? prev?.nombre ?? 'SGDigital',
        logo: next.logo !== undefined ? (next.logo ?? null) : (prev?.logo ?? null),
        nit: next.nit ?? prev?.nit ?? '',
      }))
    }
    window.addEventListener('empresa:branding-updated', onBrandingUpdated)
    return () => window.removeEventListener('empresa:branding-updated', onBrandingUpdated)
  }, [])

  const empresaInitials = useMemo(() => {
    const name = (empresa?.nombre ?? 'SGDigital').trim()
    const parts = name.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? 'S'
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (a + b).toUpperCase()
  }, [empresa?.nombre])

  // Para persona individual, mostrar todos los módulos (candado si no está habilitado por plan)
  const visibleNavigation = useMemo(() => {
    const base = !navPrefs ? moduleNavigation : moduleNavigation.filter((it) => navPrefs[it.href] !== false)
    const withAdminGate = base.filter((it) => {
      const isSuperAdminRoute =
        it.href === '/dashboard/configuracion/super-admin/modulos-por-plan' ||
        it.href === '/dashboard/configuracion/super-admin/empresas' ||
        it.href === '/dashboard/configuracion/super-admin/usuarios'
      if (!isSuperAdminRoute) return true
      return user?.role === 'ADMIN'
    })
    const withBillingGate = withAdminGate.filter((it) => {
      if (it.href !== '/dashboard/configuracion/plan') return true
      return canManageBilling
    })
    return withBillingGate
  }, [navPrefs, enabledModules, user?.role, canManageBilling])

  const visibleHrefs = useMemo(() => {
    return new Set(visibleNavigation.map((it) => it.href))
  }, [visibleNavigation])

  // Determinar módulos bloqueados para mostrar candado
  const blockedModules = useMemo(() => {
    if (!enabledModules) return new Set<string>()
    const blocked = new Set<string>()
    for (const it of moduleNavigation) {
      const moduleKey = moduleForHref(it.href)
      if (!moduleKey) continue
      if (!enabledModules.has(moduleKey)) blocked.add(it.href)
    }
    return blocked
  }, [enabledModules])

  const navSettingsItems: NavSettingsItem[] = useMemo(() => {
    const base = moduleNavigation
      .filter((it) => (it.href === '/dashboard/configuracion/plan' ? canManageBilling : true))
      .filter((it) => {
        const isSuperAdminRoute =
          it.href === '/dashboard/configuracion/super-admin/modulos-por-plan' ||
          it.href === '/dashboard/configuracion/super-admin/empresas' ||
          it.href === '/dashboard/configuracion/super-admin/usuarios'
        if (!isSuperAdminRoute) return true
        return user?.role === 'ADMIN'
      })
      .map((it) => ({ name: it.name, href: it.href }))
    return base
  }, [canManageBilling, user?.role])

  async function saveNav(next: Record<string, boolean>) {
    setNavPrefs(next)
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nav: next }),
    }).catch(() => null)
  }

  const sections = useMemo(() => {
    const get = (href: string) => visibleNavigation.find((it) => it.href === href) ?? null

    return [
      {
        title: 'Centro de Control',
        items: [get('/dashboard'), get('/dashboard/reportes'), get('/dashboard/contabilidad')].filter(Boolean) as NavItem[],
      },
      {
        title: 'Comercial',
        items: [
          get('/dashboard/cotizador'),
          get('/dashboard/cotizaciones'),
          get('/dashboard/remisiones'),
          get('/dashboard/pos'),
          get('/dashboard/clientes'),
        ].filter(Boolean) as NavItem[],
      },
      {
        title: 'Operaciones',
        items: [
          get('/dashboard/ordenes'),
          get('/dashboard/litografia'),
          get('/dashboard/escaneos'),
          get('/dashboard/terminados'),
          get('/dashboard/materiales'),
        ].filter(Boolean) as NavItem[],
      },
      {
        title: 'Logística',
        items: [
          get('/dashboard/inventario'),
          get('/dashboard/inventario/traslados'),
          get('/dashboard/compras'),
          get('/dashboard/proveedores'),
          get('/dashboard/configuracion/desperdicios'),
        ].filter(Boolean) as NavItem[],
      },
      {
        title: 'Gestión',
        items: [
          get('/dashboard/bodegas'),
          get('/dashboard/configuracion/usuarios'),
          get('/dashboard/configuracion/permisos'),
          get('/dashboard/configuracion/empresa'),
          get('/dashboard/configuracion/plan'),
        ].filter(Boolean) as NavItem[],
      },
      {
        title: 'Super Admin',
        items: [
          get('/dashboard/configuracion/super-admin/empresas'),
          get('/dashboard/configuracion/super-admin/usuarios'),
          get('/dashboard/configuracion/super-admin/modulos-por-plan'),
        ].filter(Boolean) as NavItem[],
      },
    ]
  }, [visibleNavigation])

  const activeSectionTitle = useMemo(() => {
    // Elegimos el match más específico (href más largo) para evitar que “/dashboard” capture todo.
    let best: { sectionTitle: string; hrefLen: number } | null = null

    for (const section of sections) {
      for (const it of section.items) {
        if (!isNavActive(it.href)) continue
        const hrefLen = it.href.length
        if (!best || hrefLen > best.hrefLen) {
          best = { sectionTitle: section.title, hrefLen }
        }
      }
    }

    if (best) return best.sectionTitle

    // Si no está en un módulo, pero sí en una preferencia, mantenemos abierto Preferencias.
    if (preferenceNavigation.some((it) => isNavActive(it.href))) return 'Preferencias'

    return null
  }, [sections, pathname])

  useEffect(() => {
    // Al navegar a una ruta dentro de otra sección, colapsa el anterior y abre el nuevo.
    if (activeSectionTitle) setOpenSectionTitle(activeSectionTitle)
  }, [activeSectionTitle])

  const effectiveOpenSection = openSectionTitle ?? activeSectionTitle

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity",
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        className={cn(
          "bg-slate-950 text-slate-100 border-r border-slate-800 flex flex-col",
          "fixed inset-y-0 left-0 z-50 md:static",
          sidebarCollapsed ? "w-20" : "w-72 md:w-64",
          "transform transition-transform md:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "space-x-3")}>
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-lg font-bold shadow-sm overflow-hidden">
              {empresa?.logo ? (
                <Image src={empresa.logo} alt={empresa.nombre} width={40} height={40} className="h-10 w-10 object-contain" />
              ) : (
                <span>{empresaInitials}</span>
              )}
            </div>
            {!sidebarCollapsed ? (
              <div>
                <h1 className="text-xl font-bold text-slate-50">{empresa?.nombre ?? 'SGDigital'}</h1>
                <p className="text-xs text-slate-400">Cotizador Pro</p>
              </div>
            ) : null}

            <button
              type="button"
              className={cn(
                "hidden md:inline-flex ml-auto h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-200 hover:bg-slate-800/40",
                sidebarCollapsed ? "ml-0" : ""
              )}
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
              aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 p-3 space-y-1 overflow-y-auto", sidebarCollapsed ? "px-2" : "px-3")}>
          {sections.map((section) => {
            const visibleItems = section.items.filter((it) => visibleHrefs.has(it.href))
            if (!visibleItems.length) return null

            // Sidebar colapsada: se mantiene lista directa (sin dropdown) para no romper UX.
            if (sidebarCollapsed) {
              return (
                <div key={section.title} className={cn("space-y-1", "")}> 
                  {visibleItems.map((item) => {
                    const isActive = isNavActive(item.href)
                    const isBlocked = isPersonal && blockedModules.has(item.href)
                    return (
                      <div key={item.name} className="relative group">
                        <Link
                          href={item.href}
                          onClick={e => {
                            if (isBlocked) e.preventDefault()
                            else {
                              beginRouteLoadingIfNeeded(item.href)
                              setMobileNavOpen(false)
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                            isActive ? "bg-slate-800/60 text-white" : "text-slate-200 hover:bg-slate-800/40",
                            isBlocked ? "opacity-60 cursor-not-allowed" : ""
                          )}
                          title={item.name}
                        >
                          <div className={cn("flex items-center", "justify-center w-full")}> 
                            {item.icon}
                            {isBlocked && (
                              <Lock className="ml-2 w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </Link>
                        {isBlocked && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:block">
                            <span className="bg-slate-900 text-slate-100 text-xs rounded px-2 py-1 shadow-lg whitespace-nowrap">
                              Actualiza a plan {upgradePlanLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }

            const isOpen = effectiveOpenSection === section.title
            const isActiveSection = activeSectionTitle === section.title

            return (
              <div
                key={section.title}
                className={cn("space-y-1", "pt-2")}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenSectionTitle((cur) => {
                      if (cur === section.title) return isActiveSection ? section.title : null
                      return section.title
                    })
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-slate-200 hover:bg-slate-800/40"
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{section.title}</span>
                  <svg
                    className={cn("h-4 w-4 transition-transform text-slate-400", isOpen ? "rotate-180" : "")}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className={cn(
                    "pl-2 overflow-hidden transition-all duration-200 ease-out",
                    isOpen ? "max-h-[900px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
                  )}
                >
                  <div className="space-y-1 pt-1">
                    {visibleItems.map((item) => {
                      const isActive = isNavActive(item.href)
                      const isBlocked = isPersonal && blockedModules.has(item.href)
                      return (
                        <div key={item.name} className="relative group">
                          <Link
                            href={item.href}
                            onClick={e => {
                              if (isBlocked) e.preventDefault()
                              else {
                                beginRouteLoadingIfNeeded(item.href)
                                setMobileNavOpen(false)
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                              isActive ? "bg-slate-800/60 text-white" : "text-slate-200 hover:bg-slate-800/40",
                              isBlocked ? "opacity-60 cursor-not-allowed" : ""
                            )}
                          >
                            <div className="flex items-center space-x-3">
                              {item.icon}
                              <span className="text-sm font-medium">{item.name}</span>
                              {isBlocked && (
                                <Lock className="ml-2 w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            {item.badge ? (
                              <span className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-200 rounded">{item.badge}</span>
                            ) : null}
                          </Link>
                          {isBlocked && (
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:block">
                              <span className="bg-slate-900 text-slate-100 text-xs rounded px-2 py-1 shadow-lg whitespace-nowrap">
                                Actualiza a plan {upgradePlanLabel}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Preferencias */}
          <div
            className={cn("space-y-1", sidebarCollapsed ? "" : "pt-3")}
          >
            {sidebarCollapsed ? (
              <>
                {preferenceNavigation.map((item) => {
                  const isActive = isNavActive(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                        isActive ? "bg-slate-800/60 text-white" : "text-slate-200 hover:bg-slate-800/40"
                      )}
                      title={item.name}
                    >
                      <div className={cn("flex items-center", "justify-center w-full")}>
                        {item.icon}
                      </div>
                    </Link>
                  )
                })}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const isActiveSection = activeSectionTitle === "Preferencias"
                    setOpenSectionTitle((cur) => {
                      if (cur === "Preferencias") return isActiveSection ? "Preferencias" : null
                      return "Preferencias"
                    })
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-slate-200 hover:bg-slate-800/40"
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('sidebar.preferences')}</span>
                  <svg
                    className={cn(
                      "h-4 w-4 transition-transform text-slate-400",
                      effectiveOpenSection === "Preferencias" ? "rotate-180" : ""
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className={cn(
                    "pl-2 overflow-hidden transition-all duration-200 ease-out",
                    effectiveOpenSection === "Preferencias"
                      ? "max-h-[900px] opacity-100 translate-y-0"
                      : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
                  )}
                >
                  <div className="space-y-1 pt-1">
                    {preferenceNavigation.map((item) => {
                      const isActive = isNavActive(item.href)
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => {
                            setMobileNavOpen(false)
                            setOpenSectionTitle(activeSectionTitle ?? null)
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                            isActive ? "bg-slate-800/60 text-white" : "text-slate-200 hover:bg-slate-800/40"
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            {item.icon}
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                        </Link>
                      )
                    })}
                      {navPrefs ? (
                        <NavSettingsDialog
                          items={navSettingsItems}
                          value={navPrefs}
                          onSave={saveNav}
                          trigger={(open) => (
                            <button
                              type="button"
                              onClick={() => open()}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-slate-200 hover:bg-slate-800/40"
                              )}
                            >
                              <div className="flex items-center space-x-3">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                                  />
                                </svg>
                                <span className="font-medium">{t('header.customizeMenu')}</span>
                              </div>
                            </button>
                          )}
                        />
                      ) : null}
                  </div>
                </div>
              </>
            )}
          </div>

        </nav>

        {/* User Info + Cambiar contraseña */}
        <div className={cn("p-4 border-t border-slate-800", sidebarCollapsed ? "px-2" : "px-4")}>
          <div className={cn("flex items-center space-x-3", sidebarCollapsed ? "justify-center" : "")}>
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-200 font-medium">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed ? (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            ) : null}
          </div>

          {!sidebarCollapsed ? (
            <div className="mt-4">
              <Link
                href="/auth/change-password"
                onClick={() => setMobileNavOpen(false)}
                className="text-xs text-sky-300 hover:underline font-medium"
              >
                Cambiar contraseña
              </Link>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
