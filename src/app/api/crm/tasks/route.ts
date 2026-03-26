import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
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

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const leadId = normalizeString(searchParams.get('leadId'))
    const opportunityId = normalizeString(searchParams.get('opportunityId'))
    const clienteId = normalizeString(searchParams.get('clienteId'))
    const workspaceId = normalizeString(searchParams.get('workspaceId'))
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
    }

    const rows = await prisma.crmTask.findMany({
      where: {
        empresaId: access.empresaId,
        ...(leadId ? { leadId } : {}),
        ...(opportunityId ? { opportunityId } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(workspaceId ? { workspaceId } : {}),
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
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const leadId = normalizeString(body?.leadId)
    const opportunityId = normalizeString(body?.opportunityId)
    const clienteId = normalizeString(body?.clienteId)
    const workspaceId = normalizeString(body?.workspaceId)
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const assignedToUserIds = normalizeUserIdList(body?.assignedToUserIds)
    const explicitSedeId = normalizeString(body?.sedeId)
    const status = parseTaskStatus(body?.status) ?? 'OPEN'
    const priority = parseTaskPriority(body?.priority) ?? 'NORMAL'
    const dueAt = parseOptionalDate(body?.dueAt)
    const attachmentsJson = normalizeTaskAttachments(body?.attachmentsJson)
    const customFieldsJson = normalizeTaskCustomFields(body?.customFieldsJson)
    const colorHex = normalizeTaskColorHex(body?.colorHex)

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

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error creando tarea CRM:', error)
    return NextResponse.json({ error: 'Error creando tarea CRM' }, { status: 500 })
  }
}