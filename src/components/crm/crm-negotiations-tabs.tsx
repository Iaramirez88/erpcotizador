"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

const NEGOTIATION_TABS = [
  { href: '/dashboard/crm/negociaciones/pipeline', label: 'Pipeline' },
  { href: '/dashboard/crm/negociaciones/calendario', label: 'Calendario' },
  { href: '/dashboard/crm/negociaciones/actividades', label: 'Actividades' },
] as const

/** Bandeja operativa de leads captados (`/dashboard/crm/leads`). */
const LEADS_INBOX_HREF = '/dashboard/crm/leads'

export function CrmNegotiationsTabs({ className }: Props) {
  const pathname = usePathname() ?? ''
  const leadsInboxActive = pathname.startsWith(LEADS_INBOX_HREF)

  return (
    <div className={cn('sticky top-[5.75rem] z-20 flex flex-wrap gap-2 rounded-[26px] border border-[#2b2e401a] bg-white/96 p-1.5 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.18)] backdrop-blur supports-[backdrop-filter]:bg-white/88', className)}>
      {NEGOTIATION_TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active
              ? 'rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f2f4]'
              : 'rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f2f4]'}
          >
            {tab.label}
          </Link>
        )
      })}

      <Link
        href={LEADS_INBOX_HREF}
        title="Ver todos los leads captados, con filtros por formulario, campaña y estado."
        aria-current={leadsInboxActive ? 'page' : undefined}
        className={cn(
          'ml-auto inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f2f4]',
          leadsInboxActive
            ? 'border-slate-950 bg-slate-950 text-white'
            : 'border-sky-200 bg-sky-50/80 text-sky-800 hover:bg-sky-100',
        )}
      >
        <Inbox className="h-4 w-4" aria-hidden="true" />
        Bandeja de leads
      </Link>
    </div>
  )
}