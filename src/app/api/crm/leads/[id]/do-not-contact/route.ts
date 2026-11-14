import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { applyLeadLifecycleTransition } from '@/lib/crm-lifecycle'
import { requireCrmLeadAccess } from '@/lib/crm-lead-access'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Marca el lead como `DO_NOT_CONTACT`: revoca consentimientos, bloquea
 * secuencias y deja auditoría. Es terminal para comunicaciones salientes.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const guard = await requireCrmLeadAccess({ leadId: id, action: 'UPDATE' })
    if (!guard.ok) return guard.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const reason = normalizeString(body?.reason) || 'Solicitud de no contacto'

    const lead =
      guard.lead.lifecycleStatus === 'DO_NOT_CONTACT'
        ? guard.lead
        : await applyLeadLifecycleTransition({
            client: prisma,
            empresaId: guard.access.empresaId,
            leadId: guard.lead.id,
            nextStatus: 'DO_NOT_CONTACT',
            actorUserId: guard.access.userId,
            reason,
          })

    return NextResponse.json({ success: true, data: { lead } })
  } catch (error) {
    console.error('Error al marcar no contactar:', error)
    return NextResponse.json({ error: 'Error al marcar no contactar' }, { status: 500 })
  }
}
