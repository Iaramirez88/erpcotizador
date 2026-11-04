import { prisma } from '@/lib/prisma'
import type { ModuleKey, PlanTier } from '@prisma/client'
import { ALL_MODULE_KEYS, ALL_PLAN_TIERS, CORE_MODULE_KEYS, getDefaultEnabledModulesForPlan } from '@/lib/plan-catalog'

export { ALL_MODULE_KEYS, ALL_PLAN_TIERS, CORE_MODULE_KEYS, getDefaultEnabledModulesForPlan }

/**
 * Cobertura de módulos por plan.
 *
 * La matriz `plan_module_settings` se retiró: **todos los planes incluyen todos los módulos** y
 * la diferenciación comercial vive en la capacidad/consumo (`plan_limit_settings`). Las únicas
 * restricciones de módulos son por empresa (`empresa_module_overrides`).
 */
export async function isModuleEnabledForPlan(args: { planTier: PlanTier; module: ModuleKey }): Promise<boolean> {
  void args.planTier
  void args.module
  return true
}


export async function isModuleEnabledForEmpresa(args: { empresaId: string; module: ModuleKey }): Promise<boolean> {
  const [empresa, override] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: args.empresaId },
      select: { planTier: true, moduleOnlyBilling: true },
    }),
    prisma.empresaModuleOverride.findUnique({
      where: { empresaId_module: { empresaId: args.empresaId, module: args.module } },
      select: { enabled: true },
    }).catch(() => null),
  ])

  if (typeof override?.enabled === 'boolean') return override.enabled

  // Facturación “solo módulos”: sin asignación explícita el módulo no está contratado,
  // salvo los módulos base (panel, avisos y configuración), que no se cobran.
  if (empresa?.moduleOnlyBilling) return CORE_MODULE_KEYS.includes(args.module)

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

/**
 * Módulos habilitados de una empresa.
 *
 * Con facturación “solo módulos” (`moduleOnlyBilling`) el plan no aporta módulos: únicamente
 * cuentan las asignaciones explícitas hechas desde super admin.
 */
export async function getEnabledModulesForEmpresa(args: {
  empresaId: string
  planTier: PlanTier
  /** Evita la consulta extra cuando el llamador ya leyó la empresa. */
  moduleOnlyBilling?: boolean
}): Promise<ModuleKey[]> {
  const moduleOnlyBilling =
    args.moduleOnlyBilling ??
    (await prisma.empresa
      .findUnique({ where: { id: args.empresaId }, select: { moduleOnlyBilling: true } })
      .then((row) => row?.moduleOnlyBilling ?? false)
      .catch(() => false))

  let overrides: Array<{ module: ModuleKey; enabled: boolean }> = []

  try {
    overrides = await prisma.empresaModuleOverride.findMany({
      where: { empresaId: args.empresaId },
      select: { module: true, enabled: true },
    })
  } catch {
    // Tabla sin migrar: se cae al plan (o a los módulos base si factura solo módulos).
    return moduleOnlyBilling ? [...CORE_MODULE_KEYS] : [...ALL_MODULE_KEYS]
  }

  if (moduleOnlyBilling) {
    // Sin plan base: cuentan las asignaciones explícitas + los módulos base (no facturables).
    const enabled = new Set<ModuleKey>(CORE_MODULE_KEYS)
    for (const override of overrides) {
      if (override.enabled) enabled.add(override.module)
    }
    for (const override of overrides) {
      if (!override.enabled) enabled.delete(override.module)
    }
    return ALL_MODULE_KEYS.filter((moduleKey) => enabled.has(moduleKey))
  }

  const baseModules = await getEnabledModulesForPlan(args.planTier)

  if (!overrides.length) return baseModules

  const enabled = new Set(baseModules)
  for (const override of overrides) {
    if (override.enabled) enabled.add(override.module)
    else enabled.delete(override.module)
  }

  return ALL_MODULE_KEYS.filter((moduleKey) => enabled.has(moduleKey))
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
  void planTier
  return [...ALL_MODULE_KEYS]
}
