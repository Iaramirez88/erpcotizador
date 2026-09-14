import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractWebsiteSubdomainFromHost, normalizeWebsiteBuilderHost } from '@/lib/website-builder'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const domain = normalizeWebsiteBuilderHost(request.nextUrl.searchParams.get('domain'))
  const baseDomain = normalizeWebsiteBuilderHost(process.env.NEXT_PUBLIC_WEBSITE_BASE_DOMAIN)

  if (!domain || !baseDomain || !domain.endsWith(`.${baseDomain}`)) {
    return new NextResponse(null, { status: 404 })
  }

  const hostLabel = domain.slice(0, -(baseDomain.length + 1))
  if (!hostLabel || hostLabel.includes('.')) return new NextResponse(null, { status: 404 })

  const subdomain = extractWebsiteSubdomainFromHost(domain)
  if (!subdomain || subdomain !== hostLabel) return new NextResponse(null, { status: 404 })

  const project = await prisma.websiteProject.findFirst({
    where: {
      subdomain,
      pages: { some: { versions: { some: { isPublished: true } } } },
    },
    select: { id: true },
  })

  return new NextResponse(null, { status: project ? 200 : 404 })
}
