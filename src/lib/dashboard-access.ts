import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEffectiveAccessMap, NAV_MODULES } from '@/lib/rbac'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { DASHBOARD_NAV_CATALOG } from '@/lib/product-architecture'
import {
  type RbacV2CapabilityAction,
  type RbacV2Domain,
  type RbacV2Scope,
  RBAC_V2_CAPABILITY_CATALOG,
  getLegacyModuleRbacV2Mapping,
} from '@/lib/rbac-v2-catalog'
import { moduleForDashboardHref } from '@/lib/dashboard-navigation'

type CapabilityRef = {
  domain: RbacV2Domain
  subdomain: string
}

type DashboardPermissionRule = {
  key: string
  moduleKey: ModuleKey
  section: string
  label: string
  hrefs: string[]
  capabilities: CapabilityRef[]
}

type DashboardAccessContext = {
  userId: string
  empresaId: string
  sedeId: string
  isSuperAdmin: boolean
  legacyAccess: Partial<Record<ModuleKey, AccessLevel>>
  disabledDomains: Set<string>
  disabledCapabilities: Set<string>
  grantsByCapability: Map<string, Array<{ allowed: boolean; scopeType: string; scopeValue: string | null }>>
}

type BuildPermissionEntriesArgs = {
  t?: ((key: string) => string) | null
}

const ACCESS_ORDER: Record<AccessLevel, number> = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3,
}

