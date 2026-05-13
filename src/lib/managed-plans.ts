import type { BillingCycle, PlanTier, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ANNUAL_DISCOUNT_PCT, type PlanInfo, PLANES } from '@/lib/plans'

export type PlanIncludeGroup = {
  title: string
  items: string[]
}

export type ManagedPlanInfo = PlanInfo & {
  tagline: string
  forWho: string
  incluye: PlanIncludeGroup[]
  alcance: string[]
  storageLimitGb: number | null
  active: boolean
  displayOrder: number
}

type DefaultManagedPlan = ManagedPlanInfo

const DEFAULT_STORAGE_LIMIT_GB: Record<PlanTier, number> = {
  CRM: 10,
  BASIC: 25,
  MEDIO: 60,
  INTERMEDIO: 120,
  FULL: 300,
}

export const DEFAULT_MANAGED_PLANS: DefaultManagedPlan[] = [
  {
    tier: 'CRM',
    nombre: 'CRM',
    descripcion: 'Plan especializado solo para CRM omnicanal, agenda comercial, leads, oportunidades, tareas y chat global del equipo.',
    precioMensualCOP: 150000,
    tagline: 'CRM comercial dedicado',
    forWho: 'Para equipos que solo necesitan CRM y chat omnicanal.',
    incluye: [
      { title: 'CRM comercial', items: ['Leads', 'Oportunidades', 'Agenda', 'Tareas', 'Inbox omnicanal', 'Chat global interno'] },
      { title: 'Operación mínima', items: ['Dashboard', 'Configuración básica', 'Notificaciones'] },
    ],
    alcance: ['CRM y chat global', 'Sin ERP operativo', 'Mensual fijo'],
    storageLimitGb: DEFAULT_STORAGE_LIMIT_GB.CRM,
    active: true,
    displayOrder: 0,
  },
  {
    tier: 'BASIC',
    nombre: 'Básico',
    descripcion: 'Ideal para comenzar. Incluye 100 reportes, 100 remisiones, 100 órdenes de trabajo, 50 proveedores, 500 clientes, 200 productos, 1 sede, 2 usuarios, 300 cotizaciones/mes. Sin límite en Litografía, Escaneos y Terminados.',
    precioMensualCOP: 750000,
    tagline: 'Ideal para comenzar',
    forWho: 'Para emprendedores y equipos pequeños.',
    incluye: [
      { title: 'Centro de control', items: ['Dashboard', 'Reportes (100)'] },
      { title: 'Comercial', items: ['Cotizador', 'Cotizaciones (300/mes)', 'Remisiones (100)', 'Clientes (500)'] },
      { title: 'Operaciones', items: ['Órdenes de trabajo (100)', 'Litografía (sin límite)', 'Escaneos (sin límite)', 'Terminados (sin límite)'] },
      { title: 'Logística', items: ['Inventario', 'Proveedores (50)', 'Productos (200)'] },
      { title: 'Gestión', items: ['1 sede', '2 usuarios'] },
      { title: 'Preferencias', items: ['Mi perfil', 'Notificaciones'] },
    ],
    alcance: ['1 sede', '2 usuarios', '500 clientes', '300 cotizaciones / mes', 'Litografía, Escaneos y Terminados sin límite'],
    storageLimitGb: DEFAULT_STORAGE_LIMIT_GB.BASIC,
    active: true,
    displayOrder: 1,
  },
  {
    tier: 'MEDIO',
    nombre: 'Medio',
    descripcion: 'Escala la operación comercial y logística con más capacidad de usuarios, sedes y volumen mensual, sin incluir CRM omnicanal.',
    precioMensualCOP: 1200000,
    tagline: 'Operación estable y escalable',
    forWho: 'Para empresas que ya necesitan POS, inventario y compras sin llegar a full.',
    incluye: [
      { title: 'Incluye todo el Básico +', items: ['Inventario', 'POS', 'Compras', 'Traslados', 'Proveedores ampliados'] },
      { title: 'Capacidad', items: ['3 sedes', '5 usuarios', '2.500 clientes', '1.500 cotizaciones / mes'] },
    ],
    alcance: ['3 sedes', '5 usuarios', '2.500 clientes', '1.500 cotizaciones / mes'],
    storageLimitGb: DEFAULT_STORAGE_LIMIT_GB.MEDIO,
    active: true,
    displayOrder: 2,
  },
  {
    tier: 'INTERMEDIO',
    nombre: 'Intermedio',
    descripcion: 'Todo ilimitado excepto: 6 sedes, 10 usuarios, 8.000 clientes y 5.000 cotizaciones por mes. CRM solo disponible en Full o CRM.',
    precioMensualCOP: 1650000,
    tagline: 'Control real de la empresa',
    forWho: 'Para equipos en crecimiento.',
    incluye: [
      { title: 'Incluye todo el Básico +', items: [] },
      { title: 'Centro de control', items: ['Reportes ilimitados'] },
      { title: 'Comercial', items: ['POS', 'Remisiones ilimitadas', 'Facturación', 'Cotizaciones (5.000/mes)', 'Clientes (8.000)'] },
      { title: 'Operaciones', items: ['Órdenes de trabajo ilimitadas', 'Litografía, Escaneos y Terminados ilimitados'] },
      { title: 'Logística', items: ['Inventario', 'Proveedores ilimitados', 'Productos ilimitados', 'Compras', 'Traslados', 'Desperdicios'] },
      { title: 'Gestión', items: ['6 sedes', '10 usuarios'] },
      { title: 'Preferencias', items: ['Mi perfil', 'Notificaciones', 'Usuarios'] },
    ],
    alcance: ['6 sedes', '10 usuarios', '8.000 clientes', '5.000 cotizaciones / mes'],
    storageLimitGb: DEFAULT_STORAGE_LIMIT_GB.INTERMEDIO,
    active: true,
    displayOrder: 3,
  },
  {
    tier: 'FULL',
    nombre: 'Full',
    descripcion: 'Sin límites. Todas las funcionalidades y módulos habilitados.',
    precioMensualCOP: 2400000,
    tagline: 'Escala sin límites',
    forWho: 'Para empresas con operación completa.',
    incluye: [
      { title: 'Incluye todo +', items: [] },
      { title: 'Gestión', items: ['Permisos', 'Empresa', 'Plan', 'Usuarios ilimitados', 'Sedes ilimitadas'] },
      { title: 'CRM', items: ['CRM omnicanal completo', 'Agenda', 'Tareas', 'Integraciones', 'Chat global'] },
      { title: 'Preferencias', items: ['Personalizar menú', 'Configuración', 'Ayuda'] },
      { title: 'Centro de control', items: ['KPIs por sede', 'Reportes avanzados'] },
      { title: 'Comercial', items: ['Todo ilimitado'] },
      { title: 'Operaciones', items: ['Todo ilimitado'] },
      { title: 'Logística', items: ['Todo ilimitado'] },
    ],
    alcance: ['Sedes ilimitadas', 'Usuarios ilimitados', 'Clientes ilimitados', 'Cotizaciones ilimitadas'],
    storageLimitGb: DEFAULT_STORAGE_LIMIT_GB.FULL,
    active: true,
    displayOrder: 4,
  },
]

