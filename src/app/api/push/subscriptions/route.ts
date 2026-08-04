import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeBrowserPushSubscription } from '@/lib/push-subscription'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const rows = await prisma.webPushSubscription.findMany({
    where: { userId: session.user.id },
    orderBy: [{ updatedAt: 'desc' }],
    take: 3,
    select: {
      id: true,
      endpoint: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    ok: true,
    subscribed: rows.length > 0,
    count: rows.length,
    items: rows.map((row) => ({
      id: row.id,
      endpointTail: row.endpoint.slice(-18),
      updatedAt: row.updatedAt.toISOString(),
    })),
  })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const parsed = normalizeBrowserPushSubscription(await request.json().catch(() => null))
  if (!parsed) {
    return NextResponse.json({ ok: false, error: 'Suscripción inválida' }, { status: 400 })
  }

  await prisma.webPushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    create: {
      userId: session.user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      expirationTime: parsed.expirationTime ? new Date(parsed.expirationTime) : null,
      userAgent: request.headers.get('user-agent'),
    },
    update: {
      userId: session.user.id,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      expirationTime: parsed.expirationTime ? new Date(parsed.expirationTime) : null,
      userAgent: request.headers.get('user-agent'),
    },
    select: { id: true },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : ''
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: 'endpoint es requerido' }, { status: 400 })
  }

  await prisma.webPushSubscription.deleteMany({
    where: {
      userId: session.user.id,
      endpoint,
    },
  })

  return NextResponse.json({ ok: true })
}