import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import OnboardingWizardClient from './onboarding-wizard-client'
import { getBusinessTypeLabel, parseCompanyOnboardingData, resolveDashboardConfig } from '@/lib/company-onboarding'

export default async function DashboardOnboardingPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { empresaId: true },
  })

  if (!user?.empresaId) redirect('/dashboard')

  const empresa = await prisma.empresa.findUnique({
    where: { id: user.empresaId },
    select: {
      businessType: true,
      onboardingStatus: true,
      onboardingCompletedAt: true,
      onboardingData: true,
      dashboardConfig: true,
      planOwnerUserId: true,
    },
  })

  if (!empresa) redirect('/dashboard')

  if (empresa.planOwnerUserId && empresa.planOwnerUserId !== userId) {
    redirect('/dashboard')
  }

  const locked = Boolean(empresa.onboardingCompletedAt)
  const dashboard = resolveDashboardConfig({
    dashboardConfig: empresa.dashboardConfig,
    onboardingData: empresa.onboardingData,
    businessType: empresa.businessType,
  })

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Onboarding inicial' }]}
        title="Arma tu espacio en minutos"
        description={locked
          ? 'La configuración inicial ya quedó cerrada para proteger el nicho y los módulos del espacio.'
          : 'Este primer preset enciende módulos base y reorganiza el inicio según el tipo de operación que necesitas manejar.'}
      />
      {locked ? (
        <Card>
          <CardHeader>
            <CardTitle>{empresa.businessType ? `${getBusinessTypeLabel(empresa.businessType as Parameters<typeof getBusinessTypeLabel>[0])} ya configurado` : 'Configuración inicial cerrada'}</CardTitle>
            <CardDescription>
              Este espacio ya tiene un nicho definido. Para solicitar un cambio de configuración inicial o cambio de nicho, usa la pestaña Soporte del chat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {dashboard?.headline ?? 'El dashboard ya quedó ajustado según la configuración inicial guardada.'}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Correo soporte</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">ivanimage@hotmail.com</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">WhatsApp soporte</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">3115385427</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href="mailto:ivanimage@hotmail.com?subject=Solicitud%20de%20cambio%20de%20configuraci%C3%B3n%20inicial">Escribir por correo</a>
              </Button>
              <Button asChild>
                <a href="https://wa.me/573115385427" target="_blank" rel="noreferrer">Abrir WhatsApp</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <OnboardingWizardClient
          initialData={parseCompanyOnboardingData(empresa.onboardingData)}
          mode="page"
        />
      )}
    </div>
  )
}