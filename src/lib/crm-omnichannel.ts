import { AccessLevel, ModuleKey, Prisma, type CrmActivityType, type CrmConversation, type CrmLead, type CrmLeadCapture, type CrmLeadCaptureType, type CrmLeadSource, type CrmMessage, type CrmMessageType, type CrmScoreEventType, type SedeRole } from '@prisma/client'
import { normalizeString } from '@/lib/crm'
import {
  buildDedupeTrace,
  buildPhoneWhereClauses,
  normalizePhoneForMatching,
  normalizePhoneForStorage,
  type ContactRecord,
  type CrmDbClient,
  type DedupeTrace,
} from '@/lib/crm-contact-identity'
import {
  ensureLeadCaptureIdentity,
  recordLeadCaptureEvent,
  type LeadOriginFields,
} from '@/lib/crm-lead-capture'
import { applyCaptureScoreEvents, applyScoreEvent } from '@/lib/crm-scoring'
import { applyAssignmentRules } from '@/lib/crm-assignment'

// Re-export de compatibilidad: estos helpers vivían en este módulo.
export { findMatchingLead, logInboundCapture, upsertLeadFromInbound } from '@/lib/crm-lead-capture'
export type { DedupeTrace, LeadMatchResult, UpsertLeadFromInboundResult } from '@/lib/crm-lead-capture'

type JsonObject = Record<string, unknown>
type TxClient = CrmDbClient

type EnsureConversationArgs = {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  channelConnectionId: string
  leadId?: string | null
  contactId?: string | null
  clienteId?: string | null
  opportunityId?: string | null
  assignedToUserId?: string | null
  contactDisplayName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  externalThreadId?: string | null
  source?: string | null
  sourceCampaign?: string | null
  sourceMedium?: string | null
  sourceContent?: string | null
  eventAt?: Date
}

type EnsureConversationResult = {
  conversation: CrmConversation
  dedupe: DedupeTrace | null
}


export type CrmMessageOrigin = 'CUSTOMER' | 'PHONE_APP' | 'CRM_AGENT' | 'BOT' | 'SYSTEM'

type ConversationMessageEventResult = {
  conversation: CrmConversation
  message: Awaited<ReturnType<TxClient['crmMessage']['create']>>
  dedupe: DedupeTrace | null
  wasCreated: boolean
}

export function parseJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

export function maskTokenPreview(value: string | null | undefined): string | null {
  const raw = normalizeString(value)
  if (!raw) return null
  if (raw.length <= 6) return '***'
  return `${raw.slice(0, 3)}***${raw.slice(-2)}`
}

export function getConnectionToken(settingsJson: unknown, verifyToken: string | null | undefined): string {
  const settings = parseJsonObject(settingsJson)
  const fromSettings = normalizeString(settings.testingToken)
  return fromSettings || normalizeString(verifyToken)
}

export function parseMaybeDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const raw = normalizeString(value)
  if (!raw) return new Date()
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

const ACCESS_LEVEL_ORDER: Record<AccessLevel, number> = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3,
}

function sedeRoleToBaseAccess(role: SedeRole): AccessLevel {
  switch (role) {
    case 'ADMIN':
      return 'ADMIN'
    case 'MANAGER':
      return 'WRITE'
    case 'MEMBER':
      return 'WRITE'
    case 'READER':
    default:
      return 'READ'
  }
}

type CandidateAssignee = {
  id: string
  name: string | null
  email: string
  sedeDefaultId: string | null
  lastLoginAt: Date | null
  globalAccess: { level: AccessLevel } | null
  sedeMemberships: Array<{ sedeId: string; role: SedeRole }>
  moduleAccess: Array<{ sedeId: string; level: AccessLevel }>
}

