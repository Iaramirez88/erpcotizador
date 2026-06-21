import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollServiceCaseDemoData, serializePayrollServiceCases } from '@/lib/payroll-service'

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

function asBoolean(value: unknown) {
  return value === true || value === 'true'
}

const CASE_STATUSES = ['ABIERTO', 'EN_GESTION', 'EN_ESPERA', 'RESUELTO'] as const
const CASE_PRIORITIES = ['BAJA', 'MEDIA', 'ALTA'] as const

function isStatus(value: string): value is (typeof CASE_STATUSES)[number] {
  return CASE_STATUSES.includes(value as (typeof CASE_STATUSES)[number])
}

function isPriority(value: string): value is (typeof CASE_PRIORITIES)[number] {
  return CASE_PRIORITIES.includes(value as (typeof CASE_PRIORITIES)[number])
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollServiceCaseDemoData(access.empresaId, access.userId)
  const data = await serializePayrollServiceCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const title = asString(body.title)
  const category = asString(body.category)
  const summary = asString(body.summary)
  const status = asString(body.status) || 'ABIERTO'
  const priority = asString(body.priority) || 'MEDIA'

  if (!employeeId || !title || !category || !summary || !isStatus(status) || !isPriority(priority)) {
    return NextResponse.json({ ok: false, error: 'employeeId, title, category, summary, status y priority son requeridos' }, { status: 400 })
  }

  await prisma.payrollEmployeeServiceCase.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      periodId: asNullableString(body.periodId),
      assignedToUserId: access.userId,
      resolvedByUserId: status === 'RESUELTO' ? access.userId : null,
      title,
      category,
      channel: asString(body.channel) || 'PORTAL',
      priority,
      status,
      portalVisibility: asBoolean(body.portalVisibility),
      employeeRole: asNullableString(body.employeeRole),
      summary,
      resolution: asNullableString(body.resolution),
      slaHours: asInteger(body.slaHours, 24),
      requestedAt: asDate(body.requestedAt) ?? new Date(),
      firstResponseAt: asDate(body.firstResponseAt),
      resolvedAt: status === 'RESUELTO' ? asDate(body.resolvedAt) ?? new Date() : null,
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollServiceCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const title = asString(body.title)
  const category = asString(body.category)
  const summary = asString(body.summary)
  const status = asString(body.status) || 'ABIERTO'
  const priority = asString(body.priority) || 'MEDIA'

  if (!id || !employeeId || !title || !category || !summary || !isStatus(status) || !isPriority(priority)) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, title, category, summary, status y priority son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollEmployeeServiceCase.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Caso de servicio no encontrado' }, { status: 404 })
  }

  await prisma.payrollEmployeeServiceCase.update({
    where: { id },
    data: {
      employeeId,
      periodId: asNullableString(body.periodId),
      assignedToUserId: access.userId,
      resolvedByUserId: status === 'RESUELTO' ? access.userId : null,
      title,
      category,
      channel: asString(body.channel) || 'PORTAL',
      priority,
      status,
      portalVisibility: asBoolean(body.portalVisibility),
      employeeRole: asNullableString(body.employeeRole),
      summary,
      resolution: asNullableString(body.resolution),
      slaHours: asInteger(body.slaHours, 24),
      requestedAt: asDate(body.requestedAt) ?? new Date(),
      firstResponseAt: asDate(body.firstResponseAt),
      resolvedAt: status === 'RESUELTO' ? asDate(body.resolvedAt) ?? new Date() : null,
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollServiceCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollEmployeeServiceCase.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Caso de servicio no encontrado' }, { status: 404 })
  }

  await prisma.payrollEmployeeServiceCase.delete({ where: { id } })
  const data = await serializePayrollServiceCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
