'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToNotificationReceivedEvent } from '@/lib/notification-browser-events'
import { syncAppBadge } from '@/lib/app-badge'
import { Button } from '@/components/ui/button'
import NotificationsPanel from '@/components/dashboard/notifications-panel'
import { useTheme } from '@/components/providers/theme-provider'

type Props = {
  onUnreadCountChange?: (count: number) => void
  placement?: 'header' | 'sidebar-footer' | 'mobile-footer'
}

export default function NotificationsBell({ onUnreadCountChange, placement = 'header' }: Props) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { resolvedTheme } = useTheme()

  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const isDark = resolvedTheme === 'dark'
  const showLabel = placement === 'header' || placement === 'mobile-footer' || placement === 'sidebar-footer'
  const buttonClassName = placement === 'mobile-footer'
    ? isDark
      ? 'relative flex h-14 min-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[#e0e0e0] hover:bg-[#232323]'
      : 'relative flex h-14 min-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-slate-700 hover:bg-slate-100/80'
    : placement === 'header'
      ? isDark
        ? 'relative h-9 rounded-full px-3 text-[#e0e0e0] hover:bg-[#232323]'
        : 'relative h-9 rounded-full px-3 text-slate-700 hover:bg-slate-100/80'
      : isDark
        ? 'relative flex h-10 w-full items-center justify-start gap-2 rounded-xl px-3 text-[#e0e0e0] hover:bg-[#232323]'
        : 'relative flex h-10 w-full items-center justify-start gap-2 rounded-xl px-3 text-slate-700 hover:bg-slate-100/80'
  const panelClassName = placement === 'sidebar-footer'
    ? isDark
      ? 'absolute bottom-0 left-full z-50 ml-4 h-[70vh] w-[360px] max-w-[calc(100vw-6rem)] overflow-hidden rounded-[28px] border border-[#444444] bg-[#181818] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.52)]'
      : 'absolute bottom-0 left-full z-50 ml-4 h-[70vh] w-[360px] max-w-[calc(100vw-6rem)] overflow-hidden rounded-[28px] border bg-background shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]'
    : placement === 'mobile-footer'
      ? isDark
        ? 'fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.8rem)] z-[95] h-[min(70vh,32rem)] overflow-hidden rounded-[28px] border border-[#444444] bg-[#181818] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.52)]'
        : 'fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.8rem)] z-[95] h-[min(70vh,32rem)] overflow-hidden rounded-[28px] border bg-background shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]'
      : isDark
        ? 'fixed right-4 top-[72px] z-50 h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden border border-[#444444] bg-[#181818] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.52)]'
        : 'fixed right-4 top-[72px] z-50 h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden border bg-background'

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
      void syncAppBadge(next)

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
        variant="ghost"
        size="icon"
        className={buttonClassName}
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
      >
        <svg className={placement === 'mobile-footer' ? 'h-6 w-6' : 'h-5 w-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {showLabel ? (
          <span className={placement === 'mobile-footer' ? 'text-[11px] font-medium leading-none' : 'text-sm font-medium'}>
            Notificaciones
          </span>
        ) : null}

        {badgeText ? (
          <span className={placement === 'mobile-footer'
            ? 'absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white'
            : placement === 'sidebar-footer'
              ? 'absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white'
              : 'absolute -top-2 -right-2 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white'}>
            {badgeText}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          ref={panelRef}
          className={panelClassName}
        >
          <NotificationsPanel onUnreadCountChange={setUnreadCount} />
        </div>
      ) : null}
    </div>
  )
}