function hasCrmConversationWriteAccess(user: CandidateAssignee, sedeId?: string | null) {
  const globalBase = user.globalAccess?.level ?? 'NONE'

  if (sedeId) {
    const membership = user.sedeMemberships.find((row) => row.sedeId === sedeId)
    const base = membership ? sedeRoleToBaseAccess(membership.role) : globalBase
    const explicit = user.moduleAccess.find((row) => row.sedeId === sedeId)?.level
    const effective = explicit ?? base
    return ACCESS_LEVEL_ORDER[effective] >= ACCESS_LEVEL_ORDER.WRITE
  }

  if (ACCESS_LEVEL_ORDER[globalBase] >= ACCESS_LEVEL_ORDER.WRITE) return true
  if (user.moduleAccess.some((row) => ACCESS_LEVEL_ORDER[row.level] >= ACCESS_LEVEL_ORDER.WRITE)) return true
  return user.sedeMemberships.some((row) => ACCESS_LEVEL_ORDER[sedeRoleToBaseAccess(row.role)] >= ACCESS_LEVEL_ORDER.WRITE)
}

export async function canAssignCrmConversationToUser(args: {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  userId: string
}) {
  const user = await args.client.user.findFirst({
    where: {
      id: args.userId,
      empresaId: args.empresaId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      sedeDefaultId: true,
      lastLoginAt: true,
      globalAccess: { select: { level: true } },
      sedeMemberships: {
        ...(args.sedeId ? { where: { sedeId: args.sedeId } } : {}),
        select: { sedeId: true, role: true },
      },
      moduleAccess: {
        where: {
          module: ModuleKey.CRM,
          ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        },
        select: { sedeId: true, level: true },
      },
    },
  })

  if (!user) return false
  return hasCrmConversationWriteAccess(user, args.sedeId)
}

function getNextInboundConversationStatus(args: {
  currentStatus?: 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'DISABLED' | 'RESOLVED' | 'SPAM' | null
  assignedToUserId?: string | null
}) {
  const hasAssignee = Boolean(normalizeString(args.assignedToUserId))
  const currentStatus = args.currentStatus ?? null

  if (currentStatus === 'SPAM') return 'SPAM' as const
  if (currentStatus === 'BOT_ACTIVE') return 'BOT_ACTIVE' as const
  if (hasAssignee) return 'HUMAN_ACTIVE' as const
  return 'OPEN' as const
}

async function resolveInboundAssigneeUserId(args: {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  channelConnectionId?: string | null
  preferredUserId?: string | null
}) {
  const preferredUserId = normalizeString(args.preferredUserId)
  const channelConnectionId = normalizeString(args.channelConnectionId)
  const now = Date.now()
  const activeSessionThreshold = 18 * 60 * 60 * 1000

  const users = await args.client.user.findMany({
    where: {
      empresaId: args.empresaId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      sedeDefaultId: true,
      lastLoginAt: true,
      globalAccess: { select: { level: true } },
      sedeMemberships: {
        ...(args.sedeId ? { where: { sedeId: args.sedeId } } : {}),
        select: { sedeId: true, role: true },
      },
      moduleAccess: {
        where: {
          module: ModuleKey.CRM,
          ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        },
        select: { sedeId: true, level: true },
      },
    },
    take: 50,
  })

  const eligibleUsers = users.filter((user) => hasCrmConversationWriteAccess(user, args.sedeId))
  if (!eligibleUsers.length) return null

  const activeConversations = await args.client.crmConversation.findMany({
    where: {
      empresaId: args.empresaId,
      assignedToUserId: { not: null },
      status: { in: ['OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE'] },
    },
    select: {
      assignedToUserId: true,
      channelConnectionId: true,
    },
  })

  const loadMap = new Map<string, number>()
  const sameChannelLoadMap = new Map<string, number>()
  for (const row of activeConversations) {
    if (!row.assignedToUserId) continue
    loadMap.set(row.assignedToUserId, (loadMap.get(row.assignedToUserId) ?? 0) + 1)
    if (channelConnectionId && row.channelConnectionId === channelConnectionId) {
      sameChannelLoadMap.set(row.assignedToUserId, (sameChannelLoadMap.get(row.assignedToUserId) ?? 0) + 1)
    }
  }

  const ranked = [...eligibleUsers].sort((left, right) => {
    const leftPreferred = left.id === preferredUserId ? 0 : 1
    const rightPreferred = right.id === preferredUserId ? 0 : 1
    if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred

    const leftSedeScore = args.sedeId && left.sedeDefaultId === args.sedeId ? 0 : 1
    const rightSedeScore = args.sedeId && right.sedeDefaultId === args.sedeId ? 0 : 1
    if (leftSedeScore !== rightSedeScore) return leftSedeScore - rightSedeScore

    const leftActiveScore = left.lastLoginAt && now - left.lastLoginAt.getTime() <= activeSessionThreshold ? 0 : 1
    const rightActiveScore = right.lastLoginAt && now - right.lastLoginAt.getTime() <= activeSessionThreshold ? 0 : 1
    if (leftActiveScore !== rightActiveScore) return leftActiveScore - rightActiveScore

    const leftChannelScore = channelConnectionId && (sameChannelLoadMap.get(left.id) ?? 0) > 0 ? 0 : 1
    const rightChannelScore = channelConnectionId && (sameChannelLoadMap.get(right.id) ?? 0) > 0 ? 0 : 1
    if (leftChannelScore !== rightChannelScore) return leftChannelScore - rightChannelScore

    const leftLoad = loadMap.get(left.id) ?? 0
    const rightLoad = loadMap.get(right.id) ?? 0
    if (leftLoad !== rightLoad) return leftLoad - rightLoad

    return (left.name || left.email || left.id).localeCompare(right.name || right.email || right.id, 'es')
  })

  return ranked[0]?.id || null
}

