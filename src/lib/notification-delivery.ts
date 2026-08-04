import webpush from 'web-push'
import { DEFAULT_NOTIFICATION_ACTION_LABEL, normalizeNotificationActionUrl } from '@/lib/notifications'
import { publishRealtimeNotification, type RealtimeNotificationPayload } from '@/lib/notification-realtime'

type DeliverableNotification = {
  id?: string | null
  type?: string | null
  title?: string | null
  body?: string | null
  actionUrl?: string | null
  actionLabel?: string | null
  readAt?: string | Date | null
  createdAt?: string | Date | null
  userId?: string | null
  unreadCount?: number | null
}

type WebPushSubscriptionRow = {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}

type NotificationDeliveryClient = {
  notification: {
    count: (args: {
      where: {
        userId: string
        readAt: null
        archivedAt: null
        publishAt: { lte: Date }
      }
    }) => Promise<number>
  }
  webPushSubscription: {
    findMany: (args: {
      where: { userId: { in: string[] } }
      select: {
        id: true
        userId: true
        endpoint: true
        p256dh: true
        auth: true
      }
    }) => Promise<WebPushSubscriptionRow[]>
    deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<{ count: number }>
  }
}

let vapidConfigured = false

function asIsoString(value: string | Date | null | undefined) {
  if (typeof value === 'string' && value.trim()) return value
  if (value instanceof Date) return value.toISOString()
  return null
}

function normalizeRealtimePayload(notification: DeliverableNotification): RealtimeNotificationPayload | null {
  const userId = typeof notification.userId === 'string' && notification.userId.trim() ? notification.userId.trim() : null
  const title = typeof notification.title === 'string' && notification.title.trim() ? notification.title.trim() : null

  if (!userId || !title) return null

  return {
    id: typeof notification.id === 'string' && notification.id.trim() ? notification.id.trim() : null,
    type: typeof notification.type === 'string' && notification.type.trim() ? notification.type.trim() : 'INFO',
    title,
    body: typeof notification.body === 'string' && notification.body.trim() ? notification.body.trim() : null,
    actionUrl: normalizeNotificationActionUrl(notification.actionUrl) ?? null,
    actionLabel: typeof notification.actionLabel === 'string' && notification.actionLabel.trim() ? notification.actionLabel.trim() : DEFAULT_NOTIFICATION_ACTION_LABEL,
    readAt: asIsoString(notification.readAt),
    createdAt: asIsoString(notification.createdAt) ?? new Date().toISOString(),
    userId,
    unreadCount: typeof notification.unreadCount === 'number' && Number.isFinite(notification.unreadCount) ? Math.max(0, Math.floor(notification.unreadCount)) : null,
  }
}

async function resolveUnreadCountMap(client: NotificationDeliveryClient, userIds: string[]) {
  const now = new Date()
  const pairs = await Promise.all(
    userIds.map(async (userId) => {
      const count = await client.notification.count({
        where: {
          userId,
          readAt: null,
          archivedAt: null,
          publishAt: { lte: now },
        },
      }).catch(() => 0)

      return [userId, count] as const
    })
  )

  return new Map(pairs)
}

function buildNotificationOpenPath(payload: RealtimeNotificationPayload) {
  if (payload.id) return `/dashboard/notificaciones/open/${payload.id}`
  return payload.actionUrl || '/dashboard/notificaciones'
}

function getWebPushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() || ''
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim() || ''
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || ''

  return {
    publicKey,
    privateKey,
    subject,
  }
}

function ensureWebPushConfiguration() {
  const config = getWebPushConfig()
  if (!config.publicKey || !config.privateKey || !config.subject) return null

  if (!vapidConfigured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    vapidConfigured = true
  }

  return config
}

function buildWebPushMessage(payload: RealtimeNotificationPayload) {
  return JSON.stringify({
    id: payload.id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    actionUrl: buildNotificationOpenPath(payload),
    actionLabel: payload.actionLabel,
    tag: payload.id ? `notification-${payload.id}` : `notification-${payload.userId}`,
    unreadCount: payload.unreadCount ?? 0,
  })
}

export function isWebPushEnabled() {
  return Boolean(ensureWebPushConfiguration())
}

export function getWebPushPublicKey() {
  return getWebPushConfig().publicKey || null
}

export async function deliverNotifications(client: NotificationDeliveryClient, input: DeliverableNotification | DeliverableNotification[]) {
  const payloads = (Array.isArray(input) ? input : [input])
    .map(normalizeRealtimePayload)
    .filter((payload): payload is RealtimeNotificationPayload => Boolean(payload))

  if (!payloads.length) return

  const unreadCountMap = await resolveUnreadCountMap(client, Array.from(new Set(payloads.map((payload) => payload.userId))))
  const optimisticUnreadByUserId = new Map<string, number>()
  payloads.forEach((payload) => {
    if (payload.readAt) return
    optimisticUnreadByUserId.set(payload.userId, (optimisticUnreadByUserId.get(payload.userId) ?? 0) + 1)
  })

  const payloadsWithCounts = payloads.map((payload) => ({
    ...payload,
    unreadCount: Math.max(
      unreadCountMap.get(payload.userId) ?? 0,
      optimisticUnreadByUserId.get(payload.userId) ?? 0,
      payload.unreadCount ?? 0,
    ),
  }))

  payloadsWithCounts.forEach((payload) => {
    publishRealtimeNotification(payload)
  })

  if (!ensureWebPushConfiguration()) return

  const userIds = Array.from(new Set(payloadsWithCounts.map((payload) => payload.userId)))
  const subscriptions = await client.webPushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  })

  if (!subscriptions.length) return

  const payloadsByUserId = new Map<string, RealtimeNotificationPayload[]>()
  payloadsWithCounts.forEach((payload) => {
    const current = payloadsByUserId.get(payload.userId) ?? []
    current.push(payload)
    payloadsByUserId.set(payload.userId, current)
  })

  const staleSubscriptionIds = new Set<string>()

  await Promise.all(
    subscriptions.flatMap((subscription) => {
      const userPayloads = payloadsByUserId.get(subscription.userId) ?? []

      return userPayloads.map(async (payload) => {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          }, buildWebPushMessage(payload))
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : 0

          if (statusCode === 404 || statusCode === 410) {
            staleSubscriptionIds.add(subscription.id)
            return
          }

          console.error('No se pudo enviar la notificación push.', error)
        }
      })
    })
  )

  if (staleSubscriptionIds.size > 0) {
    await client.webPushSubscription.deleteMany({
      where: {
        id: { in: Array.from(staleSubscriptionIds) },
      },
    })
  }
}