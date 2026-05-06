import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  assertCrmSedeAccess,
  normalizeString,
  parseOptionalDate,
  parseOptionalFloat,
  parseOptionalInt,
  parseOpportunityStage,
} from '@/lib/crm'
import { syncCrmOpportunityFollowUpTaskById } from '@/lib/crm-follow-up'
import { getBridgeKindFromSettings, getCrmOriginMeta } from '@/lib/crm-origin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const assignedToUserId = normalizeString(searchParams.get('assignedToUserId'))
    const leadId = normalizeString(searchParams.get('leadId'))
    const clienteId = normalizeString(searchParams.get('clienteId'))
    const stage = parseOpportunityStage(searchParams.get('stage'))

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const rows = await prisma.crmOpportunity.findMany({
      where: {
        empresaId: access.empresaId,
        ...(sedeId ? { sedeId } : {}),
        ...(assignedToUserId ? { assignedToUserId } : {}),
        ...(leadId ? { leadId } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(stage ? { stage } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { lead: { nombre: { contains: search, mode: 'insensitive' } } },
                { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        lead: {
          select: {
            id: true,
            nombre: true,
            status: true,
            source: true,
            conversations: {
              orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: {
                channelConnection: {
                  select: { provider: true, settingsJson: true },
                },
              },
            },
          },
        },
        cliente: { select: { id: true, nombre: true, documento: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        cotizacion: { select: { id: true, numero: true, estado: true, total: true } },
        _count: { select: { activities: true, tasks: true } },
      },
    })

    const data = rows.map((row) => {
      const latestConversation = row.lead?.conversations[0]
      const origin = getCrmOriginMeta({
        provider: latestConversation?.channelConnection.provider,
        bridgeKind: getBridgeKindFromSettings(latestConversation?.channelConnection.settingsJson),
        source: row.lead?.source,
      })

      return {
        ...row,
        originKey: origin.key,
        originLabel: origin.label,
        lead: row.lead
          ? {
              id: row.lead.id,
              nombre: row.lead.nombre,
              status: row.lead.status,
              source: row.lead.source,
            }
          : null,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error listando oportunidades CRM:', error)
    return NextResponse.json({ error: 'Error listando oportunidades CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const stage = parseOpportunityStage(body?.stage) ?? 'NEW'
    const leadId = normalizeString(body?.leadId)
    const clienteId = normalizeString(body?.clienteId)
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const cotizacionId = normalizeString(body?.cotizacionId)
    const explicitSedeId = normalizeString(body?.sedeId)
    const expectedValue = parseOptionalFloat(body?.expectedValue)
    const probabilityPct = parseOptionalInt(body?.probabilityPct)
    const expectedCloseAt = parseOptionalDate(body?.expectedCloseAt)

    if (!title) return NextResponse.json({ error: 'title es requerido' }, { status: 400 })
    if (!leadId && !clienteId) {
      return NextResponse.json({ error: 'leadId o clienteId es requerido' }, { status: 400 })
    }
    if (expectedValue === undefined) return NextResponse.json({ error: 'expectedValue inválido' }, { status: 400 })
    if (probabilityPct === undefined || (probabilityPct !== null && (probabilityPct < 0 || probabilityPct > 100))) {
      return NextResponse.json({ error: 'probabilityPct inválido (0..100)' }, { status: 400 })
    }
    if (expectedCloseAt === undefined) return NextResponse.json({ error: 'expectedCloseAt inválido' }, { status: 400 })

    const lead = leadId
      ? await prisma.crmLead.findUnique({ where: { id: leadId }, select: { id: true, empresaId: true, sedeId: true, nombre: true } })
      : null
    if (leadId && (!lead || lead.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'leadId inválido' }, { status: 400 })
    }

    const cliente = clienteId
      ? await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, empresaId: true, sedeId: true, nombre: true } })
      : null
    if (clienteId && (!cliente || cliente.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'clienteId inválido' }, { status: 400 })
    }

    if (assignedToUserId) {
      const user = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true, empresaId: true } })
      if (!user || user.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'assignedToUserId inválido' }, { status: 400 })
      }
    }

    if (cotizacionId) {
      const cotizacion = await prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        select: { id: true, cliente: { select: { empresaId: true } } },
      })
      if (!cotizacion || cotizacion.cliente.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'cotizacionId inválido' }, { status: 400 })
      }
    }

    const finalSedeId = explicitSedeId || lead?.sedeId || cliente?.sedeId || ''
    if (finalSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: finalSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.crmOpportunity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: finalSedeId || null,
          title,
          description: description || null,
          stage,
          leadId: leadId || null,
          clienteId: clienteId || null,
          expectedValue: expectedValue ?? 0,
          probabilityPct: probabilityPct ?? 0,
          expectedCloseAt: expectedCloseAt ?? null,
          assignedToUserId: assignedToUserId || null,
          createdById: access.userId,
          cotizacionId: cotizacionId || null,
        },
        include: {
          sede: { select: { id: true, nombre: true, codigo: true } },
          lead: { select: { id: true, nombre: true, status: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          cotizacion: { select: { id: true, numero: true, estado: true, total: true } },
        },
      })

      await syncCrmOpportunityFollowUpTaskById({
        client: tx,
        empresaId: access.empresaId,
        actorUserId: access.userId,
        opportunityId: created.id,
      })

      return created
    })

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error creando oportunidad CRM:', error)
    return NextResponse.json({ error: 'Error creando oportunidad CRM' }, { status: 500 })
  }
}