export async function ensureConversation(args: EnsureConversationArgs): Promise<EnsureConversationResult> {
  const eventAt = args.eventAt ?? new Date()
  const contactPhone = normalizePhoneForStorage(args.contactPhone)
  const contactEmail = normalizeString(args.contactEmail).toLowerCase()
  const externalThreadId = normalizeString(args.externalThreadId)
  const orConditions: Array<Record<string, string>> = []

  if (externalThreadId) orConditions.push({ externalThreadId })
  if (args.leadId) orConditions.push({ leadId: args.leadId })
  if (contactEmail) orConditions.push({ contactEmail })

  const phoneConditions = buildPhoneWhereClauses('contactPhone', contactPhone)
  const activeStatuses = ['OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE'] as const

  const activeMatch = (orConditions.length || phoneConditions.length)
    ? await args.client.crmConversation.findFirst({
        where: {
          empresaId: args.empresaId,
          channelConnectionId: args.channelConnectionId,
          status: { in: [...activeStatuses] },
          OR: [...orConditions, ...phoneConditions],
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    : null

  const existing = activeMatch ?? ((orConditions.length || phoneConditions.length)
    ? await args.client.crmConversation.findFirst({
        where: {
          empresaId: args.empresaId,
          channelConnectionId: args.channelConnectionId,
          status: { not: 'SPAM' },
          OR: [...orConditions, ...phoneConditions],
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    : null)

  if (existing) {
    const matchedFields: string[] = []
    if (externalThreadId && existing.externalThreadId === externalThreadId) matchedFields.push('externalThreadId')
    if (args.leadId && existing.leadId === args.leadId) matchedFields.push('leadId')
    if (contactEmail && existing.contactEmail === contactEmail) matchedFields.push('contactEmail')
    if (contactPhone && normalizePhoneForMatching(existing.contactPhone) === normalizePhoneForMatching(contactPhone)) {
      matchedFields.push('contactPhone')
    }

    const nextAssignedToUserId = args.assignedToUserId ?? existing.assignedToUserId
    const nextStatus = getNextInboundConversationStatus({
      currentStatus: existing.status,
      assignedToUserId: nextAssignedToUserId,
    })

    const conversation = await args.client.crmConversation.update({
      where: { id: existing.id },
      data: {
        leadId: args.leadId ?? existing.leadId,
        contactId: args.contactId ?? existing.contactId,
        clienteId: args.clienteId ?? existing.clienteId,
        opportunityId: args.opportunityId ?? existing.opportunityId,
        assignedToUserId: nextAssignedToUserId,
        contactDisplayName: normalizeString(args.contactDisplayName) || existing.contactDisplayName,
        contactPhone: contactPhone || existing.contactPhone,
        contactEmail: contactEmail || existing.contactEmail,
        externalThreadId: externalThreadId || existing.externalThreadId,
        status: nextStatus,
        resolvedAt: nextStatus === 'SPAM' ? existing.resolvedAt : null,
        unreadCount: { increment: 1 },
        firstInboundAt: existing.firstInboundAt ?? eventAt,
        lastMessageAt: eventAt,
        directionLastMessage: 'INBOUND',
        source: normalizeString(args.source) || existing.source,
        sourceCampaign: normalizeString(args.sourceCampaign) || existing.sourceCampaign,
        sourceMedium: normalizeString(args.sourceMedium) || existing.sourceMedium,
        sourceContent: normalizeString(args.sourceContent) || existing.sourceContent,
      },
    })

    return {
      conversation,
      dedupe: buildDedupeTrace({
        matchedRecordId: existing.id,
        strategy: activeMatch ? 'active_conversation_reuse' : 'historical_conversation_reopen',
        matchedFields,
        confidence: matchedFields.includes('externalThreadId') ? 'strong' : 'medium',
      }),
    }
  }

  const conversation = await args.client.crmConversation.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      channelConnectionId: args.channelConnectionId,
      leadId: args.leadId ?? null,
      contactId: args.contactId ?? null,
      clienteId: args.clienteId ?? null,
      opportunityId: args.opportunityId ?? null,
      assignedToUserId: args.assignedToUserId ?? null,
      status: getNextInboundConversationStatus({ assignedToUserId: args.assignedToUserId ?? null }),
      directionLastMessage: 'INBOUND',
      externalThreadId: externalThreadId || null,
      contactDisplayName: normalizeString(args.contactDisplayName) || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      unreadCount: 1,
      firstInboundAt: eventAt,
      lastMessageAt: eventAt,
      source: normalizeString(args.source) || null,
      sourceCampaign: normalizeString(args.sourceCampaign) || null,
      sourceMedium: normalizeString(args.sourceMedium) || null,
      sourceContent: normalizeString(args.sourceContent) || null,
    },
  })

  return { conversation, dedupe: null }
}

export type InboundArtifactsArgs = {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  createdById: string
  ownerUserId?: string | null
  channelConnectionId: string
  source: CrmLeadSource
  captureType: CrmLeadCaptureType
  activityType?: CrmActivityType
  messageType?: CrmMessageType
  eventAt?: Date
  nombre?: string | null
  apellido?: string | null
  empresaNombre?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  ciudad?: string | null
  messageText?: string | null
  tags?: string[] | null
  messageOrigin?: CrmMessageOrigin
  externalThreadId?: string | null
  providerMessageId?: string | null
  providerLeadId?: string | null
  sourceLabel?: string | null
  sourceKey?: string | null
  sourceCampaign?: string | null
  sourceMedium?: string | null
  sourceContent?: string | null
  formId?: string | null
  formName?: string | null
  campaignId?: string | null
  campaignName?: string | null
  serviceInterest?: string | null
  resourceLabel?: string | null
  consentJson?: Prisma.InputJsonValue | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  gclid?: string | null
  landingPageUrl?: string | null
  referrerUrl?: string | null
  rawPayloadJson: Prisma.InputJsonValue
  normalizedDataJson: Prisma.InputJsonValue
  attachmentsJson?: Prisma.InputJsonValue
  /** `false` registra la captura sin abrir conversación (formularios, agenda). */
  createConversation?: boolean
  /** `settingsJson.purpose` del formulario; alimenta scoring y secuencias. */
  formPurpose?: string | null
  /** Eventos de score explícitos (p. ej. `MEETING_BOOKED`). */
  extraScoreEvents?: CrmScoreEventType[] | null
}

export type InboundArtifactsResult = {
  lead: CrmLead
  contact: ContactRecord
  conversation: CrmConversation
  message: CrmMessage
  capture: CrmLeadCapture
  isFirstTouch: boolean
}

export type InboundArtifactsResultWithoutConversation = {
  lead: CrmLead
  contact: ContactRecord
  conversation: null
  message: null
  capture: CrmLeadCapture
  isFirstTouch: boolean
}

export function createInboundArtifacts(
  args: InboundArtifactsArgs & { createConversation: false },
): Promise<InboundArtifactsResultWithoutConversation>
export function createInboundArtifacts(
  args: InboundArtifactsArgs & { createConversation?: true },
): Promise<InboundArtifactsResult>
export function createInboundArtifacts(
  args: InboundArtifactsArgs & { createConversation: boolean },
): Promise<InboundArtifactsResult | InboundArtifactsResultWithoutConversation>
export async function createInboundArtifacts(
  args: InboundArtifactsArgs,
): Promise<InboundArtifactsResult | InboundArtifactsResultWithoutConversation> {
  const eventAt = args.eventAt ?? new Date()
  const createConversation = args.createConversation !== false
  // En captación sin conversación el responsable lo deciden las reglas de
  // asignación, no el reparto por carga de la bandeja.
  const assignedToUserId = createConversation
    ? await resolveInboundAssigneeUserId({
        client: args.client,
        empresaId: args.empresaId,
        sedeId: args.sedeId ?? null,
        channelConnectionId: args.channelConnectionId,
        preferredUserId: args.ownerUserId ?? null,
      })
    : null

  const origin: LeadOriginFields = {
    sourceKey: args.sourceKey ?? null,
    sourceLabel: args.sourceLabel ?? null,
    serviceInterest: args.serviceInterest ?? null,
    campaignId: args.campaignId ?? null,
    campaignName: args.campaignName ?? args.sourceCampaign ?? null,
    formId: args.formId ?? null,
    formName: args.formName ?? null,
    resourceLabel: args.resourceLabel ?? null,
  }

  const identity = await ensureLeadCaptureIdentity({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    createdById: args.createdById,
    ownerUserId: assignedToUserId ?? args.ownerUserId ?? null,
    nombre: args.nombre,
    apellido: args.apellido,
    empresaNombre: args.empresaNombre,
    email: args.email,
    phone: args.phone,
    document: args.document,
    ciudad: args.ciudad,
    notes: args.messageText,
    tags: args.tags,
    source: args.source,
    origin,
    eventAt,
  })
  const lead = identity.lead
  const contact = identity.contact

  let conversation: CrmConversation | null = null
  let conversationDedupe: DedupeTrace | null = null
  let message: CrmMessage | null = null

  if (createConversation) {
    const conversationResult = await ensureConversation({
      client: args.client,
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      channelConnectionId: args.channelConnectionId,
      leadId: lead.id,
      contactId: contact.id,
      assignedToUserId: assignedToUserId ?? lead.ownerUserId ?? null,
      contactDisplayName: args.nombre,
      contactPhone: args.phone,
      contactEmail: args.email,
      externalThreadId: args.externalThreadId,
      source: args.sourceLabel,
      sourceCampaign: args.sourceCampaign,
      sourceMedium: args.sourceMedium,
      sourceContent: args.sourceContent,
      eventAt,
    })
    conversation = conversationResult.conversation
    conversationDedupe = conversationResult.dedupe

    message = await args.client.crmMessage.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.sedeId ?? null,
        conversationId: conversation.id,
        providerMessageId: normalizeString(args.providerMessageId) || null,
        direction: 'INBOUND',
        messageType: args.messageType ?? 'TEXT',
        status: 'RECEIVED',
        bodyText: normalizeString(args.messageText) || null,
        payloadJson: {
          ...parseJsonObject(args.rawPayloadJson),
          messageOrigin: args.messageOrigin ?? 'CUSTOMER',
          ingestionSource: 'WEBHOOK',
        },
        attachmentsJson: Array.isArray(args.attachmentsJson) ? args.attachmentsJson : [],
        occurredAt: eventAt,
      },
    })
  }

  const { capture } = await recordLeadCaptureEvent({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    createdById: args.createdById,
    channelConnectionId: args.channelConnectionId,
    leadId: lead.id,
    contactId: contact.id,
    conversationId: conversation?.id ?? null,
    captureType: args.captureType,
    activityType: args.activityType,
    eventAt,
    messageText: args.messageText,
    sourceLabel: args.sourceLabel,
    rawPayloadJson: args.rawPayloadJson,
    normalizedDataJson: args.normalizedDataJson,
    utmSource: args.utmSource,
    utmMedium: args.utmMedium,
    utmCampaign: args.utmCampaign,
    utmContent: args.utmContent,
    utmTerm: args.utmTerm,
    gclid: args.gclid,
    landingPageUrl: args.landingPageUrl,
    referrerUrl: args.referrerUrl,
    providerLeadId: args.providerLeadId,
    origin,
    email: args.email,
    isFirstTouch: identity.isFirstTouch,
    dedupeStrategy: identity.leadDedupe?.strategy ?? identity.contactDedupe?.strategy ?? null,
    dedupe: {
      lead: identity.leadDedupe,
      contact: identity.contactDedupe,
      conversation: conversationDedupe,
    },
    consentJson: args.consentJson ?? null,
  })

  const scoreResults = await applyCaptureScoreEvents({
    client: args.client,
    empresaId: args.empresaId,
    leadId: lead.id,
    contactId: contact.id,
    captureId: capture.id,
    captureType: args.captureType,
    formPurpose: args.formPurpose ?? null,
    resourceLabel: args.resourceLabel ?? null,
    serviceInterest: args.serviceInterest ?? null,
    messageText: args.messageText,
    occurredAt: eventAt,
    createdById: args.createdById,
  })

  for (const eventType of args.extraScoreEvents ?? []) {
    scoreResults.push(
      await applyScoreEvent({
        client: args.client,
        empresaId: args.empresaId,
        leadId: lead.id,
        eventType,
        contactId: contact.id,
        captureId: capture.id,
        sourceId: capture.id,
        occurredAt: eventAt,
        createdById: args.createdById,
      })
    )
  }

  // Solo se aplican reglas de asignación cuando el flujo no trae responsable
  // explícito (captación sin conversación). El inbound conversacional conserva
  // el reparto por carga de la bandeja.
  if (!assignedToUserId && !normalizeString(args.ownerUserId)) {
    await applyAssignmentRules({
      client: args.client,
      empresaId: args.empresaId,
      leadId: lead.id,
      actorUserId: args.createdById,
      context: {
        source: args.source,
        formId: args.formId ?? origin.formId,
        campaignName: args.campaignName ?? origin.campaignName,
        serviceInterest: args.serviceInterest ?? origin.serviceInterest,
        sedeId: args.sedeId ?? null,
        city: args.ciudad ?? null,
        score: lead.score,
        scoreBand: lead.scoreBand,
      },
    })
  }

  if (conversation) {
    const notificationUserId = conversation.assignedToUserId || assignedToUserId || lead.ownerUserId || args.createdById
    if (notificationUserId) {
      const contactLabel = normalizeString(args.nombre) || conversation.contactDisplayName || lead.nombre || 'prospecto'
      const messagePreview = normalizeString(args.messageText)
      await args.client.notification.create({
        data: {
          type: 'INFO',
          title: `Nuevo mensaje de ${contactLabel}`,
          body: messagePreview
            ? `${normalizeString(args.sourceLabel) || 'Canal CRM'} · ${messagePreview.slice(0, 220)}`
            : `${normalizeString(args.sourceLabel) || 'Canal CRM'} registró un nuevo inbound.`,
          empresaId: args.empresaId,
          sedeId: args.sedeId ?? null,
          userId: notificationUserId,
          actionUrl: '/dashboard/crm',
          actionLabel: 'Abrir CRM',
        },
      })
    }
  }

  if (!conversation || !message) {
    return { lead, contact, conversation: null, message: null, capture, isFirstTouch: identity.isFirstTouch }
  }

  return {
    lead,
    contact,
    conversation,
    message,
    capture,
    isFirstTouch: identity.isFirstTouch,
  }
}

