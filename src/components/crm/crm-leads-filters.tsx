'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CrmLeadOwner } from '@/components/crm/crm-leads-types'

export type CrmLeadsFilterState = {
  q: string
  source: string
  scoreBand: string
  ownerUserId: string
  serviceInterest: string
  unassigned: boolean
  createdFrom: string
  createdTo: string
}

export const EMPTY_LEADS_FILTERS: CrmLeadsFilterState = {
  q: '',
  source: '',
  scoreBand: '',
  ownerUserId: '',
  serviceInterest: '',
  unassigned: false,
  createdFrom: '',
  createdTo: '',
}

const SOURCE_OPTIONS = [
  { value: '', label: 'Todas las fuentes' },
  { value: 'WEB', label: 'Web' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'GOOGLE_ADS', label: 'Google Ads' },
  { value: 'META_ADS', label: 'Meta Ads' },
  { value: 'LANDING_PAGE', label: 'Landing' },
  { value: 'IMPORT', label: 'Importación' },
  { value: 'REFERIDO', label: 'Referido' },
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'ORGANICO', label: 'Orgánico' },
  { value: 'API', label: 'API' },
  { value: 'EVENTO', label: 'Evento' },
  { value: 'OTRO', label: 'Otro' },
]

const SCORE_OPTIONS = [
  { value: '', label: 'Cualquier puntuación' },
  { value: 'HOT', label: 'Caliente' },
  { value: 'WARM', label: 'Tibio' },
  { value: 'COLD', label: 'Frío' },
]

export function CrmLeadsFilters({
  value,
  owners,
  onChange,
  onClear,
}: {
  value: CrmLeadsFilterState
  owners: CrmLeadOwner[]
  onChange: (patch: Partial<CrmLeadsFilterState>) => void
  onClear: () => void
}) {
  const hasActiveFilters =
    Boolean(value.q) ||
    Boolean(value.source) ||
    Boolean(value.scoreBand) ||
    Boolean(value.ownerUserId) ||
    Boolean(value.serviceInterest) ||
    value.unassigned ||
    Boolean(value.createdFrom) ||
    Boolean(value.createdTo)

  const selectClass =
    'h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none'

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Input
            value={value.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Buscar por nombre, empresa, correo o documento…"
            className="h-9 text-xs"
          />
        </div>

        <select
          className={selectClass}
          value={value.source}
          onChange={(event) => onChange({ source: event.target.value })}
        >
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={value.scoreBand}
          onChange={(event) => onChange({ scoreBand: event.target.value })}
        >
          {SCORE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={value.ownerUserId}
          onChange={(event) => onChange({ ownerUserId: event.target.value, unassigned: false })}
        >
          <option value="">Todos los responsables</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name || owner.email}
            </option>
          ))}
        </select>

        <Input
          type="date"
          value={value.createdFrom}
          onChange={(event) => onChange({ createdFrom: event.target.value })}
          className="h-9 w-full text-xs lg:w-36"
          aria-label="Capturado desde"
        />
        <Input
          type="date"
          value={value.createdTo}
          onChange={(event) => onChange({ createdTo: event.target.value })}
          className="h-9 w-full text-xs lg:w-36"
          aria-label="Capturado hasta"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ unassigned: !value.unassigned, ownerUserId: '' })}
          className={cn(
            'rounded-full border px-3 py-1 text-[11px] font-medium transition',
            value.unassigned
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          )}
        >
          Solo sin responsable
        </button>

        <Input
          value={value.serviceInterest}
          onChange={(event) => onChange({ serviceInterest: event.target.value })}
          placeholder="Servicio de interés"
          className="h-8 w-full text-xs sm:w-56"
        />

        {hasActiveFilters ? (
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  )
}
