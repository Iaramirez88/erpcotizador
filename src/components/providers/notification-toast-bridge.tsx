"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from 'next/navigation'
import { dispatchNotificationReceivedEvent } from '@/lib/notification-browser-events';
import type { RealtimeNotificationPayload } from '@/lib/notification-realtime';
import { isPermissionSyncActionUrl } from '@/lib/rbac-permission-sync'
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";

function mapVariant(type: RealtimeNotificationPayload["type"]) {
  return type === "ERROR" ? "destructive" as const : "default" as const;
}

function resolveNotificationHref(payload: RealtimeNotificationPayload) {
  if (payload.id) return `/dashboard/notificaciones/open/${payload.id}`
  return payload.actionUrl || '/dashboard/notificaciones'
}

export function NotificationToastBridge() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return
    if (window.location.pathname.startsWith('/chatbot/')) return

    const stream = new window.EventSource('/api/notificaciones/stream')

    const handleNotification = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as RealtimeNotificationPayload

      if (isPermissionSyncActionUrl(payload.actionUrl)) {
        router.refresh()
        window.location.reload()
        return
      }

      dispatchNotificationReceivedEvent(payload)
      toast({
        title: payload.title,
        description: payload.body || 'Nueva notificación del sistema.',
        variant: mapVariant(payload.type),
        action: payload.actionUrl ? (
          <ToastAction altText={payload.actionLabel || 'Abrir notificación'} asChild>
            <Link href={resolveNotificationHref(payload)}>{payload.actionLabel || 'Abrir'}</Link>
          </ToastAction>
        ) : undefined,
      })
    }

    stream.addEventListener('notification', handleNotification as EventListener)

    return () => {
      stream.removeEventListener('notification', handleNotification as EventListener)
      stream.close()
    }
  }, [router])

  return null
}