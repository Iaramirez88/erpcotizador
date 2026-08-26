import {
  Prisma,
  RopCapacitySourceType,
  RopCapacityStatus,
  RopCompanyType,
  RopCoverageScope,
  RopModerationStatus,
  RopOpportunitySourceType,
  RopOpportunityStatus,
  RopOpportunityVisibility,
  RopSlotStatus,
  RopVisibilityLevel,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { recomputeRopTrustScoreForCompany } from '@/lib/rop-trust'

type ProfileServiceItem = {
  companyServiceId: string
  serviceCatalogId: string
  categoryName: string
  subcategoryName: string
  serviceName: string
  leadTimeHours: number | null
}

export type RopCompanyProfileResponse = {
  companyId: string
  companyType: 'INTERNAL' | 'EXTERNAL' | 'PARTNER'
  legalName: string
  brandName: string | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  onboardingStatus: 'DRAFT' | 'ACTIVE' | 'SUSPENDED'
  location: {
    countryCode: string
    region: string | null
    city: string | null
  }
  coverageScope: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  descriptionPublic: string | null
  services: ProfileServiceItem[]
  profileCompletionPercent: number
  visibility: {
    profile: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
    capacity: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
  }
}

export type RopHomeCard = {
  id: string
  kind: 'COMPANY' | 'CAPACITY' | 'OPPORTUNITY' | 'CELL'
  title: string
  subtitle: string | null
  score: number | null
  trustScore: number | null
  logoUrl: string | null
  phonePublic: string | null
  emailPublic: string | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | null
  coverageScope: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  capacityStatus: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE' | null
  availabilityLabel: string | null
  reason: string
  primaryAction: {
    type: 'INVITE' | 'VIEW_COMPATIBILITY' | 'OPEN_PROFILE' | 'OPEN_CELL'
    label: string
  }
}

export type RopHomeResponse = {
  cluster: {
    clusterId: string
    name: string
    reason: string
  } | null
  hero: {
    title: string
    summary: string
    primaryAction: {
      type: 'PUBLISH_NEED' | 'VIEW_RECOMMENDATIONS' | 'COMPLETE_PROFILE'
      label: string
    }
    secondaryAction: {
      type: 'VIEW_CLUSTER' | 'EDIT_PROFILE'
      label: string
    } | null
  }
  rails: Array<{
    key: 'RECOMMENDED_COMPANIES' | 'CAPACITY_TODAY' | 'NEARBY_COMPANIES' | 'FREQUENT_ALLIES'
    title: string
    items: RopHomeCard[]
  }>
}

export type RopDiscoveryFilters = {
  serviceCatalogId?: string
  city?: string
  coverageScope?: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT'
  minTrustScore?: number
  availabilityStatus?: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE'
  clusterId?: string
  search?: string
}

export type RopDiscoveryCompany = {
  companyId: string
  title: string
  subtitle: string | null
  logoUrl: string | null
  city: string | null
  region: string | null
  coverageScope: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  trustScore: number | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  capacityStatus: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE' | null
  availableQuantity: number | null
  availabilityLabel: string | null
  phonePublic: string | null
  emailPublic: string | null
  serviceName: string | null
  serviceCatalogId: string | null
  reason: string
}

export type UpsertRopCompanyProfileInput = {
  brandName?: string | null
  descriptionPublic?: string | null
  location: {
    countryCode: string
    region?: string | null
    city?: string | null
  }
  coverageScope?: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  visibilityLevel: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
  serviceSelections: Array<{
    serviceCatalogId: string
    publicTitle?: string | null
    leadTimeHours?: number | null
    minOrderValue?: number | null
  }>
}

export type RopCapacityResponse = {
  items: Array<{
    id: string
    companyServiceId: string
    serviceCatalogId: string
    serviceName: string
    availableQuantity: number
    reservedQuantity: number | null
    status: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE'
    availableFrom: string
    availableUntil: string
    slaHours: number | null
    sourceType: 'MANUAL' | 'ERP_EVENT' | 'API'
  }>
}

export type UpsertCapacitySnapshotInput = {
  items: Array<{
    companyServiceId: string
    availableQuantity: number
    reservedQuantity?: number | null
    status: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE'
    availableFrom: string
    availableUntil: string
    slaHours?: number | null
    sourceType: 'MANUAL' | 'ERP_EVENT' | 'API'
  }>
}

export type UpsertAvailabilitySlotsInput = {
  items: Array<{
    companyServiceId: string
    dayOfWeek?: number | null
    specificDate?: string | null
    startTime?: string | null
    endTime?: string | null
    slotStatus: 'OPEN' | 'BLOCKED' | 'RESERVED'
    recurrenceRule?: string | null
  }>
}

export type CreateRopOpportunityInput = {
  title: string
  descriptionPublic?: string | null
  requirementsPrivate?: string | null
  categoryId: string
  subcategoryId: string
  serviceCatalogId: string
  location: {
    countryCode: string
    region?: string | null
    city?: string | null
  }
  expectedQuantity?: number | null
  dueAt?: string | null
  visibilityLevel: 'PRIVATE' | 'CLUSTER' | 'NETWORK'
  sourceType: 'MANUAL' | 'CRM' | 'PURCHASE' | 'OPS_SIGNAL' | 'API'
  sourceRef?: string | null
}

export type RopOpportunityResponse = {
  id: string
  title: string
  status: 'DRAFT' | 'OPEN' | 'MATCHING' | 'INVITED' | 'IN_PROGRESS' | 'WON' | 'LOST' | 'CANCELLED'
  categoryId: string
  subcategoryId: string
  serviceCatalogId: string
  location: {
    countryCode: string
    region: string | null
    city: string | null
  }
  expectedQuantity: number | null
  dueAt: string | null
  visibilityLevel: 'PRIVATE' | 'CLUSTER' | 'NETWORK'
  sourceType: 'MANUAL' | 'CRM' | 'PURCHASE' | 'OPS_SIGNAL' | 'API'
  createdAt: string
}

export type RopOpportunityRecommendationResult = {
  opportunityId: string
  generatedAt: string
  candidates: Array<{
    companyId: string
    companyName: string
    logoUrl: string | null
    city: string | null
    serviceName: string | null
    trustScore: number | null
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
    capacityStatus: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE' | null
    availabilityLabel: string | null
    phonePublic: string | null
    emailPublic: string | null
    score: number
    tier: 'PRIORITARIO' | 'FUERTE' | 'VIABLE' | 'EXPLORATORIO'
    positives: string[]
    constraints: string[]
    recommendedAction: 'INVITE' | 'REVIEW' | 'WATCH'
    invitationStatus: 'PENDING' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN' | null
  }>
}

export type RopOpportunityDetailResponse = {
  opportunity: RopOpportunityResponse & {
    descriptionPublic: string | null
    requirementsPrivate: string | null
    categoryName: string
    subcategoryName: string
    serviceName: string
  }
  recommendations: RopOpportunityRecommendationResult | null
}

export type CreateRopInvitationsInput = {
  recipientCompanyIds: string[]
  messagePublic?: string | null
  shareBudget?: boolean
  shareAttachments?: boolean
  expiresAt?: string | null
}

type CreateRopRatingInput = {
  qualityScore: number
  timelinessScore: number
  communicationScore: number
  commentPublic?: string | null
}

type DisputeRopRatingInput = {
  reason?: string | null
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized ? normalized : null
}

function clampFivePointScore(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 1 || value > 5) {
    throw new Error(`INVALID_SCORE:${fieldName}`)
  }
  return Math.round(value)
}

