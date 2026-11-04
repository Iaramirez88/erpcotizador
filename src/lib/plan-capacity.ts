import type { PlanTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveEffectivePlanTier, type EmpresaPlanContext } from '@/lib/plan-access'
import { getEmpresaStorageUsageSummary } from '@/lib/empresa-storage'
import { getModuleCapacityResources } from '@/lib/plan-capacity-resource-map'

/**
 * Servicio central de capacidad de planes.
 *
 * Toda la plataforma consulta el mismo contrato antes de registrar una operación:
 *
 * const result = await checkPlanLimit({ companyId, resource: 'COTIZACIONES', period: 'MONTHLY' })
 * if (!result.allowed) {
 *   // mostrar aviso de capacidad alcanzada
 * }
 *
 * Los límites viven en la tabla `plan_limit_settings` (editables desde super admin) y caen a
 * los defaults de este archivo cuando la tabla aún no está migrada o falta una fila.
 *
 * Reglas globales:
 * - 80%  → notificación preventiva.
 * - 90%  → alerta al administrador.
 * - 100% → aviso de capacidad alcanzada y opción de ampliar (según `overagePolicy`).
 * - Nunca se elimina ni se bloquea el acceso a registros existentes: solo se restringen
 *   nuevas operaciones de creación y siempre se permite consultar/exportar el histórico.
 */

export type PlanCapacityResource =
  | 'COTIZACIONES'
  | 'ORDENES'
  | 'REMISIONES'
  | 'CLIENTES'
  | 'PRODUCTOS'
  | 'PROVEEDORES'
  | 'SEDES'
  | 'USUARIOS'
  | 'ALMACENAMIENTO'

export type PlanCapacityPeriod = 'MONTHLY' | 'ACCUMULATED'

/** BLOCK: rechaza la operación al 100%. OVERAGE: permite seguir con consumo adicional. WARN: solo advierte. */
export type PlanCapacityOveragePolicy = 'BLOCK' | 'OVERAGE' | 'WARN'

export type PlanCapacityLevel = 'ok' | 'warning' | 'critical' | 'reached'

export type LegacyPlanLimitKey =
  | 'COTIZACIONES_PER_MONTH'
  | 'ORDENES_PER_MONTH'
  | 'REMISIONES_PER_MONTH'
  | 'PRODUCTOS_MAX'
  | 'CLIENTES_MAX'
  | 'PROVEEDORES_MAX'
  | 'SEDES_MAX'
  | 'USUARIOS_MAX'
  | 'ALMACENAMIENTO_GB'

export type PlanCapacityResourceMeta = {
  resource: PlanCapacityResource
  label: string
  shortLabel: string
  unit: string
  period: PlanCapacityPeriod
  policy: PlanCapacityOveragePolicy
  description: string
  blockedOperations: string[]
  allowedOperations: string[]
  /** Clave histórica usada por `checkPlanLimit(empresaId, limitKey)` en las rutas existentes. */
  legacyLimitKey: LegacyPlanLimitKey
}

