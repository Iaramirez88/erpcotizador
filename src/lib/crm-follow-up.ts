import { Prisma } from '@prisma/client'
import { appendTaskHistory } from '@/lib/crm-task-workspaces'

type DbClient = Prisma.TransactionClient

const LEAD_AUTO_TASK_TITLE = 'Seguimiento automático de captación'
const OPPORTUNITY_AUTO_TASK_TITLE = 'Seguimiento automático del pipeline'
const OPEN_AUTO_TASK_STATUSES = ['OPEN', 'IN_PROGRESS'] as const

function subtractDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() - days)
  return next
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function sameDate(left: Date | null | undefined, right: Date | null | undefined) {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.getTime() === right.getTime()
}

async function syncTaskAssignments(client: DbClient, args: { empresaId: string; taskId: string; assignedToUserId?: string | null }) {
  await client.crmTaskAssignment.deleteMany({ where: { taskId: args.taskId } })
  if (!args.assignedToUserId) return

  await client.crmTaskAssignment.create({
    data: {
      empresaId: args.empresaId,
      taskId: args.taskId,
      userId: args.assignedToUserId,
    },
  })
}

function shouldLeadHaveFollowUp(lead: { status: string; lastActivityAt: Date | null; createdAt: Date }, now: Date) {
  if (!['NEW', 'CONTACTED', 'QUALIFIED'].includes(lead.status)) return false
  const threshold = subtractDays(now, 2)
  const reference = lead.lastActivityAt ?? lead.createdAt
  return reference < threshold
}

function shouldOpportunityHaveFollowUp(opportunity: { stage: string; updatedAt: Date; expectedCloseAt: Date | null }, now: Date) {
  if (['WON', 'LOST'].includes(opportunity.stage)) return false
  const staleThreshold = subtractDays(now, 5)
  const urgentCloseThreshold = addDays(now, 7)
  return opportunity.updatedAt < staleThreshold || Boolean(opportunity.expectedCloseAt && opportunity.expectedCloseAt <= urgentCloseThreshold)
}

