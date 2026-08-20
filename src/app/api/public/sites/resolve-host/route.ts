import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeWebsiteBuilderHost,
  normalizeWebsitePageSlug,
} from '@/lib/website-builder'
import { resolvePublishedWebsitePageByHost } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const requestedHost = normalizeWebsiteBuilderHost(
    request.nextUrl.searchParams.get('host') || request.headers.get('x-forwarded-host') || request.headers.get('host')
  )
  const slug = normalizeWebsitePageSlug(request.nextUrl.searchParams.getAll('slug'))

  if (!requestedHost) {
    return NextResponse.json({ ok: false, error: 'Host requerido.' }, { status: 400 })
  }

  const page = await resolvePublishedWebsitePageByHost({ host: requestedHost, slug })
  if (!page?.id) {
    return NextResponse.json({ ok: false, error: 'Sitio publicado no encontrado.' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    item: {
      projectId: page.websiteProject.id,
      projectName: page.websiteProject.nombre,
      subdomain: page.websiteProject.subdomain,
      primaryDomain: page.websiteProject.primaryDomain,
      pageId: page.id,
      pageName: page.nombre,
      slug: page.slug,
      isHome: page.isHome,
      versionNumber: page.versions[0]?.versionNumber ?? null,
    },
  })
}