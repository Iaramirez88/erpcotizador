import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { appendAiWorkspaceHistory } from '@/lib/ai-workspace-history'
import { getBridgeKindFromSettings, getCrmOriginMeta } from '@/lib/crm-origin'
import {
  assertCrmSedeAccess,
  normalizeString,
  parseOptionalDate,
  parseTaskPriority,
  parseTaskStatus,
} from '@/lib/crm'
import {
  appendTaskHistory,
  canUserAccessWorkspace,
  crmTaskInclude,
  getAccessibleTaskWorkspace,
  normalizeTaskAttachments,
  normalizeTaskColorHex,
  normalizeTaskCustomFields,
  normalizeUserIdList,
} from '@/lib/crm-task-workspaces'
import { dispatchCrmTaskCalendarBridges } from '@/lib/crm-calendar-bridges'

export const runtime = 'nodejs'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeAiTaskSuggestion(value: unknown) {
  const record = asRecord(value)
  if (!record) return null

  const title = pickString(record.title)
  const description = pickString(record.description)
  const priority = parseTaskPriority(record.priority)
  const dueAtValue = parseOptionalDate(record.dueAt)
  const assignedToUserId = pickString(record.assignedToUserId)
  const reason = pickString(record.reason)

  if (!title) return null
  if (dueAtValue === undefined) return null

  return {
    title,
    description,
    priority: priority ?? 'NORMAL',
    dueAt: dueAtValue ?? null,
    assignedToUserId: assignedToUserId || null,
    reason: reason || null,
  }
}

