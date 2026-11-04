import type { BillingCycle, ModuleKey, PlanTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getManagedPlans } from '@/lib/managed-plans'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import {
  PLAN_CAPACITY_RESOURCES,
  getPlanCapacityConfig,
  getPlanCapacityUsage,
  normalizePlanCapacityPeriod,
  normalizePlanCapacityPolicy,
  normalizePlanCapacityResource,
  type PlanCapacityOveragePolicy,
  type PlanCapacityPeriod,
  type PlanCapacityResource,
} from '@/lib/plan-capacity'
import { buildPlanModuleCatalog, CORE_MODULE_KEYS } from '@/lib/plan-catalog'
import { getPlanModulePriceMap } from '@/lib/plan-module-prices'
import { getEnabledModulesForEmpresa, getEnabledModulesForPlan } from '@/lib/plan-modules'
import {
  CAPACITY_RESOURCE_OWNER_MODULE,
  computeModuleConsumptionPricing,
  getModuleCapacityResources,
  getModulesForCapacityResource,
} from '@/lib/plan-module-consumption'

/**
 * Asignación de módulos, capacidad y cobro por consumo de una empresa (super admin).
 *
 * Modelo:
 * - **Módulos**: cada módulo se habilita/deshabilita para la empresa (`empresa_module_overrides`).
 *   Si no hay override se hereda lo que incluye el plan efectivo.
 * - **Solo módulos**: cuando `Empresa.moduleOnlyBilling` está activo no existe plan base: el
 *   plan no aporta módulos ni límites y cada módulo habilitado se factura individualmente.
 * - **Capacidad por recurso**: el consumo se mide por recurso (cotizaciones, productos, sedes,
 *   usuarios…). El límite y el precio por unidad extra se guardan en
 *   `empresa_capacity_overrides` y se facturan una sola vez por recurso.
 */

/** Etiquetas de módulos que administran consumo sin venderse individualmente. */
const NON_COMMERCIAL_MODULE_LABELS: Partial<Record<ModuleKey, string>> = {
  CONFIG: 'Configuración (sedes y usuarios)',
  DASHBOARD: 'Dashboard',
  NOTIFICACIONES: 'Notificaciones',
}

export type EmpresaModuleAssignmentRow = {
  module: ModuleKey
  nombre: string
  descripcion: string
  category: string
  priceCOP: number
  /** El plan efectivo incluye el módulo (siempre false con facturación solo módulos). */
  baseEnabled: boolean
  overrideEnabled: boolean | null
  effectiveEnabled: boolean
  includedInPlan: boolean
  /** Precio mensual facturable del módulo (0 si está incluido o deshabilitado). */
  moduleCOP: number
  /** Recursos de consumo que alimenta el módulo. */
  capacityResources: PlanCapacityResource[]
  notes: string | null
}

export type EmpresaCapacityAssignmentRow = {
  resource: PlanCapacityResource
  label: string
  shortLabel: string
  unit: string
  description: string
  /** Módulo que administra el límite y el cobro por consumo del recurso. */
  ownerModule: ModuleKey
  ownerModuleName: string
  /** Módulos que alimentan el recurso (dueño + compartidos). */
  modules: ModuleKey[]
  moduleEnabled: boolean
  shared: boolean
  planLimit: number | null
  planPolicy: PlanCapacityOveragePolicy
  planPeriod: PlanCapacityPeriod
  limitValue: number | null
  limitPeriod: PlanCapacityPeriod
  overagePolicy: PlanCapacityOveragePolicy | null
  pricePerExtraUnitCOP: number | null
  notes: string | null
  used: number
  effectiveLimit: number | null
  effectivePolicy: PlanCapacityOveragePolicy
  effectivePeriod: PlanCapacityPeriod
  extraUnits: number
  consumptionCOP: number
  configured: boolean
}

