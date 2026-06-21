import { ANNUAL_DISCOUNT_PCT, type BillingCycle } from '@/lib/plans'
import { HR_PLAN_PARENT, HR_PLAN_SUBMODULES } from '@/lib/hr-plan-catalog'
import { SYSTEM_SUITE_GLOBAL, SYSTEM_SUITE_PARENTS } from '@/lib/system-suite-catalog'

export type CommercialPriceCatalogItem = {
  code: string
  title: string
  category: 'SUITE_GLOBAL' | 'SUITE_PARENT' | 'SUITE_SUBMODULE' | 'HR_PARENT' | 'HR_SUBMODULE'
  description: string
  defaultPriceCOP: number
}

export type CommercialPriceMap = Record<string, number>

export type CommercialSegmentRow = {
  segment: string
  employeesRange: string
  activeUsersRange: string
  recommendedMotion: string
  monthlyFromCOP: number
  monthlyToCOP: number | null
  note: string
}

export const COMMERCIAL_PRICE_CATALOG: CommercialPriceCatalogItem[] = [
  {
    code: SYSTEM_SUITE_GLOBAL.code,
    title: SYSTEM_SUITE_GLOBAL.title,
    category: 'SUITE_GLOBAL' as const,
    description: SYSTEM_SUITE_GLOBAL.description,
    defaultPriceCOP: SYSTEM_SUITE_GLOBAL.monthlyPriceCOP,
  },
  ...SYSTEM_SUITE_PARENTS.flatMap((parent) => [
    {
      code: parent.code,
      title: parent.title,
      category: 'SUITE_PARENT' as const,
      description: parent.description,
      defaultPriceCOP: parent.monthlyBundlePriceCOP,
    },
    ...parent.submodules.map((submodule) => ({
      code: submodule.code,
      title: submodule.title,
      category: 'SUITE_SUBMODULE' as const,
      description: submodule.description,
      defaultPriceCOP: submodule.monthlyPriceCOP,
    })),
  ]),
  {
    code: HR_PLAN_PARENT.code,
    title: HR_PLAN_PARENT.title,
    category: 'HR_PARENT' as const,
    description: HR_PLAN_PARENT.description,
    defaultPriceCOP: HR_PLAN_PARENT.monthlyPriceCOP,
  },
  ...HR_PLAN_SUBMODULES.map((submodule) => ({
    code: submodule.code,
    title: submodule.title,
    category: 'HR_SUBMODULE' as const,
    description: submodule.description,
    defaultPriceCOP: submodule.monthlyPriceCOP,
  })),
].filter((item, index, array) => array.findIndex((candidate) => candidate.code === item.code) === index)

export function getDefaultCommercialPriceMap(): CommercialPriceMap {
  return Object.fromEntries(COMMERCIAL_PRICE_CATALOG.map((item) => [item.code, item.defaultPriceCOP]))
}

export function buildCommercialPricingSnapshot(priceMap?: Partial<CommercialPriceMap>) {
  const mergedPriceMap = { ...getDefaultCommercialPriceMap(), ...(priceMap ?? {}) }

  const hrParent = {
    ...HR_PLAN_PARENT,
    monthlyPriceCOP: mergedPriceMap[HR_PLAN_PARENT.code] ?? HR_PLAN_PARENT.monthlyPriceCOP,
  }
  const hrSubmodules = HR_PLAN_SUBMODULES.map((item) => ({
    ...item,
    monthlyPriceCOP: mergedPriceMap[item.code] ?? item.monthlyPriceCOP,
  }))

  const systemSuiteGlobal = {
    ...SYSTEM_SUITE_GLOBAL,
    monthlyPriceCOP: mergedPriceMap[SYSTEM_SUITE_GLOBAL.code] ?? SYSTEM_SUITE_GLOBAL.monthlyPriceCOP,
  }
  const systemSuiteParents = SYSTEM_SUITE_PARENTS.map((parent) => ({
    ...parent,
    monthlyBundlePriceCOP: mergedPriceMap[parent.code] ?? parent.monthlyBundlePriceCOP,
    submodules: parent.submodules.map((item) => ({
      ...item,
      monthlyPriceCOP: mergedPriceMap[item.code] ?? item.monthlyPriceCOP,
    })),
  }))

  return {
    mergedPriceMap,
    hrParent,
    hrSubmodules,
    systemSuiteGlobal,
    systemSuiteParents,
  }
}

