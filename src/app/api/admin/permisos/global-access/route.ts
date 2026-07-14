import { NextResponse } from 'next/server'
import { AccessLevel } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { detachPermissionProfileAssignment, publishPermissionUpdateNotification } from '@/lib/rbac-permission-sync'

export const runtime = 'nodejs'

const ACCESS_LEVELS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const sedeId = typeof body.sedeId === 'string' ? body.sedeId.trim() : ''
  const level = typeof body.level === 'string' ? (body.level.trim() as AccessLevel) : null

  if (!targetUserId || !level || !ACCESS_LEVELS.includes(level)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)

  const requesterIsSystemAdmin = session.user.role === 'ADMIN'
  const requesterMembership = await prisma.sedeMembership.findFirst({
    where: {
      userId: session.user.id,
      sede: { empresaId },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  })

  if (!requesterIsSystemAdmin && !requesterMembership?.id) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, name: true, empresaId: true },
  })

  if (!targetUser?.id) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const belongsToEmpresa =
    targetUser.empresaId === empresaId ||
    !!(await prisma.sedeMembership.findFirst({
      where: { userId: targetUser.id, sede: { empresaId } },
      select: { id: true },
    }))

  if (!belongsToEmpresa) {
    return NextResponse.json({ success: false, error: 'El usuario no pertenece a esta empresa' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    if (sedeId) {
      const sede = await tx.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true } })
      if (sede?.empresaId === empresaId) {
        await detachPermissionProfileAssignment({ client: tx, empresaId, sedeId, userId: targetUser.id })
      }
    }

    if (level === 'NONE') {
      await tx.userGlobalAccess.deleteMany({ where: { userId: targetUser.id, empresaId } })
      return
    }

    await tx.userGlobalAccess.upsert({
      where: { userId: targetUser.id },
      create: { userId: targetUser.id, empresaId, level },
      update: { empresaId, level },
    })
  })

  await publishPermissionUpdateNotification({
    client: prisma,
    userId: targetUser.id,
    empresaId,
    sedeId: sedeId || null,
    title: 'Permisos actualizados',
    body: level === 'NONE'
      ? 'Tu permiso general fue desactivado.'
      : `Tu permiso general fue actualizado a ${level}.`,
  })

  return NextResponse.json({ success: true, data: { level } })
}