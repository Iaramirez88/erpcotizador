import { CrmOpportunityStage, type PrismaClient } from '@prisma/client'
import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'
import { resolveAnalysisDateRange } from '@/lib/decision-engine/dates'

export type CrmDecisionFacts = {
  generatedAt: string
  scope: 'EMPRESA' | 'SEDE'
  period: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    durationDays: number
  }
  leads: {
    newThisPeriod: number
    convertedThisPeriod: number
    withoutRecentFollowUp: Array<{
      id: string
      nombre: string
      empresaNombre: string | null
      lastActivityAt: string | null
      createdAt: string
    }>
  }
  opportunities: {
    openCount: number
    openValue: number
    wonThisPeriod: number
    stale: Array<{
      id: string
      title: string
      updatedAt: string
      expectedValue: number
      probabilityPct: number
    }>
    highPotential: Array<{
      id: string
      title: string
      expectedValue: number
      probabilityPct: number
      updatedAt: string
    }>
  }
}

type CollectCrmFactsArgs = DecisionEngineContext & {
  prisma: PrismaClient
}

function clampPositive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export async function collectCrmFacts(args: CollectCrmFactsArgs): Promise<CrmDecisionFacts> {
  const range = resolveAnalysisDateRange(args)
  const followUpThreshold = new Date(range.to.getTime() - 14 * 24 * 60 * 60 * 1000)
  const staleThreshold = new Date(range.to.getTime() - 21 * 24 * 60 * 60 * 1000)

  const [newLeads, convertedLeads, leadsWithoutFollowUp, opportunityAggregate, wonThisPeriod, staleOpportunities, highPotential] = await Promise.all([
    args.prisma.crmLead.count({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
    }),
    args.prisma.crmLead.count({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        convertedAt: { gte: range.from, lte: range.to },
      },
    }),
    args.prisma.crmLead.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        convertedAt: null,
        OR: [
          { lastActivityAt: null },
          { lastActivityAt: { lte: followUpThreshold } },
        ],
      },
      orderBy: [{ lastActivityAt: 'asc' }, { createdAt: 'asc' }],
      take: 8,
      select: {
        id: true,
        nombre: true,
        empresaNombre: true,
        lastActivityAt: true,
        createdAt: true,
      },
    }),
    args.prisma.crmOpportunity.aggregate({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        stage: { notIn: [CrmOpportunityStage.WON, CrmOpportunityStage.LOST] },
      },
      _count: { id: true },
      _sum: { expectedValue: true },
    }),
    args.prisma.crmOpportunity.count({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        stage: CrmOpportunityStage.WON,
        wonAt: { gte: range.from, lte: range.to },
      },
    }),
    args.prisma.crmOpportunity.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        stage: { notIn: [CrmOpportunityStage.WON, CrmOpportunityStage.LOST] },
        updatedAt: { lte: staleThreshold },
      },
      orderBy: { updatedAt: 'asc' },
      take: 8,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        expectedValue: true,
        probabilityPct: true,
      },
    }),
    args.prisma.crmOpportunity.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        stage: { notIn: [CrmOpportunityStage.WON, CrmOpportunityStage.LOST] },
        probabilityPct: { gte: 70 },
      },
      orderBy: [{ probabilityPct: 'desc' }, { expectedValue: 'desc' }],
      take: 6,
      select: {
        id: true,
        title: true,
        expectedValue: true,
        probabilityPct: true,
        updatedAt: true,
      },
    }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    scope: args.sedeId ? 'SEDE' : 'EMPRESA',
    period: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      previousFrom: range.previousFrom.toISOString(),
      previousTo: range.previousTo.toISOString(),
      durationDays: range.durationDays,
    },
    leads: {
      newThisPeriod: newLeads,
      convertedThisPeriod: convertedLeads,
      withoutRecentFollowUp: leadsWithoutFollowUp.map((lead) => ({
        id: lead.id,
        nombre: lead.nombre,
        empresaNombre: lead.empresaNombre ?? null,
        lastActivityAt: lead.lastActivityAt ? lead.lastActivityAt.toISOString() : null,
        createdAt: lead.createdAt.toISOString(),
      })),
    },
    opportunities: {
      openCount: opportunityAggregate._count.id,
      openValue: clampPositive(opportunityAggregate._sum.expectedValue ?? 0),
      wonThisPeriod,
      stale: staleOpportunities.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        updatedAt: opportunity.updatedAt.toISOString(),
        expectedValue: clampPositive(opportunity.expectedValue ?? 0),
        probabilityPct: opportunity.probabilityPct,
      })),
      highPotential: highPotential.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        expectedValue: clampPositive(opportunity.expectedValue ?? 0),
        probabilityPct: opportunity.probabilityPct,
        updatedAt: opportunity.updatedAt.toISOString(),
      })),
    },
  }
}