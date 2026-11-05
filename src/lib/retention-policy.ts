/**
 * Política de retención de cuentas (fuente única de verdad).
 *
 * Reglas:
 *  - El trial del espacio personal dura **7 días hábiles** y se otorga una sola vez por persona.
 *  - Sin plan activo, la cuenta y su información se eliminan **60 días después del último acceso**.
 *  - **7 días antes** de la eliminación se envía un aviso al correo registrado.
 *  - Cuando vence la licencia pagada (`planValidUntil`) se envía un correo avisando que la
 *    cuenta queda suspendida y que la data se eliminará si no se renueva ni se vuelve a ingresar.
 *
 * Este módulo es puro (sin Prisma ni Next) porque lo usan tanto el servidor (correos, cron,
 * borrado automático) como componentes cliente (banner de aviso y tarjeta de política).
 */

export const PERSONAL_TRIAL_BUSINESS_DAYS = 7
export const ACCOUNT_INACTIVITY_DELETION_DAYS = 60
export const ACCOUNT_RETENTION_WARNING_DAYS = 7

/** Ruta pública donde se explica la política (ancla de la sección de conservación). */
export const RETENTION_POLICY_PATH = '/politica-de-privacidad#conservacion'
export const RETENTION_POLICY_LAST_UPDATED = '4 de noviembre de 2026'

/** Cookie con la fecha en que el usuario ocultó el aviso del dashboard. */
export const RETENTION_DISMISS_COOKIE = 'sg_retention_dismiss'

/** Valor de la cookie para "ocultar por hoy" (YYYY-MM-DD en UTC). */
export function retentionDismissValue(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/**
 * Suma días hábiles (lunes a viernes) conservando la hora de inicio.
 * Se calcula en UTC para que el resultado no dependa de la zona horaria del servidor.
 */
export function addBusinessDays(startedAt: Date, days: number): Date {
  const result = new Date(startedAt.getTime())
  let remaining = Math.max(0, Math.trunc(days))
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const weekday = result.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return result
}

export type AccountRetentionStage = 'EXEMPT' | 'ACTIVE' | 'WARNING' | 'DELETION_DUE'
export type AccountRetentionExemption = 'SUPER_ADMIN' | 'ACTIVE_PLAN'
export type AccountLastActivitySource = 'LOGIN' | 'CREATED' | 'POLICY_START'

/**
 * Fecha de activación de la política. Actúa como piso del cálculo: una cuenta inactiva
 * heredada (creada antes de la política) no se elimina el mismo día de la activación, sino
 * 60 días después de esa fecha como mínimo.
 *
 * Se puede sobreescribir con `RETENTION_POLICY_START_AT` (ISO) para mover el corte.
 */
export const DEFAULT_RETENTION_POLICY_START_AT = new Date('2026-11-04T00:00:00.000Z')

export type AccountRetentionInput = {
  now?: Date
  createdAt: Date
  lastLoginAt?: Date | null
  isSuperAdmin?: boolean
  planValidUntil?: Date | null
  trialValidUntil?: Date | null
  /** Piso del cálculo de inactividad (activación de la política). */
  policyStartAt?: Date | null
}

export type AccountRetentionState = {
  stage: AccountRetentionStage
  /** `null` cuando la cuenta está exenta (Super Admin o plan pagado vigente). */
  exemption: AccountRetentionExemption | null
  lastActivityAt: Date
  lastActivitySource: AccountLastActivitySource
  /** Fecha programada de eliminación; `null` si está exenta. */
  deletionAt: Date | null
  /** Fecha del aviso previo por correo (7 días antes de `deletionAt`). */
  warningAt: Date | null
  daysInactive: number
  daysUntilDeletion: number | null
  hasActivePlan: boolean
  hasActiveTrial: boolean
  /** Fecha en que venció la licencia pagada (si aplica). */
  licenseExpiredAt: Date | null
  /** Fecha en que terminó el trial (si aplica). */
  trialExpiredAt: Date | null
}

/**
 * Calcula el estado de retención de una cuenta:
 *  - exenta si es Super Admin o si tiene plan pagado vigente;
 *  - en riesgo (`WARNING`) durante los 7 días previos al borrado;
 *  - `DELETION_DUE` cuando se cumplen los 60 días sin acceso.
 */
export function resolveAccountRetention(input: AccountRetentionInput): AccountRetentionState {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()

  const planValidUntil = input.planValidUntil ?? null
  const trialValidUntil = input.trialValidUntil ?? null

  const hasActivePlan = Boolean(planValidUntil && planValidUntil.getTime() > nowMs)
  const hasActiveTrial = Boolean(trialValidUntil && trialValidUntil.getTime() > nowMs)
  const licenseExpiredAt = planValidUntil && planValidUntil.getTime() <= nowMs ? planValidUntil : null
  const trialExpiredAt = trialValidUntil && trialValidUntil.getTime() <= nowMs ? trialValidUntil : null

  const lastActivityBase = input.lastLoginAt ?? input.createdAt
  const policyStartAt = input.policyStartAt ?? null
  const lastActivityAt =
    policyStartAt && policyStartAt.getTime() > lastActivityBase.getTime() ? policyStartAt : lastActivityBase
  const lastActivitySource: AccountLastActivitySource =
    lastActivityAt.getTime() > lastActivityBase.getTime()
      ? 'POLICY_START'
      : input.lastLoginAt
        ? 'LOGIN'
        : 'CREATED'
  const daysInactive = Math.max(0, Math.floor((nowMs - lastActivityAt.getTime()) / DAY_MS))

  const exemption: AccountRetentionExemption | null = input.isSuperAdmin
    ? 'SUPER_ADMIN'
    : hasActivePlan
      ? 'ACTIVE_PLAN'
      : null

  const deletionAt = exemption ? null : addDays(lastActivityAt, ACCOUNT_INACTIVITY_DELETION_DAYS)
  const warningAt = deletionAt ? addDays(deletionAt, -ACCOUNT_RETENTION_WARNING_DAYS) : null
  const daysUntilDeletion = deletionAt
    ? Math.ceil((deletionAt.getTime() - nowMs) / DAY_MS)
    : null

  const stage: AccountRetentionStage = exemption
    ? 'EXEMPT'
    : (daysUntilDeletion as number) <= 0
      ? 'DELETION_DUE'
      : (daysUntilDeletion as number) <= ACCOUNT_RETENTION_WARNING_DAYS
        ? 'WARNING'
        : 'ACTIVE'

  return {
    stage,
    exemption,
    lastActivityAt,
    lastActivitySource,
    deletionAt,
    warningAt,
    daysInactive,
    daysUntilDeletion,
    hasActivePlan,
    hasActiveTrial,
    licenseExpiredAt,
    trialExpiredAt,
  }
}

/** Números y ruta de la política, para pintar el aviso sin duplicar textos. */
export function getRetentionPolicyFacts() {
  return {
    trialBusinessDays: PERSONAL_TRIAL_BUSINESS_DAYS,
    inactivityDeletionDays: ACCOUNT_INACTIVITY_DELETION_DAYS,
    warningDays: ACCOUNT_RETENTION_WARNING_DAYS,
    policyPath: RETENTION_POLICY_PATH,
    lastUpdated: RETENTION_POLICY_LAST_UPDATED,
  } as const
}

export function formatRetentionDate(date: Date, locale = 'es-CO'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'America/Bogota' }).format(date)
}
