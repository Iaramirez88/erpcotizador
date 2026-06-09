import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess } from '@/lib/crm'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'UPDATE',
      scope: 'SEDE',
    })
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

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmConversation.update({
        where: { id: current.id },
        data: {
          status: 'RESOLVED',
          unreadCount: 0,
          resolvedAt: new Date(),
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: updated.sedeId,
          type: 'OTHER',
          summary: 'Conversación resuelta',
          leadId: updated.leadId,
          opportunityId: updated.opportunityId,
          clienteId: updated.clienteId,
          occurredAt: new Date(),
          createdById: access.userId,
        },
      })

      return updated
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error resolviendo conversación CRM:', error)
    return NextResponse.json({ error: 'Error resolviendo conversación CRM' }, { status: 500 })
  }
}