/**
 * Captación de leads CRM: motor único de identidad + captura.
 *
 * Este módulo concentra lo que antes vivía suelto en `crm-omnichannel.ts`:
 * - dedupe de leads (`findMatchingLead`, `upsertLeadFromInbound`),
 * - resolución de contacto canónico (vía `crm-contact-identity`),
 * - registro de la captura (`CrmLeadCapture`) y su actividad,
 * - denormalización de origen (`sourceKey`, `formName`, `campaignName`, ...),
 *   primeras/últimas marcas de captura y `contactId` en lead y captura.
 *
 * No crea conversaciones ni mensajes: eso es responsabilidad del módulo
 * omnicanal, que reutiliza estas funciones cuando el inbound sí es un mensaje.
 */

import type {
  CrmActivity,
  CrmActivityType,
  CrmLead,
  CrmLeadCapture,
  CrmLeadCaptureType,
  CrmLeadSource,
  CrmScoreEventType,
  Prisma,
} from '@prisma/client'
import {
  buildDedupeTrace,
  buildPhoneWhereClauses,
  ensureContactIdentity,
  getEmailDomain,
  identityText,
  normalizeContactEmail,
  normalizeLooseTextForMatching,
  normalizePhoneForStorage,
  touchContactInteraction,
  type ContactIdentityInput,
  type ContactRecord,
  type CrmDbClient,
  type DedupeTrace,
} from '@/lib/crm-contact-identity'
import { applyCaptureScoreEvents, applyScoreEvent, type ApplyCrmScoreEventResult } from '@/lib/crm-scoring'
import {
  applyAssignmentRules,
  notifyCrmLeadersOfUnassignedLead,
  type CrmAssignmentResolution,
} from '@/lib/crm-assignment'

export type { DedupeTrace } from '@/lib/crm-contact-identity'

export type LeadMatchResult = {
  lead: CrmLead | null
  dedupe: DedupeTrace | null
}

export type UpsertLeadFromInboundResult = {
  lead: CrmLead
  dedupe: DedupeTrace | null
  isFirstTouch: boolean
}

export type LeadCaptureIdentityResult = {
  lead: CrmLead
  contact: ContactRecord
  contactCreated: boolean
  isFirstTouch: boolean
  leadDedupe: DedupeTrace | null
  contactDedupe: DedupeTrace | null
}

export type LeadCaptureEventResult = {
  capture: CrmLeadCapture
  activity: CrmActivity
}

