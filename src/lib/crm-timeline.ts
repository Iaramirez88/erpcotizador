import type { PrismaClient } from '@prisma/client'

/**
 * Historial unificado del CRM (lectura, sin tabla espejo).
 *
 * Fusiona capturas, eventos de puntuación, actividades, conversaciones,
 * oportunidades, tareas y envíos de secuencia en una sola línea de tiempo.
 * Contrato estable para la bandeja, la ficha del lead y el detalle del contacto.
 */
export type CrmTimelineKind =
  | 'capture'
  | 'score'
  | 'activity'
  | 'conversation'
  | 'opportunity'
  | 'task'
  | 'sequence'

export type CrmTimelineEntry = {
  id: string
  kind: CrmTimelineKind
  occurredAt: string
  title: string
  description: string | null
  actor: { id: string | null; name: string | null } | null
  channel: string | null
  entity: { type: string; id: string }
  metadata: Record<string, unknown>
}

export type CrmTimelineSubject = { leadId: string; contactId?: string | null } | { contactId: string }

export type CrmTimelineClient = Pick<
  PrismaClient,
  | 'crmLeadCapture'
  | 'crmLeadScoreEvent'
  | 'crmActivity'
  | 'crmConversation'
  | 'crmOpportunity'
  | 'crmTask'
  | 'crmSequenceSend'
  | 'crmLead'
>

const DEFAULT_TIMELINE_LIMIT = 60
const MAX_TIMELINE_LIMIT = 200

const CAPTURE_LABELS: Record<string, string> = {
  WEB_FORM: 'Formulario web',
  META_LEAD_AD: 'Lead ad de Meta',
  WHATSAPP_INBOUND: 'WhatsApp entrante',
  MESSENGER_INBOUND: 'Messenger entrante',
  CHATBOT_START: 'Conversación de chatbot',
  MANUAL_IMPORT: 'Captura manual',
}

const SCORE_LABELS: Record<string, string> = {
  DOCUMENT_DOWNLOAD: 'Descarga de documento',
  EMAIL_OPEN: 'Apertura de correo',
  LINK_CLICK: 'Clic en enlace',
  SERVICE_PAGE_VISIT: 'Visita a página de servicios',
  INFO_REQUEST: 'Solicitud de información',
  QUOTE_REQUEST: 'Solicitud de cotización',
  MEETING_BOOKED: 'Reunión agendada',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
}

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE: 'Nota',
  CALL: 'Llamada',
  EMAIL: 'Correo',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  TASK_DONE: 'Tarea completada',
  STAGE_CHANGE: 'Cambio de etapa',
  QUOTE_SENT: 'Cotización enviada',
  OTHER: 'Actividad',
}

function normalizeLimit(limit?: number | null) {
  if (!limit || Number.isNaN(limit)) return DEFAULT_TIMELINE_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_TIMELINE_LIMIT)
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

type TimelineSource = {
  leadId?: string | null
  contactId: string
  leadIds: string[]
}

