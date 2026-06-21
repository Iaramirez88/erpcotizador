import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollAttendanceDemoData, serializePayrollAttendance } from '@/lib/payroll-operations'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asNumber(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

const ATTENDANCE_STATUSES = ['PRESENTE', 'TARDE', 'AUSENTE', 'PERMISO', 'VACACIONES', 'INCAPACIDAD'] as const

function isStatus(value: string): value is (typeof ATTENDANCE_STATUSES)[number] {
  return ATTENDANCE_STATUSES.includes(value as (typeof ATTENDANCE_STATUSES)[number])
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollAttendanceDemoData(access.empresaId, access.userId)
  const data = await serializePayrollAttendance(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const entryDate = asDate(body.entryDate)
  const shiftName = asString(body.shiftName)
  const status = asString(body.status) || 'PRESENTE'

  if (!employeeId || !entryDate || !shiftName || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'employeeId, entryDate, shiftName y status son requeridos' }, { status: 400 })
  }

  await prisma.payrollAttendanceEntry.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      periodId: asNullableString(body.periodId),
      entryDate,
      shiftName,
      status,
      checkInAt: asDate(body.checkInAt),
      checkOutAt: asDate(body.checkOutAt),
      minutesLate: asNumber(body.minutesLate),
      overtimeMinutes: asNumber(body.overtimeMinutes),
      leaveType: asNullableString(body.leaveType),
      notes: asNullableString(body.notes),
      createdById: access.userId,
      approvedById: status === 'PRESENTE' || status === 'PERMISO' || status === 'VACACIONES' ? access.userId : null,
      approvedAt: status === 'PRESENTE' || status === 'PERMISO' || status === 'VACACIONES' ? new Date() : null,
    },
  })

  const data = await serializePayrollAttendance(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const entryDate = asDate(body.entryDate)
  const shiftName = asString(body.shiftName)
  const status = asString(body.status) || 'PRESENTE'

  if (!id || !employeeId || !entryDate || !shiftName || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, entryDate, shiftName y status son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollAttendanceEntry.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Registro de asistencia no encontrado' }, { status: 404 })
  }

  await prisma.payrollAttendanceEntry.update({
    where: { id },
    data: {
      employeeId,
      periodId: asNullableString(body.periodId),
      entryDate,
      shiftName,
      status,
      checkInAt: asDate(body.checkInAt),
      checkOutAt: asDate(body.checkOutAt),
      minutesLate: asNumber(body.minutesLate),
      overtimeMinutes: asNumber(body.overtimeMinutes),
      leaveType: asNullableString(body.leaveType),
      notes: asNullableString(body.notes),
      approvedById: status === 'PRESENTE' || status === 'PERMISO' || status === 'VACACIONES' ? access.userId : null,
      approvedAt: status === 'PRESENTE' || status === 'PERMISO' || status === 'VACACIONES' ? new Date() : null,
    },
  })

  const data = await serializePayrollAttendance(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollAttendanceEntry.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Registro de asistencia no encontrado' }, { status: 404 })
  }

  await prisma.payrollAttendanceEntry.delete({ where: { id } })
  const data = await serializePayrollAttendance(access.empresaId)
  return NextResponse.json({ ok: true, data })
}