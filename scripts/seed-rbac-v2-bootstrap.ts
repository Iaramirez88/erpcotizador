import { PrismaClient } from '.prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { AccessLevel, ModuleKey, type PlanTier, RbacGrantSource, RbacScopeType, SedeRole, type Prisma } from '@prisma/client'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import {
  LEGACY_MODULE_TO_RBAC_V2,
  RBAC_V2_CAPABILITY_CATALOG,
  buildRbacV2CapabilityId,
  type RbacV2CapabilityAction,
  type RbacV2Scope,
} from '../src/lib/rbac-v2-catalog'
import { resolveEffectivePlanTier } from '../src/lib/plan-access'

dotenv.config()

const DEFAULT_ENABLED_MODULES: Record<PlanTier, ModuleKey[]> = {
  CRM: ['DASHBOARD', 'CRM', 'NOTIFICACIONES', 'CONFIG'],
  BASIC: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'REMISIONES', 'ORDENES', 'ESCANEOS', 'REPORTES', 'NOTIFICACIONES', 'CONFIG'],
  MEDIO: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'INVENTARIO', 'REMISIONES', 'POS', 'PROVEEDORES', 'COMPRAS', 'ORDENES', 'ESCANEOS', 'REPORTES', 'NOTIFICACIONES', 'CONFIG'],
  INTERMEDIO: ['DASHBOARD', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'MATERIALES', 'INVENTARIO', 'REMISIONES', 'POS', 'PROVEEDORES', 'COMPRAS', 'ORDENES', 'ESCANEOS', 'REPORTES', 'CONTABILIDAD', 'NOTIFICACIONES', 'CONFIG'],
  FULL: Object.values(ModuleKey),
}

type CliOptions = {
  empresaId: string | null
  dryRun: boolean
}

type EmpresaSeedTarget = {
  id: string
  nombre: string
  nit: string
  registrationCodeHash: string | null
  planTier: PlanTier
  planValidUntil: Date | null
  trialTier: PlanTier | null
  trialStartedAt: Date | null
  trialValidUntil: Date | null
}

type LegacyUserShape = {
  id: string
  email: string | null
  globalAccess: { level: AccessLevel } | null
  sedeMemberships: Array<{ sedeId: string; role: SedeRole; createdAt: Date }>
  moduleAccess: Array<{ sedeId: string; module: ModuleKey; level: AccessLevel }>
}

type GrantSeedRow = {
  userId: string
  empresaId: string
  domain: string
  subdomain: string
  action: string
  scopeType: RbacScopeType
  scopeValue: string | null
  allowed: boolean
  source: RbacGrantSource
  grantedByUserId: string | null
  notes: string
  metadata: Prisma.InputJsonObject
}

type ExpandedCapability = {
  domain: string
  subdomain: string
  action: RbacV2CapabilityAction
  recommendedScopes: RbacV2Scope[]
  id: string
}

function parseCliArgs(argv: string[]): CliOptions {
  let empresaId: string | null = null
  let dryRun = false

  for (const rawArg of argv) {
    const arg = rawArg.trim()
    if (!arg) continue

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg.startsWith('--empresa=')) {
      empresaId = arg.slice('--empresa='.length).trim() || null
      continue
    }

    if (arg.startsWith('--empresaId=')) {
      empresaId = arg.slice('--empresaId='.length).trim() || null
    }
  }

  return { empresaId, dryRun }
}

function sedeRoleToBaseAccess(role: SedeRole): AccessLevel {
  switch (role) {
    case 'ADMIN':
      return 'ADMIN'
    case 'MANAGER':
      return 'WRITE'
    case 'MEMBER':
      return 'WRITE'
    case 'READER':
    default:
      return 'READ'
  }
}

function capabilityActionToLegacyAccessLevel(action: RbacV2CapabilityAction): AccessLevel {
  switch (action) {
    case 'READ':
    case 'EXPORT':
      return 'READ'
    case 'CREATE':
    case 'UPDATE':
    case 'ASSIGN':
    case 'EXECUTE':
    case 'CLOSE':
      return 'WRITE'
    case 'DELETE':
    case 'APPROVE':
    case 'AUDIT':
    case 'CONFIGURE':
      return 'ADMIN'
    default:
      return 'READ'
  }
}

