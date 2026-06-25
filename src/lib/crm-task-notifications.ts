type NotificationWriter = {
  notification: {
    createMany: (args: {
      data: Array<{
        type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
        title: string
        body: string | null
        actionUrl: string
        actionLabel: string
        empresaId: string
        sedeId: string | null
        userId: string
      }>
    }) => Promise<unknown>
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

  await args.client.notification.createMany({
    data: uniqueRecipients.map((userId) => ({
      type: args.type ?? 'INFO',
      title: args.title,
      body: args.body ?? null,
      actionUrl,
      actionLabel: args.actionLabel ?? 'Abrir tarea',
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      userId,
    })),
  })
}