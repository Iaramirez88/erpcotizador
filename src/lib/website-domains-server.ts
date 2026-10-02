import 'server-only'

import { resolve4, resolve6, resolveCname, resolveTxt } from 'node:dns/promises'
import { domainToASCII } from 'node:url'
import { parse } from 'tldts'
import { normalizeWebsiteBuilderHost } from '@/lib/website-builder'

export const WEBSITE_DOMAIN_VERIFICATION_PREFIX = 'ordex-site-verification='

function splitEnvironmentList(value: string | undefined) {
  return new Set(String(value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
}

export function validateWebsiteCustomHostname(value: unknown) {
  const raw = String(value ?? '').trim().replace(/\.$/, '')
  if (!raw || raw.includes('://') || /[\s/@:*]/.test(raw)) {
    return { ok: false as const, error: 'Ingresa únicamente el dominio, por ejemplo empresa.com.' }
  }

  const hostname = domainToASCII(raw).toLowerCase()
  const parsed = parse(hostname, { allowPrivateDomains: false })
  if (!hostname || hostname.length > 253 || !parsed.domain || !parsed.isIcann) {
    return { ok: false as const, error: 'El dominio no es público o no tiene una extensión válida.' }
  }

  const labels = hostname.split('.')
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    return { ok: false as const, error: 'El dominio contiene una etiqueta no válida.' }
  }

  const baseDomain = normalizeWebsiteBuilderHost(process.env.NEXT_PUBLIC_WEBSITE_BASE_DOMAIN)
  if (baseDomain && (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`))) {
    return { ok: false as const, error: 'Los dominios internos de Ordex no se conectan como dominios personalizados.' }
  }

  return { ok: true as const, hostname, registrableDomain: parsed.domain }
}

export function getWebsiteDomainDnsInstructions(hostname: string, verificationToken: string) {
  const baseDomain = normalizeWebsiteBuilderHost(process.env.NEXT_PUBLIC_WEBSITE_BASE_DOMAIN)
  const cnameTarget = normalizeWebsiteBuilderHost(process.env.WEBSITE_DOMAIN_CNAME_TARGET) || (baseDomain ? `edge.${baseDomain}` : '')
  const ipv4 = [...splitEnvironmentList(process.env.WEBSITE_DOMAIN_IPV4)]
  const ipv6 = [...splitEnvironmentList(process.env.WEBSITE_DOMAIN_IPV6)]

  return {
    ownership: {
      type: 'TXT',
      name: `_ordex-verification.${hostname}`,
      value: `${WEBSITE_DOMAIN_VERIFICATION_PREFIX}${verificationToken}`,
    },
    routing: { cnameTarget, ipv4, ipv6 },
  }
}

async function safelyResolve<T>(resolver: () => Promise<T>, fallback: T) {
  try {
    return await resolver()
  } catch {
    return fallback
  }
}

export async function verifyWebsiteDomainDns(hostname: string, verificationToken: string) {
  const instructions = getWebsiteDomainDnsInstructions(hostname, verificationToken)
  const [txtGroups, cnames, ipv4, ipv6] = await Promise.all([
    safelyResolve(() => resolveTxt(instructions.ownership.name), [] as string[][]),
    safelyResolve(() => resolveCname(hostname), [] as string[]),
    safelyResolve(() => resolve4(hostname), [] as string[]),
    safelyResolve(() => resolve6(hostname), [] as string[]),
  ])

  const txtValues = txtGroups.map((parts) => parts.join(''))
  const ownershipVerified = txtValues.includes(instructions.ownership.value)
  const normalizedCnames = cnames.map((item) => normalizeWebsiteBuilderHost(item.replace(/\.$/, '')))
  const cnameVerified = Boolean(instructions.routing.cnameTarget)
    && normalizedCnames.includes(instructions.routing.cnameTarget)
  const ipv4Verified = ipv4.some((item) => instructions.routing.ipv4.includes(item.toLowerCase()))
  const ipv6Verified = ipv6.some((item) => instructions.routing.ipv6.includes(item.toLowerCase()))
  const routingConfigured = Boolean(instructions.routing.cnameTarget || instructions.routing.ipv4.length || instructions.routing.ipv6.length)
  const routingVerified = routingConfigured && (cnameVerified || ipv4Verified || ipv6Verified)

  return {
    ownershipVerified,
    routingVerified,
    routingConfigured,
    records: { txt: txtValues, cname: normalizedCnames, ipv4, ipv6 },
    instructions,
  }
}

export function serializeWebsiteProjectDomain(domain: {
  id: string
  websiteProjectId: string
  hostname: string
  status: string
  verificationToken: string
  verificationExpiresAt: Date
  verifiedAt: Date | null
  dnsStatus: string
  sslStatus: string
  isPrimary: boolean
  lastCheckedAt: Date | null
  failureReason: string | null
  disconnectedAt: Date | null
  quarantineUntil: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...domain,
    verificationExpiresAt: domain.verificationExpiresAt.toISOString(),
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
    disconnectedAt: domain.disconnectedAt?.toISOString() ?? null,
    quarantineUntil: domain.quarantineUntil?.toISOString() ?? null,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
    instructions: getWebsiteDomainDnsInstructions(domain.hostname, domain.verificationToken),
  }
}