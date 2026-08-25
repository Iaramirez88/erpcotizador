import { EstadoOrden, Prisma, RopRiskLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { publishRopTrustScoreRecomputedEvent } from '@/lib/rop-events'
import { ensureRopCompanyForEmpresa } from '@/lib/rop'

const SUCCESS_ORDER_STATES = [EstadoOrden.LISTA_ENTREGA, EstadoOrden.ENTREGADA, EstadoOrden.FACTURADO, EstadoOrden.CERRADO] as const
const TERMINAL_ORDER_STATES = [...SUCCESS_ORDER_STATES, EstadoOrden.CANCELADA] as const

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function toDecimal(value: number) {
  return new Prisma.Decimal(clampScore(Number(value.toFixed(2))))
}

function resolveRiskLevel(score: number): RopRiskLevel {
  if (score >= 85) return 'LOW'
  if (score >= 70) return 'MEDIUM'
  if (score >= 50) return 'HIGH'
  return 'CRITICAL'
}

export type RopTrustRecomputeSummary = {
  overallScore: number
  deltaFromPrevious: number | null
  riskLevel: RopRiskLevel
  computedAt: string
  sourceRef: string
  note: string
  evidence: {
    totalTerminalOrders: number
    successfulOrders: number
    cancelledOrders: number
    onTimeOrders: number
    ratedSamples: number
  }
}

type RopTrustRecomputeReason = 'WORK_ORDER_CLOSED' | 'RATING_UPDATED' | 'RATING_DISPUTED' | 'RATING_MODERATED'

async function recomputeRopTrustScore(args: {
  companyId: string
  empresaId?: string | null
  reason: RopTrustRecomputeReason
  sourceRef: string
}) {
  const companyRecord = await prisma.ropCompany.findUnique({
    where: { id: args.companyId },
    select: { id: true, empresaId: true },
  })

  if (!companyRecord) {
    throw new Error('ROP_COMPANY_NOT_FOUND')
  }

  const empresaId = args.empresaId ?? companyRecord.empresaId ?? null

  const [terminalOrders, ratings, previousSnapshot] = await Promise.all([
    empresaId
      ? prisma.ordenTrabajo.findMany({
          where: {
            sede: { empresaId },
            estado: { in: [...TERMINAL_ORDER_STATES] },
          },
          select: {
            id: true,
            numero: true,
            estado: true,
            createdAt: true,
            updatedAt: true,
            fechaEntrega: true,
            fechaInicio: true,
          },
          take: 250,
          orderBy: [{ updatedAt: 'desc' }],
        })
      : Promise.resolve([]),
    prisma.ropRating.findMany({
      where: {
        ratedCompanyId: companyRecord.id,
        OR: [
          { moderationStatus: { in: ['PENDING', 'PUBLISHED'] } },
          { disputeFlag: true },
        ],
      },
      select: {
        raterCompanyId: true,
        overallScore: true,
        disputeFlag: true,
        moderationStatus: true,
      },
      take: 100,
      orderBy: [{ createdAt: 'desc' }],
    }),
    prisma.ropTrustScoreSnapshot.findFirst({
      where: { companyId: companyRecord.id },
      select: { overallScore: true },
      orderBy: [{ computedAt: 'desc' }],
    }),
  ])

  const totalTerminalOrders = terminalOrders.length
  const successfulOrders = terminalOrders.filter((order) => SUCCESS_ORDER_STATES.includes(order.estado as (typeof SUCCESS_ORDER_STATES)[number]))
  const cancelledOrders = terminalOrders.filter((order) => order.estado === EstadoOrden.CANCELADA)
  const onTimeOrders = successfulOrders.filter((order) => {
    if (!order.fechaEntrega) return false
    return order.updatedAt.getTime() <= order.fechaEntrega.getTime()
  })
  const startedOrders = successfulOrders.filter((order) => Boolean(order.fechaInicio))

  const successRate = totalTerminalOrders > 0 ? (successfulOrders.length / totalTerminalOrders) * 100 : 70
  const onTimeRate = successfulOrders.length > 0
    ? ((onTimeOrders.length || 0) / successfulOrders.length) * 100
    : 70
  const startedRate = successfulOrders.length > 0
    ? (startedOrders.length / successfulOrders.length) * 100
    : 70

  const publishedRatingBuckets = new Map<string, number[]>()
  for (const item of ratings) {
    if (item.moderationStatus !== 'PENDING' && item.moderationStatus !== 'PUBLISHED') continue
    const value = Number(item.overallScore)
    if (!Number.isFinite(value)) continue
    const bucket = publishedRatingBuckets.get(item.raterCompanyId) ?? []
    bucket.push(value)
    publishedRatingBuckets.set(item.raterCompanyId, bucket)
  }

  const publishedRatings = Array.from(publishedRatingBuckets.values())
    .map((bucket) => bucket.reduce((acc, value) => acc + value, 0) / bucket.length)
    .filter((value) => Number.isFinite(value))

  const ratingAverage = publishedRatings.length
    ? publishedRatings.reduce((acc, value) => acc + value, 0) / publishedRatings.length
    : null
  const qualityScore = ratingAverage !== null ? (ratingAverage / 5) * 100 : successRate
  const recurrenceScore = totalTerminalOrders > 0 ? Math.min(100, 35 + successfulOrders.length * 8) : 35
  const responsivenessScore = clampScore((startedRate * 0.45) + (onTimeRate * 0.55))
  const reliabilityScore = clampScore((successRate * 0.7) + (onTimeRate * 0.3))
  const disputePenalty = clampScore((cancelledOrders.length * 4) + (ratings.filter((item) => item.disputeFlag).length * 6))
  const overallScore = clampScore(
    (reliabilityScore * 0.4)
    + (responsivenessScore * 0.2)
    + (qualityScore * 0.25)
    + (recurrenceScore * 0.15)
    - disputePenalty
  )

  const now = new Date()
  const note = 'Trust recalculado desde evidencia operativa del ERP y ratings ROP disponibles.'
  const payload = {
    version: 1,
    overallScore: toDecimal(overallScore),
    reliabilityScore: toDecimal(reliabilityScore),
    responsivenessScore: toDecimal(responsivenessScore),
    qualityScore: toDecimal(qualityScore),
    recurrenceScore: toDecimal(recurrenceScore),
    disputePenalty: toDecimal(disputePenalty),
    riskLevel: resolveRiskLevel(overallScore),
    computedAt: now,
    explainabilityJson: {
      reason: args.reason,
      sourceRef: args.sourceRef,
      evidence: {
        totalTerminalOrders,
        successfulOrders: successfulOrders.length,
        cancelledOrders: cancelledOrders.length,
        onTimeOrders: onTimeOrders.length,
        ratedSamples: publishedRatings.length,
      },
      formula: {
        reliabilityScore,
        responsivenessScore,
        qualityScore,
        recurrenceScore,
        disputePenalty,
      },
      note,
    } satisfies Prisma.InputJsonValue,
  }

  const trust = await prisma.ropTrustScore.upsert({
    where: { companyId: companyRecord.id },
    create: {
      companyId: companyRecord.id,
      ...payload,
    },
    update: payload,
  })

  await prisma.ropTrustScoreSnapshot.create({
    data: {
      companyId: companyRecord.id,
      version: payload.version,
      overallScore: payload.overallScore,
      computedAt: now,
      breakdownJson: payload.explainabilityJson,
    },
  })

  const summary = {
    overallScore: Number(payload.overallScore),
    deltaFromPrevious: previousSnapshot
      ? Number((overallScore - Number(previousSnapshot.overallScore)).toFixed(2))
      : null,
    riskLevel: payload.riskLevel,
    computedAt: now.toISOString(),
    sourceRef: args.sourceRef,
    note,
    evidence: {
      totalTerminalOrders,
      successfulOrders: successfulOrders.length,
      cancelledOrders: cancelledOrders.length,
      onTimeOrders: onTimeOrders.length,
      ratedSamples: publishedRatings.length,
    },
  } satisfies RopTrustRecomputeSummary

  publishRopTrustScoreRecomputedEvent({
    eventType: 'rop.trust_score_recomputed',
    companyId: companyRecord.id,
    empresaId,
    reason: args.reason,
    sourceRef: args.sourceRef,
    overallScore: summary.overallScore,
    deltaFromPrevious: summary.deltaFromPrevious,
    riskLevel: summary.riskLevel,
    computedAt: summary.computedAt,
    evidence: summary.evidence,
  })

  return {
    trust,
    summary,
  }
}

export async function recomputeRopTrustScoreForCompany(args: {
  companyId: string
  reason: RopTrustRecomputeReason
  sourceRef: string
}) {
  return recomputeRopTrustScore(args)
}

export async function recomputeRopTrustScoreForEmpresa(args: {
  empresaId: string
  reason: RopTrustRecomputeReason
  sourceRef: string
}) {
  const company = await ensureRopCompanyForEmpresa(args.empresaId)
  return recomputeRopTrustScore({
    companyId: company.id,
    empresaId: args.empresaId,
    reason: args.reason,
    sourceRef: args.sourceRef,
  })
}