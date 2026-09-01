import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'
import WebsiteServiceTemplatesClient from './website-service-templates-client'

export const runtime = 'nodejs'

export default async function WebsiteServiceTemplatesPage() {
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
          { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Plantillas automáticas' },
        ]}
        title="Plantillas automáticas"
        description="Configura mensajes base para renovaciones, avisos y seguimiento automatizado de sitios web y servicios asociados."
      />

      <WebsiteServicesModuleTabs />
      <WebsiteServiceTemplatesClient />
    </div>
  )
}