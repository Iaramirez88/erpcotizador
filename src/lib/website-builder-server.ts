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
      websiteProject: { subdomain },
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
  const slug = slugifyWebsiteBuilderValue(args.slug || 'inicio')
  const subdomain = extractWebsiteSubdomainFromHost(normalizedHost)
  const projectFilters: Prisma.WebsiteProjectWhereInput[] = []

  if (normalizedHost) {
    projectFilters.push({ primaryDomain: normalizedHost })
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
      websiteProject: { OR: projectFilters },
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