import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { recalculateLeadScore } from '@/lib/crm-scoring'

export const runtime = 'nodejs'

/**
 * Recalcula la puntuación desde los eventos aplicados (fuente de verdad).
 * `leadId` recalcula uno; sin `leadId` procesa un lote de la empresa.
 */
export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SCORING',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const leadId = normalizeString(body?.leadId)
    const limitRaw = Number(body?.limit)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 100

    if (leadId) {
      const lead = await prisma.crmLead.findUnique({ where: { id: leadId }, select: { empresaId: true } })
      if (!lead || lead.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
      }

      const result = await recalculateLeadScore({
        client: prisma,
        empresaId: access.empresaId,
        leadId,
        actorUserId: access.userId,
      })

      return NextResponse.json({
        success: true,
        data: { processed: 1, results: [{ leadId, score: result.score, scoreBand: result.scoreBand, delta: result.delta }] },
      })
    }

    const leads = await prisma.crmLead.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: { id: true },
    })

    const results: Array<{ leadId: string; score: number; scoreBand: string; delta: number }> = []
    for (const lead of leads) {
      const result = await recalculateLeadScore({
        client: prisma,
        empresaId: access.empresaId,
        leadId: lead.id,
        actorUserId: access.userId,
      })
      results.push({ leadId: lead.id, score: result.score, scoreBand: result.scoreBand, delta: result.delta })
    }

    return NextResponse.json({ success: true, data: { processed: results.length, results } })
  } catch (error) {
    console.error('Error recalculando scoring:', error)
    return NextResponse.json({ error: 'Error recalculando scoring' }, { status: 500 })
  }
}