function mergeLeadTags(current: string[] | null | undefined, incoming: string[] | null | undefined) {
  const merged = new Set<string>()
  for (const tag of [...(current ?? []), ...(incoming ?? [])]) {
    const normalized = identityText(tag).slice(0, 60)
    if (normalized) merged.add(normalized)
  }
  return Array.from(merged).slice(0, 40)
}
export async function findMatchingLead(args: {
  client: CrmDbClient
  empresaId: string
  nombre?: string | null
  empresaNombre?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  eventAt?: Date
}): Promise<LeadMatchResult> {
  const empresaNombre = identityText(args.empresaNombre)
  const email = identityText(args.email).toLowerCase()
  const phone = normalizePhoneForStorage(args.phone)
  const document = identityText(args.document)

  if (document) {
    const byDocument = await args.client.crmLead.findFirst({
      where: { empresaId: args.empresaId, documento: document },
      orderBy: { createdAt: 'desc' },
    })
    if (byDocument) {
      return {
        lead: byDocument,
        dedupe: buildDedupeTrace({
          matchedRecordId: byDocument.id,
          strategy: 'document_exact',
          matchedFields: ['documento'],
        }),
      }
    }
  }

  if (email) {
    const byEmail = await args.client.crmLead.findFirst({
      where: { empresaId: args.empresaId, email },
      orderBy: { createdAt: 'desc' },
    })
    if (byEmail) {
      return {
        lead: byEmail,
        dedupe: buildDedupeTrace({
          matchedRecordId: byEmail.id,
          strategy: 'email_exact',
          matchedFields: ['email'],
        }),
      }
    }
  }

  if (phone) {
    const byPhone = await args.client.crmLead.findFirst({
      where: {
        empresaId: args.empresaId,
        OR: [
          ...buildPhoneWhereClauses('telefono', phone),
          ...buildPhoneWhereClauses('celular', phone),
        ],
      } as Prisma.CrmLeadWhereInput,
      orderBy: { createdAt: 'desc' },
    })
    if (byPhone) {
      return {
        lead: byPhone,
        dedupe: buildDedupeTrace({
          matchedRecordId: byPhone.id,
          strategy: 'phone_exact_or_suffix',
          matchedFields: ['telefono', 'celular'],
        }),
      }
    }
  }

  const normalizedNombre = normalizeLooseTextForMatching(args.nombre)
  const normalizedEmpresaNombre = normalizeLooseTextForMatching(empresaNombre)
  const emailDomain = getEmailDomain(email)
  if (!normalizedNombre) return { lead: null, dedupe: null }

  const recentThreshold = new Date((args.eventAt ?? new Date()).getTime() - (45 * 24 * 60 * 60 * 1000))
  const weakSignals: Prisma.CrmLeadWhereInput[] = []

  if (empresaNombre) {
    weakSignals.push({ empresaNombre: { equals: empresaNombre, mode: 'insensitive' } })
  }

  if (emailDomain) {
    weakSignals.push({ email: { endsWith: `@${emailDomain}`, mode: 'insensitive' } })
  }

  if (!weakSignals.length) return { lead: null, dedupe: null }

  const candidates = await args.client.crmLead.findMany({
    where: {
      empresaId: args.empresaId,
      AND: [
        { OR: [{ lastActivityAt: { gte: recentThreshold } }, { createdAt: { gte: recentThreshold } }] },
        { OR: weakSignals },
      ],
    },
    orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }],
    take: 12,
  })

  const byRecentHeuristic = candidates.find((candidate) => {
    if (normalizeLooseTextForMatching(candidate.nombre) !== normalizedNombre) return false

    const companyMatches = normalizedEmpresaNombre
      && normalizeLooseTextForMatching(candidate.empresaNombre) === normalizedEmpresaNombre
    const emailDomainMatches = emailDomain && getEmailDomain(candidate.email) === emailDomain

    return Boolean(companyMatches || emailDomainMatches)
  })

  if (!byRecentHeuristic) return { lead: null, dedupe: null }

  const matchedFields = ['nombre']
  const normalizedCandidateEmpresa = normalizeLooseTextForMatching(byRecentHeuristic.empresaNombre)
  const candidateEmailDomain = getEmailDomain(byRecentHeuristic.email)

  if (normalizedEmpresaNombre && normalizedCandidateEmpresa === normalizedEmpresaNombre) {
    matchedFields.push('empresaNombre')
  }

  if (emailDomain && candidateEmailDomain === emailDomain) {
    matchedFields.push('emailDomain')
  }

  return {
    lead: byRecentHeuristic,
    dedupe: buildDedupeTrace({
      matchedRecordId: byRecentHeuristic.id,
      strategy: 'recent_name_plus_secondary_signal',
      matchedFields,
      confidence: 'medium',
    }),
  }
}
export type LeadOriginFields = {
  sourceKey?: string | null
  sourceLabel?: string | null
  serviceInterest?: string | null
  campaignId?: string | null
  campaignName?: string | null
  formId?: string | null
  formName?: string | null
  resourceLabel?: string | null
}

function pickOrigin(current: string | null | undefined, incoming: string | null | undefined) {
  return current || identityText(incoming) || null
}

