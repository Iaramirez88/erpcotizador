import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import {
  assertCrmSedeAccess,
  normalizeString,
  parseOptionalDate,
  parseOptionalFloat,
  parseOptionalInt,
  parseOpportunityStage,
} from '@/lib/crm'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'OPPORTUNITIES',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const conversation = await prisma.crmConversation.findUnique({ where: { id } })
    if (!conversation || conversation.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    if (conversation.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: conversation.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    if (conversation.opportunityId) {
      return NextResponse.json({ error: 'La conversación ya tiene oportunidad vinculada' }, { status: 409 })
    }

    if (!conversation.leadId && !conversation.clienteId) {
      return NextResponse.json({ error: 'La conversación no tiene lead o cliente para crear oportunidad' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title) || `Oportunidad desde conversación ${conversation.contactDisplayName || conversation.contactPhone || conversation.contactEmail || conversation.id}`
    const description = normalizeString(body?.description)
    const stage = parseOpportunityStage(body?.stage) ?? 'NEW'
    const expectedValue = parseOptionalFloat(body?.expectedValue)
    const probabilityPct = parseOptionalInt(body?.probabilityPct)
    const expectedCloseAt = parseOptionalDate(body?.expectedCloseAt)

    if (expectedValue === undefined) return NextResponse.json({ error: 'expectedValue inválido' }, { status: 400 })
    if (probabilityPct === undefined || (probabilityPct !== null && (probabilityPct < 0 || probabilityPct > 100))) {
      return NextResponse.json({ error: 'probabilityPct inválido (0..100)' }, { status: 400 })
    }
    if (expectedCloseAt === undefined) return NextResponse.json({ error: 'expectedCloseAt inválido' }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const opportunity = await tx.crmOpportunity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: conversation.sedeId,
          title,
          description: description || null,
          stage,
          leadId: conversation.leadId,
          clienteId: conversation.clienteId,
          expectedValue: expectedValue ?? 0,
          probabilityPct: probabilityPct ?? 0,
          expectedCloseAt: expectedCloseAt ?? null,
          assignedToUserId: conversation.assignedToUserId || access.userId,
          createdById: access.userId,
        },
        include: {
          lead: { select: { id: true, nombre: true, status: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      })

      await tx.crmConversation.update({
        where: { id: conversation.id },
        data: {
          opportunityId: opportunity.id,
          status: conversation.status === 'RESOLVED' ? 'HUMAN_ACTIVE' : conversation.status,
          resolvedAt: conversation.status === 'RESOLVED' ? null : conversation.resolvedAt,
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: conversation.sedeId,
          type: 'OTHER',
          summary: 'Oportunidad creada desde conversación',
          details: title,
          leadId: conversation.leadId,
          opportunityId: opportunity.id,
          clienteId: conversation.clienteId,
          occurredAt: new Date(),
          createdById: access.userId,
        },
      })

      return opportunity
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Error creando oportunidad desde conversación CRM:', error)
    return NextResponse.json({ error: 'Error creando oportunidad desde conversación CRM' }, { status: 500 })
  }
}