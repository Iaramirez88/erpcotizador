import { cn } from '@/lib/utils'

export type UsageMeterTone = 'normal' | 'warning' | 'critical'

export function getUsageTone(percentage: number): UsageMeterTone {
  if (percentage >= 95) return 'critical'
  if (percentage >= 80) return 'warning'
  return 'normal'
}

type UsageMeterProps = {
  label?: string
  used: number
  limit?: number | null
  unit?: string
  tone?: UsageMeterTone
  showRemaining?: boolean
  className?: string
}

/**
 * Barra de consumo genérica para addons y límites del plan.
 * - Si hay `limit`, muestra "usado / límite" y el porcentaje ocupado.
 * - Sin `limit`, muestra solo el valor usado con barra completa.
 */
export function UsageMeter({ label, used, limit, unit = '', tone, showRemaining = false, className }: UsageMeterProps) {
  const hasLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0
  const ratio = hasLimit ? (used / (limit as number)) : used > 0 ? 1 : 0
  const pct = Math.min(100, Math.round(ratio * 100))
  const level = tone ?? getUsageTone(ratio * 100)
  const remaining = hasLimit ? Math.max((limit as number) - used, 0) : null
  const barClass = level === 'critical' ? 'bg-rose-600' : level === 'warning' ? 'bg-amber-500' : 'bg-emerald-600'

  return (
    <div className={className}>
      {label || hasLimit || used > 0 ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-right text-sm font-semibold text-slate-950">
            {hasLimit
              ? `${used.toLocaleString('es-CO')} / ${(limit as number).toLocaleString('es-CO')}${unit ? ` ${unit}` : ''}`
              : `${used.toLocaleString('es-CO')}${unit ? ` ${unit}` : ''}`}
            {showRemaining && remaining !== null ? (
              <span className="block text-xs font-normal text-slate-500">{remaining.toLocaleString('es-CO')} disponibles</span>
            ) : null}
          </span>
        </div>
      ) : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
