import type { ReactNode } from 'react'
import { ErpBreadcrumbs, type ErpBreadcrumbItem } from '@/components/dashboard/erp-page-chrome'
import { InfoHint } from '@/components/ui/info-hint'
import { cn } from '@/lib/utils'

type Props = {
  breadcrumbs: ErpBreadcrumbItem[]
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  info?: ReactNode
  actions?: ReactNode
  className?: string
}

export function CrmNegotiationsPageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  info,
  actions,
  className,
}: Props) {
  const helperContent = info ?? description

  return (
    <section className={cn('sticky top-0 z-20 space-y-3 border-b border-[#2b2e401a] bg-white/96 px-1 pt-1 pb-3 backdrop-blur supports-[backdrop-filter]:bg-white/88', className)}>
      <ErpBreadcrumbs items={breadcrumbs} />
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 lg:text-[2rem]">{title}</h1>
          {helperContent ? <InfoHint content={helperContent} label="Ver descripción de la página" className="mt-1" /> : null}
        </div>
        {description ? <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  )
}