export const PLAN_CAPACITY_RESOURCES: PlanCapacityResourceMeta[] = [
  {
    resource: 'COTIZACIONES',
    label: 'Cotizaciones',
    shortLabel: 'Cotizaciones',
    unit: '',
    period: 'MONTHLY',
    policy: 'BLOCK',
    description: 'Documentos comerciales creados en el mes en curso.',
    blockedOperations: ['Crear cotización', 'Convertir escaneo en cotización'],
    allowedOperations: ['Consultar y exportar cotizaciones existentes', 'Editar estado de cotizaciones existentes'],
    legacyLimitKey: 'COTIZACIONES_PER_MONTH',
  },
  {
    resource: 'ORDENES',
    label: 'Órdenes de trabajo',
    shortLabel: 'Órdenes',
    unit: '',
    period: 'MONTHLY',
    policy: 'BLOCK',
    description: 'Órdenes de trabajo creadas en el mes en curso.',
    blockedOperations: ['Crear orden de trabajo', 'Convertir escaneo en orden'],
    allowedOperations: ['Consultar y exportar órdenes existentes', 'Avanzar el estado de órdenes existentes'],
    legacyLimitKey: 'ORDENES_PER_MONTH',
  },
  {
    resource: 'REMISIONES',
    label: 'Remisiones',
    shortLabel: 'Remisiones',
    unit: '',
    period: 'MONTHLY',
    policy: 'BLOCK',
    description: 'Remisiones y entregas registradas en el mes en curso.',
    blockedOperations: ['Crear remisión'],
    allowedOperations: ['Consultar y exportar remisiones existentes'],
    legacyLimitKey: 'REMISIONES_PER_MONTH',
  },
  {
    resource: 'CLIENTES',
    label: 'Clientes',
    shortLabel: 'Clientes',
    unit: '',
    period: 'ACCUMULATED',
    policy: 'BLOCK',
    description: 'Clientes activos acumulados en la base comercial.',
    blockedOperations: ['Crear cliente'],
    allowedOperations: ['Consultar y exportar clientes existentes', 'Editar clientes existentes'],
    legacyLimitKey: 'CLIENTES_MAX',
  },
  {
    resource: 'PRODUCTOS',
    label: 'Productos y terminados',
    shortLabel: 'Productos',
    unit: '',
    period: 'ACCUMULATED',
    policy: 'BLOCK',
    description: 'Materiales y terminados activos del catálogo.',
    blockedOperations: ['Crear producto o terminado'],
    allowedOperations: ['Consultar y exportar catálogo existente', 'Editar productos existentes'],
    legacyLimitKey: 'PRODUCTOS_MAX',
  },
  {
    resource: 'PROVEEDORES',
    label: 'Proveedores',
    shortLabel: 'Proveedores',
    unit: '',
    period: 'ACCUMULATED',
    policy: 'BLOCK',
    description: 'Proveedores activos registrados.',
    blockedOperations: ['Crear proveedor'],
    allowedOperations: ['Consultar y exportar proveedores existentes'],
    legacyLimitKey: 'PROVEEDORES_MAX',
  },
  {
    resource: 'SEDES',
    label: 'Sedes',
    shortLabel: 'Sedes',
    unit: '',
    period: 'ACCUMULATED',
    policy: 'BLOCK',
    description: 'Sedes activas del espacio de trabajo.',
    blockedOperations: ['Crear sede'],
    allowedOperations: ['Consultar y exportar información de sedes existentes'],
    legacyLimitKey: 'SEDES_MAX',
  },
  {
    resource: 'USUARIOS',
    label: 'Usuarios',
    shortLabel: 'Usuarios',
    unit: '',
    period: 'ACCUMULATED',
    policy: 'BLOCK',
    description: 'Usuarios con acceso al espacio de trabajo.',
    blockedOperations: ['Invitar o registrar usuario'],
    allowedOperations: ['Consultar usuarios existentes', 'Exportar listado de usuarios'],
    legacyLimitKey: 'USUARIOS_MAX',
  },
  {
    resource: 'ALMACENAMIENTO',
    label: 'Almacenamiento',
    shortLabel: 'Almacenamiento',
    unit: 'GB',
    period: 'ACCUMULATED',
    policy: 'OVERAGE',
    description: 'Archivos CRM, escaneos, soportes y backups del espacio de trabajo.',
    blockedOperations: ['Cargas que superen el 100% cuando la política sea BLOCK'],
    allowedOperations: ['Descargar y exportar archivos existentes', 'Consultar consumo por usuario'],
    legacyLimitKey: 'ALMACENAMIENTO_GB',
  },
]

export const PLAN_CAPACITY_RESOURCE_KEYS: PlanCapacityResource[] = PLAN_CAPACITY_RESOURCES.map(
  (item) => item.resource
)

export type PlanCapacityLimitDefinition = {
  limit: number | null
  period: PlanCapacityPeriod
  policy: PlanCapacityOveragePolicy
}

const UNLIMITED: PlanCapacityLimitDefinition = { limit: null, period: 'ACCUMULATED', policy: 'BLOCK' }

function monthly(limit: number | null, policy: PlanCapacityOveragePolicy = 'BLOCK'): PlanCapacityLimitDefinition {
  return { limit, period: 'MONTHLY', policy }
}

function accumulated(limit: number | null, policy: PlanCapacityOveragePolicy = 'BLOCK'): PlanCapacityLimitDefinition {
  return { limit, period: 'ACCUMULATED', policy }
}

/**
 * Defaults por plan. Se usan cuando `plan_limit_settings` no tiene fila para ese plan/recurso.
 * Reproducen los límites que la plataforma ya aplicaba en código para no cambiar el
 * comportamiento de las empresas existentes.
 */
