'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

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

export default function WebsiteServicesModuleTabs({ className }: { className?: string }) {
  const pathname = usePathname()
  const safePathname = pathname ?? ''

  return (
    <div className={cn('sticky top-[4.9rem] z-20 overflow-x-auto rounded-[26px] border border-[#2b2e401a] bg-white/96 p-1.5 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.18)] backdrop-blur supports-[backdrop-filter]:bg-white/88', className)}>
      <div className="inline-flex min-w-full gap-1 rounded-2xl bg-slate-50/90 p-1">
      {tabs.map((tab) => {
        const active = tab.match(safePathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active
              ? 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f2f4]'
              : 'rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f2f4]'}
          >
            {tab.label}
          </Link>
        )
      })}
      </div>
    </div>
  )
}