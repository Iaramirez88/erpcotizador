import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmConversation.findUnique({ where: { id } })
    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const assignedToUserId = normalizeString(body?.assignedToUserId)

    if (assignedToUserId) {
      const user = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true, empresaId: true } })
      if (!user || user.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'assignedToUserId inválido' }, { status: 400 })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.crmConversation.update({
        where: { id: current.id },
        data: {
          assignedToUserId: assignedToUserId || null,
          status: assignedToUserId ? 'HUMAN_ACTIVE' : current.status === 'RESOLVED' ? 'RESOLVED' : 'PENDING',
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: row.sedeId,
          type: 'OTHER',
          summary: assignedToUserId ? 'Conversación asignada a asesor' : 'Conversación liberada de asesor',
          details: assignedToUserId || null,
          leadId: row.leadId,
          opportunityId: row.opportunityId,
          clienteId: row.clienteId,
          occurredAt: new Date(),
          createdById: access.userId,
        },
      })

      return row
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error asignando conversación CRM:', error)
    return NextResponse.json({ error: 'Error asignando conversación CRM' }, { status: 500 })
  }
}