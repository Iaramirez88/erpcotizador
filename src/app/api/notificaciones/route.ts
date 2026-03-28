import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeNotificationActionLabel, normalizeNotificationActionUrl } from '@/lib/notifications'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function normalizeLimit(value: string | null): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 20
  return Math.min(100, Math.max(1, Math.floor(n)))
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = normalizeLimit(searchParams.get('limit'))
  const q = searchParams.get('q')?.trim() || ''

  const userId = session.user.id
  const now = new Date()

  // Si el usuario no tiene notificaciones, creamos 1 de ejemplo para orientar.
  const existingCount = await prisma.notification.count({ where: { userId } })
  if (existingCount === 0) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'INFO',
        title: 'Notificación de prueba',
        body: 'Aquí verás avisos del sistema: compras, órdenes, cotizaciones y alertas.',
        actionUrl: '/dashboard/notificaciones',
        actionLabel: 'Abrir centro',
      },
    })
  }

  const where: Prisma.NotificationWhereInput = {
    userId,
    archivedAt: null,
    publishAt: { lte: now },
  }
  if (unreadOnly) where.readAt = null
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
    ]
  }

  const unreadCountWhere: Prisma.NotificationWhereInput = {
    userId,
    readAt: null,
    archivedAt: null,
    publishAt: { lte: now },
  }

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        actionUrl: true,
        actionLabel: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: unreadCountWhere }),
  ])

  return NextResponse.json({ ok: true, items, unreadCount })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const body: unknown = await request.json().catch(() => ({}))
  const { id, ids, all } = (body ?? {}) as { id?: unknown; ids?: unknown; all?: unknown }

  if (all === true) {
    const markAllWhere: Prisma.NotificationWhereInput = {
      userId,
      readAt: null,
      archivedAt: null,
      publishAt: { lte: now },
    }
    await prisma.notification.updateMany({
      where: markAllWhere,
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  const idList = Array.isArray(ids)
    ? ids.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : typeof id === 'string' && id
      ? [id]
      : []

  if (idList.length === 0) {
    return NextResponse.json({ error: 'id o ids es requerido' }, { status: 400 })
  }

  // Asegura que solo marque como leídas notificaciones del usuario.
  const markOneWhere: Prisma.NotificationWhereInput = {
    id: { in: idList },
    userId,
    readAt: null,
    archivedAt: null,
    publishAt: { lte: now },
  }
  await prisma.notification.updateMany({
    where: markOneWhere,
    data: { readAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
