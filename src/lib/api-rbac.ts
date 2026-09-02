import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser, getEffectiveAccess, requireSedeAccess } from '@/lib/rbac'
import {
  getLegacyModuleRbacV2Mapping,
  type RbacV2CapabilityAction,
  type RbacV2Domain,
  type RbacV2Scope,
} from '@/lib/rbac-v2-catalog'
import { isSuperAdminEmail } from '@/lib/super-admin'
import type { Session } from 'next-auth'
import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { resolveUserIdFromSession } from '@/lib/session-user'
import {
  EXTERNAL_DASHBOARD_SCOPE_COOKIE,
  EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING,
  isCapabilityAllowedForExternalDashboardScope,
  isModuleAllowedForExternalDashboardScope,
} from '@/lib/external-dashboard-scope'

export type ApiAccessOk = {
  ok: true
  session: Session
  userId: string
  sedeId: string
  empresaId: string
  membershipRole: SedeRole | null
  isSystemSuperAdmin: boolean
}

export type ApiAccessFail = {
  ok: false
  response: NextResponse
}

export type ApiCapabilityAccessArgs = {
  domain: RbacV2Domain
  subdomain: string
  action: RbacV2CapabilityAction
  scope?: RbacV2Scope
  sedeId?: string
  allowLegacyFallback?: boolean
}

export type ApiCapabilityAccessOk = ApiAccessOk & {
  capability: ApiCapabilityAccessArgs
  matchedLegacyModule: ModuleKey | null
  legacyModulesChecked: ModuleKey[]
  resolvedBy: 'rbac-v2-grant' | 'legacy-module-fallback'
}

const ISOLATED_VERTICAL_HREFS: Partial<Record<string, string>> = {
  ODONTOLOGIA: '/dashboard/odontologia',
  RESTAURANTE: '/dashboard/restaurante',
  DOTACIONES: '/dashboard/dotaciones',
}

const MODULE_LABELS: Record<ModuleKey, string> = {
  DASHBOARD: 'Dashboard',
  COTIZADOR: 'Cotizador',
  COTIZACIONES: 'Cotizaciones',
  CLIENTES: 'Clientes',
  CRM: 'CRM',
  MATERIALES: 'Materiales',
  INVENTARIO: 'Inventario',
  REMISIONES: 'Remisiones',
  POS: 'POS',
  PROVEEDORES: 'Proveedores',
  COMPRAS: 'Compras',
  ORDENES: 'Órdenes',
  ESCANEOS: 'Escaneos',
  REPORTES: 'Reportes',
  CONTABILIDAD: 'Contabilidad',
  NOTIFICACIONES: 'Notificaciones',
  CONFIG: 'Configuración',
}

const CAPABILITY_ACTION_LABELS: Record<RbacV2CapabilityAction, string> = {
  READ: 'ver',
  CREATE: 'crear',
  UPDATE: 'editar',
  DELETE: 'eliminar',
  EXPORT: 'exportar',
  ASSIGN: 'asignar',
  EXECUTE: 'ejecutar',
  APPROVE: 'aprobar',
  CLOSE: 'cerrar',
  AUDIT: 'auditar',
  CONFIGURE: 'configurar',
}

function formatModuleLabel(moduleKey: ModuleKey) {
  return MODULE_LABELS[moduleKey] ?? moduleKey
}

function formatAccessIntent(minLevel: AccessLevel) {
  switch (minLevel) {
    case 'READ':
      return 'usar'
    case 'WRITE':
      return 'editar'
    case 'ADMIN':
      return 'administrar'
    default:
      return 'usar'
  }
}

function formatCapabilityLabel(args: Pick<ApiCapabilityAccessArgs, 'domain' | 'subdomain'>) {
  const subdomain = args.subdomain
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .join(' ')

  return `${subdomain || 'funcionalidad'} de ${args.domain.toLowerCase()}`
}

