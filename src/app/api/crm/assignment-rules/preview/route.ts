import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import {
  matchesCrmAssignmentRule,
  parseCrmAssignmentMatchJson,
  resolveCrmAssigneeByRules,
} from '@/lib/crm-assignment'

export const runtime = 'nodejs'

/**
 * Simulación: indica qué regla asignaría el lead con el contexto dado.
 * No escribe nada (dry-run de la configuración).
 */
export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ASSIGNMENT_RULES',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const rawContext = (body?.context ?? body ?? {}) as Record<string, unknown>
    const context = {
      source: normalizeString(rawContext.source) || null,
      formId: normalizeString(rawContext.formId) || null,
      campaignName: normalizeString(rawContext.campaignName) || null,
      serviceInterest: normalizeString(rawContext.serviceInterest) || null,
      sedeId: normalizeString(rawContext.sedeId) || null,
      city: normalizeString(rawContext.city) || null,
      score: Number.isFinite(Number(rawContext.score)) ? Number(rawContext.score) : null,
      scoreBand: normalizeString(rawContext.scoreBand) || null,
    }

    const rules = await prisma.crmAssignmentRule.findMany({
      where: { empresaId: access.empresaId, active: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })

    const evaluated = rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      matched: matchesCrmAssignmentRule(parseCrmAssignmentMatchJson(rule.matchJson), context),
      assigneeUserId: rule.assigneeUserId,
      teamId: rule.teamId,
    }))

    const resolution = await resolveCrmAssigneeByRules({
      client: prisma,
      empresaId: access.empresaId,
      context,
    })

    return NextResponse.json({
      success: true,
      data: {
        context,
        evaluated,
        wouldAssign: Boolean(resolution),
        ruleId: resolution?.rule.id ?? null,
        ruleName: resolution?.rule.name ?? null,
        assigneeUserId: resolution?.assigneeUserId ?? null,
      },
    })
  } catch (error) {
    console.error('Error simulando reglas de asignación:', error)
    return NextResponse.json({ error: 'Error simulando reglas de asignación' }, { status: 500 })
  }
}
