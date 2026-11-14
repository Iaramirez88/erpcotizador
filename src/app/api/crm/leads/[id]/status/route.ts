import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import {
  CRM_LIFECYCLE_LABELS,
  CrmLifecycleError,
  applyLeadLifecycleTransition,
  parseCrmLifecycleStatus,
} from '@/lib/crm-lifecycle'
import { requireCrmLeadAccess } from '@/lib/crm-lead-access'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const guard = await requireCrmLeadAccess({ leadId: id, action: 'UPDATE' })
    if (!guard.ok) return guard.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nextStatus = parseCrmLifecycleStatus(body?.lifecycleStatus ?? body?.status)
    const reason = normalizeString(body?.reason ?? body?.discardReason)

    if (!nextStatus) {
      return NextResponse.json({ error: 'lifecycleStatus inválido' }, { status: 400 })
    }

    if (nextStatus === 'NURTURING') {
      const activeSequences = await prisma.crmSequenceEnrollment.count({
        where: { empresaId: guard.access.empresaId, leadId: guard.lead.id, status: 'ACTIVE' },
      })
      if (!activeSequences) {
        const availableSequences = await prisma.crmSequence.count({
          where: { empresaId: guard.access.empresaId, status: 'ACTIVE' },
        })
        if (!availableSequences) {
          return NextResponse.json(
            {
              error:
                'No hay secuencias activas. Crea o activa una secuencia antes de mover el lead a nutrición.',
              code: 'no-sequence',
            },
            { status: 409 }
          )
        }
      }
    }

    const lead = await applyLeadLifecycleTransition({
      client: prisma,
      empresaId: guard.access.empresaId,
      leadId: guard.lead.id,
      nextStatus,
      actorUserId: guard.access.userId,
      reason,
    })

    return NextResponse.json({
      success: true,
      data: { lead, label: CRM_LIFECYCLE_LABELS[nextStatus] },
    })
  } catch (error) {
    if (error instanceof CrmLifecycleError) {
      const status =
        error.code === 'lead-not-found'
          ? 404
          : error.code === 'invalid-transition' || error.code === 'reason-required' || error.code === 'conversion-required'
            ? 409
            : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Error al cambiar estado del lead CRM:', error)
    return NextResponse.json({ error: 'Error al cambiar estado del lead CRM' }, { status: 500 })
  }
}
