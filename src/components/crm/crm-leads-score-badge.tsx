import { cn } from '@/lib/utils'
import {
  SCORE_BAND_LABELS,
  SCORE_BAND_STYLES,
  type CrmLeadScoreBand,
} from '@/components/crm/crm-leads-types'

export function CrmLeadsScoreBadge({
  score,
  band,
  showBar = false,
  className,
}: {
  score: number
  band: CrmLeadScoreBand
  showBar?: boolean
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, score))
  const barColor =
    band === 'HOT' ? 'bg-rose-500' : band === 'WARM' ? 'bg-amber-500' : 'bg-slate-400'

  return (
    <div className={cn('flex min-w-[92px] flex-col gap-1', className)}>
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
          SCORE_BAND_STYLES[band]
        )}
      >
        {SCORE_BAND_LABELS[band]}
        <span className="font-mono text-[10px] opacity-80">{score}</span>
      </span>
      {showBar ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}
