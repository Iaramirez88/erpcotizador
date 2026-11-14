import type { CrmAssignmentRule, CrmLead, PrismaClient } from '@prisma/client'
import { normalizeString } from '@/lib/crm'

/**
 * Reglas de asignación de leads.
 *
 * Cada regla declara `matchJson` con criterios AND entre campos y OR dentro de
 * cada lista. Se evalúan por `priority ASC`; con `stopOnMatch` se detiene en la
 * primera que logre asignar. Si ninguna coincide el lead queda **sin responsable**
 * (requisito explícito de la captación) y visible en la vista "Nuevos".
 */
export type CrmAssignmentClient = Pick<
  PrismaClient,
  'crmAssignmentRule' | 'crmLead' | 'crmActivity' | 'notification' | 'user' | 'teamMember' | 'team'
>

export type CrmAssignmentMatchJson = {
  sources?: string[]
  formIds?: string[]
  campaignNames?: string[]
  services?: string[]
  sedes?: string[]
  cities?: string[]
  scoreBands?: string[]
  minScore?: number
}

export type CrmAssignmentContext = {
  source?: string | null
  formId?: string | null
  campaignName?: string | null
  serviceInterest?: string | null
  sedeId?: string | null
  city?: string | null
  score?: number | null
  scoreBand?: string | null
}

export type CrmAssignmentResolution = {
  assigned: boolean
  assigneeUserId: string | null
  ruleId: string | null
  ruleName: string | null
}

const OPEN_LIFECYCLE_STATUSES = ['NEW', 'PENDING_REVIEW', 'NURTURING', 'QUALIFIED'] as const

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => normalizeString(item)).filter(Boolean)))
}

export function parseCrmAssignmentMatchJson(value: unknown): CrmAssignmentMatchJson {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const minScoreRaw = raw.minScore
  const minScore =
    typeof minScoreRaw === 'number' && Number.isFinite(minScoreRaw) ? minScoreRaw : null

  return {
    sources: toStringArray(raw.sources),
    formIds: toStringArray(raw.formIds),
    campaignNames: toStringArray(raw.campaignNames),
    services: toStringArray(raw.services),
    sedes: toStringArray(raw.sedes),
    cities: toStringArray(raw.cities),
    scoreBands: toStringArray(raw.scoreBands),
    ...(minScore != null ? { minScore } : {}),
  }
}

function matchesAny(list: string[] | undefined, candidate: string | null | undefined) {
  if (!list?.length) return true
  const needle = normalizeString(candidate).toLowerCase()
  if (!needle) return false
  return list.some((item) => item.toLowerCase() === needle)
}

export function matchesCrmAssignmentRule(
  match: CrmAssignmentMatchJson,
  context: CrmAssignmentContext
): boolean {
  if (!matchesAny(match.sources, context.source)) return false
  if (!matchesAny(match.formIds, context.formId)) return false
  if (!matchesAny(match.campaignNames, context.campaignName)) return false
  if (!matchesAny(match.services, context.serviceInterest)) return false
  if (!matchesAny(match.sedes, context.sedeId)) return false
  if (!matchesAny(match.cities, context.city)) return false
  if (!matchesAny(match.scoreBands, context.scoreBand)) return false

  if (typeof match.minScore === 'number') {
    const score = typeof context.score === 'number' ? context.score : 0
    if (score < match.minScore) return false
  }

  return true
}

/**
 * Asigna un lead y deja auditoría + notificación. Toda asignación (manual o por
 * regla) pasa por aquí para mantener `assignedAt`/`assignedByUserId` coherentes.
 */
export async function assignCrmLead(args: {
  client: CrmAssignmentClient
  empresaId: string
  leadId: string
  assigneeUserId: string
  actorUserId: string
  reason?: string | null
  notify?: boolean
}): Promise<CrmLead> {
  const lead = await args.client.crmLead.findUnique({
    where: { id: args.leadId },
    select: {
      id: true,
      empresaId: true,
      sedeId: true,
      nombre: true,
      empresaNombre: true,
      lifecycleStatus: true,
      ownerUserId: true,
    },
  })

  if (!lead || lead.empresaId !== args.empresaId) {
    throw new Error('Lead no encontrado para asignación')
  }

  if (lead.ownerUserId === args.assigneeUserId) {
    return args.client.crmLead.findUniqueOrThrow({ where: { id: lead.id } })
  }

  const assignee = await args.client.user.findFirst({
    where: { id: args.assigneeUserId, empresaId: args.empresaId },
    select: { id: true, name: true, email: true },
  })
  if (!assignee) throw new Error('El responsable no pertenece a la empresa')

  const nextLifecycleStatus = (OPEN_LIFECYCLE_STATUSES as readonly string[]).includes(lead.lifecycleStatus)
    ? 'SALES_ASSIGNED'
    : lead.lifecycleStatus

  const updated = await args.client.crmLead.update({
    where: { id: lead.id },
    data: {
      ownerUserId: assignee.id,
      assignedAt: new Date(),
      assignedByUserId: args.actorUserId,
      lifecycleStatus: nextLifecycleStatus,
    },
  })

  await args.client.crmActivity.create({
    data: {
      empresaId: args.empresaId,
      sedeId: lead.sedeId,
      type: 'OTHER',
      summary: `Lead asignado a ${assignee.name || assignee.email}`,
      details: args.reason ?? null,
      leadId: lead.id,
      eventKey: `assign:${lead.id}:${Date.now()}`,
      createdById: args.actorUserId,
    },
  })

  if (args.notify !== false) {
    await args.client.notification.create({
      data: {
        type: 'INFO',
        title: 'Nuevo lead asignado',
        body: [lead.nombre, lead.empresaNombre].filter(Boolean).join(' · ') || null,
        actionUrl: `/dashboard/crm/leads/${lead.id}`,
        actionLabel: 'Abrir lead',
        empresaId: args.empresaId,
        sedeId: lead.sedeId,
        userId: assignee.id,
      },
    })
  }

  return updated
}

