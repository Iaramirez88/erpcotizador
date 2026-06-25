import type { ReactNode } from 'react'
import { InfoHint } from '@/components/ui/info-hint'
import { cn } from '@/lib/utils'

type CardInfoHeaderProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tone?: 'neutral' | 'data' | 'action'
  className?: string
  titleClassName?: string
}

const toneClassName: Record<NonNullable<CardInfoHeaderProps['tone']>, string> = {
  neutral: 'bg-transparent',
  data: 'rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2',
  action: 'rounded-2xl border border-sky-200/80 bg-sky-50/70 px-3 py-2',
}

export function CardInfoHeader({
  title,
  description,
  actions,
  tone = 'neutral',
  className,
  titleClassName,
}: CardInfoHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between', toneClassName[tone], className)}>
      <div className="flex items-center gap-2">
        <div className={cn('font-semibold text-slate-950', titleClassName)}>{title}</div>
        {description ? <InfoHint content={description} /> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}