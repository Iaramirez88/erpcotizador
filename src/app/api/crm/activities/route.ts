import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import {
  assertCrmSedeAccess,
  normalizeString,
  parseActivityType,
  parseOptionalDate,
} from '@/lib/crm'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ACTIVITIES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const leadId = normalizeString(searchParams.get('leadId'))
    const opportunityId = normalizeString(searchParams.get('opportunityId'))
    const clienteId = normalizeString(searchParams.get('clienteId'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const type = parseActivityType(searchParams.get('type'))

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const rows = await prisma.crmActivity.findMany({
      where: {
        empresaId: access.empresaId,
        ...(leadId ? { leadId } : {}),
        ...(opportunityId ? { opportunityId } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(sedeId ? { sedeId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, nombre: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        cliente: { select: { id: true, nombre: true, documento: true } },
      },
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('Error listando actividades CRM:', error)
    return NextResponse.json({ error: 'Error listando actividades CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ACTIVITIES',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const type = parseActivityType(body?.type) ?? 'NOTE'
    const summary = normalizeString(body?.summary)
    const details = normalizeString(body?.details)
    const leadId = normalizeString(body?.leadId)
    const opportunityId = normalizeString(body?.opportunityId)
    const clienteId = normalizeString(body?.clienteId)
    const explicitSedeId = normalizeString(body?.sedeId)
    const occurredAt = parseOptionalDate(body?.occurredAt)

    if (!summary) return NextResponse.json({ error: 'summary es requerido' }, { status: 400 })
    if (!leadId && !opportunityId && !clienteId) {
      return NextResponse.json({ error: 'leadId, opportunityId o clienteId es requerido' }, { status: 400 })
    }
    if (occurredAt === undefined) return NextResponse.json({ error: 'occurredAt inválido' }, { status: 400 })

    const lead = leadId
      ? await prisma.crmLead.findUnique({ where: { id: leadId }, select: { id: true, empresaId: true, sedeId: true } })
      : null
    if (leadId && (!lead || lead.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'leadId inválido' }, { status: 400 })
    }

    const opportunity = opportunityId
      ? await prisma.crmOpportunity.findUnique({ where: { id: opportunityId }, select: { id: true, empresaId: true, sedeId: true, leadId: true, clienteId: true } })
      : null
    if (opportunityId && (!opportunity || opportunity.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'opportunityId inválido' }, { status: 400 })
    }

    const cliente = clienteId
      ? await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, empresaId: true, sedeId: true } })
      : null
    if (clienteId && (!cliente || cliente.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'clienteId inválido' }, { status: 400 })
    }

    const finalSedeId = explicitSedeId || lead?.sedeId || opportunity?.sedeId || cliente?.sedeId || ''
    if (finalSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: finalSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const finalLeadId = leadId || opportunity?.leadId || null
    const finalClienteId = clienteId || opportunity?.clienteId || null

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: finalSedeId || null,
          type,
          summary,
          details: details || null,
          leadId: finalLeadId,
          opportunityId: opportunityId || null,
          clienteId: finalClienteId,
          occurredAt: occurredAt ?? new Date(),
          createdById: access.userId,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, nombre: true } },
          opportunity: { select: { id: true, title: true, stage: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
        },
      })

      if (finalLeadId) {
        await tx.crmLead.update({ where: { id: finalLeadId }, data: { lastActivityAt: created.occurredAt } })
      }

      return created
    })

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error creando actividad CRM:', error)
    return NextResponse.json({ error: 'Error creando actividad CRM' }, { status: 500 })
  }
}