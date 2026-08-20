import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import WebsitePageRender from '@/components/website-builder/website-page-render'
import {
  normalizeWebsiteBuilderData,
  normalizeWebsitePageSlug,
} from '@/lib/website-builder'
import { resolvePublishedWebsitePageByPath } from '@/lib/website-builder-server'

type PublicWebsitePageProps = {
  params: Promise<{ subdomain: string; slug?: string[] }>
}

export async function generateMetadata({ params }: PublicWebsitePageProps): Promise<Metadata> {
  const { subdomain, slug } = await params
  const page = await resolvePublishedWebsitePageByPath({ subdomain, slug: normalizeWebsitePageSlug(slug) })

  if (!page?.id) {
    return {
      title: 'Sitio no encontrado | Ordex',
      robots: { index: false, follow: false },
    }
  }

  return {
    title: page.seoTitle || `${page.nombre} | ${page.websiteProject.nombre}`,
    description: page.seoDescription || `Sitio publicado desde Ordex para ${page.websiteProject.nombre}.`,
  }
}

export default async function PublicWebsitePage({ params }: PublicWebsitePageProps) {
  const { subdomain, slug } = await params
  const page = await resolvePublishedWebsitePageByPath({ subdomain, slug: normalizeWebsitePageSlug(slug) })

  if (!page?.id || !page.versions[0]?.id) {
    notFound()
  }

  return <WebsitePageRender data={normalizeWebsiteBuilderData(page.versions[0].editorJson)} />
}