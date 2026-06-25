import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import type { ModuleKey } from '@prisma/client'
import { auth } from '@/lib/auth'
import ContinueLastViewButton from '@/components/dashboard/continue-last-view-button'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import StartCardsGrid from '@/components/dashboard/start-cards-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardInfoHeader } from '@/components/ui/card-info-header'
import { InfoHint } from '@/components/ui/info-hint'
import { getActiveSedeForUser, getEffectiveAccessMap, NAV_MODULES } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getEnabledModulesForEmpresa, ALL_MODULE_KEYS } from '@/lib/plan-modules'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import { isPlanOwnerForEmpresa } from '@/lib/plan-owner'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { getCrmStorageUsageSummary } from '@/lib/crm-files'
import { resolveDashboardConfig } from '@/lib/company-onboarding'
import { redirect } from 'next/navigation'

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / 1024 ** exponent
  return `${size >= 100 || exponent === 0 ? Math.round(size) : size.toFixed(1)} ${units[exponent]}`
}

function getStorageLevel(percentage: number) {
  if (percentage >= 95) return 'critical'
  if (percentage >= 80) return 'warning'
  return 'normal'
}

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
  let storageUsage: Awaited<ReturnType<typeof getCrmStorageUsageSummary>> | null = null
  let dashboardConfig: ReturnType<typeof resolveDashboardConfig> = null

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
          businessType: true,
          onboardingStatus: true,
          onboardingData: true,
          dashboardConfig: true,
          planOwnerUserId: true,
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
        dashboardConfig = resolveDashboardConfig({
          dashboardConfig: empresa.dashboardConfig,
          onboardingData: empresa.onboardingData,
          businessType: empresa.businessType,
        })
      }

      storageUsage = await getCrmStorageUsageSummary({ empresaId: user.empresaId })
      canManageBilling = isSuperAdminEmail(user?.email) || await isPlanOwnerForEmpresa({ empresaId: user.empresaId, userId })
    }
  } catch {
    enabledPlanModules = null
  }

  const displayName = session.user.name || session.user.email || 'equipo'
  const continueHref = '/dashboard/reportes'
  const storagePct = storageUsage?.totalBytes ? Math.min(100, Math.round((storageUsage.usedBytes / storageUsage.totalBytes) * 100)) : 0
  const storageLevel = getStorageLevel(storagePct)

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard' }]}
        title={`Hola, ${displayName}`}
        description={dashboardConfig?.description
          ?? (activeSedeName
            ? `El dashboard ahora es una pantalla de inicio. Elige qué quieres gestionar primero en ${activeSedeName} y entra directo al flujo correcto.`
            : 'El dashboard ahora funciona como pantalla de inicio. Elige qué quieres gestionar primero y entra directo al flujo correcto.')}
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

      {storageUsage ? (
        <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardInfoHeader
              title={<CardTitle className="text-2xl text-slate-950">Almacenamiento de la empresa</CardTitle>}
              description={storageLevel === 'critical'
                ? 'El espacio está cerca del límite. Conviene liberar archivos o ampliar el plan.'
                : storageLevel === 'warning'
                  ? 'El consumo ya entró en zona de atención.'
                  : 'El consumo actual sigue en una zona saludable.'}
              tone="data"
              actions={
                <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
                  <Link href="/dashboard/configuracion/plan?tab=almacenamiento">Ver almacenamiento</Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="grid gap-4 p-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className={storageLevel === 'critical' ? 'rounded-2xl border border-rose-200 bg-rose-50/70 p-4' : storageLevel === 'warning' ? 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4' : 'rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4'}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-900">Uso actual</span>
                <span className="rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700">{storagePct}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/80">
                <div className={storageLevel === 'critical' ? 'h-full rounded-full bg-rose-600' : storageLevel === 'warning' ? 'h-full rounded-full bg-amber-500' : 'h-full rounded-full bg-emerald-600'} style={{ width: `${storagePct}%` }} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Usado</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{formatBytes(storageUsage.usedBytes)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Disponible</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{formatBytes(storageUsage.freeBytes)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Capacidad total</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{formatBytes(storageUsage.totalBytes)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Actividad reciente</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>{storageUsage.filesCount} archivos registrados</div>
                <div>{storageUsage.foldersCount} carpetas registradas</div>
                <div>
                  Última carga:{' '}
                  <span className="font-medium text-slate-900">
                    {storageUsage.lastUploadedAt
                      ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(storageUsage.lastUploadedAt))
                      : 'Sin cargas aún'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardInfoHeader
            title={<CardTitle className="text-2xl text-slate-950">¿Qué quieres hacer hoy?</CardTitle>}
            description="Escoge un frente de trabajo y entra directo a la gestión que necesitas."
            tone="action"
          />
        </CardHeader>
        <CardContent className="p-0">
          <StartCardsGrid
            allowedModules={allowedModules}
            enabledPlanModules={enabledPlanModules}
            canManageBilling={canManageBilling}
            prioritizedHrefs={dashboardConfig?.prioritizedHrefs ?? []}
            visibleHrefs={dashboardConfig?.allowedHrefs ?? []}
          />
        </CardContent>
      </Card>
    </div>
  )
}
