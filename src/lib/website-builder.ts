export type WebsiteBuilderData = Record<string, unknown>

export function defaultWebsiteBuilderData() {
  return { content: [] } as WebsiteBuilderData
}

export function normalizeWebsiteBuilderData(value: unknown): WebsiteBuilderData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultWebsiteBuilderData()
  }

  return value as WebsiteBuilderData
}

export function normalizeString(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

export function slugifyWebsiteBuilderValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sitio'
}

export function normalizeWebsiteBuilderHost(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
}

export function buildWebsitePublicPath(subdomain: string, pageSlug?: string | null, isHome?: boolean) {
  const safeSubdomain = slugifyWebsiteBuilderValue(subdomain)
  if (!pageSlug || isHome || pageSlug === 'inicio') {
    return `/sites/${safeSubdomain}`
  }

  return `/sites/${safeSubdomain}/${slugifyWebsiteBuilderValue(pageSlug)}`
}

export function extractWebsiteSubdomainFromHost(host: string) {
  const normalized = normalizeWebsiteBuilderHost(host)
  if (!normalized || normalized === 'localhost') return null
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) return null

  const segments = normalized.split('.').filter(Boolean)
  if (segments.length < 2) return null
  if (segments[0] === 'www') return null
  return slugifyWebsiteBuilderValue(segments[0] ?? '') || null
}

export function normalizeWebsitePageSlug(segments: string[] | undefined) {
  if (!segments?.length) return 'inicio'
  return slugifyWebsiteBuilderValue(segments.join('/').split('/').filter(Boolean).join('-') || 'inicio')
}

export function serializeWebsiteProject(project: {
  id: string
  nombre: string
  slug: string
  subdomain: string | null
  primaryDomain: string | null
  status: string
  updatedAt: Date
  createdAt: Date
  pages?: Array<{
    id: string
    nombre: string
    slug: string
    isHome: boolean
    status: string
    updatedAt: Date
    createdAt: Date
  }>
}) {
  return {
    id: project.id,
    nombre: project.nombre,
    slug: project.slug,
    subdomain: project.subdomain,
    primaryDomain: project.primaryDomain,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    pages: (project.pages ?? []).map((page) => ({
      id: page.id,
      nombre: page.nombre,
      slug: page.slug,
      isHome: page.isHome,
      status: page.status,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    })),
  }
}

export function serializeWebsiteProjectPage(page: {
  id: string
  nombre: string
  slug: string
  isHome: boolean
  status: string
  draftData: unknown
  updatedAt: Date
  createdAt: Date
}) {
  return {
    id: page.id,
    nombre: page.nombre,
    slug: page.slug,
    isHome: page.isHome,
    status: page.status,
    draftData: normalizeWebsiteBuilderData(page.draftData),
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  }
}

export function serializeWebsiteProjectVersion(version: {
  id: string
  versionNumber: number
  editorJson: unknown
  isPublished: boolean
  createdAt: Date
}) {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    editorJson: normalizeWebsiteBuilderData(version.editorJson),
    isPublished: version.isPublished,
    createdAt: version.createdAt.toISOString(),
  }
}