function computeOverallRatingScore(input: CreateRopRatingInput) {
  const average = (input.qualityScore + input.timelinessScore + input.communicationScore) / 3
  return new Prisma.Decimal(Number(average.toFixed(2)))
}

function formatTrustSourceRef(kind: 'rating' | 'dispute' | 'moderation', id: string) {
  return `rop:${kind}:${id}`
}

function computeProfileCompletion(args: {
  brandName: string | null
  descriptionPublic: string | null
  countryCode: string
  region: string | null
  city: string | null
  coverageScope: string | null
  servicesCount: number
}) {
  const checks = [
    Boolean(args.brandName),
    Boolean(args.descriptionPublic),
    Boolean(args.countryCode),
    Boolean(args.region),
    Boolean(args.city),
    Boolean(args.coverageScope),
    args.servicesCount > 0,
  ]

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function formatAvailabilityLabel(availableFrom: Date, availableUntil: Date) {
  const start = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(availableFrom)
  const end = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(availableUntil)
  return `${start} - ${end}`
}

async function loadRopCompanyLogoMap(companies: Array<{ id: string; empresaId?: string | null }>) {
  const entries = companies.filter((company) => company.empresaId).map((company) => ({
    companyId: company.id,
    empresaId: company.empresaId as string,
  }))

  if (!entries.length) return new Map<string, string | null>()

  const empresas = await prisma.empresa.findMany({
    where: { id: { in: Array.from(new Set(entries.map((entry) => entry.empresaId))) } },
    select: { id: true, logo: true },
  })

  const logosByEmpresaId = new Map(
    empresas.map((empresa) => [empresa.id, typeof empresa.logo === 'string' && empresa.logo.trim() ? empresa.logo.trim() : null]),
  )

  return new Map(entries.map((entry) => [entry.companyId, logosByEmpresaId.get(entry.empresaId) ?? null]))
}

function normalizeDateInput(value: string, fieldName: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`INVALID_DATE:${fieldName}`)
  }
  return parsed
}

