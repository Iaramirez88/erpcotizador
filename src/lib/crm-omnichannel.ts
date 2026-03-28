import { Prisma, type CrmActivityType, type CrmLeadCaptureType, type CrmLeadSource, type CrmMessageType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'

type JsonObject = Record<string, unknown>
type TxClient = Prisma.TransactionClient | typeof prisma

type EnsureConversationArgs = {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  channelConnectionId: string
  leadId?: string | null
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

export async function findMatchingLead(args: {
  client: TxClient
  empresaId: string
  email?: string | null
  phone?: string | null
  document?: string | null
}) {
  const email = normalizeString(args.email).toLowerCase()
  const phone = normalizeString(args.phone)
  const document = normalizeString(args.document)

  if (document) {
    const byDocument = await args.client.crmLead.findFirst({
      where: { empresaId: args.empresaId, documento: document },
      orderBy: { createdAt: 'desc' },
    })
    if (byDocument) return byDocument
  }

  if (email) {
    const byEmail = await args.client.crmLead.findFirst({
      where: { empresaId: args.empresaId, email },
      orderBy: { createdAt: 'desc' },
    })
    if (byEmail) return byEmail
  }

  if (phone) {
    const byPhone = await args.client.crmLead.findFirst({
      where: {
        empresaId: args.empresaId,
        OR: [{ telefono: phone }, { celular: phone }],
      },
      orderBy: { createdAt: 'desc' },
    })
    if (byPhone) return byPhone
  }

  return null
}

export async function ensureConversation(args: EnsureConversationArgs) {
  const eventAt = args.eventAt ?? new Date()
  const contactPhone = normalizeString(args.contactPhone)
  const contactEmail = normalizeString(args.contactEmail).toLowerCase()
  const externalThreadId = normalizeString(args.externalThreadId)
  const orConditions: Array<Record<string, string>> = []

  if (externalThreadId) orConditions.push({ externalThreadId })
  if (args.leadId) orConditions.push({ leadId: args.leadId })
  if (contactPhone) orConditions.push({ contactPhone })
  if (contactEmail) orConditions.push({ contactEmail })

  const existing = orConditions.length
    ? await args.client.crmConversation.findFirst({
        where: {
          empresaId: args.empresaId,
          channelConnectionId: args.channelConnectionId,
          status: { in: ['OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE'] },
          OR: orConditions,
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    : null

  if (existing) {
    return args.client.crmConversation.update({
      where: { id: existing.id },
      data: {
        leadId: args.leadId ?? existing.leadId,
        clienteId: args.clienteId ?? existing.clienteId,
        opportunityId: args.opportunityId ?? existing.opportunityId,
        assignedToUserId: args.assignedToUserId ?? existing.assignedToUserId,
        contactDisplayName: normalizeString(args.contactDisplayName) || existing.contactDisplayName,
        contactPhone: contactPhone || existing.contactPhone,
        contactEmail: contactEmail || existing.contactEmail,
        externalThreadId: externalThreadId || existing.externalThreadId,
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
  }

  return args.client.crmConversation.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      channelConnectionId: args.channelConnectionId,
      leadId: args.leadId ?? null,
      clienteId: args.clienteId ?? null,
      opportunityId: args.opportunityId ?? null,
      assignedToUserId: args.assignedToUserId ?? null,
      status: 'OPEN',
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
}

export async function upsertLeadFromInbound(args: {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  createdById: string
  ownerUserId?: string | null
  nombre?: string | null
  empresaNombre?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  ciudad?: string | null
  notes?: string | null
  source: CrmLeadSource
  eventAt?: Date
}) {
  const eventAt = args.eventAt ?? new Date()
  const existing = await findMatchingLead({
    client: args.client,
    empresaId: args.empresaId,
    email: args.email,
    phone: args.phone,
    document: args.document,
  })

  const nombre = normalizeString(args.nombre) || normalizeString(args.phone) || normalizeString(args.email) || 'Lead sin nombre'
  const empresaNombre = normalizeString(args.empresaNombre)
  const email = normalizeString(args.email).toLowerCase()
  const phone = normalizeString(args.phone)
  const document = normalizeString(args.document)
  const ciudad = normalizeString(args.ciudad)
  const notes = normalizeString(args.notes)

  if (existing) {
    return args.client.crmLead.update({
      where: { id: existing.id },
      data: {
        sedeId: existing.sedeId ?? args.sedeId ?? null,
        empresaNombre: existing.empresaNombre || empresaNombre || null,
        email: existing.email || email || null,
        telefono: existing.telefono || phone || null,
        celular: existing.celular || phone || null,
        documento: existing.documento || document || null,
        ciudad: existing.ciudad || ciudad || null,
        notes: existing.notes || notes || null,
        ownerUserId: existing.ownerUserId ?? args.ownerUserId ?? null,
        lastActivityAt: eventAt,
      },
    })
  }

  return args.client.crmLead.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      source: args.source,
      status: 'NEW',
      nombre,
      empresaNombre: empresaNombre || null,
      documento: document || null,
      email: email || null,
      telefono: phone || null,
      celular: phone || null,
      ciudad: ciudad || null,
      notes: notes || null,
      ownerUserId: args.ownerUserId ?? null,
      createdById: args.createdById,
      lastActivityAt: eventAt,
    },
  })
}

export async function logInboundCapture(args: {
  client: TxClient
  empresaId: string
  sedeId?: string | null
  channelConnectionId: string
  leadId?: string | null
  conversationId?: string | null
  captureType: CrmLeadCaptureType
  rawPayloadJson: Prisma.InputJsonValue
  normalizedDataJson: Prisma.InputJsonValue
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  landingPageUrl?: string | null
  referrerUrl?: string | null
  providerLeadId?: string | null
}) {
  return args.client.crmLeadCapture.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      channelConnectionId: args.channelConnectionId,
      leadId: args.leadId ?? null,
      conversationId: args.conversationId ?? null,
      captureType: args.captureType,
      rawPayloadJson: args.rawPayloadJson,
      normalizedDataJson: args.normalizedDataJson,
      utmSource: normalizeString(args.utmSource) || null,
      utmMedium: normalizeString(args.utmMedium) || null,
      utmCampaign: normalizeString(args.utmCampaign) || null,
      utmContent: normalizeString(args.utmContent) || null,
      utmTerm: normalizeString(args.utmTerm) || null,
      landingPageUrl: normalizeString(args.landingPageUrl) || null,
      referrerUrl: normalizeString(args.referrerUrl) || null,
      providerLeadId: normalizeString(args.providerLeadId) || null,
    },
  })
}

export async function createInboundArtifacts(args: {
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
  empresaNombre?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  ciudad?: string | null
  messageText?: string | null
  externalThreadId?: string | null
  providerMessageId?: string | null
  providerLeadId?: string | null
  sourceLabel?: string | null
  sourceCampaign?: string | null
  sourceMedium?: string | null
  sourceContent?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  landingPageUrl?: string | null
  referrerUrl?: string | null
  rawPayloadJson: Prisma.InputJsonValue
  normalizedDataJson: Prisma.InputJsonValue
}) {
  const eventAt = args.eventAt ?? new Date()
  const lead = await upsertLeadFromInbound({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    createdById: args.createdById,
    ownerUserId: args.ownerUserId ?? null,
    nombre: args.nombre,
    empresaNombre: args.empresaNombre,
    email: args.email,
    phone: args.phone,
    document: args.document,
    ciudad: args.ciudad,
    notes: args.messageText,
    source: args.source,
    eventAt,
  })

  const conversation = await ensureConversation({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    channelConnectionId: args.channelConnectionId,
    leadId: lead.id,
    assignedToUserId: args.ownerUserId ?? lead.ownerUserId ?? null,
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

  const message = await args.client.crmMessage.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      conversationId: conversation.id,
      providerMessageId: normalizeString(args.providerMessageId) || null,
      direction: 'INBOUND',
      messageType: args.messageType ?? 'TEXT',
      status: 'RECEIVED',
      bodyText: normalizeString(args.messageText) || null,
      payloadJson: args.rawPayloadJson,
      attachmentsJson: [],
      occurredAt: eventAt,
    },
  })

  await args.client.crmActivity.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      type: args.activityType ?? 'OTHER',
      summary: `Ingreso desde ${normalizeString(args.sourceLabel) || 'canal CRM'}`,
      details: normalizeString(args.messageText) || null,
      leadId: lead.id,
      occurredAt: eventAt,
      createdById: args.createdById,
    },
  })

  const capture = await logInboundCapture({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    channelConnectionId: args.channelConnectionId,
    leadId: lead.id,
    conversationId: conversation.id,
    captureType: args.captureType,
    rawPayloadJson: args.rawPayloadJson,
    normalizedDataJson: args.normalizedDataJson,
    utmSource: args.utmSource,
    utmMedium: args.utmMedium,
    utmCampaign: args.utmCampaign,
    utmContent: args.utmContent,
    utmTerm: args.utmTerm,
    landingPageUrl: args.landingPageUrl,
    referrerUrl: args.referrerUrl,
    providerLeadId: args.providerLeadId,
  })

  const notificationUserId = conversation.assignedToUserId || args.ownerUserId || lead.ownerUserId || args.createdById
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

  return { lead, conversation, message, capture }
}