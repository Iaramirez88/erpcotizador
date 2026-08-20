'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/dashboard/configuracion/servicios-web',
    label: 'Servicios',
    match: (pathname: string) => pathname === '/dashboard/configuracion/servicios-web',
  },
  {
    href: '/dashboard/configuracion/servicios-web/sitios',
    label: 'Sitios',
    match: (pathname: string) => pathname === '/dashboard/configuracion/servicios-web/sitios',
  },
  {
    href: '/dashboard/configuracion/servicios-web/builder',
    label: 'Builder visual',
    match: (pathname: string) => pathname === '/dashboard/configuracion/servicios-web/builder' || pathname.endsWith('/builder'),
  },
  {
    href: '/dashboard/configuracion/servicios-web/plantillas',
    label: 'Plantillas automáticas',
    match: (pathname: string) => pathname.startsWith('/dashboard/configuracion/servicios-web/plantillas'),
  },
]

export default function WebsiteServicesModuleTabs() {
  const pathname = usePathname()
  const safePathname = pathname ?? ''

  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = tab.match(safePathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active
              ? 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white'
              : 'rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}