export async function createConversationMessageEvent(args: {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  channelConnectionId: string
  createdById?: string | null
  ownerUserId?: string | null
  activityType?: CrmActivityType
  eventAt?: Date
  direction: 'INBOUND' | 'OUTBOUND'
  messageType?: CrmMessageType
  nombre?: string | null
  email?: string | null
  phone?: string | null
  messageText?: string | null
  messageOrigin?: CrmMessageOrigin
  externalThreadId?: string | null
  providerMessageId?: string | null
  sourceLabel?: string | null
  sourceCampaign?: string | null
  sourceMedium?: string | null
  sourceContent?: string | null
  rawPayloadJson: Prisma.InputJsonValue
  attachmentsJson?: Prisma.InputJsonValue
}): Promise<ConversationMessageEventResult> {
  const eventAt = args.eventAt ?? new Date()
  const providerMessageId = normalizeString(args.providerMessageId)
  const externalThreadId = normalizeString(args.externalThreadId)
  const contactPhone = normalizePhoneForStorage(args.phone)
  const contactEmail = normalizeString(args.email).toLowerCase()
  const messageOrigin = args.messageOrigin ?? (args.direction === 'OUTBOUND' ? 'PHONE_APP' : 'CUSTOMER')

  if (providerMessageId) {
    const existingMessage = await args.client.crmMessage.findFirst({
      where: {
        providerMessageId,
        conversation: {
          empresaId: args.empresaId,
          channelConnectionId: args.channelConnectionId,
        },
      },
      include: { conversation: true },
    })

    if (existingMessage) {
      return {
        conversation: existingMessage.conversation,
        message: existingMessage,
        dedupe: buildDedupeTrace({
          matchedRecordId: existingMessage.id,
          strategy: 'provider_message_reuse',
          matchedFields: ['providerMessageId'],
          confidence: 'strong',
        }),
        wasCreated: false,
      }
    }
  }

  const orConditions: Array<Record<string, string>> = []
  if (externalThreadId) orConditions.push({ externalThreadId })
  if (contactEmail) orConditions.push({ contactEmail })
  const phoneConditions = buildPhoneWhereClauses('contactPhone', contactPhone)

  const existingConversation = (orConditions.length || phoneConditions.length)
    ? await args.client.crmConversation.findFirst({
        where: {
          empresaId: args.empresaId,
          channelConnectionId: args.channelConnectionId,
          status: { not: 'SPAM' },
          OR: [...orConditions, ...phoneConditions],
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    : null

  const recentCrmOutbound = args.direction === 'OUTBOUND' && messageOrigin === 'PHONE_APP' && existingConversation
    ? await args.client.crmMessage.findFirst({
        where: {
          conversationId: existingConversation.id,
          direction: 'OUTBOUND',
          occurredAt: { gte: new Date(eventAt.getTime() - 5 * 60 * 1000) },
          payloadJson: {
            path: ['messageOrigin'],
            equals: 'CRM_AGENT',
          },
        },
        orderBy: { occurredAt: 'desc' },
      })
    : null

  const conversation = existingConversation
    ? await args.client.crmConversation.update({
        where: { id: existingConversation.id },
        data: {
          assignedToUserId: args.ownerUserId ?? existingConversation.assignedToUserId,
          contactDisplayName: normalizeString(args.nombre) || existingConversation.contactDisplayName,
          contactPhone: contactPhone || existingConversation.contactPhone,
          contactEmail: contactEmail || existingConversation.contactEmail,
          externalThreadId: externalThreadId || existingConversation.externalThreadId,
          lastMessageAt: eventAt,
          directionLastMessage: args.direction,
          resolvedAt: existingConversation.status === 'SPAM' ? existingConversation.resolvedAt : existingConversation.resolvedAt,
          source: normalizeString(args.sourceLabel) || existingConversation.source,
          sourceCampaign: normalizeString(args.sourceCampaign) || existingConversation.sourceCampaign,
          sourceMedium: normalizeString(args.sourceMedium) || existingConversation.sourceMedium,
          sourceContent: normalizeString(args.sourceContent) || existingConversation.sourceContent,
        },
      })
    : await args.client.crmConversation.create({
        data: {
          empresaId: args.empresaId,
          sedeId: args.sedeId ?? null,
          channelConnectionId: args.channelConnectionId,
          assignedToUserId: args.ownerUserId ?? null,
          status: args.ownerUserId ? 'HUMAN_ACTIVE' : 'PENDING',
          directionLastMessage: args.direction,
          externalThreadId: externalThreadId || null,
          contactDisplayName: normalizeString(args.nombre) || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          unreadCount: args.direction === 'INBOUND' ? 1 : 0,
          firstInboundAt: args.direction === 'INBOUND' ? eventAt : null,
          lastMessageAt: eventAt,
          source: normalizeString(args.sourceLabel) || null,
          sourceCampaign: normalizeString(args.sourceCampaign) || null,
          sourceMedium: normalizeString(args.sourceMedium) || null,
          sourceContent: normalizeString(args.sourceContent) || null,
        },
      })

  const message = await args.client.crmMessage.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      conversationId: conversation.id,
      providerMessageId: providerMessageId || null,
      direction: args.direction,
      messageType: args.messageType ?? 'TEXT',
      status: args.direction === 'OUTBOUND' ? 'SENT' : 'RECEIVED',
      bodyText: normalizeString(args.messageText) || null,
      payloadJson: {
        ...parseJsonObject(args.rawPayloadJson),
        messageOrigin,
        ingestionSource: 'WEBHOOK',
        collisionDetected: Boolean(recentCrmOutbound),
        collisionWithMessageId: recentCrmOutbound?.id ?? null,
      },
      attachmentsJson: Array.isArray(args.attachmentsJson) ? args.attachmentsJson : [],
      sentByUserId: args.direction === 'OUTBOUND' && messageOrigin === 'CRM_AGENT' ? normalizeString(args.createdById) || null : null,
      occurredAt: eventAt,
    },
  })

  if (args.direction === 'OUTBOUND' && messageOrigin === 'PHONE_APP') {
    await args.client.crmActivity.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.sedeId ?? null,
        type: args.activityType ?? 'OTHER',
        summary: recentCrmOutbound ? 'Posible colisión: mensaje enviado desde celular tras respuesta en CRM' : 'Mensaje saliente detectado desde celular',
        details: recentCrmOutbound
          ? `Meta reportó un mensaje saliente desde celular. Se detectó otra salida reciente desde CRM en la misma conversación. Mensaje CRM relacionado: ${recentCrmOutbound.id}.`
          : 'Meta reportó un mensaje saliente originado fuera del CRM, probablemente desde la app del celular.',
        leadId: conversation.leadId,
        opportunityId: conversation.opportunityId,
        clienteId: conversation.clienteId,
        occurredAt: eventAt,
        createdById: normalizeString(args.createdById) || args.ownerUserId || conversation.assignedToUserId || 'system',
      },
    })

    const notificationUserId = conversation.assignedToUserId || args.ownerUserId || null
    if (notificationUserId && recentCrmOutbound) {
      await args.client.notification.create({
        data: {
          type: 'WARNING',
          title: 'Posible doble respuesta en WhatsApp',
          body: 'Se detectó un mensaje enviado desde el celular poco después de una respuesta desde el CRM en la misma conversación.',
          empresaId: args.empresaId,
          sedeId: args.sedeId ?? null,
          userId: notificationUserId,
          actionUrl: '/dashboard/crm',
          actionLabel: 'Revisar conversación',
        },
      })
    }
  }

  return {
    conversation,
    message,
    dedupe: existingConversation
      ? buildDedupeTrace({
          matchedRecordId: existingConversation.id,
          strategy: 'conversation_message_append',
          matchedFields: [
            ...(externalThreadId && existingConversation.externalThreadId === externalThreadId ? ['externalThreadId'] : []),
            ...(contactEmail && existingConversation.contactEmail === contactEmail ? ['contactEmail'] : []),
            ...(contactPhone && normalizePhoneForMatching(existingConversation.contactPhone) === normalizePhoneForMatching(contactPhone) ? ['contactPhone'] : []),
          ],
          confidence: externalThreadId && existingConversation.externalThreadId === externalThreadId ? 'strong' : 'medium',
        })
      : null,
    wasCreated: true,
  }
}