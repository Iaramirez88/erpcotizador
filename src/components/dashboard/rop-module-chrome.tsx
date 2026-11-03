import Link from 'next/link'
import type { ReactNode } from 'react'
import { ErpPageHero, type ErpBreadcrumbItem } from '@/components/dashboard/erp-page-chrome'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'
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

const ROP_MODULE_TABS: Array<{ key: RopModuleSection; labelKey: string; href: string }> = [
  { key: 'home', labelKey: 'rop.chrome.tab.home', href: '/dashboard/rop' },
  { key: 'empresas', labelKey: 'rop.chrome.tab.empresas', href: '/dashboard/rop/empresas' },
  { key: 'necesidades', labelKey: 'rop.chrome.tab.necesidades', href: '/dashboard/rop/necesidades/nueva' },
  { key: 'perfil', labelKey: 'rop.chrome.tab.perfil', href: '/dashboard/rop/perfil' },
  { key: 'activar', labelKey: 'rop.chrome.tab.activar', href: '/dashboard/rop/activar' },
]

export async function RopModuleChrome({ current, title, description, breadcrumbs, actions, stats }: RopModuleChromeProps) {
  const language = await getServerLanguage()
  const navLabel = translate(language, 'rop.chrome.navLabel')
  const tabLabels = ROP_MODULE_TABS.map((tab) => translate(language, tab.labelKey))

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
        <nav aria-label={navLabel} className="flex flex-wrap gap-1">
          {ROP_MODULE_TABS.map((tab, index) => {
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
                {tabLabels[index]}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}