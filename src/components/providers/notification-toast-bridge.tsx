"use client";

import Link from "next/link";
import { useEffect } from "react";
import { dispatchNotificationReceivedEvent } from '@/lib/notification-browser-events';
import type { RealtimeNotificationPayload } from '@/lib/notification-realtime';
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";

function mapVariant(type: RealtimeNotificationPayload["type"]) {
  return type === "ERROR" ? "destructive" as const : "default" as const;
}

export function NotificationToastBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return

    const stream = new window.EventSource('/api/notificaciones/stream')

    const handleNotification = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as RealtimeNotificationPayload
      dispatchNotificationReceivedEvent(payload)
      toast({
        title: payload.title,
        description: payload.body || 'Nueva notificación del sistema.',
        variant: mapVariant(payload.type),
        action: payload.actionUrl ? (
          <ToastAction altText={payload.actionLabel || 'Abrir notificación'} asChild>
            <Link href={`/dashboard/notificaciones/open/${payload.id}`}>{payload.actionLabel || 'Abrir'}</Link>
          </ToastAction>
        ) : undefined,
      })
    }

    stream.addEventListener('notification', handleNotification as EventListener)

    return () => {
      stream.removeEventListener('notification', handleNotification as EventListener)
      stream.close()
    }
  }, [])

  return null
}