async function collectTimeline(args: {
  client: CrmTimelineClient
  empresaId: string
  source: TimelineSource
  take: number
  kinds?: CrmTimelineKind[]
}): Promise<CrmTimelineEntry[]> {
  const { client, empresaId, source, take } = args
  const kinds = args.kinds?.length ? new Set(args.kinds) : null
  const wants = (kind: CrmTimelineKind) => !kinds || kinds.has(kind)

  const leadIds = source.leadIds.filter(Boolean)

  const [captures, scores, activities, conversations, opportunities, tasks, sends] = await Promise.all([
    wants('capture')
      ? client.crmLeadCapture.findMany({
          where: {
            empresaId,
            ...(source.leadId ? { OR: [{ leadId: source.leadId }, { contactId: source.contactId }] } : { contactId: source.contactId }),
          },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            captureType: true,
            formName: true,
            campaignName: true,
            serviceInterest: true,
            resourceLabel: true,
            isFirstTouch: true,
            scoreDelta: true,
            createdAt: true,
            leadId: true,
            channelConnection: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    wants('score') && leadIds.length
      ? client.crmLeadScoreEvent.findMany({
          where: { empresaId, leadId: { in: leadIds } },
          orderBy: { occurredAt: 'desc' },
          take,
          select: { id: true, eventType: true, points: true, dedupeKey: true, occurredAt: true, leadId: true },
        })
      : Promise.resolve([]),
    wants('activity')
      ? client.crmActivity.findMany({
          where: {
            empresaId,
            ...(source.leadId
              ? { OR: [{ leadId: source.leadId }, { contactId: source.contactId }] }
              : { contactId: source.contactId }),
          },
          orderBy: { occurredAt: 'desc' },
          take,
          select: {
            id: true,
            type: true,
            summary: true,
            details: true,
            occurredAt: true,
            leadId: true,
            createdBy: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    wants('conversation')
      ? client.crmConversation.findMany({
          where: {
            empresaId,
            ...(source.leadId
              ? { OR: [{ leadId: source.leadId }, { contactId: source.contactId }] }
              : { contactId: source.contactId }),
          },
          orderBy: { lastMessageAt: 'desc' },
          take,
          select: {
            id: true,
            status: true,
            firstInboundAt: true,
            lastMessageAt: true,
            directionLastMessage: true,
            channelConnection: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    wants('opportunity')
      ? client.crmOpportunity.findMany({
          where: {
            empresaId,
            ...(source.leadId
              ? { OR: [{ leadId: source.leadId }, { contactId: source.contactId }] }
              : { contactId: source.contactId }),
          },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            title: true,
            stage: true,
            expectedValue: true,
            wonAt: true,
            lostAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    wants('task') && leadIds.length
      ? client.crmTask.findMany({
          where: { empresaId, leadId: { in: leadIds } },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, title: true, status: true, dueAt: true, completedAt: true, createdAt: true },
        })
      : Promise.resolve([]),
    wants('sequence') && leadIds.length
      ? client.crmSequenceSend.findMany({
          where: { empresaId, enrollment: { leadId: { in: leadIds } } },
          orderBy: { sentAt: 'desc' },
          take,
          select: {
            id: true,
            channel: true,
            status: true,
            sentAt: true,
            step: { select: { kind: true, subject: true } },
            enrollment: { select: { sequenceId: true, leadId: true, sequence: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ])

  const entries: CrmTimelineEntry[] = []

  for (const capture of captures) {
    const parts = [
      CAPTURE_LABELS[capture.captureType] ?? capture.captureType,
      capture.formName ? `Formulario: ${capture.formName}` : null,
      capture.campaignName ? `Campaña: ${capture.campaignName}` : null,
      capture.serviceInterest ? `Servicio: ${capture.serviceInterest}` : null,
      capture.resourceLabel ? `Recurso: ${capture.resourceLabel}` : null,
    ].filter(Boolean)

    entries.push({
      id: `capture:${capture.id}`,
      kind: 'capture',
      occurredAt: toIso(capture.createdAt) ?? new Date(0).toISOString(),
      title: capture.isFirstTouch ? 'Primer contacto registrado' : 'Captura registrada',
      description: parts.join(' · '),
      actor: null,
      channel: capture.channelConnection?.name ?? null,
      entity: { type: 'CrmLeadCapture', id: capture.id },
      metadata: {
        captureType: capture.captureType,
        formName: capture.formName,
        campaignName: capture.campaignName,
        serviceInterest: capture.serviceInterest,
        resourceLabel: capture.resourceLabel,
        isFirstTouch: capture.isFirstTouch,
        scoreDelta: capture.scoreDelta,
        leadId: capture.leadId,
      },
    })
  }

  for (const event of scores) {
    const label = SCORE_LABELS[event.eventType] ?? event.eventType
    entries.push({
      id: `score:${event.id}`,
      kind: 'score',
      occurredAt: toIso(event.occurredAt) ?? new Date(0).toISOString(),
      title: `Puntuación ${event.points >= 0 ? '+' : ''}${event.points} · ${label}`,
      description: event.dedupeKey ? `Clave de deduplicación: ${event.dedupeKey}` : null,
      actor: null,
      channel: null,
      entity: { type: 'CrmLeadScoreEvent', id: event.id },
      metadata: { eventType: event.eventType, points: event.points, dedupeKey: event.dedupeKey, leadId: event.leadId },
    })
  }

  for (const activity of activities) {
    entries.push({
      id: `activity:${activity.id}`,
      kind: 'activity',
      occurredAt: toIso(activity.occurredAt) ?? new Date(0).toISOString(),
      title: `${ACTIVITY_LABELS[activity.type] ?? activity.type} · ${activity.summary}`,
      description: activity.details ?? null,
      actor: activity.createdBy ? { id: activity.createdBy.id, name: activity.createdBy.name } : null,
      channel: null,
      entity: { type: 'CrmActivity', id: activity.id },
      metadata: { type: activity.type, leadId: activity.leadId },
    })
  }

  for (const conversation of conversations) {
    entries.push({
      id: `conversation:${conversation.id}`,
      kind: 'conversation',
      occurredAt: toIso(conversation.lastMessageAt ?? conversation.firstInboundAt) ?? new Date(0).toISOString(),
      title: 'Conversación con el contacto',
      description: [
        conversation.channelConnection?.name ? `Canal: ${conversation.channelConnection.name}` : null,
        conversation.directionLastMessage ? `Último mensaje: ${conversation.directionLastMessage}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      actor: null,
      channel: conversation.channelConnection?.name ?? null,
      entity: { type: 'CrmConversation', id: conversation.id },
      metadata: { status: conversation.status, directionLastMessage: conversation.directionLastMessage },
    })
  }

  for (const opportunity of opportunities) {
    const stageLabel = opportunity.stage
    entries.push({
      id: `opportunity:${opportunity.id}`,
      kind: 'opportunity',
      occurredAt:
        toIso(opportunity.wonAt ?? opportunity.lostAt ?? opportunity.createdAt) ?? new Date(0).toISOString(),
      title: `Oportunidad · ${opportunity.title}`,
      description: [stageLabel, `Valor esperado: ${opportunity.expectedValue}`].join(' · '),
      actor: null,
      channel: null,
      entity: { type: 'CrmOpportunity', id: opportunity.id },
      metadata: { stage: opportunity.stage, expectedValue: opportunity.expectedValue },
    })
  }

  for (const task of tasks) {
    entries.push({
      id: `task:${task.id}`,
      kind: 'task',
      occurredAt: toIso(task.completedAt ?? task.dueAt ?? task.createdAt) ?? new Date(0).toISOString(),
      title: `Tarea · ${task.title}`,
      description: `Estado: ${task.status}`,
      actor: null,
      channel: null,
      entity: { type: 'CrmTask', id: task.id },
      metadata: { status: task.status, dueAt: toIso(task.dueAt) },
    })
  }

  for (const send of sends) {
    entries.push({
      id: `sequence:${send.id}`,
      kind: 'sequence',
      occurredAt: toIso(send.sentAt) ?? new Date(0).toISOString(),
      title: `Secuencia · ${send.enrollment.sequence.name}`,
      description: [send.step.kind, send.step.subject, `Estado: ${send.status}`].filter(Boolean).join(' · '),
      actor: null,
      channel: send.channel,
      entity: { type: 'CrmSequenceSend', id: send.id },
      metadata: { channel: send.channel, status: send.status, sequenceId: send.enrollment.sequenceId },
    })
  }

  return entries
}

export function sortCrmTimeline(entries: CrmTimelineEntry[], limit?: number | null) {
  return [...entries]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, normalizeLimit(limit))
}

/**
 * Historial de un lead. Incluye las capturas y actividades de su contacto
 * para no perder eventos anteriores a la vinculación.
 */
export async function loadLeadTimeline(args: {
  client: CrmTimelineClient
  empresaId: string
  leadId: string
  contactId?: string | null
  limit?: number | null
  kinds?: CrmTimelineKind[]
}): Promise<CrmTimelineEntry[]> {
  const take = normalizeLimit(args.limit)
  const entries = await collectTimeline({
    client: args.client,
    empresaId: args.empresaId,
    source: {
      leadId: args.leadId,
      contactId: args.contactId ?? '',
      leadIds: [args.leadId],
    },
    take,
    kinds: args.kinds,
  })

  return sortCrmTimeline(entries, take)
}

export async function loadContactTimeline(args: {
  client: CrmTimelineClient
  empresaId: string
  contactId: string
  limit?: number | null
  kinds?: CrmTimelineKind[]
}): Promise<CrmTimelineEntry[]> {
  const take = normalizeLimit(args.limit)
  const leads = await args.client.crmLead.findMany({
    where: { empresaId: args.empresaId, contactId: args.contactId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const entries = await collectTimeline({
    client: args.client,
    empresaId: args.empresaId,
    source: {
      leadId: null,
      contactId: args.contactId,
      leadIds: leads.map((row) => row.id),
    },
    take,
    kinds: args.kinds,
  })

  return sortCrmTimeline(entries, take)
}