export const DEFAULT_PLAN_CAPACITY: Record<PlanTier, Record<PlanCapacityResource, PlanCapacityLimitDefinition>> = {
  CRM: {
    COTIZACIONES: monthly(null),
    ORDENES: monthly(null),
    REMISIONES: monthly(null),
    CLIENTES: accumulated(2000),
    PRODUCTOS: accumulated(null),
    PROVEEDORES: accumulated(null),
    SEDES: accumulated(1),
    USUARIOS: accumulated(3),
    ALMACENAMIENTO: accumulated(10, 'OVERAGE'),
  },
  BASIC: {
    COTIZACIONES: monthly(300),
    ORDENES: monthly(100),
    REMISIONES: monthly(100),
    CLIENTES: accumulated(500),
    PRODUCTOS: accumulated(200),
    PROVEEDORES: accumulated(50),
    SEDES: accumulated(1),
    USUARIOS: accumulated(2),
    ALMACENAMIENTO: accumulated(25, 'OVERAGE'),
  },
  MEDIO: {
    COTIZACIONES: monthly(5000),
    ORDENES: monthly(null),
    REMISIONES: monthly(null),
    CLIENTES: accumulated(8000),
    PRODUCTOS: accumulated(null),
    PROVEEDORES: accumulated(null),
    SEDES: accumulated(6),
    USUARIOS: accumulated(10),
    ALMACENAMIENTO: accumulated(60, 'OVERAGE'),
  },
  INTERMEDIO: {
    COTIZACIONES: monthly(5000),
    ORDENES: monthly(null),
    REMISIONES: monthly(null),
    CLIENTES: accumulated(8000),
    PRODUCTOS: accumulated(null),
    PROVEEDORES: accumulated(null),
    SEDES: accumulated(6),
    USUARIOS: accumulated(10),
    ALMACENAMIENTO: accumulated(120, 'OVERAGE'),
  },
  FULL: {
    COTIZACIONES: UNLIMITED,
    ORDENES: UNLIMITED,
    REMISIONES: UNLIMITED,
    CLIENTES: UNLIMITED,
    PRODUCTOS: UNLIMITED,
    PROVEEDORES: UNLIMITED,
    SEDES: UNLIMITED,
    USUARIOS: UNLIMITED,
    ALMACENAMIENTO: accumulated(null, 'OVERAGE'),
  },
}

export const PLAN_CAPACITY_DEFAULT_WARNING_PCT = 80
export const PLAN_CAPACITY_DEFAULT_CRITICAL_PCT = 90
export const PLAN_CAPACITY_UPGRADE_URL = '/dashboard/configuracion/plan'

export const LEGACY_LIMIT_KEY_TO_RESOURCE: Record<LegacyPlanLimitKey, PlanCapacityResource> = {
  COTIZACIONES_PER_MONTH: 'COTIZACIONES',
  ORDENES_PER_MONTH: 'ORDENES',
  REMISIONES_PER_MONTH: 'REMISIONES',
  PRODUCTOS_MAX: 'PRODUCTOS',
  CLIENTES_MAX: 'CLIENTES',
  PROVEEDORES_MAX: 'PROVEEDORES',
  SEDES_MAX: 'SEDES',
  USUARIOS_MAX: 'USUARIOS',
  ALMACENAMIENTO_GB: 'ALMACENAMIENTO',
}

const RESOURCE_ALIASES: Record<string, PlanCapacityResource> = {
  COTIZACIONES: 'COTIZACIONES',
  COTIZACIONES_PER_MONTH: 'COTIZACIONES',
  QUOTATIONS: 'COTIZACIONES',
  ORDENES: 'ORDENES',
  ORDENES_PER_MONTH: 'ORDENES',
  ORDERS: 'ORDENES',
  WORK_ORDERS: 'ORDENES',
  REMISIONES: 'REMISIONES',
  REMISIONES_PER_MONTH: 'REMISIONES',
  DELIVERY_NOTES: 'REMISIONES',
  CLIENTES: 'CLIENTES',
  CLIENTES_MAX: 'CLIENTES',
  CUSTOMERS: 'CLIENTES',
  PRODUCTOS: 'PRODUCTOS',
  PRODUCTOS_MAX: 'PRODUCTOS',
  PRODUCTS: 'PRODUCTOS',
  PROVEEDORES: 'PROVEEDORES',
  PROVEEDORES_MAX: 'PROVEEDORES',
  SUPPLIERS: 'PROVEEDORES',
  SEDES: 'SEDES',
  SEDES_MAX: 'SEDES',
  BRANCHES: 'SEDES',
  USUARIOS: 'USUARIOS',
  USUARIOS_MAX: 'USUARIOS',
  USERS: 'USUARIOS',
  ALMACENAMIENTO: 'ALMACENAMIENTO',
  ALMACENAMIENTO_GB: 'ALMACENAMIENTO',
  STORAGE: 'ALMACENAMIENTO',
}

export function normalizePlanCapacityResource(value: string | null | undefined): PlanCapacityResource | null {
  if (!value) return null
  return RESOURCE_ALIASES[value.trim().toUpperCase()] ?? null
}

export function normalizePlanCapacityPeriod(value: unknown): PlanCapacityPeriod | null {
  if (value === 'MONTHLY' || value === 'ACCUMULATED') return value
  if (typeof value === 'string' && value.trim().toUpperCase() === 'MONTHLY') return 'MONTHLY'
  if (typeof value === 'string' && value.trim().toUpperCase() === 'ACCUMULATED') return 'ACCUMULATED'
  return null
}

export function normalizePlanCapacityPolicy(value: unknown): PlanCapacityOveragePolicy | null {
  if (value === 'BLOCK' || value === 'OVERAGE' || value === 'WARN') return value
  return null
}

