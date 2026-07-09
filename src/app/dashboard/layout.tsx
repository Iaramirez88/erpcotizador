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
import DashboardScopeGate from "@/components/dashboard/dashboard-scope-gate"
import OnboardingGate from "@/components/dashboard/onboarding-gate"
import RouteLoadingIndicator from "@/components/dashboard/route-loading-indicator"
import RouteLoadingStartListener from "@/components/dashboard/route-loading-start-listener"
import { getActiveSedeForUser, getEffectiveAccessMap, NAV_MODULES } from "@/lib/rbac"
import { resolveUserIdFromSession } from "@/lib/session-user"
import { prisma } from "@/lib/prisma"
import { isSuperAdminEmail } from "@/lib/super-admin"
import { isPlanOwnerForEmpresa } from "@/lib/plan-owner"
import { getWebsiteServicesAccessForUser } from "@/lib/website-services"
import DashboardDeferredWidgets from "@/components/dashboard/dashboard-deferred-widgets"
import { buildAllowedDashboardHrefsForUser, getAllowedModulesFromDashboardHrefs } from '@/lib/dashboard-access'

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
  let allowedNavHrefs: string[] | null = null
  let canManageBilling = false
  let canAccessWebsiteServices = false
  try {
    if (userId) {
      const [sede, layoutUser, websiteServicesAccess] = await Promise.all([
        getActiveSedeForUser(userId),
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, empresaId: true },
        }),
        getWebsiteServicesAccessForUser(userId),
      ])
      const access = await getEffectiveAccessMap({ userId, sedeId: sede.id, modules: NAV_MODULES })
      allowedModules = NAV_MODULES.filter((m) => (access[m] ?? 'NONE') !== 'NONE')
      allowedNavHrefs = await buildAllowedDashboardHrefsForUser({
        userId,
        empresaId: sede.empresaId,
        sedeId: sede.id,
      })
      allowedModules = Array.from(new Set([...allowedModules, ...getAllowedModulesFromDashboardHrefs(allowedNavHrefs)]))
      canAccessWebsiteServices = websiteServicesAccess.canAccess

      const isSystemSuperAdmin = isSuperAdminEmail(layoutUser?.email)
      const isPlanOwner = Boolean(
        layoutUser?.empresaId && layoutUser.id
          ? await isPlanOwnerForEmpresa({ empresaId: layoutUser.empresaId, userId: layoutUser.id })
          : false
      )
      canManageBilling = isSystemSuperAdmin || isPlanOwner
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
    allowedNavHrefs,
    canManageBilling,
    canAccessWebsiteServices,
  }

  return (
    <TourProvider>
      <PlanModuleGate />
      <DashboardScopeGate />
      <OnboardingGate />
      <RouteLoadingStartListener />
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <Sidebar user={user} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header user={user} />

          {/* Page Content */}
          <main className="erp-shell relative flex-1 overflow-y-auto bg-white p-1 pb-14 sm:p-2 sm:pb-14 lg:p-2.5 lg:pb-14">
            <div className="erp-shell__content mx-auto flex w-full max-w-[1600px] flex-col gap-2.5">
              <RouteLoadingIndicator />
              {children}
            </div>
          </main>
        </div>
      </div>
      <DashboardDeferredWidgets userId={userId} />
    </TourProvider>
  )
}
