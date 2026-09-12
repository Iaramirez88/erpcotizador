import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser, hasWebsiteBuilderPagesForEmpresa } from '@/lib/website-services'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'
import WebsiteProjectsClient from './website-projects-client'

export const runtime = 'nodejs'

export default async function WebsiteBuilderSitesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess) {
    redirect('/dashboard')
  }
  const showBuilderTab = access.empresaId ? await hasWebsiteBuilderPagesForEmpresa(access.empresaId) : false

  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Sitios' },
        ]}
        title="Sitios web"
        description="Base operativa para crear, organizar, versionar y publicar sitios desde Ordex."
      />

      <WebsiteServicesModuleTabs showBuilderTab={showBuilderTab} />

      <WebsiteProjectsClient />
    </div>
  )
}