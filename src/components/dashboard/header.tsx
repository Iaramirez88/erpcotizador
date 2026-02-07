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
  }
}

export default function Header({ user }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [planName, setPlanName] = useState<string>("")
  const [navPrefs, setNavPrefs] = useState<Record<string, boolean> | null>(null)
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav)
  const { hasCurrentTour, startCurrentTour, resetCurrentTour } = useTour()

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

  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Cotizador', href: '/dashboard/cotizador' },
    { name: 'Litografía', href: '/dashboard/litografia' },
    { name: 'Escaneos', href: '/dashboard/escaneos' },
    { name: 'Clientes', href: '/dashboard/clientes' },
    { name: 'Productos', href: '/dashboard/materiales' },
    { name: 'Terminados', href: '/dashboard/terminados' },
    { name: 'Inventario', href: '/dashboard/inventario' },
    { name: 'Traslados', href: '/dashboard/inventario/traslados' },
    { name: 'Remisiones', href: '/dashboard/remisiones' },
    { name: 'Facturación', href: '/dashboard/pos' },
    { name: 'Proveedores', href: '/dashboard/proveedores' },
    { name: 'Compras', href: '/dashboard/compras' },
    { name: 'Órdenes de Trabajo', href: '/dashboard/ordenes' },
    { name: 'Reportes', href: '/dashboard/reportes' },
  ]

  async function saveNav(next: Record<string, boolean>) {
    setNavPrefs(next)
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nav: next }),
    }).catch(() => null)
  }

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Breadcrumb / Title */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleMobileNav}
            aria-label="Abrir menú"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>

          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Panel de Control</h2>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <NotificationsBell onUnreadCountChange={setUnreadCount} />

          {/* Más opciones */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" type="button" className="relative">
                Más
                {unreadCount > 0 ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Accesos</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/perfil">Mi perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/cotizaciones">Cotizaciones</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/notificaciones" className="flex items-center justify-between gap-2">
                  <span>Notificaciones</span>
                  {unreadCount > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Configuración</DropdownMenuLabel>
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
                      Personalizar menú
                    </DropdownMenuItem>
                  )}
                />
              ) : null}
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/permisos">Permisos</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/usuarios">Usuarios</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/empresa">Empresa</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/cotizaciones">Cotizaciones</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/desperdicios">Desperdicios</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/plan">Plan</Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Ayuda</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!hasCurrentTour}
                onSelect={(e) => {
                  e.preventDefault()
                  startCurrentTour()
                }}
              >
                Ver tutorial de esta pantalla
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasCurrentTour}
                onSelect={(e) => {
                  e.preventDefault()
                  void resetCurrentTour()
                  startCurrentTour()
                }}
              >
                Reiniciar tutorial de esta pantalla
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
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
