import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollSettlementReason, PayrollSettlementStatus } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { ensurePayrollSettlementDemoData } from '@/lib/payroll-operations'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollSettlementRow } from '@/lib/payroll'

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

function asInteger(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

function asNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function isReason(value: string): value is PayrollSettlementReason {
  return ['RENUNCIA', 'TERMINACION', 'MUTUO_ACUERDO', 'JUSTA_CAUSA', 'FIN_CONTRATO'].includes(value)
}

function isStatus(value: string): value is PayrollSettlementStatus {
  return ['PENDIENTE', 'LIQUIDADA', 'PAGADA', 'ANULADA'].includes(value)
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

async function serializeSettlements(empresaId: string): Promise<PayrollSettlementRow[]> {
  const rows = await prisma.payrollSettlement.findMany({
    where: { empresaId },
    orderBy: [{ retirementDate: 'desc' }],
    include: {
      employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    contractId: item.contractId,
    periodId: item.periodId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    reason: item.reason,
    retirementDate: item.retirementDate.toISOString(),
    liquidationDate: item.liquidationDate?.toISOString() ?? null,
    paymentDate: item.paymentDate?.toISOString() ?? null,
    workedDays: item.workedDays,
    total: item.total,
    status: item.status,
    notes: item.notes,
    accountingStatus: item.accountingStatus,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  await ensurePayrollSettlementDemoData(access.empresaId, access.userId)
  const data = await serializeSettlements(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const reason = asString(body.reason)
  const retirementDate = asDate(body.retirementDate)
  const status = asString(body.status) || 'PENDIENTE'
  const workedDays = asInteger(body.workedDays)

  if (!employeeId || !isReason(reason) || !retirementDate || !isStatus(status) || workedDays === null) {
    return NextResponse.json({ ok: false, error: 'employeeId, reason, retirementDate y workedDays son requeridos' }, { status: 400 })
  }

  await prisma.payrollSettlement.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      contractId: asString(body.contractId) || null,
      periodId: asString(body.periodId) || null,
      reason,
      status,
      retirementDate,
      liquidationDate: asDate(body.liquidationDate) ?? (status === 'LIQUIDADA' || status === 'PAGADA' ? new Date() : null),
      paymentDate: asDate(body.paymentDate) ?? (status === 'PAGADA' ? new Date() : null),
      workedDays,
      total: asNumber(body.total) ?? 0,
      notes: asString(body.notes) || null,
      createdById: access.userId,
    },
  })

  const data = await serializeSettlements(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const reason = asString(body.reason)
  const retirementDate = asDate(body.retirementDate)
  const status = asString(body.status) || 'PENDIENTE'
  const workedDays = asInteger(body.workedDays)

  if (!id || !employeeId || !isReason(reason) || !retirementDate || !isStatus(status) || workedDays === null) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, reason, retirementDate, workedDays y status son requeridos' }, { status: 400 })
  }

  const settlement = await prisma.payrollSettlement.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!settlement) {
    return NextResponse.json({ ok: false, error: 'Liquidación no encontrada' }, { status: 404 })
  }

  await prisma.payrollSettlement.update({
    where: { id },
    data: {
      employeeId,
      contractId: asNullableString(body.contractId),
      periodId: asNullableString(body.periodId),
      reason,
      status,
      retirementDate,
      liquidationDate: asDate(body.liquidationDate) ?? (status === 'LIQUIDADA' || status === 'PAGADA' ? new Date() : null),
      paymentDate: asDate(body.paymentDate) ?? (status === 'PAGADA' ? new Date() : null),
      workedDays,
      total: asNumber(body.total) ?? 0,
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializeSettlements(access.empresaId)
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

  const settlement = await prisma.payrollSettlement.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, accountingStatus: true, _count: { select: { lines: true } } },
  })
  if (!settlement) {
    return NextResponse.json({ ok: false, error: 'Liquidación no encontrada' }, { status: 404 })
  }

  if (settlement.accountingStatus !== 'PENDIENTE' || settlement._count.lines) {
    return NextResponse.json({ ok: false, error: 'No se puede eliminar una liquidación ya contabilizada o con detalle generado' }, { status: 400 })
  }

  await prisma.payrollSettlement.delete({ where: { id } })
  const data = await serializeSettlements(access.empresaId)
  return NextResponse.json({ ok: true, data })
}