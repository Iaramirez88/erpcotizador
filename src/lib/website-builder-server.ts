import { auth } from '@/lib/auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import {
  extractWebsiteSubdomainFromHost,
  normalizeWebsiteBuilderHost,
  normalizeWebsiteBuilderData,
  slugifyWebsiteBuilderValue,
} from '@/lib/website-builder'

export function toWebsiteBuilderInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return normalizeWebsiteBuilderData(value) as Prisma.InputJsonObject
}

export async function requireWebsiteBuilderAccess() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: 'No autorizado', status: 401 }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return { ok: false as const, error: 'Sesión inválida', status: 401 }
  }

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) {
    return { ok: false as const, error: 'Prohibido', status: 403 }
  }

  return { ok: true as const, userId, access }
}

export async function resolvePublishedWebsitePageByPath(args: {
  subdomain: string
  slug?: string | null
}) {
  const subdomain = slugifyWebsiteBuilderValue(args.subdomain)
  const slug = slugifyWebsiteBuilderValue(args.slug || 'inicio')

  return prisma.websiteProjectPage.findFirst({
    where: {
      slug,
      websiteProject: { subdomain, status: 'PUBLISHED' },
      versions: { some: { isPublished: true } },
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      isHome: true,
      seoTitle: true,
      seoDescription: true,
      websiteProject: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          subdomain: true,
          primaryDomain: true,
        },
      },
      versions: {
        where: { isPublished: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          editorJson: true,
          createdAt: true,
        },
      },
    },
  })
}

export async function resolvePublishedWebsitePageByHost(args: {
  host: string
  slug?: string | null
}) {
  const normalizedHost = normalizeWebsiteBuilderHost(args.host)
  const baseDomain = normalizeWebsiteBuilderHost(process.env.NEXT_PUBLIC_WEBSITE_BASE_DOMAIN)
  const slug = slugifyWebsiteBuilderValue(args.slug || 'inicio')
  const isFreeSubdomain = Boolean(baseDomain && normalizedHost.endsWith(`.${baseDomain}`))
  const hostLabel = isFreeSubdomain ? normalizedHost.slice(0, -(baseDomain.length + 1)) : null
  const subdomain = hostLabel && !hostLabel.includes('.') ? extractWebsiteSubdomainFromHost(normalizedHost) : null
  const projectFilters: Prisma.WebsiteProjectWhereInput[] = []

  if (normalizedHost) {
    projectFilters.push({ domains: { some: { hostname: normalizedHost, status: 'ACTIVE' } } })
  }
  if (subdomain) {
    projectFilters.push({ subdomain })
  }
  if (projectFilters.length === 0) {
    return null
  }

  return prisma.websiteProjectPage.findFirst({
    where: {
      slug,
      websiteProject: { status: 'PUBLISHED', OR: projectFilters },
      versions: { some: { isPublished: true } },
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      isHome: true,
      seoTitle: true,
      seoDescription: true,
      websiteProject: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          subdomain: true,
          primaryDomain: true,
          domains: {
            where: { status: 'ACTIVE' },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: { hostname: true },
          },
        },
      },
      versions: {
        where: { isPublished: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          editorJson: true,
          createdAt: true,
        },
      },
    },
  })
}