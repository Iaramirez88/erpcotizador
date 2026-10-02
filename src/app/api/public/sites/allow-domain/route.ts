import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractWebsiteSubdomainFromHost, normalizeWebsiteBuilderHost } from '@/lib/website-builder'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const domain = normalizeWebsiteBuilderHost(request.nextUrl.searchParams.get('domain'))
  const baseDomain = normalizeWebsiteBuilderHost(process.env.NEXT_PUBLIC_WEBSITE_BASE_DOMAIN)

  if (!domain) {
    return new NextResponse(null, { status: 404 })
  }

  const isFreeSubdomain = Boolean(baseDomain && domain.endsWith(`.${baseDomain}`))
  const hostLabel = isFreeSubdomain ? domain.slice(0, -(baseDomain!.length + 1)) : null
  const subdomain = isFreeSubdomain ? extractWebsiteSubdomainFromHost(domain) : null
  if (isFreeSubdomain && (!hostLabel || hostLabel.includes('.') || !subdomain || subdomain !== hostLabel)) {
    return new NextResponse(null, { status: 404 })
  }

  const project = await prisma.websiteProject.findFirst({
    where: {
      status: 'PUBLISHED',
      ...(isFreeSubdomain
        ? { subdomain }
        : { domains: { some: { hostname: domain, status: 'ACTIVE' } } }),
      pages: { some: { versions: { some: { isPublished: true } } } },
    },
    select: { id: true },
  })

  return new NextResponse(null, { status: project ? 200 : 404 })
}
