import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsiteServicesClient from './website-services-client'
import WebsiteServicesModuleTabs from './website-services-module-tabs'

export const runtime = 'nodejs'

export default async function WebsiteServicesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Sitios web' },
        ]}
        title="Sitios web"
        description="Gestiona servicios vendidos, renovaciones, accesos y seguimiento operativo de sitios y componentes web desde una sola vista."
      />

      <WebsiteServicesModuleTabs />
      <WebsiteServicesClient />
    </div>
  )
}