async function syncLeadFollowUpTask(args: {
  client: DbClient
  empresaId: string
  actorUserId: string
  lead: {
    id: string
    nombre: string
    empresaNombre: string | null
    sedeId: string | null
    ownerUserId: string | null
    status: string
    createdAt: Date
    lastActivityAt: Date | null
  }
  now?: Date
}) {
  const now = args.now ?? new Date()
  const dueAt = now
  const shouldHaveTask = shouldLeadHaveFollowUp(args.lead, now)
  const description = `Retomar contacto con ${args.lead.nombre}${args.lead.empresaNombre ? ` · ${args.lead.empresaNombre}` : ''}. El prospecto no tiene actividad reciente y sigue en captación.`
  const currentTask = await args.client.crmTask.findFirst({
    where: {
      empresaId: args.empresaId,
      leadId: args.lead.id,
      title: LEAD_AUTO_TASK_TITLE,
      archivedAt: null,
      status: { in: [...OPEN_AUTO_TASK_STATUSES] },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      sedeId: true,
      assignedToUserId: true,
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  if (!shouldHaveTask) {
    if (!currentTask) return { created: false, updated: false, closed: false }

    await args.client.crmTask.update({
      where: { id: currentTask.id },
      data: {
        status: 'CANCELED',
      },
    })
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      actorUserId: args.actorUserId,
      type: 'STATUS_CHANGED',
      message: 'La tarea automática de captación se cerró porque el prospecto salió de la condición de seguimiento automático.',
      metadata: {
        automationKind: 'LEAD_INACTIVITY',
        leadId: args.lead.id,
        nextStatus: 'CANCELED',
      },
    })
    return { created: false, updated: false, closed: true }
  }

  if (!currentTask) {
    const created = await args.client.crmTask.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.lead.sedeId || null,
        title: LEAD_AUTO_TASK_TITLE,
        description,
        status: 'OPEN',
        priority: 'HIGH',
        dueAt,
        leadId: args.lead.id,
        assignedToUserId: args.lead.ownerUserId || null,
        createdById: args.actorUserId,
      },
      select: { id: true },
    })

    await syncTaskAssignments(args.client, {
      empresaId: args.empresaId,
      taskId: created.id,
      assignedToUserId: args.lead.ownerUserId,
    })
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: created.id,
      actorUserId: args.actorUserId,
      type: 'CREATED',
      message: 'Tarea automática creada por inactividad en captación.',
      metadata: {
        automationKind: 'LEAD_INACTIVITY',
        leadId: args.lead.id,
      },
    })
    return { created: true, updated: false, closed: false }
  }

  const needsDetailsUpdate =
    currentTask.description !== description ||
    currentTask.priority !== 'HIGH' ||
    currentTask.sedeId !== (args.lead.sedeId || null) ||
    !sameDate(currentTask.dueAt, dueAt)
  const assigneeChanged = currentTask.assignedToUserId !== (args.lead.ownerUserId || null)

  if (!needsDetailsUpdate && !assigneeChanged) {
    return { created: false, updated: false, closed: false }
  }

  await args.client.crmTask.update({
    where: { id: currentTask.id },
    data: {
      description,
      priority: 'HIGH',
      dueAt,
      sedeId: args.lead.sedeId || null,
      assignedToUserId: args.lead.ownerUserId || null,
    },
  })

  if (assigneeChanged) {
    await syncTaskAssignments(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      assignedToUserId: args.lead.ownerUserId,
    })
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      actorUserId: args.actorUserId,
      type: 'ASSIGNEES_CHANGED',
      message: args.lead.ownerUserId ? 'La tarea automática de captación se reasignó al responsable actual del prospecto.' : 'La tarea automática de captación quedó sin responsable asignado.',
      metadata: {
        automationKind: 'LEAD_INACTIVITY',
        leadId: args.lead.id,
        assignedToUserId: args.lead.ownerUserId,
      },
    })
  }

  if (needsDetailsUpdate) {
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      actorUserId: args.actorUserId,
      type: 'UPDATED',
      message: 'La tarea automática de captación se actualizó según el estado actual del prospecto.',
      metadata: {
        automationKind: 'LEAD_INACTIVITY',
        leadId: args.lead.id,
      },
    })
  }

  return { created: false, updated: true, closed: false }
}