function normalizeIncludeGroups(value: unknown): PlanIncludeGroup[] {
  if (!Array.isArray(value)) return []
  return value
    .map((group) => {
      if (!group || typeof group !== 'object' || Array.isArray(group)) return null
      const title = typeof group.title === 'string' ? group.title.trim() : ''
      const items = Array.isArray(group.items)
        ? group.items.map((item: unknown) => String(item || '').trim()).filter(Boolean)
        : []
      if (!title) return null
      return { title, items }
    })
    .filter((group): group is PlanIncludeGroup => Boolean(group))
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function mapRowToManagedPlan(row: {
  planTier: PlanTier
  nombre: string
  descripcion: string
  precioMensualCOP: number
  tagline: string
  forWho: string
  incluyeJson: Prisma.JsonValue
  alcanceJson: Prisma.JsonValue
  storageLimitGb: number | null
  active: boolean
  displayOrder: number
}): ManagedPlanInfo {
  return {
    tier: row.planTier,
    nombre: row.nombre,
    descripcion: row.descripcion,
    precioMensualCOP: row.precioMensualCOP,
    tagline: row.tagline,
    forWho: row.forWho,
    incluye: normalizeIncludeGroups(row.incluyeJson),
    alcance: normalizeStringList(row.alcanceJson),
    storageLimitGb: typeof row.storageLimitGb === 'number' ? row.storageLimitGb : null,
    active: row.active,
    displayOrder: row.displayOrder,
  }
}

function getDefaultManagedPlan(tier: PlanTier): ManagedPlanInfo {
  return DEFAULT_MANAGED_PLANS.find((plan) => plan.tier === tier)
    ?? {
      ...(PLANES.find((plan) => plan.tier === tier) ?? PLANES[0]),
      tagline: '',
      forWho: '',
      incluye: [],
      alcance: [],
      storageLimitGb: DEFAULT_STORAGE_LIMIT_GB[tier] ?? null,
      active: true,
      displayOrder: DEFAULT_MANAGED_PLANS.length,
    }
}

function getPlanCatalogDelegate() {
  const delegate = (prisma as typeof prisma & {
    planCatalogSetting?: {
      findMany: (...args: any[]) => Promise<any>
      findUnique: (...args: any[]) => Promise<any>
      upsert: (...args: any[]) => Promise<any>
    }
  }).planCatalogSetting

  return delegate
}

function isPlanCatalogInfraMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  return candidate.code === 'P2021' || candidate.code === 'P2022' || /plan_catalog_settings|planCatalogSetting/i.test(String(candidate.message || ''))
}

