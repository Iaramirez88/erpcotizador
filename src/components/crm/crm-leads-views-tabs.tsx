'use client'

import { cn } from '@/lib/utils'
import { LEAD_VIEWS } from '@/components/crm/crm-leads-types'

export function CrmLeadsViewsTabs({
  activeView,
  counters,
  total,
  unassigned,
  onChange,
}: {
  activeView: string
  counters: Record<string, number>
  total: number
  unassigned: number
  onChange: (view: string) => void
}) {
  function countFor(viewId: string) {
    if (viewId === 'all') return total
    const view = LEAD_VIEWS.find((item) => item.id === viewId)
    if (!view) return 0
    return view.statuses.reduce((sum, status) => sum + (counters[status] ?? 0), 0)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LEAD_VIEWS.map((view) => {
        const isActive = activeView === view.id
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onChange(view.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition',
              isActive
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
            )}
          >
            {view.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
              )}
            >
              {countFor(view.id)}
            </span>
          </button>
        )
      })}
      {unassigned > 0 ? (
        <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          {unassigned} sin responsable
        </span>
      ) : null}
    </div>
  )
}
