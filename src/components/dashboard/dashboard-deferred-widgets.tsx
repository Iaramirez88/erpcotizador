'use client'

import dynamic from 'next/dynamic'

const PlanPaywallModal = dynamic(() => import('@/components/dashboard/plan-paywall-modal'), { ssr: false })
const PlanLimitFetchInterceptor = dynamic(() => import('@/components/dashboard/plan-limit-fetch-interceptor'), { ssr: false })
const PlanLimitModal = dynamic(() => import('@/components/dashboard/plan-limit-modal'), { ssr: false })
const LastDashboardRouteTracker = dynamic(() => import('@/components/dashboard/last-dashboard-route-tracker'), { ssr: false })
const FloatingChatDrawer = dynamic(() => import('@/components/dashboard/floating-chat-drawer'), { ssr: false })

export default function DashboardDeferredWidgets({
  userId,
  canAccessTeamChat,
  canAccessCrmChat,
}: {
  userId: string | null
  canAccessTeamChat: boolean
  canAccessCrmChat: boolean
}) {
  return (
    <>
      <PlanPaywallModal />
      <PlanLimitFetchInterceptor />
      <PlanLimitModal />
      {userId ? <LastDashboardRouteTracker userId={userId} /> : null}
      <FloatingChatDrawer canAccessTeamChat={canAccessTeamChat} canAccessCrmChat={canAccessCrmChat} />
    </>
  )
}