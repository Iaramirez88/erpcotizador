'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/components/providers/i18n-provider'
import { useDashboardAccess } from '@/components/dashboard/dashboard-access-context'
import { nominaHref, normalizeNominaPathname } from '@/lib/nomina-routes'
import { cn } from '@/lib/utils'

type NominaNavItem = {
  label: string
  href: string
  shortLabel?: string
}

function isItemActive(pathname: string, href: string) {
  const normalizedPathname = normalizeNominaPathname(pathname)

  if (href === nominaHref()) {
    return normalizedPathname === href
  }

  return normalizedPathname === href || normalizedPathname.startsWith(href + '/')
}

export function NominaSubnav() {
  const pathname = usePathname() ?? ''
  const { language } = useI18n()
  const { canAccessPayrollAdmin, hasPayrollPortal } = useDashboardAccess()

  const adminItems: NominaNavItem[] = language === 'en'
    ? [
        { label: 'Overview', href: nominaHref() },
        { label: 'Employees', href: nominaHref('empleados') },
        { label: 'Attendance', href: nominaHref('asistencia'), shortLabel: 'Attend.' },
        { label: 'Benefits', href: nominaHref('beneficios') },
        { label: 'Onboarding', href: nominaHref('onboarding') },
        { label: 'Service', href: nominaHref('servicio-colaborador') },
        { label: 'Ethics', href: nominaHref('canal-denuncias') },
        { label: 'Recruiting', href: nominaHref('seleccion') },
        { label: 'Surveys', href: nominaHref('encuestas') },
        { label: 'Performance', href: nominaHref('desempeno') },
        { label: 'Learning', href: nominaHref('capacitaciones') },
        { label: 'People', href: nominaHref('gestion-personas') },
        { label: 'Periods', href: nominaHref('periodos') },
        { label: 'Changes', href: nominaHref('novedades') },
        { label: 'Settlements', href: nominaHref('liquidaciones'), shortLabel: 'Settle' },
        { label: 'Reports', href: nominaHref('reportes') },
      ]
    : [
        { label: 'Resumen', href: nominaHref() },
        { label: 'Empleados', href: nominaHref('empleados') },
        { label: 'Asistencia', href: nominaHref('asistencia') },
        { label: 'Beneficios', href: nominaHref('beneficios') },
        { label: 'Onboarding', href: nominaHref('onboarding') },
        { label: 'Servicio', href: nominaHref('servicio-colaborador') },
        { label: 'Denuncias', href: nominaHref('canal-denuncias') },
        { label: 'Selección', href: nominaHref('seleccion') },
        { label: 'Encuestas', href: nominaHref('encuestas') },
        { label: 'Desempeño', href: nominaHref('desempeno') },
        { label: 'Capacitaciones', href: nominaHref('capacitaciones') },
        { label: 'Gestión de personas', href: nominaHref('gestion-personas'), shortLabel: 'Personas' },
        { label: 'Períodos', href: nominaHref('periodos') },
        { label: 'Novedades', href: nominaHref('novedades') },
        { label: 'Liquidaciones', href: nominaHref('liquidaciones'), shortLabel: 'Liquidar' },
        { label: 'Reportes', href: nominaHref('reportes') },
      ]

  const portalItem: NominaNavItem | null = hasPayrollPortal
    ? {
        label: language === 'en' ? 'My portal' : 'Mi portal',
        href: nominaHref('portal-empleado'),
        shortLabel: 'Portal',
      }
    : null

  const nominaNavItems: NominaNavItem[] = canAccessPayrollAdmin
    ? [adminItems[0], ...(portalItem ? [portalItem] : []), ...adminItems.slice(1)]
    : portalItem
      ? [portalItem]
      : []

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