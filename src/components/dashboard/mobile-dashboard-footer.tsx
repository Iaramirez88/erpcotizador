'use client'

import { Menu, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Header from '@/components/dashboard/header'
import { useUiStore } from '@/lib/ui-store'

const CHAT_DRAWER_TOGGLE_EVENT = 'dashboard:toggle-conversations-drawer'

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-[85] border-t border-slate-200/80 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-2 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.98))] px-2.5 py-2 shadow-[0_22px_45px_-28px_rgba(15,23,42,0.4)]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-2xl text-slate-700 hover:bg-slate-100"
          aria-label="Abrir menú"
          onClick={toggleMobileNav}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-2xl text-slate-700 hover:bg-slate-100 disabled:opacity-45"
          aria-label="Abrir conversaciones"
          disabled={!canAccessConversations}
          onClick={() => window.dispatchEvent(new CustomEvent(CHAT_DRAWER_TOGGLE_EVENT))}
        >
          <MessageSquareText className="h-5 w-5" />
        </Button>

        <Header user={user} variant="mobile-footer" />
      </div>
    </div>
  )
}