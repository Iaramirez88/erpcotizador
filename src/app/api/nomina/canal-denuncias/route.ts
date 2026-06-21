import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollWhistleblowerDemoData, serializePayrollWhistleblowerCases } from '@/lib/payroll-whistleblower'

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

function asBoolean(value: unknown) {
  return value === true || value === 'true'
}

const CASE_STATUSES = ['RECIBIDA', 'INVESTIGACION', 'EN_COMITE', 'RESUELTA'] as const
const CASE_SEVERITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const

function isStatus(value: string): value is (typeof CASE_STATUSES)[number] {
  return CASE_STATUSES.includes(value as (typeof CASE_STATUSES)[number])
}

function isSeverity(value: string): value is (typeof CASE_SEVERITIES)[number] {
  return CASE_SEVERITIES.includes(value as (typeof CASE_SEVERITIES)[number])
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollWhistleblowerDemoData(access.empresaId, access.userId)
  const data = await serializePayrollWhistleblowerCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const title = asString(body.title)
  const category = asString(body.category)
  const summary = asString(body.summary)
  const status = asString(body.status) || 'RECIBIDA'
  const severity = asString(body.severity) || 'MEDIA'

  if (!title || !category || !summary || !isStatus(status) || !isSeverity(severity)) {
    return NextResponse.json({ ok: false, error: 'title, category, summary, status y severity son requeridos' }, { status: 400 })
  }

  await prisma.payrollWhistleblowerCase.create({
    data: {
      empresaId: access.empresaId,
      employeeId: asNullableString(body.employeeId),
      assignedToUserId: access.userId,
      resolvedByUserId: status === 'RESUELTA' ? access.userId : null,
      title,
      category,
      severity,
      status,
      anonymousReport: asBoolean(body.anonymousReport),
      confidentialityLevel: asString(body.confidentialityLevel) || 'ALTA',
      reportedChannel: asString(body.reportedChannel) || 'PORTAL',
      reporterName: asNullableString(body.reporterName),
      reporterEmail: asNullableString(body.reporterEmail),
      reporterRole: asNullableString(body.reporterRole),
      accusedArea: asNullableString(body.accusedArea),
      occurredAt: asDate(body.occurredAt),
      summary,
      evidenceSummary: asNullableString(body.evidenceSummary),
      resolution: asNullableString(body.resolution),
      followUpRequired: body.followUpRequired == null ? true : asBoolean(body.followUpRequired),
      firstResponseAt: asDate(body.firstResponseAt),
      resolvedAt: status === 'RESUELTA' ? asDate(body.resolvedAt) ?? new Date() : null,
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollWhistleblowerCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const title = asString(body.title)
  const category = asString(body.category)
  const summary = asString(body.summary)
  const status = asString(body.status) || 'RECIBIDA'
  const severity = asString(body.severity) || 'MEDIA'

  if (!id || !title || !category || !summary || !isStatus(status) || !isSeverity(severity)) {
    return NextResponse.json({ ok: false, error: 'id, title, category, summary, status y severity son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollWhistleblowerCase.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Denuncia no encontrada' }, { status: 404 })
  }

  await prisma.payrollWhistleblowerCase.update({
    where: { id },
    data: {
      employeeId: asNullableString(body.employeeId),
      assignedToUserId: access.userId,
      resolvedByUserId: status === 'RESUELTA' ? access.userId : null,
      title,
      category,
      severity,
      status,
      anonymousReport: asBoolean(body.anonymousReport),
      confidentialityLevel: asString(body.confidentialityLevel) || 'ALTA',
      reportedChannel: asString(body.reportedChannel) || 'PORTAL',
      reporterName: asNullableString(body.reporterName),
      reporterEmail: asNullableString(body.reporterEmail),
      reporterRole: asNullableString(body.reporterRole),
      accusedArea: asNullableString(body.accusedArea),
      occurredAt: asDate(body.occurredAt),
      summary,
      evidenceSummary: asNullableString(body.evidenceSummary),
      resolution: asNullableString(body.resolution),
      followUpRequired: body.followUpRequired == null ? true : asBoolean(body.followUpRequired),
      firstResponseAt: asDate(body.firstResponseAt),
      resolvedAt: status === 'RESUELTA' ? asDate(body.resolvedAt) ?? new Date() : null,
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollWhistleblowerCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollWhistleblowerCase.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Denuncia no encontrada' }, { status: 404 })
  }

  await prisma.payrollWhistleblowerCase.delete({ where: { id } })
  const data = await serializePayrollWhistleblowerCases(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
