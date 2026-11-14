import { NextResponse } from 'next/server'
import type { CrmSequenceStatus, CrmSequenceStepKind, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { parseCrmSequenceTriggerJson } from '@/lib/crm-sequences'

export const runtime = 'nodejs'

const STATUSES: CrmSequenceStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']
const STEP_KINDS: CrmSequenceStepKind[] = ['EMAIL', 'WHATSAPP', 'TASK', 'WAIT', 'WEBHOOK']

type StepInput = {
  order: number
  kind: CrmSequenceStepKind
  delayDays: number
  subject: string | null
  bodyHtml: string | null
  taskTitle: string | null
}

function parseSteps(value: unknown): { steps: StepInput[]; error: string | null } {
  if (!Array.isArray(value)) return { steps: [], error: null }
  const steps: StepInput[] = []

  for (const item of value) {
    const row = item as Record<string, unknown>
    const kind = normalizeString(row.kind).toUpperCase() as CrmSequenceStepKind
    if (!STEP_KINDS.includes(kind)) return { steps: [], error: `kind inválido: ${String(row.kind)}` }
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

  return {
    steps: steps.map((step, index) => ({ ...step, order: index + 1 })),
    error: null,
  }
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SEQUENCES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const sequences = await prisma.crmSequence.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: sequences.map((sequence) => ({
        ...sequence,
        trigger: parseCrmSequenceTriggerJson(sequence.triggerJson),
      })),
    })
  } catch (error) {
    console.error('Error listando secuencias:', error)
    return NextResponse.json({ error: 'Error listando secuencias' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SEQUENCES',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const statusRaw = normalizeString(body?.status).toUpperCase() as CrmSequenceStatus
    const status = STATUSES.includes(statusRaw) ? statusRaw : 'DRAFT'
    const trigger = parseCrmSequenceTriggerJson(body?.triggerJson ?? body?.trigger)
    const stopOnOpportunity = body?.stopOnOpportunity !== false
    const stopOnReply = body?.stopOnReply !== false
    const parsedSteps = parseSteps(body?.steps)

    if (!name) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    if (parsedSteps.error) return NextResponse.json({ error: parsedSteps.error }, { status: 400 })
    if (status === 'ACTIVE' && !parsedSteps.steps.length) {
      return NextResponse.json({ error: 'Una secuencia activa requiere al menos un paso' }, { status: 400 })
    }

    const created = await prisma.crmSequence.create({
      data: {
        empresaId: access.empresaId,
        name,
        description: description || null,
        status,
        triggerJson: trigger as Prisma.InputJsonValue,
        stopOnOpportunity,
        stopOnReply,
        createdById: access.userId,
        steps: {
          create: parsedSteps.steps.map((step) => ({
            order: step.order,
            kind: step.kind,
            delayDays: step.delayDays,
            subject: step.subject,
            bodyHtml: step.bodyHtml,
            taskTitle: step.taskTitle,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creando secuencia:', error)
    return NextResponse.json({ error: 'Error creando secuencia' }, { status: 500 })
  }
}
