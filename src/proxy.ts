import { NextRequest, NextResponse } from 'next/server'
import { buildWebsitePublicPath, extractWebsiteSubdomainFromHost, normalizeWebsiteBuilderHost } from '@/lib/website-builder'

function getConfiguredAppHosts() {
  const values = [
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ]

  const hosts = values
    .map((value) => {
      if (!value) return null
      try {
        return normalizeWebsiteBuilderHost(new URL(value).host)
      } catch {
        return normalizeWebsiteBuilderHost(value)
      }
    })
    .filter((value): value is string => Boolean(value))

  return new Set([...hosts, 'localhost', '127.0.0.1', '0.0.0.0'])
}

function isStaticAssetPath(pathname: string) {
  return pathname === '/favicon.ico'
    || pathname === '/manifest.webmanifest'
    || pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || /\.[a-z0-9]+$/i.test(pathname)
}

function isInternalPath(pathname: string) {
  return pathname.startsWith('/api/')
    || pathname.startsWith('/_next/')
    || pathname.startsWith('/sites/')
    || pathname.startsWith('/uploads/')
    || isStaticAssetPath(pathname)
}

async function resolveCustomDomainRewrite(req: NextRequest, host: string) {
  const url = req.nextUrl.clone()
  const slugParts = url.pathname.split('/').filter(Boolean)
  const search = new URLSearchParams({ host })
  slugParts.forEach((part) => search.append('slug', part))

  const resolveUrl = new URL(`/api/public/sites/resolve-host?${search.toString()}`, req.url)
  const response = await fetch(resolveUrl, {
    headers: {
      'x-forwarded-host': host,
      host,
    },
  })

  if (!response.ok) return null

  const payload = await response.json().catch(() => null) as {
    ok?: boolean
    item?: {
      subdomain?: string | null
      slug?: string | null
      isHome?: boolean
    }
  } | null

  if (!payload?.ok || !payload.item?.subdomain) return null
  return buildWebsitePublicPath(payload.item.subdomain, payload.item.slug, payload.item.isHome)
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Fuerza que /uploads/* pase por un handler Node (evita 404 por handling estático de assets)
  if (pathname.startsWith('/uploads/')) {
    const url = req.nextUrl.clone()
    url.pathname = `/api${pathname}`
    const res = NextResponse.rewrite(url)
    res.headers.set('X-SG-Uploads', 'rewrite')
    return res
  }

  if (isInternalPath(pathname)) {
    return NextResponse.next()
  }

  const host = normalizeWebsiteBuilderHost(req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
  if (!host) {
    return NextResponse.next()
  }

  const appHosts = getConfiguredAppHosts()
  if (appHosts.has(host)) {
    return NextResponse.next()
  }

  const appHost = [...appHosts].find((value) => !['localhost', '127.0.0.1', '0.0.0.0'].includes(value))
  const directSubdomain = appHost && host.endsWith(`.${appHost}`)
    ? extractWebsiteSubdomainFromHost(host)
    : null

  const rewritePath = directSubdomain
    ? buildWebsitePublicPath(directSubdomain, pathname === '/' ? null : pathname.slice(1), pathname === '/')
    : await resolveCustomDomainRewrite(req, host)

  if (!rewritePath) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = rewritePath
  const res = NextResponse.rewrite(url)
  res.headers.set('X-SG-Website-Rewrite', host)
  return res

  return NextResponse.next()
}

export const config = {
  matcher: ['/:path*'],
}
