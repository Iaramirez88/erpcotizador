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

export const WEBSITE_RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'cdn',
  'dashboard',
  'ftp',
  'mail',
  'smtp',
  'soporte',
  'support',
  'www',
])

export function normalizeWebsiteSubdomain(value: unknown) {
  return slugifyWebsiteBuilderValue(String(value ?? '')).slice(0, 60)
}

export function validateWebsiteSubdomain(value: unknown) {
  const rawValue = String(value ?? '').trim().toLowerCase()
  const subdomain = normalizeWebsiteSubdomain(rawValue)

  if (!rawValue || rawValue !== subdomain) {
    return { ok: false as const, error: 'Usa solo letras minúsculas, números y guiones.' }
  }
  if (subdomain.length < 3) {
    return { ok: false as const, error: 'El subdominio debe tener al menos 3 caracteres.' }
  }
  if (WEBSITE_RESERVED_SUBDOMAINS.has(subdomain)) {
    return { ok: false as const, error: 'Este subdominio está reservado por Ordex.' }
  }

  return { ok: true as const, subdomain }
}

export function buildWebsitePublicUrl(
  subdomain: string,
  pageSlug?: string | null,
  isHome?: boolean,
  baseDomain = process.env.NEXT_PUBLIC_WEBSITE_BASE_DOMAIN,
) {
  const safeSubdomain = normalizeWebsiteSubdomain(subdomain)
  const normalizedBaseDomain = normalizeWebsiteBuilderHost(baseDomain)
  if (!normalizedBaseDomain) return buildWebsitePublicPath(safeSubdomain, pageSlug, isHome)

  const pathname = !pageSlug || isHome || pageSlug === 'inicio'
    ? '/'
    : `/${slugifyWebsiteBuilderValue(pageSlug)}`
  const protocol = normalizedBaseDomain === 'localhost' || normalizedBaseDomain.endsWith('.localhost') ? 'http' : 'https'
  const port = typeof window !== 'undefined' && normalizedBaseDomain === 'localhost' ? window.location.port : ''
  return `${protocol}://${safeSubdomain}.${normalizedBaseDomain}${port ? `:${port}` : ''}${pathname}`
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