export async function upsertLeadFromInbound(args: {
  client: CrmDbClient
  empresaId: string
  sedeId?: string | null
  createdById: string
  ownerUserId?: string | null
  contactId?: string | null
  nombre?: string | null
  empresaNombre?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  ciudad?: string | null
  notes?: string | null
  tags?: string[] | null
  source: CrmLeadSource
  origin?: LeadOriginFields | null
  eventAt?: Date
}): Promise<UpsertLeadFromInboundResult> {
  const eventAt = args.eventAt ?? new Date()
  const existing = await findMatchingLead({
    client: args.client,
    empresaId: args.empresaId,
    nombre: args.nombre,
    empresaNombre: args.empresaNombre,
    email: args.email,
    phone: args.phone,
    document: args.document,
    eventAt,
  })

  const nombre = identityText(args.nombre)
    || identityText(args.phone)
    || identityText(args.email)
    || 'Lead sin nombre'
  const empresaNombre = identityText(args.empresaNombre)
  const email = identityText(args.email).toLowerCase()
  const phone = normalizePhoneForStorage(args.phone)
  const document = identityText(args.document)
  const ciudad = identityText(args.ciudad)
  const notes = identityText(args.notes)
  const origin = args.origin ?? null

  if (existing.lead) {
    const lead = await args.client.crmLead.update({
      where: { id: existing.lead.id },
      data: {
        sedeId: existing.lead.sedeId ?? args.sedeId ?? null,
        contactId: existing.lead.contactId ?? args.contactId ?? null,
        empresaNombre: existing.lead.empresaNombre || empresaNombre || null,
        email: existing.lead.email || email || null,
        telefono: existing.lead.telefono || phone || null,
        celular: existing.lead.celular || phone || null,
        documento: existing.lead.documento || document || null,
        ciudad: existing.lead.ciudad || ciudad || null,
        notes: existing.lead.notes || notes || null,
        tags: { set: mergeLeadTags(existing.lead.tags, args.tags) },
        ownerUserId: existing.lead.ownerUserId ?? args.ownerUserId ?? null,
        sourceKey: pickOrigin(existing.lead.sourceKey, origin?.sourceKey),
        sourceLabel: pickOrigin(existing.lead.sourceLabel, origin?.sourceLabel),
        serviceInterest: pickOrigin(existing.lead.serviceInterest, origin?.serviceInterest),
        campaignName: pickOrigin(existing.lead.campaignName, origin?.campaignName),
        formId: pickOrigin(existing.lead.formId, origin?.formId),
        formName: pickOrigin(existing.lead.formName, origin?.formName),
        firstTouchAt: existing.lead.firstTouchAt ?? eventAt,
        lastCaptureAt: eventAt,
        lastActivityAt: eventAt,
      },
    })

    return { lead, dedupe: existing.dedupe, isFirstTouch: !existing.lead.firstTouchAt }
  }

  const lead = await args.client.crmLead.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      contactId: args.contactId ?? null,
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
      tags: mergeLeadTags([], args.tags),
      ownerUserId: args.ownerUserId ?? null,
      createdById: args.createdById,
      sourceKey: identityText(origin?.sourceKey) || null,
      sourceLabel: identityText(origin?.sourceLabel) || null,
      serviceInterest: identityText(origin?.serviceInterest) || null,
      campaignName: identityText(origin?.campaignName) || null,
      formId: identityText(origin?.formId) || null,
      formName: identityText(origin?.formName) || null,
      firstTouchAt: eventAt,
      lastCaptureAt: eventAt,
      lastActivityAt: eventAt,
    },
  })

  return { lead, dedupe: null, isFirstTouch: true }
}

/**
 * Resuelve contacto canónico + lead para una captura inbound.
 * Idempotente: dos capturas simultáneas del mismo prospecto reutilizan
 * el mismo contacto y el mismo lead.
 */
