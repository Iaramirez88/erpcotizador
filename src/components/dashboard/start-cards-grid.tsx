'use client'

import Link from 'next/link'
import type { ModuleKey } from '@prisma/client'
import { isOnboardingScopedDashboardHref } from '@/lib/dashboard-navigation'
import { useI18n } from '@/components/providers/i18n-provider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  ClipboardMinus,
  FolderKanban,
  IdCard,
  Lock,
  Package2,
  PackageCheck,
  ReceiptText,
  ScanSearch,
  ShieldAlert,
  Truck,
  Users2,
  Workflow,
} from 'lucide-react'

type IconName =
  | 'calculator'
  | 'quotes'
  | 'clients'
  | 'crm'
  | 'network'
  | 'repository'
  | 'tasks'
  | 'orders'
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  | 'ocr'
  | 'pos'
  | 'accounting'
  | 'hr'
  | 'reports'
  | 'deliveries'

type StartCardDefinition = {
  titleKey: string
  descriptionKey: string
  href: string
  ctaKey: string
  moduleKey: ModuleKey
  icon: IconName
  tone: string
  surface: string
}

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  calculator: Calculator,
  quotes: ClipboardMinus,
  clients: IdCard,
  crm: Users2,
  repository: FolderKanban,
  tasks: Workflow,
  orders: PackageCheck,
  inventory: Boxes,
  purchases: ClipboardList,
  suppliers: Truck,
  ocr: ScanSearch,
  pos: ReceiptText,
  accounting: Package2,
  hr: BriefcaseBusiness,
  reports: BarChart3,
  deliveries: ShieldAlert,
  network: Users2,
}