export const DASHBOARD_PERMISSION_RULES: DashboardPermissionRule[] = [
  {
    key: 'CORE.DASHBOARD',
    moduleKey: ModuleKey.DASHBOARD,
    section: 'Núcleo',
    label: 'Dashboard',
    hrefs: ['/dashboard', '/dashboard/mapa-producto', '/dashboard/plantillas'],
    capabilities: [{ domain: 'CORE', subdomain: 'DASHBOARD' }],
  },
  {
    key: 'CORE.NOTIFICATIONS',
    moduleKey: ModuleKey.NOTIFICACIONES,
    section: 'Núcleo',
    label: 'Notificaciones',
    hrefs: ['/dashboard/notificaciones', '/dashboard/notificaciones/crear'],
    capabilities: [{ domain: 'CORE', subdomain: 'DASHBOARD' }],
  },
  {
    key: 'CAPTACION.OPPORTUNITIES',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Frente comercial',
    hrefs: ['/dashboard/crm', '/dashboard/crm/oportunidades'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'OPPORTUNITIES' }],
  },
  {
    key: 'CAPTACION.INBOX',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Inbox omnicanal',
    hrefs: ['/dashboard/crm/conversations'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'INBOX' }],
  },
  {
    key: 'CAPTACION.AGENDA',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Agenda CRM',
    hrefs: ['/dashboard/crm/agenda'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'AGENDA' }],
  },
  {
    key: 'IA.COMMERCIAL_AI',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Chatbot e IA comercial',
    hrefs: ['/dashboard/crm/chatbot', '/dashboard/crm/auditoria-ia'],
    capabilities: [{ domain: 'IA', subdomain: 'COMMERCIAL_AI' }],
  },
  {
    key: 'OPERACIONES.FILES',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Administrador de archivos',
    hrefs: ['/dashboard/crm/archivos'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'FILES' }],
  },
  {
    key: 'CAPTACION.CHANNELS',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Canales e integraciones',
    hrefs: ['/dashboard/crm/integraciones'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'CHANNELS' }],
  },
  {
    key: 'CAPTACION.LEADS',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Captación',
    hrefs: ['/dashboard/crm/leads'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'LEADS' }],
  },
  {
    key: 'CAPTACION.COMMERCIAL_TASKS',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Tareas',
    hrefs: ['/dashboard/crm/tareas'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'COMMERCIAL_TASKS' }],
  },
  {
    key: 'VENTAS.CUSTOMERS',
    moduleKey: ModuleKey.CLIENTES,
    section: 'Ventas',
    label: 'Clientes',
    hrefs: ['/dashboard/clientes'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'CUSTOMERS' }],
  },
  {
    key: 'VENTAS.QUOTER',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'Ventas',
    label: 'Cotizador',
    hrefs: ['/dashboard/cotizador'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'QUOTER' }],
  },
  {
    key: 'VENTAS.QUOTES',
    moduleKey: ModuleKey.COTIZACIONES,
    section: 'Ventas',
    label: 'Cotizaciones',
    hrefs: ['/dashboard/cotizaciones'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'QUOTES' }],
  },
  {
    key: 'VENTAS.DELIVERY_NOTES',
    moduleKey: ModuleKey.REMISIONES,
    section: 'Ventas',
    label: 'Remisiones',
    hrefs: ['/dashboard/remisiones'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'DELIVERY_NOTES' }],
  },
  {
    key: 'VENTAS.POS',
    moduleKey: ModuleKey.POS,
    section: 'Ventas',
    label: 'Facturación POS',
    hrefs: ['/dashboard/pos'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'POS' }],
  },
  {
    key: 'OPERACIONES.WORK_ORDERS',
    moduleKey: ModuleKey.ORDENES,
    section: 'Operaciones',
    label: 'Órdenes de trabajo',
    hrefs: ['/dashboard/ordenes', '/dashboard/litografia'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'WORK_ORDERS' }],
  },
  {
    key: 'OPERACIONES.TASK_WORKSPACES',
    moduleKey: ModuleKey.CRM,
    section: 'Operaciones',
    label: 'Espacios de trabajo',
    hrefs: ['/dashboard/espacios-trabajo'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'TASK_WORKSPACES' }],
  },
  {
    key: 'OPERACIONES.INTERNAL_CHAT',
    moduleKey: ModuleKey.CRM,
    section: 'Operaciones',
    label: 'Chat global',
    hrefs: ['/dashboard/chat'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'INTERNAL_CHAT' }],
  },
  {
    key: 'OPERACIONES.DOCUMENT_CAPTURE',
    moduleKey: ModuleKey.ESCANEOS,
    section: 'Operaciones',
    label: 'Escaneos',
    hrefs: ['/dashboard/escaneos'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'DOCUMENT_CAPTURE' }],
  },
  {
    key: 'RECURSOS.PRODUCTS',
    moduleKey: ModuleKey.MATERIALES,
    section: 'Recursos',
    label: 'Productos',
    hrefs: ['/dashboard/productos'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'PRODUCTS' }],
  },
  {
    key: 'RECURSOS.MATERIALS',
    moduleKey: ModuleKey.MATERIALES,
    section: 'Recursos',
    label: 'Materiales',
    hrefs: ['/dashboard/materiales', '/dashboard/terminados'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'MATERIALS' }],
  },
  {
    key: 'RECURSOS.INVENTORY',
    moduleKey: ModuleKey.INVENTARIO,
    section: 'Recursos',
    label: 'Inventario',
    hrefs: ['/dashboard/inventario', '/dashboard/bodegas'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'INVENTORY' }],
  },
  {
    key: 'RECURSOS.TRANSFERS',
    moduleKey: ModuleKey.INVENTARIO,
    section: 'Recursos',
    label: 'Traslados',
    hrefs: ['/dashboard/inventario/traslados'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'TRANSFERS' }],
  },
  {
    key: 'RECURSOS.PURCHASES',
    moduleKey: ModuleKey.COMPRAS,
    section: 'Recursos',
    label: 'Compras',
    hrefs: ['/dashboard/compras'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'PURCHASES' }],
  },
  {
    key: 'RECURSOS.SUPPLIERS',
    moduleKey: ModuleKey.PROVEEDORES,
    section: 'Recursos',
    label: 'Proveedores',
    hrefs: ['/dashboard/proveedores'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'SUPPLIERS' }],
  },
  {
    key: 'FINANZAS.ACCOUNTING',
    moduleKey: ModuleKey.CONTABILIDAD,
    section: 'Finanzas',
    label: 'Contabilidad',
    hrefs: ['/dashboard/contabilidad'],
    capabilities: [{ domain: 'FINANZAS', subdomain: 'ACCOUNTING' }],
  },
  {
    key: 'FINANZAS.PAYROLL',
    moduleKey: ModuleKey.CONTABILIDAD,
    section: 'Finanzas',
    label: 'Nómina',
    hrefs: ['/dashboard/contabilidad/nomina'],
    capabilities: [{ domain: 'FINANZAS', subdomain: 'PAYROLL' }],
  },
  {
    key: 'ANALITICA.REPORTS',
    moduleKey: ModuleKey.REPORTES,
    section: 'Analítica',
    label: 'Reportes',
    hrefs: ['/dashboard/reportes'],
    capabilities: [{ domain: 'ANALITICA', subdomain: 'REPORTS' }],
  },
  {
    key: 'ANALITICA.AUDITS',
    moduleKey: ModuleKey.REPORTES,
    section: 'Analítica',
    label: 'Auditorías',
    hrefs: ['/dashboard/litografia/auditoria-ia'],
    capabilities: [{ domain: 'ANALITICA', subdomain: 'AUDITS' }],
  },
  {
    key: 'IA.OPERATIONAL_AI',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'IA',
    label: 'Conocimiento IA',
    hrefs: ['/dashboard/litografia/conocimiento-ia'],
    capabilities: [{ domain: 'IA', subdomain: 'OPERATIONAL_AI' }],
  },
  {
    key: 'IA.CREATIVE_AI',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'IA',
    label: 'IA creativa',
    hrefs: ['/dashboard/litografia/imagenes-ia', '/dashboard/imagenes-ia', '/dashboard/imagenes-ia/generador', '/dashboard/imagenes-ia/vectorizador'],
    capabilities: [{ domain: 'IA', subdomain: 'CREATIVE_AI' }],
  },
  {
    key: 'VERTICALES.RESTAURANTE',
    moduleKey: ModuleKey.POS,
    section: 'Verticales',
    label: 'Restaurante',
    hrefs: ['/dashboard/restaurante'],
    capabilities: [{ domain: 'VERTICALES', subdomain: 'RESTAURANTE' }],
  },
  {
    key: 'VERTICALES.ODONTOLOGIA',
    moduleKey: ModuleKey.CLIENTES,
    section: 'Verticales',
    label: 'Odontología',
    hrefs: ['/dashboard/odontologia'],
    capabilities: [{ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA' }],
  },
  {
    key: 'VERTICALES.DOTACIONES',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'Verticales',
    label: 'Dotaciones',
    hrefs: ['/dashboard/dotaciones'],
    capabilities: [{ domain: 'VERTICALES', subdomain: 'DOTACIONES' }],
  },
  {
    key: 'CORE.COMPANY',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Empresa y sedes',
    hrefs: ['/dashboard/configuracion/empresa', '/dashboard/configuracion/sedes'],
    capabilities: [{ domain: 'CORE', subdomain: 'COMPANY' }],
  },
  {
    key: 'CORE.USERS',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Usuarios',
    hrefs: ['/dashboard/configuracion/usuarios'],
    capabilities: [{ domain: 'CORE', subdomain: 'USERS' }],
  },
  {
    key: 'CORE.ROLES',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Permisos',
    hrefs: ['/dashboard/configuracion/permisos'],
    capabilities: [{ domain: 'CORE', subdomain: 'ROLES' }],
  },
  {
    key: 'CORE.WEB_SERVICES',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Servicios web',
    hrefs: ['/dashboard/configuracion/servicios-web'],
    capabilities: [{ domain: 'CORE', subdomain: 'WEB_SERVICES' }],
  },
  {
    key: 'CORE.PLANS',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Plan',
    hrefs: ['/dashboard/configuracion/plan'],
    capabilities: [{ domain: 'CORE', subdomain: 'PLANS' }],
  },
]

export function capabilityActionToAccessLevel(action: RbacV2CapabilityAction): AccessLevel {
  switch (action) {
    case 'READ':
    case 'EXPORT':
      return 'READ'
    case 'CREATE':
    case 'UPDATE':
    case 'ASSIGN':
    case 'EXECUTE':
    case 'CLOSE':
      return 'WRITE'
    case 'DELETE':
    case 'APPROVE':
    case 'AUDIT':
    case 'CONFIGURE':
      return 'ADMIN'
    default:
      return 'READ'
  }
}

export function getCapabilityDefinition(domain: RbacV2Domain, subdomain: string) {
  return RBAC_V2_CAPABILITY_CATALOG.find((item) => item.domain === domain && item.subdomain === subdomain) ?? null
}

export function buildDashboardPermissionEntries(args: BuildPermissionEntriesArgs = {}) {
  const labelByHref = new Map(
    DASHBOARD_NAV_CATALOG.map((item) => [item.href, args.t && item.labelKey ? args.t(item.labelKey) : item.label])
  )

  return DASHBOARD_PERMISSION_RULES.map((rule) => ({
    ...rule,
    includeLabels: rule.hrefs.map((href) => labelByHref.get(href) ?? href),
  }))
}

export function deriveExplicitCapabilityLevel(args: {
  domain: RbacV2Domain
  subdomain: string
  grants: Array<{ action: string; allowed: boolean }>
}): AccessLevel | null {
  const definition = getCapabilityDefinition(args.domain, args.subdomain)
  if (!definition || !args.grants.length) return null

  const allowedLevels = new Set<AccessLevel>()
  let hasAnyGrant = false

  for (const action of definition.actions) {
    const grant = args.grants.find((item) => item.action === action)
    if (!grant) continue
    hasAnyGrant = true
    if (grant.allowed) {
      allowedLevels.add(capabilityActionToAccessLevel(action))
    }
  }

  if (!hasAnyGrant) return null
  if (allowedLevels.has('ADMIN')) return 'ADMIN'
  if (allowedLevels.has('WRITE')) return 'WRITE'
  if (allowedLevels.has('READ')) return 'READ'
  return 'NONE'
}

async function buildDashboardAccessContext(args: {
  userId: string
  empresaId: string
  sedeId: string
}): Promise<DashboardAccessContext> {
  const [user, legacyAccess, domainEntitlements, capabilityEntitlements, grants] = await Promise.all([
    prisma.user.findUnique({ where: { id: args.userId }, select: { email: true } }),
    getEffectiveAccessMap({ userId: args.userId, sedeId: args.sedeId, modules: NAV_MODULES }),
    prisma.domainEntitlement.findMany({ where: { empresaId: args.empresaId }, select: { domain: true, enabled: true } }),
    prisma.capabilityEntitlement.findMany({ where: { empresaId: args.empresaId }, select: { domain: true, subdomain: true, action: true, enabled: true } }),
    prisma.userCapabilityGrant.findMany({
      where: { empresaId: args.empresaId, userId: args.userId },
      select: { domain: true, subdomain: true, action: true, allowed: true, scopeType: true, scopeValue: true },
    }),
  ])

  const disabledDomains = new Set(domainEntitlements.filter((row) => !row.enabled).map((row) => row.domain))
  const disabledCapabilities = new Set(
    capabilityEntitlements
      .filter((row) => !row.enabled)
      .map((row) => `${row.domain}.${row.subdomain}.${row.action}`)
  )
  const grantsByCapability = new Map<string, Array<{ allowed: boolean; scopeType: string; scopeValue: string | null }>>()
  for (const grant of grants) {
    const key = `${grant.domain}.${grant.subdomain}.${grant.action}`
    const current = grantsByCapability.get(key) ?? []
    current.push({ allowed: grant.allowed, scopeType: grant.scopeType, scopeValue: grant.scopeValue })
    grantsByCapability.set(key, current)
  }

  return {
    userId: args.userId,
    empresaId: args.empresaId,
    sedeId: args.sedeId,
    isSuperAdmin: isSuperAdminEmail(user?.email),
    legacyAccess,
    disabledDomains,
    disabledCapabilities,
    grantsByCapability,
  }
}

function grantMatchesScope(args: {
  requestedScope?: RbacV2Scope
  grantScopeType: string
  grantScopeValue: string | null
  empresaId: string
  sedeId: string
}) {
  switch (args.grantScopeType) {
    case 'GLOBAL_PLATFORM':
      return !args.requestedScope || args.requestedScope === 'GLOBAL_PLATFORM'
    case 'EMPRESA':
      return (!args.requestedScope || args.requestedScope === 'EMPRESA')
        && (!args.grantScopeValue || args.grantScopeValue === args.empresaId)
    case 'SEDE':
      return (!args.requestedScope || args.requestedScope === 'SEDE')
        && (!args.grantScopeValue || args.grantScopeValue === args.sedeId)
    case 'TEAM':
    case 'OWN':
    case 'ASSIGNED':
    case 'VERTICAL':
      return args.requestedScope === args.grantScopeType
    default:
      return false
  }
}

function getLegacyModulesForCapability(args: CapabilityRef): ModuleKey[] {
  const modules = new Set<ModuleKey>()
  for (const moduleKey of Object.values(ModuleKey)) {
    const mapping = getLegacyModuleRbacV2Mapping(moduleKey)
    if (!mapping) continue
    if (mapping.targets.some((target) => target.domain === args.domain && target.subdomains.includes(args.subdomain))) {
      modules.add(moduleKey)
    }
  }
  return [...modules]
}

function canAccessCapabilityFromContext(args: {
  context: DashboardAccessContext
  capability: CapabilityRef
  action: RbacV2CapabilityAction
  scope?: RbacV2Scope
}) {
  if (args.context.isSuperAdmin) return true
  if (args.context.disabledDomains.has(args.capability.domain)) return false
  const capabilityId = `${args.capability.domain}.${args.capability.subdomain}.${args.action}`
  if (args.context.disabledCapabilities.has(capabilityId)) return false

  const grants = args.context.grantsByCapability.get(capabilityId) ?? []
  const applicable = grants.filter((grant) =>
    grantMatchesScope({
      requestedScope: args.scope,
      grantScopeType: grant.scopeType,
      grantScopeValue: grant.scopeValue,
      empresaId: args.context.empresaId,
      sedeId: args.context.sedeId,
    })
  )

  if (applicable.some((grant) => !grant.allowed)) return false
  if (applicable.some((grant) => grant.allowed)) return true

  const neededLevel = capabilityActionToAccessLevel(args.action)
  return getLegacyModulesForCapability(args.capability).some((moduleKey) => {
    const level = args.context.legacyAccess[moduleKey] ?? 'NONE'
    return ACCESS_ORDER[level] >= ACCESS_ORDER[neededLevel]
  })
}

export async function buildAllowedDashboardHrefsForUser(args: {
  userId: string
  empresaId: string
  sedeId: string
  baseAllowedHrefs?: string[] | null
}) {
  const context = await buildDashboardAccessContext(args)
  const baseSet = args.baseAllowedHrefs?.length ? new Set(args.baseAllowedHrefs) : null
  const hrefs = new Set<string>()

  for (const item of DASHBOARD_NAV_CATALOG) {
    if (baseSet && item.href !== '/dashboard' && !baseSet.has(item.href)) continue

    const rule = DASHBOARD_PERMISSION_RULES.find((entry) => entry.hrefs.includes(item.href))
    if (!rule) {
      const moduleKey = moduleForDashboardHref(item.href)
      if (!moduleKey) {
        hrefs.add(item.href)
        continue
      }
      const level = context.legacyAccess[moduleKey as ModuleKey] ?? 'NONE'
      if (level !== 'NONE') hrefs.add(item.href)
      continue
    }

    const canRead = rule.capabilities.some((capability) => {
      const definition = getCapabilityDefinition(capability.domain, capability.subdomain)
      const actions: RbacV2CapabilityAction[] = definition?.actions.includes('READ')
        ? ['READ']
        : (definition?.actions.filter((action) => capabilityActionToAccessLevel(action) === 'READ') ?? ['READ'])
      return actions.some((action) => canAccessCapabilityFromContext({
        context,
        capability,
        action,
      }))
    })

    if (canRead) hrefs.add(item.href)
  }

  hrefs.add('/dashboard')
  return [...hrefs]
}

export function getAllowedModulesFromDashboardHrefs(hrefs: string[]) {
  const modules = new Set<ModuleKey>()
  for (const href of hrefs) {
    const moduleKey = moduleForDashboardHref(href)
    if (moduleKey) modules.add(moduleKey as ModuleKey)
  }
  return [...modules]
}