import { NextResponse } from 'next/server'
import type { CrmOpportunityStage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { ensureContactIdentity } from '@/lib/crm-contact-identity'
import { applyScoreEvent } from '@/lib/crm-scoring'
import { requireCrmLeadAccess } from '@/lib/crm-lead-access'

export const runtime = 'nodejs'

const CRM_STAGES: CrmOpportunityStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']

interface RouteContext {
  params: Promise<{ id: string }>
}

function parseStage(value: unknown): CrmOpportunityStage | null {
  const raw = normalizeString(value).toUpperCase() as CrmOpportunityStage
  return CRM_STAGES.includes(raw) ? raw : null
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const guard = await requireCrmLeadAccess({ leadId: id, action: 'UPDATE' })
    if (!guard.ok) return guard.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const pipelineId = normalizeString(body?.pipelineId)
    const stage = parseStage(body?.stage) ?? 'NEW'
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const expectedValueRaw = Number(body?.expectedValue ?? 0)
    const expectedValue = Number.isFinite(expectedValueRaw) ? Math.max(0, expectedValueRaw) : 0
    const probabilityRaw = Number(body?.probabilityPct ?? 0)
    const probabilityPct = Number.isFinite(probabilityRaw)
      ? Math.min(100, Math.max(0, Math.trunc(probabilityRaw)))
      : 0
    const expectedCloseAtRaw = normalizeString(body?.expectedCloseAt)
    const expectedCloseAt = expectedCloseAtRaw ? new Date(expectedCloseAtRaw) : null

    if (pipelineId) {
      const pipeline = await prisma.crmPipeline.findFirst({
        where: { id: pipelineId, empresaId: guard.access.empresaId },
        select: { id: true },
      })
      if (!pipeline) {
        return NextResponse.json({ error: 'pipelineId inválido' }, { status: 400 })
      }
    }

    if (guard.lead.lifecycleStatus === 'CONVERTED') {
      const existing = await prisma.crmOpportunity.findFirst({
        where: { empresaId: guard.access.empresaId, leadId: guard.lead.id },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({
        success: true,
        data: { lead: guard.lead, opportunity: existing, alreadyConverted: true },
      })
    }


    const result = await prisma.$transaction(async (tx) => {
      let contactId = guard.lead.contactId
      if (!contactId) {
        const contactResult = await ensureContactIdentity({
          client: tx,
          empresaId: guard.access.empresaId,
          sedeId: guard.lead.sedeId,
          createdById: guard.access.userId,
          ownerUserId: guard.lead.ownerUserId,
          identity: {
            nombre: guard.lead.nombre,
            empresaNombre: guard.lead.empresaNombre,
            documento: guard.lead.documento,
            email: guard.lead.email,
            phone: guard.lead.celular || guard.lead.telefono,
            ciudad: guard.lead.ciudad,
            tags: guard.lead.tags,
          },
          sourceKey: 'LEAD',
          sourceLabel: 'Lead convertido',
          lastInteractionAt: new Date(),
        })
        contactId = contactResult.contact.id
      }

      const opportunity = await tx.crmOpportunity.create({
        data: {
          empresaId: guard.access.empresaId,
          sedeId: guard.lead.sedeId,
          title: title || `Oportunidad · ${guard.lead.empresaNombre || guard.lead.nombre}`,
          description: description || guard.lead.notes,
          stage,
          pipelineId: pipelineId || null,
          leadId: guard.lead.id,
          contactId,
          expectedValue,
          probabilityPct,
          expectedCloseAt:
            expectedCloseAt && !Number.isNaN(expectedCloseAt.getTime()) ? expectedCloseAt : null,
          assignedToUserId: guard.lead.ownerUserId,
          createdById: guard.access.userId,
        },
      })

      const updatedLead = await tx.crmLead.update({
        where: { id: guard.lead.id },
        data: {
          lifecycleStatus: 'CONVERTED',
          status: 'CONVERTED',
          convertedAt: new Date(),
          contactId,
        },
      })

      await tx.crmSequenceEnrollment.updateMany({
        where: { empresaId: guard.access.empresaId, leadId: guard.lead.id, status: { in: ['ACTIVE', 'PAUSED'] } },
        data: {
          status: 'STOPPED_CONVERTED',
          stoppedReason: 'Lead convertido en oportunidad',
          nextRunAt: null,
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: guard.access.empresaId,
          sedeId: guard.lead.sedeId,
          type: 'STAGE_CHANGE',
          summary: 'Lead convertido en oportunidad',
          details: opportunity.title,
          leadId: guard.lead.id,
          contactId,
          opportunityId: opportunity.id,
          occurredAt: new Date(),
          eventKey: `convert:${guard.lead.id}:${Date.now()}`,
          metadataJson: { stage, pipelineId: pipelineId || null, expectedValue },
          createdById: guard.access.userId,
        },
      })

      return { opportunity, updatedLead }
    })

    await applyScoreEvent({
      client: prisma,
      empresaId: guard.access.empresaId,
      leadId: guard.lead.id,
      eventType: 'QUOTE_REQUEST',
      contactId: result.updatedLead.contactId,
      sourceId: result.opportunity.id,
      createdById: guard.access.userId,
      metadata: { origin: 'convert-opportunity', opportunityId: result.opportunity.id },
    })

    return NextResponse.json({
      success: true,
      data: { lead: result.updatedLead, opportunity: result.opportunity, alreadyConverted: false },
    })
  } catch (error) {
    console.error('Error al convertir lead en oportunidad:', error)
    return NextResponse.json({ error: 'Error al convertir lead en oportunidad' }, { status: 500 })
  }
}
