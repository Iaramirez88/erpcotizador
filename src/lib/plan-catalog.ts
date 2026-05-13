import type { ModuleKey, PlanTier } from '@prisma/client'
import { ANNUAL_DISCOUNT_PCT, getPlanPriceCOP, type BillingCycle } from '@/lib/plans'

export type PlanModuleCatalogItem = {
  module: ModuleKey
  nombre: string
  descripcion: string
  category: 'Comercial' | 'Operaciones' | 'Logistica' | 'Finanzas' | 'Relacionamiento'
  activationPriceMonthlyCOP: number
}

export type ModulePriceMap = Partial<Record<ModuleKey, number>>

export type ModularPlanQuote = {
  recommendedTier: PlanTier
  basePriceMonthlyCOP: number
  modulesSubtotalMonthlyCOP: number
  totalMonthlyCOP: number
  totalCOP: number
  annualDiscountPct: number
  selectedModules: ModuleKey[]
}

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

export const DEFAULT_ENABLED_MODULES: Record<PlanTier, ModuleKey[]> = {
  CRM: ['DASHBOARD', 'CRM', 'NOTIFICACIONES', 'CONFIG'],
  BASIC: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'REMISIONES', 'ORDENES', 'ESCANEOS', 'REPORTES', 'NOTIFICACIONES', 'CONFIG'],
  MEDIO: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'INVENTARIO', 'REMISIONES', 'POS', 'PROVEEDORES', 'COMPRAS', 'ORDENES', 'ESCANEOS', 'REPORTES', 'NOTIFICACIONES', 'CONFIG'],
  INTERMEDIO: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'INVENTARIO', 'REMISIONES', 'POS', 'PROVEEDORES', 'COMPRAS', 'ORDENES', 'ESCANEOS', 'REPORTES', 'CONTABILIDAD', 'NOTIFICACIONES', 'CONFIG'],
  FULL: [...ALL_MODULE_KEYS],
}

export const PLAN_MODULE_CATALOG: PlanModuleCatalogItem[] = [
  {
    module: 'COTIZADOR',
    nombre: 'Cotizador',
    descripcion: 'Calcula productos, servicios y tirajes desde el inicio del proceso comercial.',
    category: 'Comercial',
    activationPriceMonthlyCOP: 30000,
  },
  {
    module: 'COTIZACIONES',
    nombre: 'Cotizaciones',
    descripcion: 'Gestiona propuestas, seguimientos y conversiones a orden.',
    category: 'Comercial',
    activationPriceMonthlyCOP: 45000,
  },
  {
    module: 'CLIENTES',
    nombre: 'Clientes',
    descripcion: 'Centraliza la base comercial y el historial de atención.',
    category: 'Comercial',
    activationPriceMonthlyCOP: 20000,
  },
  {
    module: 'REMISIONES',
    nombre: 'Remisiones',
    descripcion: 'Controla entregas y soportes posteriores a la venta.',
    category: 'Comercial',
    activationPriceMonthlyCOP: 18000,
  },
  {
    module: 'CRM',
    nombre: 'CRM omnicanal',
    descripcion: 'Inbox, agenda, tareas, oportunidades y seguimiento comercial en un solo flujo.',
    category: 'Relacionamiento',
    activationPriceMonthlyCOP: 70000,
  },
  {
    module: 'ORDENES',
    nombre: 'Órdenes de trabajo',
    descripcion: 'Convierte ventas en ejecución operativa con trazabilidad.',
    category: 'Operaciones',
    activationPriceMonthlyCOP: 28000,
  },
  {
    module: 'MATERIALES',
    nombre: 'Productos y terminados',
    descripcion: 'Administra catálogo, terminados y estructuras de materiales.',
    category: 'Operaciones',
    activationPriceMonthlyCOP: 22000,
  },
  {
    module: 'ESCANEOS',
    nombre: 'Escaneos y producción',
    descripcion: 'Registra avances, procesos y evidencia en planta.',
    category: 'Operaciones',
    activationPriceMonthlyCOP: 18000,
  },
  {
    module: 'INVENTARIO',
    nombre: 'Inventario',
    descripcion: 'Controla existencias, movimientos y disponibilidad por sede.',
    category: 'Logistica',
    activationPriceMonthlyCOP: 40000,
  },
  {
    module: 'PROVEEDORES',
    nombre: 'Proveedores',
    descripcion: 'Organiza aliados, condiciones y abastecimiento.',
    category: 'Logistica',
    activationPriceMonthlyCOP: 24000,
  },
  {
    module: 'COMPRAS',
    nombre: 'Compras',
    descripcion: 'Gestiona requisiciones, órdenes de compra y recepción.',
    category: 'Logistica',
    activationPriceMonthlyCOP: 32000,
  },
  {
    module: 'POS',
    nombre: 'POS y facturación',
    descripcion: 'Factura, recauda y opera puntos de venta con más agilidad.',
    category: 'Finanzas',
    activationPriceMonthlyCOP: 50000,
  },
  {
    module: 'REPORTES',
    nombre: 'Reportes',
    descripcion: 'Consolida indicadores operativos, comerciales y de gestión.',
    category: 'Finanzas',
    activationPriceMonthlyCOP: 24000,
  },
  {
    module: 'CONTABILIDAD',
    nombre: 'Contabilidad y nómina',
    descripcion: 'Activa comprobantes, reglas, cierres, nómina y trazabilidad contable.',
    category: 'Finanzas',
    activationPriceMonthlyCOP: 85000,
  },
]

