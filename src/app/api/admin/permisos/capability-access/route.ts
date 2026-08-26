import { NextResponse } from 'next/server'
import { AccessLevel, RbacGrantSource, RbacScopeType } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { capabilityActionToAccessLevel, getCapabilityDefinition } from '@/lib/dashboard-access'
import { detachPermissionProfileAssignment, publishPermissionUpdateNotification } from '@/lib/rbac-permission-sync'
import type { RbacV2Domain } from '@/lib/rbac-v2-catalog'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

const ACCESS_LEVELS: Array<AccessLevel | 'INHERIT'> = ['INHERIT', 'NONE', 'READ', 'WRITE', 'ADMIN']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isProtectedCapability(domain: RbacV2Domain, subdomain: string) {
  return (domain === 'VERTICALES' && (subdomain === 'ODONTOLOGIA' || subdomain === 'RESTAURANTE' || subdomain === 'DOTACIONES'))
    || (domain === 'CORE' && subdomain === 'ROP')
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const sedeId = typeof body.sedeId === 'string' ? body.sedeId.trim() : ''
  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const domain = typeof body.domain === 'string' ? (body.domain.trim() as RbacV2Domain) : null
  const subdomain = typeof body.subdomain === 'string' ? body.subdomain.trim() : ''
  const level = typeof body.level === 'string' ? (body.level.trim() as AccessLevel | 'INHERIT') : null

  if (!sedeId || !targetUserId || !domain || !subdomain || !level || !ACCESS_LEVELS.includes(level)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const definition = getCapabilityDefinition(domain, subdomain)
  if (!definition) {
    return NextResponse.json({ success: false, error: 'Capacidad inválida' }, { status: 400 })
  }

  if (isProtectedCapability(domain, subdomain) && !isSuperAdminEmail(session.user.email ?? null)) {
    return NextResponse.json({ success: false, error: 'Solo el Super Admin puede asignar este acceso.' }, { status: 403 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true, nombre: true } })
  if (!sede || sede.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'Sede inválida' }, { status: 400 })
  }

  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { role: true },
  })
  const requesterAllowed = session.user.role === 'ADMIN' || requesterMembership?.role === 'ADMIN' || requesterMembership?.role === 'MANAGER'
  if (!requesterAllowed) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  const targetMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: targetUserId } },
    select: { id: true },
  })
  if (!targetMembership?.id) {
    return NextResponse.json({ success: false, error: 'El usuario no pertenece a esta sede' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await detachPermissionProfileAssignment({ client: tx, empresaId, sedeId, userId: targetUserId })
    await tx.userCapabilityGrant.deleteMany({
      where: {
        empresaId,
        userId: targetUserId,
        domain,
        subdomain,
        scopeType: RbacScopeType.SEDE,
        scopeValue: sedeId,
        source: RbacGrantSource.DIRECT,
      },
    })

    if (level !== 'INHERIT') {
      await tx.userCapabilityGrant.createMany({
        data: definition.actions.map((action) => ({
          userId: targetUserId,
          empresaId,
          domain,
          subdomain,
          action,
          scopeType: RbacScopeType.SEDE,
          scopeValue: sedeId,
          allowed: capabilityActionToAccessLevel(action) === 'READ'
            ? level !== 'NONE'
            : capabilityActionToAccessLevel(action) === 'WRITE'
              ? level === 'WRITE' || level === 'ADMIN'
              : level === 'ADMIN',
          source: RbacGrantSource.DIRECT,
          grantedByUserId: session.user.id,
          notes: `Permiso ${level} asignado desde gestión de usuarios para ${domain}.${subdomain}.`,
        })),
      })
    }
  })

  if (level === 'INHERIT') {
    await publishPermissionUpdateNotification({
      client: prisma,
      userId: targetUserId,
      empresaId,
      sedeId,
      title: 'Permisos actualizados',
      body: `El submódulo ${subdomain} volvió a heredar el permiso de la sede ${sede.nombre}.`,
    })
    return NextResponse.json({ success: true, data: { level: null } })
  }

  await publishPermissionUpdateNotification({
    client: prisma,
    userId: targetUserId,
    empresaId,
    sedeId,
    title: 'Permisos actualizados',
    body: `Se actualizó el submódulo ${subdomain} a ${level} en la sede ${sede.nombre}.`,
  })

  return NextResponse.json({ success: true, data: { level } })
}