export function getPlanCapacityResourceMeta(resource: PlanCapacityResource): PlanCapacityResourceMeta {
  return PLAN_CAPACITY_RESOURCES.find((item) => item.resource === resource) ?? PLAN_CAPACITY_RESOURCES[0]
}



export type PlanCapacityLimitSource = 'DEFAULT' | 'CUSTOM' | 'CATALOG' | 'COMPANY'

export type ResolvedCapacityLimit = PlanCapacityLimitDefinition & {
  warningPct: number
  criticalPct: number
  source: PlanCapacityLimitSource
}

export type PlanCapacityConfig = Record<PlanTier, Record<PlanCapacityResource, ResolvedCapacityLimit>>

/**
 * Tiers con configuración de capacidad resuelta.
 *
 * Incluye `CRM` porque existen empresas legado con ese tier: la resolución de límites debe
 * seguir funcionando para ellas. La edición desde super admin solo cubre los planes
 * comerciales (`COMMERCIAL_PLAN_TIERS` en `plan-catalog`).
 */
export const PLAN_CAPACITY_TIERS: PlanTier[] = ['CRM', 'BASIC', 'MEDIO', 'INTERMEDIO', 'FULL']
const CONFIG_TTL_MS = 30_000

let configCache: { at: number; value: PlanCapacityConfig } | null = null

export function invalidatePlanCapacityCache() {
  configCache = null
}

function clampPct(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(1, Math.round(value)))
}

function buildDefaultConfig(): PlanCapacityConfig {
  const config = {} as PlanCapacityConfig
  for (const tier of PLAN_CAPACITY_TIERS) {
    config[tier] = {} as Record<PlanCapacityResource, ResolvedCapacityLimit>
    for (const resource of PLAN_CAPACITY_RESOURCE_KEYS) {
      const base = DEFAULT_PLAN_CAPACITY[tier][resource]
      config[tier][resource] = {
        ...base,
        warningPct: PLAN_CAPACITY_DEFAULT_WARNING_PCT,
        criticalPct: PLAN_CAPACITY_DEFAULT_CRITICAL_PCT,
        source: 'DEFAULT',
      }
    }
  }
  return config
}

/**
 * Lee la configuración de límites desde BD. Si la tabla aún no está migrada devuelve
 * `null` y se trabaja con los defaults (la plataforma nunca se cae por esto).
 */
async function loadLimitRows() {
  try {
    return await prisma.planLimitSetting.findMany({
      select: {
        planTier: true,
        resource: true,
        limitValue: true,
        period: true,
        overagePolicy: true,
        warningPct: true,
        criticalPct: true,
      },
    })
  } catch {
    return null
  }
}

async function loadCatalogStorageLimits(): Promise<Partial<Record<PlanTier, number | null>>> {
  try {
    const rows = await prisma.planCatalogSetting.findMany({
      select: { planTier: true, storageLimitGb: true },
    })
    return Object.fromEntries(rows.map((row) => [row.planTier, row.storageLimitGb])) as Partial<
      Record<PlanTier, number | null>
    >
  } catch {
    return {}
  }
}

/** Configuración resuelta (BD + defaults) para todos los planes. Cacheada 30s. */
export async function getPlanCapacityConfig(options?: { fresh?: boolean }): Promise<PlanCapacityConfig> {
  if (!options?.fresh && configCache && Date.now() - configCache.at < CONFIG_TTL_MS) {
    return configCache.value
  }

  const config = buildDefaultConfig()
  const [limitRows, catalogStorage] = await Promise.all([loadLimitRows(), loadCatalogStorageLimits()])

  // El límite de almacenamiento también vive en el catálogo de planes (`storageLimitGb`).
  // Se usa como respaldo cuando aún no existe una fila explícita en `plan_limit_settings`.
  if (catalogStorage) {
    for (const tier of PLAN_CAPACITY_TIERS) {
      const storage = catalogStorage[tier]
      if (typeof storage === 'number' || storage === null) {
        config[tier].ALMACENAMIENTO = {
          ...config[tier].ALMACENAMIENTO,
          limit: storage,
          source: 'CATALOG',
        }
      }
    }
  }

  for (const row of limitRows ?? []) {
    if (!PLAN_CAPACITY_TIERS.includes(row.planTier)) continue
    const resource = normalizePlanCapacityResource(row.resource)
    if (!resource) continue
    const base = config[row.planTier][resource]
    const period = normalizePlanCapacityPeriod(row.period)
    const policy = normalizePlanCapacityPolicy(row.overagePolicy)
    config[row.planTier][resource] = {
      limit: typeof row.limitValue === 'number' ? row.limitValue : null,
      period: period ?? base.period,
      policy: policy ?? base.policy,
      warningPct: clampPct(row.warningPct, PLAN_CAPACITY_DEFAULT_WARNING_PCT),
      criticalPct: clampPct(row.criticalPct, PLAN_CAPACITY_DEFAULT_CRITICAL_PCT),
      source: 'CUSTOM',
    }
  }

  configCache = { at: Date.now(), value: config }
  return config
}

