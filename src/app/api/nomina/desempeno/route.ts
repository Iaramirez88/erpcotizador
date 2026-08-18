import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollPerformanceDemoData, serializePayrollPerformanceReviews } from '@/lib/payroll-performance'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value: unknown) {
  const next = asString(value)
  return next || null
}

function asNumber(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseChartSeries(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ label: string; target: number; actual: number }>
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    const label = asString(row.label)
    const target = Number(row.target)
    const actual = Number(row.actual)
    if (!label || !Number.isFinite(target) || !Number.isFinite(actual)) return []
    return [{ label, target, actual }]
  })
}

function buildPerformanceMetadata(body: Record<string, unknown>) {
  return {
    salesTargetAmount: asNumber(body.salesTargetAmount),
    salesAchievedAmount: asNumber(body.salesAchievedAmount),
    salesTargetDeals: asNumber(body.salesTargetDeals),
    salesAchievedDeals: asNumber(body.salesAchievedDeals),
    chartSeries: parseChartSeries(body.chartSeries),
  }
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollPerformanceDemoData(access.empresaId, access.userId)
  const data = await serializePayrollPerformanceReviews(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const cycleTitle = asString(body.cycleTitle)
  const reviewType = asString(body.reviewType)
  const competencyFocus = asString(body.competencyFocus)

  if (!cycleTitle || !reviewType || !competencyFocus) {
    return NextResponse.json({ ok: false, error: 'cycleTitle, reviewType y competencyFocus son requeridos' }, { status: 400 })
  }

  await prisma.payrollPerformanceReview.create({
    data: {
      empresaId: access.empresaId,
      employeeId: asNullableString(body.employeeId),
      ownerUserId: access.userId,
      cycleTitle,
      reviewType,
      status: asString(body.status) || 'BORRADOR',
      managerName: asNullableString(body.managerName),
      competencyFocus,
      score: asNumber(body.score),
      targetScore: asNumber(body.targetScore),
      dueDate: asDate(body.dueDate),
      completedAt: asDate(body.completedAt),
      developmentPlan: asNullableString(body.developmentPlan),
      summary: asNullableString(body.summary),
      metadata: buildPerformanceMetadata(body),
    },
  })

  const data = await serializePayrollPerformanceReviews(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const cycleTitle = asString(body.cycleTitle)
  const reviewType = asString(body.reviewType)
  const competencyFocus = asString(body.competencyFocus)

  if (!id || !cycleTitle || !reviewType || !competencyFocus) {
    return NextResponse.json({ ok: false, error: 'id, cycleTitle, reviewType y competencyFocus son requeridos' }, { status: 400 })
  }

  const existing = await prisma.payrollPerformanceReview.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Evaluación no encontrada' }, { status: 404 })
  }

  await prisma.payrollPerformanceReview.update({
    where: { id },
    data: {
      employeeId: asNullableString(body.employeeId),
      ownerUserId: access.userId,
      cycleTitle,
      reviewType,
      status: asString(body.status) || 'BORRADOR',
      managerName: asNullableString(body.managerName),
      competencyFocus,
      score: asNumber(body.score),
      targetScore: asNumber(body.targetScore),
      dueDate: asDate(body.dueDate),
      completedAt: asDate(body.completedAt),
      developmentPlan: asNullableString(body.developmentPlan),
      summary: asNullableString(body.summary),
      metadata: buildPerformanceMetadata(body),
    },
  })

  const data = await serializePayrollPerformanceReviews(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const existing = await prisma.payrollPerformanceReview.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Evaluación no encontrada' }, { status: 404 })
  }

  await prisma.payrollPerformanceReview.delete({ where: { id } })
  const data = await serializePayrollPerformanceReviews(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