function formatModuleList(moduleKeys: ModuleKey[]) {
  const labels = Array.from(new Set(moduleKeys.map((moduleKey) => formatModuleLabel(moduleKey))))

  if (!labels.length) return null
  if (labels.length === 1) return `al módulo ${labels[0]}`
  if (labels.length === 2) return `a alguno de estos módulos: ${labels[0]} o ${labels[1]}`
  return `a alguno de estos módulos: ${labels.slice(0, -1).join(', ')} o ${labels[labels.length - 1]}`
}

export function buildModuleAccessDeniedMessage(moduleKey: ModuleKey, minLevel: AccessLevel) {
  const moduleLabel = formatModuleLabel(moduleKey)
  const accessIntent = formatAccessIntent(minLevel)
  return `No tienes acceso para ${accessIntent} el módulo ${moduleLabel}. Pídele a tu administrador que te habilite acceso a este módulo para continuar.`
}

function buildCapabilityAccessDeniedMessage(args: ApiCapabilityAccessArgs, moduleKeys: ModuleKey[] = []) {
  const capabilityLabel = formatCapabilityLabel(args)
  const actionLabel = CAPABILITY_ACTION_LABELS[args.action] ?? 'usar'
  const moduleHint = formatModuleList(moduleKeys)

  if (moduleHint) {
    return `No tienes permiso para ${actionLabel} la ${capabilityLabel}. Pídele a tu administrador que te habilite acceso ${moduleHint} para continuar.`
  }

  return `No tienes permiso para ${actionLabel} la ${capabilityLabel}. Pídele a tu administrador que te habilite este permiso para continuar.`
}

function buildPlanCapabilityDeniedMessage(args: ApiCapabilityAccessArgs, moduleKeys: ModuleKey[] = []) {
  const capabilityLabel = formatCapabilityLabel(args)
  const moduleHint = formatModuleList(moduleKeys)

  if (moduleHint) {
    return `La ${capabilityLabel} no está habilitada en el plan actual. Pídele a tu administrador que active acceso ${moduleHint} o ajuste el plan para continuar.`
  }

  return `La ${capabilityLabel} no está habilitada en el plan actual. Pídele a tu administrador que active este permiso o ajuste el plan para continuar.`
}

function buildSedeMembershipDeniedMessage() {
  return 'No tienes acceso a esta sede. Pídele a tu administrador que te habilite la sede o el módulo correspondiente para continuar.'
}

function buildExternalScopeDeniedMessage() {
  return 'Tu cuenta está en onboarding externo de ROP. Mientras terminas la activación solo puedes usar la superficie operativa de ROP, perfil, ayuda y notificaciones.'
}

async function getExternalDashboardScope() {
  const cookieStore = await cookies()
  return cookieStore.get(EXTERNAL_DASHBOARD_SCOPE_COOKIE)?.value ?? null
}

async function assertExternalModuleScope(moduleKey: ModuleKey): Promise<ApiAccessFail | null> {
  const externalScope = await getExternalDashboardScope()
  if (!isModuleAllowedForExternalDashboardScope({ moduleKey, scope: externalScope })) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: buildExternalScopeDeniedMessage(),
          code: 'EXTERNAL_SCOPE_RESTRICTED',
          scope: EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING,
          module: moduleKey,
        },
        { status: 403 }
      ),
    }
  }

  return null
}

async function resolveApiAccessContext(sedeIdOverride?: string): Promise<ApiAccessOk | ApiAccessFail> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sesión inválida. Vuelve a iniciar sesión.' }, { status: 401 }),
    }
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  const isSystemSuperAdmin = isSuperAdminEmail(currentUser?.email)

  const sede = sedeIdOverride
    ? await prisma.sede.findUnique({ where: { id: sedeIdOverride }, select: { id: true, empresaId: true } })
    : await getActiveSedeForUser(userId)

  if (!sede) {
    return { ok: false, response: NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 }) }
  }

  const membership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: sede.id, userId } },
    select: { sedeId: true, role: true },
  })

  if (!membership && !isSystemSuperAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: buildSedeMembershipDeniedMessage() }, { status: 403 }),
    }
  }

  return {
    ok: true,
    session,
    userId,
    sedeId: sede.id,
    empresaId: sede.empresaId,
    membershipRole: membership?.role ?? (isSystemSuperAdmin ? 'ADMIN' : null),
    isSystemSuperAdmin,
  }
}

