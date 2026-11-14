/**
 * Identidad de contacto CRM (captación de leads).
 *
 * Módulo sin dependencias de Next.js: lo usan la ingesta (formularios, webhooks)
 * y los scripts de backfill (`scripts/backfill-crm-contacts.ts`).
 *
 * Regla de oro: la identidad solo se resuelve por señales exactas
 * (documento → email normalizado → teléfono normalizado → sufijo de 10 dígitos).
 * Nunca se fusionan contactos aquí; la fusión vive en M4 (`mergedIntoId`).
 */

import type { Prisma, PrismaClient } from '@prisma/client'

/** Cliente Prisma o transacción: la resolución funciona en ambos. */
export type CrmDbClient = Prisma.TransactionClient | PrismaClient

export type DedupeConfidence = 'strong' | 'medium' | 'weak'

export type DedupeTrace = {
  matchedRecordId: string
  strategy: string
  matchedFields: string[]
  confidence: DedupeConfidence
}

export type ContactRecord = {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  celular: string | null
  emailNormalized: string | null
  phoneNormalized: string | null
  status: string
  sourceKey: string | null
  sourceLabel: string | null
  ownerUserId: string | null
  lastInteractionAt: Date | null
}

export type ContactIdentityInput = {
  nombre?: string | null
  apellido?: string | null
  empresaNombre?: string | null
  documento?: string | null
  email?: string | null
  phone?: string | null
  ciudad?: string | null
  departamento?: string | null
  pais?: string | null
  tags?: string[] | null
}

export const CONTACT_IDENTITY_SELECT = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  celular: true,
  emailNormalized: true,
  phoneNormalized: true,
  status: true,
  sourceKey: true,
  sourceLabel: true,
  ownerUserId: true,
  lastInteractionAt: true,
} as const

