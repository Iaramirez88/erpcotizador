import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser, hasWebsiteBuilderPagesForEmpresa } from '@/lib/website-services'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsiteServicesModuleTabs from '../../../website-services-module-tabs'
import WebsiteProjectSeoClient from './website-project-seo-client'

export const runtime = 'nodejs'

export default async function WebsiteProjectSeoPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')
  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) redirect('/dashboard')

  const { projectId } = await params
  const project = await prisma.websiteProject.findFirst({
    where: { id: projectId, empresaId: access.empresaId },
    select: { id: true, nombre: true, slug: true, subdomain: true, primaryDomain: true, trackingOnly: true, seoJson: true },
  })
  if (!project) notFound()

  const showBuilderTab = await hasWebsiteBuilderPagesForEmpresa(access.empresaId)
  const domain = project.primaryDomain || (project.subdomain ? `${project.subdomain}.sgdigitalordex.com` : `${project.slug}.sgdigitalordex.com`)
  const configuredSiteUrl = parseJsonObject(project.seoJson).siteUrl
  const defaultSiteUrl = typeof configuredSiteUrl === 'string' && configuredSiteUrl ? configuredSiteUrl : `https://${domain}`

  return <div className="space-y-4">
    <ErpPageHero
      breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' }, { label: 'SEO', href: '/dashboard/configuracion/servicios-web/seo' }, { label: project.nombre }]}
      title={`SEO · ${project.nombre}`}
      description="Conecta Search Console, define la URL pública y controla posiciones orgánicas por palabra clave."
    />
    <WebsiteServicesModuleTabs showBuilderTab={showBuilderTab} />
    <WebsiteProjectSeoClient projectId={project.id} defaultSiteUrl={defaultSiteUrl} />
  </div>
}
