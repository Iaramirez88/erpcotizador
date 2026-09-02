import { RbacGrantSource, RbacScopeType, type ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ALL_MODULE_KEYS, saveEmpresaModuleOverride } from '@/lib/plan-modules'
import type { BusinessType } from '@/lib/company-onboarding'
import { RBAC_V2_CAPABILITY_CATALOG } from '@/lib/rbac-v2-catalog'

const PRESET_VERTICAL_KEYS = ['ODONTOLOGIA', 'RESTAURANTE', 'DOTACIONES'] as const
const PRESET_GRANT_NOTE_PREFIX = 'COMPANY_PRESET_SYNC'

type PresetVerticalKey = (typeof PRESET_VERTICAL_KEYS)[number]

function getVerticalActions(vertical: PresetVerticalKey) {
  return RBAC_V2_CAPABILITY_CATALOG.find((item) => item.domain === 'VERTICALES' && item.subdomain === vertical)?.actions ?? ['READ']
}

function businessTypeToVerticalKey(businessType: BusinessType | null | undefined): PresetVerticalKey | null {
  if (!businessType) return null
  return PRESET_VERTICAL_KEYS.includes(businessType as PresetVerticalKey) ? (businessType as PresetVerticalKey) : null
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