export async function ensureLeadCaptureIdentity(args: {
  client: CrmDbClient
  empresaId: string
  sedeId?: string | null
  createdById: string
  ownerUserId?: string | null
  nombre?: string | null
  apellido?: string | null
  empresaNombre?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  ciudad?: string | null
  notes?: string | null
  tags?: string[] | null
  source: CrmLeadSource
  origin?: LeadOriginFields | null
  eventAt?: Date
}): Promise<LeadCaptureIdentityResult> {
  const eventAt = args.eventAt ?? new Date()
  const identity: ContactIdentityInput = {
    nombre: args.nombre,
    apellido: args.apellido,
    empresaNombre: args.empresaNombre,
    documento: args.document,
    email: args.email,
    phone: args.phone,
    ciudad: args.ciudad,
    tags: args.tags,
  }

  const contactResult = await ensureContactIdentity({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    createdById: args.createdById,
    ownerUserId: args.ownerUserId ?? null,
    identity,
    sourceKey: args.origin?.sourceKey ?? null,
    sourceLabel: args.origin?.sourceLabel ?? null,
    lastInteractionAt: eventAt,
    note: args.notes ?? null,
  })

  const leadResult = await upsertLeadFromInbound({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    createdById: args.createdById,
    ownerUserId: args.ownerUserId ?? null,
    contactId: contactResult.contact.id,
    nombre: args.nombre,
    empresaNombre: args.empresaNombre,
    email: args.email,
    phone: args.phone,
    document: args.document,
    ciudad: args.ciudad,
    notes: args.notes,
    tags: args.tags,
    source: args.source,
    origin: args.origin ?? null,
    eventAt,
  })

  return {
    lead: leadResult.lead,
    contact: contactResult.contact,
    contactCreated: contactResult.created,
    isFirstTouch: leadResult.isFirstTouch,
    leadDedupe: leadResult.dedupe,
    contactDedupe: contactResult.trace,
  }
}
/**
 * Registra la captura (`CrmLeadCapture`) + actividad y actualiza las marcas
 * de origen/interacción del lead y del contacto.
 */
export async function recordLeadCaptureEvent(args: {
  client: CrmDbClient
  empresaId: string
  sedeId?: string | null
  createdById: string
  channelConnectionId: string
  leadId: string
  contactId?: string | null
  conversationId?: string | null
  captureType: CrmLeadCaptureType
  activityType?: CrmActivityType
  eventAt?: Date
  messageText?: string | null
  sourceLabel?: string | null
  rawPayloadJson: Prisma.InputJsonValue
  normalizedDataJson: Prisma.InputJsonValue
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  gclid?: string | null
  landingPageUrl?: string | null
  referrerUrl?: string | null
  providerLeadId?: string | null
  origin?: LeadOriginFields | null
  email?: string | null
  isFirstTouch?: boolean
  scoreDelta?: number
  dedupeStrategy?: string | null
  dedupe?: Record<string, unknown> | null
  consentJson?: Prisma.InputJsonValue | null
}): Promise<LeadCaptureEventResult> {
  const eventAt = args.eventAt ?? new Date()
  const origin = args.origin ?? null
  const contactId = identityText(args.contactId) || null
  const normalizedDataJson = {
    ...(args.normalizedDataJson as Record<string, unknown>),
    ...(args.dedupe ? { dedupe: args.dedupe } : {}),
  } as Prisma.InputJsonValue

  const capture = await args.client.crmLeadCapture.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      channelConnectionId: args.channelConnectionId,
      leadId: args.leadId,
      contactId,
      conversationId: args.conversationId ?? null,
      captureType: args.captureType,
      rawPayloadJson: args.rawPayloadJson,
      normalizedDataJson,
      formId: identityText(origin?.formId) || null,
      formName: identityText(origin?.formName) || null,
      campaignId: identityText(origin?.campaignId) || null,
      campaignName: identityText(origin?.campaignName) || null,
      serviceInterest: identityText(origin?.serviceInterest) || null,
      resourceLabel: identityText(origin?.resourceLabel) || null,
      isFirstTouch: Boolean(args.isFirstTouch),
      scoreDelta: Number.isFinite(args.scoreDelta) ? Math.trunc(args.scoreDelta as number) : 0,
      dedupeStrategy: identityText(args.dedupeStrategy) || null,
      consentJson: args.consentJson ?? undefined,
      emailNormalized: normalizeContactEmail(args.email),
      utmSource: identityText(args.utmSource) || null,
      utmMedium: identityText(args.utmMedium) || null,
      utmCampaign: identityText(args.utmCampaign) || null,
      utmContent: identityText(args.utmContent) || null,
      utmTerm: identityText(args.utmTerm) || null,
      gclid: identityText(args.gclid) || null,
      landingPageUrl: identityText(args.landingPageUrl) || null,
      referrerUrl: identityText(args.referrerUrl) || null,
      providerLeadId: identityText(args.providerLeadId) || null,
    },
  })

  const activity = await args.client.crmActivity.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      type: args.activityType ?? 'OTHER',
      summary: `Ingreso desde ${identityText(args.sourceLabel) || 'canal CRM'}`,
      details: identityText(args.messageText) || null,
      leadId: args.leadId,
      contactId,
      occurredAt: eventAt,
      eventKey: `capture:${capture.id}`,
      createdById: args.createdById,
    },
  })

  await args.client.crmLead.update({
    where: { id: args.leadId },
    data: {
      contactId: contactId ?? undefined,
      firstTouchAt: args.isFirstTouch ? eventAt : undefined,
      lastCaptureAt: eventAt,
      lastActivityAt: eventAt,
    },
  })

  if (contactId) {
    await touchContactInteraction(args.client, contactId, eventAt)
  }

  return { capture, activity }
}
export type RecordLeadCaptureResult = LeadCaptureIdentityResult & {
  capture: CrmLeadCapture
  activity: CrmActivity
  /** Eventos de puntuación aplicados (puede venir vacío si no hay regla activa). */
  scoreEvents: ApplyCrmScoreEventResult[]
  score: number
  scoreBand: string
  /** Resolución de la regla de asignación; `assigned=false` deja el lead en "Nuevos". */
  assignment: CrmAssignmentResolution
  /** Secuencias activas en las que quedó enrolado el contacto. */
  sequences: Array<{ sequenceId: string; sequenceName: string; enrollmentId: string; created: boolean }>
}

