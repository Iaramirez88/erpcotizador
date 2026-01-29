/**
 * Componente Sidebar
 * 
 * Barra lateral de navegación del dashboard
 */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/lib/ui-store"
import { Building2 } from "lucide-react"

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

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    name: "Cotizador",
    href: "/dashboard/cotizador",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    name: "Litografía",
    href: "/dashboard/litografia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M7 17h10M8 21h8M6 3h12v14H6V3z" />
      </svg>
    )
  },
  {
    name: "Escaneos",
    href: "/dashboard/escaneos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2M7 7h10v10H7V7zm2 2h6m-6 3h6m-6 3h4" />
      </svg>
    )
  },
  {
    name: "Clientes",
    href: "/dashboard/clientes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    name: "Productos",
    href: "/dashboard/materiales",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  {
    name: "Terminados",
    href: "/dashboard/terminados",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zm0 0v20M3 6.5l9 4.5 9-4.5" />
      </svg>
    )
  },
  {
    name: "Inventario",
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
    name: "Traslados",
    href: "/dashboard/inventario/traslados",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7l4 5-4 5"
        />
      </svg>
    ),
  },
  {
    name: "Remisiones",
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
    name: "Sedes",
    href: "/dashboard/bodegas",
    icon: <Building2 />,
  },
  {
    name: "Facturación",
    href: "/dashboard/pos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7h18M6 11h12M6 15h6M6 19h12"
        />
      </svg>
    ),
  },
  {
    name: "Proveedores",
    href: "/dashboard/proveedores",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V7a1 1 0 011-1h14a1 1 0 011 1v14M8 10h8M8 14h8M8 18h8" />
      </svg>
    )
  },
  {
    name: "Compras",
    href: "/dashboard/compras",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 7.5M17 13l1.5 7.5M9 21h6" />
      </svg>
    )
  },
  {
    name: "Órdenes de Trabajo",
    href: "/dashboard/ordenes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    )
  },
  {
    name: "Reportes",
    href: "/dashboard/reportes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
]

type UiPrefsResponse = {
  success: boolean
  data?: {
    nav?: Record<string, boolean>
  }
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)

  const [navPrefs, setNavPrefs] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ui-preferences')
        const json: UiPrefsResponse = await res.json().catch(() => ({ success: false }))
        if (!cancelled && json?.success) {
          setNavPrefs(json.data?.nav ?? {})
        }
      } catch {
        // ignorar
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleNavigation = useMemo(() => {
    if (!navPrefs) return navigation
    return navigation.filter((it) => navPrefs[it.href] !== false)
  }, [navPrefs])

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
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-lg font-bold shadow-sm">
              SG
            </div>
            {!sidebarCollapsed ? (
              <div>
                <h1 className="text-xl font-bold text-slate-50">SGDigital</h1>
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
          {visibleNavigation.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-slate-800/60 text-white"
                    : "text-slate-200 hover:bg-slate-800/40"
                )}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <div className={cn("flex items-center", sidebarCollapsed ? "justify-center w-full" : "space-x-3")}>
                  {item.icon}
                  {!sidebarCollapsed ? <span className="font-medium">{item.name}</span> : null}
                </div>
                {!sidebarCollapsed && item.badge ? (
                  <span className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-200 rounded">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
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