const START_CARDS: StartCardDefinition[] = [
  {
    titleKey: 'startCards.items.rop.title',
    descriptionKey: 'startCards.items.rop.description',
    href: '/dashboard/rop',
    ctaKey: 'startCards.items.rop.cta',
    moduleKey: 'DASHBOARD',
    icon: 'network',
    tone: 'text-teal-950',
    surface: 'border-teal-200 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.24),transparent_34%),linear-gradient(180deg,#f4fffd,#e8fffb)]',
  },
  {
    titleKey: 'startCards.items.cotizador.title',
    descriptionKey: 'startCards.items.cotizador.description',
    href: '/dashboard/cotizador',
    ctaKey: 'startCards.items.cotizador.cta',
    moduleKey: 'COTIZADOR',
    icon: 'calculator',
    tone: 'text-amber-950',
    surface: 'border-amber-200 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.35),transparent_34%),linear-gradient(180deg,#fffdf7,#fff7e8)]',
  },
  {
    titleKey: 'startCards.items.restaurant.title',
    descriptionKey: 'startCards.items.restaurant.description',
    href: '/dashboard/restaurante',
    ctaKey: 'startCards.items.restaurant.cta',
    moduleKey: 'POS',
    icon: 'pos',
    tone: 'text-red-950',
    surface: 'border-red-200 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.24),transparent_34%),linear-gradient(180deg,#fff8f8,#fff1f1)]',
  },
  {
    titleKey: 'startCards.items.workwear.title',
    descriptionKey: 'startCards.items.workwear.description',
    href: '/dashboard/dotaciones',
    ctaKey: 'startCards.items.workwear.cta',
    moduleKey: 'COTIZADOR',
    icon: 'orders',
    tone: 'text-cyan-950',
    surface: 'border-cyan-200 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_34%),linear-gradient(180deg,#f4feff,#eafcff)]',
  },
  {
    titleKey: 'startCards.items.quotes.title',
    descriptionKey: 'startCards.items.quotes.description',
    href: '/dashboard/cotizaciones',
    ctaKey: 'startCards.items.quotes.cta',
    moduleKey: 'COTIZACIONES',
    icon: 'quotes',
    tone: 'text-indigo-950',
    surface: 'border-indigo-200 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_34%),linear-gradient(180deg,#f8f9ff,#eef2ff)]',
  },
  {
    titleKey: 'startCards.items.customers.title',
    descriptionKey: 'startCards.items.customers.description',
    href: '/dashboard/clientes',
    ctaKey: 'startCards.items.customers.cta',
    moduleKey: 'CLIENTES',
    icon: 'clients',
    tone: 'text-teal-950',
    surface: 'border-teal-200 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.24),transparent_34%),linear-gradient(180deg,#f4fffe,#e8fffb)]',
  },
  {
    titleKey: 'startCards.items.dental.title',
    descriptionKey: 'startCards.items.dental.description',
    href: '/dashboard/odontologia',
    ctaKey: 'startCards.items.dental.cta',
    moduleKey: 'CLIENTES',
    icon: 'clients',
    tone: 'text-cyan-950',
    surface: 'border-cyan-200 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),linear-gradient(180deg,#f4feff,#eafcff)]',
  },
  {
    titleKey: 'startCards.items.crm.title',
    descriptionKey: 'startCards.items.crm.description',
    href: '/dashboard/crm',
    ctaKey: 'startCards.items.crm.cta',
    moduleKey: 'CRM',
    icon: 'crm',
    tone: 'text-sky-950',
    surface: 'border-sky-200 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_34%),linear-gradient(180deg,#f8fdff,#eef8ff)]',
  },
  {
    titleKey: 'startCards.items.repository.title',
    descriptionKey: 'startCards.items.repository.description',
    href: '/dashboard/crm/archivos',
    ctaKey: 'startCards.items.repository.cta',
    moduleKey: 'CRM',
    icon: 'repository',
    tone: 'text-emerald-950',
    surface: 'border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.28),transparent_34%),linear-gradient(180deg,#f7fffb,#ebfff6)]',
  },
  {
    titleKey: 'startCards.items.tasks.title',
    descriptionKey: 'startCards.items.tasks.description',
    href: '/dashboard/espacios-trabajo',
    ctaKey: 'startCards.items.tasks.cta',
    moduleKey: 'CRM',
    icon: 'tasks',
    tone: 'text-violet-950',
    surface: 'border-violet-200 bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.3),transparent_34%),linear-gradient(180deg,#fcfaff,#f4efff)]',
  },
  {
    titleKey: 'startCards.items.orders.title',
    descriptionKey: 'startCards.items.orders.description',
    href: '/dashboard/ordenes',
    ctaKey: 'startCards.items.orders.cta',
    moduleKey: 'ORDENES',
    icon: 'orders',
    tone: 'text-fuchsia-950',
    surface: 'border-fuchsia-200 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.18),transparent_34%),linear-gradient(180deg,#fff9ff,#fff0ff)]',
  },
  {
    titleKey: 'startCards.items.inventory.title',
    descriptionKey: 'startCards.items.inventory.description',
    href: '/dashboard/inventario',
    ctaKey: 'startCards.items.inventory.cta',
    moduleKey: 'INVENTARIO',
    icon: 'inventory',
    tone: 'text-indigo-950',
    surface: 'border-indigo-200 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.25),transparent_34%),linear-gradient(180deg,#f8f9ff,#eef2ff)]',
  },
  {
    titleKey: 'startCards.items.purchases.title',
    descriptionKey: 'startCards.items.purchases.description',
    href: '/dashboard/compras',
    ctaKey: 'startCards.items.purchases.cta',
    moduleKey: 'COMPRAS',
    icon: 'purchases',
    tone: 'text-orange-950',
    surface: 'border-orange-200 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.25),transparent_34%),linear-gradient(180deg,#fff9f5,#fff1e8)]',
  },
  {
    titleKey: 'startCards.items.suppliers.title',
    descriptionKey: 'startCards.items.suppliers.description',
    href: '/dashboard/proveedores',
    ctaKey: 'startCards.items.suppliers.cta',
    moduleKey: 'PROVEEDORES',
    icon: 'suppliers',
    tone: 'text-lime-950',
    surface: 'border-lime-200 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.22),transparent_34%),linear-gradient(180deg,#fbfff4,#f4ffe7)]',
  },
  {
    titleKey: 'startCards.items.ocr.title',
    descriptionKey: 'startCards.items.ocr.description',
    href: '/dashboard/escaneos',
    ctaKey: 'startCards.items.ocr.cta',
    moduleKey: 'ESCANEOS',
    icon: 'ocr',
    tone: 'text-cyan-950',
    surface: 'border-cyan-200 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_34%),linear-gradient(180deg,#f4feff,#eafcff)]',
  },
  {
    titleKey: 'startCards.items.pos.title',
    descriptionKey: 'startCards.items.pos.description',
    href: '/dashboard/pos',
    ctaKey: 'startCards.items.pos.cta',
    moduleKey: 'POS',
    icon: 'pos',
    tone: 'text-rose-950',
    surface: 'border-rose-200 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.24),transparent_34%),linear-gradient(180deg,#fff8f9,#fff0f3)]',
  },
  {
    titleKey: 'startCards.items.deliveries.title',
    descriptionKey: 'startCards.items.deliveries.description',
    href: '/dashboard/remisiones',
    ctaKey: 'startCards.items.deliveries.cta',
    moduleKey: 'REMISIONES',
    icon: 'deliveries',
    tone: 'text-stone-950',
    surface: 'border-stone-200 bg-[radial-gradient(circle_at_top_left,rgba(168,162,158,0.24),transparent_34%),linear-gradient(180deg,#fffdfa,#faf7f5)]',
  },
  {
    titleKey: 'startCards.items.hr.title',
    descriptionKey: 'startCards.items.hr.description',
    href: '/dashboard/nomina',
    ctaKey: 'startCards.items.hr.cta',
    moduleKey: 'CONTABILIDAD',
    icon: 'hr',
    tone: 'text-emerald-950',
    surface: 'border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(180deg,#f6fffb,#edfff7)]',
  },
  {
    titleKey: 'startCards.items.accounting.title',
    descriptionKey: 'startCards.items.accounting.description',
    href: '/dashboard/contabilidad',
    ctaKey: 'startCards.items.accounting.cta',
    moduleKey: 'CONTABILIDAD',
    icon: 'accounting',
    tone: 'text-slate-950',
    surface: 'border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.24),transparent_34%),linear-gradient(180deg,#ffffff,#f8fafc)]',
  },
  {
    titleKey: 'startCards.items.reports.title',
    descriptionKey: 'startCards.items.reports.description',
    href: '/dashboard/reportes',
    ctaKey: 'startCards.items.reports.cta',
    moduleKey: 'REPORTES',
    icon: 'reports',
    tone: 'text-blue-950',
    surface: 'border-blue-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_34%),linear-gradient(180deg,#f8fbff,#eef5ff)]',
  },
]