function getChangedTaskFields(args: {
  original: ReturnType<typeof normalizeAiTaskSuggestion>
  finalTask: { title: string; description: string | null; priority: string; dueAt: Date | null; assignedToUserId: string | null }
}) {
  if (!args.original) return [] as string[]

  const changedFields: string[] = []
  if (args.original.title !== args.finalTask.title) changedFields.push('title')
  if ((args.original.description || '') !== (args.finalTask.description || '')) changedFields.push('description')
  if (args.original.priority !== args.finalTask.priority) changedFields.push('priority')
  if ((args.original.dueAt?.toISOString() || null) !== (args.finalTask.dueAt?.toISOString() || null)) changedFields.push('dueAt')
  if ((args.original.assignedToUserId || null) !== (args.finalTask.assignedToUserId || null)) changedFields.push('assignedToUserId')
  return changedFields
}

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'COMMERCIAL_TASKS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const leadId = normalizeString(searchParams.get('leadId'))
    const opportunityId = normalizeString(searchParams.get('opportunityId'))
    const clienteId = normalizeString(searchParams.get('clienteId'))
    const workspaceId = normalizeString(searchParams.get('workspaceId'))
    const projectId = normalizeString(searchParams.get('projectId'))
    const assignedToUserId = normalizeString(searchParams.get('assignedToUserId'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const status = parseTaskStatus(searchParams.get('status'))
    const includeArchived = searchParams.get('includeArchived') === 'true'

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    if (workspaceId) {
      const workspace = await getAccessibleTaskWorkspace(prisma, {
        workspaceId,
        empresaId: access.empresaId,
        userId: access.userId,
      })
      if (!workspace) return NextResponse.json({ error: 'workspaceId inválido' }, { status: 400 })

      if (projectId) {
        const project = await prisma.crmTaskWorkspaceProject.findFirst({
          where: { id: projectId, workspaceId, empresaId: access.empresaId },
          select: { id: true },
        })
        if (!project) return NextResponse.json({ error: 'projectId inválido' }, { status: 400 })
      }
    } else if (projectId) {
      return NextResponse.json({ error: 'projectId requiere workspaceId' }, { status: 400 })
    }

    const rows = await prisma.crmTask.findMany({
      where: {
        empresaId: access.empresaId,
        ...(leadId ? { leadId } : {}),
        ...(opportunityId ? { opportunityId } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(workspaceId ? { workspaceId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(assignedToUserId ? { assignedToUserId } : {}),
        ...(sedeId ? { sedeId } : {}),
        ...(status ? { status } : {}),
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { workspace: { name: { contains: search, mode: 'insensitive' } } },
                { lead: { nombre: { contains: search, mode: 'insensitive' } } },
                { opportunity: { title: { contains: search, mode: 'insensitive' } } },
                { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: crmTaskInclude,
    })

    const data = rows.map((row) => {
      const latestConversation = row.lead?.conversations[0]
      const origin = row.lead
        ? getCrmOriginMeta({
            provider: latestConversation?.channelConnection.provider,
            bridgeKind: getBridgeKindFromSettings(latestConversation?.channelConnection.settingsJson),
            source: row.lead.source,
          })
        : null

      return {
        ...row,
        originKey: origin?.key ?? null,
        originLabel: origin?.label ?? null,
        lead: row.lead
          ? {
              id: row.lead.id,
              nombre: row.lead.nombre,
              source: row.lead.source,
              originKey: origin?.key ?? null,
              originLabel: origin?.label ?? null,
            }
          : null,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error listando tareas CRM:', error)
    return NextResponse.json({ error: 'Error listando tareas CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'COMMERCIAL_TASKS',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const leadId = normalizeString(body?.leadId)
    const opportunityId = normalizeString(body?.opportunityId)
    const clienteId = normalizeString(body?.clienteId)
    const workspaceId = normalizeString(body?.workspaceId)
    const projectId = normalizeString(body?.projectId)
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const assignedToUserIds = normalizeUserIdList(body?.assignedToUserIds)
    const explicitSedeId = normalizeString(body?.sedeId)
    const status = parseTaskStatus(body?.status) ?? 'OPEN'
    const priority = parseTaskPriority(body?.priority) ?? 'NORMAL'
    const dueAt = parseOptionalDate(body?.dueAt)
    const attachmentsJson = normalizeTaskAttachments(body?.attachmentsJson)
    const customFieldsJson = normalizeTaskCustomFields(body?.customFieldsJson)
    const colorHex = normalizeTaskColorHex(body?.colorHex)
    const aiAudit = asRecord(body?.aiAudit)
    const aiSuggestionAuditEntryId = pickString(aiAudit?.auditEntryId)
    const aiConversationId = pickString(aiAudit?.conversationId)
    const aiOriginalTaskSuggestion = normalizeAiTaskSuggestion(aiAudit?.originalTaskSuggestion)

    if (!title) return NextResponse.json({ error: 'title es requerido' }, { status: 400 })
    if (!workspaceId && !leadId && !opportunityId && !clienteId) {
      return NextResponse.json({ error: 'workspaceId, leadId, opportunityId o clienteId es requerido' }, { status: 400 })
    }
    if (dueAt === undefined) return NextResponse.json({ error: 'dueAt inválido' }, { status: 400 })

    const workspace = workspaceId
      ? await getAccessibleTaskWorkspace(prisma, {
          workspaceId,
          empresaId: access.empresaId,
          userId: access.userId,
        })
      : null

    if (workspaceId && !workspace) {
      return NextResponse.json({ error: 'workspaceId inválido' }, { status: 400 })
    }
    if (workspace && !canUserAccessWorkspace(workspace, access.userId, 'edit')) {
      return NextResponse.json({ error: 'No tienes permisos para crear tareas en este espacio.' }, { status: 403 })
    }

    if (projectId && !workspaceId) {
      return NextResponse.json({ error: 'projectId requiere workspaceId' }, { status: 400 })
    }

    const project = projectId
      ? await prisma.crmTaskWorkspaceProject.findFirst({
          where: {
            id: projectId,
            workspaceId: workspaceId || '__none__',
            empresaId: access.empresaId,
          },
          select: { id: true },
        })
      : null

    if (workspaceId && !projectId) {
      return NextResponse.json({ error: 'Selecciona un proyecto antes de crear la tarea.' }, { status: 400 })
    }
    if (projectId && !project) {
      return NextResponse.json({ error: 'projectId inválido' }, { status: 400 })
    }

    const lead = leadId
      ? await prisma.crmLead.findUnique({ where: { id: leadId }, select: { id: true, empresaId: true, sedeId: true } })
      : null
    if (leadId && (!lead || lead.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'leadId inválido' }, { status: 400 })
    }

    const opportunity = opportunityId
      ? await prisma.crmOpportunity.findUnique({ where: { id: opportunityId }, select: { id: true, empresaId: true, sedeId: true, leadId: true, clienteId: true } })
      : null
    if (opportunityId && (!opportunity || opportunity.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'opportunityId inválido' }, { status: 400 })
    }

    const cliente = clienteId
      ? await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, empresaId: true, sedeId: true } })
      : null
    if (clienteId && (!cliente || cliente.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'clienteId inválido' }, { status: 400 })
    }

    const normalizedAssigneeIds = Array.from(new Set([...(assignedToUserId ? [assignedToUserId] : []), ...assignedToUserIds]))
    if (normalizedAssigneeIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: normalizedAssigneeIds }, empresaId: access.empresaId },
        select: { id: true },
      })
      if (users.length !== normalizedAssigneeIds.length) {
        return NextResponse.json({ error: 'assignedToUserIds inválido' }, { status: 400 })
      }
    }

    const finalSedeId = explicitSedeId || workspace?.sedeId || lead?.sedeId || opportunity?.sedeId || cliente?.sedeId || ''
    if (finalSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: finalSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.crmTask.create({
        data: {
          empresaId: access.empresaId,
          sedeId: finalSedeId || null,
          workspaceId: workspaceId || null,
          projectId: projectId || null,
          title,
          description: description || null,
          colorHex,
          status,
          priority,
          attachmentsJson,
          customFieldsJson,
          dueAt: dueAt ?? null,
          leadId: leadId || opportunity?.leadId || null,
          opportunityId: opportunityId || null,
          clienteId: clienteId || opportunity?.clienteId || null,
          assignedToUserId: normalizedAssigneeIds[0] || null,
          createdById: access.userId,
        },
      })

      if (normalizedAssigneeIds.length) {
        await tx.crmTaskAssignment.createMany({
          data: normalizedAssigneeIds.map((userId) => ({
            empresaId: access.empresaId,
            taskId: created.id,
            userId,
          })),
        })
      }

      await appendTaskHistory(tx, {
        empresaId: access.empresaId,
        taskId: created.id,
        actorUserId: access.userId,
        type: 'CREATED',
        message: workspace ? `Tarea creada en el espacio ${workspace.name}.` : 'Tarea creada.',
        metadata: {
          workspaceId: workspace?.id ?? null,
          assignedToUserIds: normalizedAssigneeIds,
          attachmentsCount: attachmentsJson.length,
          customFieldsCount: customFieldsJson.length,
        },
      })

      return tx.crmTask.findUniqueOrThrow({ where: { id: created.id }, include: crmTaskInclude })
    })

    const calendarSyncs = await dispatchCrmTaskCalendarBridges({
      empresaId: access.empresaId,
      sedeId: finalSedeId || null,
      eventName: 'crm.task.created',
      task: {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        dueAt: row.dueAt,
        workspaceId: row.workspaceId,
        leadId: row.leadId,
        opportunityId: row.opportunityId,
        clienteId: row.clienteId,
        assignedToUserId: row.assignedToUserId,
        createdById: row.createdById,
        colorHex: row.colorHex,
      },
      lead: row.lead ? {
        id: row.lead.id,
        nombre: row.lead.nombre,
      } : null,
      opportunity: row.opportunity ? {
        id: row.opportunity.id,
        title: row.opportunity.title,
      } : null,
      cliente: row.cliente ? {
        id: row.cliente.id,
        nombre: row.cliente.nombre,
      } : null,
      meta: {
        workspaceId: workspace?.id ?? null,
        workspaceName: workspace?.name ?? null,
      },
    })

    const changedTaskFields = getChangedTaskFields({
      original: aiOriginalTaskSuggestion,
      finalTask: {
        title: row.title,
        description: row.description,
        priority: row.priority,
        dueAt: row.dueAt,
        assignedToUserId: row.assignedToUserId,
      },
    })

    if (aiConversationId && aiSuggestionAuditEntryId && aiOriginalTaskSuggestion) {
      await appendAiWorkspaceHistory({
        empresaId: access.empresaId,
        entry: {
          kind: 'CRM_CONVERSATION_COPILOT',
          prompt: `task-suggestion:${aiConversationId}`,
          actorUserId: access.userId,
          actorLabel: access.session.user.name || access.session.user.email || null,
          summary: changedTaskFields.length
            ? `Tarea IA editada antes de crearla para la conversación ${aiConversationId}.`
            : `Tarea IA aceptada sin cambios para la conversación ${aiConversationId}.`,
          responseText: [
            `Tarea creada: ${row.title}`,
            `Prioridad: ${row.priority}`,
            `Vencimiento: ${row.dueAt ? row.dueAt.toISOString() : 'sin fecha'}`,
            `Responsable: ${row.assignedTo?.name || row.assignedTo?.email || row.assignedToUserId || 'sin asignar'}`,
          ].join('\n'),
          metadata: {
            eventType: 'TASK_SUGGESTION_ACTION',
            taskSuggestionAction: changedTaskFields.length ? 'EDITED' : 'ACCEPTED',
            changedTaskFields,
            sourceAuditEntryId: aiSuggestionAuditEntryId,
            conversationId: aiConversationId,
            taskId: row.id,
            taskTitle: row.title,
            taskPriority: row.priority,
            taskDueAt: row.dueAt?.toISOString() || null,
            taskAssignedToUserId: row.assignedToUserId,
            originalTaskSuggestion: aiOriginalTaskSuggestion,
            finalTask: {
              title: row.title,
              description: row.description,
              priority: row.priority,
              dueAt: row.dueAt?.toISOString() || null,
              assignedToUserId: row.assignedToUserId,
            },
          },
          asset: null,
        },
      })
    }

    return NextResponse.json({ success: true, data: row, calendarSyncs }, { status: 201 })
  } catch (error) {
    console.error('Error creando tarea CRM:', error)
    return NextResponse.json({ error: 'Error creando tarea CRM' }, { status: 500 })
  }
}