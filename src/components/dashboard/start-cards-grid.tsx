'use client'

import Link from 'next/link'
import type { ModuleKey } from '@prisma/client'
import {
  ArrowRight,
  BarChart3,
  Boxes,
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
  | 'repository'
  | 'tasks'
  | 'orders'
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  | 'ocr'
  | 'pos'
  | 'accounting'
  | 'reports'
  | 'deliveries'

type StartCardDefinition = {
  title: string
  description: string
  href: string
  cta: string
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
  reports: BarChart3,
  deliveries: ShieldAlert,
}

const START_CARDS: StartCardDefinition[] = [
  {
    title: 'Cotizar y vender',
    description: 'Calcula productos y abre propuestas comerciales sin pasar por reportes ni configuración.',
    href: '/dashboard/cotizador',
    cta: 'Abrir cotizador',
    moduleKey: 'COTIZADOR',
    icon: 'calculator',
    tone: 'text-amber-950',
    surface: 'border-amber-200 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.35),transparent_34%),linear-gradient(180deg,#fffdf7,#fff7e8)]',
  },
  {
    title: 'Seguimiento de cotizaciones',
    description: 'Revisa estados, aprobaciones y próximas acciones sobre cotizaciones ya enviadas.',
    href: '/dashboard/cotizaciones',
    cta: 'Ver cotizaciones',
    moduleKey: 'COTIZACIONES',
    icon: 'quotes',
    tone: 'text-indigo-950',
    surface: 'border-indigo-200 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_34%),linear-gradient(180deg,#f8f9ff,#eef2ff)]',
  },
  {
    title: 'Administrar clientes',
    description: 'Centraliza fichas, contactos e historial para sostener el proceso comercial.',
    href: '/dashboard/clientes',
    cta: 'Abrir clientes',
    moduleKey: 'CLIENTES',
    icon: 'clients',
    tone: 'text-teal-950',
    surface: 'border-teal-200 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.24),transparent_34%),linear-gradient(180deg,#f4fffe,#e8fffb)]',
  },
  {
    title: 'Gestionar CRM',
    description: 'Atiende leads, oportunidades y conversaciones desde un frente comercial operativo.',
    href: '/dashboard/crm',
    cta: 'Abrir CRM',
    moduleKey: 'CRM',
    icon: 'crm',
    tone: 'text-sky-950',
    surface: 'border-sky-200 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_34%),linear-gradient(180deg,#f8fdff,#eef8ff)]',
  },
  {
    title: 'Repositorio comercial',
    description: 'Guarda propuestas, artes, audios y soportes del cliente en una sola biblioteca.',
    href: '/dashboard/crm/archivos',
    cta: 'Ir al repositorio',
    moduleKey: 'CRM',
    icon: 'repository',
    tone: 'text-emerald-950',
    surface: 'border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.28),transparent_34%),linear-gradient(180deg,#f7fffb,#ebfff6)]',
  },
  {
    title: 'Coordinar tareas internas',
    description: 'Organiza responsables, tareas y frentes internos conectados con CRM.',
    href: '/dashboard/espacios-trabajo',
    cta: 'Organizar equipo',
    moduleKey: 'CRM',
    icon: 'tasks',
    tone: 'text-violet-950',
    surface: 'border-violet-200 bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.3),transparent_34%),linear-gradient(180deg,#fcfaff,#f4efff)]',
  },
  {
    title: 'Órdenes de trabajo',
    description: 'Convierte ventas en ejecución y controla la carga operativa del equipo.',
    href: '/dashboard/ordenes',
    cta: 'Abrir órdenes',
    moduleKey: 'ORDENES',
    icon: 'orders',
    tone: 'text-fuchsia-950',
    surface: 'border-fuchsia-200 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.18),transparent_34%),linear-gradient(180deg,#fff9ff,#fff0ff)]',
  },
  {
    title: 'Controlar inventario',
    description: 'Consulta existencias, movimientos y disponibilidad antes de comprometer una venta.',
    href: '/dashboard/inventario',
    cta: 'Ver inventario',
    moduleKey: 'INVENTARIO',
    icon: 'inventory',
    tone: 'text-indigo-950',
    surface: 'border-indigo-200 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.25),transparent_34%),linear-gradient(180deg,#f8f9ff,#eef2ff)]',
  },
  {
    title: 'Registrar compras',
    description: 'Gestiona abastecimiento, entradas y seguimiento operativo con proveedores.',
    href: '/dashboard/compras',
    cta: 'Abrir compras',
    moduleKey: 'COMPRAS',
    icon: 'purchases',
    tone: 'text-orange-950',
    surface: 'border-orange-200 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.25),transparent_34%),linear-gradient(180deg,#fff9f5,#fff1e8)]',
  },
  {
    title: 'Gestionar proveedores',
    description: 'Consolida proveedores, condiciones y abastecimiento para compras más rápidas.',
    href: '/dashboard/proveedores',
    cta: 'Abrir proveedores',
    moduleKey: 'PROVEEDORES',
    icon: 'suppliers',
    tone: 'text-lime-950',
    surface: 'border-lime-200 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.22),transparent_34%),linear-gradient(180deg,#fbfff4,#f4ffe7)]',
  },
  {
    title: 'Digitalizar con OCR',
    description: 'Procesa documentos, extrae datos y acelera validaciones con escaneos asistidos.',
    href: '/dashboard/escaneos',
    cta: 'Procesar documentos',
    moduleKey: 'ESCANEOS',
    icon: 'ocr',
    tone: 'text-cyan-950',
    surface: 'border-cyan-200 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_34%),linear-gradient(180deg,#f4feff,#eafcff)]',
  },
  {
    title: 'Facturar o cobrar',
    description: 'Entra al POS cuando la operación ya es transaccional y requiere cobro inmediato.',
    href: '/dashboard/pos',
    cta: 'Entrar a POS',
    moduleKey: 'POS',
    icon: 'pos',
    tone: 'text-rose-950',
    surface: 'border-rose-200 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.24),transparent_34%),linear-gradient(180deg,#fff8f9,#fff0f3)]',
  },
  {
    title: 'Emitir remisiones',
    description: 'Controla entregas, soportes y cierres posteriores a la venta.',
    href: '/dashboard/remisiones',
    cta: 'Abrir remisiones',
    moduleKey: 'REMISIONES',
    icon: 'deliveries',
    tone: 'text-stone-950',
    surface: 'border-stone-200 bg-[radial-gradient(circle_at_top_left,rgba(168,162,158,0.24),transparent_34%),linear-gradient(180deg,#fffdfa,#faf7f5)]',
  },
  {
    title: 'Ver contabilidad',
    description: 'Accede a tesorería, asientos y control financiero cuando ya necesitas gestión formal.',
    href: '/dashboard/contabilidad',
    cta: 'Abrir contabilidad',
    moduleKey: 'CONTABILIDAD',
    icon: 'accounting',
    tone: 'text-slate-950',
    surface: 'border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.24),transparent_34%),linear-gradient(180deg,#ffffff,#f8fafc)]',
  },
  {
    title: 'Analizar reportes',
    description: 'Consulta indicadores para convertir operación diaria en decisiones.',
    href: '/dashboard/reportes',
    cta: 'Ir a reportes',
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
}

function buildUpgradeHref(moduleKey: ModuleKey) {
  return `/dashboard/configuracion/plan?blockedModule=${encodeURIComponent(moduleKey)}`
}

function buildAddonHref(moduleKey: ModuleKey) {
  return `/dashboard/configuracion/plan?blockedModule=${encodeURIComponent(moduleKey)}&purchaseMode=ADDON`
}

export default function StartCardsGrid({ allowedModules, enabledPlanModules, canManageBilling }: StartCardsGridProps) {
  const allowedSet = allowedModules ? new Set(allowedModules) : null
  const enabledSet = enabledPlanModules ? new Set(enabledPlanModules) : null

  const cards = START_CARDS.filter((card) => !allowedSet || allowedSet.has(card.moduleKey)).map((card) => ({
    ...card,
    locked: enabledSet ? !enabledSet.has(card.moduleKey) : false,
  }))

  return (
    <>
      <div className="hidden gap-4 p-4 md:grid md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = ICONS[card.icon]

          if (!card.locked) {
            return (
              <Link key={card.href} href={card.href} className={`group rounded-[28px] border p-5 transition-all hover:-translate-y-1 hover:shadow-lg ${card.surface}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-sm ${card.tone}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Empezar
                  </span>
                </div>
                <div className="mt-6 space-y-2">
                  <h2 className="text-xl font-semibold text-slate-950">{card.title}</h2>
                  <p className="text-sm leading-6 text-slate-700">{card.description}</p>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  {card.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            )
          }

          return (
            <div key={card.href} className={`rounded-[28px] border p-5 ${card.surface} relative overflow-hidden`}>
              <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px]" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-sm ${card.tone}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    <Lock className="h-3.5 w-3.5" />
                    Bloqueado
                  </span>
                </div>
                <div className="mt-6 space-y-2">
                  <h2 className="text-xl font-semibold text-slate-950">{card.title}</h2>
                  <p className="text-sm leading-6 text-slate-700">{card.description}</p>
                  <p className="text-sm font-medium text-slate-900">Tu plan actual no incluye este módulo.</p>
                </div>
                {canManageBilling ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link
                      href={buildUpgradeHref(card.moduleKey)}
                      className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Actualiza tu plan
                    </Link>
                    <Link
                      href={buildAddonHref(card.moduleKey)}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
                    >
                      Agrégalo independiente
                    </Link>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700">
                    Solo la persona dueña del plan o un administrador puede activarlo.
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {cards.map((card) => {
          const Icon = ICONS[card.icon]

          if (!card.locked) {
            return (
              <details key={card.href} className={`group rounded-[22px] border ${card.surface}`}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-sm ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-950">{card.title}</div>
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Disponible</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-600">Ver</div>
                </summary>
                <div className="border-t border-white/70 px-4 pb-4 pt-3">
                  <p className="text-sm leading-5 text-slate-700">{card.description}</p>
                  <Link
                    href={card.href}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-950"
                  >
                    {card.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </details>
            )
          }

          return (
            <details key={card.href} className={`group rounded-[22px] border ${card.surface}`}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-sm ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-950">{card.title}</div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
                    <Lock className="h-3 w-3" />
                    Bloqueado
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-600">Ver</div>
              </summary>
              <div className="border-t border-white/70 px-4 pb-4 pt-3">
                <p className="text-sm leading-5 text-slate-700">{card.description}</p>
                <p className="mt-2 text-sm font-medium text-slate-900">Tu plan actual no incluye este módulo.</p>
                {canManageBilling ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      href={buildUpgradeHref(card.moduleKey)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Actualiza tu plan
                    </Link>
                    <Link
                      href={buildAddonHref(card.moduleKey)}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900"
                    >
                      Agrégalo independiente
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700">
                    Solo la persona dueña del plan o un administrador puede activarlo.
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </>
  )
}