/**
 * Flujo de captura sin conversación (formularios, landings, agenda, importaciones).
 * Crea/actualiza contacto + lead, registra la captura y la actividad.
 */
export async function recordLeadCapture(args: {
  client: CrmDbClient
  empresaId: string
  sedeId?: string | null
  createdById: string
  ownerUserId?: string | null
  channelConnectionId: string
  captureType: CrmLeadCaptureType
  activityType?: CrmActivityType
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
  source: CrmLeadSource
  origin?: LeadOriginFields | null
  rawPayloadJson: Prisma.InputJsonValue
  normalizedDataJson: Prisma.InputJsonValue
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  gclid?: string | null
  landingPageUrl?: string | null
  referrerUrl?: string | null
  providerLeadId?: string | null
  consentJson?: Prisma.InputJsonValue | null
  scoreDelta?: number
  /** `settingsJson.purpose` del formulario web; alimenta scoring y secuencias. */
  formPurpose?: string | null
  /** Eventos de score explícitos (p. ej. `MEETING_BOOKED` en la agenda). */
  extraScoreEvents?: CrmScoreEventType[] | null
}): Promise<RecordLeadCaptureResult> {
  const eventAt = args.eventAt ?? new Date()

  const identity = await ensureLeadCaptureIdentity({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    createdById: args.createdById,
    ownerUserId: args.ownerUserId ?? null,
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
    origin: args.origin ?? null,
    eventAt,
  })

  const event = await recordLeadCaptureEvent({
    client: args.client,
    empresaId: args.empresaId,
    sedeId: args.sedeId ?? null,
    createdById: args.createdById,
    channelConnectionId: args.channelConnectionId,
    leadId: identity.lead.id,
    contactId: identity.contact.id,
    captureType: args.captureType,
    activityType: args.activityType,
    eventAt,
    messageText: args.messageText,
    sourceLabel: args.origin?.sourceLabel ?? null,
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
    origin: args.origin ?? null,
    email: args.email,
    isFirstTouch: identity.isFirstTouch,
    scoreDelta: args.scoreDelta,
    dedupeStrategy: identity.leadDedupe?.strategy ?? identity.contactDedupe?.strategy ?? null,
    dedupe: {
      lead: identity.leadDedupe,
      contact: identity.contactDedupe,
    },
    consentJson: args.consentJson ?? null,
  })

  const scoreEvents = await applyCaptureScoreEvents({
    client: args.client,
    empresaId: args.empresaId,
    leadId: identity.lead.id,
    contactId: identity.contact.id,
    captureId: event.capture.id,
    captureType: args.captureType,
    formPurpose: args.formPurpose ?? null,
    resourceLabel: args.origin?.resourceLabel ?? null,
    serviceInterest: args.origin?.serviceInterest ?? null,
    messageText: args.messageText,
    occurredAt: eventAt,
    createdById: args.createdById,
  })

  for (const eventType of args.extraScoreEvents ?? []) {
    const applied = await applyScoreEvent({
      client: args.client,
      empresaId: args.empresaId,
      leadId: identity.lead.id,
      eventType,
      contactId: identity.contact.id,
      captureId: event.capture.id,
      sourceId: event.capture.id,
      occurredAt: eventAt,
      createdById: args.createdById,
    })
    scoreEvents.push(applied)
  }

  const leadAfterScoring = await args.client.crmLead.findUniqueOrThrow({
    where: { id: identity.lead.id },
    select: { id: true, score: true, scoreBand: true, nombre: true, ciudad: true },
  })

  const assignment: CrmAssignmentResolution = args.ownerUserId
    ? { assigned: true, assigneeUserId: args.ownerUserId, ruleId: null, ruleName: null }
    : await applyAssignmentRules({
        client: args.client,
        empresaId: args.empresaId,
        leadId: identity.lead.id,
        actorUserId: args.createdById,
        context: {
          source: args.source,
          formId: args.origin?.formId ?? null,
          campaignName: args.origin?.campaignName ?? null,
          serviceInterest: args.origin?.serviceInterest ?? null,
          sedeId: args.sedeId ?? null,
          city: leadAfterScoring.ciudad,
          score: leadAfterScoring.score,
          scoreBand: leadAfterScoring.scoreBand,
        },
      })

  // Import dinámico: rompe el ciclo `crm-sequences → crm-whatsapp → crm-omnichannel → crm-lead-capture`.
  const { enrollLeadInSequences } = await import('@/lib/crm-sequences')
  const sequences = await enrollLeadInSequences({
    client: args.client,
    empresaId: args.empresaId,
    leadId: identity.lead.id,
    contactId: identity.contact.id,
    actorUserId: args.createdById,
    context: {
      source: args.source,
      formId: args.origin?.formId ?? null,
      serviceInterest: args.origin?.serviceInterest ?? null,
      campaignName: args.origin?.campaignName ?? null,
      scoreBand: leadAfterScoring.scoreBand,
    },
  })

  const refreshedLead = await args.client.crmLead.findUniqueOrThrow({
    where: { id: identity.lead.id },
  })

  if (!assignment.assigned && identity.isFirstTouch) {
    await notifyCrmLeadersOfUnassignedLead({
      client: args.client,
      empresaId: args.empresaId,
      leadId: refreshedLead.id,
      leadName: refreshedLead.nombre,
      sedeId: refreshedLead.sedeId,
    })
  }

  return {
    ...identity,
    lead: refreshedLead,
    capture: event.capture,
    activity: event.activity,
    scoreEvents,
    score: leadAfterScoring.score,
    scoreBand: leadAfterScoring.scoreBand,
    assignment,
    sequences,
  }
}

/**
 * Compatibilidad: registro de captura sobre un lead ya resuelto
 * (usado por el flujo omnicanal después de crear conversación/mensaje).
 */
export async function logInboundCapture(args: Parameters<typeof recordLeadCaptureEvent>[0]): Promise<CrmLeadCapture> {
  const { capture } = await recordLeadCaptureEvent(args)
  return capture
}





