import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser, hasWebsiteBuilderPagesForEmpresa } from '@/lib/website-services'
import { getGoogleMarketingProductScope } from '@/lib/crm-google-marketing'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'
import WebsiteSeoOverviewClient from './website-seo-overview-client'

export const runtime = 'nodejs'

export default async function WebsiteSeoOverviewPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')
  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) redirect('/dashboard')

  const [projects, connection, showBuilderTab] = await Promise.all([
    prisma.websiteProject.findMany({
      where: { empresaId: access.empresaId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        subdomain: true,
        primaryDomain: true,
        status: true,
        seoJson: true,
        seoKeywords: { select: { latestSerpPosition: true, latestSearchConsolePosition: true } },
      },
    }),
    prisma.crmMarketingConnection.findFirst({ where: { empresaId: access.empresaId }, orderBy: { updatedAt: 'desc' }, select: { scopes: true } }),
    hasWebsiteBuilderPagesForEmpresa(access.empresaId),
  ])

  const sites = projects.map((project) => {
    const seo = parseJsonObject(project.seoJson)
    const host = project.primaryDomain || (project.subdomain ? `${project.subdomain}.sgdigitalordex.com` : `${project.slug}.sgdigitalordex.com`)
    const defaultUrl = /^https?:\/\//i.test(host) ? host : `https://${host}`
    return {
      id: project.id,
      nombre: project.nombre,
      status: project.status,
      defaultUrl,
      siteUrl: typeof seo.siteUrl === 'string' ? seo.siteUrl : '',
      searchConsoleSiteUrl: typeof seo.searchConsoleSiteUrl === 'string' ? seo.searchConsoleSiteUrl : '',
      keywordCount: project.seoKeywords.length,
      rankedKeywordCount: project.seoKeywords.filter((item) => item.latestSerpPosition != null || item.latestSearchConsolePosition != null).length,
    }
  })
  const searchConsoleConnected = connection?.scopes.includes(getGoogleMarketingProductScope('SEARCH_CONSOLE')) || false

  return <div className="space-y-4">
    <ErpPageHero
      breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' }, { label: 'SEO y posicionamiento' }]}
      title="SEO y posicionamiento web"
      description="Conecta Search Console, registra la URL de cada sitio y controla su ranking orgánico en Google."
    />
    <WebsiteServicesModuleTabs showBuilderTab={showBuilderTab} />
    <WebsiteSeoOverviewClient sites={sites} searchConsoleConnected={searchConsoleConnected} />
  </div>
}
