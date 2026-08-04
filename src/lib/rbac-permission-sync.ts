export const PERMISSION_SYNC_QUERY_PARAM = 'permissionsUpdated=1'
export const PERMISSION_SYNC_ACTION_URL = `/dashboard?${PERMISSION_SYNC_QUERY_PARAM}`

type PermissionNotificationClient = {
  notification: {
    create: (args: {
      data: {
        userId: string
        type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
        title: string
        body: string | null
        sedeId: string | null
        empresaId: string
        actionUrl: string
        actionLabel: string
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

type PermissionAssignmentClient = {
  permissionProfileAssignment: {
    deleteMany: (args: {
      where: {
        empresaId: string
        sedeId: string
        userId: string
      }
    }) => Promise<{ count: number }>
  }
}

export async function publishPermissionUpdateNotification(args: {
  client: PermissionNotificationClient
  userId: string
  empresaId: string
  sedeId?: string | null
  title: string
  body: string
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  actionLabel?: string
}) {
  return args.client.notification.create({
    data: {
      userId: args.userId,
      type: args.type ?? 'INFO',
      title: args.title,
      body: args.body,
      sedeId: args.sedeId ?? null,
      empresaId: args.empresaId,
      actionUrl: PERMISSION_SYNC_ACTION_URL,
      actionLabel: args.actionLabel ?? 'Recargar permisos',
    },
  })
}

export async function detachPermissionProfileAssignment(args: {
  client: PermissionAssignmentClient
  empresaId: string
  sedeId: string
  userId: string
}) {
  return args.client.permissionProfileAssignment.deleteMany({
    where: {
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      userId: args.userId,
    },
  })
}

export function isPermissionSyncActionUrl(actionUrl: string | null | undefined) {
  return typeof actionUrl === 'string' && actionUrl.includes(PERMISSION_SYNC_QUERY_PARAM)
}