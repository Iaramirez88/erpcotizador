'use client'

import { type DentitionType, type OdontogramEntry, findToothEntry, getDentitionLabel, getOdontogramRows, normalizeClinicalLabel } from '@/lib/odontology'
import { cn } from '@/lib/utils'

type OdontogramChartProps = {
  entries: OdontogramEntry[]
  selectedToothCode: string | null
  onSelectTooth: (toothCode: string) => void
  draftEntry?: Partial<OdontogramEntry> | null
  dentitionType: DentitionType
}

const TOP_ARCH_OFFSETS_ADULT = [24, 18, 13, 8, 4, 1, -1, -3, -3, -1, 1, 4, 8, 13, 18, 24]
const TOP_ARCH_OFFSETS_PEDIATRIC = [18, 12, 7, 3, 0, 0, 3, 7, 12, 18]

function getToothTone(condition: string | null, selected: boolean) {
  if (selected) return 'border-sky-500 bg-sky-100 text-sky-950 shadow-[0_12px_30px_-20px_rgba(14,165,233,0.85)]'

  switch ((condition || '').toUpperCase()) {
    case 'CARIES':
      return 'border-amber-300 bg-amber-100 text-amber-950'
    case 'FRACTURA':
      return 'border-rose-300 bg-rose-100 text-rose-950'
    case 'ENDODONCIA_PREVIA':
      return 'border-violet-300 bg-violet-100 text-violet-950'
    case 'AUSENTE':
      return 'border-slate-300 bg-slate-200 text-slate-700'
    case 'MOVILIDAD':
      return 'border-orange-300 bg-orange-100 text-orange-950'
    case 'RESTAURACION':
      return 'border-emerald-300 bg-emerald-100 text-emerald-950'
    default:
      return 'border-slate-200 bg-white text-slate-900 hover:border-sky-200 hover:bg-sky-50'
  }
}

function getToothFill(condition: string | null) {
  switch ((condition || '').toUpperCase()) {
    case 'CARIES':
      return '#f59e0b'
    case 'FRACTURA':
      return '#ef4444'
    case 'ENDODONCIA_PREVIA':
      return '#8b5cf6'
    case 'AUSENTE':
      return '#94a3b8'
    case 'MOVILIDAD':
      return '#f97316'
    case 'RESTAURACION':
      return '#10b981'
    default:
      return '#ffffff'
  }
}

