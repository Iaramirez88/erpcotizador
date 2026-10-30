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

async function getCurrentPlanLimitValue(empresaId: string, limitKey: PlanLimitKey): Promise<number> {
  const now = new Date()
  const { from, to } = monthRange(now)

  switch (limitKey) {
    case 'COTIZACIONES_PER_MONTH':
      return prisma.cotizacion.count({
        where: { cliente: { empresaId }, createdAt: { gte: from, lt: to } },
      })
    case 'ORDENES_PER_MONTH':
      return prisma.ordenTrabajo.count({
        where: { cliente: { empresaId }, createdAt: { gte: from, lt: to } },
      })
    case 'REMISIONES_PER_MONTH':
      return prisma.remision.count({
        where: { empresaId, createdAt: { gte: from, lt: to } },
      })
    case 'PRODUCTOS_MAX':
      return prisma.material.count({ where: { empresaId, activo: true } })
    case 'CLIENTES_MAX':
      return prisma.cliente.count({ where: { empresaId } })
    case 'PROVEEDORES_MAX':
      return prisma.proveedor.count({ where: { empresaId, activo: true } })
    case 'SEDES_MAX':
      return prisma.sede.count({ where: { empresaId } })
    case 'USUARIOS_MAX': {
      const memberships = await prisma.sedeMembership.findMany({
        where: { sede: { empresaId } },
        select: { userId: true },
      })
      return new Set(memberships.map((m) => m.userId)).size
    }
    default:
      return 0
  }
}

export type PlanUsageMeter = {
  key: PlanLimitKey
  label: string
  current: number
  max: number | null
  unit: string
  monthly: boolean
}

export type PlanUsageSummary = {
  planTier: PlanTier
  meters: PlanUsageMeter[]
}

const PLAN_LIMIT_META: Array<{ key: PlanLimitKey; label: string; unit: string; monthly: boolean }> = [
  { key: 'USUARIOS_MAX', label: 'Usuarios', unit: '', monthly: false },
  { key: 'SEDES_MAX', label: 'Sedes', unit: '', monthly: false },
  { key: 'CLIENTES_MAX', label: 'Clientes', unit: '', monthly: false },
  { key: 'PRODUCTOS_MAX', label: 'Productos', unit: '', monthly: false },
  { key: 'PROVEEDORES_MAX', label: 'Proveedores', unit: '', monthly: false },
  { key: 'COTIZACIONES_PER_MONTH', label: 'Cotizaciones (mes)', unit: '', monthly: true },
  { key: 'ORDENES_PER_MONTH', label: 'Órdenes de trabajo (mes)', unit: '', monthly: true },
  { key: 'REMISIONES_PER_MONTH', label: 'Remisiones (mes)', unit: '', monthly: true },
]

export async function getPlanUsageSummary(empresaId: string): Promise<PlanUsageSummary> {
  const empresa = await getEmpresaPlanContext(empresaId)
  const planTier = empresa ? resolveEffectivePlanTier(empresa, new Date()) : 'FULL'
  const limits = getLimitsForTier(planTier)

  const meters = await Promise.all(PLAN_LIMIT_META.map(async (meta) => {
    const max = limits[meta.key] ?? null
    const current = max ? await getCurrentPlanLimitValue(empresaId, meta.key) : 0
    return { key: meta.key, label: meta.label, current, max, unit: meta.unit, monthly: meta.monthly }
  }))

  return { planTier, meters }
}

export async function checkPlanLimit(empresaId: string, limitKey: PlanLimitKey): Promise<PlanLimitOk | PlanLimitError> {
  const empresa = await getEmpresaPlanContext(empresaId)
  const planTier = empresa ? resolveEffectivePlanTier(empresa, new Date()) : 'FULL'
  const limits = getLimitsForTier(planTier)

  const max = limits[limitKey]
  if (!max) return { ok: true, planTier }

  const current = await getCurrentPlanLimitValue(empresaId, limitKey)

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
