'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToNotificationReceivedEvent } from '@/lib/notification-browser-events'
import { Button } from '@/components/ui/button'
import NotificationsPanel from '@/components/dashboard/notifications-panel'

type Props = {
  onUnreadCountChange?: (count: number) => void
}

export default function NotificationsBell({ onUnreadCountChange }: Props) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const badgeText = useMemo(() => {
    if (unreadCount <= 0) return null
    return unreadCount > 99 ? '99+' : String(unreadCount)
  }, [unreadCount])

  async function loadUnread() {
    try {
      const res = await fetch('/api/notificaciones?unread=true&limit=1', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { unreadCount?: number } | null
      const next = typeof json?.unreadCount === 'number' ? json.unreadCount : 0

      setUnreadCount(next)

      onUnreadCountChange?.(next)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadUnread()
    const unsubscribe = subscribeToNotificationReceivedEvent(() => {
      void loadUnread()
    })
    const id = window.setInterval(() => void loadUnread(), 60_000)
    return () => {
      unsubscribe()
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node | null
      if (!target) return

      if (panelRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return

      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open])

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="icon"
        className="relative"
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {badgeText ? (
          <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
            {badgeText}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          ref={panelRef}
          className="fixed right-4 top-[72px] z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[70vh] border bg-background overflow-hidden"
        >
          <NotificationsPanel onUnreadCountChange={setUnreadCount} />
        </div>
      ) : null}
    </div>
  )
}
