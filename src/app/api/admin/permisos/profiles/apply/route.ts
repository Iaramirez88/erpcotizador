import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, RbacGrantSource, RbacScopeType, SedeRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { capabilityActionToAccessLevel, getCapabilityDefinition } from '@/lib/dashboard-access'
import type { RbacV2Domain } from '@/lib/rbac-v2-catalog'

export const runtime = 'nodejs'

const ACCESS_LEVELS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']
const SEDE_ROLES: SedeRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']
const MODULE_KEYS = new Set<string>(Object.values(ModuleKey))

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeModuleLevels(value: unknown) {
  if (!isPlainObject(value)) return [] as Array<{ module: ModuleKey; level: AccessLevel }>
  return Object.entries(value)
    .filter(([key, rawLevel]) => MODULE_KEYS.has(key) && typeof rawLevel === 'string' && ACCESS_LEVELS.includes(rawLevel as AccessLevel))
    .map(([key, rawLevel]) => ({ module: key as ModuleKey, level: rawLevel as AccessLevel }))
}

function normalizeCapabilityLevels(value: unknown) {
  if (!isPlainObject(value)) return [] as Array<{ domain: RbacV2Domain; subdomain: string; level: AccessLevel }>
  return Object.values(value)
    .filter(isPlainObject)
    .map((item) => ({
      domain: String(item.domain || '').trim() as RbacV2Domain,
      subdomain: String(item.subdomain || '').trim(),
      level: String(item.level || '').trim() as AccessLevel,
    }))
    .filter((item) => item.domain && item.subdomain && ACCESS_LEVELS.includes(item.level))
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : ''
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []

  if (!profileId || !userIds.length) {
    return NextResponse.json({ success: false, error: 'Debes seleccionar una regla y al menos un usuario.' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const profile = await prisma.permissionProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      empresaId: true,
      sedeId: true,
      sedeRole: true,
      globalAccessLevel: true,
      moduleLevels: true,
      capabilityLevels: true,
    },
  })

  if (!profile || profile.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'La regla de permisos no existe en esta empresa.' }, { status: 404 })
  }

  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: profile.sedeId, userId: session.user.id } },
    select: { role: true },
  })

  const isAllowed = session.user.role === 'ADMIN' || requesterMembership?.role === 'ADMIN'
  if (!isAllowed) {
    return NextResponse.json({ success: false, error: 'Solo los administradores pueden aplicar reglas de permisos.' }, { status: 403 })
  }

  const targetUsers = await prisma.user.findMany({
    where: { id: { in: userIds }, empresaId },
    select: { id: true },
  })
  if (!targetUsers.length) {
    return NextResponse.json({ success: false, error: 'No se encontraron usuarios válidos para aplicar la regla.' }, { status: 400 })
  }

  const normalizedModuleLevels = normalizeModuleLevels(profile.moduleLevels)
  const normalizedCapabilityLevels = normalizeCapabilityLevels(profile.capabilityLevels)

  await prisma.$transaction(async (tx) => {
    for (const user of targetUsers) {
      await tx.sedeMembership.upsert({
        where: { sedeId_userId: { sedeId: profile.sedeId, userId: user.id } },
        update: { role: SEDE_ROLES.includes(profile.sedeRole) ? profile.sedeRole : 'READER' },
        create: { sedeId: profile.sedeId, userId: user.id, role: SEDE_ROLES.includes(profile.sedeRole) ? profile.sedeRole : 'READER' },
      })

      await tx.userGlobalAccess.upsert({
        where: { userId: user.id },
        update: { empresaId, level: profile.globalAccessLevel },
        create: { userId: user.id, empresaId, level: profile.globalAccessLevel },
      })

      await tx.userModuleAccess.deleteMany({ where: { sedeId: profile.sedeId, userId: user.id } })
      if (normalizedModuleLevels.length) {
        await tx.userModuleAccess.createMany({
          data: normalizedModuleLevels.map((item) => ({
            sedeId: profile.sedeId,
            userId: user.id,
            module: item.module,
            level: item.level,
          })),
        })
      }

      await tx.userCapabilityGrant.deleteMany({
        where: {
          empresaId,
          userId: user.id,
          scopeType: RbacScopeType.SEDE,
          scopeValue: profile.sedeId,
          source: RbacGrantSource.DIRECT,
        },
      })

      const capabilityGrantRows = normalizedCapabilityLevels.flatMap((item) => {
        const definition = getCapabilityDefinition(item.domain, item.subdomain)
        if (!definition) return []
        return definition.actions.map((action) => ({
          userId: user.id,
          empresaId,
          domain: item.domain,
          subdomain: item.subdomain,
          action,
          scopeType: RbacScopeType.SEDE,
          scopeValue: profile.sedeId,
          allowed: capabilityActionToAccessLevel(action) === 'READ'
            ? item.level !== 'NONE'
            : capabilityActionToAccessLevel(action) === 'WRITE'
              ? item.level === 'WRITE' || item.level === 'ADMIN'
              : item.level === 'ADMIN',
          source: RbacGrantSource.DIRECT,
          grantedByUserId: session.user.id,
          notes: `Regla de permisos aplicada desde perfil ${profile.id}.`,
        }))
      })

      if (capabilityGrantRows.length) {
        await tx.userCapabilityGrant.createMany({ data: capabilityGrantRows })
      }

      await tx.permissionProfileAssignment.upsert({
        where: { sedeId_userId: { sedeId: profile.sedeId, userId: user.id } },
        update: {
          profileId: profile.id,
          empresaId,
          appliedByUserId: session.user.id,
        },
        create: {
          profileId: profile.id,
          empresaId,
          sedeId: profile.sedeId,
          userId: user.id,
          appliedByUserId: session.user.id,
        },
      })
    }
  })

  return NextResponse.json({ success: true, data: { appliedUsers: targetUsers.length } })
}