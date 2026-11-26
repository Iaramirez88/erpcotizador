import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsiteServicesModuleTabs from '../../../website-services-module-tabs'
import WebsiteSiteSettingsClient from './website-site-settings-client'
import { getWebsiteServicesAccessForUser, hasWebsiteBuilderPagesForEmpresa } from '@/lib/website-services'
import { normalizeWebsiteSiteSettings } from '@/lib/website-site-settings'
import { accessibleWebsiteProjectWhere } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

export default async function WebsiteProjectSettingsRoute(props: { params: Promise<{ projectId: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) redirect('/dashboard')
  const showBuilderTab = await hasWebsiteBuilderPagesForEmpresa(access.empresaId)

  const { projectId } = await props.params
  const project = await prisma.websiteProject.findFirst({
    where: { id: projectId, ...accessibleWebsiteProjectWhere(access) },
    select: { id: true, nombre: true, themeJson: true },
  })

  if (!project?.id) notFound()

  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Sitios', href: '/dashboard/configuracion/servicios-web/sitios' },
          { label: project.nombre },
          { label: 'Ajustes del sitio' },
        ]}
        title={`Ajustes · ${project.nombre}`}
        description="Tema global, header y footer compartidos, CSS y scripts personalizados del sitio."
      />

      <WebsiteServicesModuleTabs showBuilderTab={showBuilderTab} />

      <WebsiteSiteSettingsClient
        projectId={project.id}
        projectName={project.nombre}
        initialSettings={normalizeWebsiteSiteSettings(project.themeJson)}
        isSuperAdmin={access.isSuperAdmin}
      />
    </div>
  )
}
