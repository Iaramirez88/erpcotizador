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
  neutral: "border-slate-200/80 bg-white/85 text-slate-950",
  teal: "border-emerald-200/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.9))] text-emerald-950",
  amber: "border-amber-200/80 bg-[linear-gradient(180deg,_rgba(255,251,235,0.96),_rgba(255,255,255,0.9))] text-amber-950",
  sky: "border-sky-200/80 bg-[linear-gradient(180deg,_rgba(240,249,255,0.96),_rgba(255,255,255,0.9))] text-sky-950",
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
  const hasStats = stats.length > 0

  return (
    <TooltipProvider delayDuration={150}>
      <section
        className={cn(
          "overflow-hidden rounded-[18px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_32%),linear-gradient(135deg,_#fffdf8_0%,_#f8fbff_48%,_#f2f7f4_100%)] shadow-[0_14px_30px_-28px_rgba(15,23,42,0.24)]",
          className,
        )}
      >
        <div className={cn('grid gap-2 p-3 lg:p-3.5', hasStats ? 'lg:grid-cols-[1.25fr_0.75fr] lg:items-start' : undefined)}>
          <div className="space-y-1.5">
            {breadcrumbs.length ? <ErpBreadcrumbs items={breadcrumbs} /> : null}
            {eyebrow ? (
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 backdrop-blur">
                {eyebrow}
              </div>
            ) : null}
            <div className="flex items-start gap-2">
              <h1 className="max-w-3xl text-lg font-semibold tracking-tight text-slate-950 lg:text-[1.65rem]">{title}</h1>
              {description ? <InfoHint content={description} label="Ver descripción de la página" className="mt-0.5" /> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>

          {hasStats ? (
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map((stat) => {
                const statCard = (
                  <div
                    className={cn(
                      "rounded-[10px] border px-2.5 py-2 shadow-sm backdrop-blur",
                      toneClassName[stat.tone ?? "neutral"],
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
                      {stat.hint ? (
                        <InfoHint
                          content={stat.hint}
                          label={`Ver detalle de ${stat.label}`}
                          className="h-4 w-4 border-slate-300 bg-white/70"
                          iconClassName="h-3 w-3"
                        />
                      ) : null}
                    </div>
                    <div className="mt-1 text-base font-semibold leading-none">{stat.value}</div>
                  </div>
                )

                return <div key={stat.label}>{statCard}</div>
              })}
            </div>
          ) : null}
        </div>
      </section>
    </TooltipProvider>
  )
}

export function ErpBreadcrumbs({ items, className }: { items: ErpBreadcrumbItem[]; className?: string }) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1.5 text-xs text-slate-500', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={`${String(item.label)}-${index}`} className="inline-flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="rounded-full px-2 py-0.5 transition-colors hover:bg-white/80 hover:text-slate-900">
                {item.label}
              </Link>
            ) : (
              <span className={cn('rounded-full px-2 py-0.5', isLast ? 'bg-white/80 font-semibold text-slate-900' : '')}>{item.label}</span>
            )}
            {!isLast ? <span className="text-slate-300">/</span> : null}
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
        <h2 className="text-sm font-semibold text-slate-950 lg:text-base">{title}</h2>
        {description ? <InfoHint content={description} label="Ver descripción del bloque" /> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 text-[13px]">{actions}</div> : null}
    </div>
  )
}