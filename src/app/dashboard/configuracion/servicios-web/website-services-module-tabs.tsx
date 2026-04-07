'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/dashboard/configuracion/servicios-web', label: 'Servicios' },
  { href: '/dashboard/configuracion/servicios-web/plantillas', label: 'Plantillas automáticas' },
]

export default function WebsiteServicesModuleTabs() {
  const pathname = usePathname()

  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = pathname === tab.href
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