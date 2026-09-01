import Link from 'next/link'
import type { ReactNode } from 'react'
import { ErpPageHero, type ErpBreadcrumbItem } from '@/components/dashboard/erp-page-chrome'
import { cn } from '@/lib/utils'

type RopModuleSection = 'home' | 'empresas' | 'necesidades' | 'perfil' | 'activar'

type RopModuleChromeProps = {
  current: RopModuleSection
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: ErpBreadcrumbItem[]
  actions?: ReactNode
  stats?: Array<{
    label: string
    value: ReactNode
    hint?: ReactNode
    tone?: 'neutral' | 'teal' | 'amber' | 'sky'
  }>
}

const ROP_MODULE_TABS: Array<{ key: RopModuleSection; label: string; href: string }> = [
  { key: 'home', label: 'Resumen', href: '/dashboard/rop' },
  { key: 'empresas', label: 'Empresas', href: '/dashboard/rop/empresas' },
  { key: 'necesidades', label: 'Necesidades', href: '/dashboard/rop/necesidades/nueva' },
  { key: 'perfil', label: 'Perfil', href: '/dashboard/rop/perfil' },
  { key: 'activar', label: 'Activar', href: '/dashboard/rop/activar' },
]

export function RopModuleChrome({ current, title, description, breadcrumbs, actions, stats }: RopModuleChromeProps) {
  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        actions={actions}
        stats={stats}
      />

      <div className="sticky top-[4.9rem] z-20 rounded-[26px] border border-[#2b2e401a] bg-white/96 p-1.5 backdrop-blur supports-[backdrop-filter]:bg-white/88">
        <nav aria-label="Navegación del módulo ROP" className="flex flex-wrap gap-1">
          {ROP_MODULE_TABS.map((tab) => {
            const isActive = tab.key === current
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101010]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f2f4]',
                  isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/80 hover:text-slate-950'
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}