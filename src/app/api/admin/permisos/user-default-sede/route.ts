import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { SedeRole } from '@prisma/client'

export const runtime = 'nodejs'

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
  const sedeDefaultIdRaw = typeof body.sedeDefaultId === 'string' ? body.sedeDefaultId.trim() : null
  const sedeDefaultId = sedeDefaultIdRaw ? sedeDefaultIdRaw : null

  if (!targetUserId) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)

  const requesterIsSystemAdmin = session.user.role === 'ADMIN'
  const requesterIsSedeAdmin =
    !!(await prisma.sedeMembership.findFirst({
      where: {
        userId: session.user.id,
        sede: { empresaId },
        role: { in: ['ADMIN', 'MANAGER'] },
      },
      select: { id: true },
    }))

  if (!requesterIsSystemAdmin && !requesterIsSedeAdmin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, name: true, empresaId: true, globalAccess: { select: { level: true } } },
  })
  if (!targetUser?.id) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const targetBelongsToEmpresa =
    targetUser.empresaId === empresaId ||
    !!(await prisma.sedeMembership.findFirst({
      where: { userId: targetUser.id, sede: { empresaId } },
      select: { id: true },
    }))

  if (!targetBelongsToEmpresa) {
    return NextResponse.json({ success: false, error: 'Usuario inválido' }, { status: 400 })
  }

  if (!sedeDefaultId) {
    await prisma.user.update({ where: { id: targetUser.id }, data: { sedeDefaultId: null } }).catch(() => null)
    return NextResponse.json({ success: true, data: { sedeDefaultId: null } })
  }

  const sede = await prisma.sede.findUnique({
    where: { id: sedeDefaultId },
    select: { id: true, empresaId: true, nombre: true },
  })
  if (!sede || sede.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'Sede inválida' }, { status: 400 })
  }

  const globalLevel = targetUser.globalAccess?.level ?? 'NONE'
  const roleFromGlobal: SedeRole =
    globalLevel === 'ADMIN'
      ? 'ADMIN'
      : globalLevel === 'WRITE'
        ? 'MEMBER'
        : globalLevel === 'READ'
          ? 'READER'
          : 'READER'

  await prisma.$transaction(async (tx) => {
    await tx.sedeMembership.upsert({
      where: { sedeId_userId: { sedeId: sede.id, userId: targetUser.id } },
      create: { sedeId: sede.id, userId: targetUser.id, role: roleFromGlobal },
      update: {},
    })

    await tx.user.update({ where: { id: targetUser.id }, data: { sedeDefaultId: sede.id } })

    await tx.notification.create({
      data: {
        userId: targetUser.id,
        type: 'INFO',
        title: 'Sede asignada',
        body: `Tu sede por defecto fue actualizada a ${sede.nombre}.`,
        sedeId: sede.id,
        empresaId,
        actionUrl: '/dashboard/perfil',
        actionLabel: 'Ver perfil',
      },
    })
  })

  return NextResponse.json({ success: true, data: { sedeDefaultId: sede.id } })
}
