import { NextResponse } from 'next/server'
import { RbacGrantSource, RbacScopeType } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { detachPermissionProfileAssignment, publishPermissionUpdateNotification } from '@/lib/rbac-permission-sync'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const sedeId = typeof body.sedeId === 'string' ? body.sedeId.trim() : ''
  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''

  if (!sedeId || !targetUserId) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)

  const sede = await prisma.sede.findUnique({
    where: { id: sedeId },
    select: { id: true, empresaId: true, nombre: true },
  })
  if (!sede || sede.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'Sede inválida' }, { status: 400 })
  }

  const requesterIsSystemAdmin = session.user.role === 'ADMIN'
  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { role: true },
  })
  const requesterAllowed = requesterIsSystemAdmin || requesterMembership?.role === 'ADMIN' || requesterMembership?.role === 'MANAGER'
  if (!requesterAllowed) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  })
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const targetMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: targetUser.id } },
    select: { id: true },
  })

  const result = await prisma.$transaction(async (tx) => {
    await detachPermissionProfileAssignment({ client: tx, empresaId, sedeId, userId: targetUser.id })

    const deletedModuleAccess = await tx.userModuleAccess.deleteMany({
      where: { sedeId, userId: targetUser.id },
    })

    const deletedCapabilityGrants = await tx.userCapabilityGrant.deleteMany({
      where: {
        empresaId,
        userId: targetUser.id,
        scopeType: RbacScopeType.SEDE,
        scopeValue: sedeId,
        source: RbacGrantSource.DIRECT,
      },
    })

    const deletedGlobalAccess = await tx.userGlobalAccess.deleteMany({
      where: { empresaId, userId: targetUser.id },
    })

    const membership = targetMembership?.id
      ? await tx.sedeMembership.update({
          where: { sedeId_userId: { sedeId, userId: targetUser.id } },
          data: { role: 'READER' },
          select: { role: true },
        })
      : null

    return {
      deletedModuleAccess: deletedModuleAccess.count,
      deletedCapabilityGrants: deletedCapabilityGrants.count,
      deletedGlobalAccess: deletedGlobalAccess.count,
      role: membership?.role ?? null,
    }
  })

  await publishPermissionUpdateNotification({
    client: prisma,
    userId: targetUser.id,
    empresaId,
    sedeId,
    title: 'Permisos reiniciados',
    body: `Tus permisos en la sede ${sede.nombre} fueron reiniciados. Se limpiaron accesos directos y tu rol base quedó en Lectura para reconfigurarlo nuevamente.`,
  })

  return NextResponse.json({ success: true, data: result })
}