import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser, sedeRoleToBaseAccess } from '@/lib/rbac'
import { SedeRole } from '@prisma/client'

export const runtime = 'nodejs'

const SEDE_ROLES: SedeRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']

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

  const sedeId = typeof body.sedeId === 'string' ? body.sedeId.trim() : ''
  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const role = typeof body.role === 'string' ? (body.role.trim() as SedeRole) : null

  if (!sedeId || !targetUserId || !role) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }
  if (!SEDE_ROLES.includes(role)) {
    return NextResponse.json({ success: false, error: 'Rol inválido' }, { status: 400 })
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

  const requesterIsSedeAdmin = requesterMembership?.role === 'ADMIN' || requesterMembership?.role === 'MANAGER'
  if (!requesterIsSystemAdmin && !requesterIsSedeAdmin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  })
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const updated = await prisma.sedeMembership.update({
    where: { sedeId_userId: { sedeId, userId: targetUser.id } },
    data: { role },
    select: { role: true },
  })

  // Consistencia: si el rol cambia, alinear los permisos explícitos por módulo
  // para que los módulos habilitados (≠ NONE) reflejen el nivel base del rol.
  // Los módulos deshabilitados (NONE) se mantienen como override.
  const base = sedeRoleToBaseAccess(updated.role)
  await prisma.userModuleAccess.updateMany({
    where: {
      sedeId,
      userId: targetUser.id,
      level: { not: 'NONE' },
    },
    data: { level: base },
  })

  await prisma.notification.create({
    data: {
      userId: targetUser.id,
      type: 'INFO',
      title: 'Rol actualizado',
      body: `Tu rol en la sede ${sede.nombre} fue actualizado a ${role}.`,
      sedeId,
      empresaId,
    },
  })

  return NextResponse.json({ success: true, data: { role: updated.role } })
}
