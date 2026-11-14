import type { CrmLead, CrmLeadLifecycleStatus, CrmLeadStatus, Prisma, PrismaClient } from '@prisma/client'

/**
 * Máquina de estados del ciclo de vida del lead (captación).
 * `CONVERTED` solo se alcanza creando oportunidad (`/convert-opportunity`).
 */
export const CRM_LIFECYCLE_TRANSITIONS: Record<CrmLeadLifecycleStatus, CrmLeadLifecycleStatus[]> = {
  NEW: ['PENDING_REVIEW', 'NURTURING', 'QUALIFIED', 'SALES_ASSIGNED', 'DISCARDED', 'DO_NOT_CONTACT'],
  PENDING_REVIEW: ['NEW', 'NURTURING', 'QUALIFIED', 'SALES_ASSIGNED', 'DISCARDED', 'DO_NOT_CONTACT'],
  NURTURING: ['PENDING_REVIEW', 'QUALIFIED', 'SALES_ASSIGNED', 'DISCARDED', 'DO_NOT_CONTACT'],
  QUALIFIED: ['NURTURING', 'SALES_ASSIGNED', 'DISCARDED', 'DO_NOT_CONTACT'],
  SALES_ASSIGNED: ['QUALIFIED', 'NURTURING', 'DISCARDED', 'DO_NOT_CONTACT'],
  CONVERTED: ['DO_NOT_CONTACT'],
  DISCARDED: ['NEW', 'NURTURING'],
  DO_NOT_CONTACT: [],
}

export const CRM_LIFECYCLE_LABELS: Record<CrmLeadLifecycleStatus, string> = {
  NEW: 'Nuevo',
  PENDING_REVIEW: 'Pendiente de revisión',
  NURTURING: 'En nutrición',
  QUALIFIED: 'Calificado',
  SALES_ASSIGNED: 'Asignado a ventas',
  CONVERTED: 'Convertido',
  DISCARDED: 'Descartado',
  DO_NOT_CONTACT: 'No contactar',
}

export const CRM_LIFECYCLE_STATUSES = Object.keys(CRM_LIFECYCLE_TRANSITIONS) as CrmLeadLifecycleStatus[]

export function canTransitionCrmLifecycle(
  from: CrmLeadLifecycleStatus,
  to: CrmLeadLifecycleStatus
): boolean {
  if (from === to) return true
  return CRM_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false
}

export function parseCrmLifecycleStatus(value: unknown): CrmLeadLifecycleStatus | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return CRM_LIFECYCLE_STATUSES.includes(raw as CrmLeadLifecycleStatus)
    ? (raw as CrmLeadLifecycleStatus)
    : null
}

function mapLegacyLeadStatus(status: CrmLeadLifecycleStatus, current: CrmLeadStatus): CrmLeadStatus {
  switch (status) {
    case 'NEW':
    case 'PENDING_REVIEW':
    case 'NURTURING':
      return 'NEW'
    case 'QUALIFIED':
      return 'QUALIFIED'
    case 'SALES_ASSIGNED':
      return 'CONTACTED'
    case 'CONVERTED':
      return 'CONVERTED'
    case 'DISCARDED':
      return 'LOST'
    case 'DO_NOT_CONTACT':
      return current
    default:
      return current
  }
}

export type CrmLifecycleClient = Pick<
  PrismaClient,
  | 'crmLead'
  | 'crmActivity'
  | 'crmContact'
  | 'crmContactConsent'
  | 'crmSequenceEnrollment'
>

export class CrmLifecycleError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'lead-not-found'
      | 'invalid-transition'
      | 'reason-required'
      | 'conversion-required'
      | 'no-sequence'
  ) {
    super(message)
    this.name = 'CrmLifecycleError'
  }
}

/**
 * Aplica una transición validada y deja auditoría idempotente.
 * Efectos colaterales: marcas de nutrición/descarte, opt-out y parada de secuencias.
 */
export async function applyLeadLifecycleTransition(args: {
  client: CrmLifecycleClient
  empresaId: string
  leadId: string
  nextStatus: CrmLeadLifecycleStatus
  actorUserId: string
  reason?: string | null
}): Promise<CrmLead> {
  const lead = await args.client.crmLead.findUnique({ where: { id: args.leadId } })
  if (!lead || lead.empresaId !== args.empresaId) {
    throw new CrmLifecycleError('Lead no encontrado', 'lead-not-found')
  }

  if (args.nextStatus === 'CONVERTED') {
    throw new CrmLifecycleError(
      'CONVERTED solo se alcanza creando una oportunidad',
      'conversion-required'
    )
  }

  if (!canTransitionCrmLifecycle(lead.lifecycleStatus, args.nextStatus)) {
    throw new CrmLifecycleError(
      `Transición no permitida: ${lead.lifecycleStatus} → ${args.nextStatus}`,
      'invalid-transition'
    )
  }

  const reason = typeof args.reason === 'string' ? args.reason.trim() : ''
  if (args.nextStatus === 'DISCARDED' && reason.length < 10) {
    throw new CrmLifecycleError('El motivo de descarte debe tener al menos 10 caracteres', 'reason-required')
  }

  const now = new Date()
  const data: Prisma.CrmLeadUpdateInput = {
    lifecycleStatus: args.nextStatus,
    status: mapLegacyLeadStatus(args.nextStatus, lead.status),
  }

  if (args.nextStatus === 'NURTURING') {
    data.nurtureStartedAt = lead.nurtureStartedAt ?? now
  }
  if (args.nextStatus === 'DISCARDED') {
    data.discardedAt = now
    data.discardReason = reason
  }
  if (args.nextStatus === 'DO_NOT_CONTACT') {
    data.noContactRequestedAt = now
  }

  const updated = await args.client.crmLead.update({ where: { id: lead.id }, data })

  if (args.nextStatus === 'DO_NOT_CONTACT') {
    if (updated.contactId) {
      await args.client.crmContact.update({
        where: { id: updated.contactId },
        data: { status: 'DO_NOT_CONTACT' },
      })

      await args.client.crmContactConsent.updateMany({
        where: {
          empresaId: args.empresaId,
          contactId: updated.contactId,
          channel: { in: ['EMAIL', 'WHATSAPP', 'SMS', 'CALL'] },
        },
        data: { status: 'REVOKED', revokedAt: now, source: 'do-not-contact' },
      })
    }

    await args.client.crmSequenceEnrollment.updateMany({
      where: { empresaId: args.empresaId, leadId: updated.id, status: { in: ['ACTIVE', 'PAUSED'] } },
      data: { status: 'STOPPED_OPT_OUT', stoppedReason: reason || 'Solicitud de no contacto', nextRunAt: null },
    })
  }

  await args.client.crmActivity.create({
    data: {
      empresaId: args.empresaId,
      sedeId: updated.sedeId,
      type: 'OTHER',
      summary: `Estado del lead: ${CRM_LIFECYCLE_LABELS[args.nextStatus]}`,
      details: reason || null,
      leadId: updated.id,
      contactId: updated.contactId,
      occurredAt: now,
      eventKey: `status:${updated.id}:${now.getTime()}`,
      metadataJson: { from: lead.lifecycleStatus, to: args.nextStatus, reason },
      createdById: args.actorUserId,
    },
  })

  return updated
}
