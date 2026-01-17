import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { NotificationType } from '@prisma/client'

export const runtime = 'nodejs'

function badgeColor(type: NotificationType) {
  switch (type) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800'
    case 'WARNING':
      return 'bg-yellow-100 text-yellow-900'
    case 'ERROR':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-blue-100 text-blue-800'
  }
}

export default async function NotificacionesPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const userId = session.user.id

  const count = await prisma.notification.count({ where: { userId } })
  if (count === 0) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'INFO',
        title: 'Notificación de prueba',
        body: 'Aquí verás avisos del sistema: compras, órdenes, cotizaciones y alertas.',
      },
    })
  }

  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
  })

  const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } })

  async function markAllRead() {
    'use server'
    const session2 = await auth()
    if (!session2) return
    await prisma.notification.updateMany({
      where: { userId: session2.user.id, readAt: null },
      data: { readAt: new Date() },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
          </p>
        </div>
        <form action={markAllRead}>
          <Button type="submit" variant="outline" disabled={unreadCount === 0}>
            Marcar todo como leído
          </Button>
        </form>
      </div>

      <div className="grid gap-4">
        {items.map((n) => (
          <Card key={n.id} className={n.readAt ? 'opacity-80' : ''}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{n.title}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${badgeColor(n.type)}`}>{n.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString('es-CO')}
                  </span>
                  {!n.readAt && <span className="text-xs font-medium">Sin leer</span>}
                </div>
              </div>
            </CardHeader>
            {n.body && (
              <CardContent>
                <p className="text-sm text-gray-700">{n.body}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
