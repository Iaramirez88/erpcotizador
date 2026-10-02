import { NextRequest, NextResponse } from 'next/server'
import { buildWebsitePublicPath, normalizeWebsiteBuilderHost } from '@/lib/website-builder'

const PUBLIC_WEBSITE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://www.figma.com https://codepen.io",
  "upgrade-insecure-requests",
].join('; ')

function applyPublicWebsiteSecurityHeaders(response: NextResponse) {
  response.headers.set('Content-Security-Policy', PUBLIC_WEBSITE_CSP)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

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

async function resolveWebsiteHost(req: NextRequest, host: string) {
  const url = req.nextUrl.clone()
  const slugParts = url.pathname.split('/').filter(Boolean)
  const search = new URLSearchParams({ host })
  slugParts.forEach((part) => search.append('slug', part))

  const internalOrigin = process.env.WEBSITE_INTERNAL_ORIGIN || 'http://127.0.0.1:3000'
  const resolveUrl = new URL(`/api/public/sites/resolve-host?${search.toString()}`, internalOrigin)
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
      primaryDomain?: string | null
      slug?: string | null
      isHome?: boolean
    }
  } | null

  if (!payload?.ok || !payload.item?.subdomain) return null
  return {
    rewritePath: buildWebsitePublicPath(payload.item.subdomain, payload.item.slug, payload.item.isHome),
    primaryDomain: normalizeWebsiteBuilderHost(payload.item.primaryDomain),
  }
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

  if (pathname.startsWith('/sites/')) {
    return applyPublicWebsiteSecurityHeaders(NextResponse.next())
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

  const resolution = await resolveWebsiteHost(req, host)

  if (!resolution) {
    return NextResponse.next()
  }

  if (resolution.primaryDomain && resolution.primaryDomain !== host) {
    const canonicalUrl = req.nextUrl.clone()
    canonicalUrl.protocol = 'https:'
    canonicalUrl.host = resolution.primaryDomain
    canonicalUrl.port = ''
    return NextResponse.redirect(canonicalUrl, 308)
  }

  const url = req.nextUrl.clone()
  url.pathname = resolution.rewritePath
  const res = NextResponse.rewrite(url)
  res.headers.set('X-SG-Website-Rewrite', host)
  return applyPublicWebsiteSecurityHeaders(res)
}

export const config = {
  matcher: ['/:path*'],
}
