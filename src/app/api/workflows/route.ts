import { NextResponse } from 'next/server'
import type { Prisma, WorkflowStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { parseWorkflowDefinitionJson, parseWorkflowTriggerJson, WORKFLOW_STATUSES } from '@/lib/workflows'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const workflows = await prisma.workflow.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { runs: true } } },
    })

    return NextResponse.json({
      success: true,
      data: workflows.map((workflow) => ({
        ...workflow,
        trigger: parseWorkflowTriggerJson(workflow.triggerJson),
        definition: parseWorkflowDefinitionJson(workflow.definitionJson),
      })),
    })
  } catch (error) {
    console.error('Error listando workflows:', error)
    return NextResponse.json({ error: 'Error listando workflows' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const statusRaw = normalizeString(body?.status).toUpperCase() as WorkflowStatus
    const status: WorkflowStatus = (WORKFLOW_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : 'DRAFT'
    const trigger = parseWorkflowTriggerJson(body?.triggerJson ?? body?.trigger)
    const definition = parseWorkflowDefinitionJson(body?.definitionJson ?? body?.definition)

    if (!name) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })

    const created = await prisma.workflow.create({
      data: {
        empresaId: access.empresaId,
        name,
        description: description || null,
        status,
        triggerJson: trigger as unknown as Prisma.InputJsonValue,
        definitionJson: definition as unknown as Prisma.InputJsonValue,
        createdById: access.userId,
      },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creando workflow:', error)
    return NextResponse.json({ error: 'Error creando workflow' }, { status: 500 })
  }
}

