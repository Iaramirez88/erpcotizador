'use client'

import { cn } from '@/lib/utils'
import { formatRelativeDate, type CrmLeadTimelineEntry } from '@/components/crm/crm-leads-types'

const KIND_STYLES: Record<CrmLeadTimelineEntry['kind'], { dot: string; chip: string; label: string }> = {
  capture: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700', label: 'Captura' },
  score: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', label: 'Puntuación' },
  activity: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600', label: 'Actividad' },
  conversation: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', label: 'Conversación' },
  opportunity: { dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700', label: 'Oportunidad' },
  task: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700', label: 'Tarea' },
  sequence: { dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700', label: 'Secuencia' },
}

export function CrmLeadTimeline({
  entries,
  emptyLabel = 'Sin eventos registrados todavía.',
  className,
}: {
  entries: CrmLeadTimelineEntry[]
  emptyLabel?: string
  className?: string
}) {
  if (!entries.length) {
    return <p className={cn('text-xs text-slate-500', className)}>{emptyLabel}</p>
  }

  return (
    <ol className={cn('relative space-y-3 border-l border-slate-200 pl-4', className)}>
      {entries.map((entry) => {
        const style = KIND_STYLES[entry.kind] ?? KIND_STYLES.activity
        return (
          <li key={entry.id} className="relative">
            <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full', style.dot)} />
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', style.chip)}>
                {style.label}
              </span>
              <span className="text-xs font-medium text-slate-800">{entry.title}</span>
              <span className="text-[11px] text-slate-400">{formatRelativeDate(entry.occurredAt)}</span>
            </div>
            {entry.description ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{entry.description}</p>
            ) : null}
            {entry.channel ? <p className="text-[10px] text-slate-400">Canal: {entry.channel}</p> : null}
          </li>
        )
      })}
    </ol>
  )
}
