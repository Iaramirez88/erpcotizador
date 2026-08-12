'use client'

import dynamic from 'next/dynamic'

const PlanPaywallModal = dynamic(() => import('@/components/dashboard/plan-paywall-modal'), { ssr: false })
const PlanLimitFetchInterceptor = dynamic(() => import('@/components/dashboard/plan-limit-fetch-interceptor'), { ssr: false })
const PlanLimitModal = dynamic(() => import('@/components/dashboard/plan-limit-modal'), { ssr: false })
const LastDashboardRouteTracker = dynamic(() => import('@/components/dashboard/last-dashboard-route-tracker'), { ssr: false })
const FloatingChatDrawer = dynamic(() => import('@/components/dashboard/floating-chat-drawer'), { ssr: false })
const MobileDashboardFooter = dynamic(() => import('@/components/dashboard/mobile-dashboard-footer'), { ssr: false })

export default function DashboardDeferredWidgets({
  userId,
  user,
  canAccessTeamChat,
  canAccessCrmChat,
}: {
  userId: string | null
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
  canAccessTeamChat: boolean
  canAccessCrmChat: boolean
}) {
  return (
    <>
      <PlanPaywallModal />
      <PlanLimitFetchInterceptor />
      <PlanLimitModal />
      {userId ? <LastDashboardRouteTracker userId={userId} /> : null}
      <MobileDashboardFooter user={user} canAccessConversations={canAccessTeamChat || canAccessCrmChat} />
      <FloatingChatDrawer canAccessTeamChat={canAccessTeamChat} canAccessCrmChat={canAccessCrmChat} />
    </>
  )
}