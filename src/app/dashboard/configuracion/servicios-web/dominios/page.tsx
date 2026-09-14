import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser, hasWebsiteBuilderPagesForEmpresa } from '@/lib/website-services'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'
import WebsiteDomainsClient from './website-domains-client'

export const runtime = 'nodejs'

export default async function WebsiteDomainsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) redirect('/dashboard')

  const showBuilderTab = await hasWebsiteBuilderPagesForEmpresa(access.empresaId)

  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Dominios' },
        ]}
        title="Dominios"
        description="Administra la dirección pública de cada sitio y prepara la conexión de dominios propios."
      />

      <WebsiteServicesModuleTabs showBuilderTab={showBuilderTab} />
      <WebsiteDomainsClient />
    </div>
  )
}
