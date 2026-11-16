import { NextResponse } from 'next/server'
import type { Prisma, WorkflowStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { parseWorkflowDefinitionJson, parseWorkflowTriggerJson, WORKFLOW_STATUSES } from '@/lib/workflows'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const workflow = await prisma.workflow.findFirst({
      where: { id, empresaId: access.empresaId },
      include: { runs: { orderBy: { startedAt: 'desc' }, take: 10 } },
    })
    if (!workflow) return NextResponse.json({ error: 'Workflow no encontrado' }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        ...workflow,
        trigger: parseWorkflowTriggerJson(workflow.triggerJson),
        definition: parseWorkflowDefinitionJson(workflow.definitionJson),
      },
    })
  } catch (error) {
    console.error('Error obteniendo workflow:', error)
    return NextResponse.json({ error: 'Error obteniendo workflow' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const existing = await prisma.workflow.findFirst({ where: { id, empresaId: access.empresaId } })
    if (!existing) return NextResponse.json({ error: 'Workflow no encontrado' }, { status: 404 })

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const data: Prisma.WorkflowUpdateInput = {}

    if (body?.name !== undefined) data.name = normalizeString(body.name)
    if (body?.description !== undefined) data.description = normalizeString(body.description) || null
    if (body?.status !== undefined) {
      const statusRaw = normalizeString(body.status).toUpperCase() as WorkflowStatus
      data.status = (WORKFLOW_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : existing.status
    }
    if (body?.triggerJson !== undefined || body?.trigger !== undefined) {
      data.triggerJson = parseWorkflowTriggerJson(body?.triggerJson ?? body?.trigger) as unknown as Prisma.InputJsonValue
    }
    if (body?.definitionJson !== undefined || body?.definition !== undefined) {
      data.definitionJson = parseWorkflowDefinitionJson(body?.definitionJson ?? body?.definition) as unknown as Prisma.InputJsonValue
    }

    const updated = await prisma.workflow.update({ where: { id }, data })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        trigger: parseWorkflowTriggerJson(updated.triggerJson),
        definition: parseWorkflowDefinitionJson(updated.definitionJson),
      },
    })
  } catch (error) {
    console.error('Error actualizando workflow:', error)
    return NextResponse.json({ error: 'Error actualizando workflow' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const existing = await prisma.workflow.findFirst({ where: { id, empresaId: access.empresaId } })
    if (!existing) return NextResponse.json({ error: 'Workflow no encontrado' }, { status: 404 })

    await prisma.workflow.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Error eliminando workflow:', error)
    return NextResponse.json({ error: 'Error eliminando workflow' }, { status: 500 })
  }
}