type StartCardsGridProps = {
  allowedModules: ModuleKey[] | null
  enabledPlanModules: ModuleKey[] | null
  canManageBilling: boolean
  prioritizedHrefs?: string[]
  visibleHrefs?: string[]
}

function buildUpgradeHref(moduleKey: ModuleKey) {
  return `/dashboard/configuracion/plan?blockedModule=${encodeURIComponent(moduleKey)}`
}

export default function StartCardsGrid({ allowedModules, enabledPlanModules, canManageBilling, prioritizedHrefs = [], visibleHrefs = [] }: StartCardsGridProps) {
  const { t } = useI18n()
  const allowedSet = allowedModules ? new Set(allowedModules) : null
  const enabledSet = enabledPlanModules ? new Set(enabledPlanModules) : null
  const prioritizedMap = new Map(prioritizedHrefs.map((href, index) => [href, index]))
  const visibleSet = visibleHrefs.length ? new Set(visibleHrefs) : null

  const cards = START_CARDS
    .filter((card) => {
      if (visibleSet) return visibleSet.has(card.href)
      return !isOnboardingScopedDashboardHref(card.href)
    })
    .filter((card) => !allowedSet || allowedSet.has(card.moduleKey))
    .map((card) => ({
      ...card,
      locked: enabledSet ? !enabledSet.has(card.moduleKey) : false,
    }))
    .sort((a, b) => (prioritizedMap.get(a.href) ?? Number.MAX_SAFE_INTEGER) - (prioritizedMap.get(b.href) ?? Number.MAX_SAFE_INTEGER))

  const recommendedSet = new Set(cards.slice(0, Math.min(3, prioritizedHrefs.length)).map((card) => card.href))

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {cards.map((card) => {
          const Icon = ICONS[card.icon]
          const title = t(card.titleKey)
          const description = t(card.descriptionKey)
          const cta = t(card.ctaKey)
          const isRecommended = recommendedSet.has(card.href) && !card.locked
          const href = card.locked
            ? canManageBilling
              ? buildUpgradeHref(card.moduleKey)
              : '/dashboard/configuracion/plan'
            : card.href

          return (
            <Tooltip key={card.href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  aria-label={`${title}. ${description}`}
                  className={cn(
                    'group relative flex flex-col items-start gap-2 rounded-2xl border px-2.5 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
                    card.surface,
                    card.locked && 'opacity-75 hover:opacity-100',
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-1">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-white/70 bg-white/85 shadow-sm', card.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {card.locked ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/10 text-slate-700">
                        <Lock className="h-2.5 w-2.5" />
                        <span className="sr-only">{t('startCards.requiresUpgrade')}</span>
                      </span>
                    ) : isRecommended ? (
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                    ) : null}
                  </div>
                  <span className="line-clamp-2 min-h-[28px] text-[11px] font-semibold leading-[14px] text-slate-950">{title}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center" className="max-w-[240px]">
                <p className="text-[11px] font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-600">{description}</p>
                {isRecommended ? (
                  <p className="mt-1 text-[11px] font-medium text-sky-700">{t('startCards.recommended')}</p>
                ) : null}
                {card.locked ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">
                    {t('startCards.lockedHint')}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] font-medium text-slate-900">{cta}</p>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

