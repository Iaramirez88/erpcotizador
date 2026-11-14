import { NextResponse } from 'next/server'
import type { CrmScoreEventType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { CRM_SCORE_EVENT_LABELS, DEFAULT_CRM_SCORING_RULES, ensureCrmScoringRules } from '@/lib/crm-scoring'

export const runtime = 'nodejs'

const EVENT_TYPES = Object.keys(CRM_SCORE_EVENT_LABELS) as CrmScoreEventType[]

function parseEventType(value: unknown): CrmScoreEventType | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return EVENT_TYPES.includes(raw as CrmScoreEventType) ? (raw as CrmScoreEventType) : null
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SCORING',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const rules = await ensureCrmScoringRules(prisma, access.empresaId)

    return NextResponse.json({
      success: true,
      data: rules.map((rule) => ({ ...rule, label: CRM_SCORE_EVENT_LABELS[rule.eventType] })),
    })
  } catch (error) {
    console.error('Error obteniendo reglas de scoring:', error)
    return NextResponse.json({ error: 'Error obteniendo reglas de scoring' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SCORING',
      action: 'CONFIGURE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const incoming = Array.isArray(body?.rules) ? body.rules : []

    if (!incoming.length) {
      return NextResponse.json({ error: 'rules es requerido' }, { status: 400 })
    }

    const parsed: Array<{
      eventType: CrmScoreEventType
      points: number
      active: boolean
      oncePerLead: boolean
      dedupeWindowHours: number
      maxPerLead: number | null
      notes: string | null
    }> = []

    for (const item of incoming) {
      const row = item as Record<string, unknown>
      const eventType = parseEventType(row.eventType)
      if (!eventType) {
        return NextResponse.json({ error: `eventType inválido: ${String(row.eventType)}` }, { status: 400 })
      }
      const pointsRaw = Number(row.points)
      const windowRaw = Number(row.dedupeWindowHours ?? 0)
      const maxRaw = row.maxPerLead == null ? null : Number(row.maxPerLead)

      parsed.push({
        eventType,
        points: Number.isFinite(pointsRaw) ? Math.trunc(pointsRaw) : 0,
        active: row.active !== false,
        oncePerLead: row.oncePerLead !== false,
        dedupeWindowHours: Number.isFinite(windowRaw) ? Math.max(0, Math.trunc(windowRaw)) : 0,
        maxPerLead: maxRaw != null && Number.isFinite(maxRaw) ? Math.max(0, Math.trunc(maxRaw)) : null,
        notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null,
      })
    }

    await ensureCrmScoringRules(prisma, access.empresaId)

    await prisma.$transaction(
      parsed.map((rule) =>
        prisma.crmScoringRule.upsert({
          where: { empresaId_eventType: { empresaId: access.empresaId, eventType: rule.eventType } },
          create: {
            empresaId: access.empresaId,
            eventType: rule.eventType,
            points: rule.points,
            active: rule.active,
            oncePerLead: rule.oncePerLead,
            dedupeWindowHours: rule.dedupeWindowHours,
            maxPerLead: rule.maxPerLead,
            notes:
              rule.notes ??
              DEFAULT_CRM_SCORING_RULES.find((item) => item.eventType === rule.eventType)?.notes ??
              null,
          },
          update: {
            points: rule.points,
            active: rule.active,
            oncePerLead: rule.oncePerLead,
            dedupeWindowHours: rule.dedupeWindowHours,
            maxPerLead: rule.maxPerLead,
            ...(rule.notes ? { notes: rule.notes } : {}),
          },
        })
      )
    )

    const rules = await prisma.crmScoringRule.findMany({
      where: { empresaId: access.empresaId },
      orderBy: { eventType: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: rules.map((rule) => ({ ...rule, label: CRM_SCORE_EVENT_LABELS[rule.eventType] })),
    })
  } catch (error) {
    console.error('Error actualizando reglas de scoring:', error)
    return NextResponse.json({ error: 'Error actualizando reglas de scoring' }, { status: 500 })
  }
}