function normalizeTimeInput(value: string | null | undefined, fieldName: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  const parsed = new Date(`1970-01-01T${normalized}:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`INVALID_TIME:${fieldName}`)
  }
  return parsed
}

function buildProfileResponse(company: Awaited<ReturnType<typeof getRopCompanyRecord>>) {
  const services: ProfileServiceItem[] = company.services.map((service) => ({
    companyServiceId: service.id,
    serviceCatalogId: service.serviceCatalogId,
    categoryName: service.serviceCatalog.subcategory.category.name,
    subcategoryName: service.serviceCatalog.subcategory.name,
    serviceName: service.serviceCatalog.name,
    leadTimeHours: service.leadTimeHours ?? null,
  }))

  return {
    companyId: company.id,
    companyType: company.companyType,
    legalName: company.legalName,
    brandName: company.brandName ?? null,
    verificationStatus: company.verificationStatus,
    onboardingStatus: company.onboardingStatus,
    location: {
      countryCode: company.countryCode,
      region: company.region ?? null,
      city: company.city ?? null,
    },
    coverageScope: (company.services[0]?.coverageScope ?? null) as RopCompanyProfileResponse['coverageScope'],
    descriptionPublic: company.descriptionPublic ?? null,
    services,
    profileCompletionPercent: computeProfileCompletion({
      brandName: company.brandName ?? null,
      descriptionPublic: company.descriptionPublic ?? null,
      countryCode: company.countryCode,
      region: company.region ?? null,
      city: company.city ?? null,
      coverageScope: company.services[0]?.coverageScope ?? null,
      servicesCount: services.length,
    }),
    visibility: {
      profile: company.visibilityLevel,
      capacity: company.visibilityPolicies[0]?.audience === 'PUBLIC' ? 'PUBLIC' : company.visibilityLevel,
    },
  } satisfies RopCompanyProfileResponse
}

function buildOpportunityResponse(opportunity: {
  id: string
  title: string
  status: RopOpportunityStatus
  categoryId: string
  subcategoryId: string
  serviceCatalogId: string
  locationCountryCode: string
  locationRegion: string | null
  locationCity: string | null
  expectedQuantity: unknown
  dueAt: Date | null
  visibilityLevel: RopOpportunityVisibility
  sourceType: RopOpportunitySourceType
  createdAt: Date
}) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    status: opportunity.status,
    categoryId: opportunity.categoryId,
    subcategoryId: opportunity.subcategoryId,
    serviceCatalogId: opportunity.serviceCatalogId,
    location: {
      countryCode: opportunity.locationCountryCode,
      region: opportunity.locationRegion ?? null,
      city: opportunity.locationCity ?? null,
    },
    expectedQuantity:
      opportunity.expectedQuantity === null || opportunity.expectedQuantity === undefined
        ? null
        : Number(opportunity.expectedQuantity),
    dueAt: opportunity.dueAt ? opportunity.dueAt.toISOString() : null,
    visibilityLevel: opportunity.visibilityLevel,
    sourceType: opportunity.sourceType,
    createdAt: opportunity.createdAt.toISOString(),
  } satisfies RopOpportunityResponse
}

function buildOpportunityTier(score: number): 'PRIORITARIO' | 'FUERTE' | 'VIABLE' | 'EXPLORATORIO' {
  if (score >= 80) return 'PRIORITARIO'
  if (score >= 65) return 'FUERTE'
  if (score >= 45) return 'VIABLE'
  return 'EXPLORATORIO'
}

function buildOpportunityRecommendedAction(score: number): 'INVITE' | 'REVIEW' | 'WATCH' {
  if (score >= 80) return 'INVITE'
  if (score >= 55) return 'REVIEW'
  return 'WATCH'
}

async function getOwnedRopOpportunityForUser(userId: string, opportunityId: string) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await ensureRopCompanyForEmpresa(empresaId)

  const opportunity = await prisma.ropOpportunity.findFirst({
    where: {
      id: opportunityId,
      originCompanyId: company.id,
      archivedAt: null,
    },
    include: {
      category: true,
      subcategory: true,
      serviceCatalog: true,
      invitations: {
        include: {
          recipientCompany: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      matches: {
        include: {
          company: {
            include: {
              trustScore: true,
              capacities: {
                where: {
                  availableUntil: { gte: new Date() },
                },
                take: 1,
                orderBy: [{ availableFrom: 'asc' }, { createdAt: 'desc' }],
              },
              services: {
                where: { activeStatus: 'ACTIVE' },
                take: 1,
                orderBy: { createdAt: 'asc' },
                include: { serviceCatalog: true },
              },
            },
          },
        },
        orderBy: { rankPosition: 'asc' },
      },
    },
  })

  if (!opportunity) {
    throw new Error('ROP_OPPORTUNITY_NOT_FOUND')
  }

  return { company, opportunity }
}

async function getRopCompanyRecord(empresaId: string) {
  await ensureRopCompanyForEmpresa(empresaId)

  const company = await prisma.ropCompany.findUnique({
    where: { empresaId },
    include: {
      services: {
        orderBy: { createdAt: 'asc' },
        include: {
          serviceCatalog: {
            include: {
              subcategory: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      },
      visibilityPolicies: {
        where: { fieldName: 'capacity', isEnabled: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      trustScore: true,
    },
  })

  if (!company) {
    throw new Error('ROP_COMPANY_NOT_FOUND')
  }

  return company
}

export async function ensureRopCompanyForEmpresa(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      nombre: true,
      nit: true,
      direccion: true,
      telefono: true,
      email: true,
    },
  })

  if (!empresa?.id) {
    throw new Error('EMPRESA_NOT_FOUND')
  }

  return prisma.ropCompany.upsert({
    where: { empresaId },
    update: {
      legalName: empresa.nombre,
      taxId: empresa.nit || null,
      primaryAddress: empresa.direccion || null,
      phonePublic: empresa.telefono || null,
      emailPublic: empresa.email || null,
    },
    create: {
      empresaId: empresa.id,
      companyType: RopCompanyType.INTERNAL,
      legalName: empresa.nombre,
      brandName: empresa.nombre,
      taxId: empresa.nit || null,
      countryCode: 'CO',
      primaryAddress: empresa.direccion || null,
      phonePublic: empresa.telefono || null,
      emailPublic: empresa.email || null,
      metadata: {},
    },
  })
}

export async function getRopProfileForUser(userId: string) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await getRopCompanyRecord(empresaId)
  return buildProfileResponse(company)
}

export async function getRopProfilePrefillForUser(userId: string) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const [empresa, company] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        nombre: true,
        nit: true,
        direccion: true,
        telefono: true,
        email: true,
        businessType: true,
      },
    }),
    getRopCompanyRecord(empresaId),
  ])

  if (!empresa?.id) throw new Error('EMPRESA_NOT_FOUND')

  return {
    empresa: {
      id: empresa.id,
      nombre: empresa.nombre,
      nit: empresa.nit ?? null,
      direccion: empresa.direccion ?? null,
      telefono: empresa.telefono ?? null,
      email: empresa.email ?? null,
      businessType: empresa.businessType ?? null,
    },
    company: buildProfileResponse(company),
  }
}

export async function upsertRopProfileForUser(userId: string, input: UpsertRopCompanyProfileInput) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await ensureRopCompanyForEmpresa(empresaId)

  const serviceCatalogIds = Array.from(new Set(input.serviceSelections.map((item) => item.serviceCatalogId.trim()).filter(Boolean)))
  const validServices = serviceCatalogIds.length
    ? await prisma.ropServiceCatalog.findMany({
        where: { id: { in: serviceCatalogIds }, isActive: true },
        select: { id: true },
      })
    : []

  const validServiceIds = new Set(validServices.map((service) => service.id))
  const invalidServiceIds = serviceCatalogIds.filter((id) => !validServiceIds.has(id))
  if (invalidServiceIds.length) {
    throw new Error(`INVALID_SERVICE_IDS:${invalidServiceIds.join(',')}`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.ropCompany.update({
      where: { id: company.id },
      data: {
        brandName: normalizeNullableText(input.brandName),
        descriptionPublic: normalizeNullableText(input.descriptionPublic),
        countryCode: input.location.countryCode.trim().toUpperCase(),
        region: normalizeNullableText(input.location.region),
        city: normalizeNullableText(input.location.city),
        visibilityLevel: input.visibilityLevel as RopVisibilityLevel,
        onboardingStatus: 'ACTIVE',
      },
    })

    await tx.ropCompanyService.deleteMany({ where: { companyId: company.id } })

    if (input.serviceSelections.length) {
      await tx.ropCompanyService.createMany({
        data: input.serviceSelections.map((item) => ({
          companyId: company.id,
          serviceCatalogId: item.serviceCatalogId.trim(),
          publicTitle: normalizeNullableText(item.publicTitle),
          leadTimeHours: item.leadTimeHours ?? null,
          minOrderValue: item.minOrderValue ?? null,
          coverageScope: (input.coverageScope ?? null) as RopCoverageScope | null,
          visibilityLevel: input.visibilityLevel as RopVisibilityLevel,
        })),
      })
    }
  })

  return getRopProfileForUser(userId)
}

export async function getRopCapacityForUser(userId: string): Promise<RopCapacityResponse> {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await getRopCompanyRecord(empresaId)

  const items = await prisma.ropCapacityAvailability.findMany({
    where: { companyId: company.id },
    include: {
      serviceCatalog: { select: { id: true, name: true } },
    },
    orderBy: [{ availableFrom: 'asc' }, { createdAt: 'desc' }],
  })

  return {
    items: items.map((item) => ({
      id: item.id,
      companyServiceId: item.companyServiceId,
      serviceCatalogId: item.serviceCatalogId,
      serviceName: item.serviceCatalog.name,
      availableQuantity: Number(item.availableQuantity),
      reservedQuantity: item.reservedQuantity === null ? null : Number(item.reservedQuantity),
      status: item.status,
      availableFrom: item.availableFrom.toISOString(),
      availableUntil: item.availableUntil.toISOString(),
      slaHours: item.slaHours ?? null,
      sourceType: item.sourceType,
    })),
  }
}

export async function upsertRopCapacityForUser(userId: string, input: UpsertCapacitySnapshotInput) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await getRopCompanyRecord(empresaId)

  const companyServiceIds = Array.from(new Set(input.items.map((item) => item.companyServiceId.trim()).filter(Boolean)))
  const companyServices = companyServiceIds.length
    ? await prisma.ropCompanyService.findMany({
        where: { id: { in: companyServiceIds }, companyId: company.id },
        select: { id: true, serviceCatalogId: true },
      })
    : []

  const validServiceMap = new Map(companyServices.map((item) => [item.id, item.serviceCatalogId]))
  const invalidCompanyServiceIds = companyServiceIds.filter((id) => !validServiceMap.has(id))
  if (invalidCompanyServiceIds.length) {
    throw new Error(`INVALID_COMPANY_SERVICE_IDS:${invalidCompanyServiceIds.join(',')}`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.ropCapacityAvailability.deleteMany({ where: { companyId: company.id } })

    if (input.items.length) {
      await tx.ropCapacityAvailability.createMany({
        data: input.items.map((item) => ({
          companyServiceId: item.companyServiceId.trim(),
          companyId: company.id,
          serviceCatalogId: validServiceMap.get(item.companyServiceId.trim())!,
          availableQuantity: item.availableQuantity,
          reservedQuantity: item.reservedQuantity ?? null,
          status: item.status as RopCapacityStatus,
          availableFrom: normalizeDateInput(item.availableFrom, 'availableFrom'),
          availableUntil: normalizeDateInput(item.availableUntil, 'availableUntil'),
          slaHours: item.slaHours ?? null,
          freshnessAt: new Date(),
          sourceType: item.sourceType as RopCapacitySourceType,
        })),
      })
    }
  })

  return getRopCapacityForUser(userId)
}

export async function upsertRopAvailabilitySlotsForUser(userId: string, input: UpsertAvailabilitySlotsInput) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await getRopCompanyRecord(empresaId)

  const companyServiceIds = Array.from(new Set(input.items.map((item) => item.companyServiceId.trim()).filter(Boolean)))
  const companyServices = companyServiceIds.length
    ? await prisma.ropCompanyService.findMany({
        where: { id: { in: companyServiceIds }, companyId: company.id },
        select: { id: true },
      })
    : []

  const validServiceIds = new Set(companyServices.map((item) => item.id))
  const invalidCompanyServiceIds = companyServiceIds.filter((id) => !validServiceIds.has(id))
  if (invalidCompanyServiceIds.length) {
    throw new Error(`INVALID_COMPANY_SERVICE_IDS:${invalidCompanyServiceIds.join(',')}`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.ropAvailabilitySlot.deleteMany({ where: { companyService: { companyId: company.id } } })

    if (input.items.length) {
      await tx.ropAvailabilitySlot.createMany({
        data: input.items.map((item) => ({
          companyServiceId: item.companyServiceId.trim(),
          dayOfWeek: item.dayOfWeek ?? null,
          specificDate: item.specificDate ? normalizeDateInput(item.specificDate, 'specificDate') : null,
          startTime: normalizeTimeInput(item.startTime, 'startTime'),
          endTime: normalizeTimeInput(item.endTime, 'endTime'),
          slotStatus: item.slotStatus as RopSlotStatus,
          recurrenceRule: normalizeNullableText(item.recurrenceRule),
        })),
      })
    }
  })

  return { ok: true }
}

export async function createRopOpportunityForUser(userId: string, input: CreateRopOpportunityInput) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await ensureRopCompanyForEmpresa(empresaId)

  const service = await prisma.ropServiceCatalog.findFirst({
    where: {
      id: input.serviceCatalogId.trim(),
      isActive: true,
      subcategoryId: input.subcategoryId.trim(),
      subcategory: {
        categoryId: input.categoryId.trim(),
        isActive: true,
      },
    },
    select: {
      id: true,
      subcategoryId: true,
      subcategory: {
        select: {
          categoryId: true,
        },
      },
    },
  })

  if (!service) {
    throw new Error('INVALID_OPPORTUNITY_SERVICE_RELATION')
  }

  const opportunity = await prisma.ropOpportunity.create({
    data: {
      originCompanyId: company.id,
      title: input.title.trim(),
      descriptionPublic: normalizeNullableText(input.descriptionPublic),
      requirementsPrivate: normalizeNullableText(input.requirementsPrivate),
      categoryId: service.subcategory.categoryId,
      subcategoryId: service.subcategoryId,
      serviceCatalogId: service.id,
      locationCountryCode: input.location.countryCode.trim().toUpperCase(),
      locationRegion: normalizeNullableText(input.location.region),
      locationCity: normalizeNullableText(input.location.city),
      expectedQuantity: typeof input.expectedQuantity === 'number' ? input.expectedQuantity : null,
      dueAt: input.dueAt ? normalizeDateInput(input.dueAt, 'dueAt') : null,
      status: RopOpportunityStatus.OPEN,
      sourceType: input.sourceType as RopOpportunitySourceType,
      sourceRef: normalizeNullableText(input.sourceRef),
      visibilityLevel: input.visibilityLevel as RopOpportunityVisibility,
    },
    select: {
      id: true,
      title: true,
      status: true,
      categoryId: true,
      subcategoryId: true,
      serviceCatalogId: true,
      locationCountryCode: true,
      locationRegion: true,
      locationCity: true,
      expectedQuantity: true,
      dueAt: true,
      visibilityLevel: true,
      sourceType: true,
      createdAt: true,
    },
  })

  return buildOpportunityResponse(opportunity)
}

export async function getRopOpportunityDetailForUser(userId: string, opportunityId: string): Promise<RopOpportunityDetailResponse> {
  const { opportunity } = await getOwnedRopOpportunityForUser(userId, opportunityId)
  const logoMap = await loadRopCompanyLogoMap(
    opportunity.matches.map((match) => ({ id: match.company.id, empresaId: match.company.empresaId })),
  )

  const recommendations = opportunity.matches.length
    ? {
        opportunityId: opportunity.id,
        generatedAt: opportunity.matches[0]!.generatedAt.toISOString(),
        candidates: opportunity.matches.map((match) => {
          const breakdown = typeof match.scoreBreakdownJson === 'object' && match.scoreBreakdownJson !== null ? match.scoreBreakdownJson as {
            positives?: string[]
            constraints?: string[]
          } : null

          return {
            companyId: match.companyId,
            companyName: match.company.brandName || match.company.legalName,
            logoUrl: logoMap.get(match.company.id) ?? null,
            city: match.company.city || match.company.region || null,
            serviceName: match.company.services[0]?.serviceCatalog.name ?? null,
            trustScore: match.company.trustScore ? Number(match.company.trustScore.overallScore) : null,
            verificationStatus: match.company.verificationStatus,
            capacityStatus: match.company.capacities[0]?.status ?? null,
            availabilityLabel: match.company.capacities[0]
              ? formatAvailabilityLabel(match.company.capacities[0].availableFrom, match.company.capacities[0].availableUntil)
              : null,
            phonePublic: match.company.phonePublic ?? null,
            emailPublic: match.company.emailPublic ?? null,
            score: Number(match.matchScore),
            tier: buildOpportunityTier(Number(match.matchScore)),
            positives: breakdown?.positives ?? [],
            constraints: breakdown?.constraints ?? [],
            recommendedAction: buildOpportunityRecommendedAction(Number(match.matchScore)),
            invitationStatus: opportunity.invitations.find((invitation) => invitation.recipientCompanyId === match.companyId)?.status ?? null,
          }
        }),
      }
    : null

  return {
    opportunity: {
      ...buildOpportunityResponse(opportunity),
      descriptionPublic: opportunity.descriptionPublic ?? null,
      requirementsPrivate: opportunity.requirementsPrivate ?? null,
      categoryName: opportunity.category.name,
      subcategoryName: opportunity.subcategory.name,
      serviceName: opportunity.serviceCatalog.name,
    },
    recommendations,
  }
}

export async function generateRopOpportunityRecommendationsForUser(userId: string, opportunityId: string): Promise<RopOpportunityRecommendationResult> {
  const { company, opportunity } = await getOwnedRopOpportunityForUser(userId, opportunityId)
  const now = new Date()

  const [originClusters, candidates] = await Promise.all([
    prisma.ropClusterMembership.findMany({
      where: { companyId: company.id, status: 'ACTIVE' },
      select: { clusterId: true },
    }),
    prisma.ropCompany.findMany({
      where: {
        id: { not: company.id },
        archivedAt: null,
        visibilityLevel: { not: 'PRIVATE' },
        services: { some: { serviceCatalogId: opportunity.serviceCatalogId, activeStatus: 'ACTIVE' } },
      },
      include: {
        trustScore: true,
        services: {
          where: { serviceCatalogId: opportunity.serviceCatalogId, activeStatus: 'ACTIVE' },
          take: 1,
          include: { serviceCatalog: true },
        },
        capacities: {
          where: {
            serviceCatalogId: opportunity.serviceCatalogId,
            availableUntil: { gte: now },
          },
          take: 1,
          orderBy: [{ status: 'asc' }, { availableFrom: 'asc' }],
        },
        clusterMemberships: {
          where: { status: 'ACTIVE' },
          select: { clusterId: true },
        },
      },
      take: 24,
      orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
    }),
  ])

  const originClusterIds = new Set(originClusters.map((item) => item.clusterId))
  const generatedAt = new Date()
  const logoMap = await loadRopCompanyLogoMap(
    candidates.map((candidate) => ({ id: candidate.id, empresaId: candidate.empresaId })),
  )

  const scoredCandidates = candidates
    .map((candidate) => {
      let score = 25
      const positives: string[] = []
      const constraints: string[] = []

      const hasService = candidate.services.length > 0
      if (hasService) {
        score += 30
        positives.push(`Ofrece ${candidate.services[0]!.serviceCatalog.name}.`)
      } else {
        constraints.push('No expone el servicio exacto en su perfil.')
      }

      const capacity = candidate.capacities[0] ?? null
      if (capacity?.status === 'AVAILABLE') {
        score += 20
        positives.push('Reporta capacidad abierta vigente.')
      } else if (capacity?.status === 'LIMITED') {
        score += 10
        positives.push('Reporta capacidad limitada vigente.')
      } else {
        constraints.push('No tiene snapshot reciente de capacidad para este servicio.')
      }

      if (opportunity.locationCity && candidate.city && candidate.city.toLowerCase() === opportunity.locationCity.toLowerCase()) {
        score += 15
        positives.push('Opera en la misma ciudad de la necesidad.')
      } else if (opportunity.locationRegion && candidate.region && candidate.region.toLowerCase() === opportunity.locationRegion.toLowerCase()) {
        score += 8
        positives.push('Comparte región operativa.')
      } else if (opportunity.locationCity) {
        constraints.push('No comparte la ciudad objetivo.')
      }

      const trustScore = candidate.trustScore ? Number(candidate.trustScore.overallScore) : null
      if (trustScore !== null) {
        score += Math.min(15, Math.round(trustScore / 7))
        positives.push(`Mantiene Trust ${trustScore}.`)
      } else {
        constraints.push('Aún no tiene Trust Score visible.')
      }

      if (candidate.verificationStatus === 'VERIFIED') {
        score += 5
        positives.push('Cuenta verificada en la red.')
      } else if (candidate.verificationStatus === 'PENDING') {
        constraints.push('Sigue en verificación pendiente.')
      }

      const sharesCluster = candidate.clusterMemberships.some((membership) => originClusterIds.has(membership.clusterId))
      if (sharesCluster) {
        score += 10
        positives.push('Comparte cluster activo contigo.')
      }

      const normalizedScore = Math.max(0, Math.min(100, score))
      return {
        companyId: candidate.id,
        companyName: candidate.brandName || candidate.legalName,
        logoUrl: logoMap.get(candidate.id) ?? null,
        city: candidate.city || candidate.region || null,
        serviceName: candidate.services[0]?.serviceCatalog.name ?? null,
        trustScore,
        verificationStatus: candidate.verificationStatus,
        capacityStatus: capacity?.status ?? null,
        availabilityLabel: capacity ? formatAvailabilityLabel(capacity.availableFrom, capacity.availableUntil) : null,
        phonePublic: candidate.phonePublic ?? null,
        emailPublic: candidate.emailPublic ?? null,
        score: normalizedScore,
        tier: buildOpportunityTier(normalizedScore),
        positives,
        constraints,
        recommendedAction: buildOpportunityRecommendedAction(normalizedScore),
        invitationStatus: null,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((candidate, index) => ({
      ...candidate,
      rankPosition: index + 1,
    }))

  await prisma.$transaction(async (tx) => {
    await tx.ropOpportunityMatch.deleteMany({ where: { opportunityId: opportunity.id } })

    if (scoredCandidates.length) {
      await tx.ropOpportunityMatch.createMany({
        data: scoredCandidates.map((candidate) => ({
          opportunityId: opportunity.id,
          companyId: candidate.companyId,
          matchScore: candidate.score,
          scoreBreakdownJson: {
            positives: candidate.positives,
            constraints: candidate.constraints,
          },
          rankPosition: candidate.rankPosition,
          decisionStatus: 'NEW',
          generatedAt,
        })),
      })
    }

    await tx.ropOpportunity.update({
      where: { id: opportunity.id },
      data: {
        status: scoredCandidates.length ? 'MATCHING' : 'OPEN',
      },
    })
  })

  return {
    opportunityId: opportunity.id,
    generatedAt: generatedAt.toISOString(),
    candidates: scoredCandidates.map(({ rankPosition, ...candidate }) => candidate),
  }
}

export async function createRopInvitationsForUser(userId: string, opportunityId: string, input: CreateRopInvitationsInput) {
  const { company, opportunity } = await getOwnedRopOpportunityForUser(userId, opportunityId)

  const recipientCompanyIds = Array.from(new Set(input.recipientCompanyIds.map((item) => item.trim()).filter(Boolean)))
  if (!recipientCompanyIds.length) {
    throw new Error('INVALID_RECIPIENT_COMPANY_IDS')
  }

  const validMatchCompanyIds = new Set(opportunity.matches.map((match) => match.companyId))
  const invalidCompanyIds = recipientCompanyIds.filter((companyId) => !validMatchCompanyIds.has(companyId) || companyId === company.id)
  if (invalidCompanyIds.length) {
    throw new Error(`INVALID_RECIPIENT_COMPANY_IDS:${invalidCompanyIds.join(',')}`)
  }

  const expiresAt = input.expiresAt ? normalizeDateInput(input.expiresAt, 'expiresAt') : null
  const internalNoteParts = [
    input.shareBudget ? 'shareBudget=true' : null,
    input.shareAttachments ? 'shareAttachments=true' : null,
  ].filter(Boolean)
  const internalNote = internalNoteParts.length ? internalNoteParts.join(' | ') : null
  const messagePublic = normalizeNullableText(input.messagePublic)

  const existingInvitations = await prisma.ropInvitation.findMany({
    where: {
      opportunityId: opportunity.id,
      recipientCompanyId: { in: recipientCompanyIds },
    },
    select: {
      recipientCompanyId: true,
      status: true,
    },
  })

  const existingMap = new Map(existingInvitations.map((invitation) => [invitation.recipientCompanyId, invitation.status]))
  const recipientCompanies = await prisma.ropCompany.findMany({
    where: { id: { in: recipientCompanyIds } },
    select: { id: true, legalName: true, brandName: true, empresaId: true },
  })

  const companyMap = new Map(recipientCompanies.map((recipient) => [recipient.id, recipient]))
  const recipientsToCreate = recipientCompanyIds.filter((companyId) => !existingMap.has(companyId))

  await prisma.$transaction(async (tx) => {
    if (recipientsToCreate.length) {
      await tx.ropInvitation.createMany({
        data: recipientsToCreate.map((recipientCompanyId) => ({
          opportunityId: opportunity.id,
          senderCompanyId: company.id,
          recipientCompanyId,
          status: 'PENDING',
          messagePublic,
          internalNote,
          expiresAt,
        })),
      })
    }

    const notificationRows = [] as Array<{
      userId: string
      empresaId: string
      title: string
      body: string
      actionUrl: string
      actionLabel: string
    }>

    for (const recipientCompanyId of recipientsToCreate) {
      const recipientCompany = companyMap.get(recipientCompanyId)
      if (!recipientCompany?.empresaId) continue

      const users = await tx.user.findMany({
        where: {
          empresaId: recipientCompany.empresaId,
          OR: [
            { role: 'ADMIN' },
            { sedeMemberships: { some: { role: { in: ['ADMIN', 'MANAGER'] } } } },
          ],
        },
        select: { id: true },
        take: 25,
      })

      for (const user of users) {
        notificationRows.push({
          userId: user.id,
          empresaId: recipientCompany.empresaId,
          title: 'Nueva invitación operativa ROP',
          body: `${company.brandName || company.legalName} te invitó a participar en "${opportunity.title}".`,
          actionUrl: `/dashboard/rop/necesidades/${opportunity.id}`,
          actionLabel: 'Ver invitación',
        })
      }
    }

    if (notificationRows.length) {
      await tx.notification.createMany({
        data: notificationRows,
      })
    }

    if (recipientsToCreate.length) {
      await tx.ropOpportunity.update({
        where: { id: opportunity.id },
        data: { status: 'INVITED' },
      })
    }
  })

  const refreshed = await getRopOpportunityDetailForUser(userId, opportunityId)
  return {
    createdCount: recipientsToCreate.length,
    existingCount: recipientCompanyIds.length - recipientsToCreate.length,
    recommendations: refreshed.recommendations,
  }
}

export async function getRopHomeForUser(userId: string): Promise<RopHomeResponse> {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await getRopCompanyRecord(empresaId)
  const profile = buildProfileResponse(company)

  const [clusterMembership, recommendedCompanies, capacityToday, nearbyCompanies, collaborations] = await Promise.all([
    prisma.ropClusterMembership.findFirst({
      where: { companyId: company.id, status: 'ACTIVE' },
      include: { cluster: true },
      orderBy: [{ membershipScore: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.ropCompany.findMany({
      where: {
        id: { not: company.id },
        archivedAt: null,
        visibilityLevel: { not: 'PRIVATE' },
        ...(company.city ? { city: company.city } : {}),
      },
      include: {
        trustScore: true,
        services: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: { serviceCatalog: true },
        },
      },
      take: 6,
      orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.ropCapacityAvailability.findMany({
      where: {
        companyId: { not: company.id },
        status: { in: ['AVAILABLE', 'LIMITED'] },
        availableUntil: { gte: new Date() },
      },
      include: {
        company: { include: { trustScore: true } },
        serviceCatalog: true,
      },
      take: 6,
      orderBy: [{ availableFrom: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.ropCompany.findMany({
      where: {
        id: { not: company.id },
        archivedAt: null,
        countryCode: company.countryCode,
        ...(company.city ? { city: company.city } : {}),
      },
      include: { trustScore: true },
      take: 6,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ropCollaborationHistory.findMany({
      where: {
        OR: [{ leadCompanyId: company.id }, { partnerCompanyId: company.id }],
        outcomeStatus: 'SUCCESS',
      },
      include: {
        leadCompany: { include: { trustScore: true } },
        partnerCompany: { include: { trustScore: true } },
      },
      take: 12,
      orderBy: { completedAt: 'desc' },
    }),
  ])

  const frequentAlliesMap = new Map<string, RopHomeCard>()
  const logoMap = await loadRopCompanyLogoMap([
    ...recommendedCompanies.map((item) => ({ id: item.id, empresaId: item.empresaId })),
    ...nearbyCompanies.map((item) => ({ id: item.id, empresaId: item.empresaId })),
    ...capacityToday.map((item) => ({ id: item.company.id, empresaId: item.company.empresaId })),
    ...collaborations.flatMap((collaboration) => {
      const ally = collaboration.leadCompanyId === company.id ? collaboration.partnerCompany : collaboration.leadCompany
      return [{ id: ally.id, empresaId: ally.empresaId }]
    }),
  ])
  for (const collaboration of collaborations) {
    const ally = collaboration.leadCompanyId === company.id ? collaboration.partnerCompany : collaboration.leadCompany
    if (frequentAlliesMap.has(ally.id)) continue
    frequentAlliesMap.set(ally.id, {
      id: ally.id,
      kind: 'COMPANY',
      title: ally.brandName || ally.legalName,
      subtitle: ally.city || ally.region || null,
      score: null,
      trustScore: ally.trustScore ? Number(ally.trustScore.overallScore) : null,
      logoUrl: logoMap.get(ally.id) ?? null,
      phonePublic: ally.phonePublic ?? null,
      emailPublic: ally.emailPublic ?? null,
      verificationStatus: ally.verificationStatus,
      coverageScope: null,
      capacityStatus: null,
      availabilityLabel: null,
      reason: 'Ya colaboraron con resultado exitoso dentro de la red.',
      primaryAction: {
        type: 'OPEN_PROFILE',
        label: 'Ver aliado',
      },
    })
  }

  const profileIncomplete = profile.profileCompletionPercent < 70
  const hero: RopHomeResponse['hero'] = profileIncomplete
    ? {
        title: 'Activa tu presencia operativa en la red',
        summary: 'Completa el perfil para que ORDEX ROP pueda recomendarte aliados, oportunidades y capacidad relevante.',
        primaryAction: { type: 'COMPLETE_PROFILE', label: 'Completar perfil' },
        secondaryAction: { type: 'EDIT_PROFILE', label: 'Editar perfil' },
      }
    : {
        title: `Hoy tienes ${recommendedCompanies.length} aliados potenciales y ${capacityToday.length} señales de capacidad activas`,
        summary: 'La red ya puede mostrar empresas compatibles, capacidad disponible y relaciones de confianza alrededor de tu operación.',
        primaryAction: { type: 'VIEW_RECOMMENDATIONS', label: 'Ver recomendaciones' },
        secondaryAction: clusterMembership
          ? { type: 'VIEW_CLUSTER', label: 'Ver cluster' }
          : { type: 'EDIT_PROFILE', label: 'Afinar perfil' },
      }

  return {
    cluster: clusterMembership
      ? {
          clusterId: clusterMembership.clusterId,
          name: clusterMembership.cluster.name,
          reason: 'Asignado por afinidad operativa inicial para acelerar discovery y matching.',
        }
      : null,
    hero,
    rails: [
      {
        key: 'RECOMMENDED_COMPANIES',
        title: 'Empresas recomendadas',
        items: recommendedCompanies.map((item) => ({
          id: item.id,
          kind: 'COMPANY',
          title: item.brandName || item.legalName,
          subtitle: item.services[0]?.serviceCatalog.name || item.city || null,
          score: item.trustScore ? Number(item.trustScore.overallScore) : null,
          trustScore: item.trustScore ? Number(item.trustScore.overallScore) : null,
          logoUrl: logoMap.get(item.id) ?? null,
          phonePublic: item.phonePublic ?? null,
          emailPublic: item.emailPublic ?? null,
          verificationStatus: item.verificationStatus,
          coverageScope: (item.services[0]?.coverageScope ?? null) as RopHomeCard['coverageScope'],
          capacityStatus: null,
          availabilityLabel: null,
          reason: item.city && company.city && item.city === company.city
            ? 'Aparece porque comparte ciudad y ya es visible para la red.'
            : 'Aparece porque está visible y es un candidato inicial para discovery.',
          primaryAction: {
            type: 'OPEN_PROFILE',
            label: 'Ver perfil',
          },
        })),
      },
      {
        key: 'CAPACITY_TODAY',
        title: 'Capacidad disponible hoy',
        items: capacityToday.map((item) => ({
          id: item.id,
          kind: 'CAPACITY',
          title: item.company.brandName || item.company.legalName,
          subtitle: item.serviceCatalog.name,
          score: Number(item.availableQuantity),
          trustScore: item.company.trustScore ? Number(item.company.trustScore.overallScore) : null,
          logoUrl: logoMap.get(item.company.id) ?? null,
          phonePublic: item.company.phonePublic ?? null,
          emailPublic: item.company.emailPublic ?? null,
          verificationStatus: item.company.verificationStatus,
          coverageScope: null,
          capacityStatus: item.status,
          availabilityLabel: formatAvailabilityLabel(item.availableFrom, item.availableUntil),
          reason: `Publicó ${item.status === 'AVAILABLE' ? 'capacidad abierta' : 'capacidad limitada'} para ${item.serviceCatalog.name}.`,
          primaryAction: {
            type: 'VIEW_COMPATIBILITY',
            label: 'Ver compatibilidad',
          },
        })),
      },
      {
        key: 'NEARBY_COMPANIES',
        title: 'Empresas cerca de ti',
        items: nearbyCompanies.map((item) => ({
          id: item.id,
          kind: 'COMPANY',
          title: item.brandName || item.legalName,
          subtitle: item.city || item.region || null,
          score: null,
          trustScore: item.trustScore ? Number(item.trustScore.overallScore) : null,
          logoUrl: logoMap.get(item.id) ?? null,
          phonePublic: item.phonePublic ?? null,
          emailPublic: item.emailPublic ?? null,
          verificationStatus: item.verificationStatus,
          coverageScope: null,
          capacityStatus: null,
          availabilityLabel: null,
          reason: 'Candidato cercano para reducir fricción logística y tiempos de coordinación.',
          primaryAction: {
            type: 'OPEN_PROFILE',
            label: 'Abrir perfil',
          },
        })),
      },
      {
        key: 'FREQUENT_ALLIES',
        title: 'Aliados frecuentes',
        items: Array.from(frequentAlliesMap.values()).slice(0, 6),
      },
    ],
  }
}

export async function listRopDiscoveryCompaniesForUser(userId: string, filters: RopDiscoveryFilters) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await getRopCompanyRecord(empresaId)

  const normalizedSearch = filters.search?.trim() || ''
  const minTrustScore = typeof filters.minTrustScore === 'number' && Number.isFinite(filters.minTrustScore)
    ? filters.minTrustScore
    : null

  const companies = await prisma.ropCompany.findMany({
    where: {
      id: { not: company.id },
      archivedAt: null,
      visibilityLevel: { not: 'PRIVATE' },
      ...(filters.city ? { city: { equals: filters.city.trim(), mode: 'insensitive' } } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { legalName: { contains: normalizedSearch, mode: 'insensitive' } },
              { brandName: { contains: normalizedSearch, mode: 'insensitive' } },
              { descriptionPublic: { contains: normalizedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(minTrustScore !== null ? { trustScore: { overallScore: { gte: minTrustScore } } } : {}),
      ...(filters.clusterId ? { clusterMemberships: { some: { clusterId: filters.clusterId, status: 'ACTIVE' } } } : {}),
      ...(filters.serviceCatalogId
        ? { services: { some: { serviceCatalogId: filters.serviceCatalogId.trim() } } }
        : {}),
      ...(filters.coverageScope
        ? { services: { some: { coverageScope: filters.coverageScope } } }
        : {}),
      ...(filters.availabilityStatus
        ? { capacities: { some: { status: filters.availabilityStatus } } }
        : {}),
    },
    include: {
      trustScore: true,
      services: {
        where: {
          ...(filters.serviceCatalogId ? { serviceCatalogId: filters.serviceCatalogId.trim() } : {}),
          ...(filters.coverageScope ? { coverageScope: filters.coverageScope } : {}),
        },
        take: 3,
        orderBy: { createdAt: 'asc' },
        include: {
          serviceCatalog: true,
        },
      },
      capacities: {
        where: {
          availableUntil: { gte: new Date() },
          ...(filters.availabilityStatus ? { status: filters.availabilityStatus } : {}),
        },
        take: 1,
        orderBy: [{ availableFrom: 'asc' }, { createdAt: 'desc' }],
      },
    },
    take: 24,
    orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
  })

  const logoMap = await loadRopCompanyLogoMap(
    companies.map((item) => ({ id: item.id, empresaId: item.empresaId })),
  )

  return companies.map((item) => {
    const primaryService = item.services[0] ?? null
    const capacity = item.capacities[0] ?? null
    const reasons = [
      primaryService?.serviceCatalog?.name ? `ofrece ${primaryService.serviceCatalog.name}` : null,
      item.city && company.city && item.city === company.city ? 'opera en tu misma ciudad' : null,
      capacity?.status === 'AVAILABLE' ? 'tiene capacidad abierta ahora' : capacity?.status === 'LIMITED' ? 'reporta capacidad limitada vigente' : null,
      item.trustScore ? `mantiene Trust ${Number(item.trustScore.overallScore)}` : null,
    ].filter(Boolean)

    return {
      companyId: item.id,
      title: item.brandName || item.legalName,
      subtitle: item.descriptionPublic || null,
      logoUrl: logoMap.get(item.id) ?? null,
      city: item.city || null,
      region: item.region || null,
      coverageScope: (primaryService?.coverageScope ?? null) as RopDiscoveryCompany['coverageScope'],
      trustScore: item.trustScore ? Number(item.trustScore.overallScore) : null,
      verificationStatus: item.verificationStatus,
      capacityStatus: capacity?.status ?? null,
      availableQuantity: capacity ? Number(capacity.availableQuantity) : null,
      availabilityLabel: capacity ? formatAvailabilityLabel(capacity.availableFrom, capacity.availableUntil) : null,
      phonePublic: item.phonePublic ?? null,
      emailPublic: item.emailPublic ?? null,
      serviceName: primaryService?.serviceCatalog.name ?? null,
      serviceCatalogId: primaryService?.serviceCatalogId ?? null,
      reason: reasons.length ? `Aparece porque ${reasons.join(', ')}.` : 'Aparece como candidato inicial para ampliar tu red operativa.',
    } satisfies RopDiscoveryCompany
  })
}

export async function createRopRatingForUser(userId: string, collaborationId: string, input: CreateRopRatingInput) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const raterCompany = await ensureRopCompanyForEmpresa(empresaId)
  const collaboration = await prisma.ropCollaborationHistory.findUnique({
    where: { id: collaborationId },
    select: {
      id: true,
      leadCompanyId: true,
      partnerCompanyId: true,
      completedAt: true,
      outcomeStatus: true,
    },
  })

  if (!collaboration) throw new Error('ROP_COLLABORATION_NOT_FOUND')
  if (!collaboration.completedAt) throw new Error('ROP_COLLABORATION_NOT_COMPLETED')
  if (collaboration.outcomeStatus === 'CANCELLED') throw new Error('ROP_COLLABORATION_NOT_RATEABLE')

  const involvedCompanyIds = [collaboration.leadCompanyId, collaboration.partnerCompanyId]
  if (!involvedCompanyIds.includes(raterCompany.id)) throw new Error('ROP_COLLABORATION_FORBIDDEN')
  if (collaboration.leadCompanyId === collaboration.partnerCompanyId) throw new Error('ROP_SELF_RATING_NOT_ALLOWED')

  const ratedCompanyId = collaboration.leadCompanyId === raterCompany.id
    ? collaboration.partnerCompanyId
    : collaboration.leadCompanyId

  if (ratedCompanyId === raterCompany.id) throw new Error('ROP_SELF_RATING_NOT_ALLOWED')

  const qualityScore = clampFivePointScore(input.qualityScore, 'qualityScore')
  const timelinessScore = clampFivePointScore(input.timelinessScore, 'timelinessScore')
  const communicationScore = clampFivePointScore(input.communicationScore, 'communicationScore')
  const overallScore = computeOverallRatingScore({ qualityScore, timelinessScore, communicationScore })

  const rating = await prisma.ropRating.upsert({
    where: {
      collaborationHistoryId_raterCompanyId_ratedCompanyId: {
        collaborationHistoryId: collaboration.id,
        raterCompanyId: raterCompany.id,
        ratedCompanyId,
      },
    },
    create: {
      collaborationHistoryId: collaboration.id,
      raterCompanyId: raterCompany.id,
      ratedCompanyId,
      qualityScore,
      timelinessScore,
      communicationScore,
      overallScore,
      commentPublic: normalizeNullableText(input.commentPublic),
      disputeFlag: false,
      moderationStatus: 'PUBLISHED',
    },
    update: {
      qualityScore,
      timelinessScore,
      communicationScore,
      overallScore,
      commentPublic: normalizeNullableText(input.commentPublic),
      disputeFlag: false,
      moderationStatus: 'PUBLISHED',
    },
    select: {
      id: true,
      ratedCompanyId: true,
      disputeFlag: true,
      moderationStatus: true,
      overallScore: true,
    },
  })

  const trustImpact = await recomputeRopTrustScoreForCompany({
    companyId: rating.ratedCompanyId,
    reason: 'RATING_UPDATED',
    sourceRef: formatTrustSourceRef('rating', rating.id),
  })

  return {
    ratingId: rating.id,
    disputeFlag: rating.disputeFlag,
    moderationStatus: rating.moderationStatus,
    overallScore: Number(rating.overallScore),
    trustImpact: trustImpact.summary,
  }
}

export async function disputeRopRatingForUser(userId: string, ratingId: string, input: DisputeRopRatingInput) {
  const empresaId = await requireEmpresaIdForUser(userId)
  const company = await ensureRopCompanyForEmpresa(empresaId)
  const rating = await prisma.ropRating.findUnique({
    where: { id: ratingId },
    select: {
      id: true,
      ratedCompanyId: true,
      disputeFlag: true,
      moderationStatus: true,
    },
  })

  if (!rating) throw new Error('ROP_RATING_NOT_FOUND')
  if (rating.ratedCompanyId !== company.id) throw new Error('ROP_RATING_FORBIDDEN')

  const updated = await prisma.ropRating.update({
    where: { id: rating.id },
    data: {
      disputeFlag: true,
      moderationStatus: 'HIDDEN',
      commentPublic: undefined,
    },
    select: {
      id: true,
      ratedCompanyId: true,
      disputeFlag: true,
      moderationStatus: true,
    },
  })

  const trustImpact = await recomputeRopTrustScoreForCompany({
    companyId: updated.ratedCompanyId,
    reason: 'RATING_DISPUTED',
    sourceRef: formatTrustSourceRef('dispute', updated.id),
  })

  return {
    ratingId: updated.id,
    disputeFlag: updated.disputeFlag,
    moderationStatus: updated.moderationStatus,
    disputeReason: normalizeNullableText(input.reason),
    trustImpact: trustImpact.summary,
  }
}

export async function moderateRopRating(args: {
  ratingId: string
  moderationStatus: 'PUBLISHED' | 'HIDDEN'
  note?: string | null
}) {
  const moderationStatus = args.moderationStatus as RopModerationStatus
  const rating = await prisma.ropRating.findUnique({
    where: { id: args.ratingId },
    select: { id: true, ratedCompanyId: true, disputeFlag: true, moderationStatus: true },
  })

  if (!rating) throw new Error('ROP_RATING_NOT_FOUND')

  const updated = await prisma.ropRating.update({
    where: { id: rating.id },
    data: {
      moderationStatus,
      disputeFlag: moderationStatus === 'HIDDEN' ? true : rating.disputeFlag,
    },
    select: { id: true, ratedCompanyId: true, disputeFlag: true, moderationStatus: true },
  })

  const trustImpact = await recomputeRopTrustScoreForCompany({
    companyId: updated.ratedCompanyId,
    reason: 'RATING_MODERATED',
    sourceRef: formatTrustSourceRef('moderation', updated.id),
  })

  return {
    ratingId: updated.id,
    disputeFlag: updated.disputeFlag,
    moderationStatus: updated.moderationStatus,
    moderationNote: normalizeNullableText(args.note),
    trustImpact: trustImpact.summary,
  }
}