import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { NotificationType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'

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
  const language = await getServerLanguage()
  const t = (key: string, vars?: Record<string, string>) => translate(language, key, vars)
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const session = await auth()
  if (!session) redirect('/auth/login')

  const userId = session.user.id
  const now = new Date()

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      globalAccess: { select: { level: true } },
      sedeMemberships: { where: { role: 'ADMIN' }, select: { sedeId: true }, take: 1 },
    },
  })

  const canManageNotifications =
    session.user.role === 'ADMIN' ||
    isSuperAdminEmail(session.user.email) ||
    requester?.globalAccess?.level === 'ADMIN' ||
    (requester?.sedeMemberships?.length ?? 0) > 0

  const count = await prisma.notification.count({ where: { userId } })
  if (count === 0) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'INFO',
        title: t('notifications.seed.title'),
        body: t('notifications.seed.body'),
      },
    })
  }

  const listWhere: Prisma.NotificationWhereInput = { userId, archivedAt: null, publishAt: { lte: now } }
  const items = await prisma.notification.findMany({
    where: listWhere,
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

  const unreadWhere: Prisma.NotificationWhereInput = { userId, readAt: null, archivedAt: null, publishAt: { lte: now } }
  const unreadCount = await prisma.notification.count({
    where: unreadWhere,
  })

  async function markAllRead() {
    'use server'
    const session2 = await auth()
    if (!session2) return
    const markAllWhere: Prisma.NotificationWhereInput = {
      userId: session2.user.id,
      readAt: null,
      archivedAt: null,
      publishAt: { lte: new Date() },
    }
    await prisma.notification.updateMany({
      where: markAllWhere,
      data: { readAt: new Date() },
    })
    revalidatePath('/dashboard/notificaciones')
  }

  async function archiveOne(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const id = String(formData.get('id') ?? '')
    if (!id) return

    const archiveWhere: Prisma.NotificationWhereInput = { id, userId: session2.user.id, archivedAt: null }
    const archiveData: Prisma.NotificationUpdateManyMutationInput = { archivedAt: new Date() }
    await prisma.notification.updateMany({
      where: archiveWhere,
      data: archiveData,
    })

    revalidatePath('/dashboard/notificaciones')
  }

  async function deleteOne(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const id = String(formData.get('id') ?? '')
    if (!id) return

    const requesterId = session2.user.id
    const requesterDb = await prisma.user.findUnique({
      where: { id: requesterId },
      select: {
        id: true,
        email: true,
        globalAccess: { select: { level: true } },
        sedeMemberships: { where: { role: 'ADMIN' }, select: { sedeId: true }, take: 1 },
      },
    })

    const requesterCanDelete =
      session2.user.role === 'ADMIN' ||
      isSuperAdminEmail(session2.user.email) ||
      isSuperAdminEmail(requesterDb?.email) ||
      requesterDb?.globalAccess?.level === 'ADMIN' ||
      (requesterDb?.sedeMemberships?.length ?? 0) > 0

    if (!requesterCanDelete) return

    const empresaId = await requireEmpresaIdForUser(requesterId)
    const notif = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, empresaId: true, user: { select: { empresaId: true } } },
    })
    if (!notif?.id) return

    const notifEmpresaId = notif.empresaId ?? notif.user?.empresaId ?? null
    if (notifEmpresaId && notifEmpresaId !== empresaId) return

    await prisma.notification.delete({ where: { id } })
    revalidatePath('/dashboard/notificaciones')
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="ERP comunicación"
        title={t('notifications.title')}
        description={
          unreadCount > 0
            ? t('notifications.unreadCount', { count: String(unreadCount) })
            : t('notifications.allCaughtUp')
        }
        actions={
          <>
            {canManageNotifications && (
              <Button asChild>
                <Link href="/dashboard/notificaciones/crear">{t('notifications.actions.create')}</Link>
              </Button>
            )}
            <form action={markAllRead}>
              <Button type="submit" variant="outline" disabled={unreadCount === 0}>
                {t('notifications.actions.markAllRead')}
              </Button>
            </form>
          </>
        }
        stats={[
          { label: 'Pendientes', value: unreadCount, hint: 'Sin leer', tone: 'amber' },
          { label: 'Visibles', value: items.length, hint: 'Listado actual', tone: 'neutral' },
          { label: 'Gestión', value: canManageNotifications ? 'Admin' : 'Lectura', hint: 'Nivel de acción', tone: 'sky' },
        ]}
      />

      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('notifications.empty.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('notifications.empty.description')}</p>
            </CardContent>
          </Card>
        ) : (
          items.map((n) => (
            <Card key={n.id} className={n.readAt ? 'opacity-80' : ''}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${badgeColor(n.type)}`}>{t(`notifications.type.${n.type}`)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString(locale)}</span>
                    {!n.readAt && <span className="text-xs font-medium">{t('notifications.unreadBadge')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={archiveOne}>
                    <input type="hidden" name="id" value={n.id} />
                    <Button type="submit" variant="outline" size="sm">
                      {t('notifications.actions.archive')}
                    </Button>
                  </form>
                  {canManageNotifications && (
                    <form action={deleteOne}>
                      <input type="hidden" name="id" value={n.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        {t('notifications.actions.delete')}
                      </Button>
                    </form>
                  )}
                </div>
              </CardHeader>
              {n.body && (
                <CardContent>
                  <p className="text-sm text-gray-700">{n.body}</p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
