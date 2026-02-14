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

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: session.user.role,
    image: session.user.image ?? null,
  }

  return (
    <TourProvider>
      <PlanModuleGate />
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <Sidebar user={user} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header user={user} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </TourProvider>
  )
}
