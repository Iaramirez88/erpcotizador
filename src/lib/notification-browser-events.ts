import type { RealtimeNotificationPayload } from '@/lib/notification-realtime'

export const NOTIFICATION_RECEIVED_EVENT = 'sgdigital:notification-received'

type NotificationReceivedDetail = {
  notification: RealtimeNotificationPayload
}

export function dispatchNotificationReceivedEvent(notification: RealtimeNotificationPayload) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent<NotificationReceivedDetail>(NOTIFICATION_RECEIVED_EVENT, {
    detail: { notification },
  }))
}

export function subscribeToNotificationReceivedEvent(handler: (notification: RealtimeNotificationPayload) => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<NotificationReceivedDetail>
    if (!customEvent.detail?.notification) return
    handler(customEvent.detail.notification)
  }

  window.addEventListener(NOTIFICATION_RECEIVED_EVENT, listener)
  return () => window.removeEventListener(NOTIFICATION_RECEIVED_EVENT, listener)
}