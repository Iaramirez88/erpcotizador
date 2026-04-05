import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollFrequency, PayrollPeriodStatus } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollDateRange, type PayrollPeriodRow } from '@/lib/payroll'

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

function isFrequency(value: string): value is PayrollFrequency {
  return ['QUINCENAL', 'MENSUAL', 'SEMANAL', 'JORNAL'].includes(value)
}

function isStatus(value: string): value is PayrollPeriodStatus {
  return ['BORRADOR', 'CALCULADA', 'PAGADA', 'CERRADA'].includes(value)
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

async function serializePeriods(empresaId: string): Promise<PayrollPeriodRow[]> {
  const rows = await prisma.payrollPeriod.findMany({
    where: { empresaId },
    orderBy: [{ startsAt: 'desc' }],
    select: {
      id: true,
      code: true,
      sedeId: true,
      label: true,
      frequency: true,
      status: true,
      startsAt: true,
      endsAt: true,
      paymentDate: true,
      notes: true,
      employeesCount: true,
      grossTotal: true,
      deductionsTotal: true,
      netTotal: true,
      socialSecurityTotal: true,
      parafiscalesTotal: true,
      accountingStatus: true,
    },
  })

  return rows.map((item) => ({
    id: item.id,
    code: item.code,
    sedeId: item.sedeId,
    label: item.label,
    frequency: item.frequency,
    status: item.status,
    range: buildPayrollDateRange(item.startsAt, item.endsAt),
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    paymentDate: item.paymentDate.toISOString(),
    employeesCount: item.employeesCount,
    grossTotal: item.grossTotal,
    deductionsTotal: item.deductionsTotal,
    netTotal: item.netTotal,
    socialSecurityTotal: item.socialSecurityTotal,
    parafiscalesTotal: item.parafiscalesTotal,
    notes: item.notes,
    accountingStatus: item.accountingStatus,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const frequency = asString(body.frequency)
  const label = asString(body.label)
  const startsAt = asDate(body.startsAt)
  const endsAt = asDate(body.endsAt)
  const paymentDate = asDate(body.paymentDate)
  const status = asString(body.status) || 'BORRADOR'

  if (!label || !isFrequency(frequency) || !startsAt || !endsAt || !paymentDate || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'label, frequency, startsAt, endsAt y paymentDate son requeridos' }, { status: 400 })
  }

  const count = await prisma.payrollPeriod.count({ where: { empresaId: access.empresaId } })

  await prisma.payrollPeriod.create({
    data: {
      empresaId: access.empresaId,
      sedeId: asString(body.sedeId) || access.sedeId,
      code: asString(body.code) || `PER-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      label,
      frequency,
      status,
      startsAt,
      endsAt,
      paymentDate,
      notes: asString(body.notes) || null,
    },
  })

  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const frequency = asString(body.frequency)
  const label = asString(body.label)
  const startsAt = asDate(body.startsAt)
  const endsAt = asDate(body.endsAt)
  const paymentDate = asDate(body.paymentDate)
  const status = asString(body.status) || 'BORRADOR'

  if (!id || !label || !isFrequency(frequency) || !startsAt || !endsAt || !paymentDate || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'id, label, frequency, startsAt, endsAt, paymentDate y status son requeridos' }, { status: 400 })
  }

  const period = await prisma.payrollPeriod.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!period) {
    return NextResponse.json({ ok: false, error: 'Período no encontrado' }, { status: 404 })
  }

  await prisma.payrollPeriod.update({
    where: { id },
    data: {
      sedeId: asNullableString(body.sedeId),
      code: asString(body.code) || undefined,
      label,
      frequency,
      status,
      startsAt,
      endsAt,
      paymentDate,
      notes: asNullableString(body.notes),
      closedAt: status === 'CERRADA' ? new Date() : null,
    },
  })

  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })
  }

  const period = await prisma.payrollPeriod.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, status: true, _count: { select: { items: true, payslips: true, novelties: true, settlements: true } } },
  })
  if (!period) {
    return NextResponse.json({ ok: false, error: 'Período no encontrado' }, { status: 404 })
  }

  if (period.status !== 'BORRADOR' || period._count.items || period._count.payslips || period._count.novelties || period._count.settlements) {
    return NextResponse.json({ ok: false, error: 'Solo se pueden eliminar períodos en borrador y sin movimientos asociados' }, { status: 400 })
  }

  await prisma.payrollPeriod.delete({ where: { id } })
  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}