export function getDefaultModulePriceMap(): Record<ModuleKey, number> {
  return PLAN_MODULE_CATALOG.reduce<Record<ModuleKey, number>>((acc, item) => {
    acc[item.module] = item.activationPriceMonthlyCOP
    return acc
  }, {} as Record<ModuleKey, number>)
}

export function buildPlanModuleCatalog(modulePriceMap?: ModulePriceMap): PlanModuleCatalogItem[] {
  return PLAN_MODULE_CATALOG.map((item) => ({
    ...item,
    activationPriceMonthlyCOP: modulePriceMap?.[item.module] ?? item.activationPriceMonthlyCOP,
  }))
}

export function getDefaultEnabledModulesForPlan(planTier: PlanTier): ModuleKey[] {
  return [...(DEFAULT_ENABLED_MODULES[planTier] ?? ALL_MODULE_KEYS)]
}

export function getMinimumPlanTierForModules(selectedModules: ModuleKey[]): PlanTier {
  const uniqueModules = Array.from(new Set(selectedModules))
  if (!uniqueModules.length) return 'BASIC'

  for (const tier of ALL_PLAN_TIERS) {
    const availableModules = new Set(getDefaultEnabledModulesForPlan(tier))
    const supportsAllModules = uniqueModules.every((moduleKey) => availableModules.has(moduleKey))
    if (supportsAllModules) return tier
  }

  return 'FULL'
}

export function getPlanCatalogItem(moduleKey: ModuleKey, modulePriceMap?: ModulePriceMap): PlanModuleCatalogItem | null {
  return buildPlanModuleCatalog(modulePriceMap).find((item) => item.module === moduleKey) ?? null
}

export function getModularPlanQuote(args: {
  selectedModules: ModuleKey[]
  cycle: BillingCycle
  modulePriceMap?: ModulePriceMap
  basePlanPriceMap?: Partial<Record<PlanTier, number>>
}): ModularPlanQuote {
  const catalog = buildPlanModuleCatalog(args.modulePriceMap)
  const selectedModules = Array.from(new Set(args.selectedModules)).filter((moduleKey) =>
    catalog.some((item) => item.module === moduleKey)
  )

  const recommendedTier = getMinimumPlanTierForModules(selectedModules)
  const basePriceMonthlyCOP = args.basePlanPriceMap?.[recommendedTier] ?? getPlanPriceCOP(recommendedTier, 'MONTHLY')
  const modulesSubtotalMonthlyCOP = selectedModules.reduce((sum, moduleKey) => {
    const item = getPlanCatalogItem(moduleKey, args.modulePriceMap)
    return sum + (item?.activationPriceMonthlyCOP ?? 0)
  }, 0)
  const totalMonthlyCOP = basePriceMonthlyCOP + modulesSubtotalMonthlyCOP

  if (args.cycle === 'MONTHLY') {
    return {
      recommendedTier,
      basePriceMonthlyCOP,
      modulesSubtotalMonthlyCOP,
      totalMonthlyCOP,
      totalCOP: totalMonthlyCOP,
      annualDiscountPct: 0,
      selectedModules,
    }
  }

  const annualBeforeDiscount = totalMonthlyCOP * 12
  const totalCOP = Math.round(annualBeforeDiscount * (1 - ANNUAL_DISCOUNT_PCT / 100))

  return {
    recommendedTier,
    basePriceMonthlyCOP,
    modulesSubtotalMonthlyCOP,
    totalMonthlyCOP,
    totalCOP,
    annualDiscountPct: ANNUAL_DISCOUNT_PCT,
    selectedModules,
  }
}