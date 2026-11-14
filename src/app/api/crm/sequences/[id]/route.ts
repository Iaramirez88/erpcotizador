import { NextResponse } from 'next/server'
import type { CrmSequenceStatus, CrmSequenceStepKind, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { parseCrmSequenceTriggerJson } from '@/lib/crm-sequences'

export const runtime = 'nodejs'

const STATUSES: CrmSequenceStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']
const STEP_KINDS: CrmSequenceStepKind[] = ['EMAIL', 'WHATSAPP', 'TASK', 'WAIT', 'WEBHOOK']

interface RouteContext {
  params: Promise<{ id: string }>
}

async function loadSequence(id: string, empresaId: string) {
  const sequence = await prisma.crmSequence.findUnique({ where: { id } })
  if (!sequence || sequence.empresaId !== empresaId) return null
  return sequence
}

type StepInput = {
  order: number
  kind: CrmSequenceStepKind
  delayDays: number
  subject: string | null
  bodyHtml: string | null
  taskTitle: string | null
}

function parseStepsInput(value: unknown): { steps: StepInput[] | null; error: string | null } {
  if (!Array.isArray(value)) return { steps: null, error: null }
  const steps: StepInput[] = []

  for (const item of value) {
    const row = item as Record<string, unknown>
    const kind = normalizeString(row.kind).toUpperCase() as CrmSequenceStepKind
    if (!STEP_KINDS.includes(kind)) return { steps: null, error: `kind inválido: ${String(row.kind)}` }
    const delayRaw = Number(row.delayDays ?? 0)
    steps.push({
      order: 0,
      kind,
      delayDays: Number.isFinite(delayRaw) ? Math.max(0, Math.trunc(delayRaw)) : 0,
      subject: normalizeString(row.subject) || null,
      bodyHtml: normalizeString(row.bodyHtml) || null,
      taskTitle: normalizeString(row.taskTitle) || null,
    })
  }

  return { steps: steps.map((step, index) => ({ ...step, order: index + 1 })), error: null }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SEQUENCES',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const sequence = await loadSequence(id, access.empresaId)
    if (!sequence) return NextResponse.json({ error: 'Secuencia no encontrada' }, { status: 404 })

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const statusRaw = normalizeString(body?.status).toUpperCase() as CrmSequenceStatus
    const status = STATUSES.includes(statusRaw) ? statusRaw : null
    const parsedSteps = parseStepsInput(body?.steps)
    const steps = parsedSteps.steps

    if (parsedSteps.error) {
      return NextResponse.json({ error: parsedSteps.error }, { status: 400 })
    }

    if (status === 'ACTIVE') {
      const stepCount = steps
        ? steps.length
        : await prisma.crmSequenceStep.count({ where: { sequenceId: sequence.id } })
      if (!stepCount) {
        return NextResponse.json({ error: 'Una secuencia activa requiere al menos un paso' }, { status: 400 })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (steps) {
        await tx.crmSequenceStep.deleteMany({ where: { sequenceId: sequence.id } })
      }

      return tx.crmSequence.update({
        where: { id: sequence.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'name') && name ? { name } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'description')
            ? { description: description || null }
            : {}),
          ...(status ? { status } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'triggerJson') ||
          Object.prototype.hasOwnProperty.call(body ?? {}, 'trigger')
            ? {
                triggerJson: parseCrmSequenceTriggerJson(
                  body?.triggerJson ?? body?.trigger
                ) as Prisma.InputJsonValue,
              }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'stopOnOpportunity')
            ? { stopOnOpportunity: Boolean(body?.stopOnOpportunity) }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'stopOnReply')
            ? { stopOnReply: Boolean(body?.stopOnReply) }
            : {}),
          ...(steps
            ? {
                steps: {
                  create: steps.map((step) => ({
                    order: step.order,
                    kind: step.kind,
                    delayDays: step.delayDays,
                    subject: step.subject,
                    bodyHtml: step.bodyHtml,
                    taskTitle: step.taskTitle,
                  })),
                },
              }
            : {}),
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      })
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error actualizando secuencia:', error)
    return NextResponse.json({ error: 'Error actualizando secuencia' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SEQUENCES',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const sequence = await loadSequence(id, access.empresaId)
    if (!sequence) return NextResponse.json({ error: 'Secuencia no encontrada' }, { status: 404 })

    const activeEnrollments = await prisma.crmSequenceEnrollment.count({
      where: { sequenceId: sequence.id, status: 'ACTIVE' },
    })

    const archived = await prisma.crmSequence.update({
      where: { id: sequence.id },
      data: { status: 'ARCHIVED' },
    })

    if (activeEnrollments) {
      await prisma.crmSequenceEnrollment.updateMany({
        where: { sequenceId: sequence.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED', stoppedReason: 'Secuencia archivada', nextRunAt: null },
      })
    }

    return NextResponse.json({ success: true, data: archived, cancelledEnrollments: activeEnrollments })
  } catch (error) {
    console.error('Error archivando secuencia:', error)
    return NextResponse.json({ error: 'Error archivando secuencia' }, { status: 500 })
  }
}

