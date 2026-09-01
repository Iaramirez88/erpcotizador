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
import NotificationSelectAllToggle from './notification-select-all-toggle'
import { Archive, CheckCheck, ChevronLeft, ChevronRight, ExternalLink, Search, Trash2, X } from 'lucide-react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 6

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

function normalizePageParam(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return 1
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function buildNotificationsHref(q: string, page: number): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  const search = params.toString()
  return search ? `/dashboard/notificaciones?${search}` : '/dashboard/notificaciones'
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
  const requestedPage = normalizePageParam(searchParams?.page)

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

  const totalItems = await prisma.notification.count({ where: listWhere })
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalItems)

  const items = await prisma.notification.findMany({
    where: listWhere,
    orderBy: { createdAt: 'desc' },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
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
      data: { readAt: new Date(), archivedAt: new Date() },
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
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4 overflow-hidden md:h-[calc(100vh-8.5rem)]">
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
          { label: 'Visibles', value: totalItems, hint: `${items.length} en esta página`, tone: 'neutral' },
          { label: 'Filtro', value: q ? 'Activo' : 'Todos', hint: q || 'Sin búsqueda', tone: 'teal' },
          { label: 'Gestión', value: canManageNotifications ? 'Admin' : 'Lectura', hint: 'Nivel de acción', tone: 'sky' },
        ]}
      />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-3">
            <form action="/dashboard/notificaciones" method="get" className="flex min-w-[15rem] flex-1 items-center gap-2">
              <Input
                name="q"
                defaultValue={q}
                placeholder={t('notifications.searchPlaceholder')}
                className="h-9 rounded-full border-slate-200 bg-white"
              />
              <Button type="submit" variant="outline" size="icon" title={t('notifications.searchButton')} aria-label={t('notifications.searchButton')}>
                <Search className="h-4 w-4" />
              </Button>
              {q ? (
                <Button asChild variant="outline" size="icon" title={t('notifications.clearSearch')} aria-label={t('notifications.clearSearch')}>
                  <Link href="/dashboard/notificaciones">
                    <X className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </form>

            {items.length > 0 ? (
              <>
                <p className="min-w-[14rem] flex-1 text-xs text-muted-foreground md:max-w-sm">{t('notifications.selectionHint')}</p>
                <div className="flex items-center gap-2">
                  <NotificationSelectAllToggle />
                  <Button type="submit" form="notification-bulk-form" formAction={markSelectedRead} variant="outline" size="icon" title="Marcar seleccionadas como leídas" aria-label="Marcar seleccionadas como leídas">
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                  <Button type="submit" form="notification-bulk-form" formAction={archiveSelected} variant="outline" size="icon" title={t('notifications.actions.archiveSelected')} aria-label={t('notifications.actions.archiveSelected')}>
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button type="submit" form="notification-bulk-form" formAction={deleteSelected} variant="destructive" size="icon" title={t('notifications.actions.deleteSelected')} aria-label={t('notifications.actions.deleteSelected')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="mt-3 flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/40 px-6 py-10">
              <div className="max-w-xl text-center">
                <CardTitle className="text-base text-slate-950">{t('notifications.empty.title')}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {q ? t('notifications.emptyFiltered') : t('notifications.empty.description')}
                </p>
              </div>
            </div>
          ) : (
            <form id="notification-bulk-form" className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {items.map((n) => (
                    <Card key={n.id} className={n.readAt ? 'rounded-2xl border-slate-200 bg-white opacity-80 shadow-none' : 'rounded-2xl border-sky-200 bg-white shadow-none'}>
                      <CardHeader className="flex flex-row items-start gap-3 px-3 py-3">
                        <input
                          type="checkbox"
                          name="ids"
                          value={n.id}
                          className="mt-0.5 h-4 w-4 rounded border border-input"
                          aria-label={`Seleccionar notificación ${n.title}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-sm font-semibold text-slate-950">{n.title}</CardTitle>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${badgeColor(n.type)}`}>{t(`notifications.type.${n.type}`)}</span>
                                <span className="text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString(locale)}</span>
                                {!n.readAt ? <span className="text-[11px] font-medium text-sky-700">{t('notifications.unreadBadge')}</span> : null}
                              </div>
                              {n.body ? <p className="mt-2 text-sm leading-5 text-slate-600">{n.body}</p> : null}
                            </div>
                            {n.actionUrl ? (
                              <Button asChild size="icon" title={n.actionLabel || DEFAULT_NOTIFICATION_ACTION_LABEL} aria-label={n.actionLabel || DEFAULT_NOTIFICATION_ACTION_LABEL}>
                                <Link href={`/dashboard/notificaciones/open/${n.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <p className="text-xs text-muted-foreground">
                  Mostrando {pageStart}-{pageEnd} de {totalItems} notificaciones.
                </p>
                <div className="flex items-center gap-2">
                  {currentPage > 1 ? (
                    <Button asChild variant="outline">
                      <Link href={buildNotificationsHref(q, currentPage - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Link>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled>
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                  )}
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    Página {currentPage} de {totalPages}
                  </div>
                  {currentPage < totalPages ? (
                    <Button asChild variant="outline">
                      <Link href={buildNotificationsHref(q, currentPage + 1)}>
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled>
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
