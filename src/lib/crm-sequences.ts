import type { PrismaClient } from '@prisma/client'
import { normalizeString } from '@/lib/crm'
import { sendEmail } from '@/lib/email'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import { checkOutboundQuota, formatViolation, recordOutboundUsageEvent, releaseOutboundQuota } from '@/lib/messaging-quota'
import type { CrmResponseEmailVariables } from '@/lib/crm-response-email'
import { resolveCrmResponseEmailText } from '@/lib/crm-response-email'

/**
 * Motor de secuencias de nutrición.
 *
 * - Enrolamiento: al registrar una captura se evalúan los `triggerJson` de las
 *   secuencias activas (fuente, formulario, servicio, banda de score, campaña).
 * - Ejecución: `runDueSequenceSteps()` procesa un paso por enrolamiento y
 *   reprograma el siguiente. La idempotencia la garantiza
 *   `@@unique([enrollmentId, stepId])` en `CrmSequenceSend`.
 * - Paradas: opt-out/consentimiento revocado, conversión y respuesta inbound.
 * - Canales: correo (Resend), WhatsApp (Cloud API del canal activo de la sede),
 *   tarea interna y espera. `WEBHOOK` queda reservado.
 */
export type CrmSequenceClient = Pick<
  PrismaClient,
  | 'crmSequence'
  | 'crmSequenceEnrollment'
  | 'crmSequenceSend'
  | 'crmLead'
  | 'crmContact'
  | 'crmContactConsent'
  | 'crmActivity'
  | 'crmTask'
  | 'crmChannelConnection'
  | 'user'
>

export type CrmSequenceTriggerJson = {
  sources?: string[]
  formIds?: string[]
  services?: string[]
  scoreBands?: string[]
  campaignNames?: string[]
}

export type CrmSequenceTriggerContext = {
  source?: string | null
  formId?: string | null
  serviceInterest?: string | null
  scoreBand?: string | null
  campaignName?: string | null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => normalizeString(item)).filter(Boolean)))
}

export function parseCrmSequenceTriggerJson(value: unknown): CrmSequenceTriggerJson {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  return {
    sources: toStringArray(raw.sources),
    formIds: toStringArray(raw.formIds),
    services: toStringArray(raw.services),
    scoreBands: toStringArray(raw.scoreBands),
    campaignNames: toStringArray(raw.campaignNames),
  }
}

function matchesAny(list: string[] | undefined, candidate: string | null | undefined) {
  if (!list?.length) return true
  const needle = normalizeString(candidate).toLowerCase()
  if (!needle) return false
  return list.some((item) => item.toLowerCase() === needle)
}

export function matchesCrmSequenceTrigger(
  trigger: CrmSequenceTriggerJson,
  context: CrmSequenceTriggerContext
): boolean {
  if (!matchesAny(trigger.sources, context.source)) return false
  if (!matchesAny(trigger.formIds, context.formId)) return false
  if (!matchesAny(trigger.services, context.serviceInterest)) return false
  if (!matchesAny(trigger.scoreBands, context.scoreBand)) return false
  if (!matchesAny(trigger.campaignNames, context.campaignName)) return false
  return true
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + Math.max(0, Math.trunc(days)) * 24 * 60 * 60 * 1000)
}

export type CrmSequenceEnrollmentResult = {
  sequenceId: string
  sequenceName: string
  enrollmentId: string
  created: boolean
}

/**
 * Enrola el lead/contacto en las secuencias activas cuyo trigger coincida.
 * Es idempotente por `(sequenceId, contactId)`.
 */
