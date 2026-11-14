import { NextResponse } from 'next/server'
import type { CrmOpportunityStage, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { CRM_OPPORTUNITY_STAGES, normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

type PipelineStageInput = {
  key: CrmOpportunityStage
  label: string
  color: string | null
  sortOrder: number
}

function parseStages(value: unknown): { stages: PipelineStageInput[]; error: string | null } {
  if (!Array.isArray(value)) return { stages: [], error: 'stages debe ser un arreglo' }

  const stages: PipelineStageInput[] = []
  for (const item of value) {
    const row = item as Record<string, unknown>
    const key = normalizeString(row.key).toUpperCase() as CrmOpportunityStage
    if (!CRM_OPPORTUNITY_STAGES.includes(key)) {
      return { stages: [], error: `Etapa inválida: ${String(row.key)}` }
    }
    stages.push({
      key,
      label: normalizeString(row.label) || key,
      color: normalizeString(row.color) || null,
      sortOrder: stages.length,
    })
  }
  return { stages, error: null }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'PIPELINES',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const pipeline = await prisma.crmPipeline.findUnique({ where: { id } })
    if (!pipeline || pipeline.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Pipeline no encontrado' }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const isDefault = Object.prototype.hasOwnProperty.call(body ?? {}, 'isDefault')
      ? Boolean(body?.isDefault)
      : undefined
    const hasStages = Object.prototype.hasOwnProperty.call(body ?? {}, 'stages')
    const parsed = hasStages ? parseStages(body?.stages) : { stages: [], error: null }

    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.crmPipeline.updateMany({
          where: { empresaId: access.empresaId, isDefault: true, id: { not: pipeline.id } },
          data: { isDefault: false },
        })
      }

      return tx.crmPipeline.update({
        where: { id: pipeline.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'name') && name ? { name } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'description')
            ? { description: description || null }
            : {}),
          ...(isDefault !== undefined ? { isDefault } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'active')
            ? { active: Boolean(body?.active) }
            : {}),
          ...(hasStages ? { stagesJson: { stages: parsed.stages } as Prisma.InputJsonValue } : {}),
        },
      })
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error actualizando pipeline:', error)
    return NextResponse.json({ error: 'Error actualizando pipeline' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'PIPELINES',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const pipeline = await prisma.crmPipeline.findUnique({
      where: { id },
      include: { _count: { select: { opportunities: true } } },
    })
    if (!pipeline || pipeline.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Pipeline no encontrado' }, { status: 404 })
    }
    if (pipeline.isDefault) {
      return NextResponse.json({ error: 'No se puede eliminar el pipeline por defecto' }, { status: 409 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.crmOpportunity.updateMany({
        where: { empresaId: access.empresaId, pipelineId: pipeline.id },
        data: { pipelineId: null },
      })
      await tx.crmPipeline.delete({ where: { id: pipeline.id } })
    })

    return NextResponse.json({ success: true, reassignedOpportunities: pipeline._count.opportunities })
  } catch (error) {
    console.error('Error eliminando pipeline:', error)
    return NextResponse.json({ error: 'Error eliminando pipeline' }, { status: 500 })
  }
}