const GB_BYTES = 1024 ** 3

export type PlanCapacityCompanyContext = {
  empresaId: string
  empresaNombre: string
  planTier: PlanTier
  /** La empresa factura solo módulos: el plan no impone topes de consumo. */
  moduleOnlyBilling: boolean
  limits: Record<PlanCapacityResource, ResolvedCapacityLimit>
}

function monthRange(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
}

export function getPlanCapacityPeriodStart(period: PlanCapacityPeriod, now = new Date()): Date {
  if (period === 'MONTHLY') return monthRange(now).from
  return new Date(0)
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Consumo real de la empresa para un recurso, en la unidad del recurso (unidades o GB). */
export async function getPlanCapacityUsage(args: {
  empresaId: string
  resource: PlanCapacityResource
  period: PlanCapacityPeriod
  now?: Date
}): Promise<number> {
  const now = args.now ?? new Date()
  const { from, to } = monthRange(now)
  const { empresaId } = args
  /**
   * Rango de fechas para los recursos transaccionales (cotizaciones, órdenes, remisiones).
   * `ACCUMULATED` cuenta todo el histórico; `MONTHLY` se reinicia con el mes calendario.
   * Los recursos de inventario (clientes, productos, sedes, …) no dependen del periodo.
   */
  const range = args.period === 'ACCUMULATED' ? { gte: new Date(0) } : { gte: from, lt: to }

  switch (args.resource) {
    case 'COTIZACIONES':
      return prisma.cotizacion.count({
        where: { cliente: { empresaId }, createdAt: range },
      })
    case 'ORDENES':
      return prisma.ordenTrabajo.count({
        where: { cliente: { empresaId }, createdAt: range },
      })
    case 'REMISIONES':
      return prisma.remision.count({
        where: { empresaId, createdAt: range },
      })
    case 'PRODUCTOS':
      return prisma.material.count({ where: { empresaId, activo: true } })
    case 'CLIENTES':
      return prisma.cliente.count({ where: { empresaId } })
    case 'PROVEEDORES':
      return prisma.proveedor.count({ where: { empresaId, activo: true } })
    case 'SEDES':
      return prisma.sede.count({ where: { empresaId } })
    case 'USUARIOS': {
      const memberships = await prisma.sedeMembership.findMany({
        where: { sede: { empresaId } },
        select: { userId: true },
      })
      return new Set(memberships.map((membership) => membership.userId)).size
    }
    case 'ALMACENAMIENTO': {
      const summary = await getEmpresaStorageUsageSummary({ empresaId })
      return roundTo(summary.usedBytes / GB_BYTES, 2)
    }
    default:
      return 0
  }
}

/** Contexto de capacidad (plan efectivo + límites resueltos) de una empresa. */
export async function getPlanCapacityCompanyContext(
  empresaId: string,
  options?: { fresh?: boolean }
): Promise<PlanCapacityCompanyContext | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      nombre: true,
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

  if (!empresa) return null

  const planContext: EmpresaPlanContext = {
    nit: empresa.nit ?? '',
    registrationCodeHash: empresa.registrationCodeHash ?? null,
    planTier: empresa.planTier,
    planValidUntil: empresa.planValidUntil,
    trialTier: empresa.trialTier,
    trialStartedAt: empresa.trialStartedAt,
    trialValidUntil: empresa.trialValidUntil,
    moduleOnlyBilling: empresa.moduleOnlyBilling,
  }

  const planTier = resolveEffectivePlanTier(planContext, new Date())
  const config = await getPlanCapacityConfig({ fresh: options?.fresh })
  const limits = await resolveCompanyCapacityLimits({
    empresaId: empresa.id,
    base: config[planTier],
    ignorePlanLimits: empresa.moduleOnlyBilling,
  })

  return {
    empresaId: empresa.id,
    empresaNombre: empresa.nombre ?? 'Tu empresa',
    planTier,
    moduleOnlyBilling: empresa.moduleOnlyBilling,
    limits,
  }
}

/**
 * Aplica a una empresa los límites de capacidad configurados desde super admin.
 *
 * Fuente principal: `empresa_capacity_overrides` (un registro por recurso, así que cubre
 * cotizaciones, productos, **sedes** y **usuarios**). Se mantiene compatibilidad con los
 * límites que quedaron guardados por módulo en `empresa_module_overrides`.
 *
 * Si la empresa factura solo módulos (`ignorePlanLimits`), el plan deja de imponer topes:
 * cada recurso queda ilimitado salvo que tenga un límite explícito.
 */