function getDefaultManagedPlansList(options?: { includeInactive?: boolean }) {
  const base = options?.includeInactive
    ? DEFAULT_MANAGED_PLANS
    : DEFAULT_MANAGED_PLANS.filter((plan) => plan.active !== false)

  return [...base].sort((a, b) => a.displayOrder - b.displayOrder)
}

export async function ensurePlanCatalogDefaults() {
  const planCatalogSetting = getPlanCatalogDelegate()
  if (!planCatalogSetting) return

  let existingRows: Array<{
    planTier: PlanTier
    nombre: string
    descripcion: string
    precioMensualCOP: number
    tagline: string
    forWho: string
    incluyeJson: Prisma.JsonValue
    alcanceJson: Prisma.JsonValue
    storageLimitGb: number | null
    active: boolean
    displayOrder: number
  }>

  try {
    existingRows = await planCatalogSetting.findMany({
      select: {
        planTier: true,
        nombre: true,
        descripcion: true,
        precioMensualCOP: true,
        tagline: true,
        forWho: true,
        incluyeJson: true,
        alcanceJson: true,
        storageLimitGb: true,
        active: true,
        displayOrder: true,
      },
    })
  } catch (error) {
    if (isPlanCatalogInfraMissing(error)) return
    throw error
  }

  const existingMap = new Map(existingRows.map((row) => [row.planTier, row]))

  await Promise.all(
    DEFAULT_MANAGED_PLANS.map((plan) => {
      const existing = existingMap.get(plan.tier)

      return planCatalogSetting.upsert({
        where: { planTier: plan.tier },
        create: {
          planTier: plan.tier,
          nombre: plan.nombre,
          descripcion: plan.descripcion,
          precioMensualCOP: plan.precioMensualCOP,
          tagline: plan.tagline,
          forWho: plan.forWho,
          incluyeJson: plan.incluye,
          alcanceJson: plan.alcance,
          storageLimitGb: plan.storageLimitGb,
          active: plan.active,
          displayOrder: plan.displayOrder,
        },
        update: {
          nombre: existing && existing.nombre.trim() ? undefined : plan.nombre,
          descripcion: existing && existing.descripcion.trim() ? undefined : plan.descripcion,
          precioMensualCOP:
            existing && Number.isFinite(existing.precioMensualCOP) && existing.precioMensualCOP > 0
              ? undefined
              : plan.precioMensualCOP,
          tagline: existing && existing.tagline.trim() ? undefined : plan.tagline,
          forWho: existing && existing.forWho.trim() ? undefined : plan.forWho,
          incluyeJson: normalizeIncludeGroups(existing?.incluyeJson).length ? undefined : plan.incluye,
          alcanceJson: normalizeStringList(existing?.alcanceJson).length ? undefined : plan.alcance,
          storageLimitGb:
            existing && typeof existing.storageLimitGb === 'number' && existing.storageLimitGb > 0
              ? undefined
              : plan.storageLimitGb,
          displayOrder:
            existing && Number.isFinite(existing.displayOrder) && existing.displayOrder >= 0
              ? undefined
              : plan.displayOrder,
        },
      })
    })
  )
}

