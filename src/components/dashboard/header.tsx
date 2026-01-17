/**
 * Componente Header
 * 
 * Barra superior del dashboard con búsqueda y acciones
 */

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useUiStore } from "@/lib/ui-store"
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
  }
}

export default function Header({ user }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [planName, setPlanName] = useState<string>("")
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/notificaciones?unread=true&limit=1')
        const json = (await res.json().catch(() => null)) as { unreadCount?: number } | null
        if (!cancelled && typeof json?.unreadCount === 'number') {
          setUnreadCount(json.unreadCount)
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch('/api/plan')
        const json = (await res.json().catch(() => null)) as { current?: { nombre?: string } } | null
        if (!cancelled && typeof json?.current?.nombre === 'string') {
          setPlanName(json.current.nombre)
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
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/permisos">Permisos</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion/plan">Plan</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
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