async function syncOpportunityFollowUpTask(args: {
  client: DbClient
  empresaId: string
  actorUserId: string
  opportunity: {
    id: string
    title: string
    sedeId: string | null
    leadId: string | null
    clienteId: string | null
    assignedToUserId: string | null
    expectedCloseAt: Date | null
    stage: string
    updatedAt: Date
  }
  now?: Date
}) {
  const now = args.now ?? new Date()
  const urgentCloseThreshold = addDays(now, 7)
  const shouldHaveTask = shouldOpportunityHaveFollowUp(args.opportunity, now)
  const isUrgent = Boolean(args.opportunity.expectedCloseAt && args.opportunity.expectedCloseAt <= urgentCloseThreshold)
  const dueAt = isUrgent ? now : addDays(now, 1)
  const priority = isUrgent ? 'HIGH' : 'NORMAL'
  const description = `Revisar el negocio ${args.opportunity.title}. La oportunidad requiere movimiento por inactividad reciente o cercanía de cierre.`
  const currentTask = await args.client.crmTask.findFirst({
    where: {
      empresaId: args.empresaId,
      opportunityId: args.opportunity.id,
      title: OPPORTUNITY_AUTO_TASK_TITLE,
      archivedAt: null,
      status: { in: [...OPEN_AUTO_TASK_STATUSES] },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      sedeId: true,
      leadId: true,
      clienteId: true,
      assignedToUserId: true,
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  if (!shouldHaveTask) {
    if (!currentTask) return { created: false, updated: false, closed: false }

    await args.client.crmTask.update({
      where: { id: currentTask.id },
      data: {
        status: 'CANCELED',
      },
    })
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      actorUserId: args.actorUserId,
      type: 'STATUS_CHANGED',
      message: 'La tarea automática del pipeline se cerró porque la oportunidad salió de la condición de seguimiento automático.',
      metadata: {
        automationKind: 'OPPORTUNITY_INACTIVITY',
        opportunityId: args.opportunity.id,
        nextStatus: 'CANCELED',
      },
    })
    return { created: false, updated: false, closed: true }
  }

  if (!currentTask) {
    const created = await args.client.crmTask.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.opportunity.sedeId || null,
        title: OPPORTUNITY_AUTO_TASK_TITLE,
        description,
        status: 'OPEN',
        priority,
        dueAt,
        leadId: args.opportunity.leadId || null,
        opportunityId: args.opportunity.id,
        clienteId: args.opportunity.clienteId || null,
        assignedToUserId: args.opportunity.assignedToUserId || null,
        createdById: args.actorUserId,
      },
      select: { id: true },
    })

    await syncTaskAssignments(args.client, {
      empresaId: args.empresaId,
      taskId: created.id,
      assignedToUserId: args.opportunity.assignedToUserId,
    })
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: created.id,
      actorUserId: args.actorUserId,
      type: 'CREATED',
      message: 'Tarea automática creada por inactividad o cierre cercano en pipeline.',
      metadata: {
        automationKind: 'OPPORTUNITY_INACTIVITY',
        opportunityId: args.opportunity.id,
      },
    })
    return { created: true, updated: false, closed: false }
  }

  const needsDetailsUpdate =
    currentTask.description !== description ||
    currentTask.priority !== priority ||
    currentTask.sedeId !== (args.opportunity.sedeId || null) ||
    currentTask.leadId !== (args.opportunity.leadId || null) ||
    currentTask.clienteId !== (args.opportunity.clienteId || null) ||
    !sameDate(currentTask.dueAt, dueAt)
  const assigneeChanged = currentTask.assignedToUserId !== (args.opportunity.assignedToUserId || null)

  if (!needsDetailsUpdate && !assigneeChanged) {
    return { created: false, updated: false, closed: false }
  }

  await args.client.crmTask.update({
    where: { id: currentTask.id },
    data: {
      description,
      priority,
      dueAt,
      sedeId: args.opportunity.sedeId || null,
      leadId: args.opportunity.leadId || null,
      clienteId: args.opportunity.clienteId || null,
      assignedToUserId: args.opportunity.assignedToUserId || null,
    },
  })

  if (assigneeChanged) {
    await syncTaskAssignments(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      assignedToUserId: args.opportunity.assignedToUserId,
    })
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      actorUserId: args.actorUserId,
      type: 'ASSIGNEES_CHANGED',
      message: args.opportunity.assignedToUserId ? 'La tarea automática del pipeline se reasignó al responsable actual de la oportunidad.' : 'La tarea automática del pipeline quedó sin responsable asignado.',
      metadata: {
        automationKind: 'OPPORTUNITY_INACTIVITY',
        opportunityId: args.opportunity.id,
        assignedToUserId: args.opportunity.assignedToUserId,
      },
    })
  }

  if (needsDetailsUpdate) {
    await appendTaskHistory(args.client, {
      empresaId: args.empresaId,
      taskId: currentTask.id,
      actorUserId: args.actorUserId,
      type: 'UPDATED',
      message: 'La tarea automática del pipeline se actualizó según el estado actual de la oportunidad.',
      metadata: {
        automationKind: 'OPPORTUNITY_INACTIVITY',
        opportunityId: args.opportunity.id,
      },
    })
  }

  return { created: false, updated: true, closed: false }
}

