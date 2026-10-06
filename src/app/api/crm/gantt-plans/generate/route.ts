import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { generateGanttPlanDraft, getGanttAiConnectionStatus } from '@/lib/gantt-plan-ai'
import { createGanttPlanFromDraft } from '@/lib/gantt-plan-service'
import {
  canUserAccessWorkspace,
  getAccessibleTaskWorkspace,
} from '@/lib/crm-task-workspaces'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'

export const runtime = 'nodejs'
export const maxDuration = 60

function parseStartDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET() {
  const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
  if (!access.ok) return access.response
  return NextResponse.json({ success: true, data: getGanttAiConnectionStatus() })
}

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const prompt = normalizeString(body?.prompt)
    const workspaceId = normalizeString(body?.workspaceId)
    const projectId = normalizeString(body?.projectId)
    const startDateValue = typeof body?.startDate === 'string' ? body.startDate : ''
    const startDate = parseStartDate(startDateValue)
    if (prompt.length < 20) {
      return NextResponse.json({ error: 'Describe el proyecto con al menos 20 caracteres.' }, { status: 400 })
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'La descripción no puede superar 2000 caracteres.' }, { status: 400 })
    }
    if (!startDate) return NextResponse.json({ error: 'startDate inválido' }, { status: 400 })
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
    if (projectId) {
      const project = await prisma.crmTaskWorkspaceProject.findFirst({
        where: { id: projectId, workspaceId, empresaId: access.empresaId },
        select: { id: true },
      })
      if (!project) return NextResponse.json({ error: 'projectId inválido' }, { status: 400 })
    }

    const generated = await generateGanttPlanDraft({ prompt, startDate: startDateValue })
    const row = await createGanttPlanFromDraft({
      empresaId: access.empresaId,
      createdById: access.userId,
      name: generated.name,
      description: generated.description,
      colorHex: generated.colorHex,
      workspaceId: workspaceId || null,
      projectId: projectId || null,
      startDate,
      items: generated.items,
      dependencies: generated.dependencies,
    })
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error generando plan Gantt con IA:', error)
    const message = error instanceof Error ? error.message : 'No se pudo generar el plan Gantt.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
