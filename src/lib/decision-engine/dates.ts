import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'

export function parseDateOnlyUtc(value: string, endOfDay: boolean): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map((part) => Number(part))
    if (!year || !month || !day) return null

    return endOfDay
      ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  }

  const parsed = new Date(trimmed)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

export function resolveAnalysisDateRange(context: DecisionEngineContext) {
  const to = context.to ?? new Date()
  const from = context.from ?? new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000)
  const durationMs = Math.max(24 * 60 * 60 * 1000, to.getTime() - from.getTime())

  const previousTo = new Date(from.getTime() - 1)
  const previousFrom = new Date(previousTo.getTime() - durationMs)

  return {
    from,
    to,
    previousFrom,
    previousTo,
    durationDays: Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000))),
  }
}