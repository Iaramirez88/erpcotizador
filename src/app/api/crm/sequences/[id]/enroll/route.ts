import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + Math.max(0, Math.trunc(days)) * 24 * 60 * 60 * 1000)
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SEQUENCES',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const leadId = normalizeString(body?.leadId)
    const contactIdInput = normalizeString(body?.contactId)

    if (!leadId && !contactIdInput) {
      return NextResponse.json({ error: 'leadId o contactId es requerido' }, { status: 400 })
    }

    const sequence = await prisma.crmSequence.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    })
    if (!sequence || sequence.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Secuencia no encontrada' }, { status: 404 })
    }
    if (sequence.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'La secuencia no está activa' }, { status: 409 })
    }
    if (!sequence.steps.length) {
      return NextResponse.json({ error: 'La secuencia no tiene pasos' }, { status: 409 })
    }

    let lead: { id: string; contactId: string | null; sedeId: string | null } | null = null
    if (leadId) {
      lead = await prisma.crmLead.findFirst({
        where: { id: leadId, empresaId: access.empresaId },
        select: { id: true, contactId: true, sedeId: true },
      })
      if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    }

    const contactId = lead?.contactId || contactIdInput
    if (!contactId) {
      return NextResponse.json({ error: 'El lead no tiene contacto asociado' }, { status: 409 })
    }

    const contact = await prisma.crmContact.findFirst({
      where: { id: contactId, empresaId: access.empresaId },
      select: { id: true, status: true },
    })
    if (!contact) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    if (contact.status === 'DO_NOT_CONTACT') {
      return NextResponse.json({ error: 'El contacto está marcado como no contactar' }, { status: 409 })
    }

    const existing = await prisma.crmSequenceEnrollment.findUnique({
      where: { sequenceId_contactId: { sequenceId: sequence.id, contactId: contact.id } },
      select: { id: true, status: true },
    })
    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        alreadyEnrolled: true,
      })
    }

    const now = new Date()
    const enrollment = await prisma.crmSequenceEnrollment.create({
      data: {
        empresaId: access.empresaId,
        sequenceId: sequence.id,
        contactId: contact.id,
        leadId: lead?.id ?? null,
        status: 'ACTIVE',
        currentStepOrder: sequence.steps[0].order - 1,
        nextRunAt: addDays(now, sequence.steps[0].delayDays),
      },
    })

    if (lead) {
      await prisma.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: lead.sedeId,
          type: 'OTHER',
          summary: `Enrolado manualmente en «${sequence.name}»`,
          details: `Próximo paso: ${addDays(now, sequence.steps[0].delayDays).toISOString()}`,
          leadId: lead.id,
          contactId: contact.id,
          eventKey: `enroll:${sequence.id}:${contact.id}`,
          createdById: access.userId,
        },
      })
    }

    return NextResponse.json({ success: true, data: enrollment, alreadyEnrolled: false }, { status: 201 })
  } catch (error) {
    console.error('Error enrolando lead en secuencia:', error)
    return NextResponse.json({ error: 'Error enrolando lead en secuencia' }, { status: 500 })
  }
}