function isIsolatedVerticalCapability(args: Pick<ApiCapabilityAccessArgs, 'domain' | 'subdomain'>) {
  return args.domain === 'VERTICALES' && typeof ISOLATED_VERTICAL_HREFS[args.subdomain] === 'string'
}

function capabilityActionToLegacyAccessLevel(action: RbacV2CapabilityAction): AccessLevel {
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

function getLegacyModulesForCapability(args: {
  domain: RbacV2Domain
  subdomain: string
}): ModuleKey[] {
  const matches = new Set<ModuleKey>()

  for (const moduleKey of Object.values(ModuleKey)) {
    const mapping = getLegacyModuleRbacV2Mapping(moduleKey)
    if (!mapping) continue

    const hasMatch = mapping.targets.some(
      (target) => target.domain === args.domain && target.subdomains.includes(args.subdomain)
    )

    if (hasMatch) {
      matches.add(moduleKey)
    }
  }

  return [...matches]
}

function grantMatchesScope(args: {
  requestedScope?: RbacV2Scope
  grantScopeType: string
  grantScopeValue: string | null
  empresaId: string
  sedeId: string
}): boolean {
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

async function resolveCapabilityAccessFromV2(
  accessContext: ApiAccessOk,
  args: ApiCapabilityAccessArgs
): Promise<ApiCapabilityAccessOk | ApiAccessFail | null> {
  const legacyModulesChecked = getLegacyModulesForCapability({
    domain: args.domain,
    subdomain: args.subdomain,
  })
  const [domainEntitlement, capabilityEntitlement, grants] = await Promise.all([
    prisma.domainEntitlement.findUnique({
      where: { empresaId_domain: { empresaId: accessContext.empresaId, domain: args.domain } },
      select: { enabled: true },
    }),
    prisma.capabilityEntitlement.findUnique({
      where: {
        empresaId_domain_subdomain_action: {
          empresaId: accessContext.empresaId,
          domain: args.domain,
          subdomain: args.subdomain,
          action: args.action,
        },
      },
      select: { enabled: true },
    }),
    prisma.userCapabilityGrant.findMany({
      where: {
        empresaId: accessContext.empresaId,
        userId: accessContext.userId,
        domain: args.domain,
        subdomain: args.subdomain,
        action: args.action,
      },
      select: {
        allowed: true,
        scopeType: true,
        scopeValue: true,
      },
    }),
  ])

  if (domainEntitlement && !domainEntitlement.enabled) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: buildPlanCapabilityDeniedMessage(args, legacyModulesChecked),
          domain: args.domain,
          checkedModules: legacyModulesChecked,
        },
        { status: 403 }
      ),
    }
  }

  if (capabilityEntitlement && !capabilityEntitlement.enabled) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: buildPlanCapabilityDeniedMessage(args, legacyModulesChecked),
          capability: `${args.domain}.${args.subdomain}.${args.action}`,
          checkedModules: legacyModulesChecked,
        },
        { status: 403 }
      ),
    }
  }

  const applicableGrants = grants.filter((grant) =>
    grantMatchesScope({
      requestedScope: args.scope,
      grantScopeType: grant.scopeType,
      grantScopeValue: grant.scopeValue,
      empresaId: accessContext.empresaId,
      sedeId: accessContext.sedeId,
    })
  )

  if (applicableGrants.some((grant) => !grant.allowed)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: buildCapabilityAccessDeniedMessage(args, legacyModulesChecked),
          capability: `${args.domain}.${args.subdomain}.${args.action}`,
          checkedModules: legacyModulesChecked,
          resolvedBy: 'rbac-v2-grant',
        },
        { status: 403 }
      ),
    }
  }

  if (applicableGrants.some((grant) => grant.allowed)) {
    return {
      ...accessContext,
      capability: args,
      matchedLegacyModule: null,
      legacyModulesChecked: [],
      resolvedBy: 'rbac-v2-grant',
    }
  }

  return null
}

