import { NextResponse } from 'next/server'
import type { CrmOpportunityStage, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import {
  CRM_OPPORTUNITY_STAGES,
  DEFAULT_CRM_STAGE_SETTINGS,
  ensureCrmStageSettings,
  normalizeString,
} from '@/lib/crm'

export const runtime = 'nodejs'

type PipelineStageInput = {
  key: CrmOpportunityStage
  label: string
  color: string | null
  sortOrder: number
}

function parseStages(value: unknown): { stages: PipelineStageInput[]; error: string | null } {
  if (value == null) return { stages: [], error: null }
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

function readPipelineStages(value: Prisma.JsonValue | null | undefined): PipelineStageInput[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const raw = (value as Record<string, unknown>).stages
  if (!Array.isArray(raw)) return []

  const stages: PipelineStageInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const key = normalizeString(row.key).toUpperCase() as CrmOpportunityStage
    if (!CRM_OPPORTUNITY_STAGES.includes(key)) continue
    stages.push({
      key,
      label: normalizeString(row.label) || key,
      color: normalizeString(row.color) || null,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : stages.length,
    })
  }
  return stages.sort((left, right) => left.sortOrder - right.sortOrder)
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'PIPELINES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const [pipelines, defaultStageSettings] = await Promise.all([
      prisma.crmPipeline.findMany({
        where: { empresaId: access.empresaId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: { _count: { select: { opportunities: true } } },
      }),
      ensureCrmStageSettings(prisma, access.empresaId),
    ])

    const defaultStages: PipelineStageInput[] = defaultStageSettings.length
      ? defaultStageSettings.map((stage) => ({
          key: stage.key,
          label: stage.label,
          color: stage.color,
          sortOrder: stage.sortOrder,
        }))
      : DEFAULT_CRM_STAGE_SETTINGS.map((stage) => ({
          key: stage.key,
          label: stage.label,
          color: stage.color ?? null,
          sortOrder: stage.sortOrder,
        }))

    return NextResponse.json({
      success: true,
      data: pipelines.map((pipeline) => {
        const stages = readPipelineStages(pipeline.stagesJson)
        return {
          ...pipeline,
          stages: stages.length ? stages : defaultStages,
          opportunitiesCount: pipeline._count.opportunities,
        }
      }),
      defaultStages,
    })
  } catch (error) {
    console.error('Error listando pipelines:', error)
    return NextResponse.json({ error: 'Error listando pipelines' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'PIPELINES',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const isDefault = Boolean(body?.isDefault)
    const active = body?.active !== false
    const parsed = parseStages(body?.stages)

    if (!name) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const stages = parsed.stages.length
      ? parsed.stages
      : DEFAULT_CRM_STAGE_SETTINGS.map((stage) => ({
          key: stage.key,
          label: stage.label,
          color: stage.color ?? null,
          sortOrder: stage.sortOrder,
        }))

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.crmPipeline.updateMany({
          where: { empresaId: access.empresaId, isDefault: true },
          data: { isDefault: false },
        })
      }

      return tx.crmPipeline.create({
        data: {
          empresaId: access.empresaId,
          name,
          description: description || null,
          isDefault,
          active,
          stagesJson: { stages } as Prisma.InputJsonValue,
          createdById: access.userId,
        },
      })
    })

    return NextResponse.json({ success: true, data: { ...created, stages } }, { status: 201 })
  } catch (error) {
    console.error('Error creando pipeline:', error)
    return NextResponse.json({ error: 'Error creando pipeline' }, { status: 500 })
  }
}
