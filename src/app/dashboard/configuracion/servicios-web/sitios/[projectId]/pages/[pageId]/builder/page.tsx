import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsiteServicesModuleTabs from '../../../../../website-services-module-tabs'
import WebsitePageBuilderClient from './website-page-builder-client'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { normalizeWebsiteBuilderData, serializeWebsiteProjectVersion } from '@/lib/website-builder'

export const runtime = 'nodejs'

export default async function WebsiteProjectPageBuilderRoute(
  props: { params: Promise<{ projectId: string; pageId: string }> }
) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) {
    redirect('/dashboard')
  }

  const { projectId, pageId } = await props.params
  const page = await prisma.websiteProjectPage.findFirst({
    where: {
      id: pageId,
      websiteProjectId: projectId,
      websiteProject: {
        empresaId: access.empresaId,
      },
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      draftData: true,
      status: true,
      websiteProject: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          subdomain: true,
        },
      },
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 6,
        select: {
          id: true,
          versionNumber: true,
          editorJson: true,
          isPublished: true,
          createdAt: true,
        },
      },
    },
  })

  if (!page?.id) {
    notFound()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Sitios', href: '/dashboard/configuracion/servicios-web/sitios' },
          { label: page.websiteProject.nombre },
          { label: page.nombre },
          { label: 'Builder visual' },
        ]}
        title={`Builder · ${page.nombre}`}
        description={`Edita ${page.slug} dentro del sitio ${page.websiteProject.nombre} con bloques controlados de Puck.`}
      />

      <WebsiteServicesModuleTabs />

      <WebsitePageBuilderClient
        projectId={page.websiteProject.id}
        pageId={page.id}
        projectName={page.websiteProject.nombre}
        pageName={page.nombre}
        projectSubdomain={page.websiteProject.subdomain || page.websiteProject.slug}
        pageSlug={page.slug}
        isHome={page.slug === 'inicio'}
        initialData={normalizeWebsiteBuilderData(page.draftData)}
        versions={page.versions.map(serializeWebsiteProjectVersion)}
      />
    </div>
  )
}