export async function syncCrmLeadFollowUpTaskById(args: {
  client: DbClient
  empresaId: string
  actorUserId: string
  leadId: string
}) {
  const lead = await args.client.crmLead.findUnique({
    where: { id: args.leadId },
    select: {
      id: true,
      nombre: true,
      empresaNombre: true,
      sedeId: true,
      ownerUserId: true,
      status: true,
      createdAt: true,
      lastActivityAt: true,
    },
  })

  if (!lead) return null

  return syncLeadFollowUpTask({
    client: args.client,
    empresaId: args.empresaId,
    actorUserId: args.actorUserId,
    lead,
  })
}

export async function syncCrmOpportunityFollowUpTaskById(args: {
  client: DbClient
  empresaId: string
  actorUserId: string
  opportunityId: string
}) {
  const opportunity = await args.client.crmOpportunity.findUnique({
    where: { id: args.opportunityId },
    select: {
      id: true,
      title: true,
      sedeId: true,
      leadId: true,
      clienteId: true,
      assignedToUserId: true,
      expectedCloseAt: true,
      stage: true,
      updatedAt: true,
    },
  })

  if (!opportunity) return null

  return syncOpportunityFollowUpTask({
    client: args.client,
    empresaId: args.empresaId,
    actorUserId: args.actorUserId,
    opportunity,
  })
}

export async function reconcileCrmFollowUpTasks(args: {
  client: DbClient
  empresaId: string
  actorUserId: string
}) {
  const now = new Date()
  const staleLeadThreshold = subtractDays(now, 2)
  const staleOpportunityThreshold = subtractDays(now, 5)
  const urgentOpportunityThreshold = addDays(now, 7)

  const [staleLeads, staleOpportunities] = await Promise.all([
    args.client.crmLead.findMany({
      where: {
        empresaId: args.empresaId,
        status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
        OR: [
          { lastActivityAt: { lt: staleLeadThreshold } },
          { lastActivityAt: null, createdAt: { lt: staleLeadThreshold } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        empresaNombre: true,
        sedeId: true,
        ownerUserId: true,
        status: true,
        createdAt: true,
        lastActivityAt: true,
      },
      take: 50,
      orderBy: [{ lastActivityAt: 'asc' }, { createdAt: 'asc' }],
    }),
    args.client.crmOpportunity.findMany({
      where: {
        empresaId: args.empresaId,
        stage: { notIn: ['WON', 'LOST'] },
        OR: [
          { updatedAt: { lt: staleOpportunityThreshold } },
          { expectedCloseAt: { lte: urgentOpportunityThreshold } },
        ],
      },
      select: {
        id: true,
        title: true,
        sedeId: true,
        leadId: true,
        clienteId: true,
        assignedToUserId: true,
        expectedCloseAt: true,
        stage: true,
        updatedAt: true,
      },
      take: 50,
      orderBy: [{ updatedAt: 'asc' }, { expectedCloseAt: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  let createdLeadTasks = 0
  let updatedLeadTasks = 0
  let closedLeadTasks = 0
  let createdOpportunityTasks = 0
  let updatedOpportunityTasks = 0
  let closedOpportunityTasks = 0

  for (const lead of staleLeads) {
    const result = await syncLeadFollowUpTask({
      client: args.client,
      empresaId: args.empresaId,
      actorUserId: args.actorUserId,
      lead,
      now,
    })
    if (result?.created) createdLeadTasks += 1
    if (result?.updated) updatedLeadTasks += 1
    if (result?.closed) closedLeadTasks += 1
  }

  for (const opportunity of staleOpportunities) {
    const result = await syncOpportunityFollowUpTask({
      client: args.client,
      empresaId: args.empresaId,
      actorUserId: args.actorUserId,
      opportunity,
      now,
    })
    if (result?.created) createdOpportunityTasks += 1
    if (result?.updated) updatedOpportunityTasks += 1
    if (result?.closed) closedOpportunityTasks += 1
  }

  return {
    createdLeadTasks,
    updatedLeadTasks,
    closedLeadTasks,
    createdOpportunityTasks,
    updatedOpportunityTasks,
    closedOpportunityTasks,
  }
}