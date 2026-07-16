import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveExplicitCapabilityLevel } from '@/lib/dashboard-access'
import { DASHBOARD_PERMISSION_RULES } from '@/lib/dashboard-permission-catalog'

export type UserPermissionSnapshot = {
  membershipByUserId: Record<string, SedeRole>
  moduleAccessByUserId: Record<string, Partial<Record<ModuleKey, AccessLevel>>>
  globalAccessByUserId: Partial<Record<string, AccessLevel>>
  capabilityAccessByUserId: Record<string, Record<string, AccessLevel>>
  permissionProfileByUserId: Record<string, { id: string; name: string }>
}

export async function buildUserPermissionSnapshot(args: {
  empresaId: string
  sedeId: string | null
  userIds: string[]
}): Promise<UserPermissionSnapshot> {
  const userIds = Array.from(new Set(args.userIds.filter(Boolean)))
  if (!userIds.length) {
    return {
      membershipByUserId: {},
      moduleAccessByUserId: {},
      globalAccessByUserId: {},
      capabilityAccessByUserId: {},
      permissionProfileByUserId: {},
    }
  }

  const [memberships, moduleAccessRows, globalAccessRows, capabilityGrantRows, permissionProfileAssignments] = await Promise.all([
    args.sedeId
      ? prisma.sedeMembership.findMany({
          where: { sedeId: args.sedeId, userId: { in: userIds } },
          select: { userId: true, role: true },
        })
      : Promise.resolve([]),
    args.sedeId
      ? prisma.userModuleAccess.findMany({
          where: { sedeId: args.sedeId, userId: { in: userIds } },
          orderBy: [{ userId: 'asc' }, { module: 'asc' }],
          select: { userId: true, module: true, level: true },
        })
      : Promise.resolve([]),
    prisma.userGlobalAccess.findMany({
      where: { empresaId: args.empresaId, userId: { in: userIds } },
      select: { userId: true, level: true },
    }),
    args.sedeId
      ? prisma.userCapabilityGrant.findMany({
          where: {
            empresaId: args.empresaId,
            scopeType: 'SEDE',
            scopeValue: args.sedeId,
            userId: { in: userIds },
            source: 'DIRECT',
          },
          select: {
            userId: true,
            domain: true,
            subdomain: true,
            action: true,
            allowed: true,
          },
        })
      : Promise.resolve([]),
    args.sedeId
      ? prisma.permissionProfileAssignment.findMany({
          where: { empresaId: args.empresaId, sedeId: args.sedeId, userId: { in: userIds } },
          select: {
            userId: true,
            profile: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const membershipByUserId: Record<string, SedeRole> = {}
  for (const membership of memberships) {
    membershipByUserId[membership.userId] = membership.role
  }

  const moduleAccessByUserId: Record<string, Partial<Record<ModuleKey, AccessLevel>>> = {}
  for (const row of moduleAccessRows) {
    if (!moduleAccessByUserId[row.userId]) moduleAccessByUserId[row.userId] = {}
    moduleAccessByUserId[row.userId][row.module] = row.level
  }

  const globalAccessByUserId: Partial<Record<string, AccessLevel>> = {}
  for (const row of globalAccessRows) {
    globalAccessByUserId[row.userId] = row.level
  }

  const capabilityAccessByUserId: Record<string, Record<string, AccessLevel>> = {}
  for (const userId of userIds) capabilityAccessByUserId[userId] = {}

  const grantsByUserCapability = new Map<string, Array<{ action: string; allowed: boolean }>>()
  for (const grant of capabilityGrantRows) {
    const key = `${grant.userId}::${grant.domain}::${grant.subdomain}`
    const current = grantsByUserCapability.get(key) ?? []
    current.push({ action: grant.action, allowed: grant.allowed })
    grantsByUserCapability.set(key, current)
  }

  for (const rule of DASHBOARD_PERMISSION_RULES) {
    const capability = rule.capabilities[0]
    if (!capability) continue

    for (const userId of userIds) {
      const rows = grantsByUserCapability.get(`${userId}::${capability.domain}::${capability.subdomain}`) ?? []
      const level = deriveExplicitCapabilityLevel({
        domain: capability.domain,
        subdomain: capability.subdomain,
        grants: rows,
      })
      if (level) {
        capabilityAccessByUserId[userId][rule.key] = level
      }
    }
  }

  const permissionProfileByUserId = Object.fromEntries(
    permissionProfileAssignments.map((assignment) => [assignment.userId, assignment.profile])
  ) as Record<string, { id: string; name: string }>

  return {
    membershipByUserId,
    moduleAccessByUserId,
    globalAccessByUserId,
    capabilityAccessByUserId,
    permissionProfileByUserId,
  }
}