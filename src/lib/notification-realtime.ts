import { EventEmitter } from 'node:events'

export type RealtimeNotificationPayload = {
  id: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | string
  title: string
  body: string | null
  actionUrl: string | null
  actionLabel: string | null
  readAt: string | null
  createdAt: string
  userId: string
}

type NotificationRealtimeState = {
  emitter: EventEmitter
}

const REALTIME_KEY = '__sgd_notification_realtime__'

function getRealtimeState() {
  const globalState = globalThis as typeof globalThis & {
    [REALTIME_KEY]?: NotificationRealtimeState
  }

  if (!globalState[REALTIME_KEY]) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)
    globalState[REALTIME_KEY] = { emitter }
  }

  return globalState[REALTIME_KEY]!
}

function getUserChannel(userId: string) {
  return `user:${userId}`
}

export function publishRealtimeNotification(payload: RealtimeNotificationPayload) {
  getRealtimeState().emitter.emit(getUserChannel(payload.userId), payload)
}

export function subscribeToRealtimeNotifications(userId: string, listener: (payload: RealtimeNotificationPayload) => void) {
  const channel = getUserChannel(userId)
  const emitter = getRealtimeState().emitter
  emitter.on(channel, listener)

  return () => {
    emitter.off(channel, listener)
  }
}