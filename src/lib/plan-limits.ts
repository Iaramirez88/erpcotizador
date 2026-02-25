import { prisma } from '@/lib/prisma'
import type { PlanTier } from '@prisma/client'
import { resolveEffectivePlanTier, type EmpresaPlanContext } from '@/lib/plan-access'

export type PlanLimitKey =
  | 'COTIZACIONES_PER_MONTH'
  | 'ORDENES_PER_MONTH'
  | 'REMISIONES_PER_MONTH'
  | 'PRODUCTOS_MAX'
  | 'CLIENTES_MAX'
  | 'PROVEEDORES_MAX'
  | 'SEDES_MAX'
  | 'USUARIOS_MAX'

export type PlanLimitError = {
  ok: false
  code: 'PLAN_LIMIT_REACHED'
  message: string
  limitKey: PlanLimitKey
  current: number
  max: number
  planTier: PlanTier
  upgradeUrl: '/dashboard/configuracion/plan'
}

export type PlanLimitOk = { ok: true; planTier: PlanTier }

type Limits = Partial<Record<PlanLimitKey, number>>

function monthRange(now: Date): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from, to }
}

function getLimitsForTier(tier: PlanTier): Limits {
  if (tier === 'FULL') return {}

  if (tier === 'INTERMEDIO' || tier === 'MEDIO') {
    return {
      SEDES_MAX: 6,
      USUARIOS_MAX: 10,
      CLIENTES_MAX: 8000,
      COTIZACIONES_PER_MONTH: 5000,
    }
  }

  // BASIC
  return {
    // límites mensuales
    COTIZACIONES_PER_MONTH: 300,
    REMISIONES_PER_MONTH: 100,
    ORDENES_PER_MONTH: 100,
    // límites de catálogo/config
    PROVEEDORES_MAX: 50,
    CLIENTES_MAX: 500,
    PRODUCTOS_MAX: 200,
    SEDES_MAX: 1,
    USUARIOS_MAX: 2,
  }
}

async function getEmpresaPlanContext(empresaId: string): Promise<EmpresaPlanContext | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      nit: true,
      registrationCodeHash: true,
      planTier: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
    },
  })

  if (!empresa) return null

  return {
    nit: empresa.nit ?? '',
    registrationCodeHash: empresa.registrationCodeHash ?? null,
    planTier: empresa.planTier,
    planValidUntil: empresa.planValidUntil,
    trialTier: empresa.trialTier,
    trialStartedAt: empresa.trialStartedAt,
    trialValidUntil: empresa.trialValidUntil,
  }
}

export async function checkPlanLimit(empresaId: string, limitKey: PlanLimitKey): Promise<PlanLimitOk | PlanLimitError> {
  const empresa = await getEmpresaPlanContext(empresaId)
  const planTier = empresa ? resolveEffectivePlanTier(empresa, new Date()) : 'FULL'
  const limits = getLimitsForTier(planTier)

  const max = limits[limitKey]
  if (!max) return { ok: true, planTier }

  const now = new Date()
  const { from, to } = monthRange(now)

  let current = 0

  switch (limitKey) {
    case 'COTIZACIONES_PER_MONTH':
      current = await prisma.cotizacion.count({
        where: { cliente: { empresaId }, createdAt: { gte: from, lt: to } },
      })
      break
    case 'ORDENES_PER_MONTH':
      current = await prisma.ordenTrabajo.count({
        where: { cliente: { empresaId }, createdAt: { gte: from, lt: to } },
      })
      break
    case 'REMISIONES_PER_MONTH':
      current = await prisma.remision.count({
        where: { empresaId, createdAt: { gte: from, lt: to } },
      })
      break
    case 'PRODUCTOS_MAX':
      current = await prisma.material.count({ where: { empresaId, activo: true } })
      break
    case 'CLIENTES_MAX':
      current = await prisma.cliente.count({ where: { empresaId } })
      break
    case 'PROVEEDORES_MAX':
      current = await prisma.proveedor.count({ where: { empresaId, activo: true } })
      break
    case 'SEDES_MAX':
      current = await prisma.sede.count({ where: { empresaId } })
      break
    case 'USUARIOS_MAX': {
      const memberships = await prisma.sedeMembership.findMany({
        where: { sede: { empresaId } },
        select: { userId: true },
      })
      current = new Set(memberships.map((m) => m.userId)).size
      break
    }
    default:
      current = 0
  }

  if (current >= max) {
    return {
      ok: false,
      code: 'PLAN_LIMIT_REACHED',
      message: 'Has alcanzado el límite de tu plan. Mejora tu plan para continuar.',
      limitKey,
      current,
      max,
      planTier,
      upgradeUrl: '/dashboard/configuracion/plan',
    }
  }

  return { ok: true, planTier }
}
