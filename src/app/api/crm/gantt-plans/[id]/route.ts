import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { canUserAccessWorkspace, getAccessibleTaskWorkspace, normalizeTaskColorHex } from '@/lib/crm-task-workspaces'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'
import { ganttPlanInclude } from '@/lib/gantt-plan-service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

async function editablePlan(id: string, empresaId: string, userId: string, capability: 'edit' | 'manage') {
  const plan = await prisma.crmGanttPlan.findFirst({ where: { id, empresaId, archivedAt: null } })
  if (!plan) return { error: NextResponse.json({ error: 'Plan Gantt no encontrado.' }, { status: 404 }) }
  if (!plan.workspaceId) {
    return plan.createdById === userId ? { plan } : { error: NextResponse.json({ error: 'No tienes permisos para modificar este plan.' }, { status: 403 }) }
  }
  const workspace = await getAccessibleTaskWorkspace(prisma, { workspaceId: plan.workspaceId, empresaId, userId })
  return workspace && canUserAccessWorkspace(workspace, userId, capability)
    ? { plan }
    : { error: NextResponse.json({ error: 'No tienes permisos para modificar este plan.' }, { status: 403 }) }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'UPDATE', scope: 'SEDE' })
    if (!access.ok) return access.response
    const { id } = await context.params
    const current = await editablePlan(id, access.empresaId, access.userId, 'edit')
    if ('error' in current) return current.error
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    if (!name) return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 })
    const row = await prisma.crmGanttPlan.update({
      where: { id: current.plan.id },
      data: { name: name.slice(0, 180), description: normalizeString(body?.description).slice(0, 10_000) || null, colorHex: normalizeTaskColorHex(body?.colorHex) },
      include: ganttPlanInclude,
    })
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error actualizando plan Gantt:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el plan Gantt.' }, { status: 500 })
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response
    const { id } = await context.params
    const current = await editablePlan(id, access.empresaId, access.userId, 'edit')
    if ('error' in current) return current.error
    const source = await prisma.crmGanttPlan.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { sortOrder: 'asc' }, include: { predecessorLinks: true } } } })
    const row = await prisma.$transaction(async (tx) => {
      const copy = await tx.crmGanttPlan.create({ data: { empresaId: access.empresaId, createdById: access.userId, workspaceId: source.workspaceId, projectId: source.projectId, name: `${source.name} (copia)`, description: source.description, colorHex: source.colorHex } })
      const itemIds = new Map<string, string>()
      for (const item of source.items) {
        const created = await tx.crmGanttItem.create({ data: { planId: copy.id, linkedTaskId: item.linkedTaskId, title: item.title, description: item.description, colorHex: item.colorHex, status: item.status, priority: item.priority, startAt: item.startAt, dueAt: item.dueAt, progress: item.progress, isMilestone: item.isMilestone, sortOrder: item.sortOrder } })
        itemIds.set(item.id, created.id)
      }
      for (const item of source.items) {
        const parentItemId = item.parentItemId ? itemIds.get(item.parentItemId) : null
        if (parentItemId) await tx.crmGanttItem.update({ where: { id: itemIds.get(item.id)! }, data: { parentItemId } })
      }
      const dependencies = source.items.flatMap((item) => item.predecessorLinks).map((link) => ({ predecessorItemId: itemIds.get(link.predecessorItemId), successorItemId: itemIds.get(link.successorItemId), type: link.type, lagDays: link.lagDays })).filter((link): link is { predecessorItemId: string; successorItemId: string; type: string; lagDays: number } => Boolean(link.predecessorItemId && link.successorItemId))
      if (dependencies.length) await tx.crmGanttDependency.createMany({ data: dependencies })
      return tx.crmGanttPlan.findUniqueOrThrow({ where: { id: copy.id }, include: ganttPlanInclude })
    })
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error duplicando plan Gantt:', error)
    return NextResponse.json({ error: 'No se pudo duplicar el plan Gantt.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'DELETE', scope: 'SEDE' })
    if (!access.ok) return access.response
    const { id } = await context.params
    const current = await editablePlan(id, access.empresaId, access.userId, 'manage')
    if ('error' in current) return current.error
    await prisma.crmGanttPlan.delete({ where: { id: current.plan.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando plan Gantt:', error)
    return NextResponse.json({ error: 'No se pudo eliminar el plan Gantt.' }, { status: 500 })
  }
}