export type EmpresaModuleAssignments = {
  empresa: {
    id: string
    nombre: string
    nit: string | null
    planTier: PlanTier | null
    effectivePlanTier: PlanTier
    billingCycle: BillingCycle
    planOwnerUserId: string | null
    /** Factura “solo módulos”: no hay plan base y todo módulo habilitado se cobra. */
    moduleOnlyBilling: boolean
  }
  rows: EmpresaModuleAssignmentRow[]
  capacity: EmpresaCapacityAssignmentRow[]
  totals: {
    basePlanCOP: number
    modulesCOP: number
    consumptionCOP: number
    totalCOP: number
    includedModules: number
    extraModules: number
    consumptionResources: number
  }
}

type OverrideRow = {
  module: ModuleKey
  enabled: boolean
  limitValue: number | null
  limitPeriod: string
  overagePolicy: string | null
  pricePerExtraUnitCOP: number | null
  notes: string | null
}

type CapacityOverrideRow = {
  resource: string
  limitValue: number | null
  limitPeriod: string
  overagePolicy: string | null
  pricePerExtraUnitCOP: number | null
  notes: string | null
}

async function loadOverrides(empresaId: string): Promise<OverrideRow[]> {
  try {
    return await prisma.empresaModuleOverride.findMany({
      where: { empresaId },
      select: {
        module: true,
        enabled: true,
        limitValue: true,
        limitPeriod: true,
        overagePolicy: true,
        pricePerExtraUnitCOP: true,
        notes: true,
      },
      orderBy: { updatedAt: 'asc' },
    })
  } catch {
    return []
  }
}

