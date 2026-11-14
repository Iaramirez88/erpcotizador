'use client'

import Link from 'next/link'
import { ArrowLeftRight, Ban, CheckCircle2, ExternalLink, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CrmLeadsScoreBadge } from '@/components/crm/crm-leads-score-badge'
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_STYLES,
  formatRelativeDate,
  type CrmLeadRow,
} from '@/components/crm/crm-leads-types'

export type CrmLeadsSortKey = 'lastActivityAt' | 'createdAt' | 'score' | 'lastCaptureAt' | 'nombre'

export function CrmLeadsTable({
  leads,
  loading,
  selectedId,
  sortKey,
  sortDir,
  onSelect,
  onSortChange,
  onAssign,
  onStatus,
  onConvert,
  onDoNotContact,
}: {
  leads: CrmLeadRow[]
  loading: boolean
  selectedId: string | null
  sortKey: CrmLeadsSortKey
  sortDir: 'asc' | 'desc'
  onSelect: (lead: CrmLeadRow) => void
  onSortChange: (key: CrmLeadsSortKey) => void
  onAssign: (lead: CrmLeadRow) => void
  onStatus: (lead: CrmLeadRow) => void
  onConvert: (lead: CrmLeadRow) => void
  onDoNotContact: (lead: CrmLeadRow) => void
}) {
  function sortIndicator(key: CrmLeadsSortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
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
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="cursor-pointer px-3 py-2.5 font-semibold" onClick={() => onSortChange('nombre')}>
                Lead{sortIndicator('nombre')}
              </th>
              <th className="px-3 py-2.5 font-semibold">Contacto</th>
              <th className="px-3 py-2.5 font-semibold">Estado</th>
              <th className="cursor-pointer px-3 py-2.5 font-semibold" onClick={() => onSortChange('score')}>
                Puntuación{sortIndicator('score')}
              </th>
              <th className="px-3 py-2.5 font-semibold">Origen</th>
              <th className="px-3 py-2.5 font-semibold">Responsable</th>
              <th className="cursor-pointer px-3 py-2.5 font-semibold" onClick={() => onSortChange('createdAt')}>
                Capturado{sortIndicator('createdAt')}
              </th>
              <th
                className="cursor-pointer px-3 py-2.5 font-semibold"
                onClick={() => onSortChange('lastActivityAt')}
              >
                Última actividad{sortIndicator('lastActivityAt')}
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onSelect(lead)}
                className={cn(
                  'cursor-pointer transition hover:bg-slate-50',
                  selectedId === lead.id ? 'bg-sky-50/60' : ''
                )}
              >
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-slate-900">{lead.nombre}</div>
                  <div className="text-[11px] text-slate-500">{lead.empresaNombre || '—'}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-slate-700">{lead.contact?.email || lead.email || '—'}</div>
                  <div className="text-[11px] text-slate-500">
                    {lead.contact?.celular || lead.contact?.telefono || lead.celular || lead.telefono || '—'}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      LIFECYCLE_STYLES[lead.lifecycleStatus]
                    )}
                  >
                    {LIFECYCLE_LABELS[lead.lifecycleStatus]}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <CrmLeadsScoreBadge score={lead.score} band={lead.scoreBand} showBar />
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-slate-700">{lead.originLabel || lead.sourceLabel || lead.source}</div>
                  <div className="text-[11px] text-slate-500">
                    {[lead.formName, lead.campaignName, lead.serviceInterest].filter(Boolean).join(' · ') || '—'}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {lead.ownerUser ? (
                    <span className="text-slate-700">{lead.ownerUser.name || lead.ownerUser.email}</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Sin responsable
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{formatRelativeDate(lead.createdAt)}</td>
                <td className="px-3 py-2.5 text-slate-600">{formatRelativeDate(lead.lastActivityAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button size="sm" variant="ghost" title="Asignar" onClick={() => onAssign(lead)}>
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Cambiar estado" onClick={() => onStatus(lead)}>
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Convertir en oportunidad" onClick={() => onConvert(lead)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" title="No contactar" onClick={() => onDoNotContact(lead)}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                    <Button asChild size="sm" variant="ghost" title="Abrir ficha">
                      <Link href={`/dashboard/crm/leads/${lead.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      <div className="space-y-2 lg:hidden">
        {leads.map((lead) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => onSelect(lead)}
            className={cn(
              'w-full rounded-xl border bg-white p-3 text-left shadow-sm transition',
              selectedId === lead.id ? 'border-sky-300 ring-1 ring-sky-200' : 'border-slate-200'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{lead.nombre}</div>
                <div className="text-[11px] text-slate-500">
                  {lead.empresaNombre || lead.contact?.email || lead.email || '—'}
                </div>
              </div>
              <CrmLeadsScoreBadge score={lead.score} band={lead.scoreBand} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  LIFECYCLE_STYLES[lead.lifecycleStatus]
                )}
              >
                {LIFECYCLE_LABELS[lead.lifecycleStatus]}
              </span>
              <span className="text-[11px] text-slate-500">
                {lead.ownerUser ? lead.ownerUser.name || lead.ownerUser.email : 'Sin responsable'}
              </span>
              <span className="text-[11px] text-slate-400">· {formatRelativeDate(lead.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

