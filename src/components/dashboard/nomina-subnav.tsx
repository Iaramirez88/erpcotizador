'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/components/providers/i18n-provider'
import { cn } from '@/lib/utils'

type NominaNavItem = {
  label: string
  href: string
  shortLabel?: string
}

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard/contabilidad/nomina') {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(href + '/')
}

export function NominaSubnav() {
  const pathname = usePathname() ?? ''
  const { language } = useI18n()
  const nominaNavItems: NominaNavItem[] = language === 'en'
    ? [
        { label: 'Overview', href: '/dashboard/contabilidad/nomina' },
        { label: 'Employees', href: '/dashboard/contabilidad/nomina/empleados' },
        { label: 'Attendance', href: '/dashboard/contabilidad/nomina/asistencia', shortLabel: 'Attend.' },
        { label: 'Benefits', href: '/dashboard/contabilidad/nomina/beneficios' },
        { label: 'Onboarding', href: '/dashboard/contabilidad/nomina/onboarding' },
        { label: 'Service', href: '/dashboard/contabilidad/nomina/servicio-colaborador' },
        { label: 'Ethics', href: '/dashboard/contabilidad/nomina/canal-denuncias' },
        { label: 'Recruiting', href: '/dashboard/contabilidad/nomina/seleccion' },
        { label: 'Surveys', href: '/dashboard/contabilidad/nomina/encuestas' },
        { label: 'Performance', href: '/dashboard/contabilidad/nomina/desempeno' },
        { label: 'Learning', href: '/dashboard/contabilidad/nomina/capacitaciones' },
        { label: 'People', href: '/dashboard/contabilidad/nomina/gestion-personas' },
        { label: 'Periods', href: '/dashboard/contabilidad/nomina/periodos' },
        { label: 'Changes', href: '/dashboard/contabilidad/nomina/novedades' },
        { label: 'Settlements', href: '/dashboard/contabilidad/nomina/liquidaciones', shortLabel: 'Settle' },
        { label: 'Reports', href: '/dashboard/contabilidad/nomina/reportes' },
      ]
    : [
        { label: 'Resumen', href: '/dashboard/contabilidad/nomina' },
        { label: 'Empleados', href: '/dashboard/contabilidad/nomina/empleados' },
        { label: 'Asistencia', href: '/dashboard/contabilidad/nomina/asistencia' },
        { label: 'Beneficios', href: '/dashboard/contabilidad/nomina/beneficios' },
        { label: 'Onboarding', href: '/dashboard/contabilidad/nomina/onboarding' },
        { label: 'Servicio', href: '/dashboard/contabilidad/nomina/servicio-colaborador' },
        { label: 'Denuncias', href: '/dashboard/contabilidad/nomina/canal-denuncias' },
        { label: 'Selección', href: '/dashboard/contabilidad/nomina/seleccion' },
        { label: 'Encuestas', href: '/dashboard/contabilidad/nomina/encuestas' },
        { label: 'Desempeño', href: '/dashboard/contabilidad/nomina/desempeno' },
        { label: 'Capacitaciones', href: '/dashboard/contabilidad/nomina/capacitaciones' },
        { label: 'Gestión de personas', href: '/dashboard/contabilidad/nomina/gestion-personas', shortLabel: 'Personas' },
        { label: 'Períodos', href: '/dashboard/contabilidad/nomina/periodos' },
        { label: 'Novedades', href: '/dashboard/contabilidad/nomina/novedades' },
        { label: 'Liquidaciones', href: '/dashboard/contabilidad/nomina/liquidaciones', shortLabel: 'Liquidar' },
        { label: 'Reportes', href: '/dashboard/contabilidad/nomina/reportes' },
      ]

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-[24px] border border-slate-200 bg-slate-50/90 p-1.5">
        {nominaNavItems.map((item) => {
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