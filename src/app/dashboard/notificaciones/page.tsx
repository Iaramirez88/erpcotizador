import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { NotificationType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { DEFAULT_NOTIFICATION_ACTION_LABEL } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

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

function normalizeSearchParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function extractSelectedIds(formData: FormData): string[] {
  return Array.from(
    new Set(
      formData
        .getAll('ids')
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

export default async function NotificacionesPage({ searchParams }: PageProps) {
  const language = await getServerLanguage()
  const t = (key: string, vars?: Record<string, string>) => translate(language, key, vars)
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const session = await auth()
  if (!session) redirect('/auth/login')

  const userId = session.user.id
  const now = new Date()
  const q = normalizeSearchParam(searchParams?.q)

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
        actionUrl: '/dashboard/notificaciones',
        actionLabel: t('notifications.actions.open'),
      },
    })
  }

  const listWhere: Prisma.NotificationWhereInput = {
    userId,
    archivedAt: null,
    publishAt: { lte: now },
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const items = await prisma.notification.findMany({
    where: listWhere,
    orderBy: { createdAt: 'desc' },
    take: 50,
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

  async function markSelectedRead(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const ids = extractSelectedIds(formData)
    if (ids.length === 0) return

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId: session2.user.id,
        readAt: null,
        archivedAt: null,
        publishAt: { lte: new Date() },
      },
      data: { readAt: new Date() },
    })

    revalidatePath('/dashboard/notificaciones')
  }

  async function archiveSelected(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const ids = extractSelectedIds(formData)
    if (ids.length === 0) return

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId: session2.user.id,
        archivedAt: null,
      },
      data: { archivedAt: new Date() },
    })

    revalidatePath('/dashboard/notificaciones')
  }

  async function deleteSelected(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const ids = extractSelectedIds(formData)
    if (ids.length === 0) return

    await prisma.notification.deleteMany({
      where: {
        id: { in: ids },
        userId: session2.user.id,
      },
    })

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
          { label: 'Filtro', value: q ? 'Activo' : 'Todos', hint: q || 'Sin búsqueda', tone: 'teal' },
          { label: 'Gestión', value: canManageNotifications ? 'Admin' : 'Lectura', hint: 'Nivel de acción', tone: 'sky' },
        ]}
      />

      <Card>
        <CardContent className="pt-6">
          <form action="/dashboard/notificaciones" method="get" className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              name="q"
              defaultValue={q}
              placeholder={t('notifications.searchPlaceholder')}
              className="md:flex-1"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" variant="outline">{t('notifications.searchButton')}</Button>
              {q ? (
                <Button asChild variant="ghost">
                  <Link href="/dashboard/notificaciones">{t('notifications.clearSearch')}</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('notifications.empty.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {q ? t('notifications.emptyFiltered') : t('notifications.empty.description')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <form className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">{t('notifications.selectionHint')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" formAction={markSelectedRead} variant="outline">
                  {t('notifications.actions.markSelectedRead')}
                </Button>
                <Button type="submit" formAction={archiveSelected} variant="outline">
                  {t('notifications.actions.archiveSelected')}
                </Button>
                <Button type="submit" formAction={deleteSelected} variant="destructive">
                  {t('notifications.actions.deleteSelected')}
                </Button>
              </div>
            </div>

            {items.map((n) => (
              <Card key={n.id} className={n.readAt ? 'opacity-80' : ''}>
                <CardHeader className="flex flex-row items-start gap-3">
                  <input
                    type="checkbox"
                    name="ids"
                    value={n.id}
                    className="mt-1 h-4 w-4 rounded border border-input"
                    aria-label={`Seleccionar notificación ${n.title}`}
                  />
                  <div className="flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-base">{n.title}</CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${badgeColor(n.type)}`}>{t(`notifications.type.${n.type}`)}</span>
                          <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString(locale)}</span>
                          {!n.readAt && <span className="text-xs font-medium">{t('notifications.unreadBadge')}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {n.actionUrl ? (
                          <Button asChild size="sm">
                            <Link href={`/dashboard/notificaciones/open/${n.id}`}>
                              {n.actionLabel || DEFAULT_NOTIFICATION_ACTION_LABEL}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
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
          </form>
        )}
      </div>
    </div>
  )
}