/** Foto completa de módulos asignados + consumo + valores a facturar de una empresa. */
export async function getEmpresaModuleAssignments(args: {
  empresaId: string
}): Promise<EmpresaModuleAssignments | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: args.empresaId },
    select: {
      id: true,
      nombre: true,
      nit: true,
      planTier: true,
      billingCycle: true,
      planOwnerUserId: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      registrationCodeHash: true,
      moduleOnlyBilling: true,
    },
  })

  if (!empresa) return null

  const effectivePlanTier = resolveEffectivePlanTier(empresa, new Date())
  const moduleOnlyBilling = empresa.moduleOnlyBilling
  const [planModules, overrides, capacityOverrides, priceMap, capacityConfig, plans] = await Promise.all([
    getEnabledModulesForPlan(effectivePlanTier),
    loadOverrides(empresa.id),
    loadCapacityOverrides(empresa.id),
    getPlanModulePriceMap(),
    getPlanCapacityConfig(),
    getManagedPlans({ includeInactive: true }),
  ])

  const catalog = buildPlanModuleCatalog(priceMap)
  const planModuleSet = new Set(planModules)
  const overrideByModule = new Map<ModuleKey, OverrideRow>(overrides.map((row) => [row.module, row]))
  const capacityOverrideByResource = new Map<PlanCapacityResource, CapacityOverrideRow>()
  for (const row of capacityOverrides) {
    const resource = normalizePlanCapacityResource(row.resource)
    if (resource) capacityOverrideByResource.set(resource, row)
  }
  const planLimits = capacityConfig[effectivePlanTier]

  /** Módulos incluidos por el plan: con “solo módulos” el plan no aporta ninguno. */
  const baseModuleSet = moduleOnlyBilling ? new Set<ModuleKey>() : planModuleSet

  const isModuleEnabled = (module: ModuleKey): boolean => {
    const override = overrideByModule.get(module)
    if (override) return override.enabled
    if (moduleOnlyBilling) return CORE_MODULE_KEYS.includes(module)
    return planModuleSet.has(module)
  }

  const moduleName = (module: ModuleKey): string =>
    catalog.find((item) => item.module === module)?.nombre ??
    NON_COMMERCIAL_MODULE_LABELS[module] ??
    module

  const capacity: EmpresaCapacityAssignmentRow[] = []
  for (const meta of PLAN_CAPACITY_RESOURCES) {
    const resolved = planLimits[meta.resource]
    const override = capacityOverrideByResource.get(meta.resource) ?? null
    const planLimit = moduleOnlyBilling ? null : resolved.limit
    const limitValue = override?.limitValue ?? null
    const limitPeriod = normalizePlanCapacityPeriod(override?.limitPeriod ?? null) ?? resolved.period
    const overagePolicy = normalizePlanCapacityPolicy(override?.overagePolicy ?? null)
    const policy = overagePolicy ?? resolved.policy
    const ownerModule = CAPACITY_RESOURCE_OWNER_MODULE[meta.resource]
    const modules = getModulesForCapacityResource(meta.resource)
    const moduleEnabled = isModuleEnabled(ownerModule)
    const used = await getPlanCapacityUsage({ empresaId: empresa.id, resource: meta.resource, period: limitPeriod })
    const effectiveLimit = limitValue ?? planLimit
    // El consumo se factura una sola vez por recurso, y solo si su módulo está habilitado.
    const pricing = computeModuleConsumptionPricing({
      modulePriceCOP: 0,
      enabled: moduleEnabled,
      includedInPlan: true,
      includedUnits: effectiveLimit,
      usedUnits: used,
      pricePerExtraUnitCOP: override?.pricePerExtraUnitCOP ?? null,
      policy,
      period: limitPeriod,
    })

    capacity.push({
      resource: meta.resource,
      label: meta.label,
      shortLabel: meta.shortLabel,
      unit: meta.unit,
      description: meta.description,
      ownerModule,
      ownerModuleName: moduleName(ownerModule),
      modules,
      moduleEnabled,
      shared: modules.length > 1,
      planLimit,
      planPolicy: resolved.policy,
      planPeriod: resolved.period,
      limitValue,
      limitPeriod,
      overagePolicy,
      pricePerExtraUnitCOP: override?.pricePerExtraUnitCOP ?? null,
      notes: override?.notes ?? null,
      used,
      effectiveLimit,
      effectivePolicy: policy,
      effectivePeriod: limitPeriod,
      extraUnits: pricing.extraUnits,
      consumptionCOP: pricing.consumptionCOP,
      configured: Boolean(override),
    })
  }

  const rows: EmpresaModuleAssignmentRow[] = catalog.map((item) => {
    const override = overrideByModule.get(item.module) ?? null
    const baseEnabled = baseModuleSet.has(item.module)
    const effectiveEnabled = isModuleEnabled(item.module)
    const includedInPlan = baseEnabled
    // Con “solo módulos” todo lo habilitado se factura, aunque el tier lo incluya.
    const moduleCOP = effectiveEnabled && !includedInPlan
      ? Math.max(0, Math.round(item.activationPriceMonthlyCOP))
      : 0

    return {
      module: item.module,
      nombre: item.nombre,
      descripcion: item.descripcion,
      category: item.category,
      priceCOP: item.activationPriceMonthlyCOP,
      baseEnabled,
      overrideEnabled: override ? override.enabled : null,
      effectiveEnabled,
      includedInPlan,
      moduleCOP,
      capacityResources: getModuleCapacityResources(item.module),
      notes: override?.notes ?? null,
    }
  })

  const basePlan = plans.find((plan) => plan.tier === effectivePlanTier)
  const basePlanCOP = moduleOnlyBilling ? 0 : basePlan?.precioMensualCOP ?? 0
  const modulesCOP = rows.reduce((sum, row) => sum + row.moduleCOP, 0)
  const consumptionCOP = capacity.reduce((sum, row) => sum + row.consumptionCOP, 0)

  return {
    empresa: {
      id: empresa.id,
      nombre: empresa.nombre,
      nit: empresa.nit ?? null,
      planTier: empresa.planTier,
      effectivePlanTier,
      billingCycle: empresa.billingCycle,
      planOwnerUserId: empresa.planOwnerUserId ?? null,
      moduleOnlyBilling,
    },
    rows,
    capacity,
    totals: {
      basePlanCOP,
      modulesCOP,
      consumptionCOP,
      totalCOP: basePlanCOP + modulesCOP + consumptionCOP,
      includedModules: rows.filter((row) => row.includedInPlan && row.effectiveEnabled).length,
      extraModules: rows.filter((row) => !row.includedInPlan && row.effectiveEnabled).length,
      consumptionResources: capacity.filter((row) => row.consumptionCOP > 0).length,
    },
  }
}

