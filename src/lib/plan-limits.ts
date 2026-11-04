import type { PlanTier } from '@prisma/client'
import {
  LEGACY_LIMIT_KEY_TO_RESOURCE,
  PLAN_CAPACITY_UPGRADE_URL,
  checkPlanCapacity,
  formatPlanCapacityAmount,
  getPlanCapacitySnapshot,
  type LegacyPlanLimitKey,
  type PlanCapacityCheck,
  type PlanCapacityLevel,
  type PlanCapacityOveragePolicy,
  type PlanCapacityResource,
} from '@/lib/plan-capacity'

/**
 * Fachada histórica del control de planes.
 *
 * La lógica real vive en `@/lib/plan-capacity` (servicio central de capacidad).
 * Este archivo mantiene la firma que ya consumen las rutas de la plataforma:
 *
 *   const limit = await checkPlanLimit(empresaId, 'COTIZACIONES_PER_MONTH')
 *   if (!limit.ok) return NextResponse.json(limit, { status: 402 })
 */

export type PlanLimitKey = LegacyPlanLimitKey

export type PlanLimitError = {
  ok: false
  code: 'PLAN_LIMIT_REACHED'
  message: string
  limitKey: PlanLimitKey
  current: number
  max: number
  planTier: PlanTier
  upgradeUrl: '/dashboard/configuracion/plan'
  resource: PlanCapacityResource
  percentage: number
  level: PlanCapacityLevel
  unit: string
}

export type PlanLimitOk = { ok: true; planTier: PlanTier }

export type PlanUsageMeter = {
  key: PlanLimitKey
  label: string
  current: number
  max: number | null
  unit: string
  monthly: boolean
  percentage: number
  remaining: number | null
  level: PlanCapacityLevel
  allowed: boolean
  policy: PlanCapacityOveragePolicy
}

export type PlanUsageSummary = {
  planTier: PlanTier
  meters: PlanUsageMeter[]
}

const PLAN_LIMIT_META: Array<{ key: PlanLimitKey; label: string; monthly: boolean }> = [
  { key: 'USUARIOS_MAX', label: 'Usuarios', monthly: false },
  { key: 'SEDES_MAX', label: 'Sedes', monthly: false },
  { key: 'CLIENTES_MAX', label: 'Clientes', monthly: false },
  { key: 'PRODUCTOS_MAX', label: 'Productos', monthly: false },
  { key: 'PROVEEDORES_MAX', label: 'Proveedores', monthly: false },
  { key: 'COTIZACIONES_PER_MONTH', label: 'Cotizaciones (mes)', monthly: true },
  { key: 'ORDENES_PER_MONTH', label: 'Órdenes de trabajo (mes)', monthly: true },
  { key: 'REMISIONES_PER_MONTH', label: 'Remisiones (mes)', monthly: true },
]

/** Resumen de consumo usado por /dashboard/perfil, /dashboard/configuracion/plan y super admin. */
export async function getPlanUsageSummary(empresaId: string): Promise<PlanUsageSummary> {
  const snapshot = await getPlanCapacitySnapshot({ companyId: empresaId })
  if (!snapshot) return { planTier: 'FULL', meters: [] }

  const meters: PlanUsageMeter[] = PLAN_LIMIT_META.map((meta) => {
    const resource = LEGACY_LIMIT_KEY_TO_RESOURCE[meta.key]
    const meter = snapshot.meters.find((item) => item.resource === resource)
    return {
      key: meta.key,
      label: meta.label,
      current: meter?.used ?? 0,
      max: meter?.limit ?? null,
      unit: meter?.unit ?? '',
      monthly: meta.monthly,
      percentage: meter?.percentage ?? 0,
      remaining: meter?.remaining ?? null,
      level: meter?.level ?? 'ok',
      allowed: meter?.allowed ?? true,
      policy: meter?.policy ?? 'BLOCK',
    }
  })

  return { planTier: snapshot.planTier, meters }
}

/**
 * Verifica capacidad antes de crear un registro.
 * Si la política del plan permite excedente (`OVERAGE`) o solo advierte (`WARN`), `ok` será
 * `true` aunque el consumo esté al 100%: la operación continúa y se registra como adicional.
 */
export async function checkPlanLimit(
  empresaId: string,
  limitKey: PlanLimitKey
): Promise<PlanLimitOk | PlanLimitError> {
  const resource = LEGACY_LIMIT_KEY_TO_RESOURCE[limitKey]
  const check = await checkPlanCapacity({ companyId: empresaId, resource, notify: true })

  if (check.allowed) {
    return { ok: true, planTier: check.planTier }
  }

  return {
    ok: false,
    code: 'PLAN_LIMIT_REACHED',
    message: `${check.message} Límite del plan: ${formatPlanCapacityAmount(check.limit, check.unit)}.`,
    limitKey,
    current: check.used,
    max: check.limit ?? 0,
    planTier: check.planTier,
    upgradeUrl: PLAN_CAPACITY_UPGRADE_URL,
    resource: check.resource,
    percentage: check.percentage,
    level: check.level,
    unit: check.unit,
  }
}

/** Contrato nuevo recomendado para flujos nuevos (acepta alias como 'quotations' o 'storage'). */
export async function checkPlanLimitForResource(args: {
  companyId: string
  resource: PlanCapacityResource | string
  period?: string | null
  notify?: boolean
}): Promise<PlanCapacityCheck> {
  return checkPlanCapacity({
    companyId: args.companyId,
    resource: args.resource,
    period: args.period,
    notify: args.notify,
  })
}
