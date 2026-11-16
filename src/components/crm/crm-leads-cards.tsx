'use client'

import { Building2, Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CrmLeadsScoreBadge } from '@/components/crm/crm-leads-score-badge'
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_STYLES,
  formatRelativeDate,
  type CrmLeadRow,
} from '@/components/crm/crm-leads-types'

export function CrmLeadsCards({
  leads,
  loading,
  selectedId,
  onSelect,
}: {
  leads: CrmLeadRow[]
  loading: boolean
  selectedId: string | null
  onSelect: (lead: CrmLeadRow) => void
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
        ))}
      </div>
    )
  }

  if (!leads.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-700">No hay leads con estos filtros</p>
        <p className="mt-1 text-xs text-slate-500">
          Ajusta la búsqueda o revisa otra vista. Los leads capturados sin regla de asignación aparecen en “Sin
          gestionar”.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {leads.map((lead) => {
        const sourceLabel = lead.originLabel || lead.sourceLabel || lead.source
        const email = lead.contact?.email || lead.email
        const phone = lead.contact?.celular || lead.contact?.telefono || lead.celular || lead.telefono

        return (
          <button
            key={lead.id}
            type="button"
            onClick={() => onSelect(lead)}
            className={cn(
              'group rounded-xl border bg-white p-4 text-left shadow-sm transition',
              selectedId === lead.id
                ? 'border-sky-300 ring-1 ring-sky-200'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{lead.nombre}</div>
                <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {lead.empresaNombre || '—'}
                </div>
              </div>
              <CrmLeadsScoreBadge score={lead.score} band={lead.scoreBand} />
            </div>

            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
              {email ? (
                <div className="flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{email}</span>
                </div>
              ) : null}
              {phone ? (
                <div className="flex items-center gap-1 truncate">
                  <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{phone}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  LIFECYCLE_STYLES[lead.lifecycleStatus]
                )}
              >
                {LIFECYCLE_LABELS[lead.lifecycleStatus]}
              </span>
              {sourceLabel ? (
                <span className="inline-flex rounded-full border bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {sourceLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
              <span className="truncate text-[11px] text-slate-500">
                {lead.ownerUser ? lead.ownerUser.name || lead.ownerUser.email : 'Sin responsable'}
              </span>
              <span className="ml-2 shrink-0 text-[11px] text-slate-400">{formatRelativeDate(lead.createdAt)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
