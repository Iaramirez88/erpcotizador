import { prisma } from '@/lib/prisma'
import type { ModuleKey, PlanTier } from '@prisma/client'

export const ALL_MODULE_KEYS: ModuleKey[] = [
  'DASHBOARD',
  'COTIZADOR',
  'COTIZACIONES',
  'CLIENTES',
  'CRM',
  'MATERIALES',
  'INVENTARIO',
  'REMISIONES',
  'POS',
  'PROVEEDORES',
  'COMPRAS',
  'ORDENES',
  'ESCANEOS',
  'REPORTES',
  'CONTABILIDAD',
  'NOTIFICACIONES',
  'CONFIG',
]

export const ALL_PLAN_TIERS: PlanTier[] = ['CRM', 'BASIC', 'MEDIO', 'INTERMEDIO', 'FULL']

const DEFAULT_ENABLED_MODULES: Record<PlanTier, ModuleKey[]> = {
  CRM: ['DASHBOARD', 'CRM', 'NOTIFICACIONES', 'CONFIG'],
  BASIC: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'REMISIONES', 'ORDENES', 'ESCANEOS', 'REPORTES', 'NOTIFICACIONES', 'CONFIG'],
  MEDIO: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'INVENTARIO', 'REMISIONES', 'POS', 'PROVEEDORES', 'COMPRAS', 'ORDENES', 'ESCANEOS', 'REPORTES', 'NOTIFICACIONES', 'CONFIG'],
  INTERMEDIO: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'INVENTARIO', 'REMISIONES', 'POS', 'PROVEEDORES', 'COMPRAS', 'ORDENES', 'ESCANEOS', 'REPORTES', 'CONTABILIDAD', 'NOTIFICACIONES', 'CONFIG'],
  FULL: [...ALL_MODULE_KEYS],
}

export function getDefaultEnabledModulesForPlan(planTier: PlanTier): ModuleKey[] {
  return [...(DEFAULT_ENABLED_MODULES[planTier] ?? ALL_MODULE_KEYS)]
}

export async function ensurePlanModuleDefaults(): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const planTier of ALL_PLAN_TIERS) {
        for (const moduleKey of ALL_MODULE_KEYS) {
          const enabled = getDefaultEnabledModulesForPlan(planTier).includes(moduleKey)
          await tx.planModuleSetting.upsert({
            where: { planTier_module: { planTier, module: moduleKey } },
            create: { planTier, module: moduleKey, enabled },
            update: {},
            select: { id: true },
          })
        }
      }
    })
  } catch {
    // Si aún no existe la tabla (migración pendiente), no romper la app.
  }
}

// Excepción: en BASIC, Litografía, Escaneos y Terminados siempre habilitados
export async function isModuleEnabledForPlan(args: { planTier: PlanTier; module: ModuleKey }): Promise<boolean> {
  if (
    args.planTier === 'BASIC' &&
    (args.module === 'COTIZADOR' || args.module === 'ESCANEOS' || args.module === 'MATERIALES')
  ) {
    // NOTA: 'COTIZADOR' se usa para Litografía, 'ESCANEOS' y 'MATERIALES' para Terminados
    return true
  }
  try {
    const setting = await prisma.planModuleSetting.findUnique({
      where: { planTier_module: { planTier: args.planTier, module: args.module } },
      select: { enabled: true },
    })
    return setting?.enabled ?? true
  } catch {
    return true
  }
}

export async function isModuleEnabledForEmpresa(args: { empresaId: string; module: ModuleKey }): Promise<boolean> {
  const [empresa, override] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: args.empresaId },
      select: { planTier: true },
    }),
    prisma.empresaModuleOverride.findUnique({
      where: { empresaId_module: { empresaId: args.empresaId, module: args.module } },
      select: { enabled: true },
    }).catch(() => null),
  ])

  if (typeof override?.enabled === 'boolean') return override.enabled

  if (!empresa?.planTier) return true

  return isModuleEnabledForPlan({ planTier: empresa.planTier, module: args.module })
}

export async function getModuleOverridesForEmpresa(empresaId: string): Promise<Partial<Record<ModuleKey, boolean>>> {
  try {
    const rows = await prisma.empresaModuleOverride.findMany({
      where: { empresaId },
      select: { module: true, enabled: true },
      orderBy: { module: 'asc' },
    })

    return rows.reduce<Partial<Record<ModuleKey, boolean>>>((acc, row) => {
      acc[row.module] = row.enabled
      return acc
    }, {})
  } catch {
    return {}
  }
}

export async function getEnabledModulesForEmpresa(args: { empresaId: string; planTier: PlanTier }): Promise<ModuleKey[]> {
  const baseModules = await getEnabledModulesForPlan(args.planTier)

  try {
    const overrides = await prisma.empresaModuleOverride.findMany({
      where: { empresaId: args.empresaId },
      select: { module: true, enabled: true },
    })

    if (!overrides.length) return baseModules

    const enabled = new Set(baseModules)
    for (const override of overrides) {
      if (override.enabled) enabled.add(override.module)
      else enabled.delete(override.module)
    }

    return ALL_MODULE_KEYS.filter((moduleKey) => enabled.has(moduleKey))
  } catch {
    return baseModules
  }
}

export async function saveEmpresaModuleOverride(args: { empresaId: string; module: ModuleKey; enabled: boolean | null }): Promise<void> {
  if (args.enabled == null) {
    await prisma.empresaModuleOverride.deleteMany({
      where: { empresaId: args.empresaId, module: args.module },
    })
    return
  }

  await prisma.empresaModuleOverride.upsert({
    where: { empresaId_module: { empresaId: args.empresaId, module: args.module } },
    create: { empresaId: args.empresaId, module: args.module, enabled: args.enabled },
    update: { enabled: args.enabled },
  })
}

export async function getEnabledModulesForPlan(planTier: PlanTier): Promise<ModuleKey[]> {
  try {
    const rows = await prisma.planModuleSetting.findMany({
      where: { planTier, enabled: true },
      select: { module: true },
      orderBy: { module: 'asc' },
    })

    if (!rows.length) {
      return getDefaultEnabledModulesForPlan(planTier)
    }

    return rows.map((r) => r.module)
  } catch {
    return getDefaultEnabledModulesForPlan(planTier)
  }
}
