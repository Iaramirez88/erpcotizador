import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsitePageRender from '@/components/website-builder/website-page-render'
import WebsiteServicesModuleTabs from '../../../../../website-services-module-tabs'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'

export const runtime = 'nodejs'

export default async function WebsiteProjectPagePreviewRoute(
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
      websiteProject: { empresaId: access.empresaId },
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      draftData: true,
      websiteProject: {
        select: {
          nombre: true,
          subdomain: true,
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
          { label: 'Preview' },
        ]}
        title={`Preview · ${page.nombre}`}
        description={`Vista protegida del borrador actual para ${page.websiteProject.subdomain || 'sitio'} antes de publicar.`}
      />

      <WebsiteServicesModuleTabs />

      <WebsitePageRender data={page.draftData} />
    </div>
  )
}