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

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function getOpportunity(id: string, empresaId: string) {
  return prisma.crmOpportunity.findUnique({
    where: { id },
    include: {
      sede: { select: { id: true, nombre: true, codigo: true } },
      lead: { select: { id: true, nombre: true, status: true } },
      cliente: { select: { id: true, nombre: true, documento: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      cotizacion: { select: { id: true, numero: true, estado: true, total: true } },
      _count: { select: { activities: true, tasks: true } },
    },
  }).then((row) => (row && row.empresaId === empresaId ? row : null))
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params
    const row = await getOpportunity(id, access.empresaId)
    if (!row) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    if (row.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: row.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error obteniendo oportunidad CRM:', error)
    return NextResponse.json({ error: 'Error obteniendo oportunidad CRM' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await getOpportunity(id, access.empresaId)
    if (!current) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const stage = Object.prototype.hasOwnProperty.call(body ?? {}, 'stage') ? parseOpportunityStage(body?.stage) : undefined
    const explicitSedeId = normalizeString(body?.sedeId)
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const cotizacionId = normalizeString(body?.cotizacionId)
    const expectedValue = parseOptionalFloat(body?.expectedValue)
    const probabilityPct = parseOptionalInt(body?.probabilityPct)
    const expectedCloseAt = parseOptionalDate(body?.expectedCloseAt)
    const lostReason = normalizeString(body?.lostReason)

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'stage') && !stage) {
      return NextResponse.json({ error: 'stage inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'expectedValue') && expectedValue === undefined) {
      return NextResponse.json({ error: 'expectedValue inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'probabilityPct') && (probabilityPct === undefined || (probabilityPct !== null && (probabilityPct < 0 || probabilityPct > 100)))) {
      return NextResponse.json({ error: 'probabilityPct inválido (0..100)' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'expectedCloseAt') && expectedCloseAt === undefined) {
      return NextResponse.json({ error: 'expectedCloseAt inválido' }, { status: 400 })
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId') && assignedToUserId) {
      const user = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true, empresaId: true } })
      if (!user || user.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'assignedToUserId inválido' }, { status: 400 })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'cotizacionId') && cotizacionId) {
      const cotizacion = await prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        select: { id: true, cliente: { select: { empresaId: true } } },
      })
      if (!cotizacion || cotizacion.cliente.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'cotizacionId inválido' }, { status: 400 })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') && explicitSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: explicitSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const nextStage = stage ?? current.stage
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmOpportunity.update({
        where: { id: current.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'title') ? { title: title || current.title } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'description') ? { description: description || null } : {}),
          ...(stage ? { stage } : {}),
          ...(expectedValue !== undefined ? { expectedValue: expectedValue ?? 0 } : {}),
          ...(probabilityPct !== undefined ? { probabilityPct: probabilityPct ?? 0 } : {}),
          ...(expectedCloseAt !== undefined ? { expectedCloseAt: expectedCloseAt ?? null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId') ? { assignedToUserId: assignedToUserId || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'cotizacionId') ? { cotizacionId: cotizacionId || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') ? { sedeId: explicitSedeId || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'lostReason') ? { lostReason: lostReason || null } : {}),
          ...(stage === 'WON' ? { wonAt: current.wonAt ?? new Date(), lostAt: null } : {}),
          ...(stage === 'LOST' ? { lostAt: current.lostAt ?? new Date(), wonAt: null } : {}),
          ...(stage && stage !== 'WON' && stage !== 'LOST' ? { wonAt: null, lostAt: null } : {}),
        },
        include: {
          sede: { select: { id: true, nombre: true, codigo: true } },
          lead: { select: { id: true, nombre: true, status: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          cotizacion: { select: { id: true, numero: true, estado: true, total: true } },
          _count: { select: { activities: true, tasks: true } },
        },
      })

      if (nextStage !== current.stage) {
        await tx.crmActivity.create({
          data: {
            empresaId: access.empresaId,
            sedeId: updated.sedeId,
            type: 'STAGE_CHANGE',
            summary: `Cambio de etapa: ${current.stage} → ${nextStage}`,
            opportunityId: updated.id,
            leadId: updated.leadId,
            clienteId: updated.clienteId,
            occurredAt: new Date(),
            createdById: access.userId,
          },
        })
      }

      return updated
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error actualizando oportunidad CRM:', error)
    return NextResponse.json({ error: 'Error actualizando oportunidad CRM' }, { status: 500 })
  }
}