export async function getManagedPlans(options?: { includeInactive?: boolean }) {
  const planCatalogSetting = getPlanCatalogDelegate()
  if (!planCatalogSetting) return getDefaultManagedPlansList(options)

  await ensurePlanCatalogDefaults()

  try {
    const rows = await planCatalogSetting.findMany({
      where: options?.includeInactive ? undefined : { active: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        planTier: true,
        nombre: true,
        descripcion: true,
        precioMensualCOP: true,
        tagline: true,
        forWho: true,
        incluyeJson: true,
        alcanceJson: true,
        storageLimitGb: true,
        active: true,
        displayOrder: true,
      },
    })

    return rows.map(mapRowToManagedPlan)
  } catch (error) {
    if (isPlanCatalogInfraMissing(error)) return getDefaultManagedPlansList(options)
    throw error
  }
}

export async function getManagedPlanByTier(planTier: PlanTier) {
  const planCatalogSetting = getPlanCatalogDelegate()
  if (!planCatalogSetting) return getDefaultManagedPlan(planTier)

  await ensurePlanCatalogDefaults()

  try {
    const row = await planCatalogSetting.findUnique({
      where: { planTier },
      select: {
        planTier: true,
        nombre: true,
        descripcion: true,
        precioMensualCOP: true,
        tagline: true,
        forWho: true,
        incluyeJson: true,
        alcanceJson: true,
        storageLimitGb: true,
        active: true,
        displayOrder: true,
      },
    })

    return row ? mapRowToManagedPlan(row) : getDefaultManagedPlan(planTier)
  } catch (error) {
    if (isPlanCatalogInfraMissing(error)) return getDefaultManagedPlan(planTier)
    throw error
  }
}

export async function saveManagedPlan(plan: ManagedPlanInfo) {
  const planCatalogSetting = getPlanCatalogDelegate()
  if (!planCatalogSetting) {
    throw new Error('El catálogo de planes aún no está disponible en el runtime actual de Prisma. Ejecuta Prisma generate y reinicia el servidor.')
  }

  let row
  try {
    row = await planCatalogSetting.upsert({
    where: { planTier: plan.tier },
    create: {
      planTier: plan.tier,
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      precioMensualCOP: plan.precioMensualCOP,
      tagline: plan.tagline,
      forWho: plan.forWho,
      incluyeJson: plan.incluye,
      alcanceJson: plan.alcance,
      storageLimitGb: plan.storageLimitGb,
      active: plan.active,
      displayOrder: plan.displayOrder,
    },
    update: {
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      precioMensualCOP: plan.precioMensualCOP,
      tagline: plan.tagline,
      forWho: plan.forWho,
      incluyeJson: plan.incluye,
      alcanceJson: plan.alcance,
      storageLimitGb: plan.storageLimitGb,
      active: plan.active,
      displayOrder: plan.displayOrder,
    },
    select: {
      planTier: true,
      nombre: true,
      descripcion: true,
      precioMensualCOP: true,
      tagline: true,
      forWho: true,
      incluyeJson: true,
      alcanceJson: true,
      storageLimitGb: true,
      active: true,
      displayOrder: true,
    },
    })
  } catch (error) {
    if (isPlanCatalogInfraMissing(error)) {
      throw new Error('La tabla del catálogo de planes no existe todavía en la base de datos. Ejecuta la migración pendiente antes de guardar cambios.')
    }
    throw error
  }

  return mapRowToManagedPlan(row)
}

export function getManagedPlanPriceCOPFromList(args: { plans: ManagedPlanInfo[]; tier: PlanTier; cycle: BillingCycle }) {
  const plan = args.plans.find((item) => item.tier === args.tier) ?? getDefaultManagedPlan(args.tier)
  if (args.cycle === 'MONTHLY') return plan.precioMensualCOP
  const annual = plan.precioMensualCOP * 12
  return Math.round(annual * (1 - ANNUAL_DISCOUNT_PCT / 100))
}

export async function getManagedPlanPriceCOP(tier: PlanTier, cycle: BillingCycle) {
  const plan = await getManagedPlanByTier(tier)
  return getManagedPlanPriceCOPFromList({ plans: [plan], tier, cycle })
}

export function convertStorageLimitGbToBytes(storageLimitGb: number | null | undefined) {
  if (!Number.isFinite(storageLimitGb) || Number(storageLimitGb) <= 0) return null
  return Math.round(Number(storageLimitGb) * 1024 * 1024 * 1024)
}