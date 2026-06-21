import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollTrainingDemoData, serializePayrollTrainingAssignments } from '@/lib/payroll-training'

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

function asInteger(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.round(next) : 0
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollTrainingDemoData(access.empresaId, access.userId)
  const data = await serializePayrollTrainingAssignments(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const title = asString(body.title)
  const category = asString(body.category)

  if (!title || !category) {
    return NextResponse.json({ ok: false, error: 'title y category son requeridos' }, { status: 400 })
  }

  await prisma.payrollTrainingAssignment.create({
    data: {
      empresaId: access.empresaId,
      employeeId: asNullableString(body.employeeId),
      ownerUserId: access.userId,
      title,
      category,
      status: asString(body.status) || 'PLANIFICADA',
      modality: asString(body.modality) || 'VIRTUAL',
      provider: asNullableString(body.provider),
      durationHours: asInteger(body.durationHours),
      dueDate: asDate(body.dueDate),
      completedAt: asDate(body.completedAt),
      score: asNumber(body.score),
      certificateUrl: asNullableString(body.certificateUrl),
      summary: asNullableString(body.summary),
    },
  })

  const data = await serializePayrollTrainingAssignments(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const title = asString(body.title)
  const category = asString(body.category)

  if (!id || !title || !category) {
    return NextResponse.json({ ok: false, error: 'id, title y category son requeridos' }, { status: 400 })
  }

  const existing = await prisma.payrollTrainingAssignment.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Capacitación no encontrada' }, { status: 404 })
  }

  await prisma.payrollTrainingAssignment.update({
    where: { id },
    data: {
      employeeId: asNullableString(body.employeeId),
      ownerUserId: access.userId,
      title,
      category,
      status: asString(body.status) || 'PLANIFICADA',
      modality: asString(body.modality) || 'VIRTUAL',
      provider: asNullableString(body.provider),
      durationHours: asInteger(body.durationHours),
      dueDate: asDate(body.dueDate),
      completedAt: asDate(body.completedAt),
      score: asNumber(body.score),
      certificateUrl: asNullableString(body.certificateUrl),
      summary: asNullableString(body.summary),
    },
  })

  const data = await serializePayrollTrainingAssignments(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const existing = await prisma.payrollTrainingAssignment.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Capacitación no encontrada' }, { status: 404 })
  }

  await prisma.payrollTrainingAssignment.delete({ where: { id } })
  const data = await serializePayrollTrainingAssignments(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