async function resolveCompanyCapacityLimits(args: {
  empresaId: string
  base: Record<PlanCapacityResource, ResolvedCapacityLimit>
  ignorePlanLimits?: boolean
}): Promise<Record<PlanCapacityResource, ResolvedCapacityLimit>> {
  const limits = {} as Record<PlanCapacityResource, ResolvedCapacityLimit>
  for (const resource of PLAN_CAPACITY_RESOURCE_KEYS) {
    const base = args.base[resource] ?? {
      limit: null,
      period: 'ACCUMULATED' as PlanCapacityPeriod,
      policy: 'BLOCK' as PlanCapacityOveragePolicy,
      warningPct: PLAN_CAPACITY_DEFAULT_WARNING_PCT,
      criticalPct: PLAN_CAPACITY_DEFAULT_CRITICAL_PCT,
      source: 'DEFAULT' as const,
    }
    limits[resource] = args.ignorePlanLimits
      ? { ...base, limit: null, source: 'DEFAULT' }
      : { ...base }
  }

  /** Recursos con configuración explícita de la empresa (la tabla nueva gana). */
  const configured = new Set<PlanCapacityResource>()

  try {
    const overrides = await prisma.empresaCapacityOverride.findMany({
      where: { empresaId: args.empresaId },
      select: { resource: true, limitValue: true, limitPeriod: true, overagePolicy: true },
    })

    for (const override of overrides) {
      const resource = normalizePlanCapacityResource(override.resource)
      if (!resource) continue

      const current = limits[resource]
      const period = normalizePlanCapacityPeriod(override.limitPeriod) ?? current.period
      const policy = normalizePlanCapacityPolicy(override.overagePolicy) ?? current.policy

      limits[resource] = {
        ...current,
        limit: typeof override.limitValue === 'number' ? override.limitValue : current.limit,
        period,
        policy,
        source: 'COMPANY',
      }
      configured.add(resource)
    }
  } catch {
    // Tabla sin migrar: la plataforma sigue operando con los límites del plan.
  }

  try {
    const legacy = await prisma.empresaModuleOverride.findMany({
      where: { empresaId: args.empresaId, limitValue: { not: null } },
      select: { module: true, limitValue: true, limitPeriod: true, overagePolicy: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
    })

    for (const override of legacy) {
      const resources = getModuleCapacityResources(override.module)
      // Solo se migra la configuración de módulos que alimentan un único recurso
      // (CONFIG alimenta sedes y usuarios: su límite por módulo es ambiguo).
      if (resources.length !== 1) continue
      const [resource] = resources
      if (configured.has(resource) || typeof override.limitValue !== 'number') continue

      const current = limits[resource]
      limits[resource] = {
        ...current,
        limit: override.limitValue,
        period: normalizePlanCapacityPeriod(override.limitPeriod) ?? current.period,
        policy: normalizePlanCapacityPolicy(override.overagePolicy) ?? current.policy,
        source: 'COMPANY',
      }
      configured.add(resource)
    }
  } catch {
    // Tabla de overrides por módulo sin migrar: nada que hacer.
  }

  return limits
}

export type PlanCapacityMeter = {
  resource: PlanCapacityResource
  label: string
  shortLabel: string
  unit: string
  period: PlanCapacityPeriod
  policy: PlanCapacityOveragePolicy
  limit: number | null
  used: number
  remaining: number | null
  percentage: number
  level: PlanCapacityLevel
  allowed: boolean
  warningPct: number
  criticalPct: number
  planTier: PlanTier
  upgradeUrl: string
  message: string
  description: string
  blockedOperations: string[]
  allowedOperations: string[]
}

export function resolvePlanCapacityLevel(
  percentage: number,
  warningPct: number,
  criticalPct: number
): PlanCapacityLevel {
  if (percentage >= 100) return 'reached'
  if (percentage >= criticalPct) return 'critical'
  if (percentage >= warningPct) return 'warning'
  return 'ok'
}

export function buildPlanCapacityMeter(args: {
  meta: PlanCapacityResourceMeta
  resolved: ResolvedCapacityLimit
  used: number
  planTier: PlanTier
}): PlanCapacityMeter {
  const { meta, resolved, planTier } = args
  const limit = resolved.limit
  const decimals = meta.unit ? 2 : 0
  const used = roundTo(args.used, decimals)

  const rawPercentage = limit === null ? 0 : limit <= 0 ? 100 : (used / limit) * 100
  const percentage = roundTo(Math.min(rawPercentage, 999), 1)
  const level = limit === null ? 'ok' : resolvePlanCapacityLevel(percentage, resolved.warningPct, resolved.criticalPct)
  const remaining = limit === null ? null : roundTo(Math.max(limit - used, 0), decimals)
  const allowed = limit === null ? true : level !== 'reached' || resolved.policy !== 'BLOCK'

  return {
    resource: meta.resource,
    label: meta.label,
    shortLabel: meta.shortLabel,
    unit: meta.unit,
    period: resolved.period,
    policy: resolved.policy,
    limit,
    used,
    remaining,
    percentage,
    level,
    allowed,
    warningPct: resolved.warningPct,
    criticalPct: resolved.criticalPct,
    planTier,
    upgradeUrl: PLAN_CAPACITY_UPGRADE_URL,
    message: buildPlanCapacityMessage({ meta, used, limit, percentage, level, policy: resolved.policy, remaining }),
    description: meta.description,
    blockedOperations: meta.blockedOperations,
    allowedOperations: meta.allowedOperations,
  }
}

export function formatPlanCapacityNumber(value: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value)
}

