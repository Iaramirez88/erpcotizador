import { Prisma, SedeRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { DecisionEngineContext, DecisionEngineResult } from '@/lib/decision-engine/contracts'
import { createDecisionEngine } from '@/lib/decision-engine/engine'
import { isCompanyIntelligenceEnabledForEmpresa } from '@/lib/company-intelligence'

export type DecisionEngineSnapshotBundle = {
  generatedAt: string
  company: DecisionEngineResult
  crm: DecisionEngineResult
  finance: DecisionEngineResult
  inventory: DecisionEngineResult
  operations: DecisionEngineResult
  purchases: DecisionEngineResult
  sales: DecisionEngineResult
}

export type PersistDecisionEngineSnapshotOptions = {
  force?: boolean
}

export type DecisionEngineSnapshotListItem = {
  id: string
  scope: string
  from: string
  to: string
  locale: string
  engineVersion: string
  companyHealthScore: number
  companyHealthStatus: string
  executiveSummary: string
  createdAt: string
  snapshot?: DecisionEngineSnapshotBundle | null
}

function buildExecutiveNotification(bundle: DecisionEngineSnapshotBundle) {
  const health = bundle.company.healthStatus
  const urgentActions = bundle.company.actions.filter((item) => item.priority === 'NOW').length
  const topRisk = bundle.company.risks[0] ?? null

  if (health === 'BUENO' || health === 'EXCELENTE') return null

  const type = health === 'CRITICO' ? 'ERROR' : 'WARNING'
  const title = health === 'CRITICO'
    ? `Señal ejecutiva para revisión: salud empresarial en ${health.toLowerCase()}`
    : `Atención ejecutiva para revisión: salud empresarial en ${health.toLowerCase()}`
  const body = topRisk
    ? `${topRisk.summary} Acciones inmediatas sugeridas: ${urgentActions}.`
    : `${bundle.company.executiveSummary} Acciones inmediatas sugeridas: ${urgentActions}.`

  return {
    type,
    title,
    body,
    actionUrl: '/dashboard/inteligencia',
    actionLabel: 'Abrir lectura asistida',
  } as const
}

async function notifyExecutiveSnapshot(args: {
  empresaId: string
  sedeId?: string | null
  notification: NonNullable<ReturnType<typeof buildExecutiveNotification>>
}) {
  const candidateUsers = await prisma.user.findMany({
    where: {
      empresaId: args.empresaId,
      OR: [
        { role: 'ADMIN' },
        { globalAccess: { is: { level: 'ADMIN' } } },
        ...(args.sedeId
          ? [{ sedeMemberships: { some: { sedeId: args.sedeId, role: { in: [SedeRole.ADMIN, SedeRole.MANAGER] } } } }]
          : []),
      ],
    },
    select: { id: true },
    take: 30,
  })

  const recipientUserIds = Array.from(new Set(candidateUsers.map((item) => item.id)))
  if (!recipientUserIds.length) return 0

  const result = await prisma.notification.createMany({
    data: recipientUserIds.map((userId) => ({
      empresaId: args.empresaId,
      sedeId: args.sedeId ?? null,
      userId,
      type: args.notification.type,
      title: args.notification.title,
      body: args.notification.body,
      actionUrl: args.notification.actionUrl,
      actionLabel: args.notification.actionLabel,
    })),
  })

  return result.count
}

export async function buildDecisionEngineSnapshotBundle(context: DecisionEngineContext): Promise<DecisionEngineSnapshotBundle> {
  const engine = createDecisionEngine()
  const [company, crm, finance, inventory, operations, purchases, sales] = await Promise.all([
    engine.analyzeCompany(context),
    engine.analyzeCrm(context),
    engine.analyzeFinance(context),
    engine.analyzeInventory(context),
    engine.analyzeOperations(context),
    engine.analyzePurchases(context),
    engine.analyzeSales(context),
  ])

  return {
    generatedAt: new Date().toISOString(),
    company,
    crm,
    finance,
    inventory,
    operations,
    purchases,
    sales,
  }
}

export async function persistDecisionEngineSnapshot(
  context: DecisionEngineContext,
  options: PersistDecisionEngineSnapshotOptions = {}
) {
  const intelligenceEnabled = await isCompanyIntelligenceEnabledForEmpresa(context.empresaId)
  const bundle = await buildDecisionEngineSnapshotBundle(context)

  if (!options.force) {
    const existing = await prisma.decisionEngineSnapshot.findFirst({
      where: {
        empresaId: context.empresaId,
        sedeId: context.sedeId ?? null,
        scope: context.sedeId ? 'SEDE' : 'EMPRESA',
        from: new Date(bundle.company.metadata.from),
        to: new Date(bundle.company.metadata.to),
        engineVersion: 'v1',
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        empresaId: true,
        sedeId: true,
        scope: true,
        from: true,
        to: true,
        locale: true,
        engineVersion: true,
        companyHealthScore: true,
        companyHealthStatus: true,
        executiveSummary: true,
        createdAt: true,
      },
    })

    if (existing) {
      return {
        ...existing,
        from: existing.from.toISOString(),
        to: existing.to.toISOString(),
        createdAt: existing.createdAt.toISOString(),
        snapshot: bundle,
        reused: true,
      }
    }
  }

  const created = await prisma.decisionEngineSnapshot.create({
    data: {
      empresaId: context.empresaId,
      sedeId: context.sedeId ?? null,
      scope: context.sedeId ? 'SEDE' : 'EMPRESA',
      from: new Date(bundle.company.metadata.from),
      to: new Date(bundle.company.metadata.to),
      locale: bundle.company.metadata.locale,
      engineVersion: 'v1',
      capturedByUserId: context.actorUserId ?? null,
      companyHealthScore: bundle.company.healthScore,
      companyHealthStatus: bundle.company.healthStatus,
      executiveSummary: bundle.company.executiveSummary,
      snapshot: JSON.parse(JSON.stringify(bundle)) as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      empresaId: true,
      sedeId: true,
      scope: true,
      from: true,
      to: true,
      locale: true,
      engineVersion: true,
      companyHealthScore: true,
      companyHealthStatus: true,
      executiveSummary: true,
      createdAt: true,
    },
  })

  return {
    ...(await (async () => {
      if (!intelligenceEnabled) return { notifiedUsers: 0 }
      const notification = buildExecutiveNotification(bundle)
      if (!notification) return { notifiedUsers: 0 }
      const notifiedUsers = await notifyExecutiveSnapshot({
        empresaId: context.empresaId,
        sedeId: context.sedeId ?? null,
        notification,
      })
      return { notifiedUsers }
    })()),
    ...created,
    from: created.from.toISOString(),
    to: created.to.toISOString(),
    createdAt: created.createdAt.toISOString(),
    snapshot: bundle,
    reused: false,
  }
}

export async function listDecisionEngineSnapshots(args: {
  empresaId: string
  sedeId?: string | null
  limit?: number
  includeBundle?: boolean
}) {
  const rows = await prisma.decisionEngineSnapshot.findMany({
    where: {
      empresaId: args.empresaId,
      ...(args.sedeId ? { sedeId: args.sedeId } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(50, Math.max(1, args.limit ?? 12)),
    select: {
      id: true,
      scope: true,
      from: true,
      to: true,
      locale: true,
      engineVersion: true,
      companyHealthScore: true,
      companyHealthStatus: true,
      executiveSummary: true,
      createdAt: true,
      ...(args.includeBundle ? { snapshot: true } : {}),
    },
  })

  return rows.map((row) => ({
    ...row,
    from: row.from.toISOString(),
    to: row.to.toISOString(),
    createdAt: row.createdAt.toISOString(),
    snapshot: 'snapshot' in row ? (row.snapshot as unknown as DecisionEngineSnapshotBundle) : undefined,
  })) as DecisionEngineSnapshotListItem[]
}