export async function enrollLeadInSequences(args: {
  client: CrmSequenceClient
  empresaId: string
  leadId: string
  contactId: string
  context: CrmSequenceTriggerContext
  actorUserId?: string | null
  now?: Date
}): Promise<CrmSequenceEnrollmentResult[]> {
  const now = args.now ?? new Date()

  const sequences = await args.client.crmSequence.findMany({
    where: { empresaId: args.empresaId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  const results: CrmSequenceEnrollmentResult[] = []

  for (const sequence of sequences) {
    if (!sequence.steps.length) continue
    const trigger = parseCrmSequenceTriggerJson(sequence.triggerJson)
    if (!matchesCrmSequenceTrigger(trigger, args.context)) continue

    const existing = await args.client.crmSequenceEnrollment.findUnique({
      where: { sequenceId_contactId: { sequenceId: sequence.id, contactId: args.contactId } },
      select: { id: true },
    })
    if (existing) {
      results.push({
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        enrollmentId: existing.id,
        created: false,
      })
      continue
    }

    const firstStep = sequence.steps[0]
    const enrollment = await args.client.crmSequenceEnrollment.create({
      data: {
        empresaId: args.empresaId,
        sequenceId: sequence.id,
        contactId: args.contactId,
        leadId: args.leadId,
        status: 'ACTIVE',
        currentStepOrder: firstStep.order - 1,
        nextRunAt: addDays(now, firstStep.delayDays),
      },
    })

    if (args.actorUserId) {
      await args.client.crmActivity.create({
        data: {
          empresaId: args.empresaId,
          type: 'OTHER',
          summary: `Enrolado en secuencia «${sequence.name}»`,
          details: `Próximo paso: ${addDays(now, firstStep.delayDays).toISOString()}`,
          leadId: args.leadId,
          contactId: args.contactId,
          createdById: args.actorUserId,
        },
      })
    }

    results.push({
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      enrollmentId: enrollment.id,
      created: true,
    })
  }

  return results
}

export async function stopEnrollmentsForLead(args: {
  client: CrmSequenceClient
  empresaId: string
  leadId: string
  status: 'STOPPED_OPT_OUT' | 'STOPPED_CONVERTED' | 'STOPPED_REPLY' | 'CANCELLED' | 'PAUSED'
  reason?: string | null
}): Promise<number> {
  const result = await args.client.crmSequenceEnrollment.updateMany({
    where: { empresaId: args.empresaId, leadId: args.leadId, status: { in: ['ACTIVE', 'PAUSED'] } },
    data: {
      status: args.status,
      stoppedReason: args.reason ?? null,
      nextRunAt: null,
      ...(args.status === 'CANCELLED' ? { completedAt: new Date() } : {}),
    },
  })

  return result.count
}

export type CrmSequenceRunSummary = {
  processed: number
  sent: number
  failed: number
  skipped: number
  completed: number
  stopped: number
  dryRun: boolean
}

type SequenceStepOutcome = {
  status: 'SENT' | 'FAILED' | 'SKIPPED'
  recipient: string
  providerMessageId?: string | null
  errorMessage?: string | null
}

async function executeEmailStep(args: {
  step: { subject: string | null; bodyHtml: string | null }
  recipient: string
  variables: CrmResponseEmailVariables
}): Promise<SequenceStepOutcome> {
  const recipient = normalizeString(args.recipient)
  if (!recipient) return { status: 'SKIPPED', recipient: '', errorMessage: 'Sin correo del contacto' }

  const subject = resolveCrmResponseEmailText(args.step.subject || 'Continuamos en contacto', args.variables)
  const body = resolveCrmResponseEmailText(
    args.step.bodyHtml || 'Hola {{nombre}}, queremos retomar la conversación.',
    args.variables
  )
  const html = body.includes('<')
    ? body
    : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">${body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p style="margin:0 0 8px;">${line}</p>`)
        .join('')}</div>`

  try {
    const result = await sendEmail({ to: recipient, subject, html })
    if (!result.ok) {
      return { status: 'FAILED', recipient, errorMessage: result.error }
    }
    const messageId = typeof result.id === 'string' && result.id ? result.id : null
    return { status: 'SENT', recipient, providerMessageId: messageId }
  } catch (error) {
    return {
      status: 'FAILED',
      recipient,
      errorMessage: error instanceof Error ? error.message : 'Error al enviar correo',
    }
  }
}

async function executeWhatsAppStep(args: {
  client: CrmSequenceClient
  empresaId: string
  sedeId: string | null
  bodyText: string
  recipient: string
}): Promise<SequenceStepOutcome> {
  const recipient = normalizeWhatsAppRecipient(args.recipient)
  if (!recipient) return { status: 'SKIPPED', recipient: '', errorMessage: 'Sin teléfono del contacto' }

  const channel = await args.client.crmChannelConnection.findFirst({
    where: {
      empresaId: args.empresaId,
      provider: 'WHATSAPP_CLOUD',
      status: 'ACTIVE',
      ...(args.sedeId ? { OR: [{ sedeId: args.sedeId }, { sedeId: null }] } : {}),
    },
    orderBy: [{ sedeId: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, provider: true, externalPhoneNumberId: true, externalPageId: true, settingsJson: true },
  })

  if (!channel) {
    return { status: 'SKIPPED', recipient, errorMessage: 'Sin canal de WhatsApp activo en la sede' }
  }

  const config = getWhatsAppDispatchConfig(channel)
  if (!config.enabled) {
    return { status: 'SKIPPED', recipient, errorMessage: 'El canal de WhatsApp no tiene credenciales completas' }
  }

  const quotaCheck = await checkOutboundQuota({ empresaId: args.empresaId, channelConnectionId: channel.id, provider: channel.provider, settingsJson: channel.settingsJson })
  if (!quotaCheck.allowed) {
    return { status: 'SKIPPED', recipient, errorMessage: quotaCheck.violation ? formatViolation(quotaCheck.violation) : 'Límite de mensajería alcanzado' }
  }

  try {
    const result = await sendWhatsAppTextMessage({ config, to: recipient, bodyText: args.bodyText })
    await recordOutboundUsageEvent({ empresaId: args.empresaId, channelConnectionId: channel.id, provider: channel.provider, status: result.providerMessageId ? 'SENT' : 'FAILED', providerMessageId: result.providerMessageId })
    return { status: 'SENT', recipient, providerMessageId: result.providerMessageId }
  } catch (error) {
    await releaseOutboundQuota({ empresaId: args.empresaId, channelConnectionId: channel.id, provider: channel.provider })
    return {
      status: 'FAILED',
      recipient,
      errorMessage: error instanceof Error ? error.message : 'Error al enviar WhatsApp',
    }
  }
}

/**
 * Procesa un paso por enrolamiento vencido. Idempotente: si ya existe
 * `CrmSequenceSend` para `(enrollmentId, stepId)` no vuelve a enviar.
 */
export async function runDueSequenceSteps(args: {
  client: CrmSequenceClient
  empresaId: string
  limit?: number
  now?: Date
  dryRun?: boolean
}): Promise<CrmSequenceRunSummary> {
  const now = args.now ?? new Date()
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 100)
  const dryRun = Boolean(args.dryRun)
  const summary: CrmSequenceRunSummary = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    completed: 0,
    stopped: 0,
    dryRun,
  }

  const enrollments = await args.client.crmSequenceEnrollment.findMany({
    where: { empresaId: args.empresaId, status: 'ACTIVE', nextRunAt: { lte: now } },
    orderBy: { nextRunAt: 'asc' },
    take: limit,
    include: {
      sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
      contact: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          telefono: true,
          celular: true,
          status: true,
          empresaNombre: true,
        },
      },
      lead: {
        select: {
          id: true,
          nombre: true,
          email: true,
          lifecycleStatus: true,
          ownerUserId: true,
          noContactRequestedAt: true,
          sedeId: true,
          serviceInterest: true,
        },
      },
    },
  })

  for (const enrollment of enrollments) {
    summary.processed += 1

    const contact = enrollment.contact
    const lead = enrollment.lead
    const sequence = enrollment.sequence

    const stopEnrollment = async (
      status: 'STOPPED_OPT_OUT' | 'STOPPED_CONVERTED' | 'CANCELLED',
      reason: string
    ) => {
      summary.stopped += 1
      if (dryRun) return
      await args.client.crmSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status, stoppedReason: reason, nextRunAt: null },
      })
    }

    if (
      lead?.lifecycleStatus === 'DO_NOT_CONTACT' ||
      lead?.noContactRequestedAt ||
      contact.status === 'DO_NOT_CONTACT'
    ) {
      await stopEnrollment('STOPPED_OPT_OUT', 'Contacto marcado como no contactar')
      continue
    }

    if (lead?.lifecycleStatus === 'CONVERTED' && sequence.stopOnOpportunity) {
      await stopEnrollment('STOPPED_CONVERTED', 'Lead convertido en oportunidad')
      continue
    }

    const completeEnrollment = async () => {
      summary.completed += 1
      if (dryRun) return
      await args.client.crmSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'COMPLETED', completedAt: now, nextRunAt: null },
      })
    }

    const nextStep = sequence.steps.find((step) => step.order > enrollment.currentStepOrder)
    if (!nextStep) {
      await completeEnrollment()
      continue
    }

    if (nextStep.kind === 'EMAIL' || nextStep.kind === 'WHATSAPP') {
      const consent = await args.client.crmContactConsent.findUnique({
        where: {
          contactId_channel: {
            contactId: contact.id,
            channel: nextStep.kind === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
          },
        },
        select: { status: true },
      })

      if (consent?.status === 'REVOKED') {
        await stopEnrollment('STOPPED_OPT_OUT', `Consentimiento revocado para ${nextStep.kind}`)
        continue
      }
    }

    if (dryRun) {
      summary.skipped += 1
      continue
    }

    const variables: CrmResponseEmailVariables = {
      nombre: [contact.nombre, contact.apellido].filter(Boolean).join(' ').trim() || lead?.nombre || '',
      email: contact.email || lead?.email || '',
      telefono: contact.celular || contact.telefono || '',
      servicio: lead?.serviceInterest || sequence.name,
      empresa: contact.empresaNombre || '',
    }

    const existingSend = await args.client.crmSequenceSend.findUnique({
      where: { enrollmentId_stepId: { enrollmentId: enrollment.id, stepId: nextStep.id } },
      select: { id: true },
    })

    const channel =
      nextStep.kind === 'EMAIL'
        ? 'EMAIL'
        : nextStep.kind === 'WHATSAPP'
          ? 'WHATSAPP'
          : nextStep.kind === 'TASK'
            ? 'TASK'
            : nextStep.kind

    let outcome: SequenceStepOutcome

    if (existingSend) {
      outcome = { status: 'SKIPPED', recipient: '', errorMessage: 'Paso ya ejecutado previamente' }
    } else if (nextStep.kind === 'WAIT') {
      outcome = { status: 'SKIPPED', recipient: '', errorMessage: 'Paso de espera programado' }
    } else if (nextStep.kind === 'EMAIL') {
      outcome = await executeEmailStep({
        step: nextStep,
        recipient: contact.email || lead?.email || '',
        variables,
      })
    } else if (nextStep.kind === 'WHATSAPP') {
      outcome = await executeWhatsAppStep({
        client: args.client,
        empresaId: args.empresaId,
        sedeId: lead?.sedeId ?? null,
        bodyText: resolveCrmResponseEmailText(
          nextStep.bodyHtml || 'Hola {{nombre}}, queremos retomar la conversación.',
          variables
        ),
        recipient: contact.celular || contact.telefono || '',
      })
    } else if (nextStep.kind === 'TASK') {
      if (!lead?.ownerUserId) {
        outcome = { status: 'SKIPPED', recipient: '', errorMessage: 'Lead sin responsable para crear la tarea' }
      } else {
        const task = await args.client.crmTask.create({
          data: {
            empresaId: args.empresaId,
            sedeId: lead.sedeId,
            title: nextStep.taskTitle || nextStep.subject || `Seguimiento de secuencia «${sequence.name}»`,
            description: nextStep.bodyHtml ?? null,
            status: 'OPEN',
            priority: 'NORMAL',
            dueAt: now,
            leadId: lead.id,
            assignedToUserId: lead.ownerUserId,
            createdById: lead.ownerUserId,
          },
          select: { id: true },
        })
        outcome = { status: 'SENT', recipient: lead.ownerUserId, providerMessageId: task.id }
      }
    } else {
      outcome = { status: 'SKIPPED', recipient: '', errorMessage: 'Canal WEBHOOK reservado para integraciones' }
    }

    if (outcome.status === 'SENT') summary.sent += 1
    else if (outcome.status === 'FAILED') summary.failed += 1
    else summary.skipped += 1

    if (!existingSend) {
      await args.client.crmSequenceSend.create({
        data: {
          empresaId: args.empresaId,
          enrollmentId: enrollment.id,
          stepId: nextStep.id,
          channel,
          status: outcome.status,
          recipient: outcome.recipient,
          providerMessageId: outcome.providerMessageId ?? null,
          errorMessage: outcome.errorMessage ?? null,
        },
      })

      if (lead?.ownerUserId) {
        await args.client.crmActivity.create({
          data: {
            empresaId: args.empresaId,
            sedeId: lead.sedeId,
            type: channel === 'EMAIL' ? 'EMAIL' : channel === 'WHATSAPP' ? 'WHATSAPP' : 'OTHER',
            summary: `Secuencia «${sequence.name}» · ${channel} ${outcome.status.toLowerCase()}`,
            details: outcome.errorMessage ?? nextStep.subject ?? null,
            leadId: lead.id,
            contactId: contact.id,
            occurredAt: now,
            createdById: lead.ownerUserId,
          },
        })
      }
    }

    const followingStep = sequence.steps.find((step) => step.order > nextStep.order)
    if (followingStep) {
      await args.client.crmSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepOrder: nextStep.order,
          nextRunAt: addDays(now, followingStep.delayDays),
        },
      })
    } else {
      await args.client.crmSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepOrder: nextStep.order,
          status: 'COMPLETED',
          completedAt: now,
          nextRunAt: null,
        },
      })
    }
  }

  return summary
}

