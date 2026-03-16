import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type HeroStat = {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: "neutral" | "teal" | "amber" | "sky"
}

type ErpPageHeroProps = {
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
  eyebrow,
  title,
  description,
  actions,
  stats = [],
  className,
}: ErpPageHeroProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_32%),linear-gradient(135deg,_#fffdf8_0%,_#f8fbff_48%,_#f2f7f4_100%)] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]",
        className,
      )}
    >
      <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div className="space-y-4">
          {eyebrow ? (
            <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 backdrop-blur">
              {eyebrow}
            </div>
          ) : null}
          <div className="space-y-2">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">{title}</h1>
            {description ? <p className="max-w-3xl text-sm leading-6 text-slate-600 lg:text-base">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {stats.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-3xl border p-5 shadow-sm backdrop-blur",
                  toneClassName[stat.tone ?? "neutral"],
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                <div className="mt-4 text-3xl font-semibold">{stat.value}</div>
                {stat.hint ? <p className="mt-2 text-sm text-slate-500">{stat.hint}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
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
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 text-sm">{actions}</div> : null}
    </div>
  )
}