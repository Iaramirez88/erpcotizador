import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  const userId = session.user.id

  // Si el usuario no tiene notificaciones, creamos 1 de ejemplo para orientar.
  const existingCount = await prisma.notification.count({ where: { userId } })
  if (existingCount === 0) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'INFO',
        title: 'Notificación de prueba',
        body: 'Aquí verás avisos del sistema: compras, órdenes, cotizaciones y alertas.',
      },
    })
  }

  const where = {
    userId,
    ...(unreadOnly ? { readAt: null as null } : {}),
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
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  return NextResponse.json({ ok: true, items, unreadCount })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user.id
  const body: unknown = await request.json().catch(() => ({}))
  const { id, all } = (body ?? {}) as { id?: unknown; all?: unknown }

  if (all === true) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
  }

  // Asegura que solo marque como leída una notificación del usuario.
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
