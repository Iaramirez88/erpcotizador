/**
 * Batería de captación de leads (FASE 4-7).
 *
 *   npx tsx scripts/test-crm-captacion.ts
 *
 * Verifica end-to-end, contra la base local:
 *  1. Una captura produce contacto + lead + captura + actividad + evento de score.
 *  2. Reutilización de contacto/lead por email (dedupe) y `isFirstTouch`.
 *  3. Scoring idempotente: repetir la captura no duplica puntos (oncePerLead).
 *  4. Asignación por reglas y reparto: el lead queda con responsable.
 *  5. Transiciones de ciclo de vida: válidas, motivo obligatorio y CONVERTED bloqueado.
 *  6. No contactar revoca consentimientos y detiene secuencias.
 *  7. Secuencias: un paso por corrida, envío idempotente y parada por opt-out.
 *  8. Historial unificado y alcance por registro (SEDE por defecto).
 *
 * Crea una empresa temporal y la elimina al final. No ejecutar en producción.
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { recordLeadCapture } from '../src/lib/crm-lead-capture'
import { applyLeadLifecycleTransition, CrmLifecycleError } from '../src/lib/crm-lifecycle'
import { enrollLeadInSequences, runDueSequenceSteps, stopEnrollmentsForLead } from '../src/lib/crm-sequences'
import { recalculateLeadScore } from '../src/lib/crm-scoring'
import { loadLeadTimeline } from '../src/lib/crm-timeline'
import { resolveCrmRecordScope } from '../src/lib/crm-scope'

if (process.env.NODE_ENV === 'production') {
  console.error('Este script crea y elimina datos de prueba. No lo ejecutes en producción.')
  process.exit(1)
}

let failures = 0

function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1
  console.log(`${ok ? 'OK ' : 'FAIL'} · ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`)
}

async function expectLifecycleError(
  label: string,
  promise: Promise<unknown>,
  expectedCode: string
) {
  try {
    await promise
    check(label, false, 'no lanzó error')
  } catch (error) {
    const code = error instanceof CrmLifecycleError ? error.code : 'unknown'
    check(label, code === expectedCode, code)
  }
}

async function main() {
  const stamp = Date.now()
  let ownerId: string | null = null
  const empresa = await prisma.empresa.create({
    data: { nombre: `TMP CRM CAPTACION ${stamp}`, nit: `TMP-CRM-${stamp}`, planTier: 'BASIC' },
  })

  try {
    const owner = await prisma.user.create({
      data: {
        email: `tmp.crm.owner.${stamp}@local.test`,
        name: 'Asesor CRM',
        empresaId: empresa.id,
        role: 'ADMIN',
      },
    })
    ownerId = owner.id

    const sede = await prisma.sede.create({
      data: { empresaId: empresa.id, nombre: 'Principal', codigo: `T${stamp}`.slice(-6) },
    })

    await prisma.sedeMembership.create({
      data: { sedeId: sede.id, userId: owner.id, role: 'ADMIN' },
    })

    const channel = await prisma.crmChannelConnection.create({
      data: {
        empresaId: empresa.id,
        sedeId: sede.id,
        provider: 'WEB_FORM',
        status: 'ACTIVE',
        name: 'Formulario de prueba',
        createdById: owner.id,
      },
    })

    await prisma.crmAssignmentRule.create({
      data: {
        empresaId: empresa.id,
        name: 'Web → asesor',
        priority: 10,
        active: true,
        matchJson: { sources: ['WEB'] },
        assigneeUserId: owner.id,
        createdById: owner.id,
      },
    })

    const email = `lead.${stamp}@local.test`
    const firstCapture = await recordLeadCapture({
      client: prisma,
      empresaId: empresa.id,
      sedeId: sede.id,
      createdById: owner.id,
      channelConnectionId: channel.id,
      source: 'WEB',
      captureType: 'WEB_FORM',
      activityType: 'NOTE',
      formPurpose: 'LEAD_CAPTURE',
      nombre: 'Laura Prospecto',
      empresaNombre: 'Comercial Andina',
      email,
      phone: '+57 300 123 4567',
      ciudad: 'Bogotá',
      messageText: 'Quiero una cotización de software contable',
      origin: {
        sourceKey: 'WEB_FORM',
        sourceLabel: 'Formulario web',
        serviceInterest: 'software contable',
        formId: channel.id,
        formName: 'Formulario de prueba',
        campaignName: 'demo-crm',
      },
      rawPayloadJson: { test: true },
      normalizedDataJson: { test: true },
    })

    check('La captura crea contacto y lead', Boolean(firstCapture.contact.id && firstCapture.lead.id))
    check('La primera captura marca isFirstTouch', firstCapture.isFirstTouch === true)
    check('La captura denormaliza el contacto en el lead', firstCapture.lead.contactId === firstCapture.contact.id)
    check(
      'La actividad de captura queda registrada',
      Boolean(firstCapture.activity.id && firstCapture.activity.eventKey?.startsWith('capture:')),
      firstCapture.activity.eventKey
    )
    check('El scoring aplicó eventos', firstCapture.scoreEvents.some((event) => event.applied), firstCapture.scoreEvents.map((e) => e.reason))
    check('La regla de asignación asignó responsable', firstCapture.assignment.assigned && firstCapture.lead.ownerUserId === owner.id)
    check('El lead asignado pasa a SALES_ASSIGNED', firstCapture.lead.lifecycleStatus === 'SALES_ASSIGNED', firstCapture.lead.lifecycleStatus)

    const secondCapture = await recordLeadCapture({
      client: prisma,
      empresaId: empresa.id,
      sedeId: sede.id,
      createdById: owner.id,
      channelConnectionId: channel.id,
      source: 'WEB',
      captureType: 'WEB_FORM',
      formPurpose: 'LEAD_CAPTURE',
      nombre: 'Laura Prospecto',
      empresaNombre: 'Comercial Andina',
      email,
      messageText: 'Sigo interesada',
      origin: {
        sourceKey: 'WEB_FORM',
        sourceLabel: 'Formulario web',
        serviceInterest: 'software contable',
        formId: channel.id,
        formName: 'Formulario de prueba',
      },
      rawPayloadJson: { test: 2 },
      normalizedDataJson: { test: 2 },
    })

    check('La segunda captura reutiliza el lead', secondCapture.lead.id === firstCapture.lead.id)
    check('La segunda captura reutiliza el contacto', secondCapture.contact.id === firstCapture.contact.id)
    check('La segunda captura no es primer contacto', secondCapture.isFirstTouch === false)

    const [contactCount, leadCount, captureCount] = await Promise.all([
      prisma.crmContact.count({ where: { empresaId: empresa.id } }),
      prisma.crmLead.count({ where: { empresaId: empresa.id } }),
      prisma.crmLeadCapture.count({ where: { empresaId: empresa.id } }),
    ])
    check('Solo hay un contacto y un lead por email', contactCount === 1 && leadCount === 1, { contactCount, leadCount })
    check('Las dos capturas quedan registradas', captureCount === 2, captureCount)

    const scoreAfterSecond = secondCapture.score

    const thirdCapture = await recordLeadCapture({
      client: prisma,
      empresaId: empresa.id,
      sedeId: sede.id,
      createdById: owner.id,
      channelConnectionId: channel.id,
      source: 'WEB',
      captureType: 'WEB_FORM',
      formPurpose: 'LEAD_CAPTURE',
      nombre: 'Laura Prospecto',
      email,
      messageText: 'Sigo interesada',
      origin: {
        sourceKey: 'WEB_FORM',
        sourceLabel: 'Formulario web',
        serviceInterest: 'software contable',
        formId: channel.id,
        formName: 'Formulario de prueba',
      },
      rawPayloadJson: { test: 3 },
      normalizedDataJson: { test: 3 },
    })

    check('Los eventos once-per-lead no duplican puntos', thirdCapture.score === scoreAfterSecond, {
      scoreAfterSecond,
      scoreAfterThird: thirdCapture.score,
    })
    check(
      'La puntuación coincide con la suma de eventos',
      thirdCapture.score ===
        (await prisma.crmLeadScoreEvent.aggregate({ where: { leadId: firstCapture.lead.id }, _sum: { points: true } }))
          ._sum.points,
    )

    const recalculated = await recalculateLeadScore({
      client: prisma,
      empresaId: empresa.id,
      leadId: firstCapture.lead.id,
      actorUserId: owner.id,
    })
    check('Recalcular es idempotente', recalculated.delta === 0, recalculated.delta)

    const sequence = await prisma.crmSequence.create({
      data: {
        empresaId: empresa.id,
        name: 'Nutrición software',
        status: 'ACTIVE',
        triggerJson: { sources: ['WEB'], services: ['software contable'] },
        createdById: owner.id,
        steps: {
          create: [
            { order: 1, kind: 'TASK', delayDays: 0, taskTitle: 'Llamar al lead', subject: 'Llamada inicial' },
            { order: 2, kind: 'TASK', delayDays: 100, taskTitle: 'Seguimiento', subject: 'Seguimiento' },
          ],
        },
      },
    })

    const enrollment = await enrollLeadInSequences({
      client: prisma,
      empresaId: empresa.id,
      leadId: firstCapture.lead.id,
      contactId: firstCapture.contact.id,
      actorUserId: owner.id,
      context: { source: 'WEB', serviceInterest: 'software contable' },
    })
    check('El trigger enrola al lead', enrollment.some((item) => item.created), enrollment)

    const run = await runDueSequenceSteps({ client: prisma, empresaId: empresa.id, limit: 10 })
    check('La corrida procesa el enrolamiento', run.processed === 1, run)
    check('El paso TASK crea tarea y queda enviado', run.sent === 1, run.sent)

    const enrollmentAfterRun = await prisma.crmSequenceEnrollment.findFirst({
      where: { sequenceId: sequence.id, leadId: firstCapture.lead.id },
    })
    check('El enrolamiento sigue activo para el siguiente paso', enrollmentAfterRun?.status === 'ACTIVE', enrollmentAfterRun?.status)
    check('El siguiente paso se reprograma', Boolean(enrollmentAfterRun?.nextRunAt))

    const taskCount = await prisma.crmTask.count({ where: { empresaId: empresa.id, leadId: firstCapture.lead.id } })
    check('Se creó la tarea de la secuencia', taskCount >= 1, taskCount)

    const rerun = await runDueSequenceSteps({ client: prisma, empresaId: empresa.id, limit: 10, now: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) })
    check('Fuera de ventana no se ejecuta el paso siguiente', rerun.processed === 0, rerun.processed)

    const sendCount = await prisma.crmSequenceSend.count({ where: { empresaId: empresa.id } })
    check('Cada paso deja un registro de envío', sendCount === 1, sendCount)


    const qualified = await applyLeadLifecycleTransition({
      client: prisma,
      empresaId: empresa.id,
      leadId: firstCapture.lead.id,
      nextStatus: 'QUALIFIED',
      actorUserId: owner.id,
      reason: 'Datos completos',
    })
    check('SALES_ASSIGNED → QUALIFIED es válido', qualified.lifecycleStatus === 'QUALIFIED')

    await expectLifecycleError(
      'CONVERTED no se alcanza por cambio directo',
      applyLeadLifecycleTransition({
        client: prisma,
        empresaId: empresa.id,
        leadId: firstCapture.lead.id,
        nextStatus: 'CONVERTED',
        actorUserId: owner.id,
      }),
      'conversion-required'
    )

    await expectLifecycleError(
      'Descartar exige motivo',
      applyLeadLifecycleTransition({
        client: prisma,
        empresaId: empresa.id,
        leadId: firstCapture.lead.id,
        nextStatus: 'DISCARDED',
        actorUserId: owner.id,
        reason: 'corto',
      }),
      'reason-required'
    )

    const discarded = await applyLeadLifecycleTransition({
      client: prisma,
      empresaId: empresa.id,
      leadId: firstCapture.lead.id,
      nextStatus: 'DISCARDED',
      actorUserId: owner.id,
      reason: 'No cumple el perfil comercial definido',
    })
    check('Descartar con motivo funciona', discarded.lifecycleStatus === 'DISCARDED')

    const leadB = await recordLeadCapture({
      client: prisma,
      empresaId: empresa.id,
      sedeId: sede.id,
      createdById: owner.id,
      channelConnectionId: channel.id,
      source: 'WEB',
      captureType: 'WEB_FORM',
      formPurpose: 'LEAD_CAPTURE',
      nombre: 'Mario OptOut',
      email: `optout.${stamp}@local.test`,
      origin: { sourceKey: 'WEB_FORM', sourceLabel: 'Formulario web' },
      rawPayloadJson: {},
      normalizedDataJson: {},
    })

    await prisma.crmContactConsent.create({
      data: {
        empresaId: empresa.id,
        contactId: leadB.contact.id,
        channel: 'EMAIL',
        status: 'GRANTED',
        source: 'test',
        grantedAt: new Date(),
      },
    })

    await prisma.crmSequenceEnrollment.create({
      data: {
        empresaId: empresa.id,
        sequenceId: sequence.id,
        contactId: leadB.contact.id,
        leadId: leadB.lead.id,
        status: 'ACTIVE',
        nextRunAt: new Date(),
      },
    })

    const doNotContact = await applyLeadLifecycleTransition({
      client: prisma,
      empresaId: empresa.id,
      leadId: leadB.lead.id,
      nextStatus: 'DO_NOT_CONTACT',
      actorUserId: owner.id,
      reason: 'Solicitó no ser contactado',
    })
    check('No contactar es terminal', doNotContact.lifecycleStatus === 'DO_NOT_CONTACT')

    const [contactAfter, consentAfter, enrollmentAfter] = await Promise.all([
      prisma.crmContact.findUnique({ where: { id: leadB.contact.id }, select: { status: true } }),
      prisma.crmContactConsent.findFirst({
        where: { contactId: leadB.contact.id, channel: 'EMAIL' },
        select: { status: true, revokedAt: true },
      }),
      prisma.crmSequenceEnrollment.findFirst({
        where: { leadId: leadB.lead.id },
        select: { status: true, nextRunAt: true },
      }),
    ])
    check('El contacto queda DO_NOT_CONTACT', contactAfter?.status === 'DO_NOT_CONTACT', contactAfter?.status)
    check('El consentimiento se revoca', consentAfter?.status === 'REVOKED' && Boolean(consentAfter.revokedAt))
    check('Las secuencias se detienen por opt-out', enrollmentAfter?.status === 'STOPPED_OPT_OUT', enrollmentAfter?.status)

    const stoppedAgain = await stopEnrollmentsForLead({
      client: prisma,
      empresaId: empresa.id,
      leadId: leadB.lead.id,
      status: 'STOPPED_OPT_OUT',
      reason: 'segunda pasada',
    })
    check('Detener de nuevo no afecta enrolamientos ya detenidos', stoppedAgain === 0, stoppedAgain)


    const timeline = await loadLeadTimeline({
      client: prisma,
      empresaId: empresa.id,
      leadId: firstCapture.lead.id,
      contactId: firstCapture.contact.id,
      limit: 50,
    })
    const kinds = new Set(timeline.map((entry) => entry.kind))
    check(
      'El historial incluye captura, score y actividad',
      kinds.has('capture') && kinds.has('score') && kinds.has('activity'),
      [...kinds]
    )
    check(
      'El historial está ordenado de más reciente a más antiguo',
      timeline.every(
        (entry, index) =>
          index === 0 || new Date(timeline[index - 1].occurredAt) >= new Date(entry.occurredAt)
      )
    )

    const defaultScope = await resolveCrmRecordScope({
      empresaId: empresa.id,
      userId: owner.id,
      sedeId: sede.id,
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'READ',
    })
    check('Sin grants el alcance cae a SEDE (compatibilidad)', defaultScope.level === 'SEDE', defaultScope.level)

    await prisma.userCapabilityGrant.create({
      data: {
        userId: owner.id,
        empresaId: empresa.id,
        domain: 'CAPTACION',
        subdomain: 'LEADS',
        action: 'READ',
        scopeType: 'EMPRESA',
        allowed: true,
      },
    })

    const companyScope = await resolveCrmRecordScope({
      empresaId: empresa.id,
      userId: owner.id,
      sedeId: sede.id,
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'READ',
    })
    check('Con grant EMPRESA el alcance es de toda la empresa', companyScope.level === 'EMPRESA', companyScope.level)

    const notifications = await prisma.notification.count({ where: { empresaId: empresa.id } })
    check('La asignación notifica al responsable', notifications >= 1, notifications)
  } finally {
    // La empresa arrastra CRM (leads, capturas, secuencias) por cascada.
    await prisma.empresa.delete({ where: { id: empresa.id } }).catch(() => null)
    if (ownerId) {
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => null)
    }
  }

  console.log(failures === 0 ? '\nTodo OK' : `\n${failures} verificación(es) fallaron`)
  if (failures > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

