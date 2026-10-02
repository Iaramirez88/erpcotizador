'use client'

import { useEffect, useState } from 'react'
import { Menu, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NotificationsBell from '@/components/dashboard/notifications-bell'
import Header from '@/components/dashboard/header'
import { useUiStore } from '@/lib/ui-store'
import { cn } from '@/lib/utils'

const CHAT_DRAWER_TOGGLE_EVENT = 'dashboard:toggle-conversations-drawer'
const CHAT_DRAWER_VISIBILITY_EVENT = 'dashboard:conversations-drawer-visibility'
const MOBILE_FOOTER_TOGGLE_EVENT = 'dashboard:mobile-footer-toggle'

type Props = {
  user: {
    name?: string | null
    role?: string
    image?: string | null
    isImpersonating?: boolean
    impersonatedByName?: string | null
    impersonatedByEmail?: string | null
    allowedModules?: string[] | null
    allowedNavHrefs?: string[] | null
    canManageBilling?: boolean
    canAccessWebsiteServices?: boolean
  }
  canAccessConversations: boolean
}

export default function MobileDashboardFooter({ user, canAccessConversations }: Props) {
  const toggleMobileNav = useUiStore((state) => state.toggleMobileNav)
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    function handleDrawerVisibility(event: Event) {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      setChatOpen(Boolean(detail?.open))
    }

    function handleMobileFooterToggle(event: Event) {
      const detail = (event as CustomEvent<{ source?: 'menu' | 'chat' | 'notifications' }>).detail
      if (detail?.source !== 'menu') {
        setMobileNavOpen(false)
      }
    }

    window.addEventListener(CHAT_DRAWER_VISIBILITY_EVENT, handleDrawerVisibility)
    window.addEventListener(MOBILE_FOOTER_TOGGLE_EVENT, handleMobileFooterToggle)
    return () => {
      window.removeEventListener(CHAT_DRAWER_VISIBILITY_EVENT, handleDrawerVisibility)
      window.removeEventListener(MOBILE_FOOTER_TOGGLE_EVENT, handleMobileFooterToggle)
    }
  }, [setMobileNavOpen])

  return (
    <div className={cn(
      'fixed inset-x-0 bottom-0 z-[85] border-t border-slate-200/80 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 backdrop-blur-xl transition-transform duration-300 md:hidden',
      'translate-y-0 opacity-100'
    )}>
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-4 items-center gap-0.5 px-0.5">
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-12 w-full max-w-[4.5rem] rounded-2xl text-slate-700 hover:bg-slate-100/80 [&_svg]:!size-5',
              mobileNavOpen && 'bg-[#ff9800] text-white hover:bg-[#ff9800]'
            )}
            aria-label="Abrir menú"
            onClick={() => {
              window.dispatchEvent(new CustomEvent(MOBILE_FOOTER_TOGGLE_EVENT, { detail: { source: 'menu' } }))
              toggleMobileNav()
            }}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-12 w-full max-w-[4.5rem] rounded-2xl text-slate-700 hover:bg-slate-100/80 disabled:opacity-45 [&_svg]:!size-5',
              chatOpen && 'bg-[#ff9800] text-white hover:bg-[#ff9800]'
            )}
            aria-label="Abrir conversaciones"
            disabled={!canAccessConversations}
            onClick={() => {
              window.dispatchEvent(new CustomEvent(MOBILE_FOOTER_TOGGLE_EVENT, { detail: { source: 'chat' } }))
              window.dispatchEvent(new CustomEvent(CHAT_DRAWER_TOGGLE_EVENT))
            }}
          >
            <MessageSquareText className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex justify-center">
          <NotificationsBell placement="mobile-footer" />
        </div>

        <div className="flex justify-center">
          <Header user={user} variant="mobile-footer-profile" />
        </div>
      </div>
    </div>
  )
}