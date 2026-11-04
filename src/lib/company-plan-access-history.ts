import type { BillingCycle, PlanTier } from '@prisma/client'

/**
 * Historial de habilitaciones manuales de vigencia (Super Admin).
 *
 * Se guarda dentro de `Empresa.dashboardConfig.planAccessHistory` para no requerir
 * migración de base de datos. Sirve para saber quién regaló/extendió un periodo de
 * prueba o habilitó acceso por un pago hecho por fuera de la plataforma, y luego
 * poder conciliar en facturación.
 */
export type PlanAccessAction = 'GRANT_TRIAL' | 'GRANT_PLAN' | 'REVOKE_PLAN'

export type PlanAccessHistoryEntry = {
  at: string
  action: PlanAccessAction
  byEmail: string | null
  tier: PlanTier
  billingCycle: BillingCycle | null
  days: number | null
  validUntil: string | null
  note: string | null
}

export const PLAN_ACCESS_HISTORY_LIMIT = 25

const PLAN_ACCESS_ACTIONS: PlanAccessAction[] = ['GRANT_TRIAL', 'GRANT_PLAN', 'REVOKE_PLAN']

const PLAN_TIERS: PlanTier[] = ['CRM', 'BASIC', 'MEDIO', 'INTERMEDIO', 'FULL']

const BILLING_CYCLES: BillingCycle[] = ['MONTHLY', 'YEARLY']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPlanAccessAction(value: unknown): value is PlanAccessAction {
  return typeof value === 'string' && PLAN_ACCESS_ACTIONS.includes(value as PlanAccessAction)
}

export function isPlanTierValue(value: unknown): value is PlanTier {
  return typeof value === 'string' && PLAN_TIERS.includes(value as PlanTier)
}

export function isBillingCycleValue(value: unknown): value is BillingCycle {
  return typeof value === 'string' && BILLING_CYCLES.includes(value as BillingCycle)
}

function parseEntry(value: unknown): PlanAccessHistoryEntry | null {
  if (!isRecord(value)) return null

  const action = isPlanAccessAction(value.action) ? value.action : null
  const tier = isPlanTierValue(value.tier) ? value.tier : null
  const at = typeof value.at === 'string' ? value.at : null
  if (!action || !tier || !at) return null

  const billingCycle = isBillingCycleValue(value.billingCycle) ? value.billingCycle : null
  const days = typeof value.days === 'number' && Number.isFinite(value.days) ? value.days : null
  const validUntil = typeof value.validUntil === 'string' ? value.validUntil : null
  const byEmail = typeof value.byEmail === 'string' ? value.byEmail : null
  const note = typeof value.note === 'string' ? value.note : null

  return { at, action, byEmail, tier, billingCycle, days, validUntil, note }
}

export function parsePlanAccessHistory(dashboardConfig: unknown): PlanAccessHistoryEntry[] {
  if (!isRecord(dashboardConfig)) return []
  const raw = dashboardConfig.planAccessHistory
  if (!Array.isArray(raw)) return []

  return raw
    .map(parseEntry)
    .filter((entry): entry is PlanAccessHistoryEntry => Boolean(entry))
    .slice(0, PLAN_ACCESS_HISTORY_LIMIT)
}

export function appendPlanAccessHistory(
  dashboardConfig: unknown,
  entry: PlanAccessHistoryEntry,
): Record<string, unknown> {
  const current = isRecord(dashboardConfig) ? { ...dashboardConfig } : {}
  const previous = parsePlanAccessHistory(current)

  current.planAccessHistory = [entry, ...previous].slice(0, PLAN_ACCESS_HISTORY_LIMIT)
  return current
}
