import Link from 'next/link'
import type { ReactNode } from "react"
import { InfoHint } from '@/components/ui/info-hint'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from "@/lib/utils"

export type ErpBreadcrumbItem = {
  label: ReactNode
  href?: string
}

type HeroStat = {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: "neutral" | "teal" | "amber" | "sky"
}

type ErpPageHeroProps = {
  breadcrumbs?: ErpBreadcrumbItem[]
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  stats?: HeroStat[]
  className?: string
}

const toneClassName: Record<NonNullable<HeroStat["tone"]>, string> = {
  neutral: "border-slate-200/80 bg-white/85 text-slate-950 dark:border-[#444444] dark:bg-[#1c1c1c] dark:text-[#e0e0e0]",
  teal: "border-emerald-200/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.9))] text-emerald-950 dark:border-[#444444] dark:bg-[#202020] dark:text-[#e0e0e0]",
  amber: "border-amber-200/80 bg-[linear-gradient(180deg,_rgba(255,251,235,0.96),_rgba(255,255,255,0.9))] text-amber-950 dark:border-[#444444] dark:bg-[#202020] dark:text-[#e0e0e0]",
  sky: "border-sky-200/80 bg-[linear-gradient(180deg,_rgba(240,249,255,0.96),_rgba(255,255,255,0.9))] text-sky-950 dark:border-[#444444] dark:bg-[#202020] dark:text-[#e0e0e0]",
}

export function ErpPageHero({
  breadcrumbs = [],
  eyebrow,
  title,
  description,
  actions,
  stats = [],
  className,
}: ErpPageHeroProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <section className={cn('sticky top-0 z-30 border-b border-[#2b2e401a] bg-white/96 backdrop-blur supports-[backdrop-filter]:bg-white/88 dark:border-[#444444] dark:bg-[#121212]/94', className)}>
        <div className="grid gap-2 px-3 py-2 lg:px-3.5 lg:py-2.5">
          <div className="space-y-1.5">
            {breadcrumbs.length ? <ErpBreadcrumbs items={breadcrumbs} /> : null}
            {eyebrow ? (
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 backdrop-blur dark:border-[#444444] dark:bg-[#1c1c1c] dark:text-[#e0e0e0]">
                {eyebrow}
              </div>
            ) : null}
            <div className="flex items-start gap-2">
              <h1 className="max-w-3xl text-lg font-semibold tracking-tight text-slate-950 dark:text-[#e0e0e0] lg:text-[1.65rem]">{title}</h1>
              {description ? <InfoHint content={description} label="Ver descripción de la página" className="mt-0.5" /> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
      </section>
    </TooltipProvider>
  )
}

export function ErpBreadcrumbs({ items, className }: { items: ErpBreadcrumbItem[]; className?: string }) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1 text-[10px] text-slate-400/90 dark:text-[#b0b0b0]', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={`${String(item.label)}-${index}`} className="inline-flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link href={item.href} className="rounded-full px-1 py-0.5 transition-colors hover:text-slate-600 dark:hover:text-[#e0e0e0]">
                {item.label}
              </Link>
            ) : (
              <span className={cn('px-1 py-0.5', isLast ? 'font-medium text-slate-600 dark:text-[#e0e0e0]' : '')}>{item.label}</span>
            )}
            {!isLast ? <span className="text-slate-300/90 dark:text-[#6b6b6b]">/</span> : null}
          </div>
        )
      })}
    </nav>
  )
}

type ErpSectionHeadingProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function ErpSectionHeading({ title, description, actions, className }: ErpSectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-[#e0e0e0] lg:text-base">{title}</h2>
        {description ? <InfoHint content={description} label="Ver descripción del bloque" /> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 text-[13px]">{actions}</div> : null}
    </div>
  )
}