export function getHrPlanPricingSummaryFromCatalog(
  hrParent: { monthlyPriceCOP: number },
  hrSubmodules: Array<{ monthlyPriceCOP: number }>,
  cycle: BillingCycle,
) {
  const modulesSubtotalMonthlyCOP = hrSubmodules.reduce((sum, item) => sum + item.monthlyPriceCOP, 0)
  const bundleMonthlyCOP = hrParent.monthlyPriceCOP
  const monthlySavingsCOP = Math.max(0, modulesSubtotalMonthlyCOP - bundleMonthlyCOP)

  if (cycle === 'MONTHLY') {
    return {
      modulesSubtotalMonthlyCOP,
      bundleMonthlyCOP,
      monthlySavingsCOP,
      modulesSubtotalCOP: modulesSubtotalMonthlyCOP,
      bundleTotalCOP: bundleMonthlyCOP,
      savingsCOP: monthlySavingsCOP,
      annualDiscountPct: 0,
    }
  }

  const modulesSubtotalCOP = Math.round(modulesSubtotalMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const bundleTotalCOP = Math.round(bundleMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const savingsCOP = Math.max(0, modulesSubtotalCOP - bundleTotalCOP)

  return {
    modulesSubtotalMonthlyCOP,
    bundleMonthlyCOP,
    monthlySavingsCOP,
    modulesSubtotalCOP,
    bundleTotalCOP,
    savingsCOP,
    annualDiscountPct: ANNUAL_DISCOUNT_PCT,
  }
}

export function getSystemSuitePricingSummaryFromCatalog(
  systemSuiteGlobal: { monthlyPriceCOP: number },
  systemSuiteParents: Array<{ monthlyBundlePriceCOP: number }>,
  cycle: BillingCycle,
) {
  const parentsSubtotalMonthlyCOP = systemSuiteParents.reduce((sum, item) => sum + item.monthlyBundlePriceCOP, 0)
  const suiteMonthlyCOP = systemSuiteGlobal.monthlyPriceCOP
  const monthlySavingsCOP = Math.max(0, parentsSubtotalMonthlyCOP - suiteMonthlyCOP)

  if (cycle === 'MONTHLY') {
    return {
      parentsSubtotalMonthlyCOP,
      suiteMonthlyCOP,
      monthlySavingsCOP,
      parentsSubtotalCOP: parentsSubtotalMonthlyCOP,
      suiteTotalCOP: suiteMonthlyCOP,
      savingsCOP: monthlySavingsCOP,
      annualDiscountPct: 0,
    }
  }

  const parentsSubtotalCOP = Math.round(parentsSubtotalMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const suiteTotalCOP = Math.round(suiteMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const savingsCOP = Math.max(0, parentsSubtotalCOP - suiteTotalCOP)

  return {
    parentsSubtotalMonthlyCOP,
    suiteMonthlyCOP,
    monthlySavingsCOP,
    parentsSubtotalCOP,
    suiteTotalCOP,
    savingsCOP,
    annualDiscountPct: ANNUAL_DISCOUNT_PCT,
  }
}

export function buildCommercialSegmentMatrix(pricing: {
  hrParent: { monthlyPriceCOP: number }
  systemSuiteGlobal: { monthlyPriceCOP: number }
  systemSuiteParents: Array<{ code: string; monthlyBundlePriceCOP: number }>
}): CommercialSegmentRow[] {
  const parentMap = Object.fromEntries(pricing.systemSuiteParents.map((item) => [item.code, item.monthlyBundlePriceCOP])) as Record<string, number>
  const microFrom = Math.min(parentMap.RES ?? Number.MAX_SAFE_INTEGER, parentMap.SALES ?? Number.MAX_SAFE_INTEGER, parentMap.CRM ?? Number.MAX_SAFE_INTEGER)
  const microTo = Math.max(parentMap.SALES ?? 0, parentMap.CRM ?? 0)
  const pymeFrom = (parentMap.SALES ?? 0) + (parentMap.RES ?? 0)
  const pymeTo = Math.max((parentMap.SALES ?? 0) + (parentMap.CRM ?? 0) + (parentMap.RES ?? 0), pricing.hrParent.monthlyPriceCOP)

  return [
    {
      segment: 'Micro',
      employeesRange: '1-10 colaboradores',
      activeUsersRange: '1-5 usuarios',
      recommendedMotion: 'Entrar por un módulo padre puntual',
      monthlyFromCOP: microFrom,
      monthlyToCOP: microTo,
      note: 'Ideal para cierres rápidos por dolor puntual en ventas, CRM o inventario.',
    },
    {
      segment: 'Pyme',
      employeesRange: '11-40 colaboradores',
      activeUsersRange: '4-12 usuarios',
      recommendedMotion: 'Vender 2-3 módulos padre o RRHH completo',
      monthlyFromCOP: pymeFrom,
      monthlyToCOP: pymeTo,
      note: 'Aquí normalmente ya existe operación formal y el cliente compra por frentes completos.',
    },
    {
      segment: 'Mid-market',
      employeesRange: '41-80 colaboradores',
      activeUsersRange: '8-25 usuarios',
      recommendedMotion: 'Vender Suite Global o núcleo operativo + RRHH',
      monthlyFromCOP: pricing.systemSuiteGlobal.monthlyPriceCOP,
      monthlyToCOP: null,
      note: 'La conversación cambia de módulo a contrato corporativo y consolidación de operación.',
    },
  ]
}