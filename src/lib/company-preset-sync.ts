import { RbacGrantSource, RbacScopeType, type ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ALL_MODULE_KEYS, saveEmpresaModuleOverride } from '@/lib/plan-modules'
import type { BusinessType } from '@/lib/company-onboarding'
import { RBAC_V2_CAPABILITY_CATALOG } from '@/lib/rbac-v2-catalog'
import { DASHBOARD_PERMISSION_RULES } from '@/lib/dashboard-permission-catalog'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import { getEnabledModulesForEmpresa } from '@/lib/plan-modules'

const PRESET_VERTICAL_KEYS = ['ODONTOLOGIA', 'RESTAURANTE', 'DOTACIONES'] as const
const PRESET_GRANT_NOTE_PREFIX = 'COMPANY_PRESET_SYNC'
const DEFAULT_ADMIN_GRANT_NOTE_PREFIX = 'COMPANY_DEFAULT_ADMIN'

type PresetVerticalKey = (typeof PRESET_VERTICAL_KEYS)[number]

function getVerticalActions(vertical: PresetVerticalKey) {
  return RBAC_V2_CAPABILITY_CATALOG.find((item) => item.domain === 'VERTICALES' && item.subdomain === vertical)?.actions ?? ['READ']
}

function businessTypeToVerticalKey(businessType: BusinessType | null | undefined): PresetVerticalKey | null {
  if (!businessType) return null
  return PRESET_VERTICAL_KEYS.includes(businessType as PresetVerticalKey) ? (businessType as PresetVerticalKey) : null
}

function getCapabilityActions(domain: string, subdomain: string) {
  return RBAC_V2_CAPABILITY_CATALOG.find((item) => item.domain === domain && item.subdomain === subdomain)?.actions ?? ['READ']
}

async function syncVerticalGrants(args: {
  empresaId: string
  vertical: PresetVerticalKey
  enabled: boolean
  grantedByUserId: string | null
}) {
  const actions = getVerticalActions(args.vertical)
  const notePrefix = `${PRESET_GRANT_NOTE_PREFIX}:${args.vertical}`

  await prisma.capabilityEntitlement.deleteMany({
    where: {
      empresaId: args.empresaId,
      domain: 'VERTICALES',
      subdomain: args.vertical,
      action: { in: actions },
      enabled: args.enabled,
    },
  }).catch(() => null)

  await prisma.$transaction(
    actions.map((action) =>
      prisma.capabilityEntitlement.upsert({
        where: {
          empresaId_domain_subdomain_action: {
            empresaId: args.empresaId,
            domain: 'VERTICALES',
            subdomain: args.vertical,
            action,
          },
        },
        create: {
          empresaId: args.empresaId,
          domain: 'VERTICALES',
          subdomain: args.vertical,
          action,
          enabled: args.enabled,
        },
        update: { enabled: args.enabled },
      })
    )
  )

  await prisma.userCapabilityGrant.deleteMany({
    where: {
      empresaId: args.empresaId,
      domain: 'VERTICALES',
      subdomain: args.vertical,
      scopeType: RbacScopeType.EMPRESA,
      scopeValue: args.empresaId,
      source: RbacGrantSource.SYSTEM,
      notes: { startsWith: notePrefix },
    },
  })

  if (!args.enabled) return

  const users = await prisma.user.findMany({
    where: { empresaId: args.empresaId },
    select: { id: true },
  })

  if (!users.length) return

  await prisma.userCapabilityGrant.createMany({
    data: users.flatMap((user) =>
      actions.map((action) => ({
        userId: user.id,
        empresaId: args.empresaId,
        domain: 'VERTICALES',
        subdomain: args.vertical,
        action,
        scopeType: RbacScopeType.EMPRESA,
        scopeValue: args.empresaId,
        allowed: true,
        source: RbacGrantSource.SYSTEM,
        grantedByUserId: args.grantedByUserId,
        notes: `${notePrefix}:AUTO_GRANTED`,
        metadata: { source: PRESET_GRANT_NOTE_PREFIX, vertical: args.vertical },
      }))
    ),
  })
}

