import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSerpProvider, type SerpCheckRequest } from '@/lib/seo-serp-provider'

type TrackableKeyword = {
  id: string
  empresaId: string
  domain: string
  keyword: string
  country: string
  locationCode: number | null
  locationName: string | null
  language: string
  device: string
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function getSerpBudgetUsage() {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [cost, tasks] = await Promise.all([
    prisma.crmSeoSerpTask.aggregate({ where: { requestedAt: { gte: monthStart } }, _sum: { costUsd: true } }),
    prisma.crmSeoSerpTask.count({ where: { requestedAt: { gte: monthStart } } }),
  ])
  const budgetUsd = positiveNumber(process.env.DATAFORSEO_MONTHLY_BUDGET_USD, 10)
  const estimatedCostPerSerpUsd = positiveNumber(process.env.DATAFORSEO_ESTIMATED_COST_PER_SERP_USD, 0.0006)
  const spentUsd = cost._sum.costUsd || 0
  return { budgetUsd, spentUsd, remainingUsd: Math.max(0, budgetUsd - spentUsd), estimatedCostPerSerpUsd, tasks }
}

export async function enqueueSerpChecks(keywords: TrackableKeyword[]) {
  const provider = getSerpProvider()
  if (!provider.isConfigured()) throw new Error('DataForSEO no está configurado en este entorno.')

  const pending = keywords.length ? await prisma.crmSeoSerpTask.findMany({
    where: { keywordId: { in: keywords.map((item) => item.id) }, status: { in: ['QUEUED', 'PROCESSING'] } },
    select: { keywordId: true },
  }) : []
  const pendingIds = new Set(pending.map((item) => item.keywordId))
  const budget = await getSerpBudgetUsage()
  const availableTasks = Math.floor(budget.remainingUsd / budget.estimatedCostPerSerpUsd)
  if (availableTasks < 1) throw new Error(`Se alcanzó el presupuesto mensual de DataForSEO (US$${budget.budgetUsd.toFixed(2)}).`)
  const candidates = keywords.filter((item) => !pendingIds.has(item.id)).slice(0, Math.min(100, availableTasks))
  const requests: SerpCheckRequest[] = candidates.map((item) => ({
    trackingId: item.id,
    keyword: item.keyword,
    targetDomain: item.domain,
    country: item.country,
    locationCode: item.locationCode,
    locationName: item.locationName,
    languageCode: item.language,
    device: item.device === 'MOBILE' ? 'MOBILE' : 'DESKTOP',
    depth: 100,
  }))
  const submitted = await provider.submit(requests)

  await prisma.$transaction(submitted.map((task) => prisma.crmSeoSerpTask.create({
    data: {
      empresaId: candidates.find((item) => item.id === task.trackingId)!.empresaId,
      keywordId: task.trackingId,
      provider: provider.name,
      providerTaskId: task.providerTaskId,
      costUsd: task.costUsd,
      requestJson: task.request as unknown as Prisma.InputJsonValue,
    },
  })))

  return { queued: submitted.length, skipped: keywords.length - submitted.length, provider: provider.name, budget }
}

export async function collectSerpResults(options?: { empresaId?: string; limit?: number }) {
  const provider = getSerpProvider()
  if (!provider.isConfigured()) throw new Error('DataForSEO no está configurado en este entorno.')
  const tasks = await prisma.crmSeoSerpTask.findMany({
    where: { empresaId: options?.empresaId, status: { in: ['QUEUED', 'PROCESSING'] } },
    orderBy: { requestedAt: 'asc' },
    take: Math.min(100, Math.max(1, options?.limit || 50)),
    include: { keyword: true },
  })

  let completed = 0
  let pending = 0
  let failed = 0
  let costUsd = 0
  for (const task of tasks) {
    try {
      const result = await provider.getResult(task.providerTaskId, task.keyword.domain)
      if (!result) {
        pending += 1
        if (task.status !== 'PROCESSING') await prisma.crmSeoSerpTask.update({ where: { id: task.id }, data: { status: 'PROCESSING' } })
        continue
      }
      await prisma.$transaction([
        prisma.crmSeoKeywordPosition.create({
          data: {
            empresaId: task.empresaId,
            keywordId: task.keywordId,
            checkedAt: result.checkedAt,
            position: result.position,
            resultUrl: result.resultUrl,
            source: provider.name,
            rawJson: result.raw as Prisma.InputJsonValue,
          },
        }),
        prisma.crmSeoKeyword.update({
          where: { id: task.keywordId },
          data: {
            previousPosition: task.keyword.latestPosition,
            latestPosition: result.position,
            latestUrl: result.resultUrl,
            lastCheckedAt: result.checkedAt,
            previousSerpPosition: task.keyword.latestSerpPosition,
            latestSerpPosition: result.position,
            latestSerpUrl: result.resultUrl,
            lastSerpCheckedAt: result.checkedAt,
          },
        }),
        prisma.crmSeoSerpTask.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', completedAt: new Date(), costUsd: result.costUsd ?? task.costUsd, errorMessage: null },
        }),
      ])
      completed += 1
      costUsd += result.costUsd ?? task.costUsd ?? 0
    } catch (error) {
      failed += 1
      await prisma.crmSeoSerpTask.update({
        where: { id: task.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'Error desconocido' },
      })
    }
  }
  return { inspected: tasks.length, completed, pending, failed, costUsd }
}

export async function findDueSeoKeywords(options?: { empresaId?: string; days?: number; limit?: number }) {
  const cutoff = new Date(Date.now() - (options?.days || 7) * 24 * 60 * 60 * 1000)
  return prisma.crmSeoKeyword.findMany({
    where: {
      empresaId: options?.empresaId,
      active: true,
      OR: [{ lastSerpCheckedAt: null }, { lastSerpCheckedAt: { lte: cutoff } }],
    },
    orderBy: [{ lastSerpCheckedAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(100, Math.max(1, options?.limit || 100)),
  })
}
