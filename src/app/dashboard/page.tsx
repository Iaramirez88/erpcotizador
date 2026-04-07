import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import type { ModuleKey } from '@prisma/client'
import { auth } from '@/lib/auth'
import ContinueLastViewButton from '@/components/dashboard/continue-last-view-button'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import StartCardsGrid from '@/components/dashboard/start-cards-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getActiveSedeForUser, getEffectiveAccessMap, NAV_MODULES } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getEnabledModulesForEmpresa, ALL_MODULE_KEYS } from '@/lib/plan-modules'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import { isPlanOwnerForEmpresa } from '@/lib/plan-owner'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    redirect('/auth/login')
  }

  let allowedModules: ModuleKey[] | null = null
  let enabledPlanModules: ModuleKey[] | null = null
  let canManageBilling = session.user.role === 'ADMIN'
  let activeSedeName: string | null = null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { empresaId: true, email: true },
  })

  try {
    const sede = await getActiveSedeForUser(userId)
    activeSedeName = sede.nombre
    const access = await getEffectiveAccessMap({ userId, sedeId: sede.id, modules: NAV_MODULES })
    allowedModules = NAV_MODULES.filter((moduleKey) => (access[moduleKey] ?? 'NONE') !== 'NONE') as ModuleKey[]
  } catch {
    allowedModules = null
  }

  try {
    if (session.user.role === 'ADMIN') {
      enabledPlanModules = ALL_MODULE_KEYS
      canManageBilling = true
    } else if (user?.empresaId) {
      const empresa = await prisma.empresa.findUnique({
        where: { id: user.empresaId },
        select: {
          nit: true,
          registrationCodeHash: true,
          planTier: true,
          planValidUntil: true,
          trialTier: true,
          trialStartedAt: true,
          trialValidUntil: true,
        },
      })

      if (empresa) {
        const effectiveTier = resolveEffectivePlanTier(empresa, new Date())
        enabledPlanModules = await getEnabledModulesForEmpresa({ empresaId: user.empresaId, planTier: effectiveTier })
      }

      canManageBilling = isSuperAdminEmail(user?.email) || await isPlanOwnerForEmpresa({ empresaId: user.empresaId, userId })
    }
  } catch {
    enabledPlanModules = null
  }

  const displayName = session.user.name || session.user.email || 'equipo'
  const continueHref = '/dashboard/reportes'

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard' }]}
        title={`Hola, ${displayName}`}
        description={activeSedeName
          ? `El dashboard ahora es una pantalla de inicio. Elige qué quieres gestionar primero en ${activeSedeName} y entra directo al flujo correcto.`
          : 'El dashboard ahora funciona como pantalla de inicio. Elige qué quieres gestionar primero y entra directo al flujo correcto.'}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
              <Link href="/dashboard/reportes">
                <BarChart3 className="mr-2 h-4 w-4" />
                Ir a reportes
              </Link>
            </Button>
            <ContinueLastViewButton userId={userId} fallbackHref={continueHref} />
          </>
        }
      />

      <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardTitle className="text-2xl text-slate-950">¿Qué quieres hacer hoy?</CardTitle>
          <CardDescription>Escoge un frente de trabajo y entra directo a la gestión que necesitas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <StartCardsGrid
            allowedModules={allowedModules}
            enabledPlanModules={enabledPlanModules}
            canManageBilling={canManageBilling}
          />
        </CardContent>
      </Card>
    </div>
  )
}
