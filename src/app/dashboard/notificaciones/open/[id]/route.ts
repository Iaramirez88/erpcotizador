import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeNotificationActionUrl } from '@/lib/notifications'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const { id } = await context.params
  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId: session.user.id,
      archivedAt: null,
      publishAt: { lte: new Date() },
    },
    select: { id: true, actionUrl: true },
  })

  if (notification?.id) {
    await prisma.notification.updateMany({
      where: { id: notification.id, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    })
  }

  const destination = normalizeNotificationActionUrl(notification?.actionUrl) ?? '/dashboard/notificaciones'
  return NextResponse.redirect(new URL(destination, request.url))
}