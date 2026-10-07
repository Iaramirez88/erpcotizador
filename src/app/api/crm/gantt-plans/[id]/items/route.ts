import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeString,
  parseOptionalDate,
  parseTaskPriority,
  parseTaskStatus,
} from '@/lib/crm'
import {
  canUserAccessWorkspace,
  getAccessibleTaskWorkspace,
  normalizeTaskColorHex,
} from '@/lib/crm-task-workspaces'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const { id } = await context.params
    const plan = await prisma.crmGanttPlan.findFirst({
      where: { id, empresaId: access.empresaId, archivedAt: null },
      select: { id: true, workspaceId: true, createdById: true },
    })
    if (!plan) return NextResponse.json({ error: 'Plan Gantt no encontrado' }, { status: 404 })

    if (plan.workspaceId) {
      const workspace = await getAccessibleTaskWorkspace(prisma, {
        workspaceId: plan.workspaceId,
        empresaId: access.empresaId,
        userId: access.userId,
      })
      if (!workspace || !canUserAccessWorkspace(workspace, access.userId, 'edit')) {
        return NextResponse.json({ error: 'No tienes permisos para editar este plan.' }, { status: 403 })
      }
    } else if (plan.createdById !== access.userId) {
      return NextResponse.json({ error: 'No tienes permisos para editar este plan.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const parentItemId = normalizeString(body?.parentItemId)
    const linkedTaskId = normalizeString(body?.linkedTaskId)
    const startAt = parseOptionalDate(body?.startAt)
    const requestedDueAt = parseOptionalDate(body?.dueAt)
    const isMilestone = Boolean(body?.isMilestone)
    const dueAt = isMilestone ? startAt : requestedDueAt
    const status = parseTaskStatus(body?.status) ?? 'OPEN'
    const priority = parseTaskPriority(body?.priority) ?? 'NORMAL'
    const progress = Math.round(Number(body?.progress ?? 0))

    if (!title) return NextResponse.json({ error: 'title es requerido' }, { status: 400 })
    if (!startAt || !dueAt) {
      return NextResponse.json({ error: 'startAt y dueAt son requeridos' }, { status: 400 })
    }
    if (dueAt < startAt) {
      return NextResponse.json({ error: 'dueAt no puede ser anterior a startAt' }, { status: 400 })
    }
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      return NextResponse.json({ error: 'progress debe estar entre 0 y 100' }, { status: 400 })
    }

    if (parentItemId) {
      const parent = await prisma.crmGanttItem.findFirst({
        where: { id: parentItemId, planId: plan.id },
        select: { id: true },
      })
      if (!parent) return NextResponse.json({ error: 'parentItemId inválido' }, { status: 400 })
    }

    if (linkedTaskId) {
      const task = await prisma.crmTask.findFirst({
        where: { id: linkedTaskId, empresaId: access.empresaId },
        select: { id: true },
      })
      if (!task) return NextResponse.json({ error: 'linkedTaskId inválido' }, { status: 400 })
    }

    const row = await prisma.$transaction(async (tx) => {
      const ordered = await tx.crmGanttItem.findMany({ where: { planId: plan.id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { startAt: true } })
      const insertionIndex = ordered.findIndex((item) => item.startAt > startAt)
      const sortOrder = insertionIndex === -1 ? ordered.length : insertionIndex
      await tx.crmGanttItem.updateMany({ where: { planId: plan.id, sortOrder: { gte: sortOrder } }, data: { sortOrder: { increment: 1 } } })
      return tx.crmGanttItem.create({
        data: {
          planId: plan.id,
          title,
          description: description || null,
          parentItemId: parentItemId || null,
          linkedTaskId: linkedTaskId || null,
          startAt,
          dueAt,
          isMilestone,
          progress,
          status,
          priority,
          colorHex: normalizeTaskColorHex(body?.colorHex),
          sortOrder,
        },
        include: {
          linkedTask: { select: { id: true, title: true } },
          predecessorLinks: true,
          successorLinks: true,
        },
      })
    })
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error creando elemento Gantt:', error)
    return NextResponse.json({ error: 'Error creando elemento Gantt' }, { status: 500 })
  }
}