export async function requireApiAccess(
  moduleKey: ModuleKey,
  minLevel: AccessLevel
): Promise<ApiAccessOk | ApiAccessFail> {
  const accessContext = await resolveApiAccessContext()
  if (!accessContext.ok) return accessContext

  const externalScopeRestriction = await assertExternalModuleScope(moduleKey)
  if (externalScopeRestriction) return externalScopeRestriction

  try {
    await requireSedeAccess({
      userId: accessContext.userId,
      sedeId: accessContext.sedeId,
      module: moduleKey,
      minLevel,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: buildModuleAccessDeniedMessage(moduleKey, minLevel),
            module: moduleKey,
            requiredLevel: minLevel,
          },
          { status: 403 }
        ),
      }
    }
    throw error
  }

  return accessContext
}

export async function canAccessCapability(
  args: ApiCapabilityAccessArgs
): Promise<ApiCapabilityAccessOk | ApiAccessFail> {
  const accessContext = await resolveApiAccessContext(args.sedeId)
  if (!accessContext.ok) return accessContext

  const externalScope = await getExternalDashboardScope()
  if (!isCapabilityAllowedForExternalDashboardScope({
    scope: externalScope,
    domain: args.domain,
    subdomain: args.subdomain,
  })) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: buildExternalScopeDeniedMessage(),
          code: 'EXTERNAL_SCOPE_RESTRICTED',
          scope: externalScope,
          capability: `${args.domain}.${args.subdomain}.${args.action}`,
        },
        { status: 403 }
      ),
    }
  }

  if (accessContext.isSystemSuperAdmin) {
    return {
      ...accessContext,
      capability: args,
      matchedLegacyModule: null,
      legacyModulesChecked: [],
      resolvedBy: 'rbac-v2-grant',
    }
  }

  const accessFromV2 = await resolveCapabilityAccessFromV2(accessContext, args)
  if (accessFromV2) return accessFromV2

  if (args.allowLegacyFallback === false) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: buildCapabilityAccessDeniedMessage(args),
          capability: args,
          checkedModules: [],
          resolvedBy: 'strict-rbac-v2',
        },
        { status: 403 }
      ),
    }
  }

  if (isIsolatedVerticalCapability(args)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: buildCapabilityAccessDeniedMessage(args),
          capability: args,
          checkedModules: [],
          resolvedBy: 'strict-rbac-v2',
        },
        { status: 403 }
      ),
    }
  }

  const legacyModulesChecked = getLegacyModulesForCapability({
    domain: args.domain,
    subdomain: args.subdomain,
  })

  const requiredLevel = capabilityActionToLegacyAccessLevel(args.action)
  const levelOrder: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, ADMIN: 3 }

  for (const moduleKey of legacyModulesChecked) {
    const effectiveLevel = await getEffectiveAccess({
      userId: accessContext.userId,
      sedeId: accessContext.sedeId,
      module: moduleKey,
    })

    if (levelOrder[effectiveLevel] >= levelOrder[requiredLevel]) {
      return {
        ...accessContext,
        capability: args,
        matchedLegacyModule: moduleKey,
        legacyModulesChecked,
        resolvedBy: 'legacy-module-fallback',
      }
    }
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: buildCapabilityAccessDeniedMessage(args, legacyModulesChecked),
        capability: args,
        checkedModules: legacyModulesChecked,
      },
      { status: 403 }
    ),
  }
}

export async function requireCapabilityAccess(
  args: ApiCapabilityAccessArgs
): Promise<ApiCapabilityAccessOk | ApiAccessFail> {
  return canAccessCapability(args)
}

export async function canAccessCompanyWideAiHistory(args: {
  userId: string
  sedeId: string
  sessionRole?: string | null
}) {
  if (args.sessionRole === 'ADMIN') return true

  const membership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: args.sedeId, userId: args.userId } },
    select: { role: true },
  })

  return membership?.role === 'ADMIN'
}

export async function resolveAiHistoryAccessScope(args: {
  userId: string
  sedeId: string
  sessionRole?: string | null
}) {
  const canViewCompanyWide = await canAccessCompanyWideAiHistory(args)

  return {
    canViewCompanyWide,
    scope: canViewCompanyWide ? 'company' as const : 'personal' as const,
    actorUserId: canViewCompanyWide ? null : args.userId,
  }
}
