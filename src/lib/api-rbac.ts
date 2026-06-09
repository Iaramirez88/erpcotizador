import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser, getEffectiveAccess, requireSedeAccess } from '@/lib/rbac'
import {
  getLegacyModuleRbacV2Mapping,
  type RbacV2CapabilityAction,
  type RbacV2Domain,
  type RbacV2Scope,
} from '@/lib/rbac-v2-catalog'
import type { Session } from 'next-auth'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { resolveUserIdFromSession } from '@/lib/session-user'

export type ApiAccessOk = {
  ok: true
  session: Session
  userId: string
  sedeId: string
  empresaId: string
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
}

export type ApiCapabilityAccessOk = ApiAccessOk & {
  capability: ApiCapabilityAccessArgs
  matchedLegacyModule: ModuleKey | null
  legacyModulesChecked: ModuleKey[]
  resolvedBy: 'rbac-v2-grant' | 'legacy-module-fallback'
}

async function resolveApiAccessContext(): Promise<ApiAccessOk | ApiAccessFail> {
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

  const sede = await getActiveSedeForUser(userId)

  return {
    ok: true,
    session,
    userId,
    sedeId: sede.id,
    empresaId: sede.empresaId,
  }
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
        { error: 'Capacidad deshabilitada por plan', domain: args.domain },
        { status: 403 }
      ),
    }
  }

  if (capabilityEntitlement && !capabilityEntitlement.enabled) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Capacidad deshabilitada por plan',
          capability: `${args.domain}.${args.subdomain}.${args.action}`,
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
          error: 'Prohibido',
          capability: `${args.domain}.${args.subdomain}.${args.action}`,
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

  try {
    await requireSedeAccess({
      userId: accessContext.userId,
      sedeId: accessContext.sedeId,
      module: moduleKey,
      minLevel,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }
    }
    throw error
  }

  return accessContext
}

export async function canAccessCapability(
  args: ApiCapabilityAccessArgs
): Promise<ApiCapabilityAccessOk | ApiAccessFail> {
  const accessContext = await resolveApiAccessContext()
  if (!accessContext.ok) return accessContext

  const accessFromV2 = await resolveCapabilityAccessFromV2(accessContext, args)
  if (accessFromV2) return accessFromV2

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
        error: 'Prohibido',
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

  return membership?.role === 'ADMIN' || membership?.role === 'MANAGER'
}
