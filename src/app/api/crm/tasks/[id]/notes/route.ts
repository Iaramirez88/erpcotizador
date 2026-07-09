import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { appendTaskHistory, canUserAccessWorkspace, getAccessibleTaskWorkspace, crmTaskInclude } from '@/lib/crm-task-workspaces'
import { notifyTaskUsers } from '@/lib/crm-task-notifications'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'COMMERCIAL_TASKS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const note = normalizeString(body?.note)

    if (!note) {
      return NextResponse.json({ error: 'note es requerido' }, { status: 400 })
    }

    const current = await prisma.crmTask.findUnique({
      where: { id },
      include: { workspace: true, assignments: { select: { userId: true } }, createdBy: { select: { id: true } } },
    })

    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    if (current.workspaceId) {
      const workspace = await getAccessibleTaskWorkspace(prisma, { workspaceId: current.workspaceId, empresaId: access.empresaId, userId: access.userId })
      if (!workspace) {
        return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
      }
      if (!canUserAccessWorkspace(workspace, access.userId, 'edit')) {
        return NextResponse.json({ error: 'No tienes permisos para agregar notas en este espacio.' }, { status: 403 })
      }
    }

    await appendTaskHistory(prisma, {
      empresaId: access.empresaId,
      taskId: current.id,
      actorUserId: access.userId,
      type: 'NOTE_ADDED',
      message: note,
    })

    await notifyTaskUsers({
      client: prisma,
      empresaId: access.empresaId,
      sedeId: current.sedeId,
      actorUserId: access.userId,
      recipientUserIds: [current.createdBy?.id || '', ...current.assignments.map((assignment) => assignment.userId)],
      title: 'Nueva nota en tarea',
      body: `Agregaron una nota en ${current.title}.`,
      taskId: current.id,
      workspaceId: current.workspaceId,
      type: 'INFO',
    })

    const row = await prisma.crmTask.findUnique({
      where: { id: current.id },
      include: crmTaskInclude,
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error agregando nota a tarea CRM:', error)
    return NextResponse.json({ error: 'Error agregando nota a tarea CRM' }, { status: 500 })
  }
}