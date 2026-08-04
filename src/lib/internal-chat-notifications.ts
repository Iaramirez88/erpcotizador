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
    }) => Promise<unknown>
  }
}

type InternalChatNotificationArgs = {
  client: NotificationWriter
  empresaId: string
  sedeId?: string | null
  actorUserId: string
  recipientUserIds: string[]
  threadId: string
  senderLabel: string
  threadTitle?: string | null
  messagePreview?: string | null
}

export function buildInternalChatNotificationUrl(threadId: string) {
  return `/dashboard?teamThreadId=${encodeURIComponent(threadId)}`
}

export async function notifyInternalChatParticipants(args: InternalChatNotificationArgs) {
  const recipients = Array.from(new Set(args.recipientUserIds.filter(Boolean))).filter((userId) => userId !== args.actorUserId)
  if (!recipients.length) return

  const threadLabel = args.threadTitle?.trim() ? ` en ${args.threadTitle.trim()}` : ''
  const preview = args.messagePreview?.trim()
  const body = preview
    ? `${args.senderLabel} escribió${threadLabel}: ${preview}`
    : `${args.senderLabel} envió un nuevo mensaje${threadLabel}.`

  await Promise.all(
    recipients.map((userId) => args.client.notification.create({
      data: {
        type: 'INFO',
        title: 'Nuevo mensaje interno',
        body,
        actionUrl: buildInternalChatNotificationUrl(args.threadId),
        actionLabel: 'Abrir chat',
        empresaId: args.empresaId,
        sedeId: args.sedeId ?? null,
        userId,
      },
    })),
  )
}