function hasAccessForAction(level: AccessLevel, action: RbacV2CapabilityAction): boolean {
  const order: Record<AccessLevel, number> = {
    NONE: 0,
    READ: 1,
    WRITE: 2,
    ADMIN: 3,
  }

  return order[level] >= order[capabilityActionToLegacyAccessLevel(action)]
}

function buildGrantKey(row: Pick<GrantSeedRow, 'userId' | 'domain' | 'subdomain' | 'action' | 'scopeType' | 'scopeValue'>) {
  return [row.userId, row.domain, row.subdomain, row.action, row.scopeType, row.scopeValue ?? ''].join('::')
}

async function getEnabledModulesForEmpresa(prisma: PrismaClient, empresa: EmpresaSeedTarget): Promise<{ effectivePlanTier: PlanTier; enabledModules: ModuleKey[] }> {
  const effectivePlanTier = resolveEffectivePlanTier(
    {
      nit: empresa.nit,
      registrationCodeHash: empresa.registrationCodeHash,
      planTier: empresa.planTier,
      planValidUntil: empresa.planValidUntil,
      trialTier: empresa.trialTier,
      trialStartedAt: empresa.trialStartedAt,
      trialValidUntil: empresa.trialValidUntil,
    },
    new Date(),
  )

  const [planRows, overrideRows] = await Promise.all([
    prisma.planModuleSetting.findMany({
      where: { planTier: effectivePlanTier, enabled: true },
      select: { module: true },
    }).catch(() => []),
    prisma.empresaModuleOverride.findMany({
      where: { empresaId: empresa.id },
      select: { module: true, enabled: true },
    }).catch(() => []),
  ])

  const enabled = new Set<ModuleKey>(planRows.length ? planRows.map((row) => row.module) : (DEFAULT_ENABLED_MODULES[effectivePlanTier] ?? Object.values(ModuleKey)))

  for (const row of overrideRows) {
    if (row.enabled) enabled.add(row.module)
    else enabled.delete(row.module)
  }

  return {
    effectivePlanTier,
    enabledModules: [...enabled],
  }
}

function expandCapabilitiesForModule(moduleKey: ModuleKey): ExpandedCapability[] {
  const mapping = LEGACY_MODULE_TO_RBAC_V2.find((item) => item.moduleKey === moduleKey)
  if (!mapping) return []

  return RBAC_V2_CAPABILITY_CATALOG.flatMap((capability) => {
    const matches = mapping.targets.some(
      (target) => target.domain === capability.domain && target.subdomains.includes(capability.subdomain)
    )
    if (!matches) return []

    return capability.actions.map((action) => ({
      domain: capability.domain,
      subdomain: capability.subdomain,
      action,
      recommendedScopes: capability.recommendedScopes,
      id: buildRbacV2CapabilityId({
        domain: capability.domain,
        subdomain: capability.subdomain,
        action,
      }),
    }))
  })
}

function buildEnabledCapabilitySources(enabledModules: ModuleKey[]) {
  const capabilitySources = new Map<string, Set<ModuleKey>>()

  for (const moduleKey of enabledModules) {
    for (const capability of expandCapabilitiesForModule(moduleKey)) {
      const existing = capabilitySources.get(capability.id) ?? new Set<ModuleKey>()
      existing.add(moduleKey)
      capabilitySources.set(capability.id, existing)
    }
  }

  return capabilitySources
}

function getEffectiveModuleAccessForSede(args: {
  user: LegacyUserShape
  sedeId: string
  module: ModuleKey
}): AccessLevel {
  const membership = args.user.sedeMemberships.find((item) => item.sedeId === args.sedeId)
  const globalBase = args.user.globalAccess?.level ?? 'NONE'
  const base = membership ? sedeRoleToBaseAccess(membership.role) : globalBase
  const explicit = args.user.moduleAccess.find((item) => item.sedeId === args.sedeId && item.module === args.module)

  return explicit?.level ?? base
}

