import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, RbacGrantSource, RbacScopeType, SedeRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { capabilityActionToAccessLevel, getCapabilityDefinition } from '@/lib/dashboard-access'
import { publishPermissionUpdateNotification } from '@/lib/rbac-permission-sync'
import type { RbacV2Domain } from '@/lib/rbac-v2-catalog'

export const runtime = 'nodejs'

const ACCESS_LEVELS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']
const SEDE_ROLES: SedeRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']
const MODULE_KEYS = new Set<string>(Object.values(ModuleKey))

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeModuleLevels(value: unknown) {
  if (!isPlainObject(value)) return {} as Record<string, AccessLevel>
  const next: Record<string, AccessLevel> = {}
  for (const [key, rawLevel] of Object.entries(value)) {
    if (!MODULE_KEYS.has(key)) continue
    if (typeof rawLevel !== 'string' || !ACCESS_LEVELS.includes(rawLevel as AccessLevel)) continue
    next[key] = rawLevel as AccessLevel
  }
  return next
}

function normalizeCapabilityLevels(value: unknown) {
  if (!isPlainObject(value)) return {} as Record<string, { domain: string; subdomain: string; level: AccessLevel; label: string | null }>
  const next: Record<string, { domain: string; subdomain: string; level: AccessLevel; label: string | null }> = {}
  for (const [key, rawItem] of Object.entries(value)) {
    if (!isPlainObject(rawItem)) continue
    const domain = typeof rawItem.domain === 'string' ? rawItem.domain.trim() : ''
    const subdomain = typeof rawItem.subdomain === 'string' ? rawItem.subdomain.trim() : ''
    const label = typeof rawItem.label === 'string' ? rawItem.label.trim() : null
    const rawLevel = typeof rawItem.level === 'string' ? rawItem.level.trim() : ''
    if (!domain || !subdomain || !ACCESS_LEVELS.includes(rawLevel as AccessLevel)) continue
    next[key] = { domain, subdomain, level: rawLevel as AccessLevel, label }
  }
  return next
}

function normalizeCapabilityLevelRows(value: unknown) {
  return Object.values(normalizeCapabilityLevels(value))
    .map((item) => ({
      domain: item.domain as RbacV2Domain,
      subdomain: item.subdomain,
      level: item.level,
    }))
}

async function applyProfileToUsers(args: {
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  empresaId: string
  sedeId: string
  profileId: string
  sedeRole: SedeRole
  globalAccessLevel: AccessLevel
  moduleLevels: Record<string, AccessLevel>
  capabilityLevels: Record<string, { domain: string; subdomain: string; level: AccessLevel; label: string | null }>
  userIds: string[]
  grantedByUserId: string
  note: string
}) {
  const normalizedModuleLevels = Object.entries(normalizeModuleLevels(args.moduleLevels)).map(([module, level]) => ({ module: module as ModuleKey, level }))
  const normalizedCapabilityLevels = normalizeCapabilityLevelRows(args.capabilityLevels)

  for (const userId of args.userIds) {
    await args.tx.sedeMembership.upsert({
      where: { sedeId_userId: { sedeId: args.sedeId, userId } },
      update: { role: SEDE_ROLES.includes(args.sedeRole) ? args.sedeRole : 'READER' },
      create: { sedeId: args.sedeId, userId, role: SEDE_ROLES.includes(args.sedeRole) ? args.sedeRole : 'READER' },
    })

    await args.tx.userGlobalAccess.upsert({
      where: { userId },
      update: { empresaId: args.empresaId, level: args.globalAccessLevel },
      create: { userId, empresaId: args.empresaId, level: args.globalAccessLevel },
    })

    await args.tx.userModuleAccess.deleteMany({ where: { sedeId: args.sedeId, userId } })
    if (normalizedModuleLevels.length) {
      await args.tx.userModuleAccess.createMany({
        data: normalizedModuleLevels.map((item) => ({
          sedeId: args.sedeId,
          userId,
          module: item.module,
          level: item.level,
        })),
      })
    }

    await args.tx.userCapabilityGrant.deleteMany({
      where: {
        empresaId: args.empresaId,
        userId,
        scopeType: RbacScopeType.SEDE,
        scopeValue: args.sedeId,
        source: RbacGrantSource.DIRECT,
      },
    })

    const capabilityGrantRows = normalizedCapabilityLevels.flatMap((item) => {
      const definition = getCapabilityDefinition(item.domain, item.subdomain)
      if (!definition) return []
      return definition.actions.map((action) => ({
        userId,
        empresaId: args.empresaId,
        domain: item.domain,
        subdomain: item.subdomain,
        action,
        scopeType: RbacScopeType.SEDE,
        scopeValue: args.sedeId,
        allowed: capabilityActionToAccessLevel(action) === 'READ'
          ? item.level !== 'NONE'
          : capabilityActionToAccessLevel(action) === 'WRITE'
            ? item.level === 'WRITE' || item.level === 'ADMIN'
            : item.level === 'ADMIN',
        source: RbacGrantSource.DIRECT,
        grantedByUserId: args.grantedByUserId,
        notes: args.note,
      }))
    })

    if (capabilityGrantRows.length) {
      await args.tx.userCapabilityGrant.createMany({ data: capabilityGrantRows })
    }

    await args.tx.permissionProfileAssignment.upsert({
      where: { sedeId_userId: { sedeId: args.sedeId, userId } },
      update: {
        profileId: args.profileId,
        empresaId: args.empresaId,
        appliedByUserId: args.grantedByUserId,
      },
      create: {
        profileId: args.profileId,
        empresaId: args.empresaId,
        sedeId: args.sedeId,
        userId,
        appliedByUserId: args.grantedByUserId,
      },
    })
  }
}