function ToothIllustration(props: { fill: string; selected: boolean }) {
  return (
    <svg viewBox="0 0 64 88" className="h-10 w-8 drop-shadow-[0_8px_10px_rgba(15,23,42,0.12)]" aria-hidden="true">
      <path
        d="M32 6c11.2 0 20.5 6.6 23.8 17 2.5 7.8 1.4 17.4-3.3 28.9-2.1 5.1-4.7 10.8-7.8 17.3-1.6 3.2-3.2 6-4.8 8.3-1.9 2.8-3.9 4.2-6 4.2s-4.1-1.4-6-4.2c-1.6-2.3-3.2-5.1-4.8-8.3-3.1-6.5-5.7-12.2-7.8-17.3C9.6 40.4 8.5 30.8 11 23 14.3 12.6 23.6 6 32 6Z"
        fill={props.fill}
        stroke={props.selected ? '#0ea5e9' : '#cbd5e1'}
        strokeWidth="3"
      />
      <path
        d="M20 18c3.8 3.8 7.6 5.7 12 5.7 4.4 0 8.2-1.9 12-5.7"
        fill="none"
        stroke={props.selected ? '#0284c7' : '#94a3b8'}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M28 40c-1.2 8.2-1.1 15.8.2 22.9M36 40c1.2 8.2 1.1 15.8-.2 22.9"
        fill="none"
        stroke={props.selected ? '#0284c7' : '#cbd5e1'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ToothButton(props: { toothCode: string; offset: number; entries: OdontogramEntry[]; selectedToothCode: string | null; onSelectTooth: (toothCode: string) => void }) {
  const entry = findToothEntry(props.entries, props.toothCode)
  const selected = props.selectedToothCode === props.toothCode
  const fill = getToothFill(entry?.condition ?? null)

  return (
    <button
      type="button"
      onClick={() => props.onSelectTooth(props.toothCode)}
      style={{ transform: `translateY(${props.offset}px)` }}
      className={cn(
        'flex min-w-[3.8rem] flex-col items-center justify-start rounded-[22px] border px-1 py-2 text-center transition-all',
        getToothTone(entry?.condition ?? null, selected),
      )}
    >
      <ToothIllustration fill={fill} selected={selected} />
      <span className="mt-1 text-[11px] font-semibold tracking-[0.18em]">{props.toothCode}</span>
      <span className="mt-1 line-clamp-2 px-1 text-[10px] leading-3 opacity-80">{normalizeClinicalLabel(entry?.condition || 'Libre')}</span>
    </button>
  )
}

export function OdontogramChart(props: OdontogramChartProps) {
  const rows = getOdontogramRows(props.dentitionType)
  const topOffsets = rows.top.length > 10 ? TOP_ARCH_OFFSETS_ADULT : TOP_ARCH_OFFSETS_PEDIATRIC
  const bottomOffsets = [...topOffsets].reverse()
  const entries = props.selectedToothCode && props.draftEntry?.condition
    ? [
        ...props.entries.filter((entry) => entry.toothCode !== props.selectedToothCode),
        {
          toothCode: props.selectedToothCode,
          condition: props.draftEntry.condition,
          diagnosis: props.draftEntry.diagnosis?.trim() || 'Borrador en edición',
          recommendedProcedure: props.draftEntry.recommendedProcedure?.trim() || null,
          notes: props.draftEntry.notes?.trim() || null,
        },
      ]
    : props.entries

  return (
    <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(224,242,254,0.65),transparent_45%),linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Odontograma visual</h3>
          <p className="text-sm text-slate-600">Selecciona una pieza dental para registrar condición, diagnóstico, procedimiento sugerido y evolución por diente.</p>
        </div>
        <div className="text-xs text-slate-500">{getDentitionLabel(props.dentitionType)}</div>
      </div>

      <div className="mt-6 space-y-10">
        <div className="relative rounded-[28px] border border-sky-100 bg-[linear-gradient(180deg,rgba(240,249,255,0.9),rgba(255,255,255,0.7))] px-3 pb-4 pt-6">
          <div className="pointer-events-none absolute inset-x-8 top-6 h-24 rounded-t-[999px] border-x border-t border-sky-200/80" />
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Maxilar superior</div>
          <div className={cn('relative grid gap-2', rows.top.length > 10 ? 'grid-cols-8 md:grid-cols-16' : 'grid-cols-5 md:grid-cols-10')}>
            {rows.top.map((toothCode, index) => (
              <ToothButton
                key={toothCode}
                toothCode={toothCode}
                offset={topOffsets[index] ?? 0}
                entries={entries}
                selectedToothCode={props.selectedToothCode}
                onSelectTooth={props.onSelectTooth}
              />
            ))}
          </div>
        </div>

        <div className="relative rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(248,250,252,0.95))] px-3 pb-6 pt-4">
          <div className="pointer-events-none absolute inset-x-8 bottom-6 h-24 rounded-b-[999px] border-b border-x border-slate-200/90" />
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mandíbula inferior</div>
          <div className={cn('relative grid gap-2', rows.bottom.length > 10 ? 'grid-cols-8 md:grid-cols-16' : 'grid-cols-5 md:grid-cols-10')}>
            {rows.bottom.map((toothCode, index) => (
              <ToothButton
                key={toothCode}
                toothCode={toothCode}
                offset={-1 * (bottomOffsets[index] ?? 0)}
                entries={entries}
                selectedToothCode={props.selectedToothCode}
                onSelectTooth={props.onSelectTooth}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">Caries</span>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1">Fractura</span>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1">Endodoncia previa</span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">Restauración</span>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1">Ausente</span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1">Seleccionado</span>
      </div>
    </div>
  )
}