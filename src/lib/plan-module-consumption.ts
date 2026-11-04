import type { ModuleKey } from '@prisma/client'
import {
  PLAN_CAPACITY_RESOURCES,
  type PlanCapacityOveragePolicy,
  type PlanCapacityPeriod,
  type PlanCapacityResourceMeta,
} from '@/lib/plan-capacity'
import {
  CAPACITY_RESOURCE_OWNER_MODULE,
  MODULE_CAPACITY_RESOURCES,
  getModuleCapacityResource,
  getModuleCapacityResources,
  getModulesForCapacityResource,
  isCapacityResourceOwner,
} from '@/lib/plan-capacity-resource-map'

/**
 * Consumo y cobro por módulo (adicionales opcionales).
 *
 * Los límites de capacidad de la plataforma se miden por **recurso** (cotizaciones, clientes,
 * productos, sedes, usuarios…). Varios módulos comerciales pueden alimentar el mismo recurso:
 * por eso cada recurso tiene un módulo “dueño” que es el único que edita el límite y el
 * precio por unidad extra, y el resto de módulos del mismo recurso solo muestran el consumo
 * compartido. Un módulo puede administrar más de un recurso (CONFIG → sedes y usuarios).
 */

export {
  CAPACITY_RESOURCE_OWNER_MODULE,
  MODULE_CAPACITY_RESOURCES,
  getModuleCapacityResource,
  getModuleCapacityResources,
  getModulesForCapacityResource,
  isCapacityResourceOwner,
}

export function getModuleCapacityResourceMeta(module: ModuleKey): PlanCapacityResourceMeta | null {
  const resource = getModuleCapacityResource(module)
  if (!resource) return null
  return PLAN_CAPACITY_RESOURCES.find((meta) => meta.resource === resource) ?? null
}

export type ModuleConsumptionPricing = {
  moduleCOP: number
  includedUnits: number | null
  usedUnits: number
  extraUnits: number
  consumptionCOP: number
  totalCOP: number
}

/**
 * Calcula el valor a facturar de un módulo:
 * precio mensual del módulo (si es adicional al plan) + unidades extra consumidas sobre el
 * límite incluido (solo cuando la política permite excedente `OVERAGE`).
 */
export function computeModuleConsumptionPricing(args: {
  modulePriceCOP: number
  enabled: boolean
  includedInPlan: boolean
  includedUnits: number | null
  usedUnits: number
  pricePerExtraUnitCOP: number | null
  policy: PlanCapacityOveragePolicy
  period?: PlanCapacityPeriod | null
}): ModuleConsumptionPricing {
  const moduleCOP = args.enabled && !args.includedInPlan ? Math.max(0, Math.round(args.modulePriceCOP)) : 0
  const includedUnits = args.includedUnits

  if (!args.enabled || includedUnits === null) {
    return {
      moduleCOP,
      includedUnits,
      usedUnits: args.usedUnits,
      extraUnits: 0,
      consumptionCOP: 0,
      totalCOP: moduleCOP,
    }
  }

  const rawExtra = Math.max(0, args.usedUnits - includedUnits)
  const extraUnits = Math.ceil(rawExtra)
  const chargeable = args.policy === 'OVERAGE' && extraUnits > 0 && (args.pricePerExtraUnitCOP ?? 0) > 0
  const consumptionCOP = chargeable ? extraUnits * Math.max(0, Math.round(args.pricePerExtraUnitCOP ?? 0)) : 0

  return {
    moduleCOP,
    includedUnits,
    usedUnits: args.usedUnits,
    extraUnits,
    consumptionCOP,
    totalCOP: moduleCOP + consumptionCOP,
  }
}