async function clearProfileFromUsers(args: {
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  empresaId: string
  sedeId: string
  userIds: string[]
}) {
  if (!args.userIds.length) return

  await args.tx.permissionProfileAssignment.deleteMany({
    where: {
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      userId: { in: args.userIds },
    },
  })

  await args.tx.userCapabilityGrant.deleteMany({
    where: {
      empresaId: args.empresaId,
      userId: { in: args.userIds },
      scopeType: RbacScopeType.SEDE,
      scopeValue: args.sedeId,
      source: RbacGrantSource.DIRECT,
    },
  })

  await args.tx.userModuleAccess.deleteMany({
    where: {
      sedeId: args.sedeId,
      userId: { in: args.userIds },
    },
  })

  await args.tx.userGlobalAccess.deleteMany({
    where: {
      empresaId: args.empresaId,
      userId: { in: args.userIds },
    },
  })

  await args.tx.sedeMembership.deleteMany({
    where: {
      sedeId: args.sedeId,
      userId: { in: args.userIds },
    },
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const sedeId = typeof body.sedeId === 'string' ? body.sedeId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const sedeRole = typeof body.sedeRole === 'string' ? body.sedeRole.trim() as SedeRole : null
  const globalAccessLevel = typeof body.globalAccessLevel === 'string' ? body.globalAccessLevel.trim() as AccessLevel : null

  if (!sedeId || !name || !sedeRole || !globalAccessLevel || !SEDE_ROLES.includes(sedeRole) || !ACCESS_LEVELS.includes(globalAccessLevel)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true } })
  if (!sede || sede.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'Sede inválida' }, { status: 400 })
  }

  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { role: true },
  })

  const isAllowed = session.user.role === 'ADMIN' || requesterMembership?.role === 'ADMIN'
  if (!isAllowed) {
    return NextResponse.json({ success: false, error: 'Solo los administradores pueden crear reglas de permisos.' }, { status: 403 })
  }

  const moduleLevels = normalizeModuleLevels(body.moduleLevels)
  const capabilityLevels = normalizeCapabilityLevels(body.capabilityLevels)

  try {
    const created = await prisma.permissionProfile.create({
      data: {
        empresaId,
        sedeId,
        createdByUserId: session.user.id,
        name,
        description: description || null,
        sedeRole,
        globalAccessLevel,
        moduleLevels,
        capabilityLevels,
      },
      select: { id: true, name: true },
    })

    return NextResponse.json({ success: true, data: created })
  } catch {
    return NextResponse.json({ success: false, error: 'No fue posible guardar la regla de permisos.' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const sedeRole = typeof body.sedeRole === 'string' ? body.sedeRole.trim() as SedeRole : null
  const globalAccessLevel = typeof body.globalAccessLevel === 'string' ? body.globalAccessLevel.trim() as AccessLevel : null

  if (!profileId || !name || !sedeRole || !globalAccessLevel || !SEDE_ROLES.includes(sedeRole) || !ACCESS_LEVELS.includes(globalAccessLevel)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const existingProfile = await prisma.permissionProfile.findUnique({
    where: { id: profileId },
    select: { id: true, empresaId: true, sedeId: true },
  })

  if (!existingProfile || existingProfile.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'La regla de permisos no existe en esta empresa.' }, { status: 404 })
  }

  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: existingProfile.sedeId, userId: session.user.id } },
    select: { role: true },
  })

  const isAllowed = session.user.role === 'ADMIN' || requesterMembership?.role === 'ADMIN'
  if (!isAllowed) {
    return NextResponse.json({ success: false, error: 'Solo los administradores pueden editar reglas de permisos.' }, { status: 403 })
  }

  const moduleLevels = normalizeModuleLevels(body.moduleLevels)
  const capabilityLevels = normalizeCapabilityLevels(body.capabilityLevels)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.permissionProfile.update({
        where: { id: profileId },
        data: {
          name,
          description: description || null,
          sedeRole,
          globalAccessLevel,
          moduleLevels,
          capabilityLevels,
        },
        select: { id: true, sedeId: true },
      })

      const assignments = await tx.permissionProfileAssignment.findMany({
        where: { profileId: updated.id, empresaId },
        select: { userId: true },
      })

      const userIds = assignments.map((item) => item.userId)
      if (userIds.length) {
        await applyProfileToUsers({
          tx,
          empresaId,
          sedeId: updated.sedeId,
          profileId: updated.id,
          sedeRole,
          globalAccessLevel,
          moduleLevels,
          capabilityLevels,
          userIds,
          grantedByUserId: session.user.id,
          note: `Regla de permisos actualizada desde perfil ${updated.id}.`,
        })
      }

      return { id: updated.id, reappliedUsers: userIds.length, userIds }
    })

    await Promise.all(
      result.userIds.map((userId) =>
        publishPermissionUpdateNotification({
          client: prisma,
          userId,
          empresaId,
          sedeId: existingProfile.sedeId,
          title: 'Permisos actualizados',
          body: `La regla de permisos ${name} fue actualizada y tus accesos se sincronizaron automáticamente.`,
        })
      )
    )

    return NextResponse.json({ success: true, data: result })
  } catch {
    return NextResponse.json({ success: false, error: 'No fue posible actualizar la regla de permisos.' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : ''
  if (!profileId) {
    return NextResponse.json({ success: false, error: 'Debes indicar la regla a eliminar.' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const existingProfile = await prisma.permissionProfile.findUnique({
    where: { id: profileId },
    select: { id: true, empresaId: true, sedeId: true, name: true },
  })

  if (!existingProfile || existingProfile.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'La regla de permisos no existe en esta empresa.' }, { status: 404 })
  }

  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: existingProfile.sedeId, userId: session.user.id } },
    select: { role: true },
  })

  const isAllowed = session.user.role === 'ADMIN' || requesterMembership?.role === 'ADMIN'
  if (!isAllowed) {
    return NextResponse.json({ success: false, error: 'Solo los administradores pueden eliminar reglas de permisos.' }, { status: 403 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const assignments = await tx.permissionProfileAssignment.findMany({
        where: { profileId, empresaId, sedeId: existingProfile.sedeId },
        select: { userId: true },
      })

      const userIds = assignments.map((item) => item.userId)
      await clearProfileFromUsers({
        tx,
        empresaId,
        sedeId: existingProfile.sedeId,
        userIds,
      })

      await tx.permissionProfile.delete({ where: { id: profileId } })

      return {
        deletedProfileId: profileId,
        deletedProfileName: existingProfile.name,
        affectedUsers: userIds.length,
        userIds,
      }
    })

    await Promise.all(
      result.userIds.map((userId) =>
        publishPermissionUpdateNotification({
          client: prisma,
          userId,
          empresaId,
          sedeId: existingProfile.sedeId,
          title: 'Permisos actualizados',
          body: `La regla de permisos ${existingProfile.name} fue eliminada y tus accesos se limpiaron en esta sede.`,
        })
      )
    )

    return NextResponse.json({ success: true, data: result })
  } catch {
    return NextResponse.json({ success: false, error: 'No fue posible eliminar la regla de permisos.' }, { status: 400 })
  }
}