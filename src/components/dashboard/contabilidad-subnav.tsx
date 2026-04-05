'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type ContabilidadNavItem = {
  label: string
  href: string
  shortLabel?: string
}

const contabilidadNavItems: ContabilidadNavItem[] = [
  { label: 'Resumen', href: '/dashboard/contabilidad' },
  { label: 'Comprobantes', href: '/dashboard/contabilidad/comprobantes', shortLabel: 'Comprob.' },
  { label: 'Libros', href: '/dashboard/contabilidad/libros' },
  { label: 'Conciliaciones', href: '/dashboard/contabilidad/conciliaciones', shortLabel: 'Conciliar' },
  { label: 'Impuestos', href: '/dashboard/contabilidad/impuestos' },
  { label: 'Cierres', href: '/dashboard/contabilidad/cierres' },
  { label: 'Plan de cuentas', href: '/dashboard/contabilidad/plan-de-cuentas', shortLabel: 'Cuentas' },
  { label: 'Centros', href: '/dashboard/contabilidad/centros-de-costo' },
  { label: 'Reglas', href: '/dashboard/contabilidad/reglas' },
]

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard/contabilidad') {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(href + '/')
}

export function ContabilidadSubnav() {
  const pathname = usePathname() ?? ''

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-[24px] border border-slate-200 bg-slate-50/90 p-1.5">
        {contabilidadNavItems.map((item) => {
          const active = isItemActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex min-h-11 items-center justify-center rounded-[18px] px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                active
                  ? 'bg-white text-slate-950 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.4)]'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}