import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString, parseConversationStatus } from '@/lib/crm'
import { canAssignCrmConversationToUser } from '@/lib/crm-omnichannel'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'ASSIGN',
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

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const rawStatus = normalizeString(body?.status)
    const parsedStatus = parseConversationStatus(rawStatus)

    if (rawStatus && !parsedStatus) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }

    if (assignedToUserId) {
      const user = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true, empresaId: true } })
      if (!user || user.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'assignedToUserId inválido' }, { status: 400 })
      }

      const canAssign = await canAssignCrmConversationToUser({
        client: prisma,
        empresaId: access.empresaId,
        sedeId: current.sedeId,
        userId: assignedToUserId,
      })
      if (!canAssign) {
        return NextResponse.json({ error: 'El usuario no tiene acceso CRM suficiente para atender esta conversación.' }, { status: 400 })
      }
    }

    const nextStatus = parsedStatus ?? (assignedToUserId ? 'HUMAN_ACTIVE' : current.status === 'RESOLVED' || current.status === 'DISABLED' ? current.status : 'PENDING')
    const resolvedAt = nextStatus === 'RESOLVED' ? new Date() : null

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.crmConversation.update({
        where: { id: current.id },
        data: {
          assignedToUserId: assignedToUserId || null,
          status: nextStatus,
          unreadCount: nextStatus === 'RESOLVED' || nextStatus === 'DISABLED' ? 0 : current.unreadCount,
          resolvedAt,
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      })

      const activitySummaryParts = []
      if ((current.assignedToUserId || null) !== (assignedToUserId || null)) {
        activitySummaryParts.push(assignedToUserId ? 'asignada a asesor' : 'liberada de asesor')
      }
      if (current.status !== nextStatus) {
        activitySummaryParts.push(`estado ${current.status} → ${nextStatus}`)
      }

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: row.sedeId,
          type: 'OTHER',
          summary: activitySummaryParts.length ? `Conversación ${activitySummaryParts.join(' · ')}` : 'Conversación actualizada',
          details: assignedToUserId || nextStatus,
          leadId: row.leadId,
          opportunityId: row.opportunityId,
          clienteId: row.clienteId,
          occurredAt: new Date(),
          createdById: access.userId,
        },
      })

      if (assignedToUserId && assignedToUserId !== access.userId && assignedToUserId !== current.assignedToUserId) {
        const contactLabel = row.contactDisplayName || row.contactPhone || row.contactEmail || 'nuevo prospecto'
        await tx.notification.create({
          data: {
            empresaId: access.empresaId,
            sedeId: row.sedeId,
            userId: assignedToUserId,
            type: 'INFO',
            title: 'Te asignaron una conversación CRM',
            body: `Nueva conversación asignada: ${contactLabel}.`,
            actionUrl: `/dashboard/chat?conversationId=${row.id}`,
            actionLabel: 'Abrir conversación',
          },
        })
      }

      return row
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error asignando conversación CRM:', error)
    return NextResponse.json({ error: 'Error asignando conversación CRM' }, { status: 500 })
  }
}