async function loadCapacityOverrides(empresaId: string): Promise<CapacityOverrideRow[]> {
  try {
    return await prisma.empresaCapacityOverride.findMany({
      where: { empresaId },
      select: {
        resource: true,
        limitValue: true,
        limitPeriod: true,
        overagePolicy: true,
        pricePerExtraUnitCOP: true,
        notes: true,
      },
      orderBy: { updatedAt: 'asc' },
    })
  } catch {
    return []
  }
}

/**
 * Módulo “dueño” del recurso de consumo que administra el módulo indicado.
 * Se mantiene por compatibilidad con la API anterior (un módulo, un recurso).
 */
export function getAssignmentCapacityOwner(module: ModuleKey): PlanCapacityResource | null {
  return getModuleCapacityResources(module)[0] ?? null
}

/** Normaliza un entero opcional: `undefined` = no tocar, `null` = limpiar. */
function normalizeOptionalInt(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

export type ModuleAssignmentPatch = {
  empresaId: string
  module: ModuleKey
  enabled?: boolean | null
  limitValue?: number | null
  limitPeriod?: string | null
  overagePolicy?: string | null
  pricePerExtraUnitCOP?: number | null
  notes?: string | null
  reset?: boolean
}

/**
 * Guarda (o borra con `reset`) la asignación de un módulo a una empresa.
 *
 * `enabled` se guarda tal cual; si no se envía se conserva el valor actual y, cuando el
 * módulo nunca se ha tocado, se parte de lo que incluye el plan efectivo (con facturación
 * “solo módulos” el punto de partida es deshabilitado).
 *
 * Los campos de límite/consumo se mantienen por compatibilidad; la configuración vigente se
 * edita por recurso con `saveEmpresaCapacityAssignment`.
 */
export async function saveEmpresaModuleAssignment(args: ModuleAssignmentPatch): Promise<void> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: args.empresaId },
    select: {
      planTier: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      nit: true,
      registrationCodeHash: true,
      moduleOnlyBilling: true,
    },
  })

  if (!empresa) throw new Error('EMPRESA_NOT_FOUND')

  if (args.reset) {
    await prisma.empresaModuleOverride.deleteMany({
      where: { empresaId: args.empresaId, module: args.module },
    })
    return
  }

  const existing = await prisma.empresaModuleOverride.findUnique({
    where: { empresaId_module: { empresaId: args.empresaId, module: args.module } },
    select: { enabled: true },
  })

  let enabled = typeof args.enabled === 'boolean' ? args.enabled : existing?.enabled

  if (typeof enabled !== 'boolean') {
    if (empresa.moduleOnlyBilling) {
      enabled = false
    } else {
      const effectivePlanTier = resolveEffectivePlanTier(empresa, new Date())
      const baseModules = await getEnabledModulesForPlan(effectivePlanTier)
      enabled = baseModules.includes(args.module)
    }
  }

  const limitValue = normalizeOptionalInt(args.limitValue)
  const pricePerExtraUnitCOP = normalizeOptionalInt(args.pricePerExtraUnitCOP)
  const limitPeriod = normalizePlanCapacityPeriod(args.limitPeriod ?? null)
  const overagePolicy = normalizePlanCapacityPolicy(args.overagePolicy ?? null)

  const changes = {
    ...(limitValue !== undefined ? { limitValue } : {}),
    ...(limitPeriod ? { limitPeriod } : {}),
    ...(overagePolicy ? { overagePolicy } : {}),
    ...(pricePerExtraUnitCOP !== undefined ? { pricePerExtraUnitCOP } : {}),
    ...(args.notes !== undefined ? { notes: args.notes } : {}),
  }

  await prisma.empresaModuleOverride.upsert({
    where: { empresaId_module: { empresaId: args.empresaId, module: args.module } },
    create: { empresaId: args.empresaId, module: args.module, enabled, ...changes },
    update: { enabled, ...changes },
  })
}

