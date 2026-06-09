import { NextResponse } from 'next/server'
import { AccessLevel, CotizacionAuditAction, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

const CRM_ERP_TIMELINE_ACTIONS: CotizacionAuditAction[] = ['SENT', 'APPROVED', 'SALE_REALIZED_SET', 'SALE_REALIZED_UNSET']

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return String(amount)
  }
}

function buildCotizacionTimelineCopy(args: {
  action: CotizacionAuditAction
  numero: string
  title?: string | null
  note?: string | null
  total?: number | null
  after?: unknown
}) {
  const after = asRecord(args.after)
  const channel = typeof after.channel === 'string' ? after.channel : ''
  const parts: string[] = []

  if (args.title) parts.push(`Oportunidad: ${args.title}`)
  if (typeof args.total === 'number') parts.push(`Total: ${formatMoney(args.total)}`)

  if (args.action === 'SENT' && channel) {
    parts.push(`Canal: ${channel === 'email' ? 'email' : channel}`)
  }

  if (args.note) parts.push(args.note)

  switch (args.action) {
    case 'SENT':
      return {
        summary: `Cotización enviada: ${args.numero}`,
        details: parts.join(' · '),
      }
    case 'APPROVED':
      return {
        summary: `Cotización aprobada: ${args.numero}`,
        details: parts.join(' · '),
      }
    case 'SALE_REALIZED_SET':
      return {
        summary: `Venta realizada: ${args.numero}`,
        details: parts.join(' · '),
      }
    case 'SALE_REALIZED_UNSET':
      return {
        summary: `Venta realizada revertida: ${args.numero}`,
        details: parts.join(' · '),
      }
    default:
      return {
        summary: `Evento ERP en cotización: ${args.numero}`,
        details: parts.join(' · '),
      }
  }
}

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

    if (!leadId && !opportunityId && !clienteId) {
      return NextResponse.json({ error: 'leadId, opportunityId o clienteId es requerido' }, { status: 400 })
    }

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const opportunityScope = await prisma.crmOpportunity.findMany({
      where: {
        empresaId: access.empresaId,
        ...(leadId ? { leadId } : {}),
        ...(opportunityId ? { id: opportunityId } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(sedeId ? { sedeId } : {}),
        cotizacionId: { not: null },
      },
      select: {
        id: true,
        title: true,
        cotizacionId: true,
        cotizacion: { select: { id: true, numero: true, estado: true, total: true } },
      },
    })

    const cotizacionIds = opportunityScope.map((row) => row.cotizacionId).filter((value): value is string => Boolean(value))
    const opportunityByCotizacionId = new Map(
      opportunityScope
        .filter((row) => row.cotizacionId && row.cotizacion)
        .map((row) => [row.cotizacionId as string, row])
    )

    const [activities, tasks, cotizacionEvents] = await Promise.all([
      prisma.crmActivity.findMany({
        where: {
          empresaId: access.empresaId,
          ...(leadId ? { leadId } : {}),
          ...(opportunityId ? { opportunityId } : {}),
          ...(clienteId ? { clienteId } : {}),
          ...(sedeId ? { sedeId } : {}),
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.crmTask.findMany({
        where: {
          empresaId: access.empresaId,
          ...(leadId ? { leadId } : {}),
          ...(opportunityId ? { opportunityId } : {}),
          ...(clienteId ? { clienteId } : {}),
          ...(sedeId ? { sedeId } : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      cotizacionIds.length
        ? prisma.cotizacionAuditEvent.findMany({
            where: {
              cotizacionId: { in: cotizacionIds },
              action: { in: CRM_ERP_TIMELINE_ACTIONS },
            },
            orderBy: { createdAt: 'desc' },
            include: {
              performedBy: { select: { id: true, name: true, email: true } },
              requestedBy: { select: { id: true, name: true, email: true } },
            },
          })
        : Promise.resolve([]),
    ])

    const items = [
      ...activities.map((row) => ({
        id: row.id,
        itemType: 'activity' as const,
        eventAt: row.occurredAt,
        data: row,
      })),
      ...tasks.map((row) => ({
        id: row.id,
        itemType: 'task' as const,
        eventAt: row.completedAt ?? row.dueAt ?? row.updatedAt,
        data: row,
      })),
      ...cotizacionEvents.flatMap((row) => {
        const opportunity = opportunityByCotizacionId.get(row.cotizacionId)
        const cotizacion = opportunity?.cotizacion
        if (!cotizacion) return []

        const copy = buildCotizacionTimelineCopy({
          action: row.action,
          numero: cotizacion.numero,
          title: opportunity?.title,
          note: row.note,
          total: cotizacion.total,
          after: row.after,
        })

        return [{
          id: row.id,
          itemType: 'erp' as const,
          eventAt: row.createdAt,
          data: {
            action: row.action,
            summary: copy.summary,
            details: copy.details,
            cotizacion,
            opportunity: opportunity ? { id: opportunity.id, title: opportunity.title } : null,
            performedBy: row.performedBy,
            requestedBy: row.requestedBy,
            note: row.note,
          },
        }]
      }),
    ].sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error('Error obteniendo timeline CRM:', error)
    return NextResponse.json({ error: 'Error obteniendo timeline CRM' }, { status: 500 })
  }
}