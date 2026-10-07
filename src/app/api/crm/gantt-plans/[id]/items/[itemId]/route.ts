import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString, parseOptionalDate, parseTaskPriority, parseTaskStatus } from '@/lib/crm'
import { canUserAccessWorkspace, getAccessibleTaskWorkspace, normalizeTaskColorHex } from '@/lib/crm-task-workspaces'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string; itemId: string }> }

async function editableItem(planId: string, itemId: string, empresaId: string, userId: string) {
  const item = await prisma.crmGanttItem.findFirst({ where: { id: itemId, planId, plan: { empresaId, archivedAt: null } }, include: { plan: { select: { workspaceId: true, createdById: true } } } })
  if (!item) return { error: NextResponse.json({ error: 'Actividad Gantt no encontrada.' }, { status: 404 }) }
  if (!item.plan.workspaceId) return item.plan.createdById === userId ? { item } : { error: NextResponse.json({ error: 'No tienes permisos para modificar esta actividad.' }, { status: 403 }) }
  const workspace = await getAccessibleTaskWorkspace(prisma, { workspaceId: item.plan.workspaceId, empresaId, userId })
  return workspace && canUserAccessWorkspace(workspace, userId, 'edit') ? { item } : { error: NextResponse.json({ error: 'No tienes permisos para modificar esta actividad.' }, { status: 403 }) }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'UPDATE', scope: 'SEDE' })
    if (!access.ok) return access.response
    const { id, itemId } = await context.params
    const current = await editableItem(id, itemId, access.empresaId, access.userId)
    if ('error' in current) return current.error
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (Number.isInteger(body?.reorderToIndex)) {
      const ordered = await prisma.crmGanttItem.findMany({ where: { planId: id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true } })
      const withoutCurrent = ordered.filter((item) => item.id !== itemId)
      const targetIndex = Math.max(0, Math.min(withoutCurrent.length, Number(body?.reorderToIndex)))
      withoutCurrent.splice(targetIndex, 0, { id: itemId })
      await prisma.$transaction(withoutCurrent.map((item, index) => prisma.crmGanttItem.update({ where: { id: item.id }, data: { sortOrder: index } })))
      return NextResponse.json({ success: true })
    }
    const title = normalizeString(body?.title)
    const startAt = parseOptionalDate(body?.startAt)
    const isMilestone = Boolean(body?.isMilestone)
    const dueAt = isMilestone ? startAt : parseOptionalDate(body?.dueAt)
    const progress = Math.round(Number(body?.progress ?? 0))
    const parentItemId = normalizeString(body?.parentItemId) || null
    if (!title || !startAt || !dueAt || dueAt < startAt) return NextResponse.json({ error: 'Revisa el nombre y el rango de fechas.' }, { status: 400 })
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) return NextResponse.json({ error: 'El avance debe estar entre 0 y 100.' }, { status: 400 })
    if (parentItemId) {
      const hierarchy = await prisma.crmGanttItem.findMany({ where: { planId: id }, select: { id: true, parentItemId: true } })
      const parents = new Map(hierarchy.map((item) => [item.id, item.parentItemId]))
      let candidate: string | null = parentItemId
      while (candidate) {
        if (candidate === itemId) return NextResponse.json({ error: 'La jerarquía produciría un ciclo.' }, { status: 400 })
        candidate = parents.get(candidate) || null
      }
      if (!parents.has(parentItemId)) return NextResponse.json({ error: 'La actividad padre no pertenece al plan.' }, { status: 400 })
    }
    const row = await prisma.crmGanttItem.update({ where: { id: itemId }, data: { title: title.slice(0, 240), description: normalizeString(body?.description).slice(0, 20_000) || null, parentItemId, startAt, dueAt, isMilestone, progress, status: parseTaskStatus(body?.status) ?? current.item.status, priority: parseTaskPriority(body?.priority) ?? current.item.priority, colorHex: normalizeTaskColorHex(body?.colorHex) }, include: { linkedTask: { select: { id: true, title: true } }, predecessorLinks: true, successorLinks: true } })
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error actualizando actividad Gantt:', error)
    return NextResponse.json({ error: 'No se pudo actualizar la actividad.' }, { status: 500 })
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response
    const { id, itemId } = await context.params
    const current = await editableItem(id, itemId, access.empresaId, access.userId)
    if ('error' in current) return current.error
    const aggregate = await prisma.crmGanttItem.aggregate({ where: { planId: id }, _max: { sortOrder: true } })
    const source = current.item
    const row = await prisma.crmGanttItem.create({ data: { planId: id, linkedTaskId: source.linkedTaskId, parentItemId: source.parentItemId, title: `${source.title} (copia)`, description: source.description, colorHex: source.colorHex, status: source.status, priority: source.priority, startAt: source.startAt, dueAt: source.dueAt, progress: source.progress, isMilestone: source.isMilestone, sortOrder: (aggregate._max.sortOrder ?? -1) + 1 }, include: { linkedTask: { select: { id: true, title: true } }, predecessorLinks: true, successorLinks: true } })
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error duplicando actividad Gantt:', error)
    return NextResponse.json({ error: 'No se pudo duplicar la actividad.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'DELETE', scope: 'SEDE' })
    if (!access.ok) return access.response
    const { id, itemId } = await context.params
    const current = await editableItem(id, itemId, access.empresaId, access.userId)
    if ('error' in current) return current.error
    await prisma.crmGanttItem.delete({ where: { id: current.item.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando actividad Gantt:', error)
    return NextResponse.json({ error: 'No se pudo eliminar la actividad.' }, { status: 500 })
  }
}