function hasRecommendedScope(scopes: RbacV2Scope[], scope: RbacV2Scope) {
  return scopes.includes(scope)
}

async function seedEmpresa(prisma: PrismaClient, empresa: EmpresaSeedTarget, dryRun: boolean) {
  const { effectivePlanTier, enabledModules } = await getEnabledModulesForEmpresa(prisma, empresa)
  const enabledCapabilitySources = buildEnabledCapabilitySources(enabledModules)
  const enabledCapabilityIds = new Set(enabledCapabilitySources.keys())
  const enabledDomains = new Set<string>()

  for (const capabilityId of enabledCapabilityIds) {
    const [domain] = capabilityId.split('.')
    if (domain) enabledDomains.add(domain)
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { empresaId: empresa.id },
        { globalAccess: { is: { empresaId: empresa.id } } },
        { sedeMemberships: { some: { sede: { empresaId: empresa.id } } } },
      ],
    },
    select: {
      id: true,
      email: true,
      globalAccess: { select: { level: true } },
      sedeMemberships: {
        where: { sede: { empresaId: empresa.id } },
        orderBy: { createdAt: 'asc' },
        select: { sedeId: true, role: true, createdAt: true },
      },
      moduleAccess: {
        where: { sede: { empresaId: empresa.id } },
        select: { sedeId: true, module: true, level: true },
      },
    },
    orderBy: { email: 'asc' },
  })

  const grantsByKey = new Map<string, GrantSeedRow>()

  for (const user of users) {
    const activeMembership = user.sedeMemberships[0] ?? null
    const globalBase = user.globalAccess?.level ?? 'NONE'

    for (const moduleKey of enabledModules) {
      for (const capability of expandCapabilitiesForModule(moduleKey)) {
        if (!enabledCapabilityIds.has(capability.id)) continue

        if (hasRecommendedScope(capability.recommendedScopes, 'SEDE')) {
          for (const membership of user.sedeMemberships) {
            const accessLevel = getEffectiveModuleAccessForSede({
              user,
              sedeId: membership.sedeId,
              module: moduleKey,
            })
            if (!hasAccessForAction(accessLevel, capability.action)) continue

            const row: GrantSeedRow = {
              userId: user.id,
              empresaId: empresa.id,
              domain: capability.domain,
              subdomain: capability.subdomain,
              action: capability.action,
              scopeType: RbacScopeType.SEDE,
              scopeValue: membership.sedeId,
              allowed: true,
              source: RbacGrantSource.MIGRATION,
              grantedByUserId: null,
              notes: 'Bootstrap inicial RBAC v2 desde accesos legacy por sede.',
              metadata: {
                sourceModule: moduleKey,
                accessLevel,
                seedVersion: 'rbac-v2-bootstrap-1',
              },
            }
            grantsByKey.set(buildGrantKey(row), row)
          }
        }

        if (hasRecommendedScope(capability.recommendedScopes, 'EMPRESA')) {
          const activeLevel = activeMembership
            ? getEffectiveModuleAccessForSede({ user, sedeId: activeMembership.sedeId, module: moduleKey })
            : globalBase

          if (!hasAccessForAction(activeLevel, capability.action)) continue

          const row: GrantSeedRow = {
            userId: user.id,
            empresaId: empresa.id,
            domain: capability.domain,
            subdomain: capability.subdomain,
            action: capability.action,
            scopeType: RbacScopeType.EMPRESA,
            scopeValue: empresa.id,
            allowed: true,
            source: RbacGrantSource.MIGRATION,
            grantedByUserId: null,
            notes: 'Bootstrap inicial RBAC v2 desde sede activa legacy.',
            metadata: {
              sourceModule: moduleKey,
              accessLevel: activeLevel,
              activeSedeId: activeMembership?.sedeId ?? null,
              seedVersion: 'rbac-v2-bootstrap-1',
            },
          }
          grantsByKey.set(buildGrantKey(row), row)
        }
      }
    }
  }

  const capabilityRows = RBAC_V2_CAPABILITY_CATALOG.flatMap((capability) =>
    capability.actions.map((action) => {
      const capabilityId = buildRbacV2CapabilityId({
        domain: capability.domain,
        subdomain: capability.subdomain,
        action,
      })

      return {
        domain: capability.domain,
        subdomain: capability.subdomain,
        action,
        enabled: enabledCapabilityIds.has(capabilityId),
        metadata: {
          source: 'legacy-bootstrap',
          recommendedScopes: capability.recommendedScopes,
          sourceModules: [...(enabledCapabilitySources.get(capabilityId) ?? new Set<ModuleKey>())],
        },
      }
    })
  )

  const domainRows = [...new Set(RBAC_V2_CAPABILITY_CATALOG.map((item) => item.domain))].map((domain) => ({
    domain,
    enabled: enabledDomains.has(domain),
    metadata: {
      source: 'legacy-bootstrap',
      enabledModules: enabledModules.filter((moduleKey) =>
        LEGACY_MODULE_TO_RBAC_V2.some(
          (mapping) => mapping.moduleKey === moduleKey && mapping.targets.some((target) => target.domain === domain)
        )
      ),
    },
  }))

  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      for (const row of domainRows) {
        await tx.domainEntitlement.upsert({
          where: { empresaId_domain: { empresaId: empresa.id, domain: row.domain } },
          create: {
            empresaId: empresa.id,
            domain: row.domain,
            enabled: row.enabled,
            metadata: row.metadata,
          },
          update: {
            enabled: row.enabled,
            metadata: row.metadata,
          },
        })
      }

      for (const row of capabilityRows) {
        await tx.capabilityEntitlement.upsert({
          where: {
            empresaId_domain_subdomain_action: {
              empresaId: empresa.id,
              domain: row.domain,
              subdomain: row.subdomain,
              action: row.action,
            },
          },
          create: {
            empresaId: empresa.id,
            domain: row.domain,
            subdomain: row.subdomain,
            action: row.action,
            enabled: row.enabled,
            metadata: row.metadata,
          },
          update: {
            enabled: row.enabled,
            metadata: row.metadata,
          },
        })
      }

      await tx.userCapabilityGrant.deleteMany({
        where: { empresaId: empresa.id, source: RbacGrantSource.MIGRATION },
      })

      const grants = [...grantsByKey.values()]
      for (let index = 0; index < grants.length; index += 500) {
        await tx.userCapabilityGrant.createMany({
          data: grants.slice(index, index + 500),
        })
      }
    })
  }

  return {
    empresaNombre: empresa.nombre,
    effectivePlanTier,
    enabledModules: enabledModules.length,
    domainEntitlements: domainRows.length,
    capabilityEntitlements: capabilityRows.length,
    grants: grantsByKey.size,
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta definido')
  }

  const options = parseCliArgs(process.argv.slice(2))
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const empresas = await prisma.empresa.findMany({
      where: options.empresaId ? { id: options.empresaId } : undefined,
      select: {
        id: true,
        nombre: true,
        nit: true,
        registrationCodeHash: true,
        planTier: true,
        planValidUntil: true,
        trialTier: true,
        trialStartedAt: true,
        trialValidUntil: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!empresas.length) {
      throw new Error(options.empresaId ? 'No se encontro la empresa indicada.' : 'No hay empresas para procesar.')
    }

    console.log(options.dryRun ? 'RBAC v2 bootstrap en modo dry-run' : 'Aplicando bootstrap RBAC v2')

    for (const empresa of empresas) {
      const result = await seedEmpresa(prisma, empresa, options.dryRun)
      console.log(
        [
          `Empresa: ${result.empresaNombre}`,
          `plan=${result.effectivePlanTier}`,
          `modulos=${result.enabledModules}`,
          `domains=${result.domainEntitlements}`,
          `capabilities=${result.capabilityEntitlements}`,
          `grants=${result.grants}`,
          options.dryRun ? 'dry-run' : 'aplicado',
        ].join(' | ')
      )
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})