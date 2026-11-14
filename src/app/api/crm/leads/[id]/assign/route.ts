import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { assignCrmLead } from '@/lib/crm-assignment'
import { requireCrmLeadAccess } from '@/lib/crm-lead-access'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const guard = await requireCrmLeadAccess({ leadId: id, action: 'ASSIGN' })
    if (!guard.ok) return guard.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const ownerUserId = normalizeString(body?.ownerUserId ?? body?.assigneeUserId)
    const reason = normalizeString(body?.reason)

    if (!ownerUserId) {
      return NextResponse.json({ error: 'ownerUserId es requerido' }, { status: 400 })
    }

    const owner = await prisma.user.findFirst({
      where: { id: ownerUserId, empresaId: guard.access.empresaId },
      select: { id: true, name: true, email: true },
    })
    if (!owner) {
      return NextResponse.json({ error: 'El responsable no pertenece a la empresa' }, { status: 400 })
    }

    const lead = await assignCrmLead({
      client: prisma,
      empresaId: guard.access.empresaId,
      leadId: guard.lead.id,
      assigneeUserId: owner.id,
      actorUserId: guard.access.userId,
      reason: reason || 'Asignación manual',
    })

    return NextResponse.json({
      success: true,
      data: { lead, assignee: owner },
    })
  } catch (error) {
    console.error('Error al asignar lead CRM:', error)
    return NextResponse.json({ error: 'Error al asignar lead CRM' }, { status: 500 })
  }
}
