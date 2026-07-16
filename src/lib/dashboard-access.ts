import 'server-only'

import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEffectiveAccessMap, NAV_MODULES } from '@/lib/rbac'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { DASHBOARD_NAV_CATALOG } from '@/lib/product-architecture'
import { buildDashboardPermissionEntries, DASHBOARD_PERMISSION_RULES } from '@/lib/dashboard-permission-catalog'
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

type DashboardAccessContext = {
  userId: string
  empresaId: string
  sedeId: string
  isSuperAdmin: boolean
  membershipRole: SedeRole | null
  legacyAccess: Partial<Record<ModuleKey, AccessLevel>>
  disabledDomains: Set<string>
  disabledCapabilities: Set<string>
  grantsByCapability: Map<string, Array<{ allowed: boolean; scopeType: string; scopeValue: string | null; source: string }>>
}

const ISOLATED_VERTICAL_HREFS: Partial<Record<string, string>> = {
  ODONTOLOGIA: '/dashboard/odontologia',
  RESTAURANTE: '/dashboard/restaurante',
  DOTACIONES: '/dashboard/dotaciones',
}

const ACCESS_ORDER: Record<AccessLevel, number> = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3,
}

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
  const [user, membership, legacyAccess, domainEntitlements, capabilityEntitlements, grants] = await Promise.all([
    prisma.user.findUnique({ where: { id: args.userId }, select: { email: true } }),
    prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: args.sedeId, userId: args.userId } },
      select: { role: true },
    }),
    getEffectiveAccessMap({ userId: args.userId, sedeId: args.sedeId, modules: NAV_MODULES }),
    prisma.domainEntitlement.findMany({ where: { empresaId: args.empresaId }, select: { domain: true, enabled: true } }),
    prisma.capabilityEntitlement.findMany({ where: { empresaId: args.empresaId }, select: { domain: true, subdomain: true, action: true, enabled: true } }),
    prisma.userCapabilityGrant.findMany({
      where: { empresaId: args.empresaId, userId: args.userId },
      select: { domain: true, subdomain: true, action: true, allowed: true, scopeType: true, scopeValue: true, source: true },
    }),
  ])

  const disabledDomains = new Set(domainEntitlements.filter((row) => !row.enabled).map((row) => row.domain))
  const disabledCapabilities = new Set(
    capabilityEntitlements
      .filter((row) => !row.enabled)
      .map((row) => `${row.domain}.${row.subdomain}.${row.action}`)
  )
  const grantsByCapability = new Map<string, Array<{ allowed: boolean; scopeType: string; scopeValue: string | null; source: string }>>()
  for (const grant of grants) {
    const key = `${grant.domain}.${grant.subdomain}.${grant.action}`
    const current = grantsByCapability.get(key) ?? []
    current.push({ allowed: grant.allowed, scopeType: grant.scopeType, scopeValue: grant.scopeValue, source: grant.source })
    grantsByCapability.set(key, current)
  }
  return {
    userId: args.userId,
    empresaId: args.empresaId,
    sedeId: args.sedeId,
    isSuperAdmin: isSuperAdminEmail(user?.email),
    membershipRole: membership?.role ?? null,
    legacyAccess,
    disabledDomains,
    disabledCapabilities,
    grantsByCapability,
  }
}

function isIsolatedVerticalCapability(capability: CapabilityRef) {
  return capability.domain === 'VERTICALES' && typeof ISOLATED_VERTICAL_HREFS[capability.subdomain] === 'string'
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
  directGrantOnly?: boolean
}) {
  if (args.context.isSuperAdmin) return true
  if (args.context.disabledDomains.has(args.capability.domain)) return false
  const capabilityId = `${args.capability.domain}.${args.capability.subdomain}.${args.action}`
  if (args.context.disabledCapabilities.has(capabilityId)) return false

  const grants = (args.context.grantsByCapability.get(capabilityId) ?? []).filter((grant) => !args.directGrantOnly || grant.source === 'DIRECT')
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
  if (args.directGrantOnly || isIsolatedVerticalCapability(args.capability)) return false

  const neededLevel = capabilityActionToAccessLevel(args.action)
  return getLegacyModulesForCapability(args.capability).some((moduleKey) => {
    const level = args.context.legacyAccess[moduleKey] ?? 'NONE'
    return ACCESS_ORDER[level] >= ACCESS_ORDER[neededLevel]
  })
}

function canAccessDashboardRuleFromContext(args: {
  context: DashboardAccessContext
  rule: (typeof DASHBOARD_PERMISSION_RULES)[number]
}) {
  return args.rule.capabilities.some((capability) => {
    const definition = getCapabilityDefinition(capability.domain, capability.subdomain)
    const actions: RbacV2CapabilityAction[] = definition?.actions.includes('READ')
      ? ['READ']
      : (definition?.actions.filter((action) => capabilityActionToAccessLevel(action) === 'READ') ?? ['READ'])

    return actions.some((action) => canAccessCapabilityFromContext({
      context: args.context,
      capability,
      action,
      directGrantOnly: args.rule.directGrantOnly,
    }))
  })
}

export async function buildAllowedDashboardPermissionKeysForUser(args: {
  userId: string
  empresaId: string
  sedeId: string
  baseAllowedHrefs?: string[] | null
}) {
  const context = await buildDashboardAccessContext(args)
  const baseSet = args.baseAllowedHrefs?.length ? new Set(args.baseAllowedHrefs) : null
  const keys = new Set<string>()

  for (const rule of DASHBOARD_PERMISSION_RULES) {
    if (baseSet && !rule.hrefs.some((href) => href === '/dashboard' || baseSet.has(href))) continue
    if (canAccessDashboardRuleFromContext({ context, rule })) {
      keys.add(rule.key)
    }
  }

  return [...keys]
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

    const rules = DASHBOARD_PERMISSION_RULES.filter((entry) => entry.hrefs.includes(item.href))
    if (!rules.length) {
      const moduleKey = moduleForDashboardHref(item.href)
      if (!moduleKey) {
        hrefs.add(item.href)
        continue
      }
      const level = context.legacyAccess[moduleKey as ModuleKey] ?? 'NONE'
      if (level !== 'NONE') hrefs.add(item.href)
      continue
    }

    const canRead = rules.some((rule) => canAccessDashboardRuleFromContext({ context, rule }))

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