export async function syncEnabledVerticalGrantsForUser(args: {
  empresaId: string
  userId: string
  grantedByUserId: string | null
}) {
  const entitlementRows = await prisma.capabilityEntitlement.findMany({
    where: {
      empresaId: args.empresaId,
      domain: 'VERTICALES',
      subdomain: { in: [...PRESET_VERTICAL_KEYS] },
      enabled: true,
    },
    select: { subdomain: true, action: true },
  })

  const enabledVerticals = PRESET_VERTICAL_KEYS.filter((vertical) => {
    const expectedActions = getVerticalActions(vertical)
    const enabledActions = new Set(
      entitlementRows.filter((row) => row.subdomain === vertical).map((row) => row.action)
    )
    return expectedActions.every((action) => enabledActions.has(action))
  })

  await prisma.userCapabilityGrant.deleteMany({
    where: {
      empresaId: args.empresaId,
      userId: args.userId,
      domain: 'VERTICALES',
      subdomain: { in: [...PRESET_VERTICAL_KEYS] },
      scopeType: RbacScopeType.EMPRESA,
      scopeValue: args.empresaId,
      source: RbacGrantSource.SYSTEM,
    },
  })

  if (!enabledVerticals.length) return []

  await prisma.userCapabilityGrant.createMany({
    data: enabledVerticals.flatMap((vertical) =>
      getVerticalActions(vertical).map((action) => ({
        userId: args.userId,
        empresaId: args.empresaId,
        domain: 'VERTICALES',
        subdomain: vertical,
        action,
        scopeType: RbacScopeType.EMPRESA,
        scopeValue: args.empresaId,
        allowed: true,
        source: RbacGrantSource.SYSTEM,
        grantedByUserId: args.grantedByUserId,
        notes: `${PRESET_GRANT_NOTE_PREFIX}:USER_SYNC:${vertical}`,
        metadata: { source: PRESET_GRANT_NOTE_PREFIX, vertical, mode: 'USER_SYNC' },
      }))
    ),
  })

  return enabledVerticals
}

export async function provisionDefaultAdminAccessForNewUser(args: {
  empresaId: string
  userId: string
  grantedByUserId: string | null
}) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: args.empresaId },
    select: {
      nit: true,
      registrationCodeHash: true,
      planTier: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
    },
  })

  if (!empresa) return []

  const planTier = resolveEffectivePlanTier(empresa, new Date())
  const enabledModules = await getEnabledModulesForEmpresa({ empresaId: args.empresaId, planTier })
  const enabledModuleSet = new Set(enabledModules)

  const directGrantCapabilities = DASHBOARD_PERMISSION_RULES
    .filter((rule) => rule.directGrantOnly && enabledModuleSet.has(rule.moduleKey))
    .flatMap((rule) => rule.capabilities.map((capability) => ({
      domain: capability.domain,
      subdomain: capability.subdomain,
      actions: getCapabilityActions(capability.domain, capability.subdomain),
    })))

  const capabilityEntitlements = await prisma.capabilityEntitlement.findMany({
    where: {
      empresaId: args.empresaId,
      enabled: true,
      OR: directGrantCapabilities.map((capability) => ({
        domain: capability.domain,
        subdomain: capability.subdomain,
        action: { in: capability.actions },
      })),
    },
    select: { domain: true, subdomain: true, action: true },
  })

  const enabledCapabilityKeys = new Set(
    capabilityEntitlements.map((item) => `${item.domain}.${item.subdomain}.${item.action}`)
  )

  const directGrantRows = directGrantCapabilities.flatMap((capability) => {
    const isVertical = capability.domain === 'VERTICALES'
    const allowedActions = isVertical
      ? capability.actions.filter((action) => enabledCapabilityKeys.has(`${capability.domain}.${capability.subdomain}.${action}`))
      : capability.actions

    return allowedActions.map((action) => ({
      userId: args.userId,
      empresaId: args.empresaId,
      domain: capability.domain,
      subdomain: capability.subdomain,
      action,
      scopeType: RbacScopeType.EMPRESA,
      scopeValue: args.empresaId,
      allowed: true,
      source: RbacGrantSource.DIRECT,
      grantedByUserId: args.grantedByUserId,
      notes: `${DEFAULT_ADMIN_GRANT_NOTE_PREFIX}:${capability.domain}.${capability.subdomain}`,
      metadata: { source: DEFAULT_ADMIN_GRANT_NOTE_PREFIX, domain: capability.domain, subdomain: capability.subdomain },
    }))
  })

  await prisma.$transaction(async (tx) => {
    const sedes = await tx.sede.findMany({ where: { empresaId: args.empresaId }, select: { id: true } })
    const sedeIds = sedes.map((sede) => sede.id)

    await tx.userGlobalAccess.upsert({
      where: { userId: args.userId },
      create: { userId: args.userId, empresaId: args.empresaId, level: 'ADMIN' },
      update: { empresaId: args.empresaId, level: 'ADMIN' },
    })

    for (const sede of sedes) {
      await tx.sedeMembership.upsert({
        where: { sedeId_userId: { sedeId: sede.id, userId: args.userId } },
        create: { sedeId: sede.id, userId: args.userId, role: 'ADMIN' },
        update: { role: 'ADMIN' },
      })
    }

    if (sedeIds.length) {
      await tx.userModuleAccess.deleteMany({
        where: {
          userId: args.userId,
          sedeId: { in: sedeIds },
          module: { in: ALL_MODULE_KEYS },
        },
      })

      await tx.userModuleAccess.createMany({
        data: sedeIds.flatMap((sedeId) =>
          ALL_MODULE_KEYS.map((moduleKey) => ({
            sedeId,
            userId: args.userId,
            module: moduleKey,
            level: enabledModuleSet.has(moduleKey) ? 'ADMIN' : 'NONE',
          }))
        ),
      })
    }

    await tx.userCapabilityGrant.deleteMany({
      where: {
        empresaId: args.empresaId,
        userId: args.userId,
        scopeType: RbacScopeType.EMPRESA,
        scopeValue: args.empresaId,
        source: RbacGrantSource.DIRECT,
        notes: { startsWith: DEFAULT_ADMIN_GRANT_NOTE_PREFIX },
      },
    })

    if (directGrantRows.length) {
      await tx.userCapabilityGrant.createMany({ data: directGrantRows })
    }
  })

  return enabledModules
}

