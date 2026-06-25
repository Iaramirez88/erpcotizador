import { publishRealtimeNotification } from '@/lib/notification-realtime'

type NotificationWriter = {
  notification: {
    create: (args: {
      data: {
        type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
        title: string
        body: string | null
        actionUrl: string
        actionLabel: string
        empresaId: string
        sedeId: string | null
        userId: string
      }
    }) => Promise<{
      id: string
      type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
      title: string
      body: string | null
      actionUrl: string | null
      actionLabel: string | null
      readAt: Date | null
      createdAt: Date
      userId: string | null
    }>
  }
}

type TaskUserNotificationArgs = {
  client: NotificationWriter
  empresaId: string
  sedeId?: string | null
  actorUserId?: string | null
  recipientUserIds: string[]
  title: string
  body?: string | null
  taskId: string
  workspaceId?: string | null
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  actionLabel?: string
}

export function buildTaskNotificationUrl(taskId: string, workspaceId?: string | null) {
  const params = new URLSearchParams({ taskId })
  if (workspaceId) {
    params.set('workspaceId', workspaceId)
  }
  return `/dashboard/crm/tareas?${params.toString()}`
}

export async function notifyTaskUsers(args: TaskUserNotificationArgs) {
  const uniqueRecipients = Array.from(new Set(args.recipientUserIds.filter(Boolean))).filter((userId) => userId !== args.actorUserId)
  if (!uniqueRecipients.length) return

  const actionUrl = buildTaskNotificationUrl(args.taskId, args.workspaceId)

  const createdNotifications = await Promise.all(
    uniqueRecipients.map((userId) => args.client.notification.create({
      data: {
        type: args.type ?? 'INFO',
        title: args.title,
        body: args.body ?? null,
        actionUrl,
        actionLabel: args.actionLabel ?? 'Abrir tarea',
        empresaId: args.empresaId,
        sedeId: args.sedeId ?? null,
        userId,
      },
    })),
  )

  createdNotifications.forEach((notification) => {
    if (!notification.userId) return
    publishRealtimeNotification({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
      userId: notification.userId,
    })
  })
}