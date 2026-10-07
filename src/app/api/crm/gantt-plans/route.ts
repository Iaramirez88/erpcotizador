import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import {
  canUserAccessWorkspace,
  getAccessibleTaskWorkspace,
  getAccessibleTaskWorkspaceIds,
  normalizeTaskColorHex,
} from '@/lib/crm-task-workspaces'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'
import { getGanttPlanTemplate } from '@/lib/gantt-plan-templates'
import { createGanttPlanFromDraft, ganttPlanInclude } from '@/lib/gantt-plan-service'
import { getGanttPlanAccess } from '@/lib/gantt-plan-access'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response

    const accessibleWorkspaceIds = await getAccessibleTaskWorkspaceIds(prisma, {
      empresaId: access.empresaId,
      userId: access.userId,
    })
    const rows = await prisma.crmGanttPlan.findMany({
      where: {
        empresaId: access.empresaId,
        archivedAt: null,
        OR: [
          { workspaceId: { in: accessibleWorkspaceIds.length ? accessibleWorkspaceIds : ['__none__'] } },
          { workspaceId: null, createdById: access.userId },
          { members: { some: { userId: access.userId } } },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: ganttPlanInclude,
    })
    const plans = await Promise.all(rows.map(async (plan) => {
      const planAccess = await getGanttPlanAccess(plan.id, access.empresaId, access.userId)
      return {
        ...plan,
        canEdit: Boolean(planAccess?.canEdit),
        items: plan.items.map((item) => {
          const lastReadAt = item.reads.find((read) => read.userId === access.userId)?.lastReadAt
          return {
            ...item,
            reads: undefined,
            comments: item.comments.map((comment) => ({ ...comment, isCurrentUser: comment.authorUserId === access.userId })),
            hasUnreadComments: item.comments.some((comment) => comment.authorUserId !== access.userId && (!lastReadAt || comment.createdAt > lastReadAt)),
          }
        }),
      }
    }))
    return NextResponse.json({ success: true, data: plans })
  } catch (error) {
    console.error('Error listando planes Gantt:', error)
    return NextResponse.json({ error: 'Error listando planes Gantt' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const workspaceId = normalizeString(body?.workspaceId)
    const projectId = normalizeString(body?.projectId)
    const templateId = normalizeString(body?.templateId)
    const template = templateId ? getGanttPlanTemplate(templateId) : null
    const startDate = parseStartDate(body?.startDate)
    if (!name && !template) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    if (templateId && !template) return NextResponse.json({ error: 'templateId inválido' }, { status: 400 })
    if (template && !startDate) return NextResponse.json({ error: 'startDate inválido' }, { status: 400 })
    if (projectId && !workspaceId) {
      return NextResponse.json({ error: 'projectId requiere workspaceId' }, { status: 400 })
    }

    const workspace = workspaceId
      ? await getAccessibleTaskWorkspace(prisma, {
          workspaceId,
          empresaId: access.empresaId,
          userId: access.userId,
        })
      : null
    if (workspaceId && (!workspace || !canUserAccessWorkspace(workspace, access.userId, 'edit'))) {
      return NextResponse.json({ error: 'No tienes permisos para vincular ese proyecto.' }, { status: 403 })
    }

    const project = projectId
      ? await prisma.crmTaskWorkspaceProject.findFirst({
          where: { id: projectId, workspaceId, empresaId: access.empresaId },
          select: { id: true },
        })
      : null
    if (projectId && !project) {
      return NextResponse.json({ error: 'projectId inválido' }, { status: 400 })
    }

    const row = template
      ? await createGanttPlanFromDraft({
          empresaId: access.empresaId,
          createdById: access.userId,
          name: name || template.name,
          description: description || template.description,
          colorHex: template.colorHex,
          workspaceId: workspaceId || null,
          projectId: projectId || null,
          startDate: startDate!,
          items: template.items.map((item) => ({
            title: item.title,
            colorHex: item.colorHex,
            offsetDays: item.offsetDays,
            durationDays: item.durationDays,
            isMilestone: item.isMilestone,
            parentIndex: item.parentKey
              ? template.items.findIndex((candidate) => candidate.key === item.parentKey)
              : null,
          })),
        })
      : await prisma.crmGanttPlan.create({
      data: {
        empresaId: access.empresaId,
        createdById: access.userId,
        name,
        description: description || null,
        colorHex: normalizeTaskColorHex(body?.colorHex),
        workspaceId: workspaceId || null,
        projectId: projectId || null,
      },
      include: ganttPlanInclude,
    })
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error creando plan Gantt:', error)
    return NextResponse.json({ error: 'Error creando plan Gantt' }, { status: 500 })
  }
}

function parseStartDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