export function identityText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeContactEmail(value: string | null | undefined): string | null {
  const normalized = identityText(value).toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function normalizePhoneForMatching(value: string | null | undefined): string {
  return identityText(value).replace(/[^\d]+/g, '')
}

export function normalizeContactPhoneDigits(value: string | null | undefined): string | null {
  const digits = normalizePhoneForMatching(value)
  return digits.length > 0 ? digits : null
}

/** Formato de almacenamiento histórico del CRM: `+57XXXXXXXXXX` si viene con 57. */
export function normalizePhoneForStorage(value: string | null | undefined): string {
  const digits = normalizePhoneForMatching(value)
  if (!digits) return ''
  return digits.startsWith('57') ? `+${digits}` : digits
}

export function normalizeLooseTextForMatching(value: string | null | undefined): string {
  const raw = identityText(value)
  if (!raw) return ''
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function getEmailDomain(value: string | null | undefined): string {
  const email = identityText(value).toLowerCase()
  if (!email) return ''
  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === email.length - 1) return ''
  return email.slice(atIndex + 1)
}
/**
 * Cláusulas de búsqueda por teléfono tolerantes al formato
 * (`573001112233`, `+573001112233`, sufijo de 10 y de 8 dígitos).
 */
export function buildPhoneWhereClauses(
  field: 'telefono' | 'celular' | 'contactPhone' | 'phoneNormalized',
  rawPhone: string | null | undefined,
): Array<Record<string, unknown>> {
  const normalized = normalizePhoneForMatching(rawPhone)
  if (!normalized) return []

  const compact = normalizePhoneForStorage(rawPhone)
  const last10 = normalized.slice(-10)
  const last8 = normalized.slice(-8)
  const variants = Array.from(new Set([compact, normalized].filter(Boolean)))
  const clauses: Array<Record<string, unknown>> = variants.map((value) => ({ [field]: value }))

  if (last10 && last10 !== normalized) {
    clauses.push({ [field]: { endsWith: last10 } })
  }

  if (last8 && last8 !== last10 && last8 !== normalized) {
    clauses.push({ [field]: { endsWith: last8 } })
  }

  return clauses
}

export function buildDedupeTrace(args: {
  matchedRecordId: string
  strategy: string
  matchedFields: string[]
  confidence?: DedupeConfidence
}): DedupeTrace {
  return {
    matchedRecordId: args.matchedRecordId,
    strategy: args.strategy,
    matchedFields: Array.from(new Set(args.matchedFields.filter(Boolean))),
    confidence: args.confidence ?? 'strong',
  }
}

export function mergeContactTags(current: string[] | null | undefined, incoming: string[] | null | undefined): string[] {
  const merged = new Set<string>()
  for (const tag of [...(current ?? []), ...(incoming ?? [])]) {
    const normalized = identityText(tag).slice(0, 60)
    if (normalized) merged.add(normalized)
  }
  return Array.from(merged).slice(0, 40)
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

/**
 * Resuelve el contacto canónico (nunca `mergedIntoId`) por señales exactas.
 * Orden: documento → email normalizado → teléfono normalizado → sufijo.
 */
export async function findContactBySignals(args: {
  client: CrmDbClient
  empresaId: string
  documento?: string | null
  email?: string | null
  phone?: string | null
}): Promise<{ contact: ContactRecord; trace: DedupeTrace } | null> {
  const base = { empresaId: args.empresaId, mergedIntoId: null }
  const documento = identityText(args.documento)

  if (documento) {
    const byDocumento = await args.client.crmContact.findFirst({
      where: { ...base, documento },
      select: CONTACT_IDENTITY_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    if (byDocumento) {
      return {
        contact: byDocumento,
        trace: buildDedupeTrace({
          matchedRecordId: byDocumento.id,
          strategy: 'contact_document_exact',
          matchedFields: ['documento'],
        }),
      }
    }
  }

  const email = normalizeContactEmail(args.email)
  if (email) {
    const byEmail = await args.client.crmContact.findUnique({
      where: { empresaId_emailNormalized: { empresaId: args.empresaId, emailNormalized: email } },
      select: CONTACT_IDENTITY_SELECT,
    })
    if (byEmail) {
      return {
        contact: byEmail,
        trace: buildDedupeTrace({
          matchedRecordId: byEmail.id,
          strategy: 'contact_email_exact',
          matchedFields: ['emailNormalized'],
        }),
      }
    }
  }

  const phone = normalizeContactPhoneDigits(args.phone)
  if (phone) {
    const byPhone = await args.client.crmContact.findFirst({
      where: { ...base, phoneNormalized: phone },
      select: CONTACT_IDENTITY_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    if (byPhone) {
      return {
        contact: byPhone,
        trace: buildDedupeTrace({
          matchedRecordId: byPhone.id,
          strategy: 'contact_phone_exact',
          matchedFields: ['phoneNormalized'],
        }),
      }
    }

    if (phone.length > 10) {
      const suffix = phone.slice(-10)
      const bySuffix = await args.client.crmContact.findFirst({
        where: { ...base, phoneNormalized: { endsWith: suffix } },
        select: CONTACT_IDENTITY_SELECT,
        orderBy: { createdAt: 'asc' },
      })
      if (bySuffix) {
        return {
          contact: bySuffix,
          trace: buildDedupeTrace({
            matchedRecordId: bySuffix.id,
            strategy: 'contact_phone_suffix',
            matchedFields: ['phoneNormalized'],
            confidence: 'medium',
          }),
        }
      }
    }
  }

  return null
}
/**
 * Resuelve o crea el contacto canónico de una captura.
 * Si dos capturas simultáneas intentan crearlo con el mismo email,
 * el choque del índice único se resuelve reutilizando el contacto ganador.
 */
export async function ensureContactIdentity(args: {
  client: CrmDbClient
  empresaId: string
  sedeId?: string | null
  createdById: string
  ownerUserId?: string | null
  identity: ContactIdentityInput
  sourceKey?: string | null
  sourceLabel?: string | null
  lastInteractionAt?: Date | null
  note?: string | null
}): Promise<{ contact: ContactRecord; created: boolean; trace: DedupeTrace | null }> {
  const documento = identityText(args.identity.documento) || null
  const email = normalizeContactEmail(args.identity.email)
  const phoneDigits = normalizeContactPhoneDigits(args.identity.phone)
  const phoneStorage = normalizePhoneForStorage(args.identity.phone) || null
  const nombre = identityText(args.identity.nombre)
    || identityText(args.identity.email)
    || identityText(args.identity.phone)
    || 'Contacto sin nombre'

  const found = await findContactBySignals({
    client: args.client,
    empresaId: args.empresaId,
    documento,
    email,
    phone: phoneDigits,
  })

  if (found) {
    const patch: Prisma.CrmContactUpdateInput = {}
    if (!found.contact.email && email) patch.email = email
    if (!found.contact.telefono && phoneStorage) patch.telefono = phoneStorage
    if (!found.contact.celular && phoneStorage) patch.celular = phoneStorage
    if (!found.contact.sourceKey && args.sourceKey) patch.sourceKey = args.sourceKey
    if (!found.contact.sourceLabel && args.sourceLabel) patch.sourceLabel = args.sourceLabel
    if (!found.contact.ownerUserId && args.ownerUserId) {
      patch.ownerUser = { connect: { id: args.ownerUserId } }
    }
    if (args.identity.tags?.length) {
      const current = await args.client.crmContact.findUnique({
        where: { id: found.contact.id },
        select: { tags: true },
      })
      patch.tags = { set: mergeContactTags(current?.tags, args.identity.tags) }
    }

    const interactionAt = args.lastInteractionAt ?? null
    if (interactionAt && (!found.contact.lastInteractionAt || found.contact.lastInteractionAt < interactionAt)) {
      patch.lastInteractionAt = interactionAt
    }

    if (Object.keys(patch).length > 0) {
      await args.client.crmContact.update({ where: { id: found.contact.id }, data: patch })
    }

    return { contact: found.contact, created: false, trace: found.trace }
  }

  try {
    const contact = await args.client.crmContact.create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.sedeId ?? null,
        nombre,
        apellido: identityText(args.identity.apellido) || null,
        empresaNombre: identityText(args.identity.empresaNombre) || null,
        documento,
        email: identityText(args.identity.email) || null,
        telefono: phoneStorage,
        celular: phoneStorage,
        ciudad: identityText(args.identity.ciudad) || null,
        departamento: identityText(args.identity.departamento) || null,
        pais: identityText(args.identity.pais) || null,
        emailNormalized: email,
        phoneNormalized: phoneDigits,
        status: 'ACTIVE',
        sourceKey: args.sourceKey ?? null,
        sourceLabel: args.sourceLabel ?? null,
        ownerUserId: args.ownerUserId ?? null,
        tags: mergeContactTags([], args.identity.tags),
        lastInteractionAt: args.lastInteractionAt ?? null,
        notes: args.note ?? null,
        createdById: args.createdById,
      },
      select: CONTACT_IDENTITY_SELECT,
    })

    return {
      contact,
      created: true,
      trace: buildDedupeTrace({
        matchedRecordId: contact.id,
        strategy: 'contact_created',
        matchedFields: [],
      }),
    }
  } catch (error) {
    if (isUniqueViolation(error) && email) {
      const existing = await args.client.crmContact.findUnique({
        where: { empresaId_emailNormalized: { empresaId: args.empresaId, emailNormalized: email } },
        select: CONTACT_IDENTITY_SELECT,
      })
      if (existing) {
        return {
          contact: existing,
          created: false,
          trace: buildDedupeTrace({
            matchedRecordId: existing.id,
            strategy: 'contact_email_unique_recovery',
            matchedFields: ['emailNormalized'],
          }),
        }
      }
    }
    throw error
  }
}

/** Propaga `contactId` a los hijos de un lead que aún no lo tienen. */
export async function propagateContactToLeadChildren(
  client: CrmDbClient,
  leadId: string,
  contactId: string,
): Promise<{ captures: number; conversations: number; opportunities: number; activities: number }> {
  const [captures, conversations, opportunities, activities] = await Promise.all([
    client.crmLeadCapture.updateMany({ where: { leadId, contactId: null }, data: { contactId } }),
    client.crmConversation.updateMany({ where: { leadId, contactId: null }, data: { contactId } }),
    client.crmOpportunity.updateMany({ where: { leadId, contactId: null }, data: { contactId } }),
    client.crmActivity.updateMany({ where: { leadId, contactId: null }, data: { contactId } }),
  ])

  return {
    captures: captures.count,
    conversations: conversations.count,
    opportunities: opportunities.count,
    activities: activities.count,
  }
}

/** Marca interacción en el contacto solo si la fecha es más reciente. */
export async function touchContactInteraction(
  client: CrmDbClient,
  contactId: string,
  interactionAt: Date,
): Promise<boolean> {
  const touched = await client.crmContact.updateMany({
    where: {
      id: contactId,
      OR: [{ lastInteractionAt: null }, { lastInteractionAt: { lt: interactionAt } }],
    },
    data: { lastInteractionAt: interactionAt },
  })

  return touched.count > 0
}