export type CapacityAssignmentPatch = {
  empresaId: string
  resource: string
  limitValue?: number | null
  limitPeriod?: string | null
  overagePolicy?: string | null
  pricePerExtraUnitCOP?: number | null
  notes?: string | null
  reset?: boolean
}

/**
 * Guarda (o borra con `reset`) el límite y el cobro por consumo de un recurso.
 *
 * Aplica a cualquier recurso medible, incluidos **sedes** y **usuarios** (que administra el
 * módulo CONFIG). `limitValue: null` deja el recurso regido por el plan efectivo; el precio
 * por unidad extra solo se factura cuando la política es OVERAGE.
 */
export async function saveEmpresaCapacityAssignment(
  args: CapacityAssignmentPatch
): Promise<PlanCapacityResource> {
  const resource = normalizePlanCapacityResource(args.resource)
  if (!resource) throw new Error('RESOURCE_NOT_FOUND')

  const empresa = await prisma.empresa.findUnique({
    where: { id: args.empresaId },
    select: { id: true },
  })
  if (!empresa) throw new Error('EMPRESA_NOT_FOUND')

  if (args.reset) {
    await prisma.empresaCapacityOverride.deleteMany({ where: { empresaId: args.empresaId, resource } })
    return resource
  }

  const limitValue = normalizeOptionalInt(args.limitValue)
  const pricePerExtraUnitCOP = normalizeOptionalInt(args.pricePerExtraUnitCOP)
  const limitPeriod = normalizePlanCapacityPeriod(args.limitPeriod ?? null)
  const overagePolicy = normalizePlanCapacityPolicy(args.overagePolicy ?? null)

  const changes = {
    ...(limitValue !== undefined ? { limitValue } : {}),
    ...(limitPeriod ? { limitPeriod } : {}),
    ...(overagePolicy ? { overagePolicy } : {}),
    ...(pricePerExtraUnitCOP !== undefined ? { pricePerExtraUnitCOP } : {}),
    ...(args.notes !== undefined ? { notes: args.notes } : {}),
  }

  await prisma.empresaCapacityOverride.upsert({
    where: { empresaId_resource: { empresaId: args.empresaId, resource } },
    create: { empresaId: args.empresaId, resource, ...changes },
    update: changes,
  })

  return resource
}

/**
 * Activa o desactiva la facturación “solo módulos” de una empresa.
 *
 * Al activarla no se cobra plan base y los módulos que el plan incluía pasan a facturarse
 * individualmente. Para no dejar al cliente sin acceso, los módulos que tenía habilitados se
 * convierten en asignaciones explícitas (los módulos base no facturables siguen vigentes).
 * Al desactivarla la empresa vuelve a heredar módulos y límites del plan efectivo.
 */
export async function saveEmpresaBillingMode(args: {
  empresaId: string
  moduleOnlyBilling: boolean
}): Promise<void> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: args.empresaId },
    select: {
      id: true,
      nit: true,
      registrationCodeHash: true,
      planTier: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      moduleOnlyBilling: true,
    },
  })
  if (!empresa) throw new Error('EMPRESA_NOT_FOUND')

  if (args.moduleOnlyBilling && !empresa.moduleOnlyBilling) {
    const effectivePlanTier = resolveEffectivePlanTier(empresa, new Date())
    const [currentModules, overrides] = await Promise.all([
      getEnabledModulesForEmpresa({ empresaId: args.empresaId, planTier: effectivePlanTier }),
      loadOverrides(args.empresaId),
    ])
    const overriddenModules = new Set<ModuleKey>(overrides.map((row) => row.module))
    const missing = currentModules.filter((module) => !overriddenModules.has(module))

    if (missing.length) {
      await prisma.$transaction(
        missing.map((module) =>
          prisma.empresaModuleOverride.create({
            data: { empresaId: args.empresaId, module, enabled: true },
          })
        )
      )
    }
  }

  await prisma.empresa.update({
    where: { id: args.empresaId },
    data: { moduleOnlyBilling: args.moduleOnlyBilling },
  })
}