export function formatPlanCapacityAmount(value: number | null, unit: string): string {
  if (value === null) return 'Ilimitado'
  const base = formatPlanCapacityNumber(value)
  return unit ? `${base} ${unit}` : base
}

function buildPlanCapacityMessage(args: {
  meta: PlanCapacityResourceMeta
  used: number
  limit: number | null
  percentage: number
  level: PlanCapacityLevel
  policy: PlanCapacityOveragePolicy
  remaining: number | null
}): string {
  const { meta, used, limit, percentage, level, policy, remaining } = args
  const label = meta.label.toLowerCase()

  if (limit === null) {
    return `Consumo de ${label} sin límite en tu plan actual.`
  }

  const usedLabel = formatPlanCapacityAmount(used, meta.unit)
  const limitLabel = formatPlanCapacityAmount(limit, meta.unit)
  const remainingLabel = formatPlanCapacityAmount(remaining ?? 0, meta.unit)
  const pctLabel = formatPlanCapacityNumber(percentage)

  if (level === 'reached') {
    if (policy === 'BLOCK') {
      return `Capacidad alcanzada en ${label} (${usedLabel} de ${limitLabel}). Las nuevas operaciones están bloqueadas; puedes seguir consultando y exportando tu histórico o ampliar tu plan.`
    }
    if (policy === 'OVERAGE') {
      return `Superaste la capacidad incluida de ${label} (${usedLabel} de ${limitLabel}). Puedes continuar: el excedente se cobra como consumo adicional.`
    }
    return `Superaste la capacidad incluida de ${label} (${usedLabel} de ${limitLabel}). Puedes continuar, pero tu plan requiere ampliación.`
  }

  if (level === 'critical') {
    return `Alerta: ${pctLabel}% de ${label} consumido (${usedLabel} de ${limitLabel}). Disponible: ${remainingLabel}.`
  }

  if (level === 'warning') {
    return `Aviso preventivo: ${pctLabel}% de ${label} consumido (${usedLabel} de ${limitLabel}). Disponible: ${remainingLabel}.`
  }

  return `${pctLabel}% de ${label} consumido (${usedLabel} de ${limitLabel}).`
}

const CAPACITY_LEVEL_TITLES: Record<Exclude<PlanCapacityLevel, 'ok'>, string> = {
  warning: 'Aviso preventivo de capacidad',
  critical: 'Alerta de capacidad',
  reached: 'Capacidad alcanzada',
}

const CAPACITY_LEVEL_NOTIFICATION_TYPES = {
  warning: 'INFO',
  critical: 'WARNING',
  reached: 'ERROR',
} as const

function buildCapacityNotificationTitle(meter: PlanCapacityMeter): string {
  const level = meter.level as Exclude<PlanCapacityLevel, 'ok'>
  return `${CAPACITY_LEVEL_TITLES[level]}: ${meter.label}`
}

/**
 * Notifica a los administradores de la empresa cuando el consumo cruza los umbrales
 * definidos (80% / 90% / 100%). Deduplica por nivel y período para no generar ruido:
 * un aviso por recurso y por nivel en cada mes.
 */
export async function notifyPlanCapacityThreshold(args: {
  companyId: string
  meter: PlanCapacityMeter
}): Promise<{ created: number; skipped: number }> {
  const { meter, companyId } = args
  if (meter.level === 'ok') return { created: 0, skipped: 0 }

  const level = meter.level as Exclude<PlanCapacityLevel, 'ok'>
  const title = buildCapacityNotificationTitle(meter)
  const periodStart = getPlanCapacityPeriodStart(meter.period)

  try {
    let recipients = await prisma.user.findMany({
      where: { empresaId: companyId, role: 'ADMIN' },
      select: { id: true },
      take: 25,
    })

    if (recipients.length === 0) {
      recipients = await prisma.user.findMany({
        where: { empresaId: companyId },
        select: { id: true },
        take: 5,
      })
    }

    if (recipients.length === 0) return { created: 0, skipped: 0 }

    let created = 0
    let skipped = 0

    for (const recipient of recipients) {
      const existing = await prisma.notification.findFirst({
        where: { userId: recipient.id, title, createdAt: { gte: periodStart } },
        select: { id: true },
      })

      if (existing) {
        skipped += 1
        continue
      }

      await prisma.notification.create({
        data: {
          userId: recipient.id,
          empresaId: companyId,
          type: CAPACITY_LEVEL_NOTIFICATION_TYPES[level],
          title,
          body: meter.message,
          actionUrl: meter.upgradeUrl,
          actionLabel: 'Ampliar capacidad',
        },
      })
      created += 1
    }

    return { created, skipped }
  } catch {
    // Nunca bloqueamos una operación por fallas al notificar.
    return { created: 0, skipped: 0 }
  }
}

