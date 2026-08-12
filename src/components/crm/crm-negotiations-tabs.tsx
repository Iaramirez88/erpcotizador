"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

const NEGOTIATION_TABS = [
  { href: '/dashboard/crm/negociaciones/pipeline', label: 'Pipeline' },
  { href: '/dashboard/crm/negociaciones/oportunidades', label: 'Oportunidades' },
  { href: '/dashboard/crm/negociaciones/calendario', label: 'Calendario' },
  { href: '/dashboard/crm/negociaciones/actividades', label: 'Actividades' },
] as const

export function CrmNegotiationsTabs({ className }: Props) {
  const pathname = usePathname() ?? ''

  return (
    <div className={cn('flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white/90 p-2 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.28)]', className)}>
      {NEGOTIATION_TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active
              ? 'rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm'
              : 'rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}