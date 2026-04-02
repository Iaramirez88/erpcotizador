/**
 * Layout del Dashboard
 * 
 * Incluye sidebar, navegación y estructura general
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Sidebar from "@/components/dashboard/sidebar"
import Header from "@/components/dashboard/header"
import { TourProvider } from "@/components/tour/tour-provider"
import PlanModuleGate from "@/components/dashboard/plan-module-gate"
import PlanPaywallModal from "@/components/dashboard/plan-paywall-modal"
import PlanLimitFetchInterceptor from "@/components/dashboard/plan-limit-fetch-interceptor"
import PlanLimitModal from "@/components/dashboard/plan-limit-modal"
import RouteLoadingIndicator from "@/components/dashboard/route-loading-indicator"
import RouteLoadingStartListener from "@/components/dashboard/route-loading-start-listener"
import LastDashboardRouteTracker from "@/components/dashboard/last-dashboard-route-tracker"
import FloatingChatDrawer from "@/components/dashboard/floating-chat-drawer"
import { getActiveSedeForUser, getEffectiveAccessMap, NAV_MODULES } from "@/lib/rbac"
import { resolveUserIdFromSession } from "@/lib/session-user"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Proteger todas las rutas del dashboard
  const session = await auth()
  
  if (!session || !session.user) {
    redirect("/auth/login")
  }

  const userId = await resolveUserIdFromSession(session)
  let allowedModules: string[] | null = null
  try {
    if (userId) {
      const sede = await getActiveSedeForUser(userId)
      const access = await getEffectiveAccessMap({ userId, sedeId: sede.id, modules: NAV_MODULES })
      allowedModules = NAV_MODULES.filter((m) => (access[m] ?? 'NONE') !== 'NONE')
    }
  } catch {
    allowedModules = null
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: session.user.role,
    image: session.user.image ?? null,
    allowedModules,
  }

  return (
    <TourProvider>
      <PlanModuleGate />
      <PlanPaywallModal />
      <PlanLimitFetchInterceptor />
      <PlanLimitModal />
      <RouteLoadingStartListener />
      {userId ? <LastDashboardRouteTracker userId={userId} /> : null}
      <div className="flex h-screen bg-[#eef3ef]">
        {/* Sidebar */}
        <Sidebar user={user} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header user={user} />

          {/* Page Content */}
          <main className="erp-shell relative flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(22,163,74,0.12),_transparent_28%)]" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-28 h-64 bg-[linear-gradient(180deg,_rgba(255,255,255,0.32),_rgba(255,255,255,0))]" />
            <div className="erp-shell__content mx-auto flex w-full max-w-[1680px] flex-col gap-4">
              <RouteLoadingIndicator />
              {children}
            </div>
            <FloatingChatDrawer />
          </main>
        </div>
      </div>
    </TourProvider>
  )
}
