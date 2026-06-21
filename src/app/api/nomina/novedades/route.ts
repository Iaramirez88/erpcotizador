import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollNoveltyStatus, PayrollNoveltyType } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { ensurePayrollNoveltyDemoData } from '@/lib/payroll-operations'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollNoveltyRow } from '@/lib/payroll'

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
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function isType(value: string): value is PayrollNoveltyType {
  return ['INCAPACIDAD', 'HORA_EXTRA', 'AUSENCIA', 'LICENCIA', 'BONIFICACION', 'DESCUENTO', 'RECARGO', 'COMISION', 'EMBARGO', 'PRESTAMO', 'VACACIONES'].includes(value)
}

function isStatus(value: string): value is PayrollNoveltyStatus {
  return ['RADICADA', 'VALIDADA', 'APLICADA', 'RECHAZADA'].includes(value)
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

async function serializeNovelties(empresaId: string): Promise<PayrollNoveltyRow[]> {
  const rows = await prisma.payrollNovelty.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      employee: {
        select: { firstName: true, middleName: true, lastName: true, secondLastName: true },
      },
      period: { select: { label: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    contractId: item.contractId,
    periodId: item.periodId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    type: item.type,
    periodLabel: item.period?.label ?? 'Sin período',
    detail: item.detail,
    amount: item.amount ?? undefined,
    quantity: item.quantity ?? undefined,
    days: item.days ?? undefined,
    status: item.status,
    source: item.source,
    occurredOn: item.occurredOn?.toISOString() ?? null,
    startsAt: item.startsAt?.toISOString() ?? null,
    endsAt: item.endsAt?.toISOString() ?? null,
    supportNumber: item.supportNumber ?? null,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  await ensurePayrollNoveltyDemoData(access.empresaId, access.userId)
  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const type = asString(body.type)
  const detail = asString(body.detail)
  const status = asString(body.status) || 'RADICADA'

  if (!employeeId || !isType(type) || !detail || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'employeeId, type y detail son requeridos' }, { status: 400 })
  }

  await prisma.payrollNovelty.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      contractId: asString(body.contractId) || null,
      periodId: asString(body.periodId) || null,
      type,
      status,
      source: asString(body.source) || 'MANUAL',
      detail,
      amount: asNumber(body.amount),
      quantity: asNumber(body.quantity),
      days: asNumber(body.days),
      occurredOn: asDate(body.occurredOn),
      startsAt: asDate(body.startsAt),
      endsAt: asDate(body.endsAt),
      supportNumber: asString(body.supportNumber) || null,
      supportUrl: asString(body.supportUrl) || null,
      createdById: access.userId,
    },
  })

  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const type = asString(body.type)
  const detail = asString(body.detail)
  const status = asString(body.status) || 'RADICADA'

  if (!id || !employeeId || !isType(type) || !detail || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, type, detail y status son requeridos' }, { status: 400 })
  }

  const novelty = await prisma.payrollNovelty.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!novelty) {
    return NextResponse.json({ ok: false, error: 'Novedad no encontrada' }, { status: 404 })
  }

  await prisma.payrollNovelty.update({
    where: { id },
    data: {
      employeeId,
      contractId: asNullableString(body.contractId),
      periodId: asNullableString(body.periodId),
      type,
      status,
      source: asString(body.source) || 'MANUAL',
      detail,
      amount: asNumber(body.amount),
      quantity: asNumber(body.quantity),
      days: asNumber(body.days),
      occurredOn: asDate(body.occurredOn),
      startsAt: asDate(body.startsAt),
      endsAt: asDate(body.endsAt),
      supportNumber: asNullableString(body.supportNumber),
      supportUrl: asNullableString(body.supportUrl),
      approvedAt: status === 'VALIDADA' || status === 'APLICADA' ? new Date() : null,
      approvedById: status === 'VALIDADA' || status === 'APLICADA' ? access.userId : null,
    },
  })

  const data = await serializeNovelties(access.empresaId)
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

  const novelty = await prisma.payrollNovelty.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, _count: { select: { conceptLines: true } } },
  })

  if (!novelty) {
    return NextResponse.json({ ok: false, error: 'Novedad no encontrada' }, { status: 404 })
  }

  if (novelty._count.conceptLines) {
    return NextResponse.json({ ok: false, error: 'No se puede eliminar una novedad ya aplicada al cálculo' }, { status: 400 })
  }

  await prisma.payrollNovelty.delete({ where: { id } })
  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}