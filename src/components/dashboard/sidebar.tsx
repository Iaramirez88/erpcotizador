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
import { NavSettingsDialog } from "@/components/dashboard/nav-settings-dialog"
import { useUiStore } from "@/lib/ui-store"

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
    name: "Cotizaciones",
    href: "/dashboard/cotizaciones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    name: "Plantilla Cotización",
    href: "/dashboard/cotizaciones/plantilla",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a4 4 0 00-4 4v10a2 2 0 002 2h4a2 2 0 002-2V10a4 4 0 00-4-4zm-4 6h8" />
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
    name: "Materiales",
    href: "/dashboard/materiales",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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

  async function saveNav(next: Record<string, boolean>) {
    setNavPrefs(next)
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nav: next }),
    }).catch(() => null)
  }

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
          "fixed inset-y-0 left-0 z-50 w-72 md:w-64 md:static",
          "transform transition-transform md:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-lg font-bold shadow-sm">
              SG
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-50">SGDigital</h1>
              <p className="text-xs text-slate-400">Cotizador Pro</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
              >
                <div className="flex items-center space-x-3">
                  {item.icon}
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-200 rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Info + Cambiar contraseña */}
        <div className="p-4 border-t border-slate-800">
          <div className="mb-3">
            <NavSettingsDialog
              items={navigation.map((n) => ({ name: n.name, href: n.href }))}
              value={navPrefs ?? {}}
              onSave={saveNav}
            />
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-200 font-medium">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/auth/change-password"
              onClick={() => setMobileNavOpen(false)}
              className="text-xs text-sky-300 hover:underline font-medium"
            >
              Cambiar contraseña
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