export async function ensureDefaultAdminAccessForUserIfMissing(args: {
  empresaId: string
  userId: string
}) {
  const [globalAccess, memberships, moduleAccessCount, profileAssignmentCount] = await Promise.all([
    prisma.userGlobalAccess.findFirst({
      where: { empresaId: args.empresaId, userId: args.userId },
      select: { level: true },
    }),
    prisma.sedeMembership.findMany({
      where: { userId: args.userId, sede: { empresaId: args.empresaId } },
      select: { role: true },
    }),
    prisma.userModuleAccess.count({
      where: { userId: args.userId, sede: { empresaId: args.empresaId } },
    }),
    prisma.permissionProfileAssignment.count({
      where: { empresaId: args.empresaId, userId: args.userId },
    }),
  ])

  const globalLevel = globalAccess?.level ?? 'NONE'
  const hasOnlyReaderMemberships = memberships.length > 0 && memberships.every((membership) => membership.role === 'READER')

  if (globalLevel !== 'NONE') return false
  if (!hasOnlyReaderMemberships) return false
  if (moduleAccessCount > 0) return false
  if (profileAssignmentCount > 0) return false

  await provisionDefaultAdminAccessForNewUser({
    empresaId: args.empresaId,
    userId: args.userId,
    grantedByUserId: args.userId,
  })

  return true
}

export async function syncCompanyPresetAccess(args: {
  empresaId: string
  businessType: BusinessType | null | undefined
  modules: ModuleKey[]
  grantedByUserId: string | null
}) {
  const selectedModules = new Set(args.modules)

  await Promise.all(
    ALL_MODULE_KEYS.map((moduleKey) =>
      saveEmpresaModuleOverride({
        empresaId: args.empresaId,
        module: moduleKey,
        enabled: selectedModules.has(moduleKey),
      })
    )
  )

  const activeVertical = businessTypeToVerticalKey(args.businessType)

  for (const vertical of PRESET_VERTICAL_KEYS) {
    await syncVerticalGrants({
      empresaId: args.empresaId,
      vertical,
      enabled: vertical === activeVertical,
      grantedByUserId: args.grantedByUserId,
    })
  }
}