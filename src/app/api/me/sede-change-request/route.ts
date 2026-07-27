import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'

export const runtime = 'nodejs'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const targetSedeId = normalizeString(body?.targetSedeId)
  const reason = normalizeString(body?.reason)

  if (!targetSedeId) {
    return NextResponse.json({ success: false, error: 'Debes seleccionar una sede para la solicitud.' }, { status: 400 })
  }

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      empresaId: true,
      sedeDefaultId: true,
      sedeMemberships: { select: { sedeId: true } },
    },
  })

  if (!requester?.id || !requester.empresaId) {
    return NextResponse.json({ success: false, error: 'No se encontró la empresa del usuario.' }, { status: 404 })
  }

  const targetSede = await prisma.sede.findUnique({
    where: { id: targetSedeId },
    select: { id: true, empresaId: true, nombre: true, codigo: true },
  })

  if (!targetSede?.id || targetSede.empresaId !== requester.empresaId) {
    return NextResponse.json({ success: false, error: 'La sede solicitada no es válida para tu empresa.' }, { status: 400 })
  }

  if (requester.sedeDefaultId === targetSede.id || requester.sedeMemberships.some((membership) => membership.sedeId === targetSede.id)) {
    return NextResponse.json({ success: false, error: 'Esa sede ya está disponible en tu perfil. Puedes seleccionarla directamente.' }, { status: 409 })
  }

  const admins = await prisma.sedeMembership.findMany({
    where: {
      sede: { empresaId: requester.empresaId },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { userId: true },
  })

  const recipientUserIds = Array.from(new Set(admins.map((item) => item.userId).filter((item) => item && item !== requester.id)))
  if (!recipientUserIds.length) {
    return NextResponse.json({ success: false, error: 'No hay administradores disponibles para aprobar el cambio de sede.' }, { status: 409 })
  }

  const requesterLabel = requester.name?.trim() || requester.email?.trim() || requester.id
  const requestBody = reason
    ? `${requesterLabel} solicitó acceso a la sede ${targetSede.nombre}${targetSede.codigo ? ` (${targetSede.codigo})` : ''}. Motivo: ${reason}`
    : `${requesterLabel} solicitó acceso a la sede ${targetSede.nombre}${targetSede.codigo ? ` (${targetSede.codigo})` : ''}.`

  await prisma.notification.createMany({
    data: recipientUserIds.map((recipientUserId) => ({
      userId: recipientUserId,
      empresaId: requester.empresaId,
      sedeId: targetSede.id,
      type: 'WARNING',
      title: 'Solicitud de cambio de sede',
      body: requestBody,
      actionUrl: '/dashboard/configuracion/usuarios',
      actionLabel: 'Revisar usuario',
    })),
  })

  return NextResponse.json({
    success: true,
    message: 'Solicitud enviada. Un administrador debe autorizar el cambio de sede.',
  })
}