async function pickTeamMemberByLoad(args: {
  client: CrmAssignmentClient
  empresaId: string
  teamId: string
}): Promise<string | null> {
  const members = await args.client.teamMember.findMany({
    where: { teamId: args.teamId },
    select: { userId: true },
  })

  const memberIds = members.map((member) => member.userId)
  if (!memberIds.length) return null

  const openLeads = await args.client.crmLead.findMany({
    where: {
      empresaId: args.empresaId,
      ownerUserId: { in: memberIds },
      lifecycleStatus: { notIn: ['CONVERTED', 'DISCARDED', 'DO_NOT_CONTACT'] },
    },
    select: { ownerUserId: true },
  })

  const load = new Map<string, number>()
  for (const memberId of memberIds) load.set(memberId, 0)
  for (const lead of openLeads) {
    if (!lead.ownerUserId) continue
    load.set(lead.ownerUserId, (load.get(lead.ownerUserId) ?? 0) + 1)
  }

  return [...memberIds].sort((left, right) => (load.get(left) ?? 0) - (load.get(right) ?? 0))[0] ?? null
}

export async function resolveCrmAssigneeByRules(args: {
  client: CrmAssignmentClient
  empresaId: string
  context: CrmAssignmentContext
}): Promise<{ rule: CrmAssignmentRule; assigneeUserId: string } | null> {
  const rules = await args.client.crmAssignmentRule.findMany({
    where: { empresaId: args.empresaId, active: true },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  for (const rule of rules) {
    const match = parseCrmAssignmentMatchJson(rule.matchJson)
    if (!matchesCrmAssignmentRule(match, args.context)) continue

    const directAssignee = normalizeString(rule.assigneeUserId)
    if (directAssignee) return { rule, assigneeUserId: directAssignee }

    const teamAssignee = normalizeString(rule.teamId)
      ? await pickTeamMemberByLoad({
          client: args.client,
          empresaId: args.empresaId,
          teamId: normalizeString(rule.teamId),
        })
      : null

    if (teamAssignee) return { rule, assigneeUserId: teamAssignee }
  }

  return null
}

/**
 * Evalúa todas las reglas vigentes y asigna como máximo una vez por lead.
 * Devuelve la resolución para que el llamador pueda registrar la traza.
 */
export async function applyAssignmentRules(args: {
  client: CrmAssignmentClient
  empresaId: string
  leadId: string
  actorUserId: string
  context: CrmAssignmentContext
  notify?: boolean
}): Promise<CrmAssignmentResolution> {
  const resolution = await resolveCrmAssigneeByRules({
    client: args.client,
    empresaId: args.empresaId,
    context: args.context,
  })

  if (!resolution) {
    return { assigned: false, assigneeUserId: null, ruleId: null, ruleName: null }
  }

  await assignCrmLead({
    client: args.client,
    empresaId: args.empresaId,
    leadId: args.leadId,
    assigneeUserId: resolution.assigneeUserId,
    actorUserId: args.actorUserId,
    reason: `Regla de asignación: ${resolution.rule.name}`,
    notify: args.notify,
  })

  return {
    assigned: true,
    assigneeUserId: resolution.assigneeUserId,
    ruleId: resolution.rule.id,
    ruleName: resolution.rule.name,
  }
}

/**
 * Validación del destino de una regla: persona o equipo, nunca ambos.
 * Devuelve un mensaje de error o `null` si es válido.
 */
export async function validateCrmAssignmentTarget(args: {
  client: CrmAssignmentClient
  empresaId: string
  assigneeUserId: string
  teamId: string
}): Promise<string | null> {
  if (!args.assigneeUserId && !args.teamId) {
    return 'assigneeUserId o teamId es requerido'
  }
  if (args.assigneeUserId && args.teamId) {
    return 'assigneeUserId y teamId son mutuamente excluyentes'
  }
  if (args.assigneeUserId) {
    const user = await args.client.user.findFirst({
      where: { id: args.assigneeUserId, empresaId: args.empresaId },
      select: { id: true },
    })
    if (!user) return 'assigneeUserId inválido'
  }
  if (args.teamId) {
    const team = await args.client.team.findFirst({
      where: { id: args.teamId, sede: { empresaId: args.empresaId } },
      select: { id: true },
    })
    if (!team) return 'teamId inválido'
  }
  return null
}

/**
 * Aviso a líderes comerciales cuando ninguna regla asigna el lead.
 * El lead permanece sin responsable y visible en la vista "Nuevos".
 */
export async function notifyCrmLeadersOfUnassignedLead(args: {
  client: CrmAssignmentClient
  empresaId: string
  leadId: string
  leadName: string
  sedeId?: string | null
}): Promise<number> {
  const leaders = await args.client.user.findMany({
    where: {
      empresaId: args.empresaId,
      OR: [
        { role: 'ADMIN' },
        { sedeMemberships: { some: { role: { in: ['ADMIN', 'MANAGER'] } } } },
      ],
    },
    select: { id: true },
    take: 50,
  })

  if (!leaders.length) return 0

  await args.client.notification.createMany({
    data: leaders.map((leader) => ({
      type: 'WARNING' as const,
      title: 'Lead sin responsable',
      body: `${args.leadName} no coincide con ninguna regla de asignación.`,
      actionUrl: `/dashboard/crm/leads?view=new&unassigned=1`,
      actionLabel: 'Revisar bandeja',
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      userId: leader.id,
    })),
  })

  return leaders.length
}
