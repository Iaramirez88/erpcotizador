import 'server-only'

import { type AccessLevel, type ModuleKey, type SedeRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEffectiveAccessMap, NAV_MODULES } from '@/lib/rbac'
import { isSuperAdminEmail } from '@/lib/super-admin'
import {
  type DashboardAccessContext,
  buildAllowedDashboardHrefsFromContext,
  buildAllowedDashboardPermissionKeysFromContext,
  capabilityActionToAccessLevel,
  deriveExplicitCapabilityLevel,
  getAllowedModulesFromDashboardHrefs,
  getCapabilityDefinition,
} from '@/lib/dashboard-access-rules'

export {
  buildAllowedDashboardHrefsFromContext,
  buildAllowedDashboardPermissionKeysFromContext,
  capabilityActionToAccessLevel,
  deriveExplicitCapabilityLevel,
  getAllowedModulesFromDashboardHrefs,
  getCapabilityDefinition,
}
export type { DashboardAccessContext }

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

export async function buildAllowedDashboardPermissionKeysForUser(args: {
  userId: string
  empresaId: string
  sedeId: string
  baseAllowedHrefs?: string[] | null
}) {
  const context = await buildDashboardAccessContext(args)
  return buildAllowedDashboardPermissionKeysFromContext({ context, baseAllowedHrefs: args.baseAllowedHrefs })
}

export async function buildAllowedDashboardHrefsForUser(args: {
  userId: string
  empresaId: string
  sedeId: string
  baseAllowedHrefs?: string[] | null
}) {
  const context = await buildDashboardAccessContext(args)
  return buildAllowedDashboardHrefsFromContext({ context, baseAllowedHrefs: args.baseAllowedHrefs })
}
