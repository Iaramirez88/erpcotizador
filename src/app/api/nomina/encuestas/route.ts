import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollSurveyDemoData, serializePayrollSurveyCampaigns } from '@/lib/payroll-surveys'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asInteger(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.round(next) : fallback
}

function asNumber(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function asBoolean(value: unknown) {
  return value === true || value === 'true'
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollSurveyDemoData(access.empresaId, access.userId)
  const data = await serializePayrollSurveyCampaigns(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const title = asString(body.title)
  const category = asString(body.category)
  const audience = asString(body.audience)

  if (!title || !category || !audience) {
    return NextResponse.json({ ok: false, error: 'title, category y audience son requeridos' }, { status: 400 })
  }

  await prisma.payrollSurveyCampaign.create({
    data: {
      empresaId: access.empresaId,
      ownerUserId: access.userId,
      title,
      category,
      status: asString(body.status) || 'BORRADOR',
      anonymous: asBoolean(body.anonymous),
      audience,
      channel: asString(body.channel) || 'PORTAL',
      questionsCount: asInteger(body.questionsCount),
      invitedCount: asInteger(body.invitedCount),
      responsesCount: asInteger(body.responsesCount),
      averageScore: asNumber(body.averageScore),
      opensAt: asDate(body.opensAt),
      closesAt: asDate(body.closesAt),
      summary: asNullableString(body.summary),
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollSurveyCampaigns(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const title = asString(body.title)
  const category = asString(body.category)
  const audience = asString(body.audience)

  if (!id || !title || !category || !audience) {
    return NextResponse.json({ ok: false, error: 'id, title, category y audience son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollSurveyCampaign.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Encuesta no encontrada' }, { status: 404 })
  }

  await prisma.payrollSurveyCampaign.update({
    where: { id },
    data: {
      ownerUserId: access.userId,
      title,
      category,
      status: asString(body.status) || 'BORRADOR',
      anonymous: asBoolean(body.anonymous),
      audience,
      channel: asString(body.channel) || 'PORTAL',
      questionsCount: asInteger(body.questionsCount),
      invitedCount: asInteger(body.invitedCount),
      responsesCount: asInteger(body.responsesCount),
      averageScore: asNumber(body.averageScore),
      opensAt: asDate(body.opensAt),
      closesAt: asDate(body.closesAt),
      summary: asNullableString(body.summary),
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollSurveyCampaigns(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollSurveyCampaign.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Encuesta no encontrada' }, { status: 404 })
  }

  await prisma.payrollSurveyCampaign.delete({ where: { id } })
  const data = await serializePayrollSurveyCampaigns(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
