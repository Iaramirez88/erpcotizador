'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MoreHorizontal, Pin, PinOff, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContabilidadNavPins } from '@/hooks/use-contabilidad-nav-pins'
import {
  isContabilidadNavItemActive,
  resolveContabilidadSubnav,
} from '@/lib/contabilidad-nav'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function itemClassName(active: boolean) {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[18px] px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f2f4]',
    active
      ? 'bg-white text-slate-950 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.4)]'
      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
  )
}

export function ContabilidadSubnav() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { pinnedHrefs, togglePinned, clearPinned, syncState } = useContabilidadNavPins()

  const { visibleItems, overflowItems } = useMemo(
    () => resolveContabilidadSubnav({ pathname, pinnedHrefs }),
    [pathname, pinnedHrefs],
  )

  return (
    <div className="sticky top-[4.9rem] z-20 rounded-[26px] border border-[#2b2e401a] bg-white/96 py-0.5 backdrop-blur supports-[backdrop-filter]:bg-white/88">
      <div className="flex items-center gap-2 rounded-[24px] bg-slate-50/90 p-1.5">
        <nav
          aria-label="Secciones de contabilidad"
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
        >
          {visibleItems.map((item) => {
            const active = isContabilidadNavItemActive(pathname, item.href)
            const pinned = pinnedHrefs.includes(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={itemClassName(active)}
                aria-current={active ? 'page' : undefined}
                title={item.description}
              >
                <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {pinned ? <Pin className="h-3 w-3 text-slate-400" aria-hidden /> : null}
              </Link>
            )
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(itemClassName(false), 'shrink-0 gap-2 px-3')}
              aria-label={
                overflowItems.length > 0
                  ? `Más secciones de contabilidad (${overflowItems.length})`
                  : 'Más secciones de contabilidad'
              }
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">Más</span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white">
                {overflowItems.length}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl">
            <DropdownMenuLabel>Más secciones</DropdownMenuLabel>
            <p className="px-2 pb-2 text-[11px] leading-4 text-slate-500">
              Ancla con el pin las secciones que más uses y quedarán fijas en la barra.
            </p>
            <p className="px-2 pb-2 text-[11px] leading-4 text-slate-400">
              {syncState === 'synced'
                ? 'Anclas guardadas en tu cuenta.'
                : syncState === 'local'
                  ? 'Anclas guardadas en este dispositivo.'
                  : 'Cargando anclas…'}
            </p>
            <DropdownMenuSeparator />
            {overflowItems.length === 0 ? (
              <div className="px-2 py-3 text-xs text-slate-500">Todas las secciones están visibles en la barra.</div>
            ) : (
              overflowItems.map((item) => {
                const active = isContabilidadNavItemActive(pathname, item.href)
                const pinned = pinnedHrefs.includes(item.href)

                return (
                  <DropdownMenuItem
                    key={item.href}
                    className="gap-2 rounded-xl px-1.5"
                    onSelect={() => router.push(item.href)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-sm font-medium', active ? 'text-slate-950' : 'text-slate-700')}>
                        {item.label}
                      </div>
                      <div className="truncate text-xs text-slate-500">{item.description}</div>
                    </div>
                    <button
                      type="button"
                      aria-pressed={pinned}
                      aria-label={pinned ? `Quitar ancla de ${item.label}` : `Anclar ${item.label} en la barra`}
                      title={pinned ? `Quitar ancla de ${item.label}` : `Anclar ${item.label} en la barra`}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        togglePinned(item.href)
                      }}
                      className={cn(
                        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18',
                        pinned
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900',
                      )}
                    >
                      {pinned ? (
                        <PinOff className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Pin className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </DropdownMenuItem>
                )
              })
            )}
            {pinnedHrefs.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 rounded-xl text-xs text-slate-600" onSelect={clearPinned}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Restablecer barra
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
