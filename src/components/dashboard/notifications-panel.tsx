
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { subscribeToNotificationReceivedEvent } from '@/lib/notification-browser-events'
import { syncAppBadge } from '@/lib/app-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DEFAULT_NOTIFICATION_ACTION_LABEL } from '@/lib/notifications'

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  actionUrl: string | null
  actionLabel: string | null
  readAt: string | null
  createdAt: string
}

type Props = {
  onUnreadCountChange?: (count: number) => void
}

export default function NotificationsPanel({ onUnreadCountChange }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notificaciones?limit=15', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; items?: NotificationItem[]; unreadCount?: number }
        | null

      if (json?.ok) {
        setItems(Array.isArray(json.items) ? json.items : [])
        const nextUnread = typeof json.unreadCount === 'number' ? json.unreadCount : 0
        setUnreadCount(nextUnread)
        void syncAppBadge(nextUnread)
        onUnreadCountChange?.(nextUnread)
      }
    } finally {
      setLoading(false)
    }
  }, [onUnreadCountChange])

  async function markAllRead() {
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    await load()
  }

  useEffect(() => {
    void load()
    const unsubscribe = subscribeToNotificationReceivedEvent(() => {
      void load()
    })
    const id = setInterval(() => void load(), 60_000)
    return () => {
      unsubscribe()
      clearInterval(id)
    }
  }, [load])

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Notificaciones</div>
            <div className="text-xs text-muted-foreground">
              {unreadCount} sin leer
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void markAllRead()} disabled={!unreadCount}>
            Marcar todo
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((n) => (
              <Card key={n.id} className={n.readAt ? '' : 'border-blue-200'}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{n.title}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 text-xs text-muted-foreground">
                  <div className="space-y-3">
                    <div>{n.body || '—'}</div>
                    {n.actionUrl ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/notificaciones/open/${n.id}`}>{n.actionLabel || DEFAULT_NOTIFICATION_ACTION_LABEL}</Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Sin notificaciones.</div>
        )}
      </div>
    </div>
  )
}
