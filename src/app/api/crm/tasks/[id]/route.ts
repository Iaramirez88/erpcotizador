import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
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
import { notifyTaskUsers } from '@/lib/crm-task-notifications'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'COMMERCIAL_TASKS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmTask.findUnique({
      where: { id },
      include: crmTaskInclude,
    })

    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    if (current.workspaceId) {
      const workspace = await getAccessibleTaskWorkspace(prisma, {
        workspaceId: current.workspaceId,
        empresaId: access.empresaId,
        userId: access.userId,
      })
      if (!workspace) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
      if (!canUserAccessWorkspace(workspace, access.userId, 'view')) {
        return NextResponse.json({ error: 'No tienes permisos para ver tareas de este espacio.' }, { status: 403 })
      }
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    return NextResponse.json({ success: true, data: current })
  } catch (error) {
    console.error('Error obteniendo tarea CRM:', error)
    return NextResponse.json({ error: 'Error obteniendo tarea CRM' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'COMMERCIAL_TASKS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmTask.findUnique({
      where: { id },
      include: crmTaskInclude,
    })
    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    if (current.workspaceId) {
      const workspace = await getAccessibleTaskWorkspace(prisma, {
        workspaceId: current.workspaceId,
        empresaId: access.empresaId,
        userId: access.userId,
      })
      if (!workspace) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const assignedToUserIds = normalizeUserIdList(body?.assignedToUserIds)
    const workspaceId = normalizeString(body?.workspaceId)
    const projectId = normalizeString(body?.projectId)
    const explicitSedeId = normalizeString(body?.sedeId)
    const status = Object.prototype.hasOwnProperty.call(body ?? {}, 'status') ? parseTaskStatus(body?.status) : undefined
    const priority = Object.prototype.hasOwnProperty.call(body ?? {}, 'priority') ? parseTaskPriority(body?.priority) : undefined
    const dueAt = parseOptionalDate(body?.dueAt)
    const archived = Object.prototype.hasOwnProperty.call(body ?? {}, 'archived') ? Boolean(body?.archived) : undefined
    const attachmentsJson = Object.prototype.hasOwnProperty.call(body ?? {}, 'attachmentsJson') ? normalizeTaskAttachments(body?.attachmentsJson) : undefined
    const customFieldsJson = Object.prototype.hasOwnProperty.call(body ?? {}, 'customFieldsJson') ? normalizeTaskCustomFields(body?.customFieldsJson) : undefined
    const colorHex = Object.prototype.hasOwnProperty.call(body ?? {}, 'colorHex') ? normalizeTaskColorHex(body?.colorHex) : undefined

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'status') && !status) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'priority') && !priority) {
      return NextResponse.json({ error: 'priority inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'dueAt') && dueAt === undefined) {
      return NextResponse.json({ error: 'dueAt inválido' }, { status: 400 })
    }

    const nextWorkspace = Object.prototype.hasOwnProperty.call(body ?? {}, 'workspaceId')
      ? (workspaceId
          ? await getAccessibleTaskWorkspace(prisma, {
              workspaceId,
              empresaId: access.empresaId,
              userId: access.userId,
            })
          : null)
      : current.workspace

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'workspaceId') && workspaceId && !nextWorkspace) {
      return NextResponse.json({ error: 'workspaceId inválido' }, { status: 400 })
    }
    if (nextWorkspace && !canUserAccessWorkspace(nextWorkspace, access.userId, 'edit')) {
      return NextResponse.json({ error: 'No tienes permisos para mover o editar tareas en ese espacio.' }, { status: 403 })
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId') && projectId && !(Object.prototype.hasOwnProperty.call(body ?? {}, 'workspaceId') ? workspaceId : nextWorkspace?.id)) {
      return NextResponse.json({ error: 'projectId requiere workspaceId' }, { status: 400 })
    }

    const resolvedWorkspaceId = Object.prototype.hasOwnProperty.call(body ?? {}, 'workspaceId')
      ? workspaceId
      : nextWorkspace?.id || current.workspaceId || ''

    const nextProject = Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId')
      ? (projectId
          ? await prisma.crmTaskWorkspaceProject.findFirst({
              where: {
                id: projectId,
                workspaceId: resolvedWorkspaceId || '__none__',
                empresaId: access.empresaId,
              },
              select: { id: true },
            })
          : null)
      : current.project

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'workspaceId') && workspaceId && !(Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId') ? projectId : current.projectId)) {
      return NextResponse.json({ error: 'Selecciona un proyecto antes de mover la tarea a un espacio de trabajo.' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId') && projectId && !nextProject) {
      return NextResponse.json({ error: 'projectId inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId') && !projectId) {
      return NextResponse.json({ error: 'La tarea debe permanecer asociada a un proyecto del espacio.' }, { status: 400 })
    }

    const normalizedAssigneeIds = Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserIds')
      ? assignedToUserIds
      : Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId')
        ? (assignedToUserId ? [assignedToUserId] : [])
        : current.assignments.map((assignment) => assignment.userId)

    if (normalizedAssigneeIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: normalizedAssigneeIds }, empresaId: access.empresaId },
        select: { id: true },
      })
      if (users.length !== normalizedAssigneeIds.length) {
        return NextResponse.json({ error: 'assignedToUserIds inválido' }, { status: 400 })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') && explicitSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: explicitSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const nextStatus = status ?? current.status
    const assigneesWereUpdated = Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId') || Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserIds')
    const newlyAssignedUserIds = assigneesWereUpdated
      ? normalizedAssigneeIds.filter((userId) => !current.assignments.some((assignment) => assignment.userId === userId))
      : []
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmTask.update({
        where: { id: current.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'title') ? { title: title || current.title } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'description') ? { description: description || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'workspaceId') ? { workspaceId: workspaceId || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId') ? { projectId: projectId || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'colorHex') ? { colorHex } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(attachmentsJson ? { attachmentsJson } : {}),
          ...(customFieldsJson ? { customFieldsJson } : {}),
          ...(dueAt !== undefined ? { dueAt: dueAt ?? null } : {}),
          ...((Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId') || Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserIds')) ? { assignedToUserId: normalizedAssigneeIds[0] || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') ? { sedeId: explicitSedeId || null } : {}),
          ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
          ...(nextStatus === 'DONE' ? { completedAt: current.completedAt ?? new Date() } : {}),
          ...(nextStatus !== 'DONE' ? { completedAt: null } : {}),
        },
        include: crmTaskInclude,
      })

      if (assigneesWereUpdated) {
        await tx.crmTaskAssignment.deleteMany({ where: { taskId: current.id } })
        if (normalizedAssigneeIds.length) {
          await tx.crmTaskAssignment.createMany({
            data: normalizedAssigneeIds.map((userId) => ({
              empresaId: access.empresaId,
              taskId: current.id,
              userId,
            })),
          })
        }
      }

      const historyWrites: Array<Promise<unknown>> = []
      if (Object.prototype.hasOwnProperty.call(body ?? {}, 'title') || Object.prototype.hasOwnProperty.call(body ?? {}, 'description') || Object.prototype.hasOwnProperty.call(body ?? {}, 'workspaceId') || Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId')) {
        historyWrites.push(
          appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.id,
            actorUserId: access.userId,
            type: 'UPDATED',
            message: 'Se actualizaron los detalles de la tarea.',
          }),
        )
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, 'attachmentsJson')) {
        historyWrites.push(
          appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.id,
            actorUserId: access.userId,
            type: 'ATTACHMENTS_CHANGED',
            message: attachmentsJson?.length ? 'Se actualizaron los adjuntos de la tarea.' : 'Se removieron los adjuntos de la tarea.',
            metadata: { attachmentsCount: attachmentsJson?.length ?? 0 },
          }),
        )
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, 'customFieldsJson')) {
        historyWrites.push(
          appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.id,
            actorUserId: access.userId,
            type: 'CUSTOM_FIELDS_CHANGED',
            message: customFieldsJson?.length ? 'Se actualizaron los campos personalizados.' : 'Se removieron los campos personalizados.',
            metadata: { customFieldsCount: customFieldsJson?.length ?? 0 },
          }),
        )
      }
      if (status && status !== current.status) {
        historyWrites.push(
          appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.id,
            actorUserId: access.userId,
            type: 'STATUS_CHANGED',
            message: `Estado cambiado de ${current.status} a ${status}.`,
          }),
        )
      }
      if (priority && priority !== current.priority) {
        historyWrites.push(
          appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.id,
            actorUserId: access.userId,
            type: 'PRIORITY_CHANGED',
            message: `Prioridad cambiada de ${current.priority} a ${priority}.`,
          }),
        )
      }
      if (dueAt !== undefined) {
        const previous = current.dueAt?.toISOString() ?? null
        const next = dueAt?.toISOString() ?? null
        if (previous !== next) {
          historyWrites.push(
            appendTaskHistory(tx, {
              empresaId: access.empresaId,
              taskId: current.id,
              actorUserId: access.userId,
              type: 'DUE_DATE_CHANGED',
              message: next ? 'Se actualizó la fecha de vencimiento.' : 'Se removió la fecha de vencimiento.',
            }),
          )
        }
      }
      if (assigneesWereUpdated) {
        historyWrites.push(
          appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.id,
            actorUserId: access.userId,
            type: 'ASSIGNEES_CHANGED',
            message: normalizedAssigneeIds.length ? 'Se actualizó la asignación de responsables.' : 'Se removieron los responsables asignados.',
            metadata: { assignedToUserIds: normalizedAssigneeIds },
          }),
        )
      }
      if (archived !== undefined) {
        historyWrites.push(
          appendTaskHistory(tx, {
            empresaId: access.empresaId,
            taskId: current.id,
            actorUserId: access.userId,
            type: archived ? 'ARCHIVED' : 'RESTORED',
            message: archived ? 'La tarea fue archivada.' : 'La tarea fue restaurada.',
          }),
        )
      }

      await Promise.all(historyWrites)

      if (newlyAssignedUserIds.length) {
        await notifyTaskUsers({
          client: tx,
          empresaId: access.empresaId,
          sedeId: updated.sedeId,
          actorUserId: access.userId,
          recipientUserIds: newlyAssignedUserIds,
          title: newlyAssignedUserIds.length > 1 ? 'Fuiste agregado a una tarea de equipo' : 'Te asignaron una tarea',
          body: `La tarea ${updated.title} fue actualizada y ahora requiere tu seguimiento.`,
          taskId: updated.id,
          workspaceId: updated.workspaceId,
        })
      }

      if (status && status !== current.status) {
        await notifyTaskUsers({
          client: tx,
          empresaId: access.empresaId,
          sedeId: updated.sedeId,
          actorUserId: access.userId,
          recipientUserIds: normalizedAssigneeIds,
          title: 'Estado de tarea actualizado',
          body: `La tarea ${updated.title} cambió a ${updated.status}.`,
          taskId: updated.id,
          workspaceId: updated.workspaceId,
          type: updated.status === 'DONE' ? 'SUCCESS' : 'INFO',
        })
      }

      if (nextStatus === 'DONE' && current.status !== 'DONE') {
        await tx.crmActivity.create({
          data: {
            empresaId: access.empresaId,
            sedeId: updated.sedeId,
            type: 'TASK_DONE',
            summary: `Tarea completada: ${updated.title}`,
            leadId: updated.leadId,
            opportunityId: updated.opportunityId,
            clienteId: updated.clienteId,
            occurredAt: updated.completedAt ?? new Date(),
            createdById: access.userId,
          },
        })

        if (updated.leadId) {
          await tx.crmLead.update({ where: { id: updated.leadId }, data: { lastActivityAt: updated.completedAt ?? new Date() } })
        }
      }

      return updated
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error actualizando tarea CRM:', error)
    return NextResponse.json({ error: 'Error actualizando tarea CRM' }, { status: 500 })
  }
}