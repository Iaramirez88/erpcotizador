import type { CrmLead, CrmLeadScoreBand, CrmLeadScoreEvent, CrmScoreEventType, Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

/**
 * Motor de puntuación de leads.
 *
 * Fuente de verdad: `CrmLeadScoreEvent` (deduplicado por `(leadId, dedupeKey)`).
 * El agregado `lead.score` y `lead.scoreBand` se mantienen en la misma transacción
 * que el evento; `recalculateLeadScore()` reconstruye desde los eventos.
 */
export type CrmScoringClient = Pick<
  PrismaClient,
  | 'crmScoringSettings'
  | 'crmScoringRule'
  | 'crmLeadScoreEvent'
  | 'crmLead'
  | 'crmActivity'
>

export const DEFAULT_CRM_SCORING_RULES: Array<{
  eventType: CrmScoreEventType
  points: number
  notes: string
}> = [
  { eventType: 'DOCUMENT_DOWNLOAD', points: 10, notes: 'Descarga de documento o recurso entregado' },
  { eventType: 'EMAIL_OPEN', points: 2, notes: 'Apertura de correo de secuencia' },
  { eventType: 'LINK_CLICK', points: 5, notes: 'Clic en enlace rastreado' },
  { eventType: 'SERVICE_PAGE_VISIT', points: 10, notes: 'Visita a página de servicios' },
  { eventType: 'INFO_REQUEST', points: 20, notes: 'Solicitud de información' },
  { eventType: 'QUOTE_REQUEST', points: 30, notes: 'Solicitud de cotización' },
  { eventType: 'MEETING_BOOKED', points: 30, notes: 'Reunión agendada' },
  { eventType: 'MANUAL_ADJUSTMENT', points: 0, notes: 'Ajuste manual del asesor' },
]

export const CRM_SCORE_EVENT_LABELS: Record<CrmScoreEventType, string> = {
  DOCUMENT_DOWNLOAD: 'Descarga de documento',
  EMAIL_OPEN: 'Apertura de correo',
  LINK_CLICK: 'Clic en enlace',
  SERVICE_PAGE_VISIT: 'Visita a página de servicios',
  INFO_REQUEST: 'Solicitud de información',
  QUOTE_REQUEST: 'Solicitud de cotización',
  MEETING_BOOKED: 'Reunión agendada',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
}

export async function ensureCrmScoringSettings(client: CrmScoringClient, empresaId: string) {
  return client.crmScoringSettings.upsert({
    where: { empresaId },
    create: { empresaId },
    update: {},
  })
}

export async function ensureCrmScoringRules(client: CrmScoringClient, empresaId: string) {
  await Promise.all(
    DEFAULT_CRM_SCORING_RULES.map((rule) =>
      client.crmScoringRule.upsert({
        where: { empresaId_eventType: { empresaId, eventType: rule.eventType } },
        create: {
          empresaId,
          eventType: rule.eventType,
          points: rule.points,
          notes: rule.notes,
          oncePerLead: rule.eventType !== 'MANUAL_ADJUSTMENT',
        },
        update: {},
      })
    )
  )

  return client.crmScoringRule.findMany({
    where: { empresaId },
    orderBy: { eventType: 'asc' },
  })
}

export function resolveCrmScoreBand(
  score: number,
  settings: { warmThreshold: number; hotThreshold: number }
): CrmLeadScoreBand {
  if (score >= settings.hotThreshold) return 'HOT'
  if (score >= settings.warmThreshold) return 'WARM'
  return 'COLD'
}

function buildDedupeKey(args: {
  eventType: CrmScoreEventType
  oncePerLead: boolean
  dedupeWindowHours: number
  sourceId?: string | null
  occurredAt: Date
}) {
  if (args.oncePerLead) return `${args.eventType}:lead`

  if (args.dedupeWindowHours > 0) {
    const windowMs = args.dedupeWindowHours * 60 * 60 * 1000
    const bucket = Math.floor(args.occurredAt.getTime() / windowMs)
    return `${args.eventType}:window:${bucket}`
  }

  return `${args.eventType}:${args.sourceId?.trim() || randomUUID()}`
}

export type ApplyCrmScoreEventResult = {
  applied: boolean
  reason: 'applied' | 'rule-missing' | 'rule-inactive' | 'scoring-inactive' | 'zero-points' | 'max-reached' | 'duplicate'
  event: CrmLeadScoreEvent | null
  score: number
  scoreBand: CrmLeadScoreBand
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}

export async function applyScoreEvent(args: {
  client: CrmScoringClient
  empresaId: string
  leadId: string
  eventType: CrmScoreEventType
  contactId?: string | null
  captureId?: string | null
  sourceId?: string | null
  occurredAt?: Date
  createdById?: string | null
  pointsOverride?: number
  metadata?: Prisma.InputJsonValue
}): Promise<ApplyCrmScoreEventResult> {
  const occurredAt = args.occurredAt ?? new Date()
  const lead = await args.client.crmLead.findUnique({
    where: { id: args.leadId },
    select: { id: true, empresaId: true, score: true, scoreBand: true, createdById: true, contactId: true },
  })

  if (!lead || lead.empresaId !== args.empresaId) {
    throw new Error('Lead no encontrado para scoring')
  }

  const settings = await ensureCrmScoringSettings(args.client, args.empresaId)
  const base = { score: lead.score, scoreBand: lead.scoreBand }

  if (!settings.active) {
    return { applied: false, reason: 'scoring-inactive', event: null, ...base }
  }

  const rule = await (async () => {
    const existing = await args.client.crmScoringRule.findUnique({
      where: { empresaId_eventType: { empresaId: args.empresaId, eventType: args.eventType } },
    })
    if (existing) return existing
    // Sembrado perezoso: la primera captura crea las reglas por defecto.
    await ensureCrmScoringRules(args.client, args.empresaId)
    return args.client.crmScoringRule.findUnique({
      where: { empresaId_eventType: { empresaId: args.empresaId, eventType: args.eventType } },
    })
  })()

  if (!rule) return { applied: false, reason: 'rule-missing', event: null, ...base }
  if (!rule.active) return { applied: false, reason: 'rule-inactive', event: null, ...base }

  const points = args.pointsOverride ?? rule.points
  if (points === 0 && args.eventType !== 'MANUAL_ADJUSTMENT') {
    return { applied: false, reason: 'zero-points', event: null, ...base }
  }

  if (rule.maxPerLead != null) {
    const appliedCount = await args.client.crmLeadScoreEvent.count({
      where: { leadId: args.leadId, eventType: args.eventType },
    })
    if (appliedCount >= rule.maxPerLead) {
      return { applied: false, reason: 'max-reached', event: null, ...base }
    }
  }

  const dedupeKey = buildDedupeKey({
    eventType: args.eventType,
    oncePerLead: rule.oncePerLead,
    dedupeWindowHours: rule.dedupeWindowHours,
    sourceId: args.sourceId,
    occurredAt,
  })

  let event: CrmLeadScoreEvent
  const alreadyApplied = await args.client.crmLeadScoreEvent.findUnique({
    where: { leadId_dedupeKey: { leadId: args.leadId, dedupeKey } },
    select: { id: true },
  })
  if (alreadyApplied) {
    return { applied: false, reason: 'duplicate', event: null, ...base }
  }

  try {
    event = await args.client.crmLeadScoreEvent.create({
      data: {
        empresaId: args.empresaId,
        leadId: args.leadId,
        contactId: args.contactId ?? lead.contactId ?? null,
        captureId: args.captureId ?? null,
        eventType: args.eventType,
        points,
        dedupeKey,
        metadataJson: args.metadata ?? {},
        occurredAt,
        createdById: args.createdById ?? null,
      },
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { applied: false, reason: 'duplicate', event: null, ...base }
    }
    throw error
  }

  const nextScore = lead.score + points
  const scoreBand = resolveCrmScoreBand(nextScore, settings)

  await args.client.crmLead.update({
    where: { id: args.leadId },
    data: { score: nextScore, scoreBand, scoreUpdatedAt: occurredAt },
  })

  const label = CRM_SCORE_EVENT_LABELS[args.eventType] ?? args.eventType
  await args.client.crmActivity.create({
    data: {
      empresaId: args.empresaId,
      type: 'OTHER',
      summary: `Puntuación ${points >= 0 ? '+' : ''}${points} · ${label}`,
      details: `Clave: ${dedupeKey}`,
      leadId: args.leadId,
      contactId: args.contactId ?? lead.contactId ?? null,
      occurredAt,
      eventKey: `score:${event.id}`,
      createdById: args.createdById ?? lead.createdById,
    },
  })

  return { applied: true, reason: 'applied', event, score: nextScore, scoreBand }
}

/**
 * Recalcula la puntuación desde los eventos (fuente de verdad).
 * Si el agregado no coincide, la diferencia se registra como `MANUAL_ADJUSTMENT`
 * para no perder trazabilidad al cambiar reglas.
 */
export async function recalculateLeadScore(args: {
  client: CrmScoringClient
  empresaId: string
  leadId: string
  actorUserId?: string | null
}): Promise<{ lead: CrmLead; score: number; scoreBand: CrmLeadScoreBand; delta: number }> {
  const [lead, events, settings] = await Promise.all([
    args.client.crmLead.findUnique({ where: { id: args.leadId } }),
    args.client.crmLeadScoreEvent.findMany({
      where: { leadId: args.leadId },
      select: { points: true },
    }),
    ensureCrmScoringSettings(args.client, args.empresaId),
  ])

  if (!lead || lead.empresaId !== args.empresaId) {
    throw new Error('Lead no encontrado para recálculo de scoring')
  }

  const total = events.reduce((sum, event) => sum + event.points, 0)
  const delta = total - lead.score

  if (delta !== 0) {
    await args.client.crmLeadScoreEvent.create({
      data: {
        empresaId: args.empresaId,
        leadId: lead.id,
        contactId: lead.contactId,
        eventType: 'MANUAL_ADJUSTMENT',
        points: delta,
        dedupeKey: `MANUAL_ADJUSTMENT:recalc:${Date.now()}`,
        metadataJson: { reason: 'recalculate', previousScore: lead.score, nextScore: total },
        createdById: args.actorUserId ?? null,
      },
    })

    await args.client.crmActivity.create({
      data: {
        empresaId: args.empresaId,
        type: 'OTHER',
        summary: `Recálculo de puntuación (${delta >= 0 ? '+' : ''}${delta})`,
        details: `Anterior: ${lead.score} · Nuevo: ${total}`,
        leadId: lead.id,
        contactId: lead.contactId,
        createdById: args.actorUserId ?? lead.createdById,
      },
    })
  }

  const scoreBand = resolveCrmScoreBand(total, settings)
  const updated = await args.client.crmLead.update({
    where: { id: lead.id },
    data: { score: total, scoreBand, scoreUpdatedAt: new Date() },
  })

  return { lead: updated, score: total, scoreBand, delta }
}

/**
 * Heurística de eventos a partir de una captura. Devuelve tipos únicos;
 * `applyCaptureScoreEvents()` aplica las reglas vigentes a cada uno.
 */
export function inferCaptureScoreEvents(args: {
  captureType: string
  formPurpose?: string | null
  resourceLabel?: string | null
  serviceInterest?: string | null
  messageText?: string | null
}): CrmScoreEventType[] {
  if (args.captureType === 'MANUAL_IMPORT') return []

  const events = new Set<CrmScoreEventType>()
  const purpose = (args.formPurpose ?? '').toUpperCase()
  const service = (args.serviceInterest ?? '').toLowerCase()
  const message = (args.messageText ?? '').toLowerCase()

  if (purpose === 'INCENTIVE' || args.resourceLabel) events.add('DOCUMENT_DOWNLOAD')
  if (purpose === 'COUPON') events.add('INFO_REQUEST')

  const wantsQuote = /cotiz|presupuesto|propuesta|quote/.test(service) || /cotiz|presupuesto/.test(message)
  if (wantsQuote) events.add('QUOTE_REQUEST')
  else if (service || message || purpose === 'LEAD_CAPTURE' || purpose === 'THANK_YOU_REDIRECT') {
    events.add('INFO_REQUEST')
  }

  return [...events]
}

export async function applyCaptureScoreEvents(args: {
  client: CrmScoringClient
  empresaId: string
  leadId: string
  contactId?: string | null
  captureId?: string | null
  captureType: string
  formPurpose?: string | null
  resourceLabel?: string | null
  serviceInterest?: string | null
  messageText?: string | null
  occurredAt?: Date
  createdById?: string | null
}): Promise<ApplyCrmScoreEventResult[]> {
  const eventTypes = inferCaptureScoreEvents({
    captureType: args.captureType,
    formPurpose: args.formPurpose,
    resourceLabel: args.resourceLabel,
    serviceInterest: args.serviceInterest,
    messageText: args.messageText,
  })

  const results: ApplyCrmScoreEventResult[] = []
  for (const eventType of eventTypes) {
    const result = await applyScoreEvent({
      client: args.client,
      empresaId: args.empresaId,
      leadId: args.leadId,
      eventType,
      contactId: args.contactId,
      captureId: args.captureId,
      sourceId: args.captureId ?? null,
      occurredAt: args.occurredAt,
      createdById: args.createdById,
      metadata: {
        captureType: args.captureType,
        resourceLabel: args.resourceLabel ?? null,
        serviceInterest: args.serviceInterest ?? null,
        formPurpose: args.formPurpose ?? null,
      },
    })
    results.push(result)
  }

  return results
}