export type PlanCapacityCheck = PlanCapacityMeter & {
  companyId: string
  asOf: string
}

export type CheckPlanCapacityArgs = {
  companyId: string
  resource: string | PlanCapacityResource
  period?: string | PlanCapacityPeriod | null
  /** Default true: emite notificación escalonada cuando cruza 80/90/100%. */
  notify?: boolean
  now?: Date
}

/**
 * Punto único de control de capacidad.
 *
 * Devuelve `{ resource, limit, used, remaining, percentage, allowed }` (más metadatos de
 * alerta) para que cualquier flujo decida si permite o rechaza la operación.
 */
export async function checkPlanCapacity(args: CheckPlanCapacityArgs): Promise<PlanCapacityCheck> {
  const now = args.now ?? new Date()
  const resource = normalizePlanCapacityResource(String(args.resource))
  const requestedPeriod = normalizePlanCapacityPeriod(args.period ?? null)

  if (!resource) {
    throw new Error(`Recurso de capacidad no reconocido: ${String(args.resource)}`)
  }

  const meta = getPlanCapacityResourceMeta(resource)
  const context = await getPlanCapacityCompanyContext(args.companyId)

  if (!context) {
    // Empresa sin contexto (id inválido o dato borrado): no se bloquean operaciones.
    const fallback = buildPlanCapacityMeter({
      meta,
      resolved: {
        limit: null,
        period: requestedPeriod ?? meta.period,
        policy: meta.policy,
        warningPct: PLAN_CAPACITY_DEFAULT_WARNING_PCT,
        criticalPct: PLAN_CAPACITY_DEFAULT_CRITICAL_PCT,
        source: 'DEFAULT',
      },
      used: 0,
      planTier: 'FULL',
    })
    return { ...fallback, companyId: args.companyId, asOf: now.toISOString() }
  }

  const resolved = context.limits[resource]
  const period = requestedPeriod ?? resolved.period
  const used = await getPlanCapacityUsage({ empresaId: context.empresaId, resource, period, now })

  const meter = buildPlanCapacityMeter({
    meta,
    resolved: { ...resolved, period },
    used,
    planTier: context.planTier,
  })

  if (args.notify !== false && meter.level !== 'ok') {
    await notifyPlanCapacityThreshold({ companyId: context.empresaId, meter })
  }

  return { ...meter, companyId: context.empresaId, asOf: now.toISOString() }
}

export type PlanCapacitySnapshot = {
  companyId: string
  companyName: string
  planTier: PlanTier
  generatedAt: string
  meters: PlanCapacityMeter[]
  summary: {
    level: PlanCapacityLevel
    alerts: number
    blocked: number
  }
}

const LEVEL_SEVERITY: Record<PlanCapacityLevel, number> = { ok: 0, warning: 1, critical: 2, reached: 3 }

/** Foto completa de consumo de una empresa (todos los recursos). */
export async function getPlanCapacitySnapshot(args: {
  companyId: string
  fresh?: boolean
  notify?: boolean
  now?: Date
}): Promise<PlanCapacitySnapshot | null> {
  const now = args.now ?? new Date()
  const context = await getPlanCapacityCompanyContext(args.companyId, { fresh: args.fresh })
  if (!context) return null

  const meters = await Promise.all(
    PLAN_CAPACITY_RESOURCES.map(async (meta) => {
      const resolved = context.limits[meta.resource]
      const used = await getPlanCapacityUsage({
        empresaId: context.empresaId,
        resource: meta.resource,
        period: resolved.period,
        now,
      })
      return buildPlanCapacityMeter({ meta, resolved, used, planTier: context.planTier })
    })
  )

  if (args.notify) {
    for (const meter of meters) {
      if (meter.level !== 'ok') {
        await notifyPlanCapacityThreshold({ companyId: context.empresaId, meter })
      }
    }
  }

  const worst = meters.reduce<PlanCapacityLevel>(
    (acc, meter) => (LEVEL_SEVERITY[meter.level] > LEVEL_SEVERITY[acc] ? meter.level : acc),
    'ok'
  )

  return {
    companyId: context.empresaId,
    companyName: context.empresaNombre,
    planTier: context.planTier,
    generatedAt: now.toISOString(),
    meters,
    summary: {
      level: worst,
      alerts: meters.filter((meter) => meter.level === 'warning' || meter.level === 'critical').length,
      blocked: meters.filter((meter) => !meter.allowed).length,
    },
  }
}
