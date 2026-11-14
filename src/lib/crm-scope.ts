import type { Prisma, RbacScopeType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { RbacV2CapabilityAction } from '@/lib/rbac-v2-catalog'

/**
 * Alcance efectivo por registro para el dominio CRM (captación).
 *
 * El catálogo RBAC v2 ya declara los alcances (`RbacScopeType`), pero hasta ahora
 * ningún endpoint los aplicaba: siempre se filtraba por `sedeId`. Este módulo
 * traduce los grants vigentes del usuario a un `where` reutilizable.
 *
 * Reglas:
 * - Se toma el alcance **más amplio** entre los grants permitidos para la capacidad.
 * - Si no hay alcance declarado (grants legacy), se cae a `SEDE` para preservar
 *   el comportamiento histórico.
 * - `TEAM` usa `Team`/`TeamMember` (ya existen en el esquema).
 * - `GLOBAL_PLATFORM` se trata como `EMPRESA` (el aislamiento por empresa es duro).
 */
export type CrmScopeLevel = 'OWN' | 'ASSIGNED' | 'TEAM' | 'SEDE' | 'EMPRESA'

export type CrmResourceKind = 'lead' | 'contact' | 'opportunity'

export type CrmRecordScope = {
  empresaId: string
  userId: string
  sedeId: string
  level: CrmScopeLevel
  /** Sedes accesibles cuando el alcance es SEDE (vacío para otros alcances). */
  sedeIds: string[]
  /** Usuarios de mis equipos cuando el alcance es TEAM. */
  teamUserIds: string[]
}

const SCOPE_PRIORITY: Record<CrmScopeLevel, number> = {
  OWN: 0,
  ASSIGNED: 1,
  TEAM: 2,
  SEDE: 3,
  EMPRESA: 4,
}

function mapGrantScope(scopeType: RbacScopeType): CrmScopeLevel | null {
  switch (scopeType) {
    case 'GLOBAL_PLATFORM':
    case 'EMPRESA':
      return 'EMPRESA'
    case 'SEDE':
      return 'SEDE'
    case 'TEAM':
      return 'TEAM'
    case 'ASSIGNED':
      return 'ASSIGNED'
    case 'OWN':
      return 'OWN'
    default:
      return null
  }
}

export async function resolveCrmRecordScope(args: {
  empresaId: string
  userId: string
  sedeId?: string | null
  domain?: string
  subdomain?: string
  action?: RbacV2CapabilityAction
  isSystemSuperAdmin?: boolean
}): Promise<CrmRecordScope> {
  const empresaId = args.empresaId
  const userId = args.userId
  const sedeId = args.sedeId ?? ''

  if (args.isSystemSuperAdmin) {
    return { empresaId, userId, sedeId, level: 'EMPRESA', sedeIds: [], teamUserIds: [] }
  }

  const grants = await prisma.userCapabilityGrant.findMany({
    where: {
      userId,
      empresaId,
      domain: args.domain ?? 'CAPTACION',
      subdomain: args.subdomain ?? 'LEADS',
      action: args.action ?? 'READ',
      allowed: true,
    },
    select: { scopeType: true },
  })

  let level: CrmScopeLevel = 'SEDE'
  for (const grant of grants) {
    const mapped = mapGrantScope(grant.scopeType)
    if (!mapped) continue
    if (SCOPE_PRIORITY[mapped] > SCOPE_PRIORITY[level]) level = mapped
  }

  if (!grants.length) level = 'SEDE'

  if (level === 'SEDE') {
    const [memberships, user] = await Promise.all([
      prisma.sedeMembership.findMany({
        where: { userId, sede: { empresaId } },
        select: { sedeId: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { sedeDefaultId: true } }),
    ])

    const sedeIds = new Set(memberships.map((row) => row.sedeId))
    if (user?.sedeDefaultId) sedeIds.add(user.sedeDefaultId)
    if (sedeId) sedeIds.add(sedeId)

    return { empresaId, userId, sedeId, level, sedeIds: [...sedeIds], teamUserIds: [] }
  }

  if (level === 'TEAM') {
    const memberships = await prisma.teamMember.findMany({
      where: { userId, team: { sede: { empresaId } } },
      select: { teamId: true },
    })

    const teamIds = memberships.map((row) => row.teamId)
    if (!teamIds.length) {
      return { empresaId, userId, sedeId, level, sedeIds: [], teamUserIds: [] }
    }

    const teamUsers = await prisma.teamMember.findMany({
      where: { teamId: { in: teamIds } },
      select: { userId: true },
    })

    const teamUserIds = new Set(teamUsers.map((row) => row.userId))
    teamUserIds.add(userId)

    return { empresaId, userId, sedeId, level, sedeIds: [], teamUserIds: [...teamUserIds] }
  }

  return { empresaId, userId, sedeId, level, sedeIds: [], teamUserIds: [] }
}

/**
 * Traduce el alcance a un `where` de Prisma que siempre conserva `empresaId`.
 * Nunca reemplaza el filtro de empresa: el aislamiento multi-tenant es duro.
 */
export function buildCrmScopeWhere(
  scope: CrmRecordScope,
  kind: CrmResourceKind
): Prisma.CrmLeadWhereInput | Prisma.CrmContactWhereInput | Prisma.CrmOpportunityWhereInput {
  switch (scope.level) {
    case 'EMPRESA':
      return {}
    case 'SEDE': {
      if (!scope.sedeIds.length) {
        // Sin sedes declaradas (usuario sin membership): solo registros sin sede.
        return { sedeId: null } as Prisma.CrmLeadWhereInput
      }
      return {
        OR: [{ sedeId: { in: scope.sedeIds } }, { sedeId: null }],
      } as Prisma.CrmLeadWhereInput
    }
    case 'TEAM': {
      if (!scope.teamUserIds.length) {
        return { id: { in: [] } } as Prisma.CrmLeadWhereInput
      }
      if (kind === 'lead') {
        return { ownerUserId: { in: scope.teamUserIds } } as Prisma.CrmLeadWhereInput
      }
      if (kind === 'contact') {
        return {
          OR: [
            { ownerUserId: { in: scope.teamUserIds } },
            { leads: { some: { ownerUserId: { in: scope.teamUserIds } } } },
          ],
        } as Prisma.CrmContactWhereInput
      }
      return {
        OR: [
          { assignedToUserId: { in: scope.teamUserIds } },
          { lead: { ownerUserId: { in: scope.teamUserIds } } },
        ],
      } as Prisma.CrmOpportunityWhereInput
    }
    case 'ASSIGNED': {
      if (kind === 'lead') {
        return {
          OR: [{ ownerUserId: scope.userId }, { assignedByUserId: scope.userId }, { createdById: scope.userId }],
        } as Prisma.CrmLeadWhereInput
      }
      if (kind === 'contact') {
        return { ownerUserId: scope.userId } as Prisma.CrmContactWhereInput
      }
      return { assignedToUserId: scope.userId } as Prisma.CrmOpportunityWhereInput
    }
    case 'OWN':
    default: {
      return { createdById: scope.userId } as Prisma.CrmLeadWhereInput
    }
  }
}

/**
 * Verificación en memoria para rutas de detalle (donde no se aplica `where`).
 * Se usa después de cargar el registro, junto con la validación de empresa.
 */
export function canAccessCrmRecord(
  scope: CrmRecordScope,
  kind: CrmResourceKind,
  record: {
    id: string
    empresaId?: string | null
    sedeId?: string | null
    createdById?: string | null
    ownerUserId?: string | null
    assignedToUserId?: string | null
    assignedByUserId?: string | null
  }
): boolean {
  if (record.empresaId && record.empresaId !== scope.empresaId) return false

  switch (scope.level) {
    case 'EMPRESA':
      return true
    case 'SEDE':
      if (!record.sedeId) return true
      return scope.sedeIds.includes(record.sedeId)
    case 'TEAM':
      if (!scope.teamUserIds.length) return false
      if (kind === 'opportunity') {
        return Boolean(record.assignedToUserId && scope.teamUserIds.includes(record.assignedToUserId))
      }
      return Boolean(record.ownerUserId && scope.teamUserIds.includes(record.ownerUserId))
    case 'ASSIGNED':
      if (kind === 'opportunity') return record.assignedToUserId === scope.userId
      if (kind === 'contact') return record.ownerUserId === scope.userId
      return (
        record.ownerUserId === scope.userId ||
        record.assignedByUserId === scope.userId ||
        record.createdById === scope.userId
      )
    case 'OWN':
    default:
      return record.createdById === scope.userId
  }
}

/**
 * Azúcar para rutas: deriva el alcance desde el resultado de `requireCapabilityAccess`.
 */
export async function resolveCrmRequestScope(
  access: {
    empresaId: string
    userId: string
    sedeId: string
    isSystemSuperAdmin?: boolean
  },
  args: { subdomain: string; action: RbacV2CapabilityAction }
): Promise<CrmRecordScope> {
  return resolveCrmRecordScope({
    empresaId: access.empresaId,
    userId: access.userId,
    sedeId: access.sedeId,
    domain: 'CAPTACION',
    subdomain: args.subdomain,
    action: args.action,
    isSystemSuperAdmin: access.isSystemSuperAdmin,
  })
}

export function describeCrmScopeLevel(level: CrmScopeLevel): string {
  switch (level) {
    case 'OWN':
      return 'Solo registros creados por mí'
    case 'ASSIGNED':
      return 'Registros asignados a mí'
    case 'TEAM':
      return 'Registros de mi equipo'
    case 'SEDE':
      return 'Registros de mis sedes'
    case 'EMPRESA':
    default:
      return 'Toda la empresa'
  }
}
