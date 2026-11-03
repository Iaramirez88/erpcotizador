'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BookOpen, Calculator, CalendarClock, CalendarDays, Contact, FileBarChart, Gift, HandHelping, LayoutGrid, Megaphone, Network, ShieldAlert, TrendingUp, UserPlus, UserRound, UserSearch } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import { useDashboardAccess } from '@/components/dashboard/dashboard-access-context'
import { useNominaNavigation } from '@/components/dashboard/nomina-navigation-context'
import { nominaHref, normalizeNominaPathname } from '@/lib/nomina-routes'
import { cn } from '@/lib/utils'

type NominaNavItem = {
  labelKey: string
  href: string
  shortLabelKey?: string
  icon: React.ComponentType<{ className?: string }>
}

type NominaSubnavProps = {
  orientation?: 'horizontal' | 'vertical'
}

function isItemActive(pathname: string, href: string) {
  const normalizedPathname = normalizeNominaPathname(pathname)

  if (href === nominaHref()) {
    return normalizedPathname === href
  }

  return normalizedPathname === href || normalizedPathname.startsWith(href + '/')
}

export function NominaSubnav({ orientation = 'horizontal' }: NominaSubnavProps) {
  const pathname = usePathname() ?? ''
  const { t } = useI18n()
  const { canAccessPayrollAdmin, hasPayrollPortal } = useDashboardAccess()
  const navigation = useNominaNavigation()

  const adminItems: NominaNavItem[] = [
    { labelKey: 'nomina.subnav.resumen', href: nominaHref(), icon: LayoutGrid },
    { labelKey: 'nomina.subnav.empleados', href: nominaHref('empleados'), icon: Contact },
    { labelKey: 'nomina.subnav.asistencia', href: nominaHref('asistencia'), shortLabelKey: 'nomina.subnav.asistenciaShort', icon: CalendarClock },
    { labelKey: 'nomina.subnav.beneficios', href: nominaHref('beneficios'), icon: Gift },
    { labelKey: 'nomina.subnav.onboarding', href: nominaHref('onboarding'), icon: UserPlus },
    { labelKey: 'nomina.subnav.servicio', href: nominaHref('servicio-colaborador'), icon: HandHelping },
    { labelKey: 'nomina.subnav.denuncias', href: nominaHref('canal-denuncias'), icon: ShieldAlert },
    { labelKey: 'nomina.subnav.seleccion', href: nominaHref('seleccion'), icon: UserSearch },
    { labelKey: 'nomina.subnav.encuestas', href: nominaHref('encuestas'), icon: Bell },
    { labelKey: 'nomina.subnav.desempeno', href: nominaHref('desempeno'), icon: TrendingUp },
    { labelKey: 'nomina.subnav.capacitaciones', href: nominaHref('capacitaciones'), icon: BookOpen },
    { labelKey: 'nomina.subnav.gestionPersonas', href: nominaHref('gestion-personas'), shortLabelKey: 'nomina.subnav.gestionPersonasShort', icon: Network },
    { labelKey: 'nomina.subnav.periodos', href: nominaHref('periodos'), icon: CalendarDays },
    { labelKey: 'nomina.subnav.novedades', href: nominaHref('novedades'), icon: Megaphone },
    { labelKey: 'nomina.subnav.liquidaciones', href: nominaHref('liquidaciones'), shortLabelKey: 'nomina.subnav.liquidacionesShort', icon: Calculator },
    { labelKey: 'nomina.subnav.reportes', href: nominaHref('reportes'), icon: FileBarChart },
  ]

  const portalItem: NominaNavItem | null = hasPayrollPortal
    ? {
        labelKey: 'nomina.subnav.portal',
        href: nominaHref('portal-empleado'),
        shortLabelKey: 'nomina.subnav.portalShort',
        icon: UserRound,
      }
    : null

  const nominaNavItems: NominaNavItem[] = canAccessPayrollAdmin
    ? [adminItems[0], ...(portalItem ? [portalItem] : []), ...adminItems.slice(1)]
    : portalItem
      ? [portalItem]
      : []

  if (navigation && !navigation.menuVisible) return null

  if (orientation === 'vertical') {
    return (
      <aside className="hidden xl:block xl:w-[280px] xl:shrink-0">
        <div className="sticky top-24 rounded-[24px] border border-slate-200 bg-[linear-gradient(160deg,#f7fbff_0%,#ffffff_45%,#f6fffb_100%)] p-3 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.35)]">
          <nav className="space-y-0.5" aria-label={t('nomina.subnav.ariaLabel')}>
            {nominaNavItems.map((item) => {
              const active = isItemActive(pathname, item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex h-9 items-center gap-2.5 rounded-xl border px-2.5 text-sm font-medium transition-all',
                    active
                      ? 'border-sky-200 bg-sky-50 text-slate-900 shadow-[0_12px_26px_-24px_rgba(2,132,199,0.7)]'
                      : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', active ? 'border-sky-200 bg-white text-sky-700' : 'border-slate-200 bg-white text-slate-500 group-hover:text-slate-700')}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>
    )
  }

  return (
    <div className="overflow-x-auto xl:hidden">
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
              <span className="sm:hidden">{item.shortLabelKey ? t(item.shortLabelKey) : t(item.labelKey)}</